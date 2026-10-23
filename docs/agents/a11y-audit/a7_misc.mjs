import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(500);

  await step('program', async () => {
    await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('4-week program')); b.scrollIntoView({block:'center'}); b.focus(); })()`);
    const opener = await active(page);
    await clickText(page, '4-week program'); await sleep(1500);
    const dlg = '[role=dialog][aria-labelledby=program-title]';
    console.log('program open:', await page.eval(`!!document.querySelector(${JSON.stringify(dlg)})`), '| focus ->', (await active(page)).name.slice(0, 40), '| root inert:', await page.eval(`document.getElementById('root').hasAttribute('inert')`));
    const c = await capture(page, 'program-view', { root: dlg, scope: dlg, tabs: false });
    console.log(summarize(c));
    const ax = await axeRun(page, { include: dlg }); console.log(axeSummary('program', ax, { showIncomplete: true })); save('axe-program', ax);
    const seq = [];
    for (let i = 0; i < 12; i++) { await key(page, 'Tab', { wait: 50 }); const a = await active(page); seq.push((a.name || a.tag).slice(0, 22) + (await page.eval(`document.querySelector(${JSON.stringify(dlg)}).contains(document.activeElement)`) ? '' : '[OUTSIDE]')); }
    console.log('program tab order:', seq.join(' | '));
    await page.eval(`window.__a11y.liveReset()`);
    // reduced motion: transitions on the dialog
    await setReduced(page, true); await sleep(200); console.log('program anims reduced:', JSON.stringify(await animations(page))); await setReduced(page, false);
    await key(page, 'Escape'); await sleep(600);
    console.log('after Escape: open?', await page.eval(`!!document.querySelector(${JSON.stringify(dlg)})`), '| focus ->', (await active(page)).name, '(opener:', opener.name + ')');
  });

  await step('post-alarm card', async () => {
    await page.eval(`window.__sbProbe.inject = true`);
    await waitFor(page, `[...document.querySelectorAll('button')].some(b => b.innerText.trim()==='Not a bite')`, 20000);
    await page.eval(`window.__sbProbe.inject = false`);
    await sleep(500);
    const found = await tag(page, 'The alarm stays in History', 'div', 'replacement');
    console.log('replacement prompt found:', found, '|', await page.eval(`document.querySelector('[data-a11y=replacement]')?.innerText.replace(/\\s+/g,' ').slice(0,300)`));
    await shot(page, 'post-alarm-card');
    const c = await capture(page, 'post-alarm-card', { root: '[data-a11y=replacement]', tabs: false, shots: false });
    console.log(summarize(c));
    const axr = await axTree(page, { rootSelector: '[data-a11y=replacement]', all: true });
    console.log('replacement AX:', JSON.stringify(axr.nodes.filter((n) => !['generic', 'InlineTextBox', 'StaticText'].includes(n.role)).map((n) => n.role + ':' + n.name + ':' + JSON.stringify(n.props))));
    const ax = await axeRun(page, {}); console.log(axeSummary('watch with alarm card + toast', ax, { showIncomplete: false })); save('axe-alarm-state', ax);
    // click "Not a bite" on the toast; check announcements + focus
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Not a bite'); await sleep(500);
    console.log('after Not a bite: status text =', await page.eval(`[...document.querySelectorAll('[role=status]')].map(e=>e.innerText.trim()).filter(Boolean).join(' | ')`), '| focus', (await active(page)).name);
    const lr = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`));
    console.log('  live:', JSON.stringify(lr.map((x) => `${x.region} x${x.changes} "${x.sample}"`)));
    await shot(page, 'toast-marked');
    await tag(page, 'Marked as not a bite', '.app-type', 'toast2');
    console.log(summarize(await capture(page, 'toast-marked', { root: '[data-a11y=toast2]', tabs: false, shots: false })));
    // Undo within window, and the calibrate suggestion
    console.log('toast text:', await page.eval(`document.querySelector('[data-a11y=toast2]')?.innerText.replace(/\\s+/g,' ')`));
  });

  await step('pwa prompt', async () => {
    const p2 = await ctx.page(ctx.rig.url + '/', { init: '' });
    await desktop(p2);
    await waitFor(p2, `document.querySelector('nav')`, 20000);
    await waitFor(p2, `[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Dismiss')`, 8000);
    await sleep(1200);
    await tag(p2, 'Install Stop Biting', '.app-type', 'pwa');
    console.log('pwa prompt present:', await p2.eval(`!!document.querySelector('[data-a11y=pwa]')`));
    console.log(summarize(await capture(p2, 'pwa-prompt', { root: '[data-a11y=pwa]', tabs: false })));
    const imgs = await p2.eval(`JSON.stringify([...document.querySelectorAll('[data-a11y=pwa] img')].map(i => i.alt))`);
    console.log('pwa img alt:', imgs);
  });

  await step('onboarding', async () => {
    const p3 = await ctx.page(ctx.rig.url + '/', { init: `localStorage.removeItem('onboarding_v1_done'); localStorage.setItem('pwa_install_dismissed','1');`, tour: true });
    await desktop(p3);
    await waitFor(p3, `document.querySelector('[role=dialog]')`, 20000);
    await sleep(800);
    console.log('tour dialog:', await p3.eval(`document.querySelector('[role=dialog]').innerText.replace(/\\s+/g,' ').slice(0,200)`), '| focus ->', (await active(p3)).name.slice(0, 40));
    const c = await capture(p3, 'onboarding-tour', { root: '[role=dialog]', tabs: false });
    console.log(summarize(c));
    const ax = await axeRun(p3, {}); console.log(axeSummary('onboarding', ax));
    await key(p3, 'Escape'); await sleep(500);
    console.log('after Escape dialog?', await p3.eval(`!!document.querySelector('[role=dialog]')`), '| focus', (await active(p3)).name.slice(0, 40));
  });
  save('a7_misc', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
