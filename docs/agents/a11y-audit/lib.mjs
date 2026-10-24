import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchChrome, CDP, openPage, sleep } from '../../../scripts/background-probe/cdp.mjs';
import { startRig } from './rig2.mjs';

// Where the probe build (dist-a11y), rig.json, screenshots and results live. Not in the repo: set A11Y_DIR or it is a temp folder.
export const SP = process.env.A11Y_DIR ?? join(tmpdir(), 'ws13-a11y');
mkdirSync(SP, { recursive: true });
export const DIST = join(SP, 'dist-a11y');
export const OUT = join(SP, 'out');
mkdirSync(OUT, { recursive: true });
export { sleep };

export const ALL_FLAGS = 'hrt_coaching,urge_timer,false_positive_controls,detection_behaviors,event_sync,data_backup,insights,photo_diary,weekly_email,phone_companion,background_watching,signin_magic_link,signin_apple,signin_microsoft,share_links,free_tier,lifetime_plan,gift_plan,referrals,compare_competitors';

const INPAGE = readFileSync(new URL('./inpage.js', import.meta.url), 'utf8');

const DAY = 86400000;
/** A believable fortnight of history in the persisted store shape, with states that exercise History rows. */
export function seedState() {
  const now = Date.now();
  const incidents = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let d = 40; d >= 0; d--) {
    const n = d < 2 ? 1 : 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const ts = now - d * DAY - Math.floor(rnd() * 11 * 3600000) - 40 * 60000;
      if (ts > now - 3 * 3600000) continue;
      const auto = rnd() > 0.4;
      incidents.push({ id: `s${d}-${k}`, timestamp: ts, ts, tag: auto ? 'auto-detected' : ['stress', 'focus', 'boredom'][k % 3], autoDetected: auto, confirmed: auto ? rnd() > 0.5 : undefined, source: auto ? 'detector' : 'manual', behavior: 'nail_biting', updatedAt: ts });
    }
  }
  // a few marked "Not a bite" and two urges, so every History row state exists
  let marked = 0;
  for (const i of incidents) { if (i.autoDetected && !i.confirmed && marked < 3) { i.falsePositive = true; marked++; } }
  for (const [k, hrs] of [[0, 30], [1, 52]]) { const ts = now - hrs * 3600000; incidents.push({ id: `urge${k}`, timestamp: ts, ts, tag: 'urge', autoDetected: false, source: 'manual', behavior: 'nail_biting', updatedAt: ts, competingResponse: { done: k === 0 } }); }
  incidents.sort((a, b) => b.timestamp - a.timestamp);
  const historyStartTime = now - 41 * DAY;
  const bites = incidents.filter((i) => !i.autoDetected || i.confirmed);
  return {
    state: {
      incidents, historyStartTime, firstOpenTime: historyStartTime, lastBiteTime: bites[0]?.timestamp ?? null,
      // the last bite is days ago, so the 3-day streak milestone is reached
    },
    version: 2,
  };
}

export async function boot({ port = 3216, chromePort = 4216, flags = ALL_FLAGS, seed = true, onboarding = false, extraEnv } = {}) {
  let rig;
  try {
    const rj = JSON.parse(readFileSync(join(SP, 'rig.json'), 'utf8'));
    const ok = await fetch(rj.url + '/health').then((r) => r.ok).catch(() => false);
    if (ok && !extraEnv && flags === ALL_FLAGS) rig = { url: rj.url, token: rj.token, share: rj.share, stop() {}, log: () => '' };
  } catch { /* no persistent rig: start one */ }
  if (!rig) rig = await startRig({ dist: DIST, port, flags, extraEnv });
  const chrome = await launchChrome({ port: chromePort, headless: 'new', args: ['--disable-features=Translate'] });
  const cdp = new CDP(chrome.wsUrl);
  await cdp.ready;
  const ctx = { rig, chrome, cdp, flags, port };
  ctx.close = () => { try { cdp.close(); } catch {} chrome.close(); rig.stop(); };
  ctx.page = async (url = 'about:blank', { signedIn = true, seedHistory = seed, tour = onboarding, init = '' } = {}) => {
    const page = await openPage(cdp, 'about:blank');
    page.cdp = cdp;
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('DOM.enable');
    await page.send('Accessibility.enable');
    await page.send('Network.enable');
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    if (signedIn) await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
    const seedJson = JSON.stringify(seedState());
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { ${tour ? '' : "localStorage.setItem('onboarding_v1_done', '1');"} ${seedHistory ? `if (!localStorage.getItem('stop-biting-state')) localStorage.setItem('stop-biting-state', ${JSON.stringify(seedJson)});` : ''} } catch {}`,
    });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INPAGE });
    if (init) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { ${init} } catch (e) {}` });
    page.errors = [];
    cdp.on((m) => {
      if (m.sessionId !== page.sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') page.errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    });
    if (url !== 'about:blank') await page.send('Page.navigate', { url });
    return page;
  };
  return ctx;
}

// ── page helpers (take a page from ctx.page) ─────────────────────────────────────────────────────────
export const setScheme = (page, dark) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, ...(page._reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])] });
export const setReduced = async (page, on) => { page._reduced = on; await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }, { name: 'prefers-color-scheme', value: page._dark ? 'dark' : 'light' }] }); };
export const setTheme = async (page, dark) => { page._dark = !!dark; await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: page._reduced ? 'reduce' : 'no-preference' }] }); };
export const phone = (page) => page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
export const desktop = (page) => page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

