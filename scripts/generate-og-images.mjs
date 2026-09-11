#!/usr/bin/env node
// Per-page Open Graph images — one 1200x630 PNG per article, written to
// public/og/ and committed to git.
//
//   npm run og:generate          # write public/og/*.png
//   npm run og:check             # fail if the committed PNGs are out of date
//
// WHY THESE ARE COMMITTED, NOT BUILT
// ----------------------------------
// The production image copies only dist/, server.js and email.js (Dockerfile),
// and the build stage has no Chrome, so generating at container build time is
// not possible. These live under public/, which `vite build` copies verbatim
// into dist/, so a committed file is the only route to production.
// Regenerate locally and commit the diff.
//
// WHY CHROME AND NOT A LIBRARY
// ----------------------------
// Nothing in node_modules can rasterise text — no sharp, no resvg, no canvas,
// no satori — and adding one drags a multi-megabyte native binary into
// devDependencies to produce assets that change a few times a year. Chrome is
// already on the machine of anyone who would run this, already speaks WOFF2,
// and is the only renderer that lays out the site's own fonts the way the site
// does. It is driven over the DevTools Protocol from one long-lived process:
// the template — inlined fonts included — is parsed once, and each card is a
// DOM write plus a screenshot, not a browser launch. 152 cards in ~18s.
//
// The only other moving part is the PNG re-encoder at the bottom of this file.
// Chrome emits 24-bit truecolour; these cards use six flat colours plus their
// antialiasing ramps, ~950 distinct values in all, so a 256-entry palette is
// visually lossless (worst-case channel error ~10/255, on glyph edges) and
// roughly halves the bytes. That is the difference between a 6.8 MB directory
// and a 3.3 MB one, and between blowing the 30 KB-per-image budget on every
// card and clearing it on every card.
//
// DETERMINISM
// -----------
// Same input must produce byte-identical output or every run churns git.
//   1. Rendering flags pin the parts of Chrome's text pipeline that otherwise
//      follow the host: --force-color-profile=srgb, --font-render-hinting=none,
//      --disable-font-subpixel-positioning, --disable-lcd-text (the last also
//      cuts size: grayscale antialiasing yields far fewer distinct pixel
//      values than subpixel RGB fringing).
//   2. Nothing time-, locale- or random-dependent is rendered. The card
//      carries a title, a tag and a reading time — no dates, no build stamps.
//   3. The quantiser breaks every tie explicitly (box choice, median split,
//      palette order) and zlib is called with fixed level/strategy/memLevel,
//      so the encoder is a pure function of the pixels.
//   4. Files are rewritten only when their bytes change, so a no-op run leaves
//      mtimes alone too.
// Byte-identity holds for a given Chrome build; a Chrome upgrade can reflow
// text and legitimately change every card. `npm run og:check` is what turns
// either kind of drift into a failed build rather than a surprise.
//
// THE TEXT ON THE CARD
// --------------------
// Exactly `seoTitle ?? title` — the same string server.js puts in <title> and
// og:title for that route. A social card whose headline disagrees with the
// page's own headline is its own kind of lie, so there is one source for both.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'og');
const FONT_DIR = join(ROOT, 'public', 'fonts');

const CHECK_ONLY = process.argv.includes('--check');

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const WIDTH = 1200;
const HEIGHT = 630;
const PALETTE_SIZE = 256;
// Advisory. Nothing fails on a card that exceeds it; the run reports the
// offenders so a design change that quietly triples the payload is visible.
const SIZE_BUDGET_BYTES = 30 * 1024;

// ─── Palette ─────────────────────────────────────────────────────────────────
// Verbatim from tailwind.config.js — the site's own tokens, not approximations
// of them. cream-100 is the page background in src/index.css, stone-* the text
// ramp, forest-* the accent. Copied rather than imported because
// tailwind.config.js exports a config object, not a palette, and this file runs
// under plain node with no build step.
const C = {
  cream100: 'oklch(97% 0.012 80)',
  stone200: 'oklch(88% 0.014 120)',
  stone400: 'oklch(62% 0.018 120)',
  stone500: 'oklch(50% 0.018 120)',
  stone800: 'oklch(22% 0.012 120)',
  stone900: 'oklch(15% 0.010 120)',
  forest500: 'oklch(46% 0.130 148)',
  forest600: 'oklch(38% 0.120 148)',
};

