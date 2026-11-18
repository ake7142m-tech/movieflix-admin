import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_MOVIES,
  INITIAL_CATEGORIES,
  INITIAL_GENRES,
  INITIAL_BANNERS,
  INITIAL_FAQS,
  INITIAL_SEO,
  INITIAL_VIDEO_ADS,
  INITIAL_SETTINGS,
  INITIAL_LIVE_STREAMS,
  INITIAL_MENUS,
} from '../src/data/initialData';

export type Role = 'admin' | 'staff';

export interface StoredUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  email?: string;
  avatar?: string;
  passwordHash: string;
  createdAt: string;
}

export interface HistoryEntry {
  movieId: string;
  /** seconds watched (0 when the player cannot report progress, e.g. embedded players) */
  position: number;
  duration: number;
  updatedAt: string;
}

export interface StoredPayment {
  id: string;
  memberId: string;
  planId: string;
  planName: string;
  /** smallest currency unit (satang for THB) */
  amount: number;
  currency: string;
  days: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  stripeSessionId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface StoredMember {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  plan: 'free' | 'vip';
  status: 'active' | 'suspended';
  /** paid VIP runs until this time; empty = no expiry (granted by an admin) */
  vipUntil?: string;
  createdAt: string;
  lastLoginAt?: string;
  myList: string[];
  history: HistoryEntry[];
}

/** The plan that counts right now: paid VIP expires on its own. */
export const effectivePlan = (m: StoredMember): 'free' | 'vip' =>
  m.plan === 'vip' && (!m.vipUntil || new Date(m.vipUntil).getTime() > Date.now()) ? 'vip' : 'free';

export interface Db {
  collections: Record<string, unknown>;
  users: StoredUser[];
  members: StoredMember[];
  payments: StoredPayment[];
  secrets: Record<string, string>;
}

/** Collections the client may read/write, and who may write them. */
export const COLLECTIONS: Record<string, { kind: 'array' | 'object'; adminOnly: boolean }> = {
  movies: { kind: 'array', adminOnly: false },
  categories: { kind: 'array', adminOnly: false },
  genres: { kind: 'array', adminOnly: false },
  banners: { kind: 'array', adminOnly: false },
  liveStreams: { kind: 'array', adminOnly: false },
  notifications: { kind: 'array', adminOnly: false },
  faqs: { kind: 'array', adminOnly: true },
  videoAds: { kind: 'array', adminOnly: true },
  seo: { kind: 'object', adminOnly: true },
  settings: { kind: 'object', adminOnly: true },
  menus: { kind: 'object', adminOnly: true },
  plans: { kind: 'array', adminOnly: true },
};

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db: Db | null = null;

function seed(): Db {
  const settings = { ...INITIAL_SETTINGS, apiKey: '' };
  return {
    collections: {
      movies: INITIAL_MOVIES,
      categories: INITIAL_CATEGORIES,
      genres: INITIAL_GENRES,
      banners: INITIAL_BANNERS,
      liveStreams: INITIAL_LIVE_STREAMS,
      notifications: [],
      faqs: INITIAL_FAQS,
      videoAds: INITIAL_VIDEO_ADS,
      seo: INITIAL_SEO,
      settings,
      menus: INITIAL_MENUS,
      plans: [
        { id: 'plan-30', name: 'VIP 30 วัน', description: 'สิทธิ์สมาชิก VIP 30 วัน', amount: 9900, days: 30, active: true },
        { id: 'plan-365', name: 'VIP 1 ปี', description: 'สิทธิ์สมาชิก VIP 365 วัน', amount: 79900, days: 365, active: true },
      ],
    },
    users: [],
    members: [],
    payments: [],
    secrets: {},
  };
}

export function loadDb(): Db {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  if (fs.existsSync(DB_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Db;
    // fill in anything missing (e.g. after an upgrade)
    const base = seed();
    parsed.collections = { ...base.collections, ...(parsed.collections || {}) };
    parsed.users = parsed.users || [];
    parsed.members = parsed.members || [];
    parsed.payments = parsed.payments || [];
    for (const m of parsed.members) m.history = m.history || [];
    parsed.secrets = parsed.secrets || {};
    db = parsed;
  } else {
    db = seed();
    saveDb();
  }
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE); // atomic replace → no half-written file
}

export function getDataDir(): string {
  return DATA_DIR;
}
