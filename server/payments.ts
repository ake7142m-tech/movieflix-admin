import crypto from 'node:crypto';
import type { Express, Request } from 'express';
import { loadDb, saveDb, effectivePlan, type StoredMember, type StoredPayment } from './store';
import { requireAdmin } from './auth';
import { requireMember, toPublicMember } from './members';

/* VIP payments through Stripe Checkout (cards, and PromptPay when enabled in the Stripe dashboard).
 * Card data never touches this server. A payment only grants VIP after the server has confirmed it
 * with Stripe (signed webhook, or a direct lookup of the session) and the amount matches the plan. */

interface StripeCfg {
  enabled: boolean;
  secretKey: string;
  webhookSecret: string;
}

const apiBase = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function getCfg(): StripeCfg | null {
  let saved: Partial<StripeCfg> = {};
  const raw = loadDb().secrets.stripe;
  if (raw) {
    try {
      saved = JSON.parse(raw);
    } catch {
      saved = {};
    }
  }
  const secretKey = saved.secretKey || process.env.STRIPE_SECRET_KEY || '';
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: saved.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '',
    enabled: raw ? !!saved.enabled : true, // keys given only through the environment count as "on"
  };
}

const statusOf = () => {
  const c = getCfg();
  return {
    configured: !!c,
    enabled: !!c?.enabled,
    mode: c ? (c.secretKey.includes('_live_') ? ('live' as const) : ('test' as const)) : null,
    keyLast4: c ? c.secretKey.slice(-4) : '',
    hasWebhookSecret: !!c?.webhookSecret,
    webhookPath: '/api/payments/stripe/webhook',
  };
};

/** What visitors may know: the active plans, and whether buying is possible at all. */
export function stripePublicState(plans: any[]) {
  const active = plans
    .filter((p) => p && p.active && Number.isInteger(p.amount) && p.amount >= 1000 && Number.isInteger(p.days) && p.days > 0)
    .map(({ id, name, description, amount, days }) => ({ id, name, description, amount, days }));
  return { plans: active, paymentsEnabled: !!getCfg()?.enabled && active.length > 0 };
}

