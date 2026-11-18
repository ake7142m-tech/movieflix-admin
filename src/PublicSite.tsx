import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';
import './site.css';
import { PreviewWebsiteModal, MemberUi } from './components/PreviewWebsiteModal';
import { MemberAuthModal, AuthMode } from './components/MemberAuthModal';
import { MemberProfileModal } from './components/MemberProfileModal';
import { MemberWall } from './components/MemberWall';
import { PlansModal } from './components/PlansModal';
import { api, PublicData, PublicMember, HistoryEntry } from './services/api';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * The member-facing website. Everything comes from the server and refreshes by itself
 * whenever something is saved in the admin panel. What a visitor receives depends on who they are:
 * guests get the catalogue without playable addresses (or just a sign-in wall if the site is members-only).
 */
const PublicSite: React.FC = () => {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<PublicMember | null>(null);
  const [myList, setMyList] = useState<string[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.getPublic());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  const loadMember = useCallback(async () => {
    try {
      const s = await api.memberMe();
      setMember(s.authenticated && s.member ? s.member : null);
      setMyList(s.myList || []);
      setHistory(s.history || []);
    } catch {
      /* keep what we have */
    }
  }, []);

  // coming back from the payment page
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const outcome = q.get('payment');
    if (!outcome) return;
    const sid = q.get('session_id');
    window.history.replaceState(null, '', window.location.pathname);
    if (outcome === 'cancelled') {
      setToast('ยกเลิกการชำระเงินแล้ว ยังไม่มีการตัดเงิน');
      return;
    }
    if (outcome !== 'success' || !sid) return;
    let tries = 0;
    let stopped = false;
    const check = async () => {
      try {
        const r = await api.memberPaymentStatus(sid);
        if (stopped) return;
        if (r.status === 'paid') {
          await loadMember();
          await load();
          setToast(
            r.vipUntil
              ? `ชำระเงินสำเร็จ! คุณเป็นสมาชิก VIP ถึง ${new Date(r.vipUntil).toLocaleDateString('th-TH', { dateStyle: 'long' })}`
              : 'ชำระเงินสำเร็จ! คุณเป็นสมาชิก VIP แล้ว'
          );
        } else if (r.status === 'pending' && tries++ < 8) {
          setToast('กำลังรอการยืนยันการชำระเงิน (PromptPay อาจใช้เวลาสักครู่)...');
          setTimeout(check, 4000);
        } else if (r.status !== 'pending') {
          setToast('การชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      } catch {
        if (!stopped) setToast('ไม่สามารถตรวจสอบการชำระเงินได้ กรุณาเข้าสู่ระบบแล้วลองใหม่ หรือติดต่อผู้ดูแล');
      }
    };
    void check();
    return () => {
      stopped = true;
    };
  }, [load, loadMember]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void load();
    void loadMember();
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/public/events');
      es.addEventListener('changed', () => void load());
    } catch {
      /* polling below covers it */
    }
    const poll = setInterval(() => void load(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load();
        void loadMember();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      es?.close();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, loadMember]);

  // The server is the source of truth for who is signed in (e.g. suspended by an admin, signed out elsewhere)
  useEffect(() => {
    if (!data?.viewer) return;
    if (data.viewer === 'guest' && member) {
      setMember(null);
      setMyList([]);
      setHistory([]);
    } else if (data.viewer === 'member' && !member) {
      void loadMember();
    }
  }, [data?.viewer, member, loadMember]);

  // keep <title> and meta tags in sync after live changes
  useEffect(() => {
    if (!data) return;
    const title = data.seo?.metaTitle || data.settings.siteName || 'FREEDOM';
    document.title = title;
    const desc = data.seo?.metaDescription || data.settings.siteTagline || '';
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    if (data.seo?.metaKeywords) setMeta('meta[name="keywords"]', 'name', 'keywords', data.seo.metaKeywords);
  }, [data]);

  const handleLogin = async (email: string, password: string) => {
    const s = await api.memberLogin(email, password);
    setMember(s.member || null);
    setMyList(s.myList || []);
    setHistory(s.history || []);
    setAuthMode(null);
    await load(); // now includes playable addresses
  };

  const handleRegister = async (v: { email: string; displayName: string; password: string }) => {
    const s = await api.memberRegister(v);
    setMember(s.member || null);
    setMyList(s.myList || []);
    setHistory(s.history || []);
    setAuthMode(null);
    await load();
  };

  const handleLogout = async () => {
    try {
      await api.memberLogout();
    } finally {
      setMember(null);
      setMyList([]);
      setHistory([]);
      setProfileOpen(false);
      setPlansOpen(false);
      await load();
    }
  };

  const toggleMyList = (id: string) => {
    const next = myList.includes(id) ? myList.filter((x) => x !== id) : [...myList, id];
    setMyList(next); // instant feedback, then save on the server
    api.memberSaveList(next).catch(() => void loadMember());
  };

  const reportProgress = (movieId: string, position: number, duration: number) => {
    const entry: HistoryEntry = { movieId, position: Math.round(position), duration: Math.round(duration), updatedAt: new Date().toISOString() };
    setHistory((h) => [entry, ...h.filter((x) => x.movieId !== movieId)].slice(0, 200));
    api.memberSaveProgress(movieId, position, duration).catch(() => undefined);
  };
  const removeHistory = (movieId: string) => {
    setHistory((h) => h.filter((x) => x.movieId !== movieId));
    api.memberRemoveHistory(movieId).catch(() => void loadMember());
  };
  const clearHistory = () => {
    setHistory([]);
    api.memberClearHistory().catch(() => void loadMember());
  };
  const startCheckout = async (planId: string) => {
    const r = await api.memberCheckout(planId);
    window.location.href = r.url; // Stripe's hosted page
  };

  const knownList = useMemo(
    () => myList.filter((id) => (data?.movies || []).some((m: any) => m.id === id)),
    [myList, data?.movies]
  );

  const allowRegistration = data?.settings.allowRegistration !== false;

  const memberUi: MemberUi = {
    viewer: data?.viewer || 'guest',
    canWatch: !!data?.canWatch,
    member,
    allowRegistration,
    myList: knownList,
    onToggleMyList: toggleMyList,
    onOpenAuth: setAuthMode,
    onOpenProfile: () => setProfileOpen(true),
    onLogout: () => void handleLogout(),
    history,
    onProgress: reportProgress,
    onRemoveHistory: removeHistory,
    onClearHistory: clearHistory,
    paymentsEnabled: !!data?.paymentsEnabled,
    onOpenPlans: () => (member ? setPlansOpen(true) : setAuthMode('login')),
  };

  const overlays = (
    <>
      {authMode && data && (
        <MemberAuthModal
          mode={authMode}
          allowRegistration={allowRegistration}
          siteName={data.settings.logoText || data.settings.siteName}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}
      {profileOpen && member && (
        <MemberProfileModal
          member={member}
          myListCount={knownList.length}
          onClose={() => setProfileOpen(false)}
          onSaveName={async (name) => {
            const r = await api.memberUpdate(name);
            setMember(r.member);
          }}
          onChangePassword={async (cur, next) => (await api.memberChangePassword(cur, next)).message}
          onLogout={() => void handleLogout()}
          paymentsEnabled={!!data.paymentsEnabled}
          onOpenPlans={() => {
            setProfileOpen(false);
            setPlansOpen(true);
          }}
        />
      )}
      {plansOpen && member && data && (
        <PlansModal
          plans={data.plans || []}
          currentPlan={member.plan}
          vipUntil={member.vipUntil}
          onClose={() => setPlansOpen(false)}
          onCheckout={startCheckout}
        />
      )}
      {toast && (
        <div
          role="status"
          className="site fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] bg-[#16161b] border border-white/15 text-sm text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3"
        >
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white cursor-pointer" aria-label="Close">
            ✕
          </button>
        </div>
      )}
    </>
  );

  if (!data) {
    return (
      <div className="site min-h-screen bg-[#0c0c0f] flex flex-col items-center justify-center gap-3 text-gray-400 text-sm px-6 text-center">
        {error ? (
          <>
            <p className="text-red-400">{error}</p>
            <button onClick={() => void load()} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
              ลองใหม่
            </button>
          </>
        ) : (
          <Loader2 className="w-6 h-6 text-[#E50914] animate-spin" />
        )}
      </div>
    );
  }

  if (data.maintenance) {
    return (
      <div className="site min-h-screen bg-[#0c0c0f] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Wrench className="w-10 h-10 text-[#E50914]" />
        <h1 className="text-2xl font-black">{data.settings.siteName || 'FREEDOM'}</h1>
        <p className="text-gray-300 max-w-md">
          เว็บไซต์อยู่ระหว่างปรับปรุงระบบชั่วคราว กรุณากลับมาใหม่ในภายหลัง
          <br />
          <span className="text-gray-500 text-sm">The site is under maintenance. Please check back soon.</span>
        </p>
        {data.settings.supportEmail && (
          <a href={`mailto:${data.settings.supportEmail}`} className="text-sm text-gray-400 hover:text-white underline">
            {data.settings.supportEmail}
          </a>
        )}
      </div>
    );
  }

  if (data.locked) {
    return (
      <>
        <MemberWall
          siteName={data.settings.logoText || data.settings.siteName}
          tagline={data.settings.siteTagline}
          allowRegistration={allowRegistration}
          onLogin={() => setAuthMode('login')}
          onRegister={() => setAuthMode('register')}
        />
        {overlays}
      </>
    );
  }

  return (
    <>
      <PreviewWebsiteModal
        isOpen
        publicMode
        movies={data.movies || []}
        banners={data.banners || []}
        liveStreams={data.liveStreams || []}
        notifications={data.notifications || []}
        settings={data.settings}
        menus={data.menus}
        faqs={data.faqs || []}
        videoAds={data.videoAds || []}
        memberUi={memberUi}
        categories={data.categories}
      />
      {overlays}
    </>
  );
};

export default PublicSite;
