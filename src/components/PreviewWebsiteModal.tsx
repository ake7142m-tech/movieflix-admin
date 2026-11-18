import React, { useEffect, useState } from 'react';
import {
  Play,
  Info,
  Star,
  Search,
  ChevronLeft,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
  Sparkles,
  Flame,
  Check,
  Plus,
  Shield,
  Layers,
  Radio,
  Trophy,
  Users,
  Server,
  Activity,
  MapPin,
  Bell,
  Heart,
  History as HistoryIcon,
  Share2,
  Crown,
} from 'lucide-react';
import { Movie, Banner, LiveStream, LiveNotification, MenusConfig, MenuLink, FAQItem, SiteSettings } from '../types';
import { INITIAL_LIVE_STREAMS, INITIAL_MENUS } from '../data/initialData';
import { AdOverlay, AdLike, SponsoredStrip } from './AdOverlay';
import { BannerCarousel } from './BannerCarousel';
import { api, PublicMember, HistoryEntry } from '../services/api';
import '../site.css';
import { LiveStreamPlayerModal } from './LiveStreamPlayerModal';
import { MovieCinemaPlayerModal } from './MovieCinemaPlayerModal';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { FreedomLogo } from './FreedomLogo';

/** Everything the site needs to know about the signed-in visitor (provided by PublicSite). */
const SiteLogo: React.FC<{ text?: string }> = ({ text }) => {
  const [first, ...rest] = (text || 'FREEDOM').trim().split(/\s+/);
  return (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      <img src="/logo.svg" alt="" width={36} height={36} className="w-9 h-9 rounded-[10px] ring-1 ring-[#e11d2a]/40 object-cover" />
      <span className="font-bold text-[15px] tracking-[0.03em] whitespace-nowrap">
        {first}
        {rest.length > 0 && <span className="text-[var(--accent)]">{rest.join(' ')}</span>}
      </span>
    </div>
  );
};

