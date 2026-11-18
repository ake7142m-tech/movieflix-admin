import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { api, TypeAStatus } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const field =
  'w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/40';

export const StreamSecurityPanel: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [status, setStatus] = useState<TypeAStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [pk, setPk] = useState('');
  const [ttl, setTtl] = useState(60);
  const [keyName, setKeyName] = useState('key');
  const [uid, setUid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (s: TypeAStatus) => {
    setStatus(s);
    setEnabled(s.enabled);
    setTtl(s.ttl);
    setKeyName(s.keyName);
    setUid(s.uid);
  };

  useEffect(() => {
    api.typeAStatus().then(apply).catch(() => setStatus({ configured: false, enabled: false, ttl: 60, keyName: 'key', uid: 0 }));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      apply(await api.saveTypeA({ enabled, pk: pk || undefined, ttl, keyName, uid }));
      setPk('');
      setMsg({ ok: true, text: th ? 'บันทึกแล้ว มีผลกับผู้ชมทันที' : 'Saved — effective immediately' });
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Error' });
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
  }

  return (
    <form onSubmit={save} className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5 space-y-4 max-w-2xl text-xs sm:text-sm shadow-md">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-white">{th ? 'ป้องกันลิงก์สตรีม (TypeA)' : 'Stream link protection (TypeA)'}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {th
              ? 'เมื่อเปิด เซิร์ฟเวอร์จะแนบลายเซ็นให้ลิงก์ .m3u8 ทุกครั้งที่ผู้ชมกดเล่น โดยกุญแจเก็บไว้บนเซิร์ฟเวอร์เท่านั้น ไม่ถูกส่งไปที่เบราว์เซอร์ ค่าต้องตรงกับที่ตั้งไว้ที่ CDN/EdgeOne ของคุณ'
              : 'When on, the server signs every .m3u8 link when a viewer presses play. The key stays on the server and is never sent to browsers. Values must match your CDN / EdgeOne TypeA settings.'}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-gray-200 cursor-pointer">
        <input type="checkbox" checked={enabled} disabled={!isAdmin} onChange={(e) => setEnabled(e.target.checked)} />
        {th ? 'เปิดใช้การเซ็นลิงก์สตรีม' : 'Sign stream links'}
      </label>

      <label className="block space-y-1">
        <span className="text-gray-300 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          {th ? 'กุญแจส่วนตัว (Private Key)' : 'Private key'}
          {status.configured && (
            <span className="text-emerald-400 ml-1">{th ? '— ตั้งไว้แล้ว (ไม่แสดงซ้ำ)' : '— already set (hidden)'}</span>
          )}
        </span>
        <input
          type="password"
          autoComplete="new-password"
          className={`${field} font-mono`}
          value={pk}
          disabled={!isAdmin}
          onChange={(e) => setPk(e.target.value)}
          placeholder={status.configured ? (th ? 'เว้นว่างเพื่อใช้กุญแจเดิม' : 'Leave empty to keep current') : ''}
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-gray-300">TTL (s)</span>
          <input type="number" min={5} max={86400} className={field} value={ttl} disabled={!isAdmin} onChange={(e) => setTtl(Number(e.target.value))} />
        </label>
        <label className="block space-y-1">
          <span className="text-gray-300">{th ? 'ชื่อพารามิเตอร์' : 'Param name'}</span>
          <input className={`${field} font-mono`} value={keyName} disabled={!isAdmin} onChange={(e) => setKeyName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-gray-300">UID</span>
          <input type="number" min={0} className={field} value={uid} disabled={!isAdmin} onChange={(e) => setUid(Number(e.target.value))} />
        </label>
      </div>

      {msg && <p className={msg.ok ? 'text-emerald-400 flex items-center gap-1.5' : 'text-red-400'}>{msg.ok && <Check className="w-4 h-4" />}{msg.text}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !isAdmin}
          className="px-4 py-2 rounded-lg bg-[#28A745] hover:bg-[#28A745]/90 disabled:opacity-50 text-white font-semibold cursor-pointer"
        >
          {th ? 'บันทึก' : 'Save'}
        </button>
        {status.configured && isAdmin && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(th ? 'ลบกุญแจและปิดการป้องกัน?' : 'Remove key and turn protection off?')) return;
              await api.clearTypeA();
              apply({ configured: false, enabled: false, ttl: 60, keyName: 'key', uid: 0 });
            }}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 text-gray-200 cursor-pointer"
          >
            {th ? 'ลบกุญแจ' : 'Remove key'}
          </button>
        )}
      </div>
      {!isAdmin && <p className="text-xs text-gray-500">{th ? 'แก้ไขได้เฉพาะผู้ดูแลระบบสูงสุด' : 'Admins only'}</p>}
    </form>
  );
};