export async function shot(page, name, clip) {
  const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  return join(OUT, name + '.png');
}

export async function key(page, k, opts = {}) {
  const map = { Tab: 9, Escape: 27, Enter: 13, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
  const code = k === ' ' ? 'Space' : k.length === 1 ? 'Key' + k.toUpperCase() : k;
  const base = { key: k, code, windowsVirtualKeyCode: map[k] ?? k.toUpperCase().charCodeAt(0), modifiers: opts.shift ? 8 : 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, ...(k === 'Enter' ? { text: '\r' } : {}) });
  if (k === ' ' || k === 'Enter') await page.send('Input.dispatchKeyEvent', { type: 'char', ...base, text: k === 'Enter' ? '\r' : ' ' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(opts.wait ?? 120);
}

export const active = (page) => page.eval(`JSON.stringify(window.__a11y.describe(document.activeElement))`).then((s) => JSON.parse(s));

/** Click the first visible button/link/etc whose text or aria-label matches. */
export async function clickText(page, text, { sel = 'button,a,[role=button],[role=tab],summary,label', exact = true } = {}) {
  const r = await page.eval(`(() => {
    const t = ${JSON.stringify(text)}; const exact = ${exact};
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(window.__a11y.visible);
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const el = els.find((b) => { const n = norm(b.getAttribute('aria-label')) || norm(b.innerText); return exact ? n === t || norm(b.innerText) === t : n.includes(t); });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!r) return false;
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(250);
  return true;
}

export async function waitFor(page, expr, timeout = 15000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await page.eval(`!!(${expr})`)) return true; } catch {}
    await sleep(step);
  }
  return false;
}

export const tab = (page, label) => clickText(page, label, { sel: 'nav button, nav a, [role=tab]', exact: true });

/** Press Tab until focus returns to the start or max reached. Returns the ordered list of focus stops. */
export async function tabWalk(page, { max = 60, shiftStart = false, root = null } = {}) {
  await page.eval(`(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); window.scrollTo(0,0); })()`);
  const stops = [];
  let first = null;
  for (let i = 0; i < max; i++) {
    await key(page, 'Tab', { wait: 60, shift: shiftStart });
    const d = await active(page);
    if (!d) break;
    if (d.tag === 'body') { stops.push({ ...d, note: 'focus left the page (browser chrome)' }); break; }
    const k = d.sel + '|' + d.name;
    if (first === null) first = k; else if (k === first) { stops.push({ ...d, note: 'wrapped' }); break; }
    stops.push(d);
  }
  return stops;
}

/** Pixel-diff focus indicator: screenshots around the element unfocused vs focused. Returns number of changed pixels. */
export async function focusIndicatorPixels(page, selector) {
  const found = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.scrollIntoView({block:'center', behavior:'instant'}); return true; })()`);
  if (!found) return null;
  await sleep(700);
  const rect = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return {x:Math.max(0,r.x-8), y:Math.max(0,r.y-8), w:r.width+16, h:r.height+16}; })()`);
  if (!rect) return null;
  await page.eval(`document.activeElement && document.activeElement.blur()`);
  await sleep(100);
  const sy = await page.eval(`scrollY`), sx = await page.eval(`scrollX`);
  const clip = { x: rect.x + sx, y: rect.y + sy, width: rect.w, height: rect.h, scale: 1 };
  const a = await page.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false });
  // a keyboard event makes Chrome treat the next programmatic focus as keyboard focus (:focus-visible), as after Tab
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await page.eval(`document.querySelector(${JSON.stringify(selector)}).focus({ preventScroll: true })`);
  await sleep(150);
  const b = await page.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false });
  return { a: a.data, b: b.data, same: a.data === b.data };
}

// ── accessibility tree ────────────────────────────────────────────────────────────────────────────────
const NAMED_ROLES = new Set(['image', 'button', 'link', 'slider', 'progressbar', 'switch', 'checkbox', 'radio', 'textbox', 'combobox', 'tab', 'menuitem', 'img', 'dialog', 'alertdialog', 'timer', 'meter', 'spinbutton', 'searchbox', 'listbox', 'option', 'radiogroup', 'tablist', 'group']);
const KEY_ROLES = new Set([...NAMED_ROLES, 'status', 'alert', 'heading', 'region', 'navigation', 'main', 'banner', 'contentinfo', 'form', 'list', 'LabelText', 'article']);

export async function axTree(page, { rootSelector = null, roles = KEY_ROLES, all = false } = {}) {
  const { nodes } = await page.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  let allowed = null;
  if (rootSelector) {
    const { root } = await page.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector: rootSelector });
    if (!nodeId) return { error: 'root not found: ' + rootSelector, nodes: [] };
    const { node } = await page.send('DOM.describeNode', { nodeId });
    const rootAx = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
    allowed = new Set();
    const walk = (n) => { allowed.add(n.nodeId); for (const c of n.childIds || []) { const cn = byId.get(c); if (cn) walk(cn); } };
    if (rootAx) walk(rootAx);
  }
  const out = [];
  const bad = [];
  for (const n of nodes) {
    if (allowed && !allowed.has(n.nodeId)) continue;
    if (n.ignored) continue;
    const role = n.role?.value;
    if (!role) continue;
    if (!all && !roles.has(role)) continue;
    const name = n.name?.value ?? '';
    const props = Object.fromEntries((n.properties || []).map((p) => [p.name, p.value?.value]));
    const rec = { role, name: String(name).slice(0, 80), value: n.value?.value, desc: n.description?.value, props: pickProps(props) };
    out.push(rec);
    if (NAMED_ROLES.has(role) && !['group', 'img', 'tablist', 'radiogroup', 'listbox'].includes(role) && !String(name).trim()) bad.push(rec);
    if (role === 'img' && !String(name).trim() && !props.hidden) { /* decorative images are normally ignored by Chrome; an unnamed img node is reported */ bad.push(rec); }
  }
  return { nodes: out, unnamed: bad };
}
function pickProps(p) {
  const keep = ['expanded', 'checked', 'pressed', 'disabled', 'valuemin', 'valuemax', 'valuenow', 'valuetext', 'modal', 'live', 'atomic', 'relevant', 'level', 'selected', 'orientation', 'required', 'invalid', 'haspopup', 'describedby', 'labelledby', 'focusable', 'focused'];
  const o = {};
  for (const k of keep) if (p[k] !== undefined) o[k] = p[k];
  return o;
}

export async function animations(page) {
  return JSON.parse(await page.eval(`JSON.stringify(document.getAnimations().map((a) => ({
    type: a.constructor.name, name: a.animationName || a.transitionProperty || '', state: a.playState,
    target: window.__a11y.sel(a.effect && a.effect.target), iter: a.effect && a.effect.getComputedTiming().iterations,
    dur: a.effect && a.effect.getComputedTiming().duration,
  })))`));
}

export async function contrastBoth(page, root, label, { ui = true } = {}) {
  const res = {};
  for (const dark of [false, true]) {
    await setTheme(page, dark);
    await sleep(300);
    await page.eval(`window.__a11y.settle(true)`);
    await sleep(150);
    const html = await page.eval(`document.documentElement.classList.contains('dark')`);
    const rows = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.contrast(${JSON.stringify(root)}))`));
    const uirows = ui ? JSON.parse(await page.eval(`JSON.stringify(window.__a11y.uiContrast(${JSON.stringify(root)}))`)) : [];
    res[dark ? 'dark' : 'light'] = { darkClass: html, n: rows.length, min: rows.reduce((m, r) => Math.min(m, r.ratio), 99), fails: rows.filter((r) => r.fail), notes: rows.filter((r) => r.note).map((r) => ({ sel: r.sel, text: r.text, note: r.note, ratio: r.ratio })), ui: uirows.filter((r) => r.fail), uiCount: uirows.length, all: rows };
  }
  await setTheme(page, false);
  await page.eval(`window.__a11y.settle(false)`);
  return res;
}

export function save(name, obj) { writeFileSync(join(OUT, name + '.json'), JSON.stringify(obj, null, 1)); }
