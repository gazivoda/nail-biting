// Real-browser checks of the MARKETING pages (WS12b), headless Chrome over CDP, against a throwaway copy of the real server.
//
//   node scripts/i18n/dom-probe/site.mjs compare <port> <distMain> <distThis> [outDir]
//       "With every locale flag off the English pages are what they were": loads / /pricing /how-it-works /about from main's
//       build and this branch's, signed out, with no flag, at 1280 px and 390 px, and compares the DOM (digits masked, hashed
//       asset names masked). Prints SAME or the first difference per page.
//
//   node scripts/i18n/dom-probe/site.mjs layout <port> <dist> <locale es|de|pt-BR> <outDir>
//       The localized pages in that language, flag on and reviewed (the same copies of dist/i18n/*.json the integration test
//       makes, via SB_I18N_DIR), at 390 px and 1280 px: <html lang>, a console with no errors, the page scrolling sideways, boxes
//       sticking out past the right edge, clipped text, the switcher (links, the stored pick), the demo's first click.
//       Writes a screenshot per page into outDir. For eyeballing; the findings are printed, nothing here is a pass/fail gate.
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchChrome, CDP, openPage, sleep } from '../../background-probe/cdp.mjs';
import { startRig } from '../../background-probe/rig.mjs';

const [mode, portArg, ...rest] = process.argv.slice(2);
const port = Number(portArg);

const mask = html => html.replace(/\d+/g, '0').replace(/blob:[^"']+/g, 'blob:x')
  .replace(/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{6,}\.(js|css)/g, 'assets/x.$1').replace(/_r_[a-z0-9]+_/g, '_r_');

const FIND = `(() => {
  const vw = document.documentElement.clientWidth;
  const issues = [];
  const name = (el) => (el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label').slice(0, 30) + ']' : '') + ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50) + '"');
  if (document.documentElement.scrollWidth > vw + 1) issues.push('PAGE SCROLLS SIDEWAYS: scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw);
  const scrollable = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const hiddenByAncestor = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (hiddenByAncestor(el)) continue;
    const cs = getComputedStyle(el);
    if (r.right > vw + 1 && cs.position !== 'fixed' && !scrollable(el) && !el.closest('[aria-hidden="true"]')) issues.push('past right edge by ' + Math.round(r.right - vw) + 'px: ' + name(el));
    const clips = cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
    if (clips && el.clientWidth > 2 && el.clientHeight > 2 && el.scrollWidth > el.clientWidth + 1 && (el.textContent || '').trim() && !el.closest('[aria-hidden="true"]') && !el.matches('.sg-hero, .sg-hero *')) issues.push('clipped text (' + el.scrollWidth + ' > ' + el.clientWidth + '): ' + name(el));
    if (el.matches('button,a.sg-btn,[role=tab]') && el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden') issues.push('button content taller than the button: ' + name(el));
  }
  return [...new Set(issues)].slice(0, 40);
})()`;

async function withBrowser(url, flagsEnv, dist, fn) {
  const rig = await startRig({ dist, port, flags: flagsEnv });
  const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
  const cdp = new CDP(chrome.wsUrl);
  await cdp.ready;
  try {
    const page = await openPage(cdp, 'about:blank');
    const errors = [];
    cdp.on(msg => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`console: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    });
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Network.enable');
    await page.send('Page.enable');
    return await fn({ page, rig, errors, cdp });
  } finally {
    cdp.close(); chrome.close(); rig.stop();
  }
}

async function shot(page, outDir, name) {
  const { contentSize } = await page.send('Page.getLayoutMetrics');
  const h = Math.min(Math.ceil(contentSize.height), 7000);
  const w = Math.ceil(contentSize.width);
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.data, 'base64'));
}

const PAGES = ['/', '/pricing', '/how-it-works', '/about'];

if (mode === 'compare') {
  const [distMain, distThis, outDirArg] = rest;
  const outDir = outDirArg ?? join(tmpdir(), 'ws12b-dom');
  mkdirSync(outDir, { recursive: true });
  const capture = async (dist, p) => {
    const saved = port;
    void saved;
    const rig = await startRig({ dist, port: p, flags: '' });
    const chrome = await launchChrome({ port: p + 1000, headless: 'new' });
    const cdp = new CDP(chrome.wsUrl);
    await cdp.ready;
    const out = {};
    try {
      const page = await openPage(cdp, 'about:blank');
      await page.send('Page.enable');
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); } catch {}` });
      for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
        await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
        for (const path of PAGES) {
          await page.send('Page.navigate', { url: rig.url + path });
          await sleep(5000);
          out[`${name} ${path}`] = mask(await page.eval('document.documentElement.outerHTML'));
        }
      }
    } finally { cdp.close(); chrome.close(); rig.stop(); }
    return out;
  };
  const a = await capture(distMain, port);
  const b = await capture(distThis, port + 1);
  let different = 0;
  for (const key of Object.keys(a)) {
    if (a[key] === b[key]) { console.log(`SAME       ${key}`); continue; }
    different += 1;
    let i = 0;
    while (i < a[key].length && a[key][i] === b[key][i]) i += 1;
    console.log(`DIFFERENT  ${key} at ${i}: main ...${a[key].slice(Math.max(0, i - 60), i + 80)}...  this ...${b[key].slice(Math.max(0, i - 60), i + 80)}...`);
    writeFileSync(join(outDir, `${key.replace(/[^a-z0-9]+/gi, '_')}-main.html`), a[key]);
    writeFileSync(join(outDir, `${key.replace(/[^a-z0-9]+/gi, '_')}-this.html`), b[key]);
  }
  console.log(different ? `\n${different} page(s) differ` : '\nall pages SAME');
  process.exit(0);
}

