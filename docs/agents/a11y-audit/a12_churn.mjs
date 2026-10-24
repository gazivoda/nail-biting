import { boot, sleep, desktop, waitFor, tab, clickText, key, active, tag, capture, summarize, save } from './lib2.mjs';
const ctx = await boot();
const rep = async (page, label, ms) => {
  await page.eval(`window.__a11y.liveReset()`);
  await sleep(ms);
  const r = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`));
  const total = r.reduce((n, x) => n + x.changes, 0);
  console.log(`[${label}] ${ms / 1000}s: ${total} live-region changes`, JSON.stringify(r.map((x) => `${x.region} x${x.changes} "${x.sample.slice(0, 50)}"`)));
};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); localStorage.setItem('sb:hrt:settings', JSON.stringify({promptMode:'every',durationSec:30,selectedId:'fists',custom:[]}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(1000);
  await rep(page, 'Watch idle', 10000);
  await page.eval(`window.__sbProbe.inject = true`);
  await waitFor(page, `document.querySelector('[data-testid=coaching-card]')`, 20000);
  await page.eval(`window.__sbProbe.inject = false`);
  await rep(page, 'alarm + coaching countdown', 8000);
  await clickText(page, 'Skip'); await sleep(500);
  await clickText(page, 'I feel an urge'); await sleep(300); await clickText(page, 'Start');
  await rep(page, 'urge breathing', 8000);
  await key(page, 'Escape'); await sleep(500);
  await clickText(page, '15 minutes');
  await rep(page, 'paused', 6000);
  await clickText(page, 'Resume now');
  await tab(page, 'History'); await rep(page, 'History', 5000);
  await tab(page, 'Settings'); await rep(page, 'Settings', 5000);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
