// usage: node scripts/i18n/dom-probe/compare.mjs <port> <distMain> <distThis> [flags] [outDir]
//
// "With every locale flag off the app is byte-identical to main" (WS12a). Loads the signed-in app from two builds (main's
// and this branch's) behind the real server, same throwaway user, same fake camera, same feature flags (pass the
// non-locale flags to also compare the new cards), and compares the page HTML on Watch, History, History > Insights,
// Settings and the voluntary upgrade page, at 1280 px (light and dark) and 390 px, plus the sign-in page. Digits are masked
// (clocks and counters), nothing else. Prints SAME or the first difference per screen. Differences are written to outDir.
//
// A language is never picked here, so this proves the English path. (The language itself is checked by layout.mjs and
// by the pseudo-locale tests.)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchChrome, CDP, openPage, sleep } from '../../background-probe/cdp.mjs';
import { startRig } from '../../background-probe/rig.mjs';

const [portArg, distMain, distThis, flags = '', outDirArg] = process.argv.slice(2);
const port = Number(portArg);
const outDir = outDirArg ?? join(tmpdir(), 'ws12a-dom');
mkdirSync(outDir, { recursive: true });

const mask = (html) => html.replace(/\d+/g, '0').replace(/blob:[^"']+/g, 'blob:x').replace(/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{6,}\.(js|css)/g, 'assets/x.$1').replace(/ref=[A-Z0-9]+/g, 'ref=X');

async function clickTab(page, label) {
  await page.eval(`(() => { const b = [...document.querySelectorAll('nav button')].find((x) => x.innerText.trim() === ${JSON.stringify(label)}); if (b) b.click(); })()`, { userGesture: true });
  await sleep(1500);
}
async function clickText(page, text) {
  return page.eval(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
}

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
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await page.send('Page.navigate', { url: rig.url + '/' });
      await sleep(8000); // app shell, flags, models and the first frames
      for (const tab of ['Watch', 'History', 'Settings']) {
        await clickTab(page, tab);
        out[`${name}/${tab}`] = mask(await page.eval('document.body.innerHTML'));
        if (tab === 'History') {
          // the Insights view, when its switch exists (flag insights)
          if (await clickText(page, 'Insights')) {
            await sleep(2500);
            out[`${name}/History-Insights`] = mask(await page.eval('document.body.innerHTML'));
            await clickText(page, 'History');
          }
        }
      }
      // the voluntary upgrade page (the paywall) from the tab bar
      await clickTab(page, 'Watch');
      if ((await clickText(page, 'Upgrade')) || (await clickText(page, 'See plans')) || (await clickText(page, 'Plans'))) {
        await sleep(2500);
        out[`${name}/Paywall`] = mask(await page.eval('document.body.innerHTML'));
      }
    }
    // the phone view: a touch device 390 px wide (flag phone_companion)
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(6000);
    out['phoneview/Home'] = mask(await page.eval('document.body.innerHTML'));
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    // the sign-in page needs no session
    await page.send('Network.clearBrowserCookies');
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await page.send('Page.navigate', { url: rig.url + '/signin' });
      await sleep(3000);
      out[`${name}/SignIn`] = mask(await page.eval('document.body.innerHTML'));
    }
  } finally {
    cdp.close(); chrome.close(); rig.stop();
  }
  return out;
}

const a = await capture(distMain, port);
const b = await capture(distThis, port + 10);
let same = true;
for (const key of Object.keys(a)) {
  const x = a[key], y = b[key] ?? '';
  if (x === y) { console.log('SAME     ', key, `(${x.length} chars)`); continue; }
  same = false;
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  console.log('DIFFERENT', key, 'at', i, '\n  main:', x.slice(Math.max(0, i - 80), i + 140), '\n  this:', y.slice(Math.max(0, i - 80), i + 140));
  writeFileSync(join(outDir, key.replace('/', '-') + '.main.html'), x);
  writeFileSync(join(outDir, key.replace('/', '-') + '.this.html'), y);
}
for (const key of Object.keys(b)) if (!(key in a)) { same = false; console.log('ONLY IN THIS BUILD', key); }
console.log(same ? 'ALL SAME' : 'DIFFERENCES FOUND', `(${Object.keys(a).length} screens)`);
process.exit(0);
