// WS13 accessibility, second pass after WS12a was merged: the surfaces the accessibility fixes touched, again in a
// non-English language (German, flag locale_de on, picked through the same kv key the Language card writes), because
// text length and word order change. Every German text is read from the catalog (src/i18n/locales/de/*.ts), never typed.
//
//   A11Y_DIR=/tmp/ws13-a11y-final node docs/agents/a11y-audit/a23_de.mjs        (needs dist-a11y built from a probe copy, see
//   scripts/privacy-audit/probe-root.sh; starts its own rig on 3217 and Chrome on 4217)
//
// It checks, per surface: the focus lands where a keyboard user expects after a control removes itself, the live regions say
// the translated sentence once and do not tick, nothing scrolls sideways at 390 px, and WCAG AA contrast in light and dark.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boot, sleep, shot, desktop, phone, waitFor, key, active, capture, summarize, clickText, tab, ALL_FLAGS } from './lib2.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const STR = /^\s*['"]([^'"]+)['"]:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),?\s*$/gm;
const cats = {};
function cat(scope) {
  if (!cats[scope]) {
    const src = readFileSync(join(ROOT, 'src/i18n/locales/de', `${scope}.ts`), 'utf8');
    cats[scope] = Object.fromEntries([...src.matchAll(STR)].map((m) => [m[1], (m[2] ?? m[3]).replace(/\\(['"\\])/g, '$1')]));
  }
  return cats[scope];
}
const T = (scope, k) => { const v = cat(scope)[k]; if (v === undefined) throw new Error(`no German text for ${scope}:${k}`); return v; };

const ctx = await boot({ flags: `${ALL_FLAGS},locale_de`, port: 3217, chromePort: 4217 });
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
const sw = (page) => page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
const live = async (page, label) => { const r = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`)); console.log(`  live[${label}]:`, JSON.stringify(r.filter((x) => x.changes > 0).map((x) => `${x.region} x${x.changes} "${x.sample.slice(0, 50)}"`))); return r; };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1'); localStorage.setItem('sb:i18n:locale', JSON.stringify('de')); localStorage.setItem('sb:insights:milestones', JSON.stringify({v:1,seen:{hour:1,day:1,week:1,month:1},baselined:true}));`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await waitFor(page, `window.__sbProbe && window.__sbProbe.steps > 3`, 60000);
  await sleep(800);
  console.log('html lang =', await page.eval(`document.documentElement.lang`), '| first tab label =', await page.eval(`document.querySelector('nav button')?.innerText.trim()`));

  await step('pause card: Resume hands focus to the first pause choice', async () => {
    const sec = `section[aria-label="${T('background', 'slot.aria')}"]`;
    const first = await page.eval(`document.querySelector(${JSON.stringify(sec + ' button')}).innerText.trim()`);
    await clickText(page, first, { sel: sec + ' button' }); await sleep(900);
    const r = await page.eval(`(() => { const b=[...document.querySelectorAll(${JSON.stringify(sec + ' button')})].find(b=>b.innerText.trim()===${JSON.stringify(T('background', 'slot.resume'))}); if(!b) return 'no resume button'; b.focus(); b.click(); return 'resume clicked'; })()`);
    await sleep(500);
    const a = await active(page);
    console.log(`pause "${first}" -> ${r} -> focus on "${a.name}" ${a.name === first ? 'OK (the first pause choice)' : 'NOT the first pause choice'}`);
    console.log('  scrolls sideways at 1280:', !(await sw(page)));
  });

  await step('urge timer: translated, one phase word at a time', async () => {
    await clickText(page, T('coaching', 'urge.start'), { exact: true }); await sleep(500);
    await clickText(page, T('coaching', 'urge.begin'), { exact: true }); await sleep(800);
    await page.eval(`window.__a11y.liveReset()`);
    const t0 = await page.eval(`[...document.querySelectorAll('[role=status][aria-atomic=true]')].map(e=>e.innerText).join('|')`);
    await sleep(7000);
    const r = await live(page, 'urge 7 s');
    console.log('  phase word:', JSON.stringify(t0), 'expected one of', JSON.stringify([T('coaching', 'urge.breatheIn'), T('coaching', 'urge.breatheOut')]));
    // "Stopp" is also the name of the camera card's button: press the one inside the breathing card
    await page.eval(`(() => { const card = document.querySelector('[role=status][aria-atomic=true]').parentElement; const b = card.querySelector('button'); b.focus(); b.click(); })()`);
    await sleep(600);
    const a = await active(page);
    console.log('  after Stopp: focus ->', JSON.stringify(a.name), '| the logged banner is shown:', await page.eval(`document.body.innerText.includes(${JSON.stringify(T('coaching', 'urge.logged').slice(0, 14))})`));
  });

  await step('calibration: one announcement per step, in German', async () => {
    await tab(page, T('shell', 'tabs.settings')); await sleep(2000);
    await page.eval(`(() => { const b=[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()===${JSON.stringify(T('settings', 'falsePositive.calibrate.label'))}); b.scrollIntoView({block:'center'}); })()`);
    await clickText(page, T('settings', 'falsePositive.calibrate.label')); await sleep(1500);
    await waitFor(page, `[...document.querySelectorAll('[role=dialog] button')].some(b=>b.innerText.trim()===${JSON.stringify(T('calibration', 'start'))} && !b.disabled)`, 30000);
    await clickText(page, T('calibration', 'start')); await sleep(500);
    await page.eval(`window.__a11y.liveReset()`);
    await sleep(6000);
    const lr = await live(page, 'calibration 6 s');
    const said = await page.eval(`[...document.querySelectorAll('[role=dialog] [role=status]')].map(e=>e.innerText).join('|')`);
    console.log('  announced:', JSON.stringify(said), said.includes(T('calibration', 'announce.rest')) ? 'OK (contains the German step sentence, once)' : 'MISSING the German step sentence');
    console.log('  dialog scrolls sideways at 1280:', !(await sw(page)));
    await shot(page, 'de-calibration');
    await key(page, 'Escape'); await sleep(500);
    console.log('  after Escape: dialog open =', await page.eval(`!!document.querySelector('[role=dialog]')`), '| focus ->', (await active(page)).name.slice(0, 40));
  });

  await step('schedule: explain takes focus, Not now returns it to the switch', async () => {
    await page.eval(`(() => { const h=[...document.querySelectorAll('main h2')].find(h => h.innerText.trim()===${JSON.stringify(T('background', 'schedule.title'))}); h.closest('section').scrollIntoView({block:'center'}); })()`);
    await ctx.cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'prompt', origin: ctx.rig.url }).catch(() => {});
    const label = T('background', 'schedule.remind.label');
    await clickText(page, label, { sel: 'button[role=switch]' }); await sleep(500);
    const a1 = await active(page);
    console.log('  turn on -> focus on', JSON.stringify(a1.name), a1.name === T('background', 'schedule.explain.allow') ? 'OK' : 'NOT the Allow button');
    await clickText(page, T('background', 'schedule.explain.notNow')); await sleep(400);
    const a2 = await active(page);
    console.log('  Jetzt nicht -> focus on', JSON.stringify(a2.name), label.startsWith(a2.name.replace(/…$/, '').trim()) ? 'OK (the switch)' : 'NOT the switch');
  });

  await step('sharing: Fertig hands focus back to the create button', async () => {
    await clickText(page, T('data', 'sync.toggle'), { sel: 'button[role=switch]' }); await sleep(2500);
    await page.eval(`(() => { const b=[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()===${JSON.stringify(T('sharing', 'create.button'))}); b?.scrollIntoView({block:'center'}); })()`);
    await clickText(page, T('sharing', 'create.button')); await sleep(1500);
    await clickText(page, T('common', 'done')); await sleep(500);
    const a = await active(page);
    console.log('  Fertig -> focus on', JSON.stringify(a.name), a.name === T('sharing', 'create.button') ? 'OK' : 'NOT the create button');
  });

  await step('insights: heat map is one named image, German caption', async () => {
    await tab(page, T('shell', 'tabs.history')); await sleep(800);
    await clickText(page, T('history', 'switch.insights')); await sleep(1500);
    const r = await page.eval(`[...document.querySelectorAll('[role=img]')].map(e => e.tagName + ':' + (e.getAttribute('aria-label') || '').slice(0, 60))`);
    console.log('  role=img elements:', JSON.stringify(r));
    console.log('  caption words present:', await page.eval(`document.body.innerText.includes(${JSON.stringify(T('insights', 'heat.fewer'))}) && document.body.innerText.includes(${JSON.stringify(T('insights', 'heat.more'))})`));
    console.log('  scrolls sideways at 1280:', !(await sw(page)));
    const c = await capture(page, 'de-insights', { root: 'main', tabs: false, shots: false }); console.log(summarize(c, { showTab: false }));
  });

  await step('photo diary: first photo keeps focus on the Take button', async () => {
    await clickText(page, T('photos', 'diary.takeFirst')); await sleep(800);
    await clickText(page, T('photos', 'capture.start'));
    await waitFor(page, `[...document.querySelectorAll('button')].some(b => b.innerText.includes(${JSON.stringify(T('photos', 'capture.takeNow'))}) && !b.disabled)`, 20000);
    await sleep(800);
    await clickText(page, T('photos', 'capture.takeNow')); await sleep(1500);
    await clickText(page, T('photos', 'capture.save')); await sleep(2500);
    const a = await active(page);
    console.log('  after saving the first photo: focus on', JSON.stringify(a.name), '| Take button is', JSON.stringify(T('photos', 'diary.takeThisWeek')), a.name === T('photos', 'diary.takeThisWeek') ? 'OK' : 'NOT the Take button');
  });

  await step('phone width 390: nothing scrolls sideways in German', async () => {
    await phone(page); await sleep(800);
    for (const [name, label] of [['Watch', T('shell', 'tabs.watch')], ['History', T('shell', 'tabs.history')], ['Settings', T('shell', 'tabs.settings')]]) {
      await tab(page, label).catch(() => {}); await sleep(1200);
      console.log(`  ${name} at 390 px: no sideways scroll =`, await sw(page), '| scrollWidth', await page.eval(`document.documentElement.scrollWidth`));
    }
    await desktop(page);
  });

  // The sign-in page, signed out
  await step('sign-in: the "check your inbox" heading takes focus', async () => {
    const p2 = await ctx.page('about:blank', { signedIn: false, seedHistory: false, init });
    await desktop(p2);
    await p2.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/auth/magic-link/request*' }] });
    ctx.cdp.on(async (m) => { if (m.sessionId === p2.sessionId && m.method === 'Fetch.requestPaused') { await p2.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ ok: true })).toString('base64') }); } });
    await p2.send('Page.navigate', { url: ctx.rig.url + '/signin' });
    await waitFor(p2, `document.getElementById('signin-email')`, 20000); await sleep(800);
    await p2.eval(`document.getElementById('signin-email').focus()`);
    for (const ch of 'a11y@example.test') { await p2.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }); await p2.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
    await key(p2, 'Enter'); await sleep(1500);
    const a = await active(p2);
    console.log('  after sending: focus on', JSON.stringify(a.name), a.name === T('auth', 'sent.title') ? 'OK (the heading)' : 'NOT the heading');
    await p2.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    console.log('  sign-in at 390 px: no sideways scroll =', await sw(p2));
    const c = await capture(p2, 'de-signin-sent', { root: 'main', tabs: false, shots: false }); console.log(summarize(c, { showTab: false }));
  });
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
