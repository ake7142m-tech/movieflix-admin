import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Movie,
  User,
  Category,
  Genre,
  Banner,
  FAQItem,
  SeoConfig,
  VideoAd,
  SiteSettings,
  AdminMenuTab,
  LiveStream,
  LiveNotification,
  MenusConfig,
} from './types';
import { LoginView } from './components/LoginView';
import { MembersManagement } from './components/MembersManagement';
import { Sidebar } from './components/Sidebar';
import { MoviesManagement } from './components/MoviesManagement';
import { MovieFormModal } from './components/MovieFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ApiSyncModal } from './components/ApiSyncModal';
import { CategoriesManagement } from './components/CategoriesManagement';
import { UsersManagement } from './components/UsersManagement';
import { BannersManagement } from './components/BannersManagement';
import { SettingsManagement } from './components/SettingsManagement';
import { MediaLibrary } from './components/MediaLibrary';
import { LiveStreamManagement } from './components/LiveStreamManagement';
import { LiveStreamPlayerModal } from './components/LiveStreamPlayerModal';
import { MovieCinemaPlayerModal } from './components/MovieCinemaPlayerModal';
import { EdgeOneHlsStudio } from './components/EdgeOneHlsStudio';
import { normalizeStreamUrl } from './utils/embed';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { MobileQuickBar } from './components/MobileQuickBar';
import { Tooltip } from './components/Tooltip';
import { FreedomLogo } from './components/FreedomLogo';
import {
  Menu,
  Eye,
  LogOut,
  Bell,
  Sparkles,
  ShieldCheck,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Radio,
  Loader2,
  Command,
  Keyboard,
  Shield,
  Activity,
  ArrowLeftRight,
  Layers,
} from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { api, SessionSnapshot, VipPlan } from './services/api';

/**
 * Saves a collection to the server whenever the user changes it.
 * The first value after loading is treated as "already saved".
 */