if (mode === 'layout') {
  const [dist, locale, outDir] = rest;
  mkdirSync(outDir, { recursive: true });
  const FLAG = { es: 'locale_es', de: 'locale_de', 'pt-BR': 'locale_pt_br' }[locale];
  const PREFIX = { es: 'es', de: 'de', 'pt-BR': 'pt-br' }[locale];
  // reviewed copies of the locale files, as the integration test makes them (the committed marker is untouched)
  const i18n = mkdtempSync(join(tmpdir(), 'sb-i18n-probe-'));
  for (const l of ['es', 'de', 'pt-BR']) {
    const data = JSON.parse(readFileSync(join(dist, 'i18n', `${l}.json`), 'utf8'));
    writeFileSync(join(i18n, `${l}.json`), JSON.stringify({ ...data, reviewed: true }));
  }
  process.env.SB_I18N_DIR = i18n;
  await withBrowser(null, `locale_es,locale_de,locale_pt_br`, dist, async ({ page, rig, errors }) => {
    const paths = ['', '/pricing', '/how-it-works', '/about'].map(p => `/${PREFIX}${p}`);
    for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      for (const path of paths) {
        errors.length = 0;
        await page.send('Page.navigate', { url: rig.url + path });
        await sleep(4500);
        const info = await page.eval(`({ lang: document.documentElement.lang, h1: document.querySelector('h1')?.innerText, ssr: !!document.getElementById('ssr-page-content'), robots: document.querySelector('meta[name=robots]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href, hreflangs: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => l.hreflang).join(','), switcher: [...document.querySelectorAll('footer nav[aria-label] a, footer nav[aria-label] span[aria-current]')].map(a => a.textContent + '->' + (a.getAttribute('href') ?? 'current')).join(' | ') })`);
        const issues = await page.eval(FIND);
        console.log(`\n=== ${locale} ${name} ${path}: ${JSON.stringify(info)}`);
        console.log(`    console errors: ${errors.length ? errors.slice(0, 5).join(' || ') : 'none'}`);
        console.log(`    layout: ${issues.length ? '' : 'nothing sticks out'}`);
        for (const i of issues) console.log('      ' + i);
        await shot(page, outDir, `${locale}-${name}-${path.replace(/\W+/g, '_')}`);
      }
    }
    // the switcher: a click on another language's link keeps the stored pick in step, and lands on the SAME page
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: rig.url + `/${PREFIX}/pricing` });
    await sleep(3500);
    const links = await page.eval(`[...document.querySelectorAll('footer nav[aria-label] a')].map(a => a.getAttribute('href') + ' ' + a.getAttribute('hreflang'))`);
    console.log(`\n=== switcher links on /${PREFIX}/pricing: ${JSON.stringify(links)}`);
    await page.eval(`document.querySelector('footer nav[aria-label] a[hreflang="en"]').click()`, { userGesture: true });
    await sleep(3500);
    console.log(`    after clicking English: ${await page.eval('location.pathname')}, stored pick: ${await page.eval(`localStorage.getItem('sb:i18n:locale')`)}, <html lang>: ${await page.eval('document.documentElement.lang')}`);
    // the demo: the first click on a localized home page
    errors.length = 0;
    await page.send('Page.navigate', { url: rig.url + `/${PREFIX}` });
    await sleep(3500);
    await page.eval(`[...document.querySelectorAll('button')].find(b => b.className.includes('sg-btn-ink'))?.click()`, { userGesture: true });
    await sleep(9000);
    const demo = await page.eval(`(document.querySelector('#live-demo')?.closest('div.grid')?.innerText ?? document.body.innerText).slice(0, 900)`);
    console.log(`\n=== demo after the click on /${PREFIX}\n    errors: ${errors.length ? errors.slice(0, 4).join(' || ') : 'none'}\n    text: ${JSON.stringify(demo)}`);
    await shot(page, outDir, `${locale}-demo`);
  });
  process.exit(0);
}

console.error('usage: site.mjs compare|layout ...');
process.exit(2);
