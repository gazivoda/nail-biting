import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boot, sleep, waitFor, tab, clickText, SP } from './lib2.mjs';
const ctx = await boot();
const rigj = JSON.parse(readFileSync(join(SP, 'rig.json'), 'utf8'));
// WCAG 1.4.10 reflow: at 320 CSS px wide there must be no horizontal scroll (content other than data tables / maps).
const wide = (page) => page.eval(`(() => { const W = innerWidth; const bad = []; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== 'fixed') { bad.push(window.__a11y.sel(e) + ' right=' + Math.round(r.right)); if (bad.length > 4) break; } } return JSON.stringify({ innerWidth: W, scrollWidth: document.documentElement.scrollWidth, offenders: bad }); })()`);
try {
  for (const touch of [false, true]) {
    const page = await ctx.page('about:blank', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: false });
    if (touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.send('Page.navigate', { url: ctx.rig.url + '/' });
    await waitFor(page, `document.querySelector('nav')`, 25000); await sleep(2500);
    console.log(touch ? 'PHONE VIEW 320:' : 'FULL APP 320 (mouse):');
    console.log('  Watch', await wide(page));
    await tab(page, 'History'); await sleep(1200); console.log('  History', await wide(page));
    await clickText(page, 'Insights'); await sleep(1200); console.log('  Insights', await wide(page));
    await tab(page, 'Settings'); await sleep(1800); console.log('  Settings', await wide(page));
  }
  const out = await ctx.page('about:blank', { signedIn: false, seedHistory: false });
  await out.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: false });
  for (const [name, url] of [['/signin', ctx.rig.url + '/signin'], ['/share/<token>', rigj.share.body.url]]) {
    await out.send('Page.navigate', { url }); await sleep(2000); console.log(' ', name, await wide(out));
  }
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
