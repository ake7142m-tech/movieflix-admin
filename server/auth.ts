import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { loadDb, saveDb, type Role, type StoredUser } from './store';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const COOKIE_NAME = 'freedom_sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACCOUNTS_PER_SESSION = 2;

/* ───────────── password hashing (scrypt, per-user random salt) ───────────── */

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Used so that "unknown user" takes as long as "wrong password".
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomBytes(8).toString('hex')));

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (pw.length > 128) return 'รหัสผ่านยาวเกินไป';
  return null;
}

/* ───────────── users ───────────── */

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  email?: string;
  avatar?: string;
}

export const toPublicUser = (u: StoredUser): PublicUser => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  email: u.email,
  avatar: u.avatar,
});

const AVATARS: Record<Role, string> = {
  admin: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  staff: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
};
export const defaultAvatar = (role: Role) => AVATARS[role];

/** Creates the first admin/staff accounts. No password is ever hard-coded. */
export async function ensureInitialUsers(): Promise<void> {
  const db = loadDb();
  if (db.users.length > 0) return;

  const seedUser = async (
    username: string,
    name: string,
    role: Role,
    envVar: string
  ): Promise<{ username: string; password: string; generated: boolean }> => {
    const fromEnv = process.env[envVar];
    const generated = !fromEnv;
    const password = fromEnv && !validatePassword(fromEnv) ? fromEnv : crypto.randomBytes(12).toString('base64url');
    db.users.push({
      id: `user-${username}`,
      username,
      name,
      role,
      email: `${username}@freedom.local`,
      avatar: AVATARS[role],
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    return { username, password, generated: generated || !!validatePassword(fromEnv) };
  };

  const created = [
    await seedUser('admin', 'ผู้ดูแลระบบสูงสุด (Super Admin)', 'admin', 'ADMIN_PASSWORD'),
    await seedUser('staff', 'พนักงานดูแลเนื้อหา (Staff Editor)', 'staff', 'STAFF_PASSWORD'),
  ];
  saveDb();

  console.log('\n┌──────────────────────────────────────────────────────────┐');
  console.log('│  สร้างบัญชีเริ่มต้นแล้ว (แสดงครั้งเดียว — จดไว้และเปลี่ยนทันที) │');
  for (const c of created) {
    console.log(
      c.generated
        ? `│  ${c.username.padEnd(6)} รหัสผ่าน: ${c.password}`
        : `│  ${c.username.padEnd(6)} รหัสผ่านตามตัวแปร ${c.username === 'admin' ? 'ADMIN_PASSWORD' : 'STAFF_PASSWORD'}`
    );
  }
  console.log('└──────────────────────────────────────────────────────────┘\n');
}

/* ───────────── login throttling ───────────── */

const attempts = new Map<string, { count: number; lockedUntil: number; last: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function throttleKey(req: Request, username: string): string {
  return `${req.ip}|${username.toLowerCase()}`;
}
export function isLocked(key: string): number {
  const a = attempts.get(key);
  return a && a.lockedUntil > Date.now() ? Math.ceil((a.lockedUntil - Date.now()) / 1000) : 0;
}
export function recordFailure(key: string): void {
  const a = attempts.get(key) || { count: 0, lockedUntil: 0, last: 0 };
  a.count += 1;
  a.last = Date.now();
  if (a.count >= MAX_FAILS) {
    a.lockedUntil = Date.now() + LOCK_MS;
    a.count = 0;
  }
  attempts.set(key, a);
}
export const clearFailures = (key: string) => attempts.delete(key);

/* ───────────── sessions (server-side, opaque cookie) ───────────── */

interface Session {
  userIds: string[];
  activeId: string;
  lastSeen: number;
}
const sessions = new Map<string, Session>(); // key = sha256(token)
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.lastSeen > SESSION_TTL_MS) sessions.delete(k);
  for (const [k, a] of attempts) if (a.lockedUntil < now && now - a.last > LOCK_MS) attempts.delete(k);
}, 10 * 60 * 1000).unref();

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSessionCookie(req: Request, res: Response, token: string | null) {
  const secure = req.secure || process.env.COOKIE_SECURE === 'true';
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : ''].filter(Boolean).join('; ');
  if (token) {
    res.append('Set-Cookie', `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; ${flags}`);
  } else {
    res.append('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; ${flags}`);
  }
}

