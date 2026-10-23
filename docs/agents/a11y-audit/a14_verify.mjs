import { boot, sleep, shot, desktop, waitFor, save, setTheme, key, active, clickText, tab, summarize, capture } from './lib2.mjs';
const ctx = await boot();
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(500);

  await step('pause overlay resume', async () => {
    await clickText(page, '15 minutes'); await sleep(1000);
    await page.eval(`window.__a11y.liveReset()`);
    const clicked = await page.eval(`(() => { const o=document.querySelector('[data-tour=camera-toggle]')?.parentElement; const b=[...document.querySelectorAll('[role=status] button')].find(b=>b.innerText.trim()==='Resume now'); if(!b) return 'no overlay button'; b.focus(); b.click(); return 'overlay Resume now clicked'; })()`);
    await sleep(500);
    console.log(clicked, '-> focus:', (await active(page)).name);
  });
  await step('slot resume + meeting', async () => {
    await clickText(page, '15 minutes'); await sleep(800);
    const r = await page.eval(`(() => { const b=[...document.querySelectorAll('section[aria-label="Pause and meeting mode"] button')].find(b=>b.innerText.trim()==='Resume now'); if(!b) return 'no slot button'; b.focus(); b.click(); return 'slot Resume now clicked'; })()`);
    await sleep(500);
    console.log(r, '-> focus:', (await active(page)).name);
    await clickText(page, '30 minutes'); await sleep(800);
    const r2 = await page.eval(`(() => { const b=[...document.querySelectorAll('section[aria-label="Pause and meeting mode"] button')].find(b=>b.innerText.trim()==='End meeting mode'); if(!b) return 'no end button'; b.focus(); b.click(); return 'End meeting mode clicked'; })()`);
    await sleep(500);
    console.log(r2, '-> focus:', (await active(page)).name);
  });

  // The "Detected!" label while the wave spikes: measure in both themes
  await step('detected label', async () => {
    for (const dark of [false, true]) {
      await setTheme(page, dark); await sleep(400);
      await page.eval(`window.__sbProbe.inject = true`);
      await waitFor(page, `[...document.querySelectorAll('span')].some(s => s.innerText === 'Detected!')`, 20000);
      await page.eval(`window.__sbProbe.inject = false`);
      const r = JSON.parse(await page.eval(`(() => {
        const s = [...document.querySelectorAll('span')].find(s => s.innerText === 'Detected!');
        s.style.transition = 'none'; // measure the settled colour
        const cs = getComputedStyle(s);
        const bg = window.__a11y.backdrop(s).color; const fg = window.__a11y.over(window.__a11y.rgba(cs.color), bg);
        return JSON.stringify({ color: cs.color, ratio: Math.round(window.__a11y.ratio(fg, bg) * 100) / 100, bg: bg.map(Math.round).join(','), dark: document.documentElement.classList.contains('dark') });
      })()`));
      console.log('Detected! label', dark ? 'dark' : 'light', JSON.stringify(r));
      await sleep(4000);
    }
    await setTheme(page, false);
  });

  await step('settings placeholder', async () => {
    await tab(page, 'Settings'); await sleep(2000);
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()==='Bite reasons'); h.closest('section').setAttribute('data-a11y','br'); h.closest('section').scrollIntoView(); })()`);
    const c = await capture(page, 'sec-bite-reasons', { root: '[data-a11y=br]', tabs: false, shots: false });
    console.log(summarize(c));
  });
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
