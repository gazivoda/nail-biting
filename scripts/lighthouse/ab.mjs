#!/usr/bin/env node
// Lighthouse A/B: two or more built checkouts (a base and a head), each served by its OWN real server.js on a local port,
// the same pages measured alternately (base, head, base, head ...) so machine load drifts across all of them equally.
//
//   node scripts/lighthouse/ab.mjs --base /path/to/base-checkout --head . \
//        (or --roots base=/path/a,v1=/path/b,v2=. for more than two builds)\
//        [--pages /blog/nail-biting-health-risks,/pricing] [--runs 3] [--ff mobile] [--port 3310] [--out DIR]
//        [--block '*googletagmanager*'] [--devtools]    (diagnostics: block a URL pattern; throttle in Chrome, not in the simulation)
//
// Each checkout needs a built dist/ (npm run build:web). FEATURE_FLAGS is empty (the production default).
// Writes <out>/ab.json (every run, the median and the LCP element of each run) and prints a table.
// Lab numbers from one laptop in Lighthouse's simulated slow phone: a before/after on the same machine, not a field
// (CrUX / Core Web Vitals) measurement.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startServer, launchChrome } from '../privacy-audit/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
if (!(args.base && args.head) && typeof args.roots !== 'string') { console.error('usage: ab.mjs --base <checkout> --head <checkout> [--pages /a,/b] [--runs 3] [--ff mobile|desktop]'); process.exit(2); }
const ROOTS = typeof args.roots === 'string'
  ? args.roots.split(',').map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i), resolve(kv.slice(i + 1))]; })
  : [['base', resolve(args.base)], ['head', resolve(args.head)]];
const PAGES = (typeof args.pages === 'string' ? args.pages : '/blog/nail-biting-health-risks,/blog/how-to-stop-nail-biting,/pricing,/').split(',');
const RUNS = Number(args.runs ?? 3);
const FF = args.ff ?? 'mobile';
const PORT = Number(args.port ?? 3310);
const OUT = resolve(args.out ?? join(process.cwd(), 'lighthouse-ab'));
const BLOCK = typeof args.block === 'string' ? args.block : null;
const DEVTOOLS = args.devtools === true;

const median = (xs) => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function lighthouse(url, file, chromePort) {
  const a = ['--yes', 'lighthouse', url, `--port=${chromePort}`, '--only-categories=performance', '--output=json', `--output-path=${file}`, '--quiet',
    ...(FF === 'desktop' ? ['--preset=desktop'] : []), ...(BLOCK ? [`--blocked-url-patterns=${BLOCK}`] : []), ...(DEVTOOLS ? ['--throttling-method=devtools'] : [])];
  const child = spawn('npx', a, { stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', d => { text += d; });
  child.stderr.on('data', d => { text += d; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 240000);
  const status = await new Promise(resolve => child.on('exit', resolve));
  clearTimeout(timer);
  if (status !== 0) return { error: `exit ${status}: ${text.split('\n').filter(l => !l.startsWith('npm warn')).join(' | ').slice(-500)}` };
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const au = j.audits;
  const metrics = au.metrics?.details?.items?.[0] ?? {};
  // The LCP element and its subparts: Lighthouse 13 puts them in the LCP breakdown insight (a table, then a node).
  const lcpParts = au['lcp-breakdown-insight']?.details?.items ?? [];
  const node = lcpParts.find(i => i.type === 'node');
  const t0 = (au['network-requests']?.details?.items ?? [])[0]?.networkRequestTime ?? 0;
  const requests = (au['network-requests']?.details?.items ?? []).map(r => ({
    url: r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90), start: Math.round(r.networkRequestTime - t0), end: Math.round(r.networkEndTime - t0),
    transferKb: +(r.transferSize / 1024).toFixed(1), sizeKb: +(r.resourceSize / 1024).toFixed(1), type: r.resourceType, priority: r.priority,
    preload: r.isLinkPreload ?? false,
  }));
  return {
    performance: Math.round(j.categories.performance.score * 100),
    lcpMs: Math.round(au['largest-contentful-paint'].numericValue), cls: +au['cumulative-layout-shift'].numericValue.toFixed(3),
    tbtMs: Math.round(au['total-blocking-time'].numericValue), fcpMs: Math.round(au['first-contentful-paint'].numericValue),
    observedLcpMs: metrics.observedLargestContentfulPaint ?? null, observedFcpMs: metrics.observedFirstContentfulPaint ?? null,
    lcpElement: node ? { selector: node.selector, snippet: (node.snippet ?? '').slice(0, 160) } : null,
    lcpBreakdown: (lcpParts.find(i => i.type === 'table')?.items ?? []).map(i => ({ subpart: i.subpart, ms: Math.round(i.duration) })),
    requests,
    version: j.lighthouseVersion,
  };
}

mkdirSync(join(OUT, 'raw'), { recursive: true });
const servers = {};
let port = PORT;
for (const [label, root] of ROOTS) servers[label] = await startServer({ root, port: port++ });
const chromePort = PORT + 500;
const chrome = await launchChrome({ port: chromePort });
const results = [];
try {
  for (const path of PAGES) {
    const per = Object.fromEntries(ROOTS.map(([label]) => [label, []]));
    for (let i = 0; i < RUNS; i++) {
      for (const [label] of ROOTS) {
        const r = await lighthouse(`${servers[label].origin}${path}`, join(OUT, 'raw', `${label}-${path.replace(/\W+/g, '_')}-${i}.json`), chromePort);
        per[label].push(r);
        console.log(`${label.padEnd(4)} ${path} #${i + 1}: ${r.error ? `ERROR ${r.error}` : `perf ${r.performance} LCP ${r.lcpMs} (observed ${r.observedLcpMs}) FCP ${r.fcpMs} CLS ${r.cls} TBT ${r.tbtMs} el=${r.lcpElement?.selector}`}`);
      }
    }
    for (const [label] of ROOTS) {
      const ok = per[label].filter(r => !r.error);
      results.push({ path, label, formFactor: FF, runs: per[label],
        median: ok.length ? Object.fromEntries(['performance', 'lcpMs', 'cls', 'tbtMs', 'fcpMs', 'observedLcpMs'].map(k => [k, median(ok.map(r => r[k]))])) : null });
    }
  }
} finally {
  chrome.close();
  for (const s of Object.values(servers)) await s.stop();
}
writeFileSync(join(OUT, 'ab.json'), JSON.stringify({ at: new Date().toISOString(), runs: RUNS, formFactor: FF, roots: Object.fromEntries(ROOTS), results }, null, 1));
console.log(`\nmedian of ${RUNS} (${FF}) | page | build | perf | LCP ms | FCP ms | CLS | TBT ms | LCP element`);
for (const r of results) {
  const m = r.median;
  console.log(`${r.path} | ${r.label} | ${m ? [m.performance, m.lcpMs, m.fcpMs, m.cls, m.tbtMs].join(' | ') : 'ERROR'} | ${[...new Set(r.runs.map(x => x.lcpElement?.selector))].join(', ')}`);
}
