import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag, SP } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const rigj = JSON.parse(readFileSync(join(SP, 'rig.json'), 'utf8'));
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 400)); } };
const nav = async (page, url, ready = 'document.body') => { await page.send('Page.navigate', { url }); await sleep(300); await waitFor(page, ready, 20000); await sleep(1200); };
try {
  const page = await ctx.page('about:blank', { signedIn: false, seedHistory: false });
  await desktop(page);

  await step('signin', async () => {
    await nav(page, ctx.rig.url + '/signin', `document.querySelector('h1')`);
    console.log('signin h1:', await page.eval(`document.querySelector('h1').innerText`), '| providers:', await page.eval(`[...document.querySelectorAll('main a')].map(a=>a.innerText.trim()).join(' / ')`));
    const c = await capture(page, 'signin-default', { root: 'body', tabs: true });
    console.log(summarize(c));
    const ax = await axeRun(page, {}); console.log(axeSummary('signin', ax, { showIncomplete: true })); save('axe-signin', ax);
    const lm = await axTree(page, { all: true });
    console.log('signin landmarks/headings:', JSON.stringify(lm.nodes.filter((n) => ['main', 'banner', 'heading', 'form', 'contentinfo', 'navigation'].includes(n.role)).map((n) => n.role + ':' + n.name)));
    await setReduced(page, true); console.log('anims reduced:', JSON.stringify(await animations(page))); await setReduced(page, false);
  });

  await step('signin email flow', async () => {
    await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/auth/magic-link/request*' }] });
    ctx.cdp.on(async (m) => { if (m.sessionId === page.sessionId && m.method === 'Fetch.requestPaused') { await page.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from('{"ok":true}').toString('base64') }); } });
    await nav(page, ctx.rig.url + '/signin', `document.getElementById('signin-email')`);
    await page.eval(`document.getElementById('signin-email').focus()`);
    await shot(page, 'signin-focus-email');
    console.log('email focus style:', await page.eval(`(() => { const e = document.getElementById('signin-email'); const cs = getComputedStyle(e); return e.matches(':focus-visible') + ' ' + cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor; })()`));
    // type via real key events
    for (const ch of 'a11y@example.test') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
    await page.eval(`window.__a11y.liveReset()`);
    await key(page, 'Enter'); await sleep(1200);
    console.log('after submit: focus ->', (await active(page)).name.slice(0, 40), '| sent heading:', await page.eval(`!![...document.querySelectorAll('h2')].find(h=>h.innerText==='Check your inbox')`));
    const lr = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.liveReport())`)); console.log('  live:', JSON.stringify(lr.map((x) => `${x.region} x${x.changes} "${x.sample.slice(0, 50)}"`)));
    await shot(page, 'signin-sent');
    await tag(page, 'Check your inbox', 'div[role=status]', 'sent');
    console.log(summarize(await capture(page, 'signin-sent', { root: '[data-a11y=sent]', tabs: false, shots: false })));
    await page.send('Fetch.disable');
  });

  await step('signin token+error', async () => {
    await nav(page, ctx.rig.url + '/signin#t=' + 'A'.repeat(43), `document.querySelector('h1')`);
    console.log('token state h1:', await page.eval(`document.querySelector('h1').innerText`));
    console.log(summarize(await capture(page, 'signin-finish', { root: 'main', tabs: false })));
    await nav(page, ctx.rig.url + '/signin?error=cancelled&provider=apple', `document.querySelector('[role=alert]')`);
    console.log('error alert:', await page.eval(`document.querySelector('[role=alert]').innerText`));
    console.log(summarize(await capture(page, 'signin-error', { root: 'main', tabs: false })));
  });

  await step('share page', async () => {
    const url = rigj.share.body.url;
    for (const [w, label, mobile] of [[1280, 'desktop', false], [390, 'phone', true]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await nav(page, url, `document.querySelector('h1')`);
      console.log(`share page ${label}: title=${await page.eval(`document.title`)} | h1=${await page.eval(`document.querySelector('h1')?.innerText`)} | scrollWidth ${await page.eval(`document.documentElement.scrollWidth`)} / ${w}`);
      const c = await capture(page, 'share-' + label, { root: 'body', tabs: label === 'desktop' });
      console.log(summarize(c));
      const ax = await axeRun(page, {}); console.log(axeSummary('share ' + label, ax, { showIncomplete: true })); save('axe-share-' + label, ax);
    }
    await desktop(page);
    const lm = await axTree(page, { all: true });
    console.log('share landmarks/headings/img:', JSON.stringify(lm.nodes.filter((n) => ['main', 'banner', 'heading', 'img', 'contentinfo', 'navigation', 'table', 'figure', 'region', 'list'].includes(n.role)).map((n) => n.role + ':' + (n.name || '').slice(0, 70))));
    await setReduced(page, true); console.log('share anims reduced:', JSON.stringify(await animations(page))); await setReduced(page, false);
    // dead token: the branded 404
    await nav(page, ctx.rig.url + '/share/' + 'Z'.repeat(43), `document.body`);
    console.log('dead link: status text:', await page.eval(`document.body.innerText.replace(/\\s+/g,' ').slice(0,160)`));
    const ax404 = await axeRun(page, {}); console.log(axeSummary('share 404', ax404));
  });
  save('a9_public', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
