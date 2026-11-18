import React from 'react';
import { Lock } from 'lucide-react';
import '../site.css';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  siteName?: string;
  tagline?: string;
  allowRegistration: boolean;
  onLogin: () => void;
  onRegister: () => void;
}

/** Shown to guests when the admin turned off "guest preview": the site is for members only. */
export const MemberWall: React.FC<Props> = ({ siteName, tagline, allowRegistration, onLogin, onRegister }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  return (
    <div className="site min-h-screen bg-[#0c0c0f] text-white flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(229,9,20,0.25),_transparent_60%)]" />
      <div className="relative max-w-lg space-y-5">
        <div className="text-[#E50914] font-black text-4xl md:text-5xl tracking-tight">{siteName || 'FREEDOM'}</div>
        {tagline && <p className="text-gray-300">{tagline}</p>}
        <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
          <Lock className="w-3.5 h-3.5" />
          {th ? 'เนื้อหาสำหรับสมาชิกเท่านั้น' : 'Members only'}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={onLogin} className="px-6 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#E50914]/90 font-bold cursor-pointer">
            {th ? 'เข้าสู่ระบบ' : 'Sign in'}
          </button>
          {allowRegistration && (
            <button onClick={onRegister} className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold cursor-pointer">
              {th ? 'สมัครสมาชิก' : 'Sign up'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
