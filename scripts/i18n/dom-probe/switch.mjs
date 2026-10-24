// usage: node scripts/i18n/dom-probe/switch.mjs <port> <dist> <locale: es|de|pt-BR>
//
// The live switch, in a real browser, without a reload: opens the signed-in app in English with the locale flags on, picks the language
// in Settings > Account & Sync > Language, waits for the catalog, and then for Watch, History, Insights and Settings
//   * lists the lines of text that are still exactly what English showed (candidates for text that never went through t(),
//     or that is the same word in both languages: brand names, numbers and loan words are filtered out), and
//   * picks English again and checks every screen's HTML is exactly what it was before (nothing stale, nothing left over).
// Also reports <html lang> at each step and whether the page reloaded (it must not).
import { launchChrome, CDP, openPage, sleep } from '../../background-probe/cdp.mjs';
import { startRig } from '../../background-probe/rig.mjs';

const [portArg, dist, locale] = process.argv.slice(2);
const port = Number(portArg);
const NATIVE = { es: 'Español', de: 'Deutsch', 'pt-BR': 'Português (Brasil)', en: 'English' };
const FLAGS = 'locale_es,locale_de,locale_pt_br,detection_behaviors,hrt_coaching,urge_timer,false_positive_controls,event_sync,data_backup,insights,photo_diary,weekly_email,background_watching,free_tier,lifetime_plan,gift_plan,referrals,share_links';

const rig = await startRig({ dist, port, flags: FLAGS });
const chrome = await launchChrome({ port: port + 1000, headless: 'new' });
const cdp = new CDP(chrome.wsUrl);
await cdp.ready;

const lines = (page) => page.eval(`(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (el && ['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) continue; out.push(t); } for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) for (const a of ['aria-label','title','placeholder','alt']) { const v = el.getAttribute(a); if (v && v.trim()) out.push('@' + a + ': ' + v.trim()); } return out; })()`);
const html = (page) => page.eval('document.body.innerHTML.replace(/\\d+/g, "0").replace(/ref=[A-Z0-9]+/g, "ref=X").replace(/ style=""/g, "").replace(/_r_[a-z0-9]+_/g, "_r_")');
const nav = (page, i) => page.eval(`(() => { const b = [...document.querySelectorAll('nav button')][${i}]; if (b) b.click(); })()`, { userGesture: true }).then(() => sleep(2500));
const clickText = (page, text) => page.eval(`(() => { const b = [...document.querySelectorAll('button,[role=radio],a')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`, { userGesture: true });
const insightsLabel = { en: 'Insights', es: 'Análisis', de: 'Einblicke', 'pt-BR': 'Análises' };

const WORDS = /[\p{L}][\p{L}'’-]{1,}/gu;
const BRAND = new Set(['Stop', 'Biting', 'Google', 'Apple', 'Microsoft', 'Paddle', 'PWA', 'iOS', 'Rig', 'User', 'RU', 'AM', 'PM', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

async function snapshot(page) {
  const out = {};
  await nav(page, 0); console.log('   [active tab button]', await page.eval(`[...document.querySelectorAll('nav button[aria-current]')].map((b) => b.innerText.trim()).join('|')`), '| nav buttons:', await page.eval(`document.querySelectorAll('nav button').length`)); out.watch = { lines: await lines(page), html: await html(page) };
  await nav(page, 1); out.history = { lines: await lines(page), html: await html(page) };
  if (await clickText(page, insightsLabel[await page.eval('window.__lang = document.documentElement.lang')] ?? 'Insights')) { await sleep(2000); out.insights = { lines: await lines(page), html: await html(page) }; await nav(page, 1); }
  await nav(page, 2); out.settings = { lines: await lines(page), html: await html(page) };
  return out;
}

try {
  const page = await openPage(cdp, 'about:blank');
  await page.send('Network.enable');
  await page.send('Network.setCookie', { name: 'nh_session', value: rig.token, url: rig.url, httpOnly: true });
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('onboarding_v1_done', '1'); localStorage.removeItem('sb:i18n:locale'); } catch {}` });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.send('Page.navigate', { url: rig.url + '/' });
  await sleep(8000);
  await page.eval('window.__noReload = 1');
  console.log('start: <html lang>', await page.eval('document.documentElement.lang'));

  const english1 = await snapshot(page);

  await nav(page, 2);
  const picked = await clickText(page, NATIVE[locale]);
  await sleep(2500);
  console.log(`picked ${locale}:`, picked, '| <html lang>', await page.eval('document.documentElement.lang'), '| page not reloaded:', await page.eval('window.__noReload === 1'));
  const foreign = await snapshot(page);
  console.log('<html lang> after tour:', await page.eval('document.documentElement.lang'), '| stored:', await page.eval(`localStorage.getItem('sb:i18n:locale')`));

  for (const screen of Object.keys(foreign)) {
    const en = new Set(english1[screen]?.lines ?? []);
    const same = foreign[screen].lines.filter(l => en.has(l) && (l.match(WORDS) ?? []).some(w => w.length >= 3 && !BRAND.has(w)));
    const uniq = [...new Set(same)];
    console.log(`\n--- ${screen}: ${foreign[screen].lines.length} lines, ${uniq.length} identical to English (check: loan words, names, or untranslated):`);
    for (const l of uniq.slice(0, 40)) console.log('   ' + l.slice(0, 110));
  }

  await nav(page, 2);
  await clickText(page, NATIVE.en);
  await sleep(2000);
  console.log('\nback to English: <html lang>', await page.eval('document.documentElement.lang'), '| page not reloaded:', await page.eval('window.__noReload === 1'));
  const english2 = await snapshot(page);
  for (const screen of Object.keys(english1)) {
    const a = english1[screen].html, b = english2[screen]?.html ?? '';
    if (a === b) console.log('SAME as before   ', screen);
    else { let i = 0; while (i < a.length && a[i] === b[i]) i++; console.log('DIFFERENT        ', screen, 'at', i, '\n   before:', a.slice(Math.max(0, i - 60), i + 100), '\n   after: ', b.slice(Math.max(0, i - 60), i + 100)); }
  }
} finally {
  cdp.close(); chrome.close(); rig.stop();
}
process.exit(0);
