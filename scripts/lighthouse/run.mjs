#!/usr/bin/env node
// Lighthouse over the marketing pages, mobile and desktop, against the REAL server.js on a local port (never production),
// plus Chrome's installability check with phone_companion off and on (Lighthouse 13 has no PWA category).
//
//   npm run build:web && node scripts/lighthouse/run.mjs [--runs 3] [--port 3213] [--out DIR] [--only /pricing,/about]
//
// Writes <out>/lighthouse.json (every run) and prints a table of the median per page and form factor.
// Numbers from a laptop that is also doing other work are noisy: read the scores as ranges, not as a benchmark.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launchChrome, CDP, sleep, CHROME } from '../privacy-audit/browser.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
const RUNS = Number(args.runs ?? 3);
const PORT = Number(args.port ?? 3213);
const OUT = args.out ?? join(REPO, 'docs', 'agents', 'lighthouse-results');
// The flags that switch on the pages WS11b gated, so they exist to be measured.
const FLAGS = 'compare_competitors,hrt_coaching,urge_timer,phone_companion,share_links,event_sync,referrals,detection_behaviors,social_proof';
const PAGES = [
  ['/', 'home'], ['/how-it-works', 'how-it-works'], ['/pricing', 'pricing'], ['/about', 'about'],
  ['/compare/stop-biting-vs-hands-off', 'compare (existing)'], ['/blog/nail-biting-health-risks', 'blog post'],
  ['/features/habit-reversal-coaching', 'WS11b feature page (hrt_coaching on)'], ['/compare/hands-off', 'WS11a compare page (flag on)'],
];
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const median = (xs) => { const s = xs.filter(x => x !== null && x !== undefined).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// Lighthouse is pointed at a Chrome this script started (--port), as WS13's accessibility pass did: letting Lighthouse
// launch Chrome itself hung on macOS here.
// Asynchronous on purpose: the proxy in front of the server lives in THIS process, and a blocking spawnSync would freeze it.
async function lighthouse(url, formFactor, file, chromePort) {
  const a = ['--yes', 'lighthouse', url, `--port=${chromePort}`, '--only-categories=performance,seo,best-practices,accessibility', '--output=json', `--output-path=${file}`,
    '--quiet', ...(formFactor === 'desktop' ? ['--preset=desktop'] : [])];
  const child = spawn('npx', a, { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', d => { text += d; });
  child.stderr.on('data', d => { text += d; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 240000);
  const status = await new Promise(resolve => child.on('exit', resolve));
  clearTimeout(timer);
  if (status !== 0) return { error: `exit ${status}: ${text.split('\n').filter(l => !l.startsWith('npm warn')).join(' | ').slice(-600)}` };
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const c = j.categories;
  const au = j.audits;
  return {
    performance: Math.round(c.performance.score * 100), seo: Math.round(c.seo.score * 100),
    bestPractices: Math.round(c['best-practices'].score * 100), accessibility: Math.round(c.accessibility.score * 100),
    lcpMs: Math.round(au['largest-contentful-paint'].numericValue), cls: +au['cumulative-layout-shift'].numericValue.toFixed(3),
    tbtMs: Math.round(au['total-blocking-time'].numericValue), fcpMs: Math.round(au['first-contentful-paint'].numericValue),
    version: j.lighthouseVersion,
    failed: Object.values(au).filter(x => x.score === 0 && ['seo', 'best-practices'].some(cat => c[cat].auditRefs.some(r => r.id === x.id))).map(x => x.id),
  };
}

async function installability(flags) {
  const server = await startServer({ root: REPO, port: PORT, flags });
  const chrome = await launchChrome({ port: PORT + 1000 });
  const cdp = new CDP(chrome.wsUrl);
  await cdp.ready;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p) => cdp.send(m, p, sessionId);
    await send('Page.enable');
    await send('Page.navigate', { url: `${server.origin}/` });
    await sleep(6000);
    const errors = await send('Page.getInstallabilityErrors');
    const manifest = await send('Page.getAppManifest');
    return { flags: flags || '(none)', errors: errors.installabilityErrors, manifestUrl: manifest.url, manifestErrors: (manifest.errors ?? []).map(e => e.message), shortcuts: (JSON.parse(manifest.data || '{}').shortcuts ?? []).length };
  } finally { cdp.close(); chrome.close(); await server.stop(); }
}

mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, '.raw');
mkdirSync(tmp, { recursive: true });
const server = await startServer({ root: REPO, port: PORT, flags: FLAGS });
const lhChrome = await launchChrome({ port: PORT + 2000 });
const results = [];
try {
  for (const [path, label] of PAGES) {
    if (only && !only.includes(path)) continue;
    for (const ff of ['mobile', 'desktop']) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await lighthouse(`${server.origin}${path}`, ff, join(tmp, `${label.replace(/\W+/g, '_')}-${ff}-${i}.json`), PORT + 2000);
        runs.push(r);
        console.log(`${path} ${ff} #${i + 1}: ${r.error ? `ERROR ${r.error}` : `perf ${r.performance} seo ${r.seo} bp ${r.bestPractices} a11y ${r.accessibility} LCP ${r.lcpMs}ms CLS ${r.cls} TBT ${r.tbtMs}ms`}`);
      }
      const ok = runs.filter(r => !r.error);
      results.push({ path, label, formFactor: ff, runs, median: ok.length ? Object.fromEntries(['performance', 'seo', 'bestPractices', 'accessibility', 'lcpMs', 'cls', 'tbtMs', 'fcpMs'].map(k => [k, median(ok.map(r => r[k]))])) : null, failedAudits: [...new Set(ok.flatMap(r => r.failed))] });
    }
  }
} finally { lhChrome.close(); await server.stop(); }
const install = [];
for (const flags of ['', 'phone_companion']) { try { install.push(await installability(flags)); } catch (e) { install.push({ flags, error: String(e.message ?? e) }); } }
writeFileSync(join(OUT, 'lighthouse.json'), JSON.stringify({ at: new Date().toISOString(), runs: RUNS, flags: FLAGS, lighthouse: results.find(r => r.runs[0]?.version)?.runs[0].version, results, installability: install }, null, 2));
rmSync(tmp, { recursive: true, force: true });
console.log('\npage | form | perf | seo | best-practices | a11y | LCP ms | CLS | TBT ms');
for (const r of results) console.log(`${r.path} | ${r.formFactor} | ${r.median ? [r.median.performance, r.median.seo, r.median.bestPractices, r.median.accessibility, r.median.lcpMs, r.median.cls, r.median.tbtMs].join(' | ') : 'ERROR'}`);
console.log('\ninstallability', JSON.stringify(install, null, 1));
