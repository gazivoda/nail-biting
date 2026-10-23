// usage: node scripts/background-probe/run-app.mjs <label> <port> <hidden|pip> <visibleSec> <hiddenSec> <backSec> <distDir> [flags]
//
// Runs the REAL signed-in app (a built dist/ behind a throwaway copy of server.js, see rig.mjs) in headless Chrome
// with a fake camera, lets detection settle, hides the tab (a second tab takes the foreground), optionally with
// the app's own "Minimize" Document Picture-in-Picture window open, and counts what the browser really did:
//   texVideo  video frames handed to MediaPipe (2 per detection step: hand + face), hooked on WebGL texImage2D
//   iv100     a plain 100 ms setInterval on the page's main thread
//   raf       requestAnimationFrame callbacks
// plus the CPU time of the browser's processes in each phase. Result: <RESULTS_DIR>/app-<label>.json
//
// With a probe build (VITE_WS7A_PROBE=1, src/background/probeHook.ts) it can also make the detector see a hand on
// the mouth and time the real alarm (the tab title changes when the alarm starts):
//   INJECT_VISIBLE=1        once, while the tab is visible
//   INJECT_AT=20,650        and at these seconds after the tab was hidden
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SP, launchChrome, CDP, openPage, sleep } from './cdp.mjs';
import { startRig } from './rig.mjs';

const [label, portArg, mode, visArg, hidArg, backArg, distDir, flags = ''] = process.argv.slice(2);
const port = Number(portArg);
const VIS = Number(visArg), HID = Number(hidArg), BACK = Number(backArg);
const INJECT_VISIBLE = process.env.INJECT_VISIBLE === '1';
const INJECT_AT = (process.env.INJECT_AT ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);

const PROBE = `(() => {
  const T0 = performance.now(); window.__t0 = T0; const B = window.__b = {};
  const bump = (n) => { const s = Math.floor((performance.now() - T0) / 1000); (B[n] ??= {})[s] = (B[n][s] ?? 0) + 1; };
  setInterval(() => bump('iv100'), 100);
  (function raf() { bump('raf'); requestAnimationFrame(raf); })();
  const hook = (proto, name, pick) => { const o = proto[name]; proto[name] = function (...a) { if (pick(a) instanceof HTMLVideoElement) bump('texVideo'); return o.apply(this, a); }; };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { hook(C.prototype, 'texImage2D', (a) => a[a.length - 1]); hook(C.prototype, 'texSubImage2D', (a) => a[a.length - 1]); }
  hook(CanvasRenderingContext2D.prototype, 'drawImage', (a) => a[0]);
  try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}
})();`;

const rig = await startRig({ dist: distDir, port, flags });
const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;
const result = { label, mode, flags, browser: chrome.version, startedAt: new Date().toISOString(), VIS, HID, BACK, checkpoints: [], cpu: {}, alarms: [] };

async function cpuNow() {
  const r = await cdp.send('SystemInfo.getProcessInfo');
  const sum = {};
  for (const p of r.processInfo) sum[p.type] = (sum[p.type] ?? 0) + p.cpuTime;
  return { at: Date.now(), sum };
}
function cpuDelta(a, b) {
  const secs = (b.at - a.at) / 1000;
  const out = { seconds: +secs.toFixed(1) };
  for (const k of new Set([...Object.keys(a.sum), ...Object.keys(b.sum)])) out[k] = +(((b.sum[k] ?? 0) - (a.sum[k] ?? 0)) / secs * 100).toFixed(1);
  return out;
}

async function injectOnce(page, tag) {
  const started = await page.eval(`(() => {
    if (!window.__sbProbe) return null;
    if (!window.__alarmLog) {
      window.__alarmLog = [];
      new MutationObserver(() => { if (document.title.startsWith('\u26a0')) window.__alarmLog.push(performance.now()); })
        .observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
    }
    window.__before = window.__alarmLog.length;
    window.__incidentsBefore = (JSON.parse(localStorage.getItem('stop-biting-state') || '{}').state?.incidents || []).length;
    window.__injectAt = performance.now();
    window.__sbProbe.inject = true;
    return window.__injectAt;
  })()`);
  if (started === null) { result.alarms.push({ tag, error: 'no probe in this build' }); return; }
  await sleep(6000);
  const r = await page.eval(`(() => {
    const first = window.__alarmLog.slice(window.__before)[0];
    window.__sbProbe.inject = false;
    const incidents = (JSON.parse(localStorage.getItem('stop-biting-state') || '{}').state?.incidents || []).length;
    return { latencyMs: first === undefined ? null : +(first - window.__injectAt).toFixed(0), logged: incidents - window.__incidentsBefore, vis: document.visibilityState };
  })()`);
  result.alarms.push({ tag, ...r });
  console.log(label, 'alarm', JSON.stringify({ tag, ...r }));
  await sleep(4000); // the hand is gone: let the alarm end before the next measurement
}

