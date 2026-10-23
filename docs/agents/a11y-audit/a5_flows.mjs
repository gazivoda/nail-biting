import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 300)); } };
const live = async (page, label, ms = 0) => { if (ms) await sleep(ms); const r = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`)); console.log(`  live[${label}]:`, JSON.stringify(r.filter((x) => x.changes > 0).map((x) => `${x.region} x${x.changes} (${x.perSec}/s) "${x.sample}"`))); return r; };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(800);
  await tab(page, 'Settings'); await sleep(2500);

  // ---- per-section capture (contrast in both themes, targets, scoped axe) ----
  const sections = ['Detection', 'Alerts', 'Behaviors', 'Schedule', 'Account & Sync', 'Weekly summary email', 'Refer a friend', 'Data', 'Photo diary', 'Sharing', 'Appearance', 'Privacy'];
  for (const name of sections) {
    await step('section ' + name, async () => {
      const ok = await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()===${JSON.stringify(name)}); if(!h) return false; h.closest('section').setAttribute('data-a11y','sec'); h.closest('section').scrollIntoView({block:'start'}); return true; })()`);
      if (!ok) { console.log('-- section not found:', name); return; }
      await sleep(200);
      const r = await capture(page, 'sec-' + name.replace(/\W+/g, '-').toLowerCase(), { root: '[data-a11y=sec]', tabs: false, shots: true });
      console.log(summarize(r));
      await page.eval(`document.querySelector('[data-a11y=sec]').removeAttribute('data-a11y')`);
    });
  }

  // ---- Schedule: the notification permission flow ----
  await step('schedule', async () => {
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()==='Schedule'); h.closest('section').scrollIntoView({block:'center'}); })()`);
    // permission "default" (prompt): headless reports 'denied' unless set; set it to prompt
    await ctx.cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'prompt', origin: ctx.rig.url }).catch((e) => console.log('setPermission', String(e).slice(0, 120)));
    console.log('Notification.permission =', await page.eval(`Notification.permission`));
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Remind me to start watching', { sel: 'button[role=switch]' });
    await sleep(400);
    const act = await active(page);
    console.log('after turning on: focus ->', act.name, '| explain region present:', await page.eval(`!!document.querySelector('[aria-label="Allow notifications"]')`));
    await live(page, 'schedule explain');
    await tag(page, 'To remind you', 'section', 'sched');
    await shot(page, 'schedule-explain');
    const sc = await capture(page, 'schedule-explain', { root: '[data-a11y=sched]', tabs: false, shots: false });
    console.log(summarize(sc));
    // denied
    await clickText(page, 'Not now'); await sleep(200);
    await ctx.cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'denied', origin: ctx.rig.url }).catch(() => {});
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Remind me to start watching', { sel: 'button[role=switch]' }); await sleep(500);
    console.log('denied: text =', await page.eval(`[...document.querySelectorAll('[data-a11y=sched] [role=status]')].map(e=>e.innerText.slice(0,60)).join('|')`));
    await live(page, 'schedule denied');
    // granted
    await ctx.cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'granted', origin: ctx.rig.url }).catch(() => {});
    await clickText(page, 'Remind me to start watching', { sel: 'button[role=switch]' }); await sleep(600);
    console.log('granted: enabled =', await page.eval(`document.querySelector('button[role=switch][aria-label="Remind me to start watching"]').getAttribute('aria-checked')`));
    const sc2 = await capture(page, 'schedule-on', { root: '[data-a11y=sched]', tabs: false, shots: true });
    console.log(summarize(sc2));
    // keyboard: days group and time inputs
    const w = await tabWalk(page, { max: 10 });
    await page.eval(`(() => { document.querySelector('[aria-label="Days"] button').focus(); })()`);
    console.log('days group:', await page.eval(`JSON.stringify([...document.querySelectorAll('[aria-label="Days"] button')].map(b => b.getAttribute('aria-label') + '=' + b.getAttribute('aria-pressed')))`));
  });

  // ---- Account & Sync on, then Sharing ----
  await step('sync+sharing', async () => {
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()==='Account & Sync'); h.closest('section').scrollIntoView({block:'center'}); })()`);
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Sync my history across devices', { sel: 'button[role=switch]' }); await sleep(2500);
    await live(page, 'sync on');
    await tag(page, 'Sync my history', 'section', 'syncsec');
    await shot(page, 'sync-on');
    console.log(summarize(await capture(page, 'sync-on', { root: '[data-a11y=syncsec]', tabs: false, shots: false })));
    // sharing
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()==='Sharing'); h.closest('section').setAttribute('data-a11y','share'); h.closest('section').scrollIntoView({block:'start'}); })()`);
    await sleep(500);
    await page.eval(`window.__a11y.liveReset()`);
    await page.eval(`document.querySelector('[data-a11y=share] input[type=text]').focus()`);
    await key(page, 'Tab'); await key(page, 'Tab'); await key(page, 'Tab');
    console.log('focus before create:', (await active(page)).name);
    await clickText(page, 'Make a share link'); await sleep(1500);
    console.log('after create: focus ->', (await active(page)).name, '| selected text:', await page.eval(`window.getSelection().toString().length + ' / activeEl=' + document.activeElement.tagName`));
    await live(page, 'share created');
    await shot(page, 'share-created');
    const sh = await capture(page, 'sharing-created', { root: '[data-a11y=share]', tabs: false, shots: false });
    console.log(summarize(sh));
    const axs = await axeRun(page, { include: '[data-a11y=share]' }); console.log(axeSummary('sharing', axs, { showIncomplete: true })); save('axe-sharing', axs);
    await clickText(page, 'Copy link'); await sleep(500);
    await live(page, 'share copied');
    await clickText(page, 'Done'); await sleep(300);
    console.log('after Done: focus ->', (await active(page)).name);
    // revoke
    await clickText(page, 'Revoke', { exact: false, sel: 'button' }); await sleep(400);
    console.log('revoke confirm: focus ->', (await active(page)).name);
    await shot(page, 'share-revoke-confirm');
    await clickText(page, 'Yes, revoke this link'); await sleep(1000);
    console.log('after revoke: focus ->', (await active(page)).name);
    await live(page, 'share revoked');
  });

  // ---- weekly email card ----
  await step('weekly', async () => {
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()==='Weekly summary email'); h.closest('section').scrollIntoView({block:'center'}); })()`);
    await page.eval(`window.__a11y.liveReset()`);
    await clickText(page, 'Email me a weekly summary', { sel: 'button[role=switch]' }); await sleep(1500);
    console.log('weekly: switch =', await page.eval(`document.querySelector('button[role=switch][aria-label="Email me a weekly summary"]').getAttribute('aria-checked')`), '| focus', (await active(page)).name);
    await live(page, 'weekly');
    await tag(page, 'Email me a weekly summary', 'section', 'weekly');
    console.log(summarize(await capture(page, 'weekly-on', { root: '[data-a11y=weekly]', tabs: false, shots: true })));
    console.log('weekly text:', await page.eval(`document.querySelector('[data-a11y=weekly]').innerText.replace(/\\s+/g,' ').slice(0,500)`));
  });

  // ---- calibration dialog ----
  await step('calibration', async () => {
    await page.eval(`window.scrollTo(0,0)`);
    await page.eval(`(() => { const b=[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()==='Calibrate'); b.scrollIntoView({block:'center'}); b.focus(); })()`);
    const opener = await active(page);
    await clickText(page, 'Calibrate'); await sleep(1500);
    const open = await page.eval(`!!document.querySelector('[role=dialog][aria-labelledby=calibration-title]')`);
    console.log('calibration open', open, '| focus ->', (await active(page)).name, '| main inert:', await page.eval(`document.querySelector('#root').hasAttribute('inert') || document.getElementById('root')?.getAttribute('inert')`));
    await page.eval(`window.__a11y.liveReset()`);
    await waitFor(page, `[...document.querySelectorAll('[role=dialog] button')].some(b=>b.innerText.trim()==='Start' && !b.disabled)`, 30000);
    await page.eval(`document.querySelector('[role=dialog][aria-labelledby=calibration-title]').setAttribute('data-a11y','calib')`);
    const c1 = await capture(page, 'calibration-intro', { root: '[data-a11y=calib]', scope: '[data-a11y=calib]', tabs: false });
    console.log(summarize(c1));
    const axc = await axeRun(page, { include: '[data-a11y=calib]' }); console.log(axeSummary('calibration intro', axc, { showIncomplete: false })); save('axe-calib', axc);
    // tab trap
    const seq = [];
    for (let i = 0; i < 6; i++) { await key(page, 'Tab', { wait: 60 }); const a = await active(page); seq.push(a.name + (await page.eval(`!!document.querySelector('[data-a11y=calib]').contains(document.activeElement)`) ? '' : '[OUTSIDE]')); }
    console.log('calibration tab cycle:', seq.join(' | '));
    await clickText(page, 'Start'); await sleep(500);
    await page.eval(`window.__a11y.liveReset()`);
    await sleep(6000);
    const lr = await live(page, 'calibration running 6s');
    await shot(page, 'calibration-running');
    const c2 = await capture(page, 'calibration-rest', { root: '[data-a11y=calib]', tabs: false, shots: false });
    console.log(summarize(c2));
    await key(page, 'Escape'); await sleep(800);
    console.log('after Escape: dialog open?', await page.eval(`!!document.querySelector('[role=dialog][aria-labelledby=calibration-title]')`), 'focus ->', (await active(page)).name, '(opener was', opener.name + ')');
  });
  save('a5_flows', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