export interface MemberUi {
  viewer: 'guest' | 'member' | 'admin';
  canWatch: boolean;
  member: PublicMember | null;
  allowRegistration: boolean;
  myList: string[];
  onToggleMyList: (id: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  history: HistoryEntry[];
  onProgress: (movieId: string, position: number, duration: number) => void;
  onRemoveHistory: (movieId: string) => void;
  onClearHistory: () => void;
  paymentsEnabled: boolean;
  onOpenPlans: () => void;
}

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** In-progress = watched more than a few seconds and not (almost) finished. */
const isInProgress = (h: HistoryEntry) => h.duration > 0 && h.position > 10 && h.position / h.duration < 0.95;

export interface SiteAd extends AdLike {
  placement: 'pre-roll' | 'mid-roll' | 'banner';
  active?: boolean;
}

interface PreviewWebsiteModalProps {
  isOpen: boolean;
  onClose?: () => void;
  movies: Movie[];
  banners: Banner[];
  liveStreams?: LiveStream[];
  notifications?: LiveNotification[];
  /** true on the real public site: hides admin chrome and counts ad views */
  publicMode?: boolean;
  settings?: Partial<SiteSettings>;
  menus?: MenusConfig;
  faqs?: FAQItem[];
  videoAds?: SiteAd[];
  /** category names managed in the admin (chips); falls back to the categories found on movies */
  categories?: { id: string; name: string }[];
  /** present on the real website: sign-in state, My List, access rules */
  memberUi?: MemberUi;
}

export const PreviewWebsiteModal: React.FC<PreviewWebsiteModalProps> = ({
  isOpen,
  onClose,
  movies,
  banners,
  liveStreams = INITIAL_LIVE_STREAMS,
  notifications = [],
  publicMode = false,
  settings,
  menus,
  faqs = [],
  videoAds = [],
  memberUi,
  categories: categoryList,
}) => {
  const { t, language } = useLanguage();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isMovieDetailOpen, setIsMovieDetailOpen] = useState(false);
  const [isCinemaPlayerOpen, setIsCinemaPlayerOpen] = useState(false);
  const [movieForCinema, setMovieForCinema] = useState<Movie | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [myList, setMyList] = useState<string[]>([]);
  const [selectedLiveStream, setSelectedLiveStream] = useState<LiveStream | null>(null);
  const [isLivePlayerOpen, setIsLivePlayerOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [bannerAlertDismissed, setBannerAlertDismissed] = useState(false);
  const [adFor, setAdFor] = useState<{ ad: SiteAd; movie: Movie } | null>(null);
  const closeDetailRef = React.useRef<() => void>(() => {});
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  // A movie's detail view has its own address (/movie/<id>) that can be shared, bookmarked and used with Back.
  useEffect(() => {
    if (!publicMode) return;
    const sync = () => {
      const m = /^\/movie\/([^/]+)\/?$/.exec(window.location.pathname);
      if (!m) {
        setIsMovieDetailOpen(false);
        return;
      }
      let id = m[1];
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw */
      }
      const found = movies.find((x) => x.id === id && (!x.status || x.status === 'active'));
      if (found) {
        setSelectedMovie(found);
        setIsMovieDetailOpen(true);
      } else {
        setIsMovieDetailOpen(false);
        window.history.replaceState(null, '', '/'); // link to a movie that is gone or not published
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [publicMode, movies]);

  // browser tab title follows the movie that is open
  useEffect(() => {
    if (!publicMode || !isMovieDetailOpen || !selectedMovie) return;
    const previous = document.title;
    document.title = `${selectedMovie.title}${selectedMovie.year ? ` (${selectedMovie.year})` : ''} — ${settings?.siteName || 'FREEDOM'}`;
    return () => {
      document.title = previous;
    };
  }, [publicMode, isMovieDetailOpen, selectedMovie?.id]);

  // Esc closes the detail view
  useEffect(() => {
    if (!isMovieDetailOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetailRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMovieDetailOpen]);

  if (!isOpen) return null;

  // Visitors only ever see published titles and active banners (admin preview mirrors this)
  movies = movies.filter((m) => !m.status || m.status === 'active');
  const liveBanners = banners.filter((b) => b.active).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const heroMovie = movies.find((m) => m.featured) || movies[0] || null;
  const heroBanners: Banner[] =
    liveBanners.length > 0
      ? liveBanners
      : heroMovie
      ? [
          {
            id: `hero-${heroMovie.id}`,
            title: language === 'en' && heroMovie.titleEn ? heroMovie.titleEn : heroMovie.title,
            subtitle: heroMovie.description,
            imageUrl: heroMovie.backdrop || heroMovie.poster,
            badgeText: language === 'th' ? 'แนะนำแห่งสัปดาห์' : 'Featured this week',
            movieId: heroMovie.id,
            actionUrl: '',
            active: true,
            order: 0,
          } as Banner,
        ]
      : [];
  const chipNames = (categoryList && categoryList.length > 0
    ? categoryList.map((c) => c.name)
    : Array.from(new Set(movies.map((m) => m.category).filter(Boolean)))) as string[];
  const continueItems = (memberUi?.history ?? [])
    .filter(isInProgress)
    .map((entry) => ({ entry, movie: movies.find((m) => m.id === entry.movieId) }))
    .filter((x): x is { entry: HistoryEntry; movie: Movie } => !!x.movie)
    .slice(0, 12);
  const siteAds = videoAds.filter((a) => a.active !== false);
  const headerLinks = (menus?.header ?? INITIAL_MENUS.header).filter((l) => l.visible);
  const footerLinks = (menus?.footer ?? INITIAL_MENUS.footer).filter((l) => l.visible);
  const labelOf = (l: MenuLink) => (language === 'en' && l.labelEn ? l.labelEn : l.label);
  const isActiveLink = (l: MenuLink) =>
    l.type === 'home' ? activeCategoryFilter === 'all' :
    l.type === 'category' ? activeCategoryFilter === l.value :
    l.type === 'live' ? activeCategoryFilter === 'live' : false;
  const handleLink = (l: MenuLink) => {
    switch (l.type) {
      case 'home':
        setActiveCategoryFilter('all');
        setSearchQuery('');
        break;
      case 'category':
        setActiveCategoryFilter(l.value || 'all');
        break;
      case 'live':
        setActiveCategoryFilter('live');
        break;
      case 'faq':
        document.getElementById('site-faq')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'contact':
        if (settings?.supportEmail) window.location.href = `mailto:${settings.supportEmail}`;
        break;
      case 'url':
        if (l.value && /^(https?:\/\/|mailto:|\/)/i.test(l.value)) {
          window.open(l.value, l.value.startsWith('/') ? '_self' : '_blank', 'noopener,noreferrer');
        }
        break;
    }
  };

  const getMovieTitle = (movie: Movie) => {
    if (language === 'en' && movie.titleEn) {
      return movie.titleEn;
    }
    return movie.title;
  };

  const myListIds = memberUi ? memberUi.myList : myList;
  const historyIds = memberUi ? memberUi.history.map((h) => h.movieId) : [];

  const filteredMovies = movies.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.titleEn && m.titleEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      activeCategoryFilter === 'mylist'
        ? myListIds.includes(m.id)
        : activeCategoryFilter === 'history'
        ? historyIds.includes(m.id)
        : activeCategoryFilter === 'all' || activeCategoryFilter === 'live' || m.category === activeCategoryFilter;

    return matchesSearch && matchesCategory;
  });
  if (activeCategoryFilter === 'history') {
    filteredMovies.sort((a, b) => historyIds.indexOf(a.id) - historyIds.indexOf(b.id)); // most recent first
  }

  const toggleMyList = (id: string) => {
    if (memberUi) {
      if (!memberUi.member) memberUi.onOpenAuth('login');
      else memberUi.onToggleMyList(id);
      return;
    }
    if (myListIds.includes(id)) {
      setMyList(myList.filter((item) => item !== id));
    } else {
      setMyList([...myList, id]);
    }
  };

  const startPlayback = async (movie: Movie) => {
    const signed = movie.streamUrl ? await api.signStreamUrl(movie.streamUrl) : movie.streamUrl;
    setMovieForCinema(signed === movie.streamUrl ? movie : { ...movie, streamUrl: signed });
    setIsCinemaPlayerOpen(true);
  };

  const handlePlayMovie = (movie: Movie) => {
    if (memberUi && !memberUi.canWatch) {
      memberUi.onOpenAuth('login');
      return;
    }
    const pool = siteAds.filter((a) => (a.placement === 'pre-roll' || a.placement === 'mid-roll') && a.videoUrl);
    if (pool.length > 0) {
      setAdFor({ ad: pool[Math.floor(Math.random() * pool.length)], movie });
    } else {
      void startPlayback(movie);
    }
  };

  const trackAd = (ad: AdLike, event: 'impression' | 'click') => {
    if (publicMode) void api.trackAd(ad.id, event);
  };

  const handleOpenMovieDetail = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsMovieDetailOpen(true);
    if (publicMode) {
      const path = `/movie/${encodeURIComponent(movie.id)}`;
      if (window.location.pathname !== path) window.history.pushState({ movie: movie.id }, '', path);
    }
  };

  const closeDetail = () => {
    setIsMovieDetailOpen(false);
    setSelectedMovie(null);
    if (publicMode && window.location.pathname.startsWith('/movie/')) {
      if (window.history.state?.movie) window.history.back();
      else window.history.replaceState(null, '', '/');
    }
  };
  closeDetailRef.current = closeDetail;

  const shareMovie = async (movie: Movie) => {
    const url = `${window.location.origin}/movie/${encodeURIComponent(movie.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      /* cancelled or clipboard blocked: nothing to do */
    }
  };

  const selectLiveStream = async (stream: LiveStream) => {
    const servers = await Promise.all(
      (stream.streamServers || []).map(async (sv) => ({ ...sv, url: await api.signStreamUrl(sv.url) }))
    );
    setSelectedLiveStream({ ...stream, streamServers: servers });
  };

  const handleOpenLiveStream = async (stream: LiveStream) => {
    if (memberUi && !memberUi.canWatch) {
      memberUi.onOpenAuth('login');
      return;
    }
    await selectLiveStream(stream);
    setIsLivePlayerOpen(true);
  };

  return (
    <div className="site fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-y-auto selection:bg-[#E50914] selection:text-white">
      {/* Top Admin Notice Bar (admin preview only) */}
      {!publicMode && (
      <header className="sticky top-0 z-40 bg-[#16161b]/95 backdrop-blur-md px-4 py-2.5 border-b border-white/10 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <FreedomLogo size="xs" variant="compact" showAdminBadge={false} />
          <span className="text-xs bg-white/10 text-emerald-400 font-medium px-2.5 py-0.5 rounded-full border border-emerald-400/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {language === 'th' ? 'มุมมองตัวอย่างเว็บไซต์ (Live Preview)' : 'Live Website Preview'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition font-medium cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'th' ? 'กลับสู่หน้าแอดมิน' : 'Back to Admin'}</span>
          </button>
        </div>
      </header>
      )}

      {/* Website Navigation */}
      <nav aria-label={language === 'th' ? 'เมนูหลัก' : 'Main'} className="sticky top-0 z-30 bg-[rgba(12,12,15,0.85)] backdrop-blur-md border-b border-[var(--border)]">
       <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8 min-w-0">
          <SiteLogo text={settings?.logoText} />

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
            {headerLinks.map((l) =>
              l.type === 'live' ? (
                <button
                  key={l.id}
                  onClick={() => handleLink(l)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isActiveLink(l)
                      ? 'bg-[#E50914] text-white shadow-md shadow-[#E50914]/40'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>{labelOf(l)}</span>
                </button>
              ) : (
                <button
                  key={l.id}
                  onClick={() => handleLink(l)}
                  className={`hover:text-white transition cursor-pointer ${isActiveLink(l) ? 'text-white font-semibold' : ''}`}
                >
                  {labelOf(l)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Search bar, Notification Bell & Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.preview.searchInCatalog}
              aria-label={language === 'th' ? 'ค้นหาภาพยนตร์' : 'Search movies'}
              className="bg-[#1c1c22] border border-[var(--border)] rounded-[10px] pl-9 pr-3 py-2 text-[13px] text-white placeholder-gray-500 w-36 sm:w-56 transition-all"
            />
          </div>

          {/* Live Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="relative p-2 rounded-full bg-[#242424] hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/10 cursor-pointer"
              title="Live Notifications"
              aria-label={language === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
              aria-expanded={isNotifDropdownOpen}
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E50914] text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>

            {isNotifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1F1F1F] border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden text-left">
                <div className="p-3 bg-[#171717] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#E50914]" />
                    <span className="font-bold text-xs text-white">{t.header.notifications}</span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {notifications.length} {t.common.items}
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      {language === 'th' ? 'ยังไม่มีการแจ้งเตือนใหม่ในขณะนี้' : 'No new notifications at this time.'}
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const matchedStream = liveStreams.find((s) => s.id === notif.streamId);
                      return (
                        <div
                          key={notif.id}
                          className="p-3.5 hover:bg-white/5 transition flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded border border-red-500/30">
                              {notif.badge || 'LIVE MATCH'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {notif.sentAt ? new Date(notif.sentAt).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-white">{notif.title}</div>
                          <p className="text-[11px] text-gray-300 leading-relaxed">{notif.message}</p>

                          {matchedStream && (
                            <button
                              onClick={() => {
                                void handleOpenLiveStream(matchedStream);
                                setIsNotifDropdownOpen(false);
                              }}
                              className="mt-1 px-3 py-1.5 bg-[#E50914] hover:bg-[#E50914]/90 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer self-start"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>{language === 'th' ? 'รับชมแมตช์นี้ทันที' : 'Watch Match Now'}</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {memberUi ? (
            memberUi.viewer === 'admin' ? (
              <a
                href="/admin"
                className="text-[11px] font-bold bg-amber-400 text-black px-2.5 py-1 rounded-full hover:bg-amber-300 transition"
              >
                {language === 'th' ? 'ผู้ดูแล · กลับหลังบ้าน' : 'Admin · back to panel'}
              </a>
            ) : memberUi.member ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCategoryFilter('mylist')}
                  className={`hidden sm:flex text-xs items-center gap-1.5 px-2.5 py-1.5 rounded-full transition cursor-pointer ${
                    activeCategoryFilter === 'mylist' ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  {language === 'th' ? 'รายการของฉัน' : 'My List'}
                </button>
                <button
                  onClick={() => setActiveCategoryFilter('history')}
                  className={`hidden sm:flex text-xs items-center gap-1.5 px-2.5 py-1.5 rounded-full transition cursor-pointer ${
                    activeCategoryFilter === 'history' ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  {language === 'th' ? 'ประวัติ' : 'History'}
                </button>
                {memberUi.paymentsEnabled && memberUi.member.plan !== 'vip' && (
                  <button
                    onClick={memberUi.onOpenPlans}
                    className="text-[11px] font-black bg-yellow-400 hover:bg-yellow-300 text-black px-2.5 py-1.5 rounded-full flex items-center gap-1 transition cursor-pointer"
                  >
                    <Crown className="w-3 h-3" />
                    {language === 'th' ? 'อัปเกรด VIP' : 'Go VIP'}
                  </button>
                )}
                <button
                  onClick={memberUi.onOpenProfile}
                  className="relative w-8 h-8 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-black text-white cursor-pointer border border-white/20"
                  title={memberUi.member.displayName}
                  aria-label="Profile"
                >
                  {memberUi.member.displayName.trim().charAt(0).toUpperCase()}
                  {memberUi.member.plan === 'vip' && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1 rounded">VIP</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => memberUi.onOpenAuth('login')}
                  className="text-xs font-semibold text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition cursor-pointer"
                >
                  {language === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}
                </button>
                {memberUi.allowRegistration && (
                  <button
                    onClick={() => memberUi.onOpenAuth('register')}
                    className="text-xs font-bold bg-[#E50914] hover:bg-[#E50914]/90 text-white px-3 py-1.5 rounded-md transition cursor-pointer"
                  >
                    {language === 'th' ? 'สมัครสมาชิก' : 'Sign up'}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
       </div>
      </nav>

      {/* Menu row for phones */}
      <div className="md:hidden px-4 py-2 flex gap-4 overflow-x-auto text-sm text-gray-300 border-b border-white/5">
        {memberUi?.member && (
          <>
            <button
              onClick={() => setActiveCategoryFilter('mylist')}
              className={`whitespace-nowrap cursor-pointer ${activeCategoryFilter === 'mylist' ? 'text-white font-semibold' : ''}`}
            >
              {language === 'th' ? 'รายการของฉัน' : 'My List'}
            </button>
            <button
              onClick={() => setActiveCategoryFilter('history')}
              className={`whitespace-nowrap cursor-pointer ${activeCategoryFilter === 'history' ? 'text-white font-semibold' : ''}`}
            >
              {language === 'th' ? 'ประวัติ' : 'History'}
            </button>
          </>
        )}
        {headerLinks.map((l) => (
          <button
            key={l.id}
            onClick={() => handleLink(l)}
            className={`whitespace-nowrap cursor-pointer ${isActiveLink(l) ? 'text-white font-semibold' : ''} ${
              l.type === 'live' ? 'text-red-400 font-bold' : ''
            }`}
          >
            {labelOf(l)}
          </button>
        ))}
      </div>

      {/* Floating In-App Live Notification Banner */}
      {!bannerAlertDismissed && notifications.length > 0 && (
        <div className="mx-4 sm:mx-8 mt-3 bg-gradient-to-r from-red-950/80 via-black/90 to-[#1F1F1F] border border-red-500/40 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600/20 text-red-400 rounded-xl border border-red-500/30 animate-pulse flex-shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E50914] text-white text-[10px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                  {notifications[0].badge || 'LIVE NOTIFICATION'}
                </span>
                <span className="font-bold text-xs sm:text-sm text-white">
                  {notifications[0].title}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5 line-clamp-1">
                {notifications[0].message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {notifications[0].streamId && (
              <button
                onClick={() => {
                  const targetStream =
                    liveStreams.find((s) => s.id === notifications[0].streamId) ||
                    liveStreams[0];
                  if (targetStream) {
                    void handleOpenLiveStream(targetStream);
                  }
                }}
                className="px-3.5 py-1.5 bg-[#E50914] hover:bg-[#E50914]/90 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-lg cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{language === 'th' ? 'ชมสดเลย' : 'Watch Live'}</span>
              </button>
            )}
            <button
              onClick={() => setBannerAlertDismissed(true)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero: banners from the admin; the featured movie when there are none */}
      {!searchQuery && activeCategoryFilter === 'all' && heroBanners.length > 0 && (
        <BannerCarousel banners={heroBanners} movies={movies} onPlay={handlePlayMovie} onDetail={handleOpenMovieDetail} />
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8 space-y-10 flex-1">
        {/* Continue watching */}
        {memberUi?.member && activeCategoryFilter === 'all' && !searchQuery && continueItems.length > 0 && (
          <section className="reveal space-y-3" aria-label={language === 'th' ? 'ดูต่อ' : 'Continue watching'}>
            <h2 className="text-lg font-bold">{language === 'th' ? 'ดูต่อ' : 'Continue watching'}</h2>
            <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-2">
              {continueItems.map(({ movie, entry }) => (
                <div key={movie.id} className="relative flex-shrink-0 w-[240px] sm:w-[280px]">
                  <button
                    onClick={() => handlePlayMovie(movie)}
                    aria-label={`${language === 'th' ? 'ดูต่อ' : 'Resume'} ${getMovieTitle(movie)}`}
                    className="s-card block w-full text-left rounded-xl overflow-hidden bg-[#16161b] border border-[var(--border)] cursor-pointer"
                  >
                    <div className="relative aspect-video bg-[linear-gradient(135deg,#2a2a35,#0a0a10)]">
                      {(movie.backdrop || movie.poster) && (
                        <img src={movie.backdrop || movie.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent)]/90 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (entry.position / entry.duration) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-semibold truncate">{getMovieTitle(movie)}</p>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">
                        {fmtTime(entry.position)} / {fmtTime(entry.duration)}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => memberUi.onRemoveHistory(movie.id)}
                    aria-label={language === 'th' ? 'ลบออกจากรายการดูต่อ' : 'Remove from continue watching'}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 🔴 Featured Live Stream Matches Section (Premier League, UCL, etc.) */}
        {(activeCategoryFilter === 'all' || activeCategoryFilter === 'live') && !searchQuery && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-[#E50914] animate-pulse" />
                  <span>{t.preview.liveSportsTitle}</span>
                  <span className="text-xs bg-red-600/90 text-white font-bold px-2 py-0.5 rounded-full animate-pulse ml-1">
                    LIVE NOW
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language === 'th' ? 'สัญญาณสด คมชัดระดับ 4K HDR เสียงพากย์ไทย พร้อมห้องแชทสด Real-time' : '4K HDR Live Broadcast with multi-server and live interactive chat.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-gray-400">
                  {language === 'th' ? `กำลังถ่ายทอดสด ${liveStreams.filter((s) => s.status === 'live').length} คู่` : `${liveStreams.filter((s) => s.status === 'live').length} live matches now`}
                </span>
              </div>
            </div>

            {/* Live Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveStreams.map((stream) => {
                const isLive = stream.status === 'live';
                return (
                  <div
                    key={stream.id}
                    onClick={() => handleOpenLiveStream(stream)}
                    className="group bg-[#16161b] hover:bg-[#222222] border border-white/10 hover:border-red-500/50 rounded-2xl p-4 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-red-500/10 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Top League & Status */}
                    <div className="flex items-center justify-between text-xs pb-3 border-b border-white/5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[180px]">{stream.league}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1 ${
                          isLive
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-sky-500/20 text-sky-400'
                        }`}
                      >
                        {isLive ? '🔴 LIVE' : (language === 'th' ? '⏳ เร็วๆ นี้' : '⏳ Upcoming')}
                      </span>
                    </div>

                    {/* Match Score & Teams */}
                    <div className="py-4 flex items-center justify-between">
                      {/* Home */}
                      <div className="flex flex-col items-center text-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-white/5 p-1 border border-white/10 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                          <img
                            src={stream.homeTeam.logo}
                            alt={stream.homeTeam.name}
                            className="w-full h-full object-contain rounded-full"
                          />
                        </div>
                        <span className="font-bold text-xs text-white truncate w-full">
                          {stream.homeTeam.name}
                        </span>
                      </div>

                      {/* Score / Time */}
                      <div className="flex flex-col items-center px-3">
                        {isLive ? (
                          <>
                            <div className="text-xl font-black text-white font-mono tracking-wider">
                              {stream.homeTeam.score ?? 0} - {stream.awayTeam.score ?? 0}
                            </div>
                            <span className="text-[10px] text-amber-400 font-bold bg-white/5 px-2 py-0.5 rounded-full mt-1">
                              {stream.currentMinute || "75'"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-gray-400">VS</span>
                            <span className="text-[11px] font-semibold text-sky-400 mt-1">
                              {stream.matchTime}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex flex-col items-center text-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-white/5 p-1 border border-white/10 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                          <img
                            src={stream.awayTeam.logo}
                            alt={stream.awayTeam.name}
                            className="w-full h-full object-contain rounded-full"
                          />
                        </div>
                        <span className="font-bold text-xs text-white truncate w-full">
                          {stream.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Metadata & Action Button */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Users className="w-3.5 h-3.5" />
                        <span>{(stream.currentViewers || 0).toLocaleString()} {language === 'th' ? 'กำลังดู' : 'watching'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-white font-bold group-hover:text-[#E50914] transition-colors">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isLive ? (language === 'th' ? 'คลิกเพื่อรับชมสด' : 'Watch Live') : (language === 'th' ? 'ดูรายละเอียด' : 'Details')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section Header */}
        {activeCategoryFilter !== 'live' && (
          <>
            <div className="reveal space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {searchQuery
                    ? `${language === 'th' ? 'ผลการค้นหาสำหรับ' : 'Search results for'} "${searchQuery}"`
                    : activeCategoryFilter === 'mylist'
                    ? language === 'th' ? 'รายการของฉัน' : 'My List'
                    : activeCategoryFilter === 'history'
                    ? language === 'th' ? 'ประวัติการดู' : 'Watch history'
                    : language === 'th' ? 'ภาพยนตร์ทั้งหมด' : 'All movies'}
                  <span className="text-[var(--accent)] text-sm">{filteredMovies.length}</span>
                </h2>
                {activeCategoryFilter === 'history' && memberUi && filteredMovies.length > 0 && (
                  <button
                    onClick={() =>
                      window.confirm(language === 'th' ? 'ล้างประวัติการดูทั้งหมด?' : 'Clear all watch history?') && memberUi.onClearHistory()
                    }
                    className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
                  >
                    {language === 'th' ? 'ล้างประวัติ' : 'Clear history'}
                  </button>
                )}
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1.5" role="group" aria-label={language === 'th' ? 'หมวดหมู่' : 'Categories'}>
                {['all', ...chipNames].map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveCategoryFilter(name);
                      setSearchQuery('');
                    }}
                    aria-pressed={activeCategoryFilter === name}
                    className="s-chip px-4 py-[7px] rounded-full bg-transparent text-xs font-semibold whitespace-nowrap"
                  >
                    {name === 'all' ? (language === 'th' ? 'ทั้งหมด' : 'All') : name}
                  </button>
                ))}
              </div>
            </div>

            {/* Movie Cards Grid */}
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {activeCategoryFilter === 'mylist' && filteredMovies.length === 0 && (
                <p className="col-span-full text-sm text-gray-400 py-6">
                  {language === 'th'
                    ? activeCategoryFilter === 'history'
                      ? 'ยังไม่มีประวัติการดู เริ่มดูหนังสักเรื่องแล้วจะมาอยู่ที่นี่'
                      : 'ยังไม่มีรายการ กดปุ่ม + ที่หนังเรื่องที่ชอบเพื่อบันทึกไว้ที่นี่'
                    : activeCategoryFilter === 'history'
                    ? 'Nothing watched yet. Titles you play will appear here.'
                    : 'Nothing here yet. Use the + button on a title to save it.'}
                </p>
              )}
              {filteredMovies.map((movie) => (
                <div
                  key={movie.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${language === 'th' ? 'ดูรายละเอียด' : 'Details'} ${getMovieTitle(movie)}`}
                  onClick={() => handleOpenMovieDetail(movie)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenMovieDetail(movie);
                    }
                  }}
                  className="s-card cursor-pointer outline-none"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[linear-gradient(135deg,#2a2a35,#0a0a10)] flex items-end p-3">
                    {movie.poster && (
                      <img src={movie.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/80" />

                    <span className="absolute top-2.5 left-2.5 z-[2] px-2 py-[3px] rounded-md bg-black/65 text-[10px] font-bold tracking-[0.05em]">
                      {movie.quality}
                    </span>
                    <span className="absolute top-2.5 right-2.5 z-[2] px-[7px] py-[3px] rounded-md bg-[rgba(225,29,42,0.9)] text-[10px] font-bold flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      {movie.rating.toFixed(1)}
                    </span>

                    <div className="relative z-[2] min-w-0">
                      <p className="text-[15px] font-bold leading-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] line-clamp-2">
                        {getMovieTitle(movie)}
                      </p>
                      <p className="text-[11px] text-[#cfcfd6] mt-1 truncate">
                        {movie.year} · {movie.genres[0] || movie.category}
                      </p>
                    </div>

                    {/* hover (mouse) */}
                    <div className="s-play absolute inset-0 z-[1] flex items-center justify-center bg-black/35">
                      <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_0_24px_rgba(225,29,42,0.6)]">
                        <Play className="w-[18px] h-[18px] fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* always visible on touch screens */}
                    <div className="s-play-mini absolute bottom-3 right-3 z-[2] w-8 h-8 rounded-full bg-[var(--accent)] items-center justify-center shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Movie Details Modal */}
      {isMovieDetailOpen && selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#16161b] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl fade-in relative my-8">
            {/* Close Modal Button */}
            <button
              onClick={closeDetail}
              aria-label={language === 'th' ? 'ปิด' : 'Close'}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition border border-white/20 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Backdrop Header with Play Button */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <img
                src={selectedMovie.backdrop || selectedMovie.poster}
                alt={getMovieTitle(selectedMovie)}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#16161b] via-transparent to-black/50" />
              <button
                onClick={() => handlePlayMovie(selectedMovie)}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[#E50914] hover:bg-[#E50914]/90 text-white flex items-center justify-center shadow-2xl transition hover:scale-110 cursor-pointer"
                title="Play Movie"
              >
                <Play className="w-7 h-7 fill-white ml-1" />
              </button>
            </div>

            {/* Info Body */}
            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedMovie.title}</h2>
                  {selectedMovie.titleEn && (
                    <p className="text-sm text-gray-400">{selectedMovie.titleEn}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-yellow-500/30">
                    <Star className="w-3.5 h-3.5 fill-yellow-400" />
                    {selectedMovie.rating.toFixed(1)} / 10
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded text-xs font-bold border border-emerald-500/30">
                    {selectedMovie.quality}
                  </span>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                <span className="font-semibold text-white">{t.common.year} {selectedMovie.year}</span>
                <span>•</span>
                <span>{selectedMovie.duration || `120 ${t.common.minutes}`}</span>
                <span>•</span>
                <span className="text-gray-400">{t.movieForm.code} {selectedMovie.code}</span>
                <span>•</span>
                <div className="flex gap-1.5">
                  {selectedMovie.genres.map((g) => (
                    <span key={g} className="bg-white/10 px-2 py-0.5 rounded text-[11px]">
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Synopsis */}
              <p className="text-sm text-gray-300 leading-relaxed">
                {selectedMovie.description}
              </p>

              {/* Cast & Director */}
              <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-400 border-t border-white/10 pt-4">
                {selectedMovie.director && (
                  <div>
                    <span className="text-gray-500">{t.common.director}:</span>{' '}
                    <span className="text-white">{selectedMovie.director}</span>
                  </div>
                )}
                {selectedMovie.cast && selectedMovie.cast.length > 0 && (
                  <div>
                    <span className="text-gray-500">{t.common.cast}:</span>{' '}
                    <span className="text-white">{selectedMovie.cast.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end flex-wrap gap-3 pt-2">
                <button
                  onClick={() => void shareMovie(selectedMovie)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {shareState === 'copied'
                      ? language === 'th' ? 'คัดลอกลิงก์แล้ว' : 'Link copied'
                      : language === 'th' ? 'แชร์' : 'Share'}
                  </span>
                </button>
                <button
                  onClick={() => toggleMyList(selectedMovie.id)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {myListIds.includes(selectedMovie.id) ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{language === 'th' ? 'อยู่ในรายการโปรดแล้ว' : 'In Watchlist'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === 'th' ? 'เพิ่มในรายการโปรด' : 'Add to Watchlist'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handlePlayMovie(selectedMovie)}
                  className="bg-[#E50914] hover:bg-[#E50914]/90 text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>
                    {(() => {
                      const h = memberUi?.history.find((x) => x.movieId === selectedMovie.id);
                      return h && isInProgress(h)
                        ? `${language === 'th' ? 'ดูต่อ' : 'Resume'} ${fmtTime(h.position)}`
                        : t.preview.playerCinemaTitle;
                    })()}
                  </span>
                </button>
              </div>

              {(() => {
                const similar = movies
                  .filter((m) => m.id !== selectedMovie.id && (m.category === selectedMovie.category || m.genres.some((g) => selectedMovie.genres.includes(g))))
                  .slice(0, 6);
                return similar.length > 0 ? (
                  <div className="pt-3 border-t border-white/10">
                    <h3 className="text-sm font-bold mb-3">{language === 'th' ? 'เรื่องที่คล้ายกัน' : 'More like this'}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {similar.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleOpenMovieDetail(m)}
                          aria-label={getMovieTitle(m)}
                          className="s-card relative aspect-[2/3] rounded-lg overflow-hidden bg-[linear-gradient(135deg,#2a2a35,#0a0a10)] cursor-pointer text-left"
                        >
                          {m.poster && <img src={m.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                          <span className="absolute inset-x-0 bottom-0 p-1.5 text-[10px] font-semibold leading-tight bg-gradient-to-t from-black/90 to-transparent line-clamp-2">
                            {getMovieTitle(m)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Movie Cinema Interactive Full Player Modal */}
      <MovieCinemaPlayerModal
        isOpen={isCinemaPlayerOpen}
        onClose={() => {
          setIsCinemaPlayerOpen(false);
          setMovieForCinema(null);
        }}
        movie={movieForCinema}
        startAt={memberUi?.history.find((h) => h.movieId === movieForCinema?.id)?.position}
        onProgress={(pos, dur) => {
          if (movieForCinema && memberUi?.member) memberUi.onProgress(movieForCinema.id, pos, dur);
        }}
        allMovies={movies}
        onSelectOtherMovie={(m) => setMovieForCinema(m)}
      />

      {/* Live Stream Full Player Modal */}
      <LiveStreamPlayerModal
        isOpen={isLivePlayerOpen}
        onClose={() => {
          setIsLivePlayerOpen(false);
          setSelectedLiveStream(null);
        }}
        stream={selectedLiveStream}
        otherStreams={liveStreams}
        onSelectOtherStream={(stream) => void selectLiveStream(stream)}
      />

      {/* Sponsored strip (ads with the "banner" placement) */}
      {(() => {
        const strip = siteAds.find((a) => a.placement === 'banner');
        return strip && activeCategoryFilter === 'all' && !searchQuery ? (
          <SponsoredStrip
            ad={strip}
            onImpression={(a) => trackAd(a, 'impression')}
            onClick={(a) => trackAd(a, 'click')}
          />
        ) : null;
      })()}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section id="site-faq" className="px-6 md:px-12 py-10 border-t border-white/5 bg-[#0f0f12]">
          <h2 className="text-lg font-bold mb-4">{language === 'th' ? 'คำถามที่พบบ่อย' : 'Frequently Asked Questions'}</h2>
          <div className="max-w-3xl space-y-2">
            {[...faqs]
              .sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
              .map((f) => (
                <details key={f.id} className="group bg-[#16161b] rounded-lg border border-white/5 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold list-none flex items-center justify-between gap-3">
                    <span>{f.question}</span>
                    <Plus className="w-4 h-4 text-gray-400 transition group-open:rotate-45 flex-shrink-0" />
                  </summary>
                  <p className="mt-2 text-sm text-gray-300 whitespace-pre-line leading-relaxed">{f.answer}</p>
                </details>
              ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 bg-[#101014] border-t border-white/5 text-xs text-gray-500 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <div>{settings?.copyrightText || t.preview.footerCopyright}</div>
          {settings?.siteTagline && <div className="mt-1 text-gray-600">{settings.siteTagline}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {footerLinks.map((l) => (
            <button key={l.id} onClick={() => handleLink(l)} className="hover:text-white transition cursor-pointer">
              {labelOf(l)}
            </button>
          ))}
        </div>
      </footer>

      {adFor && (
        <AdOverlay
          ad={adFor.ad}
          onImpression={(a) => trackAd(a, 'impression')}
          onClick={(a) => trackAd(a, 'click')}
          onFinish={() => {
            const m = adFor.movie;
            setAdFor(null);
            void startPlayback(m);
          }}
        />
      )}
    </div>
  );
};
