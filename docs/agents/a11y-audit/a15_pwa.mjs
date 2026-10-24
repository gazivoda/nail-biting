import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, key, active, clickText, tab, summarize, capture, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
try {
  const page = await ctx.page(ctx.rig.url + '/', { init: '' });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  const got = await waitFor(page, `[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Dismiss')`, 15000);
  console.log('install prompt appeared:', got);
  await sleep(1500);
  if (got) {
    await tag(page, 'Install Stop Biting', '.app-type', 'pwa');
    await shot(page, 'pwa-prompt');
    const c = await capture(page, 'pwa-prompt', { root: '[data-a11y=pwa]', tabs: false, shots: false });
    console.log(summarize(c));
    const ax = await axeRun(page, {}); console.log(axeSummary('watch with install prompt', ax));
    console.log('img alt:', await page.eval(`JSON.stringify([...document.querySelectorAll('[data-a11y=pwa] img')].map(i => i.alt))`));
  }
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
