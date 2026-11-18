import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { loadDb, saveDb, COLLECTIONS, type Role } from './store';
import { registerMembers, attachMember } from './members';
import { registerPayments } from './payments';
import { registerPublic, broadcast, flushPending, renderIndexHtml, loadIndexTemplate } from './public';
import {
  attachAuth,
  requireAuth,
  requireAdmin,
  authenticate,
  startSession,
  switchActive,
  endSession,
  revokeUser,
  sessionSnapshot,
  hashPassword,
  verifyPassword,
  validatePassword,
  ensureInitialUsers,
  toPublicUser,
  defaultAvatar,
  throttleKey,
  isLocked,
  recordFailure,
  clearFailures,
} from './auth';

const PORT = Number(process.env.PORT || 3001);
const IS_PROD = process.env.NODE_ENV === 'production';
const SERIES_JEEN_BASE = 'https://api.seriesjeen.online';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

/* ───────────── security headers ───────────── */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PROD && process.env.COOKIE_SECURE === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

app.use(
  express.json({
    limit: '6mb',
    // Stripe signs the exact bytes it sent, so keep them for the webhook route
    verify: (req: any, _res, buf) => {
      if (req.url?.startsWith('/api/payments/stripe/webhook')) req.rawBody = buf;
    },
  })
);

/* ───────────── CSRF: state-changing requests must come from our own origin ───────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let ok = allowedOrigins.includes(origin);
    try {
      ok = ok || new URL(origin).host === req.headers.host;
    } catch {
      ok = false;
    }
    // Vite dev server proxies with a different Origin host
    if (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ok = true;
    if (!ok) return res.status(403).json({ error: 'bad_origin', message: 'Origin ไม่ได้รับอนุญาต' });
  }
  if (!req.is('application/json') && req.method !== 'DELETE') {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }
  next();
});

app.use(attachAuth);
app.use(attachMember);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ───────────── auth ───────────── */
app.get('/api/auth/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.auth) return res.json({ authenticated: false });
  res.json(sessionSnapshot(req.auth));
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = (req.body || {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'bad_request', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน' });
  }
  const key = throttleKey(req, username.trim());
  const wait = isLocked(key);
  if (wait) {
    return res.status(429).json({
      error: 'locked',
      message: `ลองผิดหลายครั้งเกินไป กรุณารออีก ${Math.ceil(wait / 60)} นาที`,
    });
  }
  const user = await authenticate(username.trim(), password);
  if (!user) {
    recordFailure(key);
    return res.status(401).json({ error: 'invalid_credentials', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  clearFailures(key);
  const session = startSession(req, res, user);
  const db = loadDb();
  res.json({
    authenticated: true,
    sessions: session.userIds
      .map((id) => db.users.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map(toPublicUser),
    activeUserId: user.id,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { userId } = (req.body || {}) as { userId?: unknown };
  endSession(req, res, typeof userId === 'string' ? userId : undefined);
  res.json({ ok: true });
});

app.post('/api/auth/switch', requireAuth, (req, res) => {
  const { userId } = (req.body || {}) as { userId?: unknown };
  if (typeof userId !== 'string' || !switchActive(req, userId)) {
    return res.status(400).json({ error: 'not_in_session', message: 'บัญชีนี้ยังไม่ได้เข้าสู่ระบบในเซสชันนี้' });
  }
  const users = req.auth!.sessionUsers.map(toPublicUser);
  res.json({ authenticated: true, sessions: users, activeUserId: userId });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = (req.body || {}) as { currentPassword?: unknown; newPassword?: unknown };
  const err = validatePassword(newPassword);
  if (err) return res.status(400).json({ error: 'weak_password', message: err });
  const me = req.auth!.user;
  if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, me.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
  }
  me.passwordHash = await hashPassword(newPassword as string);
  saveDb();
  revokeUser(me.id);
  res.clearCookie('freedom_sid');
  res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่' });
});

/* ───────────── content data ───────────── */
function publicSettings(s: any) {
  return { ...(s || {}), apiKey: '' }; // never send keys to the browser
}

app.get('/api/data', requireAuth, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = loadDb();
  const out: Record<string, unknown> = { ...db.collections };
  out.settings = publicSettings(out.settings);
  out.users = db.users.map(toPublicUser);
  const k = db.secrets.seriesjeen;
  out.seriesJeen = { configured: !!k, last4: k ? k.slice(-4) : '' };
  res.json(out);
});

app.put('/api/data/:name', requireAuth, (req, res) => {
  const def = COLLECTIONS[req.params.name];
  if (!def) return res.status(404).json({ error: 'unknown_collection' });
  if (def.adminOnly && req.auth!.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'ส่วนนี้แก้ไขได้เฉพาะผู้ดูแลระบบสูงสุด' });
  }
  const body = req.body?.value;
  if (def.kind === 'array') {
    if (!Array.isArray(body) || body.length > 20000) return res.status(400).json({ error: 'expected_array' });
    const ok = body.every((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof (x as any).id === 'string');
    if (!ok) return res.status(400).json({ error: 'invalid_items', message: 'ทุกรายการต้องเป็นออบเจ็กต์ที่มี id' });
  } else if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'expected_object' });
  }
  const db = loadDb();
  let value = body;
  if (req.params.name === 'settings') value = { ...body, apiKey: '' };
  if (req.params.name === 'videoAds') {
    // impressions/clicks are counted by the server: an admin save must not overwrite them
    const current = new Map<string, any>(((db.collections.videoAds as any[]) || []).map((a) => [a.id, a]));
    value = body.map((a: any) => {
      const old = current.get(a.id);
      return { ...a, impressions: old?.impressions ?? 0, clicks: old?.clicks ?? 0 };
    });
  }
  db.collections[req.params.name] = value;
  saveDb();
  broadcast(); // open public pages refresh right away
  res.json({ ok: true });
});