async function stripe(method: 'GET' | 'POST', path: string, form?: Record<string, string>) {
  const cfg = getCfg();
  if (!cfg) throw new Error('stripe_not_configured');
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe HTTP ${res.status}`);
  return data;
}

/** Stripe-Signature: "t=<unix>,v1=<hmac>" — HMAC-SHA256 over "<t>.<raw body>". */
export function verifyStripeSignature(raw: Buffer, header: string | undefined, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()] as const;
    })
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.`).update(raw).digest('hex');
  const candidates = header
    .split(',')
    .map((kv) => kv.trim())
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));
  const a = Buffer.from(expected);
  return candidates.some((c) => {
    const b = Buffer.from(c);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function extendVip(m: StoredMember, days: number) {
  if (m.plan === 'vip' && !m.vipUntil) return; // already VIP without an expiry (granted by an admin)
  const base = effectivePlan(m) === 'vip' && m.vipUntil ? new Date(m.vipUntil).getTime() : Date.now();
  m.plan = 'vip';
  m.vipUntil = new Date(base + days * 86_400_000).toISOString();
}

/** Idempotent: calling it twice for the same payment grants VIP once. */
function fulfill(p: StoredPayment, session: any): boolean {
  if (p.status === 'paid') return true;
  if (session?.payment_status !== 'paid') return false;
  if (session.amount_total !== p.amount || String(session.currency || '').toLowerCase() !== p.currency) {
    console.warn(`[payments] amount/currency mismatch for ${p.id} — not granting VIP`);
    return false;
  }
  p.status = 'paid';
  p.paidAt = new Date().toISOString();
  const m = loadDb().members.find((x) => x.id === p.memberId);
  if (m) extendVip(m, p.days);
  saveDb();
  return true;
}

const findPayment = (session: any): StoredPayment | undefined =>
  loadDb().payments.find((p) => p.stripeSessionId === session?.id || p.id === session?.metadata?.paymentId);

const originOf = (req: Request) =>
  (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

export function registerPayments(app: Express): void {
  /* ───── member: buy VIP ───── */
  app.post('/api/member/checkout', requireMember, async (req, res) => {
    const cfg = getCfg();
    if (!cfg?.enabled) return res.status(503).json({ error: 'payments_disabled', message: 'ขณะนี้ยังไม่เปิดรับชำระเงิน' });
    const m = req.member!;
    const plan = asArray((loadDb().collections as any).plans).find((p) => p?.id === req.body?.planId && p.active);
    if (!plan || !Number.isInteger(plan.amount) || plan.amount < 1000 || !Number.isInteger(plan.days) || plan.days < 1) {
      return res.status(400).json({ error: 'bad_plan', message: 'ไม่พบแพ็กเกจที่เลือก' });
    }
    const db = loadDb();
    const recent = db.payments.filter((p) => p.memberId === m.id && p.status === 'pending' && Date.now() - Date.parse(p.createdAt) < 600_000);
    if (recent.length >= 5) return res.status(429).json({ error: 'too_many', message: 'สร้างรายการชำระเงินบ่อยเกินไป กรุณารอสักครู่' });

    const payment: StoredPayment = {
      id: `pay-${crypto.randomBytes(8).toString('hex')}`,
      memberId: m.id,
      planId: plan.id,
      planName: String(plan.name).slice(0, 80),
      amount: plan.amount,
      currency: 'thb',
      days: plan.days,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const origin = originOf(req);
    try {
      const session = await stripe('POST', '/v1/checkout/sessions', {
        mode: 'payment',
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?payment=cancelled`,
        client_reference_id: m.id,
        customer_email: m.email,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': payment.currency,
        'line_items[0][price_data][unit_amount]': String(payment.amount),
        'line_items[0][price_data][product_data][name]': payment.planName,
        'metadata[paymentId]': payment.id,
        'metadata[memberId]': m.id,
      });
      if (typeof session.url !== 'string' || !/^https?:\/\//.test(session.url) || typeof session.id !== 'string') {
        throw new Error('bad_session');
      }
      payment.stripeSessionId = session.id;
      db.payments.push(payment);
      saveDb();
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[payments] checkout failed:', e?.message);
      res.status(502).json({ error: 'stripe_error', message: 'สร้างหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
    }
  });

  /* the page the member returns to after paying: confirm with Stripe, don't trust the URL */
  app.get('/api/member/payment-status', requireMember, async (req, res) => {
    const sid = String(req.query.session_id || '');
    const m = req.member!;
    const p = loadDb().payments.find((x) => x.stripeSessionId === sid && x.memberId === m.id);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (p.status === 'pending') {
      try {
        const s = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(sid)}`);
        if (!fulfill(p, s) && s.status === 'expired') {
          p.status = 'expired';
          saveDb();
        }
      } catch {
        /* still pending; the webhook may complete it */
      }
    }
    const pm = toPublicMember(m);
    res.json({ status: p.status, plan: pm.plan, vipUntil: pm.vipUntil, member: pm });
  });

  /* ───── Stripe → us ───── */
  app.post('/api/payments/stripe/webhook', (req, res) => {
    const cfg = getCfg();
    const raw: Buffer | undefined = (req as any).rawBody;
    if (!cfg?.webhookSecret) return res.status(400).json({ error: 'webhook_not_configured' });
    if (!raw || !verifyStripeSignature(raw, req.headers['stripe-signature'] as string | undefined, cfg.webhookSecret)) {
      return res.status(400).json({ error: 'bad_signature' });
    }
    const event = req.body;
    const obj = event?.data?.object;
    const p = findPayment(obj);
    if (p) {
      switch (event?.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          fulfill(p, obj);
          break;
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed':
          if (p.status === 'pending') {
            p.status = event.type.endsWith('expired') ? 'expired' : 'failed';
            saveDb();
          }
          break;
      }
    }
    res.json({ received: true });
  });

  /* ───── admin: keys and payment list ───── */
  app.get('/api/secrets/stripe', requireAdmin, (req, res) => {
    res.json({ ...statusOf(), webhookUrl: `${originOf(req)}/api/payments/stripe/webhook` });
  });

  app.put('/api/secrets/stripe', requireAdmin, (req, res) => {
    const b = req.body || {};
    let saved: Partial<StripeCfg> = {};
    try {
      saved = JSON.parse(loadDb().secrets.stripe || '{}');
    } catch {
      saved = {};
    }
    const sk = typeof b.secretKey === 'string' ? b.secretKey.trim() : '';
    const wh = typeof b.webhookSecret === 'string' ? b.webhookSecret.trim() : '';
    if (sk && !/^(sk|rk)_(test|live)_[A-Za-z0-9_]{10,}$/.test(sk)) {
      return res.status(400).json({ error: 'bad_key', message: 'รูปแบบ Secret Key ไม่ถูกต้อง (ต้องขึ้นต้นด้วย sk_test_ หรือ sk_live_)' });
    }
    if (wh && !/^whsec_[A-Za-z0-9_]{10,}$/.test(wh)) {
      return res.status(400).json({ error: 'bad_webhook_secret', message: 'รูปแบบ Webhook Secret ไม่ถูกต้อง (ต้องขึ้นต้นด้วย whsec_)' });
    }
    const next: StripeCfg = {
      secretKey: sk || saved.secretKey || '',
      webhookSecret: wh || saved.webhookSecret || '',
      enabled: !!b.enabled,
    };
    if (next.enabled && !next.secretKey) {
      return res.status(400).json({ error: 'no_key', message: 'ต้องกรอก Secret Key ก่อนเปิดรับชำระเงิน' });
    }
    loadDb().secrets.stripe = JSON.stringify(next);
    saveDb();
    res.json({ ...statusOf(), webhookUrl: `${originOf(req)}/api/payments/stripe/webhook` });
  });

  app.delete('/api/secrets/stripe', requireAdmin, (_req, res) => {
    delete loadDb().secrets.stripe;
    saveDb();
    res.json({ ok: true });
  });

  app.get('/api/payments', requireAdmin, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const db = loadDb();
    const byId = new Map(db.members.map((m) => [m.id, m]));
    const list = [...db.payments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 300)
      .map((p) => ({
        id: p.id,
        memberId: p.memberId,
        memberEmail: byId.get(p.memberId)?.email || '(ลบแล้ว)',
        planName: p.planName,
        amount: p.amount,
        currency: p.currency,
        days: p.days,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      }));
    const paid = db.payments.filter((p) => p.status === 'paid');
    res.json({
      payments: list,
      totals: { paidCount: paid.length, paidAmount: paid.reduce((s, p) => s + p.amount, 0), currency: 'thb' },
    });
  });
}
