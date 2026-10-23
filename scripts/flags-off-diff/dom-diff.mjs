// usage: node scripts/flags-off-diff/dom-diff.mjs <domDir> <labelA> <labelB> <chromePort> [--json out.json]
// Compares two dom-snap.mjs results: body HTML, head HTML, network requests, sideways scroll, and the screenshots
// pixel by pixel (Chrome decodes both PNGs into canvases and counts the pixels that differ, with a bounding box).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CDP, launchChrome, openPage } from '../background-probe/cdp.mjs';
import { lineDiff } from './lib.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const jsonOut = ji >= 0 ? args.splice(ji, 2)[1] : null;
const [dir, la, lb, chromePort] = args;
const load = (l) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'));
const A = load(la), B = load(lb);
const file = (l, name, kind) => readFileSync(join(dir, l, `${name.replace(/[^a-z0-9-]+/gi, '_')}.${kind}.html`), 'utf8');

const chrome = await launchChrome({ port: Number(chromePort), headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;
const page = await openPage(cdp, 'about:blank');
async function pixelDiff(pa, pb) {
  const a = readFileSync(pa).toString('base64'), b = readFileSync(pb).toString('base64');
  return page.eval(`(async () => {
    const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
    const [x, y] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
    if (x.width !== y.width || x.height !== y.height) return { sizes: [x.width, x.height, y.width, y.height] };
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const p = px(x), q = px(y);
    let n = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2] || p[i + 3] !== q[i + 3]) {
        n++; const k = i / 4, cx = k % x.width, cy = (k / x.width) | 0;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      }
    }
    return { diffPixels: n, of: x.width * x.height, bbox: n ? [minX, minY, maxX, maxY] : null };
  })()`);
}

const rows = [];
try {
  for (const name of Object.keys(A.entries)) {
    const a = A.entries[name], b = B.entries[name];
    if (!b) { rows.push({ name, missing: lb }); continue; }
    const row = { name, body: a.bodyHash === b.bodyHash, head: a.headHash === b.headHash, title: a.title === b.title,
      noSideScroll: [a.noSideScroll, b.noSideScroll], localStorageKeys: JSON.stringify(a.localStorageKeys) === JSON.stringify(b.localStorageKeys) };
    if (!row.body) row.bodyDiff = lineDiff(file(la, name, 'body').replace(/></g, '>\n<'), file(lb, name, 'body').replace(/></g, '>\n<'), 6);
    if (!row.head) {
      row.headDiff = lineDiff(file(la, name, 'head').replace(/></g, '>\n<'), file(lb, name, 'head').replace(/></g, '>\n<'), 40);
      // WS6 added these tags to index.html with every flag off (docs/agents/ws6-notes.md, "Flags off, before and after" (1))
      const known = /apple-touch-icon|mobile-web-app|Added to a home screen|is read too since|Full-bleed icons|style \(dark text/;
      row.headOnlyWs6Tags = [...row.headDiff.removedSample, ...row.headDiff.addedSample].every((l) => known.test(l));
      if (row.headOnlyWs6Tags) row.head = true;   // counted as the same: the only difference is the documented one
    }
    // The landing page's screenshot carousel fetches its next image on a timer: the same build asks for
    // /shots/app-history-390.webp in some runs and not in others (A twice, B once, in three repeats). Not compared.
    const timing = (r) => /^GET \/shots\/app-.*\.webp$/.test(r);
    const ra = new Set(a.requests), rb = new Set(b.requests);
    row.requestsRemoved = a.requests.filter((r) => !rb.has(r) && !timing(r));
    row.requestsAdded = b.requests.filter((r) => !ra.has(r) && !timing(r));
    row.errorsOnlyInA = (a.errors ?? []).filter((e) => !(b.errors ?? []).includes(e));
    row.errorsOnlyInB = (b.errors ?? []).filter((e) => !(a.errors ?? []).includes(e));
    row.errorCount = [(a.errors ?? []).length, (b.errors ?? []).length];
    row.detecting = [a.detectingText, b.detectingText];
    row.pixels = a.shotHash === b.shotHash ? { diffPixels: 0 } : await pixelDiff(join(dir, la, a.shot), join(dir, lb, b.shot));
    rows.push(row);
  }
} finally { cdp.close(); chrome.close(); }

const clean = (r) => r.body && r.head && r.title && !r.requestsRemoved?.length && !r.requestsAdded?.length && r.pixels?.diffPixels === 0 && r.localStorageKeys
  && !r.errorsOnlyInA?.length && !r.errorsOnlyInB?.length;
console.log(`${la} vs ${lb}: ${rows.filter(clean).length} of ${rows.length} captures identical in body, head, requests and pixels`);
for (const r of rows) {
  if (r.missing) { console.log(`MISSING in ${r.missing}: ${r.name}`); continue; }
  console.log(`${clean(r) ? 'SAME     ' : 'DIFFERENT'}${r.headOnlyWs6Tags ? ' (head: only the WS6 home-screen tags)' : ''} ${r.name}${r.noSideScroll.every(Boolean) ? '' : '  SIDEWAYS SCROLL ' + JSON.stringify(r.noSideScroll)}`);
  if (clean(r)) continue;
  if (!r.body) { console.log(`   body: -${r.bodyDiff.removed} +${r.bodyDiff.added} lines`); r.bodyDiff.removedSample.forEach((l) => console.log('     - ' + l.slice(0, 200))); r.bodyDiff.addedSample.forEach((l) => console.log('     + ' + l.slice(0, 200))); }
  if (!r.head) { console.log(`   head: -${r.headDiff.removed} +${r.headDiff.added} lines`); r.headDiff.removedSample.forEach((l) => console.log('     - ' + l.slice(0, 200))); r.headDiff.addedSample.forEach((l) => console.log('     + ' + l.slice(0, 200))); }
  if (!r.title) console.log('   title differs');
  if (!r.localStorageKeys) console.log('   localStorage keys differ');
  if (r.requestsRemoved.length) console.log('   requests only in ' + la + ': ' + r.requestsRemoved.join(', '));
  if (r.requestsAdded.length) console.log('   requests only in ' + lb + ': ' + r.requestsAdded.join(', '));
  if (r.errorsOnlyInA.length) console.log('   console errors only in ' + la + ': ' + r.errorsOnlyInA.join(' || '));
  if (r.errorsOnlyInB.length) console.log('   console errors only in ' + lb + ': ' + r.errorsOnlyInB.join(' || '));
  if (r.pixels?.diffPixels !== 0) console.log('   pixels: ' + JSON.stringify(r.pixels));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ a: la, b: lb, rows }, null, 1));
process.exit(0);
