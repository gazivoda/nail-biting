// usage: node scripts/flags-off-diff/dom-snap.mjs <label> <checkoutRoot> <port> <chromePort> <outDir> [flags]
//
// Real headless Chrome (fake camera) against the real server.js of <checkoutRoot>, FEATURE_FLAGS empty unless given:
//   1. signed OUT: nine marketing pages at 1280 px (after React rendered them) and the landing page at 390 px
//   2. signed IN (a minted nh_session for the rig user): Watch, History and Settings at 1280 light, 1280 dark,
//      390 light and 390 dark
// For each it saves the body and head HTML (digits masked: times and counters depend on the clock), whether the page
// scrolls sideways (scrollWidth must equal innerWidth), the network requests the page made, and a PNG screenshot.
// Compare two labels with dom-diff.mjs. Service workers are bypassed; the cookie is only set for phase 2.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CDP, launchChrome, openPage, sleep } from '../background-probe/cdp.mjs';
import { normHashes, sha } from './lib.mjs';
import { startRigFrom } from './rig.mjs';

const [label, root, portArg, chromePortArg, outDir, flags = ''] = process.argv.slice(2);
const port = Number(portArg), chromePort = Number(chromePortArg);
const dir = join(outDir, label);
mkdirSync(dir, { recursive: true });

const PAGES = ['/', '/how-it-works', '/pricing', '/about', '/blog', '/blog/how-to-stop-nail-biting', '/compare/ai-detection-apps',
  '/solutions/for-adhd', '/privacy', '/tools/nail-growth-timeline-calculator'];
const mask = (s) => normHashes(s).replace(/\d+/g, '0').replace(/blob:[^"')\s]+/g, 'blob:x').replace(new RegExp(`localhost:${port}`, 'g'), 'localhost:PORT');

const rig = await startRigFrom({ root, port, flags });
const chrome = await launchChrome({ port: chromePort, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;
const entries = {};
try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setBypassServiceWorker', { bypass: true });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}` });
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  let requests = [], errors = [];
  cdp.on((m) => {
    if (m.sessionId !== page.sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text.slice(0, 160) + ' ' + normHashes(m.params.entry.url ?? ''));
  });
  cdp.on((m) => {
    if (m.method === 'Network.requestWillBeSent' && m.sessionId === page.sessionId) {
      const u = new URL(m.params.request.url);
      const own = u.origin === new URL(rig.url).origin;
      requests.push(own ? `${m.params.request.method} ${u.pathname}` : `EXTERNAL ${u.host}`);
    }
  });

  async function viewport(width, height, dark) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: width < 500 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  async function capture(name, extra = {}) {
    const info = await page.eval(`(() => ({
      body: document.body.innerHTML, head: document.head.innerHTML, title: document.title,
      innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, path: location.pathname + location.search,
      ls: Object.keys(localStorage).sort(),
    }))()`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(shot.data, 'base64');
    mkdirSync(join(dir, 'shots'), { recursive: true });
    const file = name.replace(/[^a-z0-9-]+/gi, '_');
    writeFileSync(join(dir, 'shots', `${file}.png`), png);
    const body = mask(info.body), head = mask(info.head);
    writeFileSync(join(dir, `${file}.body.html`), body);
    writeFileSync(join(dir, `${file}.head.html`), head);
    entries[name] = {
      title: info.title, path: info.path, bodyHash: sha(body), headHash: sha(head), bodyLength: body.length,
      innerWidth: info.innerWidth, scrollWidth: info.scrollWidth, noSideScroll: info.scrollWidth <= info.innerWidth,
      localStorageKeys: info.ls, requests: [...new Set(requests.map(normHashes))].sort(), rawRequests: [...new Set(requests)].sort(), shot: `shots/${file}.png`, shotHash: sha(png), errors: [...new Set(errors.map(mask))].sort(), ...extra,
    };
    requests = []; errors = [];
  }

  // 1. signed out
  await page.send('Network.clearBrowserCookies');
  await viewport(1280, 900, false);
  for (const p of PAGES) {
    requests = [];
    await page.send('Page.navigate', { url: rig.url + p });
    await sleep(3500);
    await capture(`out ${p} 1280`);
  }
  await viewport(390, 844, false);
  requests = [];
  await page.send('Page.navigate', { url: rig.url + '/' });
  await sleep(3500);
  await capture('out / 390');

  // 2. signed in (DOM_ONLY=out skips this: used to repeat the signed-out captures when a difference looks like timing)
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  for (const [name, width, height, dark] of process.env.DOM_ONLY === 'out' ? [] : [['1280 light', 1280, 900, false], ['1280 dark', 1280, 900, true], ['390 light', 390, 844, false], ['390 dark', 390, 844, true]]) {
    await viewport(width, height, dark);
    requests = [];
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(7000);   // app shell, flags, models and the first frames
    for (const tab of ['Watch', 'History', 'Settings']) {
      await page.eval(`(() => { const b = [...document.querySelectorAll('nav button')].find((x) => x.innerText.trim() === ${JSON.stringify(tab)}); if (b) b.click(); })()`, { userGesture: true });
      await sleep(2500);
      await capture(`in ${name} ${tab}`);
    }
  }

  // 3. detection running (fake camera, the real MediaPipe models): the loop WS7a touched. 1280 light, Watch tab.
  // The camera picture is a moving test pattern, so video and canvas are hidden for the screenshot (DOM is unaffected).
  if (process.env.DOM_ONLY !== 'out') {
    await viewport(1280, 900, false);
    requests = []; errors = [];
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(6000);
    await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Start detection'); if (b) b.click(); })()`, { userGesture: true });
    await sleep(15000);   // permission (auto-granted), camera, WASM, models, first frames
    await page.eval(`(() => { const s = document.createElement('style'); s.id = 'ws13-hide'; s.textContent = 'video, canvas { visibility: hidden !important; }'; document.head.appendChild(s); })()`);
    await capture('in 1280 light Watch detecting', { detectingText: await page.eval(`/Detection active/.test(document.body.innerText)`) });
    await page.eval(`(() => { document.getElementById('ws13-hide')?.remove(); const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Stop'); if (b) b.click(); })()`, { userGesture: true });
    await sleep(2000);
    await capture('in 1280 light Watch stopped', { detectingText: await page.eval(`/Detection active/.test(document.body.innerText)`) });
  }
} finally {
  cdp.close(); chrome.close();
  const tail = rig.log().split('\n').filter((l) => /error|warn/i.test(l)).slice(0, 6).join('\n');
  if (tail) console.log('server log (filtered):\n' + tail);
  rig.stop();
}
writeFileSync(join(outDir, `${label}.json`), JSON.stringify({ label, root, flags, entries }, null, 1));
console.log(`${label}: ${Object.keys(entries).length} captures; sideways scroll on: ${Object.entries(entries).filter(([, e]) => !e.noSideScroll).map(([n]) => n).join(', ') || 'none'}`);
process.exit(0);
