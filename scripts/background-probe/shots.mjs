// usage: node scripts/background-probe/shots.mjs <port> <distDir> <outDir>
// Screenshots of the WS7a screens in headless Chrome (fake camera, flag on): Watch tab running / paused / meeting mode,
// the mini window (a Document Picture-in-Picture window) running and paused, Settings > Schedule off / explaining /
// on, light and dark, desktop and phone width. For eyeballing only; nothing is compared.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome, CDP, openPage, sleep } from './cdp.mjs';
import { startRig } from './rig.mjs';

const [portArg, distDir, outDir] = process.argv.slice(2);
const port = Number(portArg);
mkdirSync(outDir, { recursive: true });

const rig = await startRig({ dist: distDir, port, flags: 'background_watching' });
const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;

const shot = async (page, name, clip) => {
  const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
};
const click = (page, text) => page.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
const tab = (page, label) => page.eval(`(() => { const b = [...document.querySelectorAll('nav button')].find((x) => x.innerText.trim() === ${JSON.stringify(label)}); if (b) b.click(); })()`, { userGesture: true });

try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}` });

  for (const [mode, width, height, dark] of [['light', 1280, 900, false], ['dark', 1280, 900, true], ['phone', 390, 844, false]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.eval(`localStorage.removeItem('sb:background:state'); localStorage.removeItem('sb:background:schedule')`).catch(() => {});
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(7000);
    await shot(page, `${mode}-watch-running`);
    await click(page, '15 minutes'); await sleep(2500);
    await shot(page, `${mode}-watch-paused`);
    await click(page, 'Resume now'); await sleep(2500);
    await click(page, '30 minutes'); await sleep(1500);
    await shot(page, `${mode}-watch-meeting`);
    await click(page, 'End meeting mode'); await sleep(1000);

    await tab(page, 'Settings'); await sleep(1500);
    await page.eval(`document.querySelector('[aria-label="Remind me to start watching"]')?.scrollIntoView({ block: 'center' })`);
    await sleep(400);
    await shot(page, `${mode}-settings-schedule-off`);
    await click(page, 'Remind me to start watching'); await sleep(800);
    await shot(page, `${mode}-settings-schedule-explaining`);
    await cdp.send('Browser.grantPermissions', { origin: rig.url, permissions: ['notifications'] }).catch(() => {});
    await page.eval(`localStorage.setItem('sb:background:schedule', JSON.stringify({ enabled: true, days: [1,2,3,4,5], startMinutes: 540, endMinutes: 1020 }))`);
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(6000);
    await tab(page, 'Settings'); await sleep(1500);
    await page.eval(`document.querySelector('[aria-label="Remind me to start watching"]')?.scrollIntoView({ block: 'center' })`);
    await sleep(400);
    await shot(page, `${mode}-settings-schedule-on`);
  }

  // the mini window
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await page.eval(`localStorage.removeItem('sb:background:state')`);
  await page.send('Page.navigate', { url: rig.url + '/' });
  await sleep(7000);
  const before = (await cdp.send('Target.getTargets')).targetInfos.map((t) => t.targetId);
  await page.eval(`document.querySelector('button[title^="Float"]')?.click()`, { userGesture: true });
  await sleep(2500);
  const pipTarget = (await cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page' && !before.includes(t.targetId));
  if (pipTarget) {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: pipTarget.targetId, flatten: true });
    const pip = { send: (m, p) => cdp.send(m, p, sessionId), eval: async (e, o = {}) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, userGesture: !!o.userGesture }, sessionId)).result.value };
    const dims = await pip.eval('JSON.stringify([innerWidth, innerHeight])');
    console.log('mini window size', dims);
    await pip.send('Page.enable');
    // headless opens a bigger window than the 240x64 that was asked for; show the strip at the size the app asks for (300x64 with the flag on)
    await pip.send('Emulation.setDeviceMetricsOverride', { width: 300, height: 64, deviceScaleFactor: 2, mobile: false });
    await sleep(500);
    await shot(pip, 'pip-running');
    await pip.eval(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Pause')?.click()`, { userGesture: true });
    await sleep(2500);
    await shot(pip, 'pip-paused');
    await pip.eval(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Resume')?.click()`, { userGesture: true });
    await sleep(2500);
    await shot(pip, 'pip-resumed');
    await click(page, '30 minutes'); await sleep(1500);
    await shot(pip, 'pip-meeting');
  } else {
    console.log('no mini window target found');
  }
  console.log('done', outDir);
} catch (e) {
  console.error('FAILED', e);
} finally {
  cdp.close(); chrome.close(); rig.stop();
  process.exit(0);
}
