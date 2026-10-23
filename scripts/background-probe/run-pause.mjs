// usage: node scripts/background-probe/run-pause.mjs <port> <distDir>      (a probe build: VITE_WS7A_PROBE=1)
//
// Pause, resume, meeting mode and reload, driven through the real UI and the real desktop-command event in headless
// Chrome with a fake camera, against the real app. Result: <RESULTS_DIR>/pause-scenarios.json
//   1. UI: "15 minutes" -> camera released, no more detection steps, panel says "Paused until"; reload -> still paused,
//      camera not opened; "Resume now" -> detection steps again.
//   2. expired pause on load: a stored pause whose end is in the past is cleared by the reload.
//   3. desktop command while the tab is HIDDEN: pause 1 minute, wait, it ends by itself on time (the tray's path).
//   4. meeting mode: an alarm is logged, with no sound and no notification; after "End meeting mode" it sounds.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SP, launchChrome, CDP, openPage, sleep } from './cdp.mjs';
import { startRig } from './rig.mjs';

const [portArg, distDir] = process.argv.slice(2);
const port = Number(portArg);

const PROBE = `(() => {
  const T0 = performance.now(); window.__t0 = T0; const B = window.__b = {};
  const bump = (n) => { const s = Math.floor((performance.now() - T0) / 1000); (B[n] ??= {})[s] = (B[n][s] ?? 0) + 1; };
  const hook = (proto, name) => { const o = proto[name]; proto[name] = function (...a) { if (a[a.length - 1] instanceof HTMLVideoElement) bump('texVideo'); return o.apply(this, a); }; };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { hook(C.prototype, 'texImage2D'); hook(C.prototype, 'texSubImage2D'); }
  // sound: every alarm creates an AudioContext; a notification is a Notification
  window.__audio = 0; window.__notifs = 0;
  const A = window.AudioContext; window.AudioContext = function (...a) { window.__audio++; return new A(...a); }; window.AudioContext.prototype = A.prototype;
  const N = window.Notification; if (N) { window.Notification = function (...a) { window.__notifs++; return new N(...a); }; window.Notification.prototype = N.prototype; window.Notification.requestPermission = N.requestPermission.bind(N); Object.defineProperty(window.Notification, 'permission', { get: () => N.permission }); }
  try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}
})();`;

const results = { startedAt: new Date().toISOString(), scenarios: {} };
const rig = await startRig({ dist: distDir, port, flags: 'background_watching' });
const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;
results.browser = chrome.version;

const steps = (page) => page.eval('Object.values(window.__b.texVideo || {}).reduce((a, b) => a + b, 0) / 2');
const hasCamera = (page) => page.eval(`(() => { const v = document.querySelector('video'); return !!(v && v.srcObject && v.srcObject.getVideoTracks().some((t) => t.readyState === 'live')); })()`);
const body = (page) => page.eval('document.body.innerText');
const clickText = (page, text) => page.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
async function stepsOver(page, ms) { const a = await steps(page); await sleep(ms); return (await steps(page)) - a; }
async function waitFor(fn, ms = 20000, every = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await sleep(every); } return null; }
async function load(page) {
  await page.send('Page.navigate', { url: rig.url + '/' });
  await waitFor(async () => { try { return (await steps(page)) > 5; } catch { return false; } }, 60000);
}
async function injectAlarm(page, ms = 4000) {
  const before = await page.eval(`(() => { window.__alarmLog ??= []; if (!window.__obs) { window.__obs = true; new MutationObserver(() => { if (document.title.startsWith('\\u26a0')) window.__alarmLog.push(performance.now()); }).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true }); } window.__n0 = window.__alarmLog.length; window.__a0 = window.__audio; window.__i0 = (JSON.parse(localStorage.getItem('stop-biting-state') || '{}').state?.incidents || []).length; window.__sbProbe.inject = true; return 1; })()`);
  void before;
  await sleep(ms);
  const r = await page.eval(`(() => { window.__sbProbe.inject = false; return { alarms: window.__alarmLog.length - window.__n0, audioContexts: window.__audio - window.__a0, notifications: window.__notifs, logged: (JSON.parse(localStorage.getItem('stop-biting-state') || '{}').state?.incidents || []).length - window.__i0 }; })()`);
  await sleep(2500);
  return r;
}

