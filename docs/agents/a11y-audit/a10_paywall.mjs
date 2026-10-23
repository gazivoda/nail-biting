import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(800);
  await step('paywall', async () => {
    await page.eval(`document.querySelectorAll('nav button').forEach(b => { if (b.innerText.includes('Upgrade')) b.dataset.up = 1; })`);
    await clickText(page, 'Upgrade'); await sleep(2500);
    console.log('paywall h1:', await page.eval(`document.querySelector('h1')?.innerText`), '| scrollWidth', await page.eval(`document.documentElement.scrollWidth`));
    await shot(page, 'paywall');
    const c = await capture(page, 'paywall', { root: 'body', tabs: true });
    console.log(summarize(c));
    for (const dark of [false, true]) { await setTheme(page, dark); const ax = await axeRun(page, {}); save('axe-paywall-' + (dark ? 'dark' : 'light'), ax); console.log(axeSummary('paywall ' + (dark ? 'dark' : 'light'), ax, { showIncomplete: !dark })); }
    await setTheme(page, false);
    await setReduced(page, true); console.log('paywall anims reduced:', JSON.stringify(await animations(page))); await setReduced(page, false);
  });
  await step('redeem', async () => {
    await page.send('Page.navigate', { url: ctx.rig.url + '/redeem' }); await sleep(2500);
    console.log('redeem h1:', await page.eval(`document.querySelector('h1')?.innerText`), '|', await page.eval(`document.body.innerText.replace(/\\s+/g,' ').slice(0,200)`));
    const c = await capture(page, 'redeem', { root: 'body', tabs: true });
    console.log(summarize(c));
    for (const dark of [false, true]) { await setTheme(page, dark); const ax = await axeRun(page, {}); console.log(axeSummary('redeem ' + (dark ? 'dark' : 'light'), ax, { showIncomplete: !dark })); }
  });
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