/* ───────────── user management (admin only) ───────────── */
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;
const ROLES: Role[] = ['admin', 'staff'];
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

app.get('/api/users', requireAdmin, (_req, res) => res.json(loadDb().users.map(toPublicUser)));

app.post('/api/users', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const username = str(b.username, 32).toLowerCase();
  const role = b.role as Role;
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'bad_username', message: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . - (3–32 ตัว)' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'bad_role' });
  const pwErr = validatePassword(b.password);
  if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });
  const db = loadDb();
  if (db.users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'exists', message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  }
  const user = {
    id: `user-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    username,
    name: str(b.name) || username,
    role,
    email: str(b.email) || `${username}@freedom.local`,
    avatar: defaultAvatar(role),
    passwordHash: await hashPassword(b.password as string),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDb();
  res.status(201).json(toPublicUser(user));
});

app.patch('/api/users/:id', requireAdmin, async (req, res) => {
  const db = loadDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  let revoke = false;
  if (b.name !== undefined) user.name = str(b.name) || user.name;
  if (b.email !== undefined) user.email = str(b.email);
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return res.status(400).json({ error: 'bad_role' });
    if (user.role === 'admin' && b.role !== 'admin' && db.users.filter((u) => u.role === 'admin').length <= 1) {
      return res.status(400).json({ error: 'last_admin', message: 'ต้องมีผู้ดูแลระบบสูงสุดอย่างน้อย 1 คน' });
    }
    if (user.role !== b.role) revoke = true;
    user.role = b.role;
  }
  if (b.password !== undefined) {
    const pwErr = validatePassword(b.password);
    if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });
    user.passwordHash = await hashPassword(b.password);
    revoke = true;
  }
  saveDb();
  if (revoke) revokeUser(user.id);
  res.json(toPublicUser(user));
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const db = loadDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.id === req.auth!.user.id) {
    return res.status(400).json({ error: 'self_delete', message: 'ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้' });
  }
  if (user.role === 'admin' && db.users.filter((u) => u.role === 'admin').length <= 1) {
    return res.status(400).json({ error: 'last_admin', message: 'ต้องมีผู้ดูแลระบบสูงสุดอย่างน้อย 1 คน' });
  }
  db.users = db.users.filter((u) => u.id !== user.id);
  saveDb();
  revokeUser(user.id);
  res.json({ ok: true });
});

/* ───────────── Series Open API: key stays on the server ───────────── */
app.get('/api/secrets/seriesjeen', requireAuth, (_req, res) => {
  const k = loadDb().secrets.seriesjeen;
  res.json({ configured: !!k, last4: k ? k.slice(-4) : '' });
});

app.post('/api/secrets/seriesjeen', requireAdmin, async (req, res) => {
  const key = str(req.body?.key, 512);
  if (!key) {
    return res.json({ success: false, message: 'กรุณากรอก API Key เพื่อเชื่อมต่อ Series Open API', statusCode: 400 });
  }
  try {
    const r = await fetch(`${SERIES_JEEN_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const profile = await r.json().catch(() => ({}));
      const db = loadDb();
      db.secrets.seriesjeen = key; // only saved after upstream accepts it
      saveDb();
      return res.json({ success: true, message: 'ยืนยัน API Key สำเร็จ', statusCode: r.status, profile });
    }
    const msg = r.status === 401 || r.status === 403 ? 'API Key ไม่ถูกต้องหรือหมดอายุ' : `เกิดข้อผิดพลาด (HTTP ${r.status})`;
    res.json({ success: false, message: msg, statusCode: r.status });
  } catch (e: any) {
    res.json({ success: false, message: `ไม่สามารถเชื่อมต่อ Series Open API: ${e?.message || e}`, statusCode: 502 });
  }
});

