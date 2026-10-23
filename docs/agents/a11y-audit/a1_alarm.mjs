import { boot, sleep, shot, desktop, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk } from './lib2.mjs';
const ctx = await boot();
const R = {};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); if(!localStorage.getItem('sb:hrt:settings')) localStorage.setItem('sb:hrt:settings', JSON.stringify({promptMode:'every',durationSec:30,selectedId:'fists',custom:[]}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  console.log('nav', await waitFor(page, `document.querySelector('nav')`, 20000));
  console.log('probe ready', await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000));

  // ---- baseline Watch page (no alarm) ----
  await setTheme(page, false);
  const watch = await capture(page, 'watch-desktop', { root: 'main' });
  console.log(summarize(watch));

  // ---- the alarm ----
  await setReduced(page, true); // steady flash: measure contrast of the flash at full opacity
  await page.eval(`window.__sbProbe.inject = true`);
  console.log('flash', await waitFor(page, `[...document.querySelectorAll('p')].some(p => p.innerText.trim()==='Hands down')`, 20000));
  await sleep(300);
  await page.eval(`(() => { const p=[...document.querySelectorAll('p')].find(p=>p.innerText.trim()==='Hands down'); const f=p.closest('.fixed'); f.setAttribute('data-a11y','flash'); })()`);
  await setReduced(page, false);
  R.flashAnims = await animations(page);
  await setReduced(page, true);
  await sleep(300);
  R.flashAx = await axTree(page, { rootSelector: '[data-a11y=flash]', all: true });
  const flash = await capture(page, 'alarm-flash', { root: '[data-a11y=flash]', tabs: false });
  console.log(summarize(flash));
  console.log('flash AX', JSON.stringify(R.flashAx.nodes));

  // ---- coaching + toast ----
  console.log('coach card', await waitFor(page, `document.querySelector('[data-testid=coaching-card]')`, 20000));
  console.log('toast', await waitFor(page, `[...document.querySelectorAll('button')].some(b => b.innerText.trim()==='Not a bite')`, 5000));
  await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Not a bite'); b.closest('.app-type').setAttribute('data-a11y','toast'); })()`);
  await page.eval(`window.__sbProbe.inject = false`);
  await setReduced(page, false);
  R.coachAnimsMotion = await animations(page);
  await setReduced(page, true);
  await sleep(500);
  R.coachAnimsReduced = await animations(page);
  const coach = await capture(page, 'coaching-card', { root: '[data-testid=coaching-card]', tabs: false });
  console.log(summarize(coach));
  const toast = await capture(page, 'notabite-toast', { root: '[data-a11y=toast]', tabs: false });
  console.log(summarize(toast));
  // reduced motion: the ring svg is hidden, number kept
  R.ringReduced = await page.eval(`JSON.stringify((() => { const ring = document.querySelector('[data-testid=coaching-ring]'); const svg = ring.querySelector('svg'); return { svgDisplay: getComputedStyle(svg).display, ringBorder: getComputedStyle(ring).borderTopWidth, number: ring.innerText }; })())`);
  console.log('ring reduced', R.ringReduced, 'anims motion', JSON.stringify(R.coachAnimsMotion), 'anims reduced', JSON.stringify(R.coachAnimsReduced));

  // live regions
  R.live = JSON.parse(await page.eval(`JSON.stringify([...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map(e => ({ sel: window.__a11y.sel(e), role: e.getAttribute('role'), live: e.getAttribute('aria-live'), text: e.innerText.slice(0,100), hiddenAttr: e.getAttribute('aria-hidden') })))`));
  console.log('live regions', JSON.stringify(R.live, null, 1));

  // tab order with the overlay up
  await setReduced(page, false);
  const tw = await tabWalk(page, { max: 60 });
  R.tabWithOverlay = tw;
  console.log('tab order with overlay:', tw.map((s) => `${s.name}${s.fv ? '' : '[NOFV]'} (${s.outline})`).join(' | '));
  await shot(page, 'alarm-overlay-focus');

  // Escape: coaching skip; focus return
  await page.eval(`document.activeElement && document.activeElement.blur()`);
  await key(page, 'Escape'); await sleep(400);
  R.afterEscape = { card: await page.eval(`!!document.querySelector('[data-testid=coaching-card]')`), active: await active(page), toastStill: await page.eval(`!![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Not a bite')`) };
  console.log('after Escape', JSON.stringify(R.afterEscape));
  save('a1_alarm', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
