import { boot, sleep, shot, desktop, phone, waitFor, save, setTheme, setReduced, key, active, capture, summarize, animations, axTree, tabWalk, clickText, tab, tag } from './lib2.mjs';
import { axeRun, axeSummary } from './axe.mjs';
const ctx = await boot();
const R = {};
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`!! step ${name} failed:`, String(e).slice(0, 300)); } };
try {
  const init = `localStorage.setItem('pwa_install_dismissed','1');`;
  const page = await ctx.page(ctx.rig.url + '/', { init });
  await desktop(page);
  await waitFor(page, `document.querySelector('nav')`, 20000);
  await sleep(800);
  await tab(page, 'Settings'); await sleep(2500);

  await step('capture', async () => {
    const s = await capture(page, 'settings-all', { root: 'main', tabs: false });
    console.log(summarize(s));
    for (const dark of [false, true]) {
      await setTheme(page, dark); await sleep(300);
      const ax = await axeRun(page, {});
      save('axe-settings-' + (dark ? 'dark' : 'light'), ax);
      console.log(axeSummary('settings ' + (dark ? 'dark' : 'light'), ax, { showIncomplete: !dark }));
    }
    await setTheme(page, false);
  });

  // Every focus stop: does it have an indicator?
  await step('tabwalk', async () => {
    await page.eval(`window.scrollTo(0,0); document.activeElement && document.activeElement.blur()`);
    const walk = await tabWalk(page, { max: 220 });
    R.settingsWalk = walk.length;
    const noind = walk.filter((s) => (s.outline.startsWith('none') || s.outline.startsWith('0')) && !s.boxShadow);
    const nofv = walk.filter((s) => !s.fv);
    console.log(`settings tab walk: ${walk.length} stops; without outline/shadow: ${noind.length}; :focus-visible false: ${nofv.length}`);
    for (const s of noind.slice(0, 15)) console.log('   NO-INDICATOR', s.sel, '"' + s.name + '"', s.outline);
    const patterns = {};
    for (const s of walk) { const k = s.outline + ' | ' + (s.boxShadow ? 'shadow' : ''); patterns[k] = (patterns[k] || 0) + 1; }
    console.log('   indicator patterns', JSON.stringify(patterns));
    console.log('   order:', walk.map((s) => s.name.slice(0, 22)).join(' | '));
    R.walk = walk;
  });

  // switches: contrast of the track and thumb in both states
  await step('switches', async () => {
    const measure = `(async () => {
      const out = [];
      const sws = [...document.querySelectorAll('[role=switch]')].filter(window.__a11y.visible);
      for (const sw of sws) {
        const track = [...sw.querySelectorAll('span')].find((s) => getComputedStyle(s).borderRadius !== '0px' && s.children.length === 1) || sw.querySelector('span');
        const thumb = track && track.firstElementChild;
        const rgba = window.__a11y.rgba, ratio = window.__a11y.ratio, over = window.__a11y.over;
        const bd = window.__a11y.backdrop(sw.parentElement || sw).color;
        const t = rgba(getComputedStyle(track).backgroundColor);
        const th = thumb ? rgba(getComputedStyle(thumb).backgroundColor) : null;
        const tc = over(t, bd);
        out.push({ name: (sw.getAttribute('aria-label') || sw.innerText).trim().slice(0, 36), checked: sw.getAttribute('aria-checked'), trackVsSurround: Math.round(ratio(tc, bd) * 100) / 100, thumbVsTrack: th ? Math.round(ratio(over(th, tc), tc) * 100) / 100 : null });
      }
      return JSON.stringify(out);
    })()`;
    for (const dark of [false, true]) {
      await setTheme(page, dark); await sleep(300); await page.eval(`window.__a11y.settle(true)`);
      R['switches_' + (dark ? 'dark' : 'light')] = JSON.parse(await page.eval(measure));
      console.log('switches', dark ? 'dark' : 'light', JSON.stringify(R['switches_' + (dark ? 'dark' : 'light')]));
    }
    await setTheme(page, false);
  });

  // radio group arrow keys
  await step('radios', async () => {
    const info = await page.eval(`JSON.stringify([...document.querySelectorAll('[role=radiogroup]')].map(g => ({ label: g.getAttribute('aria-label'), n: g.querySelectorAll('[role=radio]').length, checked: [...g.querySelectorAll('[role=radio]')].findIndex(r => r.getAttribute('aria-checked')==='true'), tabbable: [...g.querySelectorAll('[role=radio]')].filter(r => r.tabIndex===0).length })))`);
    console.log('radiogroups', info);
    // sound picker: focus the checked radio and press ArrowRight / Home / End
    await page.eval(`(() => { const g = document.querySelector('[role=radiogroup][aria-label="Alarm sound"]'); g.scrollIntoView({block:'center'}); [...g.querySelectorAll('[role=radio]')].find(r => r.tabIndex===0).focus(); })()`);
    const read = () => page.eval(`(() => { const g = document.querySelector('[role=radiogroup][aria-label="Alarm sound"]'); const rs=[...g.querySelectorAll('[role=radio]')]; return JSON.stringify({checked: rs.findIndex(r=>r.getAttribute('aria-checked')==='true'), focus: rs.findIndex(r=>r===document.activeElement)}); })()`);
    console.log('  start', await read());
    await key(page, 'ArrowRight'); console.log('  ArrowRight', await read());
    await key(page, 'End'); console.log('  End', await read());
    await key(page, 'Home'); console.log('  Home', await read());
    await key(page, 'ArrowLeft'); console.log('  ArrowLeft (wrap?)', await read());
    await key(page, 'ArrowRight'); await key(page, 'Home');
  });

  // coaching slider
  await step('slider', async () => {
    await page.eval(`(() => { const s = document.querySelector('input[type=range][aria-label="Length of the prompt in seconds"]'); s.scrollIntoView({block:'center'}); s.focus(); })()`);
    const read = () => page.eval(`(() => { const s = document.querySelector('input[type=range][aria-label="Length of the prompt in seconds"]'); return s.value + ' / vt=' + s.getAttribute('aria-valuetext'); })()`);
    console.log('slider start', await read());
    await key(page, 'ArrowRight'); console.log('  ArrowRight', await read());
    await key(page, 'End'); console.log('  End', await read());
    await key(page, 'Home'); console.log('  Home', await read());
    const sl = await axTree(page, { all: true });
    console.log('  AX slider:', JSON.stringify(sl.nodes.filter((n) => n.role === 'slider').map((n) => ({ name: n.name, value: n.value, props: n.props }))));
  });
  save('a4_settings', R);
} catch (e) { console.error('FAIL', e); } finally { ctx.close(); process.exit(0); }
