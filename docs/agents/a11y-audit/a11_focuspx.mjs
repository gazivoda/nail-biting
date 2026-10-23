import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boot, sleep, desktop, phone, waitFor, tab, clickText, focusIndicatorPixels, setTheme, key, SP } from './lib2.mjs';
const ctx = await boot();
const rigj = JSON.parse(readFileSync(join(SP, 'rig.json'), 'utf8'));
// For each element: screenshot of the element (+8px) blurred vs focused (focus-visible). Identical bytes = no visible indicator.
const checks = [];
const run = async (page, label, selector) => {
  for (const dark of [false, true]) {
    await setTheme(page, dark); await sleep(250); await page.eval(`window.__a11y.settle(true)`); await sleep(100);
    const r = await focusIndicatorPixels(page, selector);
    const line = `${r === null ? 'MISSING' : r.same ? 'NO-INDICATOR' : 'ok'}  ${dark ? 'dark ' : 'light'}  ${label}`;
    checks.push(line); console.log(line);
  }
  await setTheme(page, false);
};
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); if(!localStorage.getItem('sb:hrt:settings')) localStorage.setItem('sb:hrt:settings', JSON.stringify({promptMode:'every',durationSec:30,selectedId:'fists',custom:[]}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(500);
  // Watch tab
  await page.eval(`document.querySelectorAll('button').forEach(b => { const t=(b.innerText||'').trim(); if (t==='I just bit my nails') b.id='px-bit'; if (t==='I feel an urge') b.id='px-urge'; if (t==='15 minutes') b.id='px-15'; if (t==='Stop') b.id='px-stop'; if (b.getAttribute('role')==='switch' && b.innerText.includes('Show camera feed')) b.id='px-feed'; if (t==='4-week program') b.id='px-prog'; })`);
  for (const [l, s] of [['Stop (camera card, on deep)', '#px-stop'], ['Show camera feed switch (on deep)', '#px-feed'], ['I just bit my nails', '#px-bit'], ['I feel an urge', '#px-urge'], ['Pause 15 minutes pill', '#px-15'], ['4-week program link', '#px-prog']]) await run(page, l, s);
  // alarm: coaching + toast
  await page.eval(`window.__sbProbe.inject = true`);
  await waitFor(page, `document.querySelector('[data-testid=coaching-card]')`, 20000);
  await page.eval(`window.__sbProbe.inject = false`);
  await sleep(400);
  await page.eval(`(() => { const c=document.querySelector('[data-testid=coaching-card]'); const bs=c.querySelectorAll('button'); bs[0].id='px-done'; bs[1].id='px-skip'; const nb=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Not a bite'); nb.id='px-nab'; const cl=[...document.querySelectorAll('button[aria-label=Close]')][0]; cl.id='px-close'; })()`);
  for (const [l, s] of [['Coaching Done', '#px-done'], ['Coaching Skip', '#px-skip'], ['Toast Not a bite', '#px-nab'], ['Toast close x', '#px-close']]) await run(page, l, s);
  await clickText(page, 'Skip');
  // Settings
  await tab(page, 'Settings'); await sleep(2000);
  await page.eval(`(() => { const sw=[...document.querySelectorAll('button[role=switch]')].find(b=>b.getAttribute('aria-label')==='Remind me to start watching'); sw.id='px-switch'; const r=document.querySelector('[role=radiogroup][aria-label="Sensitivity"] [role=radio][tabindex="0"]'); r.id='px-radio'; const rg=document.querySelector('input[type=range][aria-label="Length of the prompt in seconds"]'); rg.id='px-range'; const sel=document.querySelector('select'); if (sel) sel.id='px-select'; const text=document.querySelector('input[placeholder="e.g. Tiredness"]'); text.id='px-text'; const prev=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Preview Beeps'); if (prev) prev.id='px-prev'; })()`);
  for (const [l, s] of [['Settings switch (Toggle)', '#px-switch'], ['Segmented radio', '#px-radio'], ['Range slider', '#px-range'], ['Text input (Bite reasons)', '#px-text'], ['Preview sound button', '#px-prev']]) await run(page, l, s);
  // Insights compare slider not repeated (native range, seen above). Sign-in and share
  const out = await ctx.page('about:blank', { signedIn: false, seedHistory: false });
  await desktop(out);
  await out.send('Page.navigate', { url: ctx.rig.url + '/signin' }); await waitFor(out, `document.getElementById('signin-email')`, 15000); await sleep(1000);
  await out.eval(`document.querySelector('main a').id='px-google'; document.getElementById('signin-email').id='px-email'; const b=document.querySelector('form button'); b.disabled=false; b.id='px-send';`);
  for (const [l, s] of [['Sign-in: Google button', '#px-google'], ['Sign-in: email field', '#px-email'], ['Sign-in: send button', '#px-send']]) await run(out, l, s);
  await out.send('Page.navigate', { url: rigj.share.body.url }); await waitFor(out, `document.querySelector('h1')`, 15000); await sleep(800);
  await out.eval(`document.querySelector('button').id='px-print'`);
  await run(out, 'Share page: Print button', '#px-print');
  console.log('\nsummary:', checks.filter((c) => !c.startsWith('ok')).length, 'without a visible indicator of', checks.length);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
