import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Shield,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { api, SessionSnapshot } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { FreedomLogo } from './FreedomLogo';

interface LoginViewProps {
  onLoginSuccess: (snapshot: SessionSnapshot) => void;
  onGoToPublicSite: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onGoToPublicSite }) => {
  const { t, language } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const triggerAlert = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setAlert({ message, type });
    if (type === 'error') {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      triggerAlert(
        language === 'th'
          ? 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน'
          : 'Please enter both username and password',
        'warning'
      );
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      // Password is checked on the server; the browser never holds any credentials list.
      const snapshot = await api.login(trimmedUser, password);
      const me = snapshot.sessions?.find((u) => u.id === snapshot.activeUserId);
      triggerAlert(
        language === 'th'
          ? `เข้าสู่ระบบสำเร็จในฐานะ [${me?.name ?? trimmedUser}] กำลังนำไปยังหน้าจัดการ...`
          : `Signed in as [${me?.name ?? trimmedUser}]! Redirecting...`,
        'success'
      );
      setPassword('');
      setTimeout(() => onLoginSuccess(snapshot), 450);
    } catch (err: any) {
      triggerAlert(
        err?.message ||
          (language === 'th' ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : 'Invalid username or password'),
        'error'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-white min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#E50914]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-6 fade-in flex flex-col items-center">
          <FreedomLogo size="xl" variant="full" showAdminBadge={true} className="mb-2" />
          <p className="text-gray-400 mt-1 text-sm">
            {language === 'th' ? 'ระบบจัดการภาพยนตร์และสตรีมมิ่ง — เข้าสู่ระบบ' : 'Cinema & Streaming Management — Sign In'}
          </p>
        </div>

        {/* Login Card */}
        <div
          id="loginBox"
          className={`bg-[#1A1A1A] rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/10 ${
            isShaking ? 'shake ring-2 ring-red-500' : ''
          }`}
        >
          {/* Notification Alert Box */}
          {alert && (
            <div
              id="alertBox"
              className={`mb-5 p-3 rounded-lg text-center text-xs sm:text-sm font-medium transition-all ${
                alert.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : alert.type === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {alert.message}
            </div>
          )}

          <form id="loginForm" onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  {language === 'th' ? 'ชื่อผู้ใช้' : 'Username'}
                </span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E50914]/50 focus:border-[#E50914] transition-all font-mono"
                placeholder={language === 'th' ? 'กรอกชื่อผู้ใช้' : 'Enter username'}
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  {language === 'th' ? 'รหัสผ่าน' : 'Password'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E50914]/50 focus:border-[#E50914] transition-all pr-12 font-mono"
                  placeholder={language === 'th' ? 'กรอกรหัสผ่าน' : 'Enter password'}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  id="togglePass"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
                  title={showPassword ? (language === 'th' ? 'ซ่อนรหัสผ่าน' : 'Hide password') : (language === 'th' ? 'แสดงรหัสผ่าน' : 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-[#0F0F0F] text-[#E50914] focus:ring-[#E50914]/50 accent-[#E50914]"
                />
                <span>{language === 'th' ? 'จดจำฉันไว้' : 'Remember me'}</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  triggerAlert(
                    language === 'th'
                      ? 'ระบบได้ส่งคำแนะนำรีเซ็ตรหัสผ่านไปยังอีเมลผู้ดูแลระบบแล้ว'
                      : 'Password reset instructions sent to admin email.',
                    'warning'
                  )
                }
                className="text-[#E50914] hover:text-[#ff3b47] transition-colors text-xs sm:text-sm font-medium cursor-pointer"
              >
                {language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="loginBtn"
              disabled={isLoading}
              className="w-full bg-[#E50914] hover:bg-[#E50914]/90 disabled:opacity-75 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#E50914]/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span>{language === 'th' ? 'กำลังตรวจสอบ...' : 'Authenticating...'}</span>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  <span id="btnText">{language === 'th' ? 'เข้าสู่ระบบ (Sign In)' : 'Sign In'}</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Back to Public Preview Website */}
        <p className="text-center text-sm text-gray-500 mt-5">
          <button
            onClick={onGoToPublicSite}
            className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.header.previewSite}
          </button>
        </p>
      </div>
    </div>
  );
};