export interface AuthContext {
  user: StoredUser;
  sessionUsers: StoredUser[];
  token: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

function resolveSession(req: Request): AuthContext | null {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const s = sessions.get(sha(token));
  if (!s || Date.now() - s.lastSeen > SESSION_TTL_MS) return null;
  const db = loadDb();
  const sessionUsers = s.userIds
    .map((id) => db.users.find((u) => u.id === id))
    .filter((u): u is StoredUser => !!u);
  if (sessionUsers.length === 0) return null;
  const user = sessionUsers.find((u) => u.id === s.activeId) || sessionUsers[0];
  s.lastSeen = Date.now();
  return { user, sessionUsers, token };
}

export const attachAuth: (req: Request, _res: Response, next: NextFunction) => void = (req, _res, next) => {
  req.auth = resolveSession(req) || undefined;
  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) return res.status(401).json({ error: 'unauthenticated', message: 'กรุณาเข้าสู่ระบบ' });
  next();
};
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) return res.status(401).json({ error: 'unauthenticated', message: 'กรุณาเข้าสู่ระบบ' });
  if (req.auth.user.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'ต้องเป็นผู้ดูแลระบบสูงสุดเท่านั้น' });
  next();
};

/** Start (or extend) a session after a successful password check. New token each login → no session fixation. */
export function startSession(req: Request, res: Response, user: StoredUser): Session {
  const previous = req.auth;
  let userIds = previous ? previous.sessionUsers.map((u) => u.id) : [];
  userIds = userIds.filter((id) => id !== user.id);
  userIds.push(user.id);
  if (userIds.length > MAX_ACCOUNTS_PER_SESSION) userIds = userIds.slice(-MAX_ACCOUNTS_PER_SESSION);
  if (previous) sessions.delete(sha(previous.token));
  const token = crypto.randomBytes(32).toString('base64url');
  const session: Session = { userIds, activeId: user.id, lastSeen: Date.now() };
  sessions.set(sha(token), session);
  setSessionCookie(req, res, token);
  return session;
}

export function switchActive(req: Request, userId: string): boolean {
  if (!req.auth) return false;
  const s = sessions.get(sha(req.auth.token));
  if (!s || !s.userIds.includes(userId)) return false;
  s.activeId = userId;
  return true;
}

/** Remove one account (or all) from the current session. */
export function endSession(req: Request, res: Response, userId?: string): void {
  if (!req.auth) return;
  const key = sha(req.auth.token);
  const s = sessions.get(key);
  if (!s) return;
  if (userId) s.userIds = s.userIds.filter((id) => id !== userId);
  else s.userIds = [];
  if (s.userIds.length === 0) {
    sessions.delete(key);
    setSessionCookie(req, res, null);
  } else if (!s.userIds.includes(s.activeId)) {
    s.activeId = s.userIds[0];
  }
}

/** Kick a user out of every session (after password change / delete / role change). */
export function revokeUser(userId: string): void {
  for (const [k, s] of sessions) {
    s.userIds = s.userIds.filter((id) => id !== userId);
    if (s.userIds.length === 0) sessions.delete(k);
    else if (s.activeId === userId) s.activeId = s.userIds[0];
  }
}

export function sessionSnapshot(auth: AuthContext) {
  return {
    authenticated: true as const,
    sessions: auth.sessionUsers.map(toPublicUser),
    activeUserId: auth.user.id,
  };
}

export async function authenticate(username: string, password: string): Promise<StoredUser | null> {
  const db = loadDb();
  const user = db.users.find((u) => u.username === username.toLowerCase());
  if (!user) {
    await verifyPassword(password, await getDummyHash()); // equalise timing
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}
