import { boot, sleep, waitFor, tab, shot } from './lib2.mjs';
const ctx = await boot();
try {
  for (const w of [320, 360, 390]) {
    const page = await ctx.page('about:blank', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 2, mobile: false });
    await page.send('Page.navigate', { url: ctx.rig.url + '/' });
    await waitFor(page, `document.querySelector('nav')`, 25000); await sleep(2000);
    await tab(page, 'History'); await sleep(1500);
    const r = await page.eval(`(() => {
      const W = document.documentElement.clientWidth;
      // rows: elements that contain a Delete entry button
      const rows = [...document.querySelectorAll('main button[aria-label^="Delete entry"]')].map(b => { let row = b.parentElement; for (let i = 0; i < 3 && row; i++) { if (row.scrollWidth > row.clientWidth + 1) break; row = row.parentElement; } return row; });
      const clipped = rows.filter(r => r && r.scrollWidth > r.clientWidth + 1).length;
      const del = [...document.querySelectorAll('main button[aria-label^="Delete entry"]')].map(b => Math.round(b.getBoundingClientRect().right));
      const cardRight = Math.max(...[...document.querySelectorAll('main li, main [class*=rounded-2xl]')].map(e => Math.round(e.getBoundingClientRect().right)));
      return JSON.stringify({ W, scrollWidth: document.documentElement.scrollWidth, rows: rows.length, rowsWithOverflow: clipped, deleteButtonRightMax: Math.max(...del), deleteRightMin: Math.min(...del) });
    })()`);
    console.log(w, r);
    if (w === 320) {
      await page.eval(`window.scrollTo(0, 0)`);
      await page.eval(`document.querySelector('main button[aria-label^="Delete entry"]').scrollIntoView({block:'center'})`); await sleep(300);
      await shot(page, 'history-320');
    }
  }
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
