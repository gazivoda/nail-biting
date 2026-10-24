import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
const live = async (page, label) => { const r = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`)); console.log(`  live[${label}]:`, JSON.stringify(r.filter((x) => x.changes > 0).map((x) => `${x.region} x${x.changes} "${x.sample}"`))); };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); localStorage.setItem('sb:insights:milestones', JSON.stringify({v:1,seen:{hour:1,day:1,week:1,month:1},baselined:true}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(500);
  await tab(page, 'History'); await sleep(800);
  await clickText(page, 'Insights'); await sleep(1000);

  await step('first photo', async () => {
    await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Take your first photo'); b.scrollIntoView({block:'center'}); })()`);
    await shot(page, 'photo-empty');
    const empty = await capture(page, 'photo-diary-empty', { root: 'section[aria-labelledby=photo-diary-title]', tabs: false, shots: false });
    console.log(summarize(empty));
    await clickText(page, 'Take your first photo'); await sleep(800);
    console.log('capture panel open: focus ->', (await active(page)).name, '| heading:', await page.eval(`document.getElementById('photo-capture-title')?.innerText`));
    const idle = await capture(page, 'photo-capture-idle', { root: 'section[aria-labelledby=photo-capture-title]', tabs: false });
    console.log(summarize(idle));
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Start the camera');
    await waitFor(page, `[...document.querySelectorAll('button')].some(b => b.innerText.includes('Take it now') && !b.disabled)`, 20000);
    await sleep(500);
    await shot(page, 'photo-live');
    const liveCap = await capture(page, 'photo-capture-live', { root: 'section[aria-labelledby=photo-capture-title]', tabs: false });
    console.log(summarize(liveCap));
    const ax = await axeRun(page, { include: 'section[aria-labelledby=photo-capture-title]' }); console.log(axeSummary('capture live', ax, { showIncomplete: true })); save('axe-photo-live', ax);
    const w = await tabWalk(page, { max: 8 }); console.log('capture tab order:', w.map((s) => s.name + (s.fv ? '' : '[NOFV]')).join(' | '));
    // countdown
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Take photo in'.length ? 'Take photo in 3 seconds' : '', { exact: false });
    await sleep(1200);
    console.log('counting: status =', await page.eval(`[...document.querySelectorAll('section[aria-labelledby=photo-capture-title] [role=status]')].map(e=>e.innerText).join('|')`));
    await clickText(page, 'Cancel the timer'); await sleep(300);
    await clickText(page, 'Take it now'); await sleep(1500);
    await shot(page, 'photo-review');
    const rev = await capture(page, 'photo-capture-review', { root: 'section[aria-labelledby=photo-capture-title]', tabs: false, shots: false });
    console.log(summarize(rev));
    await clickText(page, 'Save photo'); await sleep(1500);
    console.log('after save: focus ->', (await active(page)).name, '| status:', await page.eval(`[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).filter(Boolean).join('|').slice(0,160)`));
    await live(page, 'photo flow');
  });

  await step('second photo', async () => {
    await clickText(page, "Take this week's photo"); await sleep(500);
    await clickText(page, 'Start the camera');
    await waitFor(page, `[...document.querySelectorAll('button')].some(b => b.innerText.includes('Take it now') && !b.disabled)`, 20000);
    await sleep(1200);
    await clickText(page, 'Take it now'); await sleep(1200);
    await clickText(page, 'Save photo'); await sleep(2000);
    console.log('photos in diary:', await page.eval(`document.querySelectorAll('canvas').length`));
  });

  await step('compare', async () => {
    const found = await page.eval(`(() => { const s = document.querySelector('[data-testid=compare-stage]'); if (!s) return false; s.scrollIntoView({block:'center'}); return true; })()`);
    console.log('compare stage present:', found);
    await sleep(800);
    await tag(page, 'Before and after', 'div.rounded-2xl', 'compare');
    await shot(page, 'photo-compare');
    const cmp = await capture(page, 'photo-compare', { root: '[data-a11y=compare]', tabs: false, shots: false });
    console.log(summarize(cmp));
    const axc = await axeRun(page, { include: '[data-a11y=compare]' }); console.log(axeSummary('compare', axc, { showIncomplete: true })); save('axe-photo-compare', axc);
    // slider keyboard
    const sel = 'input[type=range][aria-valuetext]';
    await page.eval(`document.querySelector(${JSON.stringify(sel)}).focus({focusVisible:true})`);
    const read = () => page.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); return JSON.stringify({ value: s.value, valuetext: s.getAttribute('aria-valuetext'), name: s.labels && s.labels[0] && s.labels[0].innerText, min: s.min, max: s.max }); })()`);
    console.log('slider start', await read());
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'End', 'Home', 'PageUp', 'PageDown']) { await key(page, k); console.log('  ', k, await read()); }
    const sax = await axTree(page, { all: true });
    console.log('slider AX:', JSON.stringify(sax.nodes.filter((n) => n.role === 'slider').map((n) => ({ name: n.name, value: n.value }))));
    // focus indicator of the slider
    console.log('slider focus style:', await page.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); const cs = getComputedStyle(s); return s.matches(':focus-visible') + ' ' + cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor; })()`));
    // selects
    console.log('compare select names:', await page.eval(`JSON.stringify([...document.querySelectorAll('[data-a11y=compare] select')].map(s => (s.labels[0]?.innerText || '').split('\\n')[0]))`));
    console.log('canvas labels:', await page.eval(`JSON.stringify([...document.querySelectorAll('[data-testid=compare-stage] canvas, [data-testid=compare-stage] [role=img]')].map(c => c.getAttribute('aria-label') + '/' + c.getAttribute('role')))`));
    const gh = await axTree(page, { rootSelector: '[data-testid=compare-stage]', all: true });
    console.log('stage AX:', JSON.stringify(gh.nodes.filter((n) => !['generic', 'InlineTextBox'].includes(n.role)).map((n) => n.role + ':' + n.name)));
  });

  // delete flow (two step)
  await step('delete', async () => {
    await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.startsWith('Delete the photo')); b.scrollIntoView({block:'center'}); b.focus(); })()`);
    console.log('delete focus:', (await active(page)).name);
    await key(page, 'Enter'); await sleep(300);
    console.log('after first Delete: focus ->', (await active(page)).name, '| text:', await page.eval(`document.activeElement.closest('li').innerText.replace(/\\s+/g,' ').slice(0,100)`));
    const d = await capture(page, 'photo-delete-confirm', { root: 'section[aria-labelledby=photo-diary-title]', tabs: false, shots: true });
    console.log(summarize(d));
    await key(page, 'Escape'); await sleep(300);
    console.log('after Escape: focus ->', (await active(page)).name);
  });

  // reduced motion in the diary
  await setReduced(page, true); await sleep(300);
  console.log('photo anims reduced:', JSON.stringify(await animations(page)));
  save('a6_photos', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
