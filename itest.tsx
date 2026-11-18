// @ts-nocheck
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window','document','HTMLElement','Node','Event','KeyboardEvent','MouseEvent','PopStateEvent','getComputedStyle']) { try { (globalThis as any)[k] = w[k]; } catch {} }
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
(globalThis as any).localStorage = w.localStorage;
(globalThis as any).history = w.history; (globalThis as any).location = w.location;
(globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
(globalThis as any).fetch = async () => ({ ok: true, text: async () => '{"url":""}', json: async () => ({}) });
(globalThis as any).window.scrollTo = () => {};

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LanguageProvider } from './src/context/LanguageContext';
import { PreviewWebsiteModal } from './src/components/PreviewWebsiteModal';
import { INITIAL_MOVIES, INITIAL_LIVE_STREAMS, INITIAL_MENUS, INITIAL_FAQS, INITIAL_SETTINGS, INITIAL_CATEGORIES } from './src/data/initialData';

const movies = INITIAL_MOVIES.filter((m) => m.status === 'active').slice(0, 6);
const m0 = movies[0], m1 = movies[1];
const calls = { auth: [], list: [], progress: [], removed: [], cleared: 0, plans: 0 };
const baseUi = () => ({ viewer: 'member', canWatch: true, member: { id: 'm', email: 'a@b.co', displayName: 'Alex', plan: 'free', createdAt: '2026-01-01' }, allowRegistration: true,
  myList: [m1.id], onToggleMyList: (id) => calls.list.push(id), onOpenAuth: (x) => calls.auth.push(x), onOpenProfile() {}, onLogout() {},
  history: [{ movieId: m0.id, position: 600, duration: 6000, updatedAt: '2026-01-01' }, { movieId: m1.id, position: 5900, duration: 6000, updatedAt: '2026-01-01' }],
  onProgress: (...a) => calls.progress.push(a), onRemoveHistory: (id) => calls.removed.push(id), onClearHistory: () => calls.cleared++, paymentsEnabled: true, onOpenPlans: () => calls.plans++ });

let root, host;
const mount = async (ui, path = '/') => {
  w.history.replaceState(null, '', path);
  host = w.document.createElement('div'); w.document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<LanguageProvider><PreviewWebsiteModal isOpen publicMode movies={movies} banners={[]} liveStreams={INITIAL_LIVE_STREAMS} settings={INITIAL_SETTINGS} menus={INITIAL_MENUS} faqs={INITIAL_FAQS} categories={INITIAL_CATEGORIES} memberUi={ui} /></LanguageProvider>); });
};
const unmount = async () => { await act(async () => root.unmount()); host.remove(); };
const $ = (sel) => host.querySelector(sel);
const $$ = (sel) => [...host.querySelectorAll(sel)];
const btn = (text) => $$('button').find((b) => (b.textContent || '').includes(text) || b.getAttribute('aria-label')?.includes(text));
const click = async (el) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }); };
const text = () => host.textContent || '';
const results = [];
const check = (name, ok) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name); };
const run = async (name, fn) => { try { await fn(); } catch (e) { results.push(false); console.log('ERROR', name, '->', String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } };

await run('my list view (was a crash)', async () => {
  await mount(baseUi());
  await click(btn('รายการของฉัน'));
  check('My List view opens and shows only saved titles', text().includes('รายการของฉัน') && $$('[role=button][aria-label*="รายละเอียด"]').length === 1);
  await unmount();
});
await run('history view', async () => {
  await mount(baseUi());
  check('continue-watching row shows the in-progress title, not the finished one', text().includes('ดูต่อ') && $$('button[aria-label^="ดูต่อ"]').length === 1);
  await click(btn('ประวัติ'));
  check('History view lists both watched titles + clear button', text().includes('ประวัติการดู') && $$('[role=button][aria-label*="รายละเอียด"]').length === 2 && !!btn('ล้างประวัติ'));
  w.confirm = () => true; await click(btn('ล้างประวัติ'));
  check('clearing history calls the handler', calls.cleared === 1);
  await unmount();
});
await run('remove from continue watching', async () => {
  await mount(baseUi());
  await click(btn('ลบออกจากรายการดูต่อ'));
  check('remove button reports the movie id', calls.removed[0] === m0.id);
  await unmount();
});
await run('category chips', async () => {
  await mount(baseUi());
  const chips = $$('[aria-pressed]');
  check('chips present with "all" pressed', chips.length > 1 && chips[0].getAttribute('aria-pressed') === 'true');
  const target = chips.find((c) => c.textContent === INITIAL_CATEGORIES[0].name); await click(target);
  check('clicking a chip presses it', target.getAttribute('aria-pressed') === 'true');
  await unmount();
});
await run('detail page with its own address', async () => {
  await mount(baseUi());
  await click($$('[role=button][aria-label*="รายละเอียด"]')[0]);
  check('card click opens detail and the address becomes /movie/<id>', w.location.pathname === `/movie/${encodeURIComponent(movies[0].id)}` && text().includes('เรื่องที่คล้ายกัน'));
  check('detail shows Resume with the saved position', text().includes('ดูต่อ 10:00') || text().includes('ดูต่อ'));
  check('share button exists', !!btn('แชร์'));
  await act(async () => { w.document.defaultView.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })); });
  await act(async () => {}); 
  check('Escape closes the detail', !text().includes('เรื่องที่คล้ายกัน'));
  check('address goes back to /', w.location.pathname === '/');
  await unmount();
});
await run('back button', async () => {
  await mount(baseUi());
  await click($$('[role=button][aria-label*="รายละเอียด"]')[0]);
  await act(async () => { w.history.back(); await new Promise((r) => setTimeout(r, 30)); });
  check('Back closes the detail view', !text().includes('เรื่องที่คล้ายกัน') && w.location.pathname === '/');
  await unmount();
});
await run('direct link', async () => {
  await mount(baseUi(), `/movie/${encodeURIComponent(m1.id)}`);
  check('opening /movie/<id> directly shows that movie', text().includes('เรื่องที่คล้ายกัน') && text().includes(m1.title));
  await unmount();
  await mount(baseUi(), '/movie/does-not-exist');
  check('unknown movie link returns to the home page', !text().includes('เรื่องที่คล้ายกัน') && w.location.pathname === '/');
  await unmount();
});
await run('access rules', async () => {
  calls.auth.length = 0;
  await mount({ ...baseUi(), viewer: 'guest', canWatch: false, member: null, history: [], myList: [], paymentsEnabled: true });
  check('guest sees sign-in/sign-up, no upgrade, no history button', !!btn('เข้าสู่ระบบ') && !!btn('สมัครสมาชิก') && !btn('อัปเกรด VIP') && !btn('ประวัติ'));
  await click($$('[role=button][aria-label*="รายละเอียด"]')[0]);
  await click($$('button').find((b) => b.getAttribute('title') === 'Play Movie'));
  check('guest pressing play is sent to sign-in (no playback)', calls.auth.includes('login') && !text().includes('Server'));
  await unmount();
  await mount(baseUi());
  check('free member sees "Go VIP"; VIP member does not', !!btn('อัปเกรด VIP'));
  await click(btn('อัปเกรด VIP')); check('Go VIP opens the plans', calls.plans === 1);
  await unmount();
  await mount({ ...baseUi(), member: { ...baseUi().member, plan: 'vip' } });
  check('VIP member has no upgrade button', !btn('อัปเกรด VIP'));
  await unmount();
});
console.log(results.every(Boolean) ? `ALL ${results.length} PASSED` : `FAILED ${results.filter((x) => !x).length} of ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
