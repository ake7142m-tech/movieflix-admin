import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { loadDb, saveDb, effectivePlan, type StoredMember } from './store';
import { requireAdmin, hashPassword, verifyPassword, validatePassword, isLocked, recordFailure, clearFailures } from './auth';

/* Members (the people who watch) are completely separate from admin/staff accounts:
 * their own table, their own cookie, their own sessions. */

const COOKIE = 'freedom_member';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[A-Za-z]{2,}$/;

declare module 'express-serve-static-core' {
  interface Request {
    member?: StoredMember;
    memberToken?: string;
  }
}

const sessions = new Map<string, { memberId: string; lastSeen: number }>(); // key = sha256(token)
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.lastSeen > TTL_MS) sessions.delete(k);
}, 15 * 60 * 1000).unref();

const cookieOf = (req: Request): string | undefined => {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
};

function setCookie(req: Request, res: Response, token: string | null) {
  const secure = req.secure || process.env.COOKIE_SECURE === 'true';
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : ''].filter(Boolean).join('; ');
  res.append('Set-Cookie', token ? `${COOKIE}=${token}; Max-Age=${TTL_MS / 1000}; ${flags}` : `${COOKIE}=; Max-Age=0; ${flags}`);
}

export const attachMember = (req: Request, _res: Response, next: NextFunction) => {
  const token = cookieOf(req);
  if (token) {
    const s = sessions.get(sha(token));
    if (s && Date.now() - s.lastSeen <= TTL_MS) {
      const m = loadDb().members.find((x) => x.id === s.memberId);
      if (m && m.status === 'active') {
        s.lastSeen = Date.now();
        req.member = m;
        req.memberToken = token;
      }
    }
  }
  next();
};

export const requireMember = (req: Request, res: Response, next: NextFunction) => {
  if (!req.member) return res.status(401).json({ error: 'unauthenticated', message: 'กรุณาเข้าสู่ระบบสมาชิก' });
  next();
};

export const toPublicMember = (m: StoredMember) => ({
  id: m.id,
  email: m.email,
  displayName: m.displayName,
  plan: effectivePlan(m),
  vipUntil: m.plan === 'vip' ? m.vipUntil ?? null : null,
  createdAt: m.createdAt,
});

const sessionBody = (m: StoredMember) => ({
  authenticated: true,
  member: toPublicMember(m),
  myList: m.myList,
  history: m.history,
});

function startSession(req: Request, res: Response, m: StoredMember) {
  if (req.memberToken) sessions.delete(sha(req.memberToken)); // fresh token on every login
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(sha(token), { memberId: m.id, lastSeen: Date.now() });
  setCookie(req, res, token);
}

function revokeMember(memberId: string, exceptToken?: string) {
  const keep = exceptToken ? sha(exceptToken) : null;
  for (const [k, s] of sessions) if (s.memberId === memberId && k !== keep) sessions.delete(k);
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '';
const normEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 254) : '');

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword(crypto.randomBytes(8).toString('hex')));

const signups = new Map<string, number[]>();
function tooManySignups(ip: string): boolean {
  const now = Date.now();
  const recent = (signups.get(ip) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) {
    signups.set(ip, recent);
    return true;
  }
  recent.push(now);
  signups.set(ip, recent);
  if (signups.size > 5000) for (const [k, v] of signups) if (!v.some((t) => now - t < 3600_000)) signups.delete(k);
  return false;
}

