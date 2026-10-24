import { boot, sleep, shot, desktop, waitFor, save, key, active, clickText, summarize, capture, tag, tabWalk, setReduced, animations } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
try {
  const page = await ctx.page(ctx.rig.url + '/', { init: `localStorage.setItem('pwa_install_dismissed','1');` });
  await desktop(page);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(500);
  await page.eval(`window.__sbProbe.inject = true`);
  await waitFor(page, `[...document.querySelectorAll('h2')].some(h => h.innerText.includes('try this instead'))`, 25000);
  await page.eval(`window.__sbProbe.inject = false`);
  await sleep(700);
  await page.eval(`[...document.querySelectorAll('h2')].find(h => h.innerText.includes('try this instead')).closest('div.rounded-2xl').setAttribute('data-a11y','repl')`);
  const c = await capture(page, 'post-alarm-card', { root: '[data-a11y=repl]', scope: '[data-a11y=repl]', tabs: false });
  console.log(summarize(c));
  await setReduced(page, true); await sleep(300); console.log('reduced anims:', JSON.stringify(await animations(page))); await setReduced(page, false);
  console.log('card buttons:', await page.eval(`JSON.stringify([...document.querySelectorAll('[data-a11y=repl] button')].map(b => (b.getAttribute('aria-label')||b.innerText).trim().slice(0,40)))`));
  // choose a reason with the keyboard (Enter) and see where focus goes
  await page.eval(`[...document.querySelectorAll('[data-a11y=repl] button')].find(b=>b.innerText.trim()==='Stress').focus()`);
  await key(page, 'Enter'); await sleep(500);
  console.log('after choosing a reason: card gone:', !(await page.eval(`!!document.querySelector('[data-a11y=repl]')`)), '| focus ->', (await active(page)).name.slice(0, 30));
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