// ─── Fonts ───────────────────────────────────────────────────────────────────
// The self-hosted WOFF2s from public/fonts, inlined as data URIs so the
// renderer needs no file access and no network. Both the `latin` and
// `latin-ext` subsets ship for each family: titles in the corpus already
// contain U+2013 and U+2014, and an accented character in a future title must
// render rather than tofu. No unicode-range is declared — the browser picks
// whichever subset holds the glyph, which is what we want on a page that is
// never served and where correctness beats byte count.
const FONT_FILES = [
  ['Inter', 400, 'inter-latin.woff2'],
  ['Inter', 400, 'inter-latin-ext.woff2'],
  ['Inter', 600, 'inter-latin.woff2'],
  ['Inter', 600, 'inter-latin-ext.woff2'],
  ['Instrument Serif', 400, 'instrument-serif-latin.woff2'],
  ['Instrument Serif', 400, 'instrument-serif-latin-ext.woff2'],
  ['JetBrains Mono', 500, 'jetbrains-mono-latin.woff2'],
  ['JetBrains Mono', 500, 'jetbrains-mono-latin-ext.woff2'],
];

function fontFaceCss() {
  return FONT_FILES.map(([family, weight, file]) => {
    const path = join(FONT_DIR, file);
    if (!existsSync(path)) throw new Error(`missing font: ${path}`);
    const b64 = readFileSync(path).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
      `src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('');
}

// ─── The card ────────────────────────────────────────────────────────────────
// A forest bar down the left edge, an eyebrow (tag · reading time) in the mono
// face, the headline in Inter 600 — the same face and weight the article's own
// <h1> uses in BlogPost.tsx, so card and page agree visually — and a rule above
// the brand mark. The nail glyph is the path data from public/logo.svg.
//
// Type size is not hardcoded: fitTitle() in the template shrinks the headline
// until it fits its slot, which is what keeps a 12-word title inside the canvas
// without ever clipping it.
//
// viewBox: logo.svg's paths span x 64–330, y 41–337 once the 26/18 stroke
// widths are accounted for. A square box centred on that (197, 189) with a few
// units of air is 45 37 304 304 — anything tighter shaves the outer arch.
const LOGO_SVG =
  '<svg viewBox="45 37 304 304" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M77 324V174C77 107.726 130.726 54 197 54C263.274 54 317 107.726 317 174V324" ' +
  'stroke="currentColor" stroke-width="26" stroke-linecap="round" fill="none"/>' +
  '<path d="M107 174C107 124.294 147.294 84 197 84C246.706 84 287 124.294 287 174V249C287 282.136 ' +
  '260.136 309 227 309H167C133.863 309 107 282.136 107 249V174Z" fill="none" ' +
  'stroke="currentColor" stroke-width="18"/></svg>';

function templateHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${fontFaceCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
body{background:${C.cream100};-webkit-font-smoothing:antialiased}
#card{position:relative;width:${WIDTH}px;height:${HEIGHT}px;display:flex;flex-direction:column;
  padding:72px 80px 64px 104px}
/* Full-bleed accent down the left edge: the one element that still identifies
   the card as this site at 320px wide, where the type has gone to mush. */
#bar{position:absolute;left:0;top:0;bottom:0;width:24px;background:${C.forest500}}
#eyebrow{display:flex;align-items:center;gap:14px;font-family:'JetBrains Mono';font-weight:500;
  font-size:21px;letter-spacing:0.13em;text-transform:uppercase;color:${C.forest600};flex:none}
#eyebrow .sep{width:5px;height:5px;border-radius:50%;background:${C.stone400};flex:none}
#eyebrow .meta{color:${C.stone500};letter-spacing:0.1em}
#eyebrow.bare .sep,#eyebrow.bare .meta{display:none}
/* The headline box is a fixed slot. fitTitle() picks the largest size whose
   scrollHeight fits it, so overflow is impossible rather than unlikely. */
#title{flex:1;display:flex;align-items:center;overflow:hidden;margin:34px 0 0}
/* Plain greedy wrapping. text-wrap:balance was tried here and removed: in
   Chrome 152 it is not idempotent — setting 58px, then 59px, then 58px again
   laid the same string out as 5 lines and then as 6, so the fit search below
   measured a height the final render did not reproduce and the card shipped
   with its first and last lines sliced off. Greedy wrapping measures what it
   renders, and it is what the article's own h1 does on the site anyway.
   break-word so a single unbreakable token — a long hyphen-free compound, a
   pasted URL — wraps instead of running off the right edge; it only engages
   when the word cannot fit a line on its own, so normal titles are untouched. */
#title h1{font-family:'Inter';font-weight:600;letter-spacing:-0.022em;line-height:1.14;
  color:${C.stone900};width:100%;overflow-wrap:break-word}
#foot{flex:none;display:flex;align-items:center;justify-content:space-between;
  border-top:2px solid ${C.stone200};padding-top:26px;margin-top:34px}
#brand{display:flex;align-items:center;gap:16px}
#brand svg{width:40px;height:40px;color:${C.forest500};flex:none}
#brand .name{font-family:'Instrument Serif';font-size:38px;line-height:1;color:${C.stone800}}
#url{font-family:'JetBrains Mono';font-weight:500;font-size:20px;letter-spacing:0.04em;
  color:${C.stone500}}
</style></head><body><div id="card">
<div id="bar"></div>
<div id="eyebrow"><span class="tag"></span><span class="sep"></span><span class="meta"></span></div>
<div id="title"><h1></h1></div>
<div id="foot">
  <div id="brand">${LOGO_SVG}<span class="name">Stop Biting</span></div>
  <span id="url">stopbiting.today</span>
</div>
</div><script>
// Largest integer font size in [MIN,MAX] at which the headline still fits its
// slot. Binary search: deterministic, and it settles in ~6 layout passes
// instead of walking down a pixel at a time.
//
// Every measurement is taken AFTER yielding to the event loop. Reading
// scrollHeight straight after writing style.fontSize looks like a forced
// synchronous layout, and it is — but in headless Chrome that first answer can
// be a provisional one: a 165-character headline measured 330px (5 lines)
// synchronously and 397px (6 lines) one task later, which is how a card ships
// with its first and last lines sliced off while the fit check reports success.
// A task boundary costs about a millisecond and makes the number real.
const MIN = 34, MAX = 76;
const settle = () => new Promise((r) => setTimeout(r, 0));
async function fits(h1, box, px) {
  h1.style.fontSize = px + 'px';
  await settle();
  return h1.scrollHeight <= box.clientHeight && h1.scrollWidth <= box.clientWidth;
}
window.renderCard = async (data) => {
  const eyebrow = document.getElementById('eyebrow');
  eyebrow.querySelector('.tag').textContent = data.tag;
  eyebrow.querySelector('.meta').textContent = data.meta ?? '';
  eyebrow.classList.toggle('bare', !data.meta);
  const box = document.getElementById('title');
  const h1 = box.querySelector('h1');
  h1.textContent = data.title;
  let lo = MIN, hi = MAX, best = MIN;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (await fits(h1, box, mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  // Verify the size actually being shipped, rather than trusting the search to
  // have measured the layout it renders, and walk down until it does fit.
  while (best > MIN && !(await fits(h1, box, best))) best--;
  h1.style.fontSize = best + 'px';
  await settle();
  // A headline so long that even MIN overflows would be clipped. Nothing in
  // the corpus is close (longest is 12 words / 60 chars), but a future one has
  // to fail loudly here rather than ship a card with its last line sliced off.
  // The caller turns this into a non-zero exit.
  const overflow = h1.scrollHeight > box.clientHeight || h1.scrollWidth > box.clientWidth;
  return { size: best, overflow };
};
</script></body></html>`;
}

// ─── Chrome over the DevTools Protocol ───────────────────────────────────────
// One browser, one tab, one template parse; then a DOM write and a screenshot
// per card. Chrome ships no Node bindings, so this is a hand-rolled CDP client
// over the global WebSocket (Node >= 22) — about 40 lines, versus a headless
// browser driver in devDependencies.
async function launchChrome() {
  if (!existsSync(CHROME)) {
    throw new Error(
      `Chrome not found at ${CHROME}.\n` +
      'Install Google Chrome, or point CHROME_PATH at a Chromium binary.');
  }
  const profile = join(tmpdir(), `og-chrome-${process.pid}`);
  mkdirSync(profile, { recursive: true });
  const child = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    // Determinism: pin colour management and the text rasteriser, which
    // otherwise follow the host display and produce different bytes on
    // different machines — and different bytes run to run on the same one.
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    '--disable-font-subpixel-positioning',
    '--disable-lcd-text',
    '--disable-gpu',
    '--hide-scrollbars',
    // Keep a real profile's background chatter out of the run.
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-default-apps',
    '--mute-audio',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(
      () => reject(new Error('Chrome did not report a DevTools endpoint within 30s')), 30_000);
    child.stderr.on('data', (chunk) => {
      buf += chunk;
      const m = buf.match(/ws:\/\/\S+/);
      if (m) { clearTimeout(timer); resolve(m[0]); }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (code ${code}):\n${buf}`));
    });
  });

  return { child, wsUrl, profile };
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const slot = pending.get(msg.id);
    if (!slot) return;                       // an event, not a reply
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(`CDP: ${msg.error.message}`));
    else slot.resolve(msg.result);
  });
  const send = (method, params = {}, sessionId) =>
    ready.then(() => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    }));
  return { send, close: () => ws.close() };
}

async function openCard(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => cdp.send(method, params, sessionId);
  await call('Page.enable');
  await call('Runtime.enable');
  // Pin the viewport rather than trusting --window-size: captureScreenshot
  // clips to these metrics, so the PNG is exactly 1200x630 at scale 1 whatever
  // the host display's device pixel ratio happens to be.
  await call('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
  });

  // setDocumentContent avoids a data: URL megabytes long (the inlined fonts)
  // and keeps the document's origin stable across the run.
  const { frameTree } = await call('Page.getFrameTree');
  await call('Page.setDocumentContent', { frameId: frameTree.frame.id, html: templateHtml() });
  // Wait for the template's own script to define renderCard, then for every
  // @font-face to finish decoding. The fonts are data URIs so nothing is
  // fetched, but a face is unusable until decoded — capture before that and
  // all 152 cards silently render in the fallback system font, which is the
  // kind of bug that only shows up on Twitter.
  const res = await call('Runtime.evaluate', {
    expression: `(async () => {
      for (let i = 0; i < 300 && typeof window.renderCard !== 'function'; i++) {
        await new Promise(r => setTimeout(r, 10));
      }
      if (typeof window.renderCard !== 'function') throw new Error('template script never ran');
      await document.fonts.ready;
      return document.fonts.size;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
  if (res.result.value !== FONT_FILES.length) {
    throw new Error(`expected ${FONT_FILES.length} font faces, document has ${res.result.value}`);
  }
  return call;
}

async function renderOne(call, data) {
  const res = await call('Runtime.evaluate', {
    expression: `window.renderCard(${JSON.stringify(data)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
  const shot = await call('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
    captureBeyondViewport: false,
    fromSurface: true,
    optimizeForSpeed: false,
  });
  return { png: Buffer.from(shot.data, 'base64'), fit: res.result.value };
}

// ─── PNG: truecolour in, 8-bit palette out ───────────────────────────────────
// Chrome hands back a 24-bit RGB PNG. Everything below turns that into an
// indexed one at the same dimensions. It is ~120 lines of pure stdlib, and it
// is here rather than in a dependency because the alternative (sharp, or a
// shelled-out pngquant) is a native binary or an undeclared system tool for a
// transform this narrow.

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, width = 0, height = 0, depth = 0, colour = 0;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(o + 8); height = buf.readUInt32BE(o + 12);
      depth = buf[o + 16]; colour = buf[o + 17];
      if (buf[o + 20]) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6)) {
    throw new Error(`unexpected PNG from Chrome: depth ${depth}, colour type ${colour}`);
  }
  const bpp = colour === 2 ? 3 : 4;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const base = y * stride, above = base - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[base + i - bpp] : 0;
      const b = y > 0 ? px[above + i] : 0;
      const c = (i >= bpp && y > 0) ? px[above + i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (f !== 0) throw new Error(`bad PNG filter ${f}`);
      px[base + i] = v & 0xff;
    }
  }
  return { width, height, bpp, px };
}

// Median cut. Every choice that could depend on iteration order is broken by
// an explicit tie-break, so the palette is a pure function of the pixels:
// the histogram is walked in ascending colour order, the box to split is the
// first with the largest (pixels x longest-axis extent), and the split point
// is the median by pixel count.
function medianCut(px, bpp, max) {
  const hist = new Map();
  for (let i = 0; i < px.length; i += bpp) {
    const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const colours = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  if (colours.length <= max) return { palette: colours.map(([k]) => k), distinct: colours.length };

  const box = (list) => {
    let rlo = 255, rhi = 0, glo = 255, ghi = 0, blo = 255, bhi = 0, n = 0;
    for (const [k, c] of list) {
      const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
      if (r < rlo) rlo = r; if (r > rhi) rhi = r;
      if (g < glo) glo = g; if (g > ghi) ghi = g;
      if (b < blo) blo = b; if (b > bhi) bhi = b;
      n += c;
    }
    const dr = rhi - rlo, dg = ghi - glo, db = bhi - blo;
    // Shift for the longest axis; R wins ties over G, G over B.
    const shift = dr >= dg && dr >= db ? 16 : (dg >= db ? 8 : 0);
    return { list, n, extent: Math.max(dr, dg, db), shift };
  };

  let boxes = [box(colours)];
  while (boxes.length < max) {
    let pick = -1, bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i];
      if (bx.list.length < 2 || bx.extent === 0) continue;
      const score = bx.n * bx.extent;
      if (score > bestScore) { bestScore = score; pick = i; }
    }
    if (pick < 0) break;                      // nothing left worth splitting
    const bx = boxes[pick];
    const sh = bx.shift;
    const sorted = [...bx.list].sort(
      (a, b) => (((a[0] >> sh) & 255) - ((b[0] >> sh) & 255)) || (a[0] - b[0]));
    const half = bx.n / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) { acc += sorted[i][1]; cut = i + 1; if (acc >= half) break; }
    boxes.splice(pick, 1, box(sorted.slice(0, cut)), box(sorted.slice(cut)));
  }

  const palette = boxes.map((bx) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const [k, c] of bx.list) { r += ((k >> 16) & 255) * c; g += ((k >> 8) & 255) * c; b += (k & 255) * c; n += c; }
    return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  });
  return { palette, distinct: colours.length };
}

const luma = (k) => 0.2126 * ((k >> 16) & 255) + 0.7152 * ((k >> 8) & 255) + 0.0722 * (k & 255);

// Map every pixel to its nearest palette entry. The palette is sorted by luma
// first: neighbouring indices then mean neighbouring colours, which is what
// makes the Sub/Up row filters below compress at all on an indexed image
// (a delta of 0 or 1 across a gradient instead of an arbitrary jump).
function toIndices(px, bpp, palette, width, height) {
  const pal = [...palette].sort((a, b) => luma(a) - luma(b) || a - b);
  const cache = new Map();
  const idx = Buffer.alloc(width * height);
  let worst = 0;
  for (let i = 0, j = 0; j < idx.length; i += bpp, j++) {
    const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    let v = cache.get(k);
    if (v === undefined) {
      const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
      let best = 0, bestD = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const q = pal[p];
        const d = (((q >> 16) & 255) - r) ** 2 + (((q >> 8) & 255) - g) ** 2 + ((q & 255) - b) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      v = best; cache.set(k, v);
      if (bestD > worst) worst = bestD;
    }
    idx[j] = v;
  }
  return { idx, pal, worstError: Math.sqrt(worst) };
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc >>> 0, 8 + data.length);
  return out;
}

function encodeIndexedPng(idx, pal, width, height) {
  // One filter per row, chosen by the sum-of-absolute-signed-differences
  // heuristic from the PNG spec. Paeth and Average are skipped: on an indexed
  // image they mix index values, which is meaningless, and they never win here.
  const rows = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    const src = idx.subarray(y * width, (y + 1) * width);
    const prev = y > 0 ? idx.subarray((y - 1) * width, y * width) : null;
    let sNone = 0, sSub = 0, sUp = 0;
    for (let i = 0; i < width; i++) {
      const n = src[i];
      sNone += n < 128 ? n : 256 - n;
      const s = (n - (i > 0 ? src[i - 1] : 0)) & 255;
      sSub += s < 128 ? s : 256 - s;
      if (prev) { const u = (n - prev[i]) & 255; sUp += u < 128 ? u : 256 - u; }
    }
    const f = !prev
      ? (sNone <= sSub ? 0 : 1)
      : (sNone <= sSub && sNone <= sUp ? 0 : (sSub <= sUp ? 1 : 2));
    const at = y * (width + 1);
    rows[at] = f;
    for (let i = 0; i < width; i++) {
      const n = src[i];
      rows[at + 1 + i] = f === 0 ? n : f === 1 ? (n - (i > 0 ? src[i - 1] : 0)) & 255 : (n - prev[i]) & 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 3;   // colour type: indexed
  const plte = Buffer.alloc(pal.length * 3);
  pal.forEach((k, i) => {
    plte[i * 3] = (k >> 16) & 255; plte[i * 3 + 1] = (k >> 8) & 255; plte[i * 3 + 2] = k & 255;
  });
  // Fixed parameters: zlib's output is only reproducible if every knob is.
  const idat = zlib.deflateSync(rows, {
    level: 9, memLevel: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY, windowBits: 15,
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function shrink(png) {
  const { width, height, bpp, px } = decodePng(png);
  if (width !== WIDTH || height !== HEIGHT) {
    throw new Error(`Chrome returned ${width}x${height}, expected ${WIDTH}x${HEIGHT}`);
  }
  const { palette, distinct } = medianCut(px, bpp, PALETTE_SIZE);
  const { idx, pal, worstError } = toIndices(px, bpp, palette, width, height);
  return { out: encodeIndexedPng(idx, pal, width, height), distinct, worstError };
}

// ─── What gets a card ────────────────────────────────────────────────────────
// The 143 blog posts and the 9 compare/solutions pages — every content URL on
// the site. Scope was settled by measurement, not by guessing: see the size
// report the run prints.
async function collectTargets() {
  const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');
  const { PAGE_MAP } = await import('../src/data/comparePages.ts');

  const targets = BLOG_POSTS.map((post) => ({
    file: `${post.slug}.png`,
    // Identical to server.js's `metaTitle` for this route, so the card's
    // headline and og:title cannot drift.
    title: post.seoTitle ?? post.title,
    tag: post.tag,
    meta: `${post.readingMinutes} min read`,
  }));

  for (const [path, load] of Object.entries(PAGE_MAP)) {
    const content = load();
    targets.push({
      // /compare/foo -> compare-foo.png, /solutions/bar -> solutions-bar.png
      file: `${path.replace(/^\//, '').replace(/\//g, '-')}.png`,
      title: content.title,
      tag: path.startsWith('/compare/') ? 'Comparison' : 'Guide',
      // These pages carry no reading time, so the eyebrow is the tag alone.
      meta: '',
    });
  }

  const seen = new Set();
  for (const t of targets) {
    if (seen.has(t.file)) throw new Error(`two pages want the same file: ${t.file}`);
    seen.add(t.file);
  }
  return targets;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const human = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
  : `${(bytes / 1024).toFixed(1)} KB`;

const targets = await collectTargets();
mkdirSync(OUT_DIR, { recursive: true });

const { child, wsUrl, profile } = await launchChrome();
const cdp = cdpClient(wsUrl);
const stats = {
  written: 0, unchanged: 0, stale: 0, rawTotal: 0, outTotal: 0,
  largest: { file: '', bytes: 0 }, smallestType: { file: '', size: Infinity },
  worstError: 0, mostColours: 0, oversize: [], overflowed: [],
};

try {
  const call = await openCard(cdp);
  for (const t of targets) {
    const { png, fit } = await renderOne(call, { title: t.title, tag: t.tag, meta: t.meta });
    const { out, distinct, worstError } = shrink(png);

    if (fit.overflow) stats.overflowed.push(t.file);
    if (fit.size < stats.smallestType.size) stats.smallestType = { file: t.file, size: fit.size };
    stats.rawTotal += png.length;
    stats.outTotal += out.length;
    stats.worstError = Math.max(stats.worstError, worstError);
    stats.mostColours = Math.max(stats.mostColours, distinct);
    if (out.length > stats.largest.bytes) stats.largest = { file: t.file, bytes: out.length };
    if (out.length > SIZE_BUDGET_BYTES) stats.oversize.push([t.file, out.length]);

    const dest = join(OUT_DIR, t.file);
    const current = existsSync(dest) ? readFileSync(dest) : null;
    if (current && current.equals(out)) { stats.unchanged++; continue; }
    if (CHECK_ONLY) {
      stats.stale++;
      console.error(`  ! out of date: public/og/${t.file}`);
      continue;
    }
    // Only touch a file when its bytes differ, so a no-op run leaves the
    // contents and the mtimes alone and `git status` stays clean.
    writeFileSync(dest, out);
    stats.written++;
  }
} finally {
  cdp.close();
  child.kill();
  rmSync(profile, { recursive: true, force: true });
}

// Anything in public/og that no page claims is a leftover from a renamed or
// deleted slug. Left in place it ships to production forever.
const expected = new Set(targets.map((t) => t.file));
const orphans = readdirSync(OUT_DIR).filter((f) => f.endsWith('.png') && !expected.has(f));
for (const f of orphans) {
  if (CHECK_ONLY) console.error(`  ! orphaned: public/og/${f}`);
  else { unlinkSync(join(OUT_DIR, f)); console.log(`  - removed orphan public/og/${f}`); }
}

const onDisk = readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.png'))
  .reduce((sum, f) => sum + statSync(join(OUT_DIR, f)).size, 0);

console.log(`\nog: ${targets.length} cards ${WIDTH}x${HEIGHT}`);
console.log(`    written ${stats.written} · unchanged ${stats.unchanged} · orphans removed ${CHECK_ONLY ? 0 : orphans.length}`);
console.log(`    on disk ${human(onDisk)} · mean ${human(stats.outTotal / targets.length)} · largest ${stats.largest.file} ${human(stats.largest.bytes)}`);
console.log(`    palette ${PALETTE_SIZE} saved ${human(stats.rawTotal - stats.outTotal)} (${(100 - 100 * stats.outTotal / stats.rawTotal).toFixed(0)}% of Chrome's truecolour output); worst channel error ${stats.worstError.toFixed(1)}/255 over ${stats.mostColours} distinct colours`);
console.log(`    smallest headline ${stats.smallestType.size}px (${stats.smallestType.file})`);
if (stats.oversize.length) {
  console.log(`    over the ${SIZE_BUDGET_BYTES / 1024} KB budget: ${stats.oversize.length}`);
  for (const [f, b] of stats.oversize.slice(0, 8)) console.log(`      ${f} ${human(b)}`);
}

if (stats.overflowed.length) {
  console.error(`\nog: ${stats.overflowed.length} headline(s) overflow the card even at the minimum size:`);
  for (const f of stats.overflowed) console.error(`  ! ${f}`);
  process.exit(1);
}
if (CHECK_ONLY && (stats.stale || orphans.length)) {
  console.error(`\nog: ${stats.stale} stale, ${orphans.length} orphaned. Run \`npm run og:generate\` and commit.`);
  process.exit(1);
}
