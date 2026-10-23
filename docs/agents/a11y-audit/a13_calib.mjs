import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const DLG = '[role=dialog][aria-labelledby=calibration-title]';
try {
  const page = await ctx.page(ctx.rig.url + '/', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(500);
  await tab(page, 'Settings'); await sleep(2000);
  await page.eval(`(() => { const b=[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()==='Calibrate'); b.scrollIntoView({block:'center'}); })()`);
  await clickText(page, 'Calibrate'); await sleep(1500);
  await waitFor(page, `[...document.querySelectorAll('[role=dialog] button')].some(b=>b.innerText.trim()==='Start' && !b.disabled)`, 30000);
  console.log('dialog:', await page.eval(`!!document.querySelector(${JSON.stringify(DLG)})`));
  const c1 = await capture(page, 'calibration-intro', { root: DLG, scope: DLG, tabs: false });
  console.log(summarize(c1));
  const ax = await axeRun(page, { include: DLG }); console.log(axeSummary('calibration intro', ax, { showIncomplete: true })); save('axe-calib', ax);
  const seq = [];
  for (let i = 0; i < 5; i++) { await key(page, 'Tab', { wait: 60 }); const a = await active(page); seq.push((a.name || a.tag).slice(0, 20) + (await page.eval(`document.querySelector(${JSON.stringify(DLG)}).contains(document.activeElement)`) ? '' : '[outside dialog]')); }
  console.log('tab cycle:', seq.join(' | '));
  await clickText(page, 'Start'); await sleep(500);
  await page.eval(`window.__a11y.liveReset()`);
  await sleep(6000);
  const lr = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`));
  console.log('live churn in 6s:', JSON.stringify(lr.map((x) => `${x.region} x${x.changes} "${x.sample.slice(0, 60)}"`)));
  await shot(page, 'calibration-running');
  const c2 = await capture(page, 'calibration-rest', { root: DLG, scope: DLG, tabs: false, shots: false });
  console.log(summarize(c2));
  console.log('status regions:', await page.eval(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(DLG)} + ' [role=status], ' + ${JSON.stringify(DLG)} + ' [aria-live]')].map(e => e.getAttribute('role') + '/' + e.getAttribute('aria-live') + ': ' + e.innerText.replace(/\\s+/g,' ').slice(0,90)))`));
  await setReduced(page, true); await sleep(300); console.log('reduced anims:', JSON.stringify(await animations(page))); await setReduced(page, false);
  await key(page, 'Escape'); await sleep(500);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
