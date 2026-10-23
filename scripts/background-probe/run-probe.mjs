// usage: node run-probe.mjs <plain|camera|camerapip|audio> <port> <visibleSec> <hiddenSec> <backVisibleSec>
// Serves site/probe.html on <port>, runs it in headless Chrome with a fake camera, hides the tab by opening a second
// tab, and counts ticks per second from several candidate tick sources. Result: <RESULTS_DIR>/probe-<variant>.json
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SP, HERE, launchChrome, CDP, openPage, sleep } from './cdp.mjs';

const [variant, portArg, visArg, hidArg, backArg] = process.argv.slice(2);
const port = Number(portArg);
const VIS = Number(visArg), HID = Number(hidArg), BACK = Number(backArg ?? 0);

const site = join(HERE, 'site');
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/' ? 'probe.html' : p.slice(1);
  try {
    const body = readFileSync(join(site, file));
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(body);
  } catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;

const query = { plain: '', camera: 'camera=1', camerapip: 'camera=1', audio: 'camera=1&audio=1' }[variant];
const a = await openPage(cdp, `http://localhost:${port}/?${query}`);
await sleep(1500);
const result = { variant, browser: chrome.version, startedAt: new Date().toISOString(), VIS, HID, BACK, checkpoints: [], events: [] };
result.info = await a.eval('JSON.stringify(window.__info)');

if (variant === 'camerapip') {
  const r = await a.eval(`(async () => { try { const w = await window.documentPictureInPicture.requestWindow({ width: 240, height: 64 }); window.__pip = w; w.document.body.textContent = 'pip'; return 'ok'; } catch (e) { return String(e); } })()`, { userGesture: true });
  result.events.push({ at: 'pip-open', r });
}

const t0 = Date.now();
const since = () => ((Date.now() - t0) / 1000).toFixed(1);
console.log(variant, 'visible phase', VIS, 's');
await sleep(VIS * 1000);
const visEnd = await a.eval('performance.now() - window.__t0');
result.visibleEndMs = visEnd;
result.visBefore = await a.eval('document.visibilityState');

// hide: a second tab in the same window takes the foreground
const keeper = await openPage(cdp, 'about:blank');
await sleep(300);
const hideAtPageMs = await a.eval('performance.now() - window.__t0');
result.hiddenAtMs = hideAtPageMs;
result.visHidden = await a.eval('document.visibilityState');
result.pipOpen = await a.eval('window.__pip ? !window.__pip.closed : false');
console.log(variant, 'hidden =', result.visHidden, 'pip =', result.pipOpen, 'at', since());

const cpuOf = async () => {
  const r = await cdp.send('SystemInfo.getProcessInfo');
  return r.processInfo.map((p) => ({ type: p.type, id: p.id, cpu: p.cpuTime }));
};

const hiddenStart = Date.now();
while (Date.now() - hiddenStart < HID * 1000) {
  await sleep(Math.min(60000, HID * 1000 - (Date.now() - hiddenStart)));
  const cp = { hiddenSec: Math.round((Date.now() - hiddenStart) / 1000) };
  try {
    cp.vis = await a.eval('document.visibilityState');
    cp.frames = await a.eval(`(() => { const v = document.getElementById('v'); if (!v || !v.srcObject) return null; return { total: v.getVideoPlaybackQuality().totalVideoFrames, t: v.currentTime }; })()`);
  } catch (e) { cp.err = String(e); }
  result.checkpoints.push(cp);
  console.log(variant, 'checkpoint', JSON.stringify(cp), 'at', since());
}

if (BACK > 0) {
  await cdp.send('Target.activateTarget', { targetId: a.targetId });
  await sleep(500);
  result.visBack = await a.eval('document.visibilityState');
  await sleep(BACK * 1000);
}

result.backMs = await a.eval('performance.now() - window.__t0');
result.buckets = await a.eval('JSON.stringify(window.__buckets)').then(JSON.parse);
result.finalInfo = await a.eval('JSON.stringify(window.__info)');

// windows (seconds since hide) -> rate per second of every counter
const hideSec = result.hiddenAtMs / 1000;
const hiddenLen = (result.backMs / 1000) - hideSec - BACK;
const windows = [[-30, 0], [0, 10], [10, 60], [60, 180], [180, 300], [300, 360], [360, 480], [480, 600], [600, 660], [660, 760]]
  .filter(([s]) => s < Math.max(hiddenLen, 1))
  .map(([s, e]) => [Math.max(s, -(hideSec - 3)), Math.min(e, hiddenLen)]);
const rows = [];
for (const [s, e] of windows) {
  const row = { window: `${s.toFixed(0)}..${e.toFixed(0)}s` };
  for (const [name, b] of Object.entries(result.buckets)) {
    let n = 0;
    for (const [sec, cnt] of Object.entries(b)) {
      const rel = Number(sec) - hideSec;
      if (rel >= s && rel < e) n += cnt;
    }
    row[name] = +(n / (e - s)).toFixed(2);
  }
  rows.push(row);
}
result.table = rows;
delete result.buckets; // raw per-second counts are large; the table keeps the rates
writeFileSync(join(SP, `probe-${variant}.json`), JSON.stringify(result, null, 1));
console.log(JSON.stringify(rows, null, 1));
cdp.close();
chrome.close();
server.close();
process.exit(0);
