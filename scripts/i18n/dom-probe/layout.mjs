// usage: node scripts/i18n/dom-probe/layout.mjs <port> <dist> <locale: es|de|pt-BR> <outDir> [extraFlags]
//
// German and Portuguese run long. Opens the signed-in app from a build in headless Chrome with that language picked
// (kv i18n/locale in localStorage, flag on for the throwaway user's server), at 390 px and 1280 px, light, and for each
// screen reports what no longer fits: the page scrolling sideways, boxes sticking out past the right edge, and text that
// a box clips (overflow hidden / ellipsis). Writes a full-page screenshot per screen into outDir and prints the findings.
// For eyeballing the screenshots and fixing the findings; nothing here is a pass/fail gate.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome, CDP, openPage, sleep } from '../../background-probe/cdp.mjs';
import { startRig } from '../../background-probe/rig.mjs';

const [portArg, dist, locale, outDir, extra = ''] = process.argv.slice(2);
const port = Number(portArg);
mkdirSync(outDir, { recursive: true });
const FLAGS = ['locale_es', 'locale_de', 'locale_pt_br', 'detection_behaviors', 'hrt_coaching', 'urge_timer', 'false_positive_controls', 'event_sync', 'data_backup', 'insights', 'photo_diary',
  'weekly_email', 'phone_companion', 'background_watching', 'signin_magic_link', 'signin_apple', 'signin_microsoft', 'free_tier', 'lifetime_plan', 'gift_plan', 'referrals', 'share_links', extra]
  .filter(Boolean).join(',');

const FIND = `(() => {
  const vw = document.documentElement.clientWidth;
  const issues = [];
  const name = (el) => (el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label').slice(0, 30) + ']' : '') + ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50) + '"');
  if (document.documentElement.scrollWidth > vw + 1) issues.push('PAGE SCROLLS SIDEWAYS: scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw);
  const scrollable = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > vw + 1 && cs.position !== 'fixed' && !scrollable(el)) issues.push('past right edge by ' + Math.round(r.right - vw) + 'px: ' + name(el));
    const clips = cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
    if (clips && el.clientWidth > 2 && el.clientHeight > 2 && el.scrollWidth > el.clientWidth + 1 && (el.textContent || '').trim()) issues.push('clipped text (' + el.scrollWidth + ' > ' + el.clientWidth + '): ' + name(el));
    if (el.matches('button,[role=tab],[role=radio]') && el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden') issues.push('button content taller than the button: ' + name(el));
  }
  return [...new Set(issues)].slice(0, 40);
})()`;

const rig = await startRig({ dist, port, flags: FLAGS });
const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;

const click = (page, text) => page.eval(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.innerText.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
const tabs = (page) => page.eval(`[...document.querySelectorAll('nav button')].map((b) => b.innerText.trim())`);
const clickNav = (page, index) => page.eval(`(() => { const b = [...document.querySelectorAll('nav button')][${index}]; if (b) b.click(); })()`, { userGesture: true });

async function shot(page, name) {
  const { contentSize } = await page.send('Page.getLayoutMetrics');
  const h = Math.min(Math.ceil(contentSize.height), 6000);
  const w = Math.ceil(contentSize.width);
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  writeFileSync(join(outDir, `${locale}-${name}.png`), Buffer.from(r.data, 'base64'));
}

try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); localStorage.setItem('sb:i18n:locale', JSON.stringify(${JSON.stringify(locale)})); } catch {}` });
  for (const [mode, width, height] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.send('Page.navigate', { url: rig.url + '/' });
    await sleep(9000);
    const lang = await page.eval('document.documentElement.lang');
    console.log(`\n=== ${locale} ${mode}: <html lang="${lang}">, tabs: ${JSON.stringify(await tabs(page))}`);
    const report = async (name) => {
      await sleep(1200);
      const issues = await page.eval(FIND);
      console.log(`--- ${name}: ${issues.length ? '' : 'nothing sticks out'}`);
      for (const i of issues) console.log('   ' + i);
      await shot(page, `${mode}-${name}`);
    };
    await report('watch');
    await clickNav(page, 1); await report('history');
    if (await click(page, locale === 'de' ? 'Einblicke' : locale === 'es' ? 'Análisis' : 'Análises')) { await sleep(2000); await report('insights'); }
    await clickNav(page, 2); await report('settings');
    await clickNav(page, 0);
    // the voluntary upgrade page: the sidebar pill (desktop) or the "choose a plan" link (phone width)
    const upgraded = await page.eval(`(() => { const labels = ['Upgrade', 'Mejorar plan', 'Fazer upgrade', 'Choose a plan', 'Tarif wählen', 'Elegir un plan', 'Escolher um plano']; const b = [...document.querySelectorAll('button,a')].find((x) => labels.includes(x.innerText.trim())); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
    if (upgraded) { await sleep(2500); await report('paywall'); }
  }
  // the phone view
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send('Page.navigate', { url: rig.url + '/' });
  await sleep(7000);
  console.log(`\n=== ${locale} phone view`);
  const issues = await page.eval(FIND);
  console.log(`--- phoneview: ${issues.length ? '' : 'nothing sticks out'}`);
  for (const i of issues) console.log('   ' + i);
  await shot(page, 'phoneview');
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  // the sign-in page
  await page.send('Network.clearBrowserCookies');
  for (const [mode, width, height] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: rig.url + '/signin' });
    await sleep(3500);
    const found = await page.eval(FIND);
    console.log(`\n=== ${locale} signin ${mode}: ${found.length ? '' : 'nothing sticks out'}`);
    for (const i of found) console.log('   ' + i);
    await shot(page, `${mode}-signin`);
  }
} finally {
  cdp.close(); chrome.close(); rig.stop();
}
process.exit(0);
