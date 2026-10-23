// usage: node scripts/background-probe/dom-compare.mjs <port> <distA> <distB> [flags]
//
// "Nothing changes with the flag off": loads the signed-in app from two builds (same throwaway user, same fake camera,
// same flags), captures the page's HTML on the Watch, History and Settings tabs at desktop and phone width, light and
// dark, with digits masked (times and counters depend on the clock), and compares. Prints SAME or the first difference.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchChrome, CDP, openPage, sleep } from './cdp.mjs';
import { startRig } from './rig.mjs';

const [portArg, distA, distB, flags = ''] = process.argv.slice(2);
const port = Number(portArg);

async function capture(dist, portN) {
  const rig = await startRig({ dist, port: portN, flags });
  const chrome = await launchChrome({ port: portN + 1000, headless: 'new' });
  const cdp = new CDP(chrome.wsUrl);
  await cdp.ready;
  const out = {};
  try {
    const page = await openPage(cdp, 'about:blank');
    await page.send('Network.enable');
    await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
    await page.send('Page.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}` });
    for (const [name, width, height, dark] of [['desktop-light', 1280, 900, false], ['desktop-dark', 1280, 900, true], ['phone-light', 390, 844, false]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await page.send('Page.navigate', { url: rig.url + '/' });
      await sleep(7000); // app shell, flags, models and the first frames
      for (const tab of ['Watch', 'History', 'Settings']) {
        await page.eval(`(() => { const b = [...document.querySelectorAll('nav button')].find((x) => x.innerText.trim() === ${JSON.stringify(tab)}); if (b) b.click(); })()`, { userGesture: true });
        await sleep(1500);
        const html = await page.eval('document.body.innerHTML');
        out[`${name}/${tab}`] = html.replace(/\d+/g, '0').replace(/blob:[^"']+/g, 'blob:x');
      }
    }
  } finally {
    cdp.close(); chrome.close(); rig.stop();
  }
  return out;
}

const a = await capture(distA, port);
const b = await capture(distB, port + 10);
const outDir = join(tmpdir(), 'ws7a-dom'); // differences are written here, not into the repo
mkdirSync(outDir, { recursive: true });
let same = true;
for (const key of Object.keys(a)) {
  const x = a[key], y = b[key];
  if (x === y) { console.log('SAME     ', key, `(${x.length} chars)`); continue; }
  same = false;
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  console.log('DIFFERENT', key, 'at', i, '\n  A:', x.slice(Math.max(0, i - 80), i + 120), '\n  B:', y.slice(Math.max(0, i - 80), i + 120));
  writeFileSync(join(outDir, key.replace('/', '-') + '.A.html'), x);
  writeFileSync(join(outDir, key.replace('/', '-') + '.B.html'), y);
}
console.log(same ? 'ALL SAME' : 'DIFFERENCES FOUND');
process.exit(0);
