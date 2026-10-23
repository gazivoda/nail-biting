import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag, OUT } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); localStorage.setItem('sb:insights:milestones', JSON.stringify({v:1,seen:{},baselined:true}));
    window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); };
    try { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); } catch (e) {}
    HTMLAnchorElement.prototype.click = function () { window.__lastDownload = this.download; };`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  // focus something real first so we can see focus return
  await tab(page, 'History'); await sleep(300);
  await page.eval(`(() => { const b=[...document.querySelectorAll('nav button')].find(b=>b.innerText.trim()==='Settings'); b.focus(); })()`);
  console.log('card appears', await waitFor(page, `document.querySelector('[data-testid=milestone-card]')`, 15000));
  await sleep(500);
  const card = await capture(page, 'milestone-card', { root: '[data-testid=milestone-card]', tabs: false });
  console.log(summarize(card));
  R.focusOnOpen = await active(page);
  console.log('focus on open ->', R.focusOnOpen.name, 'fv', R.focusOnOpen.fv);
  const dlg = await axTree(page, { rootSelector: '[data-testid=milestone-card]', all: true });
  console.log('dialog AX:', JSON.stringify(dlg.nodes.filter((n) => !['generic', 'InlineTextBox', 'StaticText'].includes(n.role)).map((n) => `${n.role}:${n.name}:${JSON.stringify(n.props)}`)));
  const ax = await axeRun(page, {}); console.log(axeSummary('milestone card open', ax)); save('axe-milestone', ax);
  R.live = await page.eval(`JSON.stringify([...document.querySelectorAll('[role=status]')].map(e=>e.innerText.slice(0,80)))`);
  // Tab trap check: 5 tabs stay inside
  const seq = [];
  for (let i = 0; i < 6; i++) { await key(page, 'Tab', { wait: 60 }); const a = await active(page); seq.push(a.name + (await page.eval(`!!document.querySelector('[data-testid=milestone-card]').contains(document.activeElement)`) ? '' : '[OUTSIDE]')); }
  console.log('tab cycle in dialog:', seq.join(' | '));
  await key(page, 'Tab', { shift: true }); console.log('shift-tab ->', (await active(page)).name);
  // reduced motion
  await setReduced(page, false); R.animsMotion = await animations(page);
  await setReduced(page, true); await sleep(300); R.animsReduced = await animations(page);
  console.log('anims motion', JSON.stringify(R.animsMotion), 'reduced', JSON.stringify(R.animsReduced));
  await setReduced(page, false);
  // the share card
  await page.eval(`document.querySelector('[data-testid=milestone-card] button').focus()`);
  await clickText(page, 'Make a share card'); await waitFor(page, `[...document.querySelectorAll('[data-testid=milestone-card] [role=status]')].some(e => e.innerText && e.innerText !== 'Making the picture')`, 15000); await sleep(300);
  console.log('share note:', await page.eval(`[...document.querySelectorAll('[data-testid=milestone-card] [role=status]')].map(e=>e.innerText).join('|')`), 'download name:', await page.eval(`window.__lastDownload`));
  const png = await page.eval(`(async () => { const b = window.__blobs.filter((x) => x.type === 'image/png').pop(); if (!b) return null; return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); })()`);
  if (png) { writeFileSync(join(OUT, 'share-card.png'), Buffer.from(png.split(',')[1], 'base64')); console.log('share card png saved', png.length); }
  await shot(page, 'milestone-card-after-share');
  // Escape closes, focus returns to the Settings button
  await key(page, 'Escape'); await sleep(500);
  R.afterEscape = { open: await page.eval(`!!document.querySelector('[data-testid=milestone-card]')`), active: await active(page) };
  console.log('after Escape: dialog open?', R.afterEscape.open, 'focus ->', R.afterEscape.active.name);
  save('a3b_milestone', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