export function registerMembers(app: Express): void {
  /* ───── visitors: sign up / sign in ───── */
  app.post('/api/member/register', async (req, res) => {
    const settings = ((loadDb().collections as any).settings || {}) as any;
    if (settings.allowRegistration === false) {
      return res.status(403).json({ error: 'registration_closed', message: 'ขณะนี้ปิดรับสมัครสมาชิกใหม่' });
    }
    if (tooManySignups(req.ip || '')) {
      return res.status(429).json({ error: 'too_many', message: 'สมัครบ่อยเกินไป กรุณาลองใหม่ภายหลัง' });
    }
    const email = normEmail(req.body?.email);
    const displayName = clean(req.body?.displayName, 40);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'bad_email', message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    if (displayName.length < 2) return res.status(400).json({ error: 'bad_name', message: 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร' });
    const pwErr = validatePassword(req.body?.password);
    if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });

    const db = loadDb();
    if (db.members.some((m) => m.email === email)) {
      return res.status(409).json({ error: 'exists', message: 'อีเมลนี้สมัครสมาชิกไว้แล้ว' });
    }
    const m: StoredMember = {
      id: `mem-${crypto.randomBytes(8).toString('hex')}`,
      email,
      displayName,
      passwordHash: await hashPassword(req.body.password),
      plan: 'free',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      myList: [],
      history: [],
    };
    db.members.push(m);
    saveDb();
    startSession(req, res, m);
    res.status(201).json(sessionBody(m));
  });

  app.post('/api/member/login', async (req, res) => {
    const email = normEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'bad_request', message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    const key = `member|${req.ip}|${email}`;
    const wait = isLocked(key);
    if (wait) {
      return res.status(429).json({ error: 'locked', message: `ลองผิดหลายครั้งเกินไป กรุณารออีก ${Math.ceil(wait / 60)} นาที` });
    }
    const db = loadDb();
    const m = db.members.find((x) => x.email === email);
    const ok = m ? await verifyPassword(password, m.passwordHash) : (await verifyPassword(password, await dummyHash()), false);
    if (!m || !ok) {
      recordFailure(key);
      return res.status(401).json({ error: 'invalid_credentials', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (m.status !== 'active') {
      return res.status(403).json({ error: 'suspended', message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }
    clearFailures(key);
    m.lastLoginAt = new Date().toISOString();
    saveDb();
    startSession(req, res, m);
    res.json(sessionBody(m));
  });

  app.post('/api/member/logout', (req, res) => {
    if (req.memberToken) sessions.delete(sha(req.memberToken));
    setCookie(req, res, null);
    res.json({ ok: true });
  });

  app.get('/api/member/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.member) return res.json({ authenticated: false });
    res.json(sessionBody(req.member));
  });

  /* ───── signed-in member ───── */
  app.patch('/api/member/me', requireMember, (req, res) => {
    const name = clean(req.body?.displayName, 40);
    if (name.length < 2) return res.status(400).json({ error: 'bad_name', message: 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร' });
    req.member!.displayName = name;
    saveDb();
    res.json({ member: toPublicMember(req.member!) });
  });

  app.post('/api/member/change-password', requireMember, async (req, res) => {
    const pwErr = validatePassword(req.body?.newPassword);
    if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });
    const m = req.member!;
    if (typeof req.body?.currentPassword !== 'string' || !(await verifyPassword(req.body.currentPassword, m.passwordHash))) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }
    m.passwordHash = await hashPassword(req.body.newPassword);
    saveDb();
    revokeMember(m.id, req.memberToken); // sign out every other device
    res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านแล้ว (อุปกรณ์อื่นถูกออกจากระบบ)' });
  });

  app.put('/api/member/mylist', requireMember, (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === 'string' && x.length <= 100)) {
      return res.status(400).json({ error: 'bad_list' });
    }
    req.member!.myList = [...new Set<string>(ids)];
    saveDb();
    res.json({ ok: true });
  });

  /* ───── watch history / continue watching ───── */
  app.put('/api/member/history', requireMember, (req, res) => {
    const { movieId, position, duration } = req.body || {};
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000 ? Math.round(v) : null);
    const pos = num(position);
    const dur = num(duration);
    if (typeof movieId !== 'string' || !movieId || movieId.length > 100 || pos === null || dur === null) {
      return res.status(400).json({ error: 'bad_progress' });
    }
    const m = req.member!;
    m.history = [
      { movieId, position: pos, duration: dur, updatedAt: new Date().toISOString() },
      ...m.history.filter((h) => h.movieId !== movieId),
    ].slice(0, 200);
    saveDb();
    res.json({ ok: true });
  });

  app.delete('/api/member/history/:movieId', requireMember, (req, res) => {
    req.member!.history = req.member!.history.filter((h) => h.movieId !== req.params.movieId);
    saveDb();
    res.json({ ok: true });
  });

  app.delete('/api/member/history', requireMember, (req, res) => {
    req.member!.history = [];
    saveDb();
    res.json({ ok: true });
  });

  /* ───── admin: manage members ───── */
  const adminView = (m: StoredMember) => ({
    id: m.id,
    email: m.email,
    displayName: m.displayName,
    plan: effectivePlan(m),
    vipUntil: m.plan === 'vip' ? m.vipUntil ?? null : null,
    status: m.status,
    createdAt: m.createdAt,
    lastLoginAt: m.lastLoginAt || null,
    myListCount: m.myList.length,
  });

  app.get('/api/members', requireAdmin, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(loadDb().members.map(adminView));
  });

  app.post('/api/members', requireAdmin, async (req, res) => {
    const email = normEmail(req.body?.email);
    const displayName = clean(req.body?.displayName, 40);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'bad_email', message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    if (displayName.length < 2) return res.status(400).json({ error: 'bad_name', message: 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร' });
    const pwErr = validatePassword(req.body?.password);
    if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });
    const db = loadDb();
    if (db.members.some((m) => m.email === email)) return res.status(409).json({ error: 'exists', message: 'อีเมลนี้มีอยู่แล้ว' });
    const m: StoredMember = {
      id: `mem-${crypto.randomBytes(8).toString('hex')}`,
      email,
      displayName,
      passwordHash: await hashPassword(req.body.password),
      plan: req.body?.plan === 'vip' ? 'vip' : 'free',
      status: 'active',
      createdAt: new Date().toISOString(),
      myList: [],
      history: [],
    };
    db.members.push(m);
    saveDb();
    res.status(201).json(adminView(m));
  });

  app.patch('/api/members/:id', requireAdmin, async (req, res) => {
    const m = loadDb().members.find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {};
    let revoke = false;
    if (b.displayName !== undefined) {
      const n = clean(b.displayName, 40);
      if (n.length < 2) return res.status(400).json({ error: 'bad_name', message: 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร' });
      m.displayName = n;
    }
    if (b.plan !== undefined) {
      if (b.plan !== 'free' && b.plan !== 'vip') return res.status(400).json({ error: 'bad_plan' });
      m.plan = b.plan;
      m.vipUntil = undefined; // set by an admin = no expiry
    }
    if (b.status !== undefined) {
      if (b.status !== 'active' && b.status !== 'suspended') return res.status(400).json({ error: 'bad_status' });
      if (b.status === 'suspended' && m.status !== 'suspended') revoke = true;
      m.status = b.status;
    }
    if (b.password !== undefined) {
      const pwErr = validatePassword(b.password);
      if (pwErr) return res.status(400).json({ error: 'weak_password', message: pwErr });
      m.passwordHash = await hashPassword(b.password);
      revoke = true;
    }
    saveDb();
    if (revoke) revokeMember(m.id);
    res.json(adminView(m));
  });

  app.delete('/api/members/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const m = db.members.find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'not_found' });
    db.members = db.members.filter((x) => x.id !== m.id);
    saveDb();
    revokeMember(m.id);
    res.json({ ok: true });
  });
}