try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  await cdp.send('Browser.grantPermissions', { origin: rig.url, permissions: ['videoCapture'] });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  await load(page);
  await sleep(3000);
  results.permission = await page.eval(`navigator.permissions.query({ name: 'camera' }).then((s) => s.state)`);

  // 1. UI pause, reload, resume
  const s1 = {};
  s1.stepsBefore = await stepsOver(page, 4000);
  s1.cameraBefore = await hasCamera(page);
  s1.clicked = await clickText(page, '15 minutes');
  await sleep(2500);
  s1.cameraDuringPause = await hasCamera(page);
  s1.stepsDuringPause_10s = await stepsOver(page, 10000);
  s1.panelSaysPaused = /Paused until/.test(await body(page));
  s1.stored = await page.eval(`localStorage.getItem('sb:background:state')`);
  s1.trayState = 'n/a (browser)';
  await load(page); // reload while paused
  await sleep(4000);
  s1.afterReload = { stepsIn6s: await stepsOver(page, 6000), camera: await hasCamera(page), panelSaysPaused: /Paused until/.test(await body(page)) };
  s1.resumeClicked = await clickText(page, 'Resume now');
  s1.resumedAfterMs = await waitFor(async () => (await stepsOver(page, 1500)) > 3, 30000, 100);
  s1.cameraAfterResume = await hasCamera(page);
  s1.storedAfterResume = await page.eval(`localStorage.getItem('sb:background:state')`);
  results.scenarios.uiPauseReloadResume = s1;
  console.log('1', JSON.stringify(s1));

  // 2. expired pause on load
  await page.eval(`localStorage.setItem('sb:background:state', JSON.stringify({ v: 1, pausedUntil: Date.now() - 1000, meetingUntil: null }))`);
  await load(page);
  await sleep(3000);
  const s2 = { stepsIn5s: await stepsOver(page, 5000), camera: await hasCamera(page), panelSaysPaused: /Paused until/.test(await body(page)), stored: await page.eval(`localStorage.getItem('sb:background:state')`) };
  results.scenarios.expiredPauseOnLoad = s2;
  console.log('2', JSON.stringify(s2));

  // 3. desktop command while hidden: pause 1 minute, ends by itself
  const s3 = {};
  await page.eval(`window.dispatchEvent(new CustomEvent('stopbiting:desktop-command', { detail: { type: 'pause', minutes: 1 }, cancelable: true }))`);
  await sleep(2500);
  const until = JSON.parse(await page.eval(`localStorage.getItem('sb:background:state')`) || 'null')?.pausedUntil;
  s3.pausedUntilStored = !!until;
  s3.cameraWhilePaused = await hasCamera(page);
  const keeper = await openPage(cdp, 'about:blank'); // the app tab is now hidden
  await sleep(500);
  s3.visibility = await page.eval('document.visibilityState');
  const tEnd = until;
  let resumedAt = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    await sleep(1000);
    const st = JSON.parse((await page.eval(`localStorage.getItem('sb:background:state')`)) || 'null');
    if (!st || !st.pausedUntil) { resumedAt = Date.now(); break; }
  }
  s3.resumedLateByMs = resumedAt && tEnd ? resumedAt - tEnd : null;
  await sleep(6000);
  s3.cameraAfter = await hasCamera(page);
  s3.stepsIn5sAfterResume = await stepsOver(page, 5000);
  results.scenarios.desktopPauseWhileHidden = s3;
  console.log('3', JSON.stringify(s3));
  await cdp.send('Target.activateTarget', { targetId: page.targetId });
  void keeper;
  await sleep(1500);

  // 4. meeting mode: logged, silent; then sounds again
  const s4 = {};
  // The store merges alarms less than 30 s apart into one episode (ARCHITECTURE section 2), so each alarm waits 31 s.
  s4.control = await injectAlarm(page); // running: sounds
  s4.meetingClicked = await clickText(page, '30 minutes');
  await sleep(31000);
  s4.panelSaysMeeting = /Meeting mode until/.test(await body(page));
  s4.inMeeting = await injectAlarm(page); // silent: logged, no AudioContext
  s4.endClicked = await clickText(page, 'End meeting mode');
  await sleep(31000);
  s4.afterMeeting = await injectAlarm(page);
  results.scenarios.meetingMode = s4;
  console.log('4', JSON.stringify(s4));
} catch (e) {
  results.error = String(e?.stack ?? e);
  console.error('FAILED', results.error);
} finally {
  writeFileSync(join(SP, 'pause-scenarios.json'), JSON.stringify(results, null, 1) + '\n');
  cdp.close();
  chrome.close();
  rig.stop();
  process.exit(0);
}
