// usage: node scripts/background-probe/run-idle.mjs <port> <distDir>
// Idle cost of the feature: the signed-in app with detection switched OFF (Stop pressed), tab visible, 90 s, once
// with the flag off and once with it on. Reports the browser's CPU time per process type, as % of one core.
// Also counts the page's own timers (a 100 ms probe is not added: this is the app as it is).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SP, launchChrome, CDP, openPage, sleep } from './cdp.mjs';
import { startRig } from './rig.mjs';

const [portArg, distDir] = process.argv.slice(2);
const port = Number(portArg);
const out = { startedAt: new Date().toISOString(), runs: {} };

async function measure(label, flags, portN) {
  const rig = await startRig({ dist: distDir, port: portN, flags });
  const chrome = await launchChrome({ port: portN + 1000, headless: 'new' });
  const cdp = new CDP(chrome.wsUrl);
  await cdp.ready;
  try {
    const page = await openPage(cdp, 'about:blank');
    await page.send('Network.enable');
    await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
    await page.send('Page.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}` });
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(8000);
    await page.eval(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Stop')?.click()`, { userGesture: true });
    await sleep(8000);
    const cpu = async () => { const r = await cdp.send('SystemInfo.getProcessInfo'); const sum = {}; for (const p of r.processInfo) sum[p.type] = (sum[p.type] ?? 0) + p.cpuTime; return { at: Date.now(), sum }; };
    const a = await cpu();
    await sleep(90000);
    const b = await cpu();
    const secs = (b.at - a.at) / 1000;
    const res = { seconds: +secs.toFixed(1) };
    for (const k of Object.keys(b.sum)) res[k] = +(((b.sum[k] - (a.sum[k] ?? 0)) / secs) * 100).toFixed(2);
    res.detectionOff = await page.eval(`!document.querySelector('video')?.srcObject`);
    res.workers = JSON.stringify((await cdp.send('Target.getTargets')).targetInfos.filter((t) => t.type === 'worker').map((t) => t.url.split('/').pop()));
    out.runs[label] = res;
    console.log(label, JSON.stringify(res));
  } finally {
    cdp.close(); chrome.close(); rig.stop();
  }
}

await measure('flag-off', '', port);
await measure('flag-on', 'background_watching', port + 10);
writeFileSync(join(SP, 'idle-cpu.json'), JSON.stringify(out, null, 1) + '\n');
process.exit(0);
