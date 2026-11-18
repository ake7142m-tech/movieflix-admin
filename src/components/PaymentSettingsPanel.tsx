import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, CreditCard, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, PaymentRow, StripeStatus, VipPlan } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const field =
  'w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/40';
const baht = (satang: number) => `฿${(satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface Props {
  isAdmin: boolean;
  plans: VipPlan[];
  onUpdatePlans: (plans: VipPlan[]) => void;
}

const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
];

export const PaymentSettingsPanel: React.FC<Props> = ({ isAdmin, plans, onUpdatePlans }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState<{ paidCount: number; paidAmount: number } | null>(null);
  const [loadingPay, setLoadingPay] = useState(false);

  const webhookUrl = `${window.location.origin}/api/payments/stripe/webhook`;

  const loadPayments = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingPay(true);
    try {
      const r = await api.listPayments();
      setPayments(r.payments);
      setTotals(r.totals);
    } catch {
      /* shown as empty */
    }
    setLoadingPay(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    api.stripeStatus().then((s) => {
      setStatus(s);
      setEnabled(s.enabled);
    }).catch(() => setStatus({ configured: false, enabled: false, mode: null, keyLast4: '', hasWebhookSecret: false, webhookPath: '' }));
    void loadPayments();
  }, [isAdmin, loadPayments]);

  if (!isAdmin) {
    return (
      <div className="bg-[#1A1A1A] rounded-xl p-8 text-center text-sm text-gray-400 border border-white/5">
        {th ? 'การตั้งค่าการชำระเงินทำได้เฉพาะผู้ดูแลระบบสูงสุด' : 'Payment settings are for administrators only.'}
      </div>
    );
  }
  if (!status) return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.saveStripe({ enabled, secretKey: secretKey || undefined, webhookSecret: webhookSecret || undefined });
      setStatus(s);
      setEnabled(s.enabled);
      setSecretKey('');
      setWebhookSecret('');
      setMsg({ ok: true, text: th ? 'บันทึกแล้ว' : 'Saved' });
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Error' });
    }
    setBusy(false);
  };

  const patchPlan = (id: string, p: Partial<VipPlan>) => onUpdatePlans(plans.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const badge = (st: PaymentRow['status']) =>
    st === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : st === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300';
  const stLabel = (st: PaymentRow['status']) =>
    th ? { paid: 'ชำระแล้ว', pending: 'รอชำระ', failed: 'ไม่สำเร็จ', expired: 'หมดอายุ' }[st] : st;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Stripe connection */}
      <form onSubmit={save} className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5 space-y-4 text-xs sm:text-sm shadow-md">
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-[#0071EB] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-bold text-white flex items-center gap-2 flex-wrap">
              {th ? 'รับชำระเงินด้วย Stripe' : 'Accept payments with Stripe'}
              {status.configured && status.mode && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${status.mode === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {status.mode === 'live' ? 'LIVE' : 'TEST'}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              {th
                ? 'สมาชิกกดซื้อ VIP แล้วไปจ่ายที่หน้าชำระเงินของ Stripe (บัตร และ PromptPay หากเปิดไว้ใน Stripe) เมื่อจ่ายสำเร็จ ระบบเปิดสิทธิ์ VIP ให้เองและบันทึกรายการด้านล่าง กุญแจเก็บบนเซิร์ฟเวอร์เท่านั้น'
                : 'Members buy VIP on Stripe’s hosted page. When the payment succeeds, VIP turns on automatically and appears below. Keys stay on the server.'}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-gray-200 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {th ? 'เปิดรับชำระเงิน (แสดงปุ่มอัปเกรด VIP บนหน้าเว็บ)' : 'Accept payments (shows the VIP upgrade button)'}
        </label>

        <label className="block space-y-1">
          <span className="text-gray-300">
            Secret Key (<code>sk_test_…</code> / <code>sk_live_…</code>)
            {status.configured && (
              <span className="text-emerald-400 ml-2">{th ? `— ตั้งไว้แล้ว (…${status.keyLast4})` : `— set (…${status.keyLast4})`}</span>
            )}
          </span>
          <input type="password" autoComplete="new-password" className={`${field} font-mono`} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={status.configured ? (th ? 'เว้นว่างเพื่อใช้ค่าเดิม' : 'Leave empty to keep') : 'sk_test_...'} />
        </label>

        <label className="block space-y-1">
          <span className="text-gray-300">
            Webhook Signing Secret (<code>whsec_…</code>)
            {status.hasWebhookSecret && <span className="text-emerald-400 ml-2">{th ? '— ตั้งไว้แล้ว' : '— set'}</span>}
          </span>
          <input type="password" autoComplete="new-password" className={`${field} font-mono`} value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={status.hasWebhookSecret ? (th ? 'เว้นว่างเพื่อใช้ค่าเดิม' : 'Leave empty to keep') : 'whsec_...'} />
        </label>

        <div className="bg-black/30 rounded-lg p-3 space-y-2 text-xs text-gray-300">
          <div className="font-semibold text-white">{th ? 'ตั้งค่าใน Stripe Dashboard → Developers → Webhooks' : 'In Stripe Dashboard → Developers → Webhooks'}</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate bg-[#0F0F0F] rounded px-2 py-1.5">{webhookUrl}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* ignore */
                }
              }}
              className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (th ? 'คัดลอกแล้ว' : 'Copied') : th ? 'คัดลอก' : 'Copy'}
            </button>
          </div>
          <div className="text-gray-400">{th ? 'เลือกเหตุการณ์:' : 'Events:'} {EVENTS.join(', ')}</div>
        </div>

        {status.configured && !status.hasWebhookSecret && (
          <p className="flex items-start gap-2 text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
            {th
              ? 'ยังไม่ได้ตั้ง Webhook: ระบบยืนยันการชำระเงินได้เมื่อลูกค้ากลับมาที่เว็บเท่านั้น หากลูกค้าปิดหน้าก่อน หรือจ่ายผ่าน PromptPay จะไม่ได้รับสิทธิ์ ควรตั้ง Webhook ก่อนเปิดใช้จริง'
              : 'No webhook yet: payments are only confirmed when the customer returns to the site. Set one up before going live.'}
          </p>
        )}

        {msg && <p className={msg.ok ? 'text-emerald-400' : 'text-red-300'}>{msg.text}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#28A745] hover:bg-[#28A745]/90 disabled:opacity-50 text-white font-semibold cursor-pointer">
            {th ? 'บันทึก' : 'Save'}
          </button>
          {status.configured && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(th ? 'ลบกุญแจ Stripe และปิดรับชำระเงิน?' : 'Remove Stripe keys and stop accepting payments?')) return;
                await api.clearStripe();
                setStatus({ ...status, configured: false, enabled: false, mode: null, keyLast4: '', hasWebhookSecret: false });
                setEnabled(false);
              }}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 text-gray-200 cursor-pointer"
            >
              {th ? 'ลบกุญแจ' : 'Remove keys'}
            </button>
          )}
        </div>
      </form>

      {/* Plans */}
      <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">{th ? 'แพ็กเกจ VIP ที่ขาย' : 'VIP plans for sale'}</h3>
          <button
            onClick={() => onUpdatePlans([...plans, { id: `plan-${Date.now().toString(36)}`, name: th ? 'แพ็กเกจใหม่' : 'New plan', description: '', amount: 9900, days: 30, active: true }])}
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {th ? 'เพิ่มแพ็กเกจ' : 'Add plan'}
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          {th ? 'ราคาขั้นต่ำ 10 บาท (ข้อกำหนดของ Stripe) แพ็กเกจที่ราคาหรือจำนวนวันไม่ถูกต้องจะไม่แสดงบนหน้าเว็บ ผู้ที่ซื้อซ้ำจะได้วันต่อจากวันหมดอายุเดิม' : 'Minimum 10 baht (Stripe). Invalid plans are not shown. Repeat purchases extend the current expiry.'}
        </p>
        {plans.length === 0 && <div className="text-xs text-gray-500 py-4 text-center">{th ? 'ยังไม่มีแพ็กเกจ' : 'No plans yet'}</div>}
        {plans.map((pl) => {
          const invalid = !(pl.amount >= 1000) || !(pl.days >= 1);
          return (
            <div key={pl.id} className={`grid grid-cols-2 sm:grid-cols-[1fr_110px_90px_auto] gap-2 items-center p-2.5 rounded-lg bg-[#141414] border ${invalid ? 'border-red-500/40' : 'border-white/5'} ${pl.active ? '' : 'opacity-60'}`}>
              <input className={`${field} col-span-2 sm:col-span-1`} value={pl.name} onChange={(e) => patchPlan(pl.id, { name: e.target.value })} aria-label={th ? 'ชื่อแพ็กเกจ' : 'Plan name'} />
              <label className="flex items-center gap-1 text-gray-400 text-xs">
                ฿
                <input type="number" min={10} step={1} className={field} value={pl.amount / 100} onChange={(e) => patchPlan(pl.id, { amount: Math.round(Number(e.target.value || 0) * 100) })} aria-label={th ? 'ราคา (บาท)' : 'Price (baht)'} />
              </label>
              <label className="flex items-center gap-1 text-gray-400 text-xs">
                <input type="number" min={1} step={1} className={field} value={pl.days} onChange={(e) => patchPlan(pl.id, { days: Math.round(Number(e.target.value || 0)) })} aria-label={th ? 'จำนวนวัน' : 'Days'} />
                {th ? 'วัน' : 'd'}
              </label>
              <div className="flex items-center gap-1 justify-end col-span-2 sm:col-span-1">
                <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={pl.active !== false} onChange={(e) => patchPlan(pl.id, { active: e.target.checked })} />
                  {th ? 'ขาย' : 'On'}
                </label>
                <button
                  onClick={() => window.confirm(th ? `ลบแพ็กเกจ "${pl.name}" ?` : `Delete "${pl.name}"?`) && onUpdatePlans(plans.filter((x) => x.id !== pl.id))}
                  className="p-1.5 text-gray-400 hover:text-red-400 cursor-pointer"
                  aria-label={th ? 'ลบ' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input className={`${field} col-span-2 sm:col-span-4`} value={pl.description || ''} onChange={(e) => patchPlan(pl.id, { description: e.target.value })} placeholder={th ? 'คำอธิบายสั้นๆ (ไม่บังคับ)' : 'Short description (optional)'} aria-label={th ? 'คำอธิบาย' : 'Description'} />
            </div>
          );
        })}
      </div>

      {/* Payments */}
      <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">{th ? 'รายการชำระเงินล่าสุด' : 'Recent payments'}</h3>
          <button onClick={() => void loadPayments()} className="p-1.5 text-gray-400 hover:text-white cursor-pointer" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loadingPay ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {totals && (
          <div className="text-xs text-gray-300">
            {th ? 'รายรับรวม' : 'Revenue'} <strong className="text-emerald-300 text-sm">{baht(totals.paidAmount)}</strong> · {totals.paidCount} {th ? 'รายการที่ชำระแล้ว' : 'paid'}
          </div>
        )}
        {payments.length === 0 ? (
          <div className="text-xs text-gray-500 py-4 text-center">{th ? 'ยังไม่มีรายการ' : 'No payments yet'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">{th ? 'เวลา' : 'Time'}</th>
                  <th className="py-1.5 pr-3 font-medium">{th ? 'สมาชิก' : 'Member'}</th>
                  <th className="py-1.5 pr-3 font-medium">{th ? 'แพ็กเกจ' : 'Plan'}</th>
                  <th className="py-1.5 pr-3 font-medium text-right">{th ? 'ยอด' : 'Amount'}</th>
                  <th className="py-1.5 font-medium">{th ? 'สถานะ' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(p.paidAt || p.createdAt).toLocaleString(th ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="py-1.5 pr-3 truncate max-w-[180px]">{p.memberEmail}</td>
                    <td className="py-1.5 pr-3">{p.planName}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{baht(p.amount)}</td>
                    <td className="py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge(p.status)}`}>{stLabel(p.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
