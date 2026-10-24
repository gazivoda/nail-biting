import { boot, sleep, waitFor } from './lib2.mjs';
const ctx = await boot();
try {
  const page = await ctx.page('about:blank', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: false });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Page.navigate', { url: ctx.rig.url + '/' });
  await waitFor(page, `document.querySelector('[data-phone-view]')`, 25000); await sleep(2000);
  console.log(await page.eval(`(() => {
    const W = document.documentElement.clientWidth; const out = [];
    for (const e of document.querySelectorAll('[data-phone-view] *')) { const r = e.getBoundingClientRect(); if (r.right > W + 0.5 && e.children.length === 0 && r.width > 0) out.push(window.__a11y.sel(e) + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width) + ' "' + (e.innerText||'').slice(0,20) + '"'); }
    const pv = document.querySelector('[data-phone-view]').getBoundingClientRect();
    const hero = document.querySelector('[data-tour=streak-card]').getBoundingClientRect();
    return JSON.stringify({ W, scrollWidth: document.documentElement.scrollWidth, phoneViewRight: Math.round(pv.right), heroRight: Math.round(hero.right), heroW: Math.round(hero.width), leaves: out.slice(0, 8) });
  })()`));
  console.log(await page.eval(`document.querySelector('[data-tour=streak-card]').innerText.replace(/\\s+/g,' ')`));
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