function useServerSync(
  name: string,
  value: unknown,
  ready: boolean,
  onFail: (name: string, err: any) => void
) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) {
      last.current = null;
      return;
    }
    const json = JSON.stringify(value);
    if (last.current === null) {
      last.current = json;
      return;
    }
    if (json === last.current) return;
    const timer = setTimeout(async () => {
      try {
        await api.saveCollection(name, value);
        last.current = json;
      } catch (err) {
        onFail(name, err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, ready]);
}

export default function App() {
  const { t, language, toggleLanguage } = useLanguage();

  // ───── Session & data come from the server (no credentials or data live in the browser) ─────
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [dualSessions, setDualSessions] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // Current active user derived from activeUserId & dualSessions
  const currentUser: User | null = useMemo(() => {
    if (dualSessions.length === 0) return null;
    const found = dualSessions.find((u) => u.id === activeUserId);
    return found || dualSessions[0] || null;
  }, [dualSessions, activeUserId]);

  // Helper to deduplicate movies by unique ID
  const deduplicateMovies = (list: Movie[]): Movie[] => {
    const seen = new Set<string>();
    return list.filter((m) => {
      if (!m || !m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  };

  // State: Data Store (filled by loadData() after sign-in)
  const [movies, setMovies] = useState<Movie[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [seo, setSeo] = useState<SeoConfig>({} as SeoConfig);
  const [videoAds, setVideoAds] = useState<VideoAd[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({} as SiteSettings);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [menus, setMenus] = useState<MenusConfig>({ header: [], footer: [] });
  const [plans, setPlans] = useState<VipPlan[]>([]);

  const applySession = (snap: SessionSnapshot) => {
    const list = snap.authenticated ? snap.sessions || [] : [];
    setDualSessions(list);
    setActiveUserId(snap.activeUserId || list[0]?.id || '');
    if (list.length === 0) setDataReady(false);
  };

  const loadData = async () => {
    const d = await api.loadAll();
    setMovies(deduplicateMovies(d.movies || []));
    setCategories(d.categories || []);
    setGenres(d.genres || []);
    setBanners(d.banners || []);
    setUsers(d.users || []);
    setFaqs(d.faqs || []);
    setSeo(d.seo || ({} as SeoConfig));
    setVideoAds(d.videoAds || []);
    setSettings(d.settings || ({} as SiteSettings));
    setLiveStreams(d.liveStreams || []);
    setNotifications(d.notifications || []);
    setMenus(d.menus || { header: [], footer: [] });
    setPlans(d.plans || []);
    setDataReady(true);
  };

  const refreshUsers = async () => {
    setUsers(await api.listUsers());
  };

  // First load: ask the server who we are, then fetch the data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await api.me();
        if (cancelled) return;
        applySession(snap);
        if (snap.authenticated) await loadData();
      } catch (err: any) {
        if (!cancelled) setBootError(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any API call that comes back 401 (expired / signed out elsewhere) returns us to the login screen
  useEffect(() => {
    const onUnauthorized = () => {
      setDualSessions([]);
      setActiveUserId('');
      setDataReady(false);
    };
    window.addEventListener('freedom:unauthorized', onUnauthorized);
    return () => window.removeEventListener('freedom:unauthorized', onUnauthorized);
  }, []);

  // State: Navigation & UI
  const [currentTab, setCurrentTab] = useState<AdminMenuTab>('movies');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State: Modals
  const [isMovieFormOpen, setIsMovieFormOpen] = useState(false);
  const [movieToEdit, setMovieToEdit] = useState<Movie | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [movieToDelete, setMovieToDelete] = useState<Movie | null>(null);
  const [isApiSyncOpen, setIsApiSyncOpen] = useState(false);
  // "View website" opens the real member-facing site (/) in a new tab instead of a mock-up
  const isPreviewWebsiteOpen = false;
  const setIsPreviewWebsiteOpen = (open: boolean) => {
    if (open) window.open('/', '_blank', 'noopener');
  };
  const [isLivePlayerOpen, setIsLivePlayerOpen] = useState(false);
  const [selectedLiveStream, setSelectedLiveStream] = useState<LiveStream | null>(null);
  const [isMovieCinemaOpen, setIsMovieCinemaOpen] = useState(false);
  const [selectedMovieForPlayback, setSelectedMovieForPlayback] = useState<Movie | null>(null);
  const [isEdgeOneStudioOpen, setIsEdgeOneStudioOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Tab switching with subtle loading animation
  const handleTabChange = (tab: AdminMenuTab) => {
    if (tab === currentTab) return;
    setIsTabLoading(true);
    setCurrentTab(tab);
    setTimeout(() => {
      setIsTabLoading(false);
    }, 180);
  };

  // Global Keyboard Shortcuts (Ctrl/Cmd combos)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement;

      // ESC: Close open modals in priority order
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (isMovieFormOpen) setIsMovieFormOpen(false);
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
        if (isApiSyncOpen) setIsApiSyncOpen(false);
        if (isPreviewWebsiteOpen) setIsPreviewWebsiteOpen(false);
        if (isLivePlayerOpen) setIsLivePlayerOpen(false);
        if (isMovieCinemaOpen) setIsMovieCinemaOpen(false);
        return;
      }

      // Hotkeys with Ctrl / Cmd
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        // Ctrl + U: Toggle Dual User Session
        if (key === 'u') {
          e.preventDefault();
          handleToggleDualUser();
          return;
        }

        // Ctrl + K: Command Palette
        if (key === 'k') {
          e.preventDefault();
          setIsCommandPaletteOpen((prev) => !prev);
          return;
        }

        // Ctrl + N: Add Movie
        if (key === 'n') {
          e.preventDefault();
          setMovieToEdit(null);
          setIsMovieFormOpen(true);
          return;
        }

        // Ctrl + P: Preview Website
        if (key === 'p') {
          e.preventDefault();
          setIsPreviewWebsiteOpen(true);
          return;
        }

        // Ctrl + I: API Sync Modal
        if (key === 'i') {
          e.preventDefault();
          setIsApiSyncOpen(true);
          return;
        }

        // Ctrl + B: Toggle Sidebar
        if (key === 'b') {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => !prev);
          return;
        }

        // Ctrl + L: Toggle Language
        if (key === 'l') {
          e.preventDefault();
          toggleLanguage();
          return;
        }

        // Ctrl + / or Ctrl + ?: Shortcuts Help
        if (e.key === '/' || e.key === '?') {
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
          return;
        }

        // Ctrl + Number tabs
        if (!isInput) {
          if (e.key === '1') { e.preventDefault(); handleTabChange('movies'); }
          else if (e.key === '2') { e.preventDefault(); handleTabChange('live-streams'); }
          else if (e.key === '3') { e.preventDefault(); handleTabChange('categories'); }
          else if (e.key === '4') { e.preventDefault(); handleTabChange('genres'); }
          else if (e.key === '5') { e.preventDefault(); handleTabChange('home-banners'); }
          else if (e.key === '6') { e.preventDefault(); handleTabChange('media-library'); }
          else if (e.key === '7') { e.preventDefault(); handleTabChange('users'); }
          else if (e.key === '8') { e.preventDefault(); handleTabChange('settings'); }
          else if (e.key === '9') { e.preventDefault(); handleTabChange('seo'); }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsOpen,
    isMovieFormOpen,
    isDeleteModalOpen,
    isApiSyncOpen,
    isPreviewWebsiteOpen,
    isLivePlayerOpen,
    isMovieCinemaOpen,
    toggleLanguage,
    currentTab,
    dualSessions,
    activeUserId,
  ]);

  // Persist every collection to the server when it changes
  const handleSyncFail = (name: string, err: any) => {
    if (err?.status === 401) return;
    showToast(
      language === 'th'
        ? `บันทึก "${name}" ไม่สำเร็จ: ${err?.message || 'ข้อผิดพลาด'} — โหลดข้อมูลล่าสุดจากเซิร์ฟเวอร์`
        : `Could not save "${name}": ${err?.message || 'error'} — reloading from server`
    );
    setDataReady(false);
    loadData().catch(() => {});
  };
  useServerSync('movies', movies, dataReady, handleSyncFail);
  useServerSync('categories', categories, dataReady, handleSyncFail);
  useServerSync('genres', genres, dataReady, handleSyncFail);
  useServerSync('banners', banners, dataReady, handleSyncFail);
  useServerSync('liveStreams', liveStreams, dataReady, handleSyncFail);
  useServerSync('notifications', notifications, dataReady, handleSyncFail);
  useServerSync('faqs', faqs, dataReady, handleSyncFail);
  useServerSync('videoAds', videoAds, dataReady, handleSyncFail);
  useServerSync('seo', seo, dataReady, handleSyncFail);
  useServerSync('settings', settings, dataReady, handleSyncFail);
  useServerSync('menus', menus, dataReady, handleSyncFail);
  useServerSync('plans', plans, dataReady, handleSyncFail);

  // Live Stream Handlers
  const handleAddLiveStream = (stream: LiveStream) => {
    setLiveStreams([stream, ...liveStreams]);
    showToast(language === 'th' ? `เพิ่มสตรีมสด "${stream.title}" แล้ว` : `Added live stream "${stream.title}"`);
  };

  const handleUpdateLiveStream = (stream: LiveStream) => {
    setLiveStreams(liveStreams.map((s) => (s.id === stream.id ? stream : s)));
    showToast(language === 'th' ? `อัปเดตข้อมูลสตรีม "${stream.title}" แล้ว` : `Updated "${stream.title}"`);
  };

  const handleDeleteLiveStream = (id: string) => {
    setLiveStreams(liveStreams.filter((s) => s.id !== id));
    showToast(language === 'th' ? 'ลบรายการถ่ายทอดสดแล้ว' : 'Deleted live stream');
  };

  const handlePlayLiveStream = (stream: LiveStream) => {
    setSelectedLiveStream(stream);
    setIsLivePlayerOpen(true);
  };

  const handlePlayMovie = (movie: Movie) => {
    setSelectedMovieForPlayback(movie);
    setIsMovieCinemaOpen(true);
  };

  const handleSendLiveNotification = (notification: LiveNotification) => {
    setNotifications([notification, ...notifications]);
    showToast(`ส่งการแจ้งเตือน "${notification.title}" ไปยังผู้ชม ${notification.deliveredCount?.toLocaleString()} คน สำเร็จ!`);
  };

  // Session handlers (all verified by the server)
  const handleSwitchActiveUser = async (userId: string) => {
    try {
      const snap = await api.switchUser(userId);
      applySession(snap);
      const targetUser = snap.sessions?.find((u) => u.id === userId);
      if (targetUser) {
        showToast(
          language === 'th'
            ? `สลับไปยังบัญชี: ${targetUser.username} (${targetUser.role === 'admin' ? 'ผู้ดูแลระบบสูงสุด' : 'เจ้าหน้าที่'})`
            : `Switched active session to: ${targetUser.username} (${targetUser.role})`
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'สลับบัญชีไม่สำเร็จ');
    }
  };

  const handleToggleDualUser = () => {
    if (dualSessions.length < 2) {
      // A second account must sign in with its own password
      setIsAddAccountOpen(true);
      return;
    }
    const nextUser = dualSessions.find((u) => u.id !== currentUser?.id) || dualSessions[0];
    handleSwitchActiveUser(nextUser.id);
  };

  const resetClientState = () => {
    setDualSessions([]);
    setActiveUserId('');
    setDataReady(false);
    setIsAddAccountOpen(false);
  };

  const handleLogoutSession = async (userId: string) => {
    try {
      await api.logout(userId);
      const snap = await api.me();
      applySession(snap);
      if (!snap.authenticated) resetClientState();
      showToast(
        snap.authenticated
          ? language === 'th' ? 'ออกจากระบบบัญชีที่เลือกแล้ว' : 'Signed out from selected session'
          : language === 'th' ? 'ออกจากระบบทุกบัญชีแล้ว' : 'Signed out from all sessions'
      );
    } catch (err: any) {
      showToast(err?.message || 'ออกจากระบบไม่สำเร็จ');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await api.logout();
    } catch {
      /* even if the request fails, drop the UI state */
    }
    resetClientState();
  };

  const handleLoginSuccess = async (snap: SessionSnapshot) => {
    applySession(snap);
    setIsAddAccountOpen(false);
    try {
      if (!dataReady) await loadData();
      const me = snap.sessions?.find((u) => u.id === snap.activeUserId);
      showToast(language === 'th' ? `ยินดีต้อนรับคุณ ${me?.name ?? ''}` : `Welcome back ${me?.name ?? ''}`);
    } catch (err: any) {
      showToast(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  };

  // Movie CRUD Handlers
  const handleOpenAddMovieModal = () => {
    setMovieToEdit(null);
    setIsMovieFormOpen(true);
  };

  const handleOpenEditMovieModal = (movie: Movie) => {
    setMovieToEdit(movie);
    setIsMovieFormOpen(true);
  };

  const handleSaveMovie = (movieData: Partial<Movie>) => {
    if (movieToEdit) {
      // Edit existing
      const updated = movies.map((m) =>
        m.id === movieToEdit.id
          ? {
              ...m,
              ...movieData,
              updatedAt: new Date().toISOString(),
            }
          : m
      );
      setMovies(deduplicateMovies(updated));
      showToast(language === 'th' ? `บันทึกการแก้ไข "${movieData.title}" แล้ว` : `Updated "${movieData.title}"`);
    } else {
      // Create new
      const newMovie: Movie = {
        id: `movie-${Date.now()}`,
        title: movieData.title || 'ไม่มีชื่อภาพยนตร์',
        titleEn: movieData.titleEn,
        code: movieData.code || `#${Math.floor(1000 + Math.random() * 9000)}`,
        rating: movieData.rating || 7.5,
        year: movieData.year || new Date().getFullYear(),
        category: movieData.category || 'ภาพยนตร์สากล',
        genres: movieData.genres || ['Action'],
        quality: movieData.quality || 'HD',
        views: 0,
        status: movieData.status || 'active',
        description: movieData.description || '',
        poster:
          movieData.poster ||
          'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
        backdrop: movieData.backdrop,
        streamUrl: normalizeStreamUrl(movieData.streamUrl),
        trailerUrl: movieData.trailerUrl,
        duration: movieData.duration || '120 นาที',
        director: movieData.director || '',
        cast: movieData.cast || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMovies(deduplicateMovies([newMovie, ...movies]));
      showToast(language === 'th' ? `เพิ่มภาพยนตร์ "${newMovie.title}" สำเร็จ` : `Added "${newMovie.title}" successfully`);
    }
    setIsMovieFormOpen(false);
  };

  const handleOpenDeleteModal = (movie: Movie) => {
    setMovieToDelete(movie);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (movieToDelete) {
      setMovies(movies.filter((m) => m.id !== movieToDelete.id));
      showToast(language === 'th' ? `ลบภาพยนตร์ "${movieToDelete.title}" แล้ว` : `Deleted "${movieToDelete.title}"`);
      setIsDeleteModalOpen(false);
      setMovieToDelete(null);
    }
  };

  // API Sync Handlers
  const handleApiSyncComplete = (syncedMovies: Movie[]) => {
    const merged = deduplicateMovies([...syncedMovies, ...movies]);
    setMovies(merged);
    showToast(
      language === 'th'
        ? `นำเข้าภาพยนตร์ ${syncedMovies.length} เรื่องจาก TMDB API สำเร็จ`
        : `Imported ${syncedMovies.length} movies from TMDB API`
    );
  };

  // Helper for title
  const getTabTitle = () => {
    switch (currentTab) {
      case 'movies':
        return t.sidebar.movies;
      case 'categories':
        return t.sidebar.categories;
      case 'genres':
        return t.sidebar.genres;
      case 'home-banners':
        return t.sidebar.homeBanners;
      case 'banner-templates':
        return t.sidebar.bannerTemplates;
      case 'members':
        return t.sidebar.members;
      case 'users':
        return t.sidebar.users;
      case 'settings':
        return t.sidebar.settings;
      case 'seo':
        return t.sidebar.seo;
      case 'faqs':
        return t.sidebar.faqs;
      case 'video-ads':
        return t.sidebar.videoAds;
      case 'header-menu':
        return t.sidebar.headerMenu;
      case 'footer-menu':
        return t.sidebar.footerMenu;
      case 'media-library':
        return t.sidebar.mediaLibrary;
      case 'live-streams':
        return t.sidebar.liveStreams;
      default:
        return 'Admin Dashboard';
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-gray-400 gap-3">
        <Loader2 className="w-6 h-6 text-[#E50914] animate-spin" />
        <span className="text-sm">{language === 'th' ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์...' : 'Connecting to server...'}</span>
      </div>
    );
  }

  if (bootError && !currentUser) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-center px-6 gap-4">
        <p className="text-red-400 text-sm max-w-md">{bootError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer"
        >
          {language === 'th' ? 'ลองใหม่' : 'Retry'}
        </button>
      </div>
    );
  }

  // Show login view if no user sessions active
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onGoToPublicSite={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  if (!dataReady) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-gray-400 gap-3">
        <Loader2 className="w-6 h-6 text-[#E50914] animate-spin" />
        <span className="text-sm">{language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading data...'}</span>
      </div>
    );
  }

  const standbyUser = dualSessions.find((u) => u.id !== currentUser?.id) || null;

  return (
    <div className="flex h-screen bg-[#0F0F0F] text-white font-sans overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Sign in a second account (needs its own password) */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0F0F0F]">
          <button
            onClick={() => setIsAddAccountOpen(false)}
            className="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer"
          >
            ← {language === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onGoToPublicSite={() => setIsPreviewWebsiteOpen(true)}
          />
        </div>
      )}

      {/* Desktop & Collapsed Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleTabChange}
          currentUser={currentUser}
          dualSessions={dualSessions}
          onSwitchActiveUser={handleSwitchActiveUser}
          onToggleDualUser={handleToggleDualUser}
          onLogoutSession={handleLogoutSession}
          onLogout={handleLogoutAll}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenAddModal={handleOpenAddMovieModal}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 flex">
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                handleTabChange(tab);
                setIsMobileSidebarOpen(false);
              }}
              currentUser={currentUser}
              dualSessions={dualSessions}
              onSwitchActiveUser={handleSwitchActiveUser}
              onToggleDualUser={handleToggleDualUser}
              onLogoutSession={handleLogoutSession}
              onLogout={handleLogoutAll}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileSidebarOpen(false)}
              onOpenAddModal={() => {
                setIsMobileSidebarOpen(false);
                handleOpenAddMovieModal();
              }}
              onOpenShortcuts={() => {
                setIsMobileSidebarOpen(false);
                setIsShortcutsOpen(true);
              }}
              onOpenCommandPalette={() => {
                setIsMobileSidebarOpen(false);
                setIsCommandPaletteOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top loading bar */}
        {isTabLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#E50914] via-white to-[#E50914] animate-pulse z-40" />
        )}

        {/* Top Header Bar with Command Search & Security Status */}
        <header className="bg-[#1A1A1A] border-b border-white/5 px-3 sm:px-6 py-2.5 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <div className="md:hidden shrink-0">
                <FreedomLogo size="xs" variant="icon-only" />
              </div>
              <span className="font-bold text-sm sm:text-base tracking-tight truncate text-white">
                {getTabTitle()}
              </span>
            </div>
          </div>

          {/* Center / Search bar trigger (Command Palette Ctrl+K) */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full bg-[#111] hover:bg-[#222] text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between border border-white/10 transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-400" />
                <span>{language === 'th' ? 'ค้นหาด่วนหรือพิมพ์คำสั่ง...' : 'Search or execute command...'}</span>
              </div>
              <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Concurrent Dual-User Fast Switcher Pill */}
            {standbyUser && (
              <Tooltip
                content={
                  language === 'th'
                    ? `คลิกเพื่อสลับไปยังบัญชี ${standbyUser.username} (${standbyUser.role}) [Ctrl+U]`
                    : `Switch to ${standbyUser.username} (${standbyUser.role}) [Ctrl+U]`
                }
                position="bottom"
              >
                <button
                  onClick={handleToggleDualUser}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-500/30 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
                  <span className="font-mono text-[11px] hidden sm:inline">
                    {currentUser.username} ⇄ {standbyUser.username}
                  </span>
                </button>
              </Tooltip>
            )}

            {/* Tencent EdgeOne HLS Auth & Stream Studio */}
            <Tooltip content={language === 'th' ? 'Tencent EdgeOne HLS TypeA & Telemetry Studio' : 'EdgeOne HLS Stream & TypeA Studio'} position="bottom">
              <button
                onClick={() => setIsEdgeOneStudioOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-blue-500/30 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span className="hidden lg:inline font-mono">EdgeOne HLS</span>
              </button>
            </Tooltip>

            {/* Keyboard Shortcuts Trigger Button */}
            <Tooltip content={language === 'th' ? 'คีย์ลัดระบบ (Ctrl+/)' : 'Keyboard Shortcuts (Ctrl+/)'} position="bottom">
              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-white/5 cursor-pointer"
              >
                <Keyboard className="w-4 h-4 text-gray-400" />
                <span className="hidden xl:inline">{language === 'th' ? 'คีย์ลัด' : 'Shortcuts'}</span>
              </button>
            </Tooltip>

            {/* Live website preview button */}
            <Tooltip content={language === 'th' ? 'ดูตัวอย่างหน้าเว็บสด (Ctrl+P)' : 'Live Website Preview (Ctrl+P)'} position="bottom">
              <button
                onClick={() => setIsPreviewWebsiteOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-white/10 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#E50914]" />
                <span className="hidden sm:inline">{t.header.previewSite}</span>
              </button>
            </Tooltip>

            {/* Switch User / Logout button */}
            <Tooltip content={t.sidebar.logout} position="bottom">
              <button
                onClick={handleLogoutAll}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t.sidebar.logout}</span>
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Scrollable Main Body with Tab Loading Animation */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {isTabLoading ? (
            <div className="min-h-[360px] flex flex-col items-center justify-center gap-3 text-gray-400 animate-fade-in">
              <Loader2 className="w-8 h-8 text-[#E50914] animate-spin" />
              <p className="text-sm font-medium text-gray-300">
                {language === 'th' ? 'กำลังโหลดข้อมูลแถบ...' : 'Loading section data...'}
              </p>
            </div>
          ) : (
            <>
              {currentTab === 'movies' && (
                <MoviesManagement
                  movies={movies}
                  onAddMovie={handleOpenAddMovieModal}
                  onEditMovie={handleOpenEditMovieModal}
                  onDeleteMovie={handleOpenDeleteModal}
                  onOpenApiSync={() => setIsApiSyncOpen(true)}
                  onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
                  onPlayMovie={handlePlayMovie}
                />
              )}

              {(currentTab === 'categories' || currentTab === 'genres') && (
                <CategoriesManagement
                  categories={categories}
                  genres={genres}
                  onUpdateCategories={setCategories}
                  onUpdateGenres={setGenres}
                />
              )}

              {currentTab === 'members' && <MembersManagement isAdmin={currentUser?.role === 'admin'} />}

              {currentTab === 'users' && (
                <UsersManagement
                  users={users}
                  currentUser={currentUser}
                  dualSessions={dualSessions}
                  onRefreshUsers={refreshUsers}
                  onSwitchUser={(u) => handleSwitchActiveUser(u.id)}
                  onToggleDualUser={handleToggleDualUser}
                />
              )}

              {(currentTab === 'home-banners' || currentTab === 'banner-templates') && (
                <BannersManagement
                  banners={banners}
                  onUpdateBanners={setBanners}
                  onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
                />
              )}

              {(currentTab === 'settings' ||
                currentTab === 'seo' ||
                currentTab === 'faqs' ||
                currentTab === 'video-ads' ||
                currentTab === 'header-menu' ||
                currentTab === 'footer-menu') && (
                <SettingsManagement
                  initialTab={currentTab}
                  settings={settings}
                  seo={seo}
                  faqs={faqs}
                  videoAds={videoAds}
                  onUpdateSettings={setSettings}
                  onUpdateSeo={setSeo}
                  onUpdateFaqs={setFaqs}
                  onUpdateVideoAds={setVideoAds}
                  menus={menus}
                  plans={plans}
                  onUpdatePlans={setPlans}
                  categories={categories}
                  isAdmin={currentUser?.role === 'admin'}
                  onUpdateMenus={setMenus}
                />
              )}

              {currentTab === 'media-library' && <MediaLibrary />}

              {currentTab === 'live-streams' && (
                <LiveStreamManagement
                  streams={liveStreams}
                  onAddStream={handleAddLiveStream}
                  onUpdateStream={handleUpdateLiveStream}
                  onDeleteStream={handleDeleteLiveStream}
                  onOpenPlayer={handlePlayLiveStream}
                  onSendNotification={handleSendLiveNotification}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Quick Actions Bottom Bar */}
      <MobileQuickBar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAddMovie={handleOpenAddMovieModal}
        onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
      />

      {/* Command Palette Modal (Ctrl + K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        movies={movies}
        onSelectTab={handleTabChange}
        onOpenAddMovie={handleOpenAddMovieModal}
        onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
        onOpenApiSync={() => setIsApiSyncOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onToggleDualUser={handleToggleDualUser}
        onPlayMovie={handlePlayMovie}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal (Ctrl + /) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-16 md:bottom-6 right-4 sm:right-6 z-50 bg-[#1A1A1A] text-white px-4 py-3 rounded-xl border border-[#E50914]/40 shadow-2xl shadow-black/80 flex items-center gap-2.5 text-sm fade-in">
          <div className="w-2 h-2 rounded-full bg-[#E50914] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add / Edit Movie Modal */}
      <MovieFormModal
        isOpen={isMovieFormOpen}
        onClose={() => setIsMovieFormOpen(false)}
        onSave={handleSaveMovie}
        movieToEdit={movieToEdit}
        availableCategories={categories.map((c) => c.name)}
        availableGenres={genres.map((g) => g.name)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        movie={movieToDelete}
      />

      {/* API Sync Simulator Modal */}
      <ApiSyncModal
        isOpen={isApiSyncOpen}
        onClose={() => setIsApiSyncOpen(false)}
        onSyncComplete={handleApiSyncComplete}
      />

      {/* Movie Cinema Interactive Full Player Modal (Admin Quick Play) */}
      <MovieCinemaPlayerModal
        isOpen={isMovieCinemaOpen}
        onClose={() => {
          setIsMovieCinemaOpen(false);
          setSelectedMovieForPlayback(null);
        }}
        movie={selectedMovieForPlayback}
        allMovies={movies}
        onSelectOtherMovie={(m) => setSelectedMovieForPlayback(m)}
      />

      {/* Live Stream Interactive Player Room Modal */}
      <LiveStreamPlayerModal
        isOpen={isLivePlayerOpen}
        onClose={() => {
          setIsLivePlayerOpen(false);
          setSelectedLiveStream(null);
        }}
        stream={selectedLiveStream}
        otherStreams={liveStreams}
        onSelectOtherStream={(stream) => setSelectedLiveStream(stream)}
      />

      {/* Public Live Streaming Website Viewer Preview Modal */}
      {/* Tencent EdgeOne HLS Auth & Stream Studio Modal */}
      <EdgeOneHlsStudio
        isOpen={isEdgeOneStudioOpen}
        onClose={() => setIsEdgeOneStudioOpen(false)}
      />
    </div>
  );
}
