import type { User } from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่', 'network');
  }
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/member/')) {
      window.dispatchEvent(new CustomEvent('freedom:unauthorized'));
    }
    throw new ApiError(res.status, data?.message || `HTTP ${res.status}`, data?.error);
  }
  return data as T;
}

export interface SessionSnapshot {
  authenticated: boolean;
  sessions?: User[];
  activeUserId?: string;
}

export interface ServerData {
  movies: any[];
  categories: any[];
  genres: any[];
  banners: any[];
  liveStreams: any[];
  notifications: any[];
  faqs: any[];
  videoAds: any[];
  seo: any;
  settings: any;
  menus: any;
  plans: any[];
  users: User[];
  seriesJeen: { configured: boolean; last4: string };
}

export interface PublicData {
  settings: {
    siteName?: string;
    siteTagline?: string;
    logoText?: string;
    supportEmail?: string;
    copyrightText?: string;
    maintenanceMode: boolean;
    allowGuestPreview?: boolean;
    allowRegistration?: boolean;
  };
  maintenance: boolean;
  seo?: any;
  faqs?: any[];
  menus?: any;
  categories?: any[];
  genres?: any[];
  movies?: any[];
  banners?: any[];
  liveStreams?: any[];
  notifications?: any[];
  videoAds?: any[];
  streamProtected?: boolean;
  /** site is members-only and this visitor is a guest */
  locked?: boolean;
  canWatch?: boolean;
  viewer?: 'guest' | 'member' | 'admin';
  plans?: VipPlan[];
  paymentsEnabled?: boolean;
}

export interface PublicMember {
  id: string;
  email: string;
  displayName: string;
  /** the plan that counts right now (paid VIP expires by itself) */
  plan: 'free' | 'vip';
  /** when paid VIP ends; null = no expiry (or free) */
  vipUntil?: string | null;
  createdAt: string;
}

export interface HistoryEntry {
  movieId: string;
  /** seconds watched; 0 when the player could not report progress */
  position: number;
  duration: number;
  updatedAt: string;
}

export interface VipPlan {
  id: string;
  name: string;
  description?: string;
  /** satang (1/100 baht) */
  amount: number;
  days: number;
  active?: boolean;
}

export interface StripeStatus {
  configured: boolean;
  enabled: boolean;
  mode: 'test' | 'live' | null;
  keyLast4: string;
  hasWebhookSecret: boolean;
  webhookPath: string;
}

export interface PaymentRow {
  id: string;
  memberId: string;
  memberEmail: string;
  planName: string;
  amount: number;
  currency: string;
  days: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  createdAt: string;
  paidAt?: string;
}

export interface MemberSession {
  authenticated: boolean;
  member?: PublicMember;
  myList?: string[];
  history?: HistoryEntry[];
}

export interface AdminMember {
  id: string;
  email: string;
  displayName: string;
  plan: 'free' | 'vip';
  vipUntil?: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt: string | null;
  myListCount: number;
}

export interface TypeAStatus {
  configured: boolean;
  enabled: boolean;
  ttl: number;
  keyName: string;
  uid: number;
}

