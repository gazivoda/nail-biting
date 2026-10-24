import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page('about:blank', { init });
  await phone(page);
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Page.navigate', { url: ctx.rig.url + '/' });
  await waitFor(page, `document.querySelector('[data-phone-view]')`, 25000);
  await sleep(1500);
  console.log('phone view present; innerWidth', await page.eval(`innerWidth`), 'scrollWidth', await page.eval(`document.documentElement.scrollWidth`), 'coarse:', await page.eval(`matchMedia('(pointer: coarse)').matches`));
  await shot(page, 'phone-watch');

  await step('phone main', async () => {
    const c = await capture(page, 'phone-view', { root: '[data-phone-view]', tabs: false });
    console.log(summarize(c));
    const t = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.targets('body'))`));
    console.log('whole page targets (incl. tab bar): total', t.total, 'min side', t.min, 'under44', t.under44, 'small:', JSON.stringify(t.small));
    for (const dark of [false, true]) { await setTheme(page, dark); const ax = await axeRun(page, {}); save('axe-phone-' + (dark ? 'dark' : 'light'), ax); console.log(axeSummary('phone ' + (dark ? 'dark' : 'light'), ax, { showIncomplete: !dark })); }
    await setTheme(page, false);
    const w = await tabWalk(page, { max: 30 });
    console.log('phone tab order:', w.map((s) => (s.name || s.sel).slice(0, 24) + (s.fv ? '' : '[NOFV]')).join(' | '));
  });

  await step('I bit flow', async () => {
    await page.eval(`window.__a11y.liveReset(); window.scrollTo(0,0)`);
    await clickText(page, 'I bit'); await sleep(600);
    console.log('after I bit: focus ->', (await active(page)).name, '| live:', await page.eval(`[...document.querySelectorAll('[role=status]')].map(e=>e.innerText.trim()).filter(Boolean).join(' | ')`));
    await tag(page, 'What set it off', 'div.rounded-2xl', 'phone-toast');
    await shot(page, 'phone-toast');
    console.log(summarize(await capture(page, 'phone-toast', { root: '[data-a11y=phone-toast]', tabs: false, shots: false })));
    await clickText(page, 'Stress'); await sleep(300);
    console.log('after tag chip: pressed =', await page.eval(`[...document.querySelectorAll('[data-a11y=phone-toast] button[aria-pressed=true]')].map(b=>b.innerText).join(',')`), '| focus ->', (await active(page)).name);
    await clickText(page, 'Undo'); await sleep(500);
    console.log('after Undo: focus ->', (await active(page)).name.slice(0, 30), '| toast gone:', !(await page.eval(`!!document.querySelector('[data-a11y=phone-toast]')`)));
    const lr = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`));
    console.log('  live:', JSON.stringify(lr.map((x) => `${x.region} x${x.changes} "${x.sample}"`)));
  });

  await step('urge on phone', async () => {
    await clickText(page, 'I feel an urge'); await sleep(400);
    console.log('urge choose: focus ->', (await active(page)).name);
    await shot(page, 'phone-urge-choose');
    await clickText(page, 'Start'); await sleep(800);
    await shot(page, 'phone-urge-run');
    await tag(page, 'seconds left', 'div.rounded-2xl', 'phone-urge');
    console.log(summarize(await capture(page, 'phone-urge-run', { root: '[data-a11y=phone-urge]', tabs: false, shots: false })));
    await setReduced(page, true); await sleep(300);
    console.log('urge reduced text:', await page.eval(`document.querySelector('[data-a11y=phone-urge]').innerText.replace(/\\s+/g,' ')`));
    await setReduced(page, false);
    await key(page, 'Escape'); await sleep(400);
  });

  await step('phone tabs', async () => {
    // the tab bar
    const nav = await axTree(page, { all: true });
    console.log('landmarks:', JSON.stringify(nav.nodes.filter((n) => ['navigation', 'main', 'banner', 'contentinfo'].includes(n.role)).map((n) => n.role + ':' + n.name)));
    await clickText(page, 'History', { sel: 'nav button, nav a' }); await sleep(1500);
    console.log('phone History: scrollWidth', await page.eval(`document.documentElement.scrollWidth`));
    const c = await capture(page, 'phone-history', { root: 'main', tabs: false });
    console.log(summarize(c));
    await clickText(page, 'Settings', { sel: 'nav button, nav a' }); await sleep(2000);
    console.log('phone Settings: scrollWidth', await page.eval(`document.documentElement.scrollWidth`));
    const c2 = await capture(page, 'phone-settings', { root: 'main', tabs: false });
    console.log(summarize(c2));
    for (const dark of [false, true]) { await setTheme(page, dark); const ax = await axeRun(page, {}); console.log(axeSummary('phone settings ' + (dark ? 'dark' : 'light'), ax, { showIncomplete: false })); }
    await setTheme(page, false);
  });
  save('a8_phone', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
