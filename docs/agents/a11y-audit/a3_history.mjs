import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); localStorage.setItem('sb:insights:milestones', JSON.stringify({v:1,seen:{hour:1,day:1,week:1,month:1},baselined:true}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(1000);
  await tab(page, 'History'); await sleep(1500);
  // hover-revealed buttons are opacity 0 on large screens until hover/focus; show them to measure colours
  await page.eval(`(() => { const s = document.createElement('style'); s.id='__show'; s.textContent = '.lg\\\\:opacity-0{opacity:1!important}'; document.head.appendChild(s); })()`);
  const hist = await capture(page, 'history-list', { root: 'main', tabs: false });
  console.log(summarize(hist));
  const ax = await axeRun(page, {});
  console.log(axeSummary('history', ax, { showIncomplete: true }));
  save('axe-history', ax);
  R.rowButtonNames = await page.eval(`JSON.stringify([...document.querySelectorAll('main button[aria-label]')].slice(0, 8).map(b => b.getAttribute('aria-label')))`);
  console.log('row button names', R.rowButtonNames);

  // keyboard: focus a row button and check the indicator + that it becomes visible (opacity) on focus
  await page.eval(`document.getElementById('__show').remove()`);
  const walk = await tabWalk(page, { max: 14 });
  console.log('history tab order:', walk.map((s) => `${s.name}${s.fv ? '' : '[NOFV]'}`).join(' | '));
  // is the focused hover-revealed button actually visible?
  R.focusVisibleRow = await page.eval(`JSON.stringify([...document.querySelectorAll('main button[aria-label]')].slice(0,1).map((b) => { b.focus({focusVisible:true}); const cs = getComputedStyle(b); return { opacity: cs.opacity, outline: cs.outlineStyle + ' ' + cs.outlineWidth, label: b.getAttribute('aria-label') }; }))`);
  console.log('focused row button', R.focusVisibleRow);
  await shot(page, 'history-focus-row');

  // Insights view
  await page.eval(`window.scrollTo(0,0)`);
  await clickText(page, 'Insights'); await sleep(1500);
  console.log('radio state:', await page.eval(`JSON.stringify([...document.querySelectorAll('[role=radio]')].map(r => r.innerText.trim() + '=' + r.getAttribute('aria-checked')))`));
  console.log(await page.eval(`document.querySelector('main').innerText.replace(/\\n+/g,' | ').slice(0,1800)`));
  const ins = await capture(page, 'insights', { root: 'main', tabs: false });
  console.log(summarize(ins));
  const axi = await axeRun(page, {});
  console.log(axeSummary('insights', axi, { showIncomplete: true }));
  save('axe-insights', axi);
  const insAx = await axTree(page, { rootSelector: 'main', all: false });
  console.log('insights AX roles:', JSON.stringify(insAx.nodes.filter((n) => ['img', 'table', 'figure', 'list', 'progressbar', 'meter', 'region', 'heading', 'group', 'button'].includes(n.role)).map((n) => n.role + ':' + (n.name || '').slice(0, 50))));
  R.insAnims = await animations(page);
  console.log('insights anims', JSON.stringify(R.insAnims));
  await setReduced(page, true); await sleep(400);
  console.log('insights anims reduced', JSON.stringify(await animations(page)));
  await setReduced(page, false);
  save('a3_history', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