export const api = {
  me: () => request<SessionSnapshot>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    request<SessionSnapshot>('POST', '/api/auth/login', { username, password }),
  logout: (userId?: string) => request<{ ok: true }>('POST', '/api/auth/logout', { userId }),
  switchUser: (userId: string) => request<SessionSnapshot>('POST', '/api/auth/switch', { userId }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true; message: string }>('POST', '/api/auth/change-password', { currentPassword, newPassword }),

  loadAll: () => request<ServerData>('GET', '/api/data'),
  saveCollection: (name: string, value: unknown) => request<{ ok: true }>('PUT', `/api/data/${name}`, { value }),

  listUsers: () => request<User[]>('GET', '/api/users'),
  createUser: (u: { username: string; name: string; role: string; email: string; password: string }) =>
    request<User>('POST', '/api/users', u),
  updateUser: (id: string, patch: Partial<{ name: string; email: string; role: string; password: string }>) =>
    request<User>('PATCH', `/api/users/${id}`, patch),
  deleteUser: (id: string) => request<{ ok: true }>('DELETE', `/api/users/${id}`),

  // ── visitors (no login) ──
  getPublic: () => request<PublicData>('GET', '/api/public'),
  /** Returns a freshly signed address when stream protection is on; otherwise the same address. */
  signStreamUrl: async (url: string): Promise<string> => {
    if (!url || !/\.m3u8(\?|#|$)/i.test(url)) return url;
    try {
      const r = await request<{ url: string }>('POST', '/api/public/stream-url', { url });
      return r.url || url;
    } catch {
      return url;
    }
  },
  trackAd: (id: string, event: 'impression' | 'click') =>
    request('POST', `/api/public/ads/${encodeURIComponent(id)}/${event}`, {}).catch(() => undefined),

  // ── members (visitors who sign up) ──
  memberMe: () => request<MemberSession>('GET', '/api/member/me'),
  memberLogin: (email: string, password: string) =>
    request<MemberSession>('POST', '/api/member/login', { email, password }),
  memberRegister: (v: { email: string; displayName: string; password: string }) =>
    request<MemberSession>('POST', '/api/member/register', v),
  memberLogout: () => request<{ ok: true }>('POST', '/api/member/logout', {}),
  memberUpdate: (displayName: string) =>
    request<{ member: PublicMember }>('PATCH', '/api/member/me', { displayName }),
  memberChangePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true; message: string }>('POST', '/api/member/change-password', { currentPassword, newPassword }),
  memberSaveList: (ids: string[]) => request<{ ok: true }>('PUT', '/api/member/mylist', { ids }),
  memberSaveProgress: (movieId: string, position: number, duration: number) =>
    request<{ ok: true }>('PUT', '/api/member/history', { movieId, position: Math.round(position), duration: Math.round(duration) }),
  memberRemoveHistory: (movieId: string) =>
    request<{ ok: true }>('DELETE', `/api/member/history/${encodeURIComponent(movieId)}`),
  memberClearHistory: () => request<{ ok: true }>('DELETE', '/api/member/history'),
  memberCheckout: (planId: string) => request<{ url: string }>('POST', '/api/member/checkout', { planId }),
  memberPaymentStatus: (sessionId: string) =>
    request<{ status: 'pending' | 'paid' | 'failed' | 'expired'; plan: 'free' | 'vip'; vipUntil: string | null }>(
      'GET',
      `/api/member/payment-status?session_id=${encodeURIComponent(sessionId)}`
    ),

  // ── members (admin) ──
  listMembers: () => request<AdminMember[]>('GET', '/api/members'),
  createMember: (v: { email: string; displayName: string; password: string; plan: 'free' | 'vip' }) =>
    request<AdminMember>('POST', '/api/members', v),
  updateMember: (id: string, patch: Partial<{ displayName: string; plan: 'free' | 'vip'; status: 'active' | 'suspended'; password: string }>) =>
    request<AdminMember>('PATCH', `/api/members/${id}`, patch),
  deleteMember: (id: string) => request<{ ok: true }>('DELETE', `/api/members/${id}`),

  // ── payments (admin) ──
  stripeStatus: () => request<StripeStatus>('GET', '/api/secrets/stripe'),
  saveStripe: (v: { enabled: boolean; secretKey?: string; webhookSecret?: string }) =>
    request<StripeStatus>('PUT', '/api/secrets/stripe', v),
  clearStripe: () => request<{ ok: true }>('DELETE', '/api/secrets/stripe'),
  listPayments: () =>
    request<{ payments: PaymentRow[]; totals: { paidCount: number; paidAmount: number; currency: string } }>(
      'GET',
      '/api/payments'
    ),

  // ── stream protection (admin) ──
  typeAStatus: () => request<TypeAStatus>('GET', '/api/secrets/typea'),
  saveTypeA: (v: { enabled: boolean; pk?: string; ttl: number; keyName: string; uid: number }) =>
    request<TypeAStatus>('PUT', '/api/secrets/typea', v),
  clearTypeA: () => request<{ ok: true }>('DELETE', '/api/secrets/typea'),

  seriesJeenStatus: () => request<{ configured: boolean; last4: string }>('GET', '/api/secrets/seriesjeen'),
  saveSeriesJeenKey: (key: string) =>
    request<{ success: boolean; message: string; statusCode: number; profile?: any }>(
      'POST',
      '/api/secrets/seriesjeen',
      { key }
    ),
  clearSeriesJeenKey: () => request<{ ok: true }>('DELETE', '/api/secrets/seriesjeen'),
};