app.delete('/api/secrets/seriesjeen', requireAdmin, (_req, res) => {
  const db = loadDb();
  delete db.secrets.seriesjeen;
  saveDb();
  res.json({ ok: true });
});

// Authenticated pass-through that injects the stored key. Locked to the one upstream host.
app.all(/^\/api\/proxy\/seriesjeen(\/.*)?$/, requireAuth, async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' });
  const rest = req.originalUrl.replace(/^\/api\/proxy\/seriesjeen/, '') || '/';
  let target: URL;
  try {
    target = new URL(rest, SERIES_JEEN_BASE);
  } catch {
    return res.status(400).json({ error: 'bad_path' });
  }
  const allowedPath = target.pathname === '/health' || target.pathname === '/openapi.json' || target.pathname.startsWith('/api/');
  if (target.origin !== SERIES_JEEN_BASE || !allowedPath || target.pathname.includes('..')) {
    return res.status(400).json({ error: 'bad_path' });
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = loadDb().secrets.seriesjeen;
  if (key) headers.Authorization = `Bearer ${key}`;
  const init: RequestInit = { method: req.method, headers, signal: AbortSignal.timeout(25000) };
  if (req.method === 'POST') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(req.body ?? {});
  }
  try {
    const r = await fetch(target, init);
    res.status(r.status);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e: any) {
    res.status(502).json({ error: 'upstream_unreachable', message: String(e?.message || e) });
  }
});

registerMembers(app);
registerPayments(app);
registerPublic(app);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

/* ───────────── static frontend (production) ───────────── */
const distDir = path.resolve('dist');
const indexTemplate = fs.existsSync(distDir) ? loadIndexTemplate(distDir) : null;
if (indexTemplate) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  // Public site at "/", admin panel at "/admin". SEO tags are written into the HTML on every request,
  // so a change in the admin is what crawlers and link previews see right away.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(renderIndexHtml(indexTemplate, req.path.startsWith('/admin'), req.path, `${req.protocol}://${req.get('host')}`));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    flushPending();
    process.exit(0);
  });
}

await ensureInitialUsers();
app.listen(PORT, () => {
  console.log(`FREEDOM server listening on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
