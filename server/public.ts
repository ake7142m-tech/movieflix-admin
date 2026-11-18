import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { loadDb, saveDb, effectivePlan, type StoredMember } from './store';
import { stripePublicState } from './payments';
import { requireAuth, requireAdmin } from './auth';

/* ───────────── live updates (Server-Sent Events) ─────────────
 * Every admin save calls broadcast(); open public pages refetch immediately.
 */
const sseClients = new Set<Response>();
const MAX_SSE = 2000;

export function broadcast(): void {
  for (const c of sseClients) c.write('event: changed\ndata: {}\n\n');
}
setInterval(() => {
  for (const c of sseClients) c.write(': ping\n\n');
}, 25_000).unref();

/* ───────────── what visitors may see ───────────── */
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export interface Viewer {
  member: StoredMember | null;
  /** a signed-in admin/staff looking at the site */
  admin: boolean;
}

/**
 * What THIS visitor is allowed to receive. The rules live here, on the server:
 *  - maintenance      → settings only
 *  - guest, site closed to guests (allowGuestPreview off) → settings only ("locked")
 *  - guest            → catalogue without stream addresses (they cannot watch)
 *  - member / admin   → everything, with notifications filtered by audience
 */
export function publicPayload(viewer: Viewer) {
  const col = loadDb().collections as Record<string, any>;
  const s = col.settings || {};
  const settings = {
    siteName: s.siteName,
    siteTagline: s.siteTagline,
    logoText: s.logoText,
    supportEmail: s.supportEmail,
    copyrightText: s.copyrightText,
    maintenanceMode: !!s.maintenanceMode,
    allowGuestPreview: s.allowGuestPreview !== false,
    allowRegistration: s.allowRegistration !== false,
  };
  const canWatch = !!viewer.member || viewer.admin;
  const who = viewer.admin ? ('admin' as const) : viewer.member ? ('member' as const) : ('guest' as const);

  if (settings.maintenanceMode) return { settings, maintenance: true as const, locked: false, canWatch, viewer: who };
  if (!canWatch && !settings.allowGuestPreview) {
    return { settings, maintenance: false as const, locked: true, canWatch, viewer: who };
  }

  const isVip = viewer.admin || (!!viewer.member && effectivePlan(viewer.member) === 'vip');
  const audienceOk = (n: any) => {
    const aud = n?.targetAudience ?? n?.audience ?? 'all';
    if (aud === 'vip') return isVip;
    if (aud === 'followers') return canWatch;
    return true;
  };

  return {
    settings,
    maintenance: false as const,
    locked: false,
    canWatch,
    viewer: who,
    seo: col.seo || {},
    faqs: asArray(col.faqs),
    menus: col.menus || { header: [], footer: [] },
    categories: asArray(col.categories),
    genres: asArray(col.genres),
    movies: asArray(col.movies)
      .filter((m) => m && m.status === 'active')
      .map((m) => (canWatch ? m : { ...m, streamUrl: '' })), // guests never receive the real address
    banners: asArray(col.banners)
      .filter((b) => b && b.active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    liveStreams: asArray(col.liveStreams).map((ls) =>
      canWatch ? ls : { ...ls, streamServers: asArray(ls?.streamServers).map((sv) => ({ ...sv, url: '' })) }
    ),
    notifications: asArray(col.notifications).filter(audienceOk),
    ...stripePublicState(asArray(col.plans)),
    videoAds: asArray(col.videoAds)
      .filter((a) => a && a.active)
      .map(({ id, title, sponsorName, videoUrl, targetUrl, skipAfterSeconds, placement }) => ({
        id, title, sponsorName, videoUrl, targetUrl, skipAfterSeconds, placement,
      })),
  };
}

/* ───────────── stream-URL signing (TypeA) — key never leaves the server ───────────── */
interface TypeAConfig {
  enabled: boolean;
  pk: string;
  ttl: number;
  keyName: string;
  uid: number;
}
const getTypeA = (): TypeAConfig | null => {
  const raw = loadDb().secrets.typea;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TypeAConfig;
  } catch {
    return null;
  }
};
const typeAStatus = () => {
  const c = getTypeA();
  return c
    ? { configured: !!c.pk, enabled: !!c.enabled, ttl: c.ttl, keyName: c.keyName, uid: c.uid }
    : { configured: false, enabled: false, ttl: 60, keyName: 'key', uid: 0 };
};

function signUrl(rawUrl: string, c: TypeAConfig): string {
  const u = new URL(rawUrl);
  const ts = Math.floor(Date.now() / 1000);
  const rand = crypto.randomBytes(4).toString('hex').slice(0, 6);
  const hash = crypto.createHash('md5').update([u.pathname, ts, rand, c.uid, c.pk].join('-')).digest('hex');
  u.searchParams.set(c.keyName || 'key', [ts, rand, c.uid, hash].join('-'));
  return u.toString();
}

/** Only URLs that admins actually published may be signed (no open signing oracle). */
function publishedStreamUrls(): Set<string> {
  const col = loadDb().collections as Record<string, any>;
  const urls = new Set<string>();
  for (const m of asArray(col.movies)) {
    if (m?.status !== 'active') continue;
    if (m.streamUrl) urls.add(m.streamUrl);
    if (m.trailerUrl) urls.add(m.trailerUrl);
  }
  for (const s of asArray(col.liveStreams)) for (const sv of asArray(s?.streamServers)) if (sv?.url) urls.add(sv.url);
  return urls;
}

/* ───────────── ad counters (batched writes) ───────────── */
let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDb();
  }, 2000);
}
export function flushPending() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveDb();
}
const adHits = new Map<string, number>();

