import { boot, sleep, shot, desktop, waitFor, key, active, clickText, tab, summarize, capture, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 300)); } };
try {
  const page = await ctx.page(ctx.rig.url + '/', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(600);
  await tab(page, 'Settings'); await sleep(2000);
  await step('delete everything', async () => {
    await page.eval(`(() => { const b=[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()==='Delete everything'); b.scrollIntoView({block:'center'}); })()`);
    await sleep(300);
    await clickText(page, 'Delete everything'); await sleep(500);
    console.log('Delete everything -> confirm group present:', await page.eval(`!!document.querySelector('[aria-label="Confirm deleting everything"]')`), '| focus ->', (await active(page)).name);
    await tag(page, 'Delete everything', 'div[role=group]', 'del');
    await page.eval(`document.querySelector('[aria-label="Confirm deleting everything"]').setAttribute('data-a11y','del2')`);
    console.log(summarize(await capture(page, 'data-delete-confirm', { root: '[data-a11y=del2]', tabs: false })));
    await clickText(page, 'Cancel'); await sleep(400);
    console.log('after Cancel: focus ->', (await active(page)).name.slice(0, 40));
  });
  await step('history clear all', async () => {
    await tab(page, 'History'); await sleep(1200);
    await clickText(page, 'Clear all'); await sleep(400);
    console.log('Clear all -> focus', (await active(page)).name, '| group:', await page.eval(`JSON.stringify([...document.querySelectorAll('main [role=group],main [role=alertdialog],main [role=dialog]')].map(g=>g.getAttribute('aria-label')))`));
    await clickText(page, 'Keep', { exact: false }); await sleep(300);
    console.log('after Keep: focus ->', (await active(page)).name);
  });
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
