import React, { useState } from 'react';
import '../site.css';
import { Crown, Loader2, ShieldCheck, X } from 'lucide-react';
import { VipPlan } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  plans: VipPlan[];
  currentPlan: 'free' | 'vip';
  vipUntil?: string | null;
  onClose: () => void;
  /** starts the payment; resolves only if the redirect did not happen (error) */
  onCheckout: (planId: string) => Promise<void>;
}

export const formatBaht = (satang: number) =>
  `฿${(satang / 100).toLocaleString('th-TH', { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const PlansModal: React.FC<Props> = ({ plans, currentPlan, vipUntil, onClose, onCheckout }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pay = async (id: string) => {
    setError('');
    setBusyId(id);
    try {
      await onCheckout(id);
    } catch (e: any) {
      setError(e?.message || (th ? 'เริ่มการชำระเงินไม่สำเร็จ' : 'Could not start the payment'));
      setBusyId(null);
    }
  };

  const until = vipUntil ? new Date(vipUntil).toLocaleDateString(th ? 'th-TH' : 'en-US', { dateStyle: 'long' }) : '';

  return (
    <div
      className="site fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={th ? 'แพ็กเกจ VIP' : 'VIP plans'}
    >
      <div className="relative w-full max-w-lg bg-[#101014] border border-white/10 rounded-2xl p-6 shadow-2xl my-8">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white cursor-pointer" aria-label={th ? 'ปิด' : 'Close'}>
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-black text-xs font-black px-2.5 py-1 rounded-full mb-3">
            <Crown className="w-3.5 h-3.5" /> VIP
          </div>
          <h2 className="text-xl font-bold">
            {currentPlan === 'vip' ? (th ? 'ต่ออายุสมาชิก VIP' : 'Extend your VIP') : th ? 'สมัครสมาชิก VIP' : 'Become a VIP member'}
          </h2>
          {currentPlan === 'vip' && (
            <p className="text-xs text-gray-400 mt-1">
              {until
                ? th ? `VIP ของคุณใช้ได้ถึง ${until} — วันที่ซื้อเพิ่มจะต่อจากวันหมดอายุเดิม` : `Your VIP runs until ${until}. New days are added on top.`
                : th ? 'คุณเป็น VIP แบบไม่มีวันหมดอายุ' : 'Your VIP does not expire.'}
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 bg-[#16161b] border border-white/10 rounded-xl p-4">
              <div className="min-w-0">
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-gray-400">
                  {th ? `${p.days} วัน` : `${p.days} days`}
                  {p.description ? ` · ${p.description}` : ''}
                </div>
              </div>
              <button
                onClick={() => void pay(p.id)}
                disabled={busyId !== null}
                className="flex-shrink-0 bg-[#E50914] hover:bg-[#E50914]/90 disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                {busyId === p.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {formatBaht(p.amount)}
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <p className="mt-4 text-[11px] text-gray-500 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          {th
            ? 'ชำระเงินผ่านหน้าชำระเงินของ Stripe เว็บไซต์นี้ไม่เก็บข้อมูลบัตรของคุณ สิทธิ์ VIP จะเปิดให้อัตโนมัติหลังชำระเงินสำเร็จ'
            : 'You pay on Stripe’s secure page — this site never sees your card. VIP turns on automatically once the payment succeeds.'}
        </p>
      </div>
    </div>
  );
};