/* ───────────── SEO: written into the HTML for crawlers & link previews ───────────── */
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function renderIndexHtml(template: string, isAdminRoute: boolean, urlPath = '/', origin = ''): string {
  if (isAdminRoute) {
    return template.replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  }
  const col = loadDb().collections as Record<string, any>;
  const seo = col.seo || {};
  const s = col.settings || {};
  if (s.maintenanceMode) {
    return template.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  }
  const siteName = s.siteName || 'FREEDOM';
  let title = seo.metaTitle || siteName;
  let desc = seo.metaDescription || s.siteTagline || '';
  const keywords = seo.metaKeywords || '';
  let image = '';
  let ogType = 'website';

  // A movie page gets its own title, description and picture (what link previews and Google show).
  // Only for published titles, and never when the site is closed to guests.
  const m = /^\/movie\/([^/]+)\/?$/.exec(urlPath);
  if (m && s.allowGuestPreview !== false) {
    let id = m[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      /* keep raw */
    }
    const movie = asArray(col.movies).find((x) => x?.id === id && x.status === 'active');
    if (movie) {
      title = `${movie.title}${movie.year ? ` (${movie.year})` : ''} — ${siteName}`;
      desc = String(movie.description || desc).replace(/\s+/g, ' ').slice(0, 160);
      image = String(movie.backdrop || movie.poster || '');
      if (image.startsWith('/') && origin) image = origin + image;
      if (!/^https?:\/\//i.test(image)) image = '';
      ogType = 'video.movie';
    }
  }

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta property="og:title"[^>]*>/, '')
    .replace(/<meta property="og:description"[^>]*>/, '')
    // drop the template's own social tags so a page never carries two conflicting values
    .replace(/<meta\s+(?:property|name)="(?:og:(?:type|image|site_name|url)|twitter:[a-z:]+)"[^>]*>\s*/g, '');
  const tags = [
    `<meta name="description" content="${esc(desc)}" />`,
    keywords ? `<meta name="keywords" content="${esc(keywords)}" />` : '',
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');
  html = html.replace('</head>', `    ${tags}\n  </head>`);
  return html;
}

export function registerPublic(app: Express): void {
  /* visitors */
  app.get('/api/public', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    res.json({
      ...publicPayload({ member: req.member || null, admin: !!req.auth }),
      streamProtected: typeAStatus().enabled,
    });
  });

  app.get('/api/public/events', (req: Request, res: Response) => {
    if (sseClients.size >= MAX_SSE) return res.status(503).end();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  app.post('/api/public/ads/:id/:event', (req, res) => {
    const { id, event } = req.params;
    if (event !== 'impression' && event !== 'click') return res.status(400).json({ error: 'bad_event' });
    const key = `${req.ip}|${id}|${event}`;
    const now = Date.now();
    if (now - (adHits.get(key) || 0) < 5000) return res.json({ ok: true }); // ignore rapid repeats
    adHits.set(key, now);
    if (adHits.size > 5000) for (const [k, t] of adHits) if (now - t > 60_000) adHits.delete(k);
    const ads = asArray((loadDb().collections as any).videoAds);
    const ad = ads.find((a) => a?.id === id);
    if (!ad) return res.status(404).json({ error: 'not_found' });
    if (event === 'impression') ad.impressions = (ad.impressions || 0) + 1;
    else ad.clicks = (ad.clicks || 0) + 1;
    scheduleSave();
    res.json({ ok: true });
  });

  app.post('/api/public/stream-url', (req, res) => {
    // only members (or admin staff) may get playable addresses
    if (!req.member && !req.auth) return res.status(401).json({ error: 'members_only', message: 'สำหรับสมาชิกเท่านั้น' });
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const cfg = getTypeA();
    if (!cfg || !cfg.enabled || !cfg.pk || !/\.m3u8(\?|#|$)/i.test(url)) return res.json({ url });
    if (!publishedStreamUrls().has(url)) return res.status(400).json({ error: 'not_published' });
    try {
      res.json({ url: signUrl(url, cfg) });
    } catch {
      res.status(400).json({ error: 'bad_url' });
    }
  });

  /* admin: stream protection settings */
  app.get('/api/secrets/typea', requireAuth, (_req, res) => res.json(typeAStatus()));

  app.put('/api/secrets/typea', requireAdmin, (req, res) => {
    const b = req.body || {};
    const prev = getTypeA();
    const pk = typeof b.pk === 'string' && b.pk.trim() ? b.pk.trim().slice(0, 256) : prev?.pk || '';
    const ttl = Math.min(86400, Math.max(5, Math.round(Number(b.ttl) || 60)));
    const keyName = /^[A-Za-z0-9_-]{1,32}$/.test(String(b.keyName || '')) ? String(b.keyName) : 'key';
    const uid = Math.max(0, Math.round(Number(b.uid) || 0));
    const enabled = !!b.enabled && !!pk;
    if (b.enabled && !pk) {
      return res.status(400).json({ error: 'no_key', message: 'ต้องกรอกกุญแจ (Private Key) ก่อนเปิดใช้งาน' });
    }
    loadDb().secrets.typea = JSON.stringify({ enabled, pk, ttl, keyName, uid });
    saveDb();
    broadcast();
    res.json(typeAStatus());
  });

  app.delete('/api/secrets/typea', requireAdmin, (_req, res) => {
    delete loadDb().secrets.typea;
    saveDb();
    broadcast();
    res.json({ ok: true });
  });
}

export function loadIndexTemplate(distDir: string): string | null {
  const p = path.join(distDir, 'index.html');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