try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  await page.send('Page.navigate', { url: rig.url + '/' });

  // wait until MediaPipe is being fed frames
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    await sleep(1000);
    try { ready = (await page.eval('(window.__b && window.__b.texVideo && Object.keys(window.__b.texVideo).length) || 0')) > 3; } catch { /* navigating */ }
  }
  if (!ready) {
    result.failure = await page.eval('document.body.innerText.slice(0, 400)').catch((e) => String(e));
    throw new Error('detection never started: ' + result.failure);
  }
  result.startedDetectionAfterMs = await page.eval('performance.now() - window.__t0');

  // visible phase: 10 s of warm-up, then measure
  await sleep(10000);
  const c0 = await cpuNow();
  await sleep(Math.max(1000, (VIS - 10) * 1000));
  const c1 = await cpuNow();
  result.cpu.visible = cpuDelta(c0, c1);
  if (INJECT_VISIBLE) await injectOnce(page, 'visible');

  if (mode === 'pip') {
    result.pipRequest = await page.eval(`(() => { const b = document.querySelector('button[title^="Float"]'); if (!b) return 'no minimize button'; b.click(); return 'clicked'; })()`, { userGesture: true });
    await sleep(1500);
    result.pipOpen = await page.eval('!!(window.documentPictureInPicture && window.documentPictureInPicture.window)');
  }

  await openPage(cdp, 'about:blank'); // takes the foreground; the app tab is now hidden
  await sleep(300);
  result.hiddenAtMs = await page.eval('performance.now() - window.__t0');
  result.visHidden = await page.eval('document.visibilityState');
  const hiddenStart = Date.now();
  let cpuMark = await cpuNow();
  let firstWindowDone = false;
  let nextCheckpoint = 30;
  let injectIdx = 0;
  while (Date.now() - hiddenStart < HID * 1000) {
    await sleep(1000);
    const t = Math.round((Date.now() - hiddenStart) / 1000);
    if (injectIdx < INJECT_AT.length && t >= INJECT_AT[injectIdx]) {
      await injectOnce(page, `hidden+${INJECT_AT[injectIdx]}s`);
      injectIdx++;
      continue;
    }
    if (t < nextCheckpoint) continue;
    nextCheckpoint = t + 30;
    const cp = { hiddenSec: t };
    try {
      cp.vis = await page.eval('document.visibilityState');
      cp.video = await page.eval(`(() => { const v = document.querySelector('video'); return v && v.srcObject ? { frames: v.getVideoPlaybackQuality().totalVideoFrames, t: +v.currentTime.toFixed(2) } : null; })()`);
      // are the frames in a hidden tab really new? hash a tiny copy of the picture twice, 1.2 s apart
      cp.fresh = await page.eval(`(async () => {
        const v = document.querySelector('video'); if (!v || !v.srcObject) return null;
        const c = document.createElement('canvas'); c.width = 32; c.height = 24; const g = c.getContext('2d', { willReadFrequently: true });
        const hash = () => { g.drawImage(v, 0, 0, 32, 24); const d = g.getImageData(0, 0, 32, 24).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0; return h; };
        const a = hash(); await new Promise((r) => setTimeout(r, 1200)); return a !== hash();
      })()`);
    } catch (e) { cp.err = String(e); }
    result.checkpoints.push(cp);
    if (!firstWindowDone && cp.hiddenSec >= 60) { result.cpu.hiddenFirstMinute = cpuDelta(cpuMark, await cpuNow()); firstWindowDone = true; cpuMark = await cpuNow(); }
    console.log(label, 'checkpoint', JSON.stringify(cp));
  }
  result.cpu.hiddenRest = cpuDelta(cpuMark, await cpuNow());

  if (BACK > 0) {
    await cdp.send('Target.activateTarget', { targetId: page.targetId });
    await sleep(500);
    result.visBack = await page.eval('document.visibilityState');
    await sleep(BACK * 1000);
  }
  result.endMs = await page.eval('performance.now() - window.__t0');
  const buckets = JSON.parse(await page.eval('JSON.stringify(window.__b)'));

  const hideSec = result.hiddenAtMs / 1000;
  const hiddenLen = result.endMs / 1000 - hideSec - BACK;
  const windows = [[-30, 0], [0, 10], [10, 60], [60, 180], [180, 300], [300, 360], [360, 480], [480, 600], [600, 660], [660, 760]]
    .filter(([s]) => s < Math.max(hiddenLen, 1))
    .map(([s, e]) => [Math.max(s, -(hideSec - 12)), Math.min(e, hiddenLen)]);
  result.table = windows.map(([s, e]) => {
    const row = { window: `${s.toFixed(0)}..${e.toFixed(0)}s` };
    for (const [name, b] of Object.entries(buckets)) {
      let n = 0;
      for (const [sec, cnt] of Object.entries(b)) { const rel = Number(sec) - hideSec; if (rel >= s && rel < e) n += cnt; }
      row[name === 'texVideo' ? 'stepsPerSec' : name] = +((name === 'texVideo' ? n / 2 : n) / (e - s)).toFixed(2);
    }
    return row;
  });
  // longest silence between two frames handed to MediaPipe while hidden
  const secs = Object.keys(buckets.texVideo ?? {}).map(Number).filter((s) => s - hideSec >= 0 && s - hideSec < hiddenLen).sort((a, b) => a - b);
  let gap = 0; for (let i = 1; i < secs.length; i++) gap = Math.max(gap, secs[i] - secs[i - 1]);
  result.longestSecondsWithoutAStepWhileHidden = secs.length ? Math.max(gap, secs[0] - hideSec, hiddenLen - secs[secs.length - 1]) : null;
  console.log(JSON.stringify(result.table, null, 1));
  console.log(JSON.stringify(result.cpu));
} catch (e) {
  result.error = String(e?.stack ?? e);
  console.error(label, 'FAILED', result.error);
} finally {
  writeFileSync(join(SP, `app-${label}.json`), JSON.stringify(result, null, 1) + '\n');
  cdp.close();
  chrome.close();
  rig.stop();
  process.exit(0);
}
