import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import '../site.css';
import { useLanguage } from '../context/LanguageContext';

export type AuthMode = 'login' | 'register';

interface Props {
  mode: AuthMode;
  allowRegistration: boolean;
  siteName?: string;
  onModeChange: (mode: AuthMode) => void;
  onClose?: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (v: { email: string; displayName: string; password: string }) => Promise<void>;
}

const field =
  'w-full bg-[#0c0c0f] border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/50';

export const MemberAuthModal: React.FC<Props> = ({
  mode,
  allowRegistration,
  siteName,
  onModeChange,
  onClose,
  onLogin,
  onRegister,
}) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegister && password !== confirm) {
      setError(th ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await onRegister({ email, displayName, password });
      else await onLogin(email, password);
    } catch (err: any) {
      setError(err?.message || (th ? 'ดำเนินการไม่สำเร็จ' : 'Something went wrong'));
      setBusy(false);
    }
  };

  return (
    <div
      className="site fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="relative w-full max-w-md bg-[#101014] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          {siteName && <div className="text-[#E50914] font-black text-2xl tracking-tight mb-2">{siteName}</div>}
          <h2 className="text-xl font-bold text-white">
            {isRegister ? (th ? 'สมัครสมาชิก' : 'Create your account') : th ? 'เข้าสู่ระบบสมาชิก' : 'Member sign in'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isRegister
              ? th ? 'สมัครฟรี เพื่อรับชมภาพยนตร์และถ่ายทอดสด และบันทึกรายการโปรดของคุณ' : 'Sign up free to watch movies and live sports and save your list.'
              : th ? 'เข้าสู่ระบบเพื่อรับชมภาพยนตร์และถ่ายทอดสด' : 'Sign in to watch movies and live sports.'}
          </p>
        </div>

        {isRegister && !allowRegistration ? (
          <div className="text-center text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            {th ? 'ขณะนี้ปิดรับสมัครสมาชิกใหม่' : 'New sign-ups are currently closed.'}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5" noValidate>
            {isRegister && (
              <label className="block space-y-1">
                <span className="text-xs text-gray-300">{th ? 'ชื่อที่แสดง' : 'Display name'}</span>
                <input
                  className={field}
                  value={displayName}
                  maxLength={40}
                  autoComplete="nickname"
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={th ? 'เช่น สมชาย' : 'e.g. Alex'}
                />
              </label>
            )}
            <label className="block space-y-1">
              <span className="text-xs text-gray-300">{th ? 'อีเมล' : 'Email'}</span>
              <input
                type="email"
                className={field}
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-300">{th ? 'รหัสผ่าน' : 'Password'}</span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className={`${field} pr-10`}
                  value={password}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? (th ? 'อย่างน้อย 8 ตัวอักษร' : 'At least 8 characters') : ''}
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer" aria-label="Toggle password">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
            {isRegister && (
              <label className="block space-y-1">
                <span className="text-xs text-gray-300">{th ? 'ยืนยันรหัสผ่าน' : 'Confirm password'}</span>
                <input
                  type={show ? 'text' : 'password'}
                  className={field}
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            )}

            {error && (
              <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[#E50914] hover:bg-[#E50914]/90 disabled:opacity-60 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRegister ? (th ? 'สมัครสมาชิก' : 'Sign up') : th ? 'เข้าสู่ระบบ' : 'Sign in'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center text-xs text-gray-400">
          {isRegister ? (
            <>
              {th ? 'เป็นสมาชิกอยู่แล้ว?' : 'Already a member?'}{' '}
              <button onClick={() => { setError(''); onModeChange('login'); }} className="text-white font-semibold hover:underline cursor-pointer">
                {th ? 'เข้าสู่ระบบ' : 'Sign in'}
              </button>
            </>
          ) : (
            allowRegistration && (
              <>
                {th ? 'ยังไม่มีบัญชี?' : 'New here?'}{' '}
                <button onClick={() => { setError(''); onModeChange('register'); }} className="text-white font-semibold hover:underline cursor-pointer">
                  {th ? 'สมัครสมาชิกฟรี' : 'Create an account'}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
