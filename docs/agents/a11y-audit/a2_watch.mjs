import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(500);

  // axe on the Watch tab, both themes
  for (const dark of [false, true]) {
    await setTheme(page, dark); await sleep(400);
    const a = await axeRun(page, {});
    save('axe-watch-' + (dark ? 'dark' : 'light'), a);
    console.log(axeSummary('watch ' + (dark ? 'dark' : 'light'), a, { showIncomplete: !dark }));
  }
  await setTheme(page, false);

  // ---- urge timer ----
  await clickText(page, 'I feel an urge');
  await sleep(300);
  R.urgeChooseFocus = await active(page);
  console.log('urge choose: focus ->', R.urgeChooseFocus.name, R.urgeChooseFocus.fv);
  await tag(page, 'Breathe it out', 'div.rounded-2xl', 'urge-choose');
  console.log(summarize(await capture(page, 'urge-choose', { root: '[data-a11y=urge-choose]', tabs: false })));
  const choose = await axeRun(page, { include: '[data-a11y=urge-choose]' });
  console.log(axeSummary('urge choose', choose));
  // Escape closes the sheet and focus returns to the trigger
  await key(page, 'Escape'); await sleep(300);
  R.urgeEscape = { sheetGone: !(await page.eval(`[...document.querySelectorAll('h2')].some(h=>h.innerText==='Breathe it out')`)), active: await active(page) };
  console.log('urge Escape from choose:', JSON.stringify({ gone: R.urgeEscape.sheetGone, focus: R.urgeEscape.active.name }));

  // start it
  await clickText(page, 'I feel an urge'); await sleep(200);
  await clickText(page, 'Start'); await sleep(900);
  R.urgeRunFocus = await active(page);
  console.log('urge running: focus ->', R.urgeRunFocus.name, R.urgeRunFocus.fv);
  await tag(page, 'seconds left', 'div.rounded-2xl', 'urge-run');
  await setReduced(page, false);
  R.urgeAnimsMotion = await animations(page);
  const runMotion = await capture(page, 'urge-running', { root: '[data-a11y=urge-run]', tabs: false });
  console.log(summarize(runMotion));
  R.urgeAx = await axTree(page, { rootSelector: '[data-a11y=urge-run]', all: true });
  console.log('urge running AX (non-generic):', JSON.stringify(R.urgeAx.nodes.filter((n) => !['generic', 'InlineTextBox'].includes(n.role)).map((n) => n.role + ':' + n.name)));
  R.urgeLive = JSON.parse(await page.eval(`JSON.stringify([...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map(e => ({ role: e.getAttribute('role'), text: e.innerText.slice(0,110) })).filter(x=>x.text))`));
  console.log('urge live regions:', JSON.stringify(R.urgeLive));
  await setReduced(page, true); await sleep(600);
  R.urgeAnimsReduced = await animations(page);
  R.urgeReducedVisible = JSON.parse(await page.eval(`JSON.stringify((() => { const box = document.querySelector('[data-a11y=urge-run]'); const circle = box.querySelector('div[class*="h-40"]'); return { circleDisplay: circle && getComputedStyle(circle).display, text: box.innerText.replace(/\\s+/g,' ').slice(0,120) }; })())`));
  console.log('urge reduced: anims', JSON.stringify(R.urgeAnimsReduced), JSON.stringify(R.urgeReducedVisible));
  console.log('urge motion anims', JSON.stringify(R.urgeAnimsMotion));
  await shot(page, 'urge-running-reduced');
  const runRed = await capture(page, 'urge-running-reduced', { root: '[data-a11y=urge-run]', tabs: false, shots: false });
  console.log(summarize(runRed));
  // Escape during running stops and logs; focus?
  await key(page, 'Escape'); await sleep(500);
  R.urgeStopFocus = await active(page);
  console.log('after Escape (running): focus ->', R.urgeStopFocus.name, ' logged text:', await page.eval(`document.body.innerText.includes('Logged as an urge')`));
  await tag(page, 'Logged as an urge', 'div.rounded-2xl', 'urge-logged');
  const logged = await capture(page, 'urge-logged', { root: '[data-a11y=urge-logged]', tabs: false });
  console.log(summarize(logged));
  await clickText(page, 'Undo'); await sleep(300);
  console.log('after Undo focus ->', (await active(page)).name);

  // ---- pause ----
  await setReduced(page, false);
  await clickText(page, '15 minutes'); await sleep(1200);
  await tag(page, 'Paused', 'div.absolute', 'pause-overlay');
  const hasOverlay = await page.eval(`!!document.querySelector('[data-a11y=pause-overlay]')`);
  console.log('paused overlay present', hasOverlay, '| status regions:', await page.eval(`JSON.stringify([...document.querySelectorAll('[role=status]')].map(e=>e.innerText.replace(/\\s+/g,' ').slice(0,80)).filter(Boolean))`));
  await shot(page, 'paused-desktop');
  if (hasOverlay) console.log(summarize(await capture(page, 'pause-overlay', { root: '[data-a11y=pause-overlay]', tabs: false, shots: false })));
  await tag(page, 'Stop watching for a while', 'section', 'pause-card');
  const pcard = await capture(page, 'pause-card-paused', { root: '[data-a11y=pause-card]', tabs: false, shots: false });
  console.log(summarize(pcard));
  const pax = await axeRun(page, {}); console.log(axeSummary('paused watch', pax));
  await clickText(page, 'Resume now'); await sleep(800);
  console.log('after Resume focus ->', (await active(page)).name);
  // meeting mode
  await clickText(page, '30 minutes'); await sleep(1000);
  await tag(page, 'Meeting mode', 'section', 'pause-card');
  await shot(page, 'meeting-desktop');
  console.log(summarize(await capture(page, 'pause-card-meeting', { root: '[data-a11y=pause-card]', tabs: false, shots: false })));
  console.log('meeting: active', JSON.stringify(await active(page)), 'status:', await page.eval(`JSON.stringify([...document.querySelectorAll('[role=status]')].map(e=>e.innerText.replace(/\\s+/g,' ').slice(0,100)).filter(Boolean))`));
  const camStatus = await page.eval(`document.querySelector('[data-tour=camera-toggle]').innerText.replace(/\\s+/g,' ')`);
  console.log('camera card text in meeting:', camStatus);
  await clickText(page, 'End meeting mode');
  save('a2_watch', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
