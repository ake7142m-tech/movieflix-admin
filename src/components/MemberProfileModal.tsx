import React, { useState } from 'react';
import { Check, Crown, LogOut, X } from 'lucide-react';
import { PublicMember } from '../services/api';
import '../site.css';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  member: PublicMember;
  myListCount: number;
  onClose: () => void;
  onSaveName: (name: string) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<string>;
  onLogout: () => void;
  paymentsEnabled?: boolean;
  onOpenPlans?: () => void;
}

const field =
  'w-full bg-[#0c0c0f] border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/50';

export const MemberProfileModal: React.FC<Props> = ({ member, myListCount, onClose, onSaveName, onChangePassword, onLogout, paymentsEnabled, onOpenPlans }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [name, setName] = useState(member.displayName);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNameMsg(null);
    try {
      await onSaveName(name);
      setNameMsg({ ok: true, text: th ? 'บันทึกชื่อแล้ว' : 'Name saved' });
    } catch (err: any) {
      setNameMsg({ ok: false, text: err?.message || 'Error' });
    }
    setBusy(false);
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPwMsg(null);
    try {
      const text = await onChangePassword(cur, next);
      setPwMsg({ ok: true, text });
      setCur('');
      setNext('');
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message || 'Error' });
    }
    setBusy(false);
  };

  const since = new Date(member.createdAt).toLocaleDateString(th ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
    m ? (
      <p className={`text-xs flex items-center gap-1.5 ${m.ok ? 'text-emerald-400' : 'text-red-300'}`}>
        {m.ok && <Check className="w-3.5 h-3.5" />}
        {m.text}
      </p>
    ) : null;

  return (
    <div className="site fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-md bg-[#101014] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 my-8">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white cursor-pointer" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
            {member.displayName.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{member.displayName}</div>
            <div className="text-xs text-gray-400 truncate">{member.email}</div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              {member.plan === 'vip' ? (
                <span className="bg-yellow-400 text-black font-black px-2 py-0.5 rounded flex items-center gap-1">
                  <Crown className="w-3 h-3" /> VIP
                </span>
              ) : (
                <span className="bg-white/10 text-gray-300 px-2 py-0.5 rounded">{th ? 'สมาชิกทั่วไป' : 'Free member'}</span>
              )}
              <span className="text-gray-500">{th ? `สมาชิกตั้งแต่ ${since}` : `Member since ${since}`}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-2">
          {th ? `รายการของฉัน: ${myListCount} เรื่อง` : `My List: ${myListCount} title(s)`}
        </div>

        {member.plan === 'vip' && (
          <div className="text-xs text-yellow-200 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
            {member.vipUntil
              ? th
                ? `VIP ใช้ได้ถึง ${new Date(member.vipUntil).toLocaleDateString('th-TH', { dateStyle: 'long' })}`
                : `VIP until ${new Date(member.vipUntil).toLocaleDateString('en-US', { dateStyle: 'long' })}`
              : th ? 'VIP ไม่มีวันหมดอายุ' : 'VIP — no expiry'}
          </div>
        )}
        {paymentsEnabled && onOpenPlans && (
          <button
            onClick={onOpenPlans}
            className="w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
          >
            <Crown className="w-4 h-4" />
            {member.plan === 'vip' ? (th ? 'ต่ออายุ VIP' : 'Extend VIP') : th ? 'อัปเกรดเป็น VIP' : 'Upgrade to VIP'}
          </button>
        )}

        <form onSubmit={saveName} className="space-y-2">
          <label className="block text-xs text-gray-300">{th ? 'ชื่อที่แสดง' : 'Display name'}</label>
          <div className="flex gap-2">
            <input className={field} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <button disabled={busy} className="px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
              {th ? 'บันทึก' : 'Save'}
            </button>
          </div>
          <Msg m={nameMsg} />
        </form>

        <form onSubmit={savePw} className="space-y-2 border-t border-white/10 pt-4">
          <label className="block text-xs text-gray-300">{th ? 'เปลี่ยนรหัสผ่าน' : 'Change password'}</label>
          <input type="password" className={field} value={cur} autoComplete="current-password" onChange={(e) => setCur(e.target.value)} placeholder={th ? 'รหัสผ่านปัจจุบัน' : 'Current password'} />
          <input type="password" className={field} value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} placeholder={th ? 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)' : 'New password (min 8)'} />
          <button disabled={busy || !cur || !next} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
            {th ? 'เปลี่ยนรหัสผ่าน' : 'Update password'}
          </button>
          <Msg m={pwMsg} />
        </form>

        <button onClick={onLogout} className="w-full py-2.5 rounded-lg border border-white/15 text-gray-200 hover:bg-white/10 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
          <LogOut className="w-4 h-4" />
          {th ? 'ออกจากระบบ' : 'Sign out'}
        </button>
      </div>
    </div>
  );
};
