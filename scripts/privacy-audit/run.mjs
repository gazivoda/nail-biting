#!/usr/bin/env node
// Privacy audit (WS13). Starts the REAL built app (dist/ served by the real server.js, scratch DATA_DIR, throwaway
// credentials), signs a person in for real, runs detection on a fake camera in headless Chrome for a while, records
// every request the browser makes (bodies included) and FAILS if any could carry image data, landmarks, video, the
// nail photo diary, or goes to a host outside the allowlist. Two modes:
//   off  sync not switched on (event_sync flag is ON but the person did not opt in): zero /api/events/* requests
//   on   the person opted in to sync and logged bites and an urge: only WS4's whitelisted keys go out
//   flagsoff  (optional) FEATURE_FLAGS empty, i.e. production as shipped
//   canary    the audit's own negative control: the page sends images, landmarks and a stranger-bound beacon on purpose
//             and the audit must catch every one (verdict CAUGHT, exit 0), else it is blind (verdict BLIND, exit 1)
//
//   npm run build:web && npm run privacy:audit                       # 5 minutes per mode, modes off and on
//   node scripts/privacy-audit/run.mjs --seconds 45 --mode both     # the smoke
//   options: --mode off|on|both|flagsoff|canary|all  --seconds N  --port 3213  --chrome-port 4213  --out DIR  --root DIR
//            --flags a,b,c  --screens  --min-fps 1.5
// Exit 0 = pass, 1 = a privacy violation was found, 2 = inconclusive (the session could not reach the states the
// audit needs: a pass would have proved nothing).
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startServer, launchChrome, CDP, sleep } from './browser.mjs';
import { Recorder, FRAME_COUNTER_SRC } from './capture.mjs';
import { makePage, runScenario } from './scenario.mjs';
import { evaluate, DEFAULT_ALLOWED_HOSTS } from './check.mjs';
import { CANARY_SRC, CANARY_EXPECTED } from './canary.mjs';
import { loadWhitelist } from './whitelist.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(HERE, '..', '..');

function parseArgs(argv) {
  const a = { mode: 'both', seconds: 300, port: 3213, chromePort: 4213, root: REPO, out: join(REPO, 'docs', 'agents', 'privacy-audit-results'), minFps: 1.5 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--mode') a.mode = v();
    else if (k === '--seconds') a.seconds = Number(v());
    else if (k === '--port') a.port = Number(v());
    else if (k === '--chrome-port') a.chromePort = Number(v());
    else if (k === '--out') a.out = v();
    else if (k === '--root') a.root = v();
    else if (k === '--flags') a.flags = v();
    else if (k === '--min-fps') a.minFps = Number(v());
    else if (k === '--screens') a.screens = true;
    else if (k === '--probe') a.probe = true;
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--help' || k === '-h') { console.log(readHelp()); process.exit(0); }
    else throw new Error(`unknown option ${k}`);
  }
  if (!Number.isFinite(a.seconds) || a.seconds < 10) throw new Error('--seconds must be at least 10');
  return a;
}
const readHelp = () => 'node scripts/privacy-audit/run.mjs [--mode off|on|both|flagsoff|all] [--seconds N] [--port N] [--chrome-port N] [--out DIR] [--root DIR] [--flags a,b] [--screens]';

/** Flags for the sessions where features are switched on (sync is a flag, not yet an opt-in). */
const FEATURE_SET = 'event_sync,data_backup,insights,photo_diary,urge_timer,hrt_coaching,false_positive_controls';

function parseCsp(header) {
  const out = {};
  for (const d of (header ?? '').split(';')) {
    const [name, ...vals] = d.trim().split(/\s+/);
    if (name) out[name] = vals;
  }
  return out;
}

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

async function auditMode(mode, args, log) {
  const flags = mode === 'flagsoff' ? '' : (args.flags ?? FEATURE_SET);
  const canary = mode === 'canary';
  const flagList = flags.split(',').filter(Boolean);
  const judgeMode = mode === 'on' ? 'on' : 'off';
  log(`\n=== mode ${mode}: FEATURE_FLAGS="${flags}", ${args.seconds}s of detection ===`);
  const startedAt = new Date().toISOString();
  const server = await startServer({ root: args.root, port: args.port, flags });
  let chrome; let cdp;
  const result = { mode, flags, seconds: args.seconds, startedAt, origin: server.origin, signedIn: server.signedInCheck === 200 };
  try {
    if (server.signedInCheck !== 200) throw new Error(`the minted session was not accepted by the server (GET /api/user/me -> ${server.signedInCheck})`);
    log(`  server up on ${server.origin}, signed in as ${server.user.email} (GET /api/user/me -> 200)`);
    chrome = await launchChrome({ port: args.chromePort });
    result.chrome = chrome.version;
    cdp = new CDP(chrome.wsUrl);
    await cdp.ready;
    const onboarding = `try { localStorage.setItem('onboarding_v1_done', '1'); } catch (e) {}`;
    const rec = new Recorder(cdp, { initScripts: [FRAME_COUNTER_SRC, onboarding], log });
    await rec.start();

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const sessionId = await rec.attached(targetId);
    const page = makePage(cdp, sessionId, server.origin, log);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send('Network.setCookie', { name: 'nh_session', value: server.token, url: server.origin, httpOnly: true });
    await page.send('Page.navigate', { url: `${server.origin}/` });

    if (canary) {
      await sleep(5000);
      await page.eval(CANARY_SRC);
      await sleep(3000);
      await rec.settle();
      const whitelist = await loadWhitelist(args.root);
      const verdict = evaluate(rec.records, { mode: 'off', origin: server.origin, whitelist });
      const caught = new Set(verdict.findings.filter(f => f.severity === 'fail').map(f => f.code));
      const missing = CANARY_EXPECTED.filter(c => !caught.has(c));
      Object.assign(result, { stats: verdict.stats, findings: verdict.findings, canaryExpected: CANARY_EXPECTED, canaryCaught: [...caught].sort(), canaryMissed: missing });
      result.verdict = missing.length ? 'BLIND' : 'CAUGHT';
      result.exitCode = missing.length ? 1 : 0;
      result.violations = 0;
      log(`  canary: ${CANARY_EXPECTED.length - missing.length}/${CANARY_EXPECTED.length} deliberate leaks caught${missing.length ? `; MISSED: ${missing.join(', ')}` : ''}`);
      log(`  codes seen: ${[...caught].sort().join(', ')}`);
      log(`  => ${result.verdict}`);
      return finish();
    }
    const shotDir = args.screens ? join(args.out, 'screens', mode) : null;
    const scenario = await runScenario({ page, rec, mode, seconds: args.seconds, flags: flagList, log, shotDir, probe: !!args.probe });
    result.probe = !!args.probe;
    await sleep(1000);
    await rec.settle();
    result.scenario = scenario;

    const csp = parseCsp((await fetch(`${server.origin}/`).catch(() => null))?.headers.get('content-security-policy'));
    result.csp = { connectSrc: csp['connect-src'], imgSrc: csp['img-src'], scriptSrc: csp['script-src'], frameSrc: csp['frame-src'], workerSrc: csp['worker-src'] };
    const cspHosts = new Set(Object.values(result.csp).flat().filter(Boolean).map(s => s.replace(/^https?:\/\//, '')));
    const notInCsp = DEFAULT_ALLOWED_HOSTS.filter(h => !cspHosts.has(h.host) && !(h.host.startsWith('*.') && [...cspHosts].some(c => c.endsWith(h.host.slice(1)))));

    const whitelist = await loadWhitelist(args.root);
    const needles = (scenario.photo ?? []).flatMap(p => p.windows.map((w, i) => ({ label: `photo ${p.sha256.slice(0, 8)} window ${i + 1} @byte ${w.at}`, bytes: Buffer.from(w.b64, 'base64') })));
    const verdict = evaluate(rec.records, { mode: judgeMode, origin: server.origin, whitelist, needles });

    // Preconditions: a pass is only worth something if the session reached the states under test.
    const inconclusive = [];
    const need = (ok, code, message) => { if (!ok) inconclusive.push({ severity: 'fail', code, url: '', message, evidence: '' }); };
    const failedRequired = (scenario.steps ?? []).filter(s => !s.ok && s.required);
    need(failedRequired.length === 0, 'inconclusive-step-failed', `required step failed: ${failedRequired.map(s => `${s.name}: ${s.error}`).join('; ')}`);
    const fps = scenario.durationSec ? (scenario.finalFrames - (scenario.frameSamples[0]?.frames ?? 0)) / scenario.durationSec : 0;
    result.detectionFramesPerSecond = +fps.toFixed(2);
    need(fps >= args.minFps, 'inconclusive-detection-idle', `detection fed MediaPipe only ${fps.toFixed(2)} video frames a second (needs ${args.minFps}); the session did not really detect`);
    need((scenario.bitesLogged ?? 0) >= 3, 'inconclusive-no-bites', `only ${scenario.bitesLogged ?? 0} bites could be logged through the UI`);
    if (flagList.includes('urge_timer')) need((scenario.urgeLogged ?? 0) >= 1, 'inconclusive-no-urge', 'no urge could be logged through the UI');
    if (args.probe) need((scenario.alarmsRaised ?? 0) >= (args.seconds >= 150 ? 2 : 1), 'inconclusive-no-alarm', `only ${scenario.alarmsRaised ?? 0} alarm(s) could be raised through the probe build`);
    if (flagList.includes('photo_diary')) need((scenario.photo?.length ?? 0) >= 1, 'inconclusive-no-photo', 'no diary photo could be taken, so the photo-bytes search proved nothing');
    if (mode === 'on') {
      need(scenario.syncSwitchedOn, 'inconclusive-no-optin', 'sync could not be switched on through the UI');
      const ids = new Set();
      for (const r of rec.records) {
        if (r.kind === 'http' && /\/api\/events\/sync$/.test(r.url.split('?')[0]) && r.method === 'POST' && r.body) {
          try { for (const e of JSON.parse(r.body.toString('utf8')).events ?? []) ids.add(e.id); } catch { /* judged elsewhere */ }
        }
      }
      result.distinctEventIdsSynced = ids.size;
      const logged = (scenario.bitesLogged ?? 0) + (scenario.urgeLogged ?? 0) + (scenario.alarmsRaised ?? 0);
      need(ids.size >= logged, 'inconclusive-not-all-synced', `${logged} entries were logged but only ${ids.size} distinct events were seen in sync requests`);
    }
    // The service worker is generated by Workbox. Whatever it did in this session, it also must have no code that could
    // upload anything: no POST, beacon, XHR, WebSocket, push or background-sync handler.
    const swFiles = ['sw.js', ...readdirSync(join(args.root, 'dist')).filter(f => /^workbox-.*\.js$/.test(f))];
    const swSrc = swFiles.map(f => readFileSync(join(args.root, 'dist', f), 'utf8')).join('\n');
    const swUpload = [/sendBeacon/, /XMLHttpRequest/, /WebSocket/, /["']POST["']/, /addEventListener\(["'](push|sync|periodicsync|backgroundfetch\w*)["']/].filter(re => re.test(swSrc)).map(String);
    result.serviceWorkerStatic = { files: swFiles, uploadCapableCode: swUpload };
    if (swUpload.length) verdict.findings.push({ severity: 'fail', code: 'sw-has-upload-code', url: '/sw.js', message: 'the service worker contains code that could upload data', evidence: swUpload.join(' ') });
    const sw = scenario.serviceWorker?.registrations?.[0];
    result.serviceWorkerActive = sw?.active === 'activated';
    const notes = result.serviceWorkerActive ? [] : [{ severity: 'warn', code: 'sw-not-active', url: '', message: `the app's service worker was not active at the end of the session (${JSON.stringify(scenario.serviceWorker)}), so traffic that only it makes was not exercised`, evidence: '' }];
    const findings = [...verdict.findings, ...inconclusive, ...notes];
    const violations = findings.filter(f => f.severity === 'fail' && !f.code.startsWith('inconclusive'));
    const incon = findings.filter(f => f.severity === 'fail' && f.code.startsWith('inconclusive'));
    result.findings = findings;
    result.allowlist = DEFAULT_ALLOWED_HOSTS;
    result.allowlistNotInCsp = notInCsp.map(h => h.host);
    result.whitelist = { top: [...whitelist.top], event: [...whitelist.event], response: [...whitelist.response], clientMatchesServer: whitelist.parity };
    if (!whitelist.parity) violations.push({ severity: 'fail', code: 'whitelist-drift', url: '', message: 'src/sync/payload.ts SYNC_EVENT_FIELDS and server/events/validate.js EVENT_KEYS differ', evidence: '' });
    result.stats = verdict.stats;
    result.targets = rec.counts.targets;
    result.requests = rec.records.filter(r => r.kind !== 'hook').map(r => ({
      t: r.t, target: r.target, kind: r.kind, method: r.method, url: r.url.length > 300 ? `${r.url.slice(0, 300)}...` : r.url, type: r.resourceType, status: r.status,
      fromServiceWorker: r.fromServiceWorker || undefined, failed: r.failed || undefined, bodyBytes: r.body ? r.body.length : 0, bodySha: r.body ? sha(r.body) : undefined,
    }));
    result.hookCalls = rec.records.filter(r => r.kind === 'hook').map(({ t, api, method, url, bodyType, size, blobType, keepalive, where }) => ({ t, api, method, url, bodyType, size, blobType, keepalive, where }));
    result.verdict = violations.length ? 'FAIL' : incon.length ? 'INCONCLUSIVE' : 'PASS';
    result.exitCode = violations.length ? 1 : incon.length ? 2 : 0;
    result.finishedAt = new Date().toISOString();
    result.violations = violations.length;
    result.serverLogTail = server.log().split('\n').slice(-6).join('\n');
    printMode(result, log);
  } catch (e) {
    result.verdict = 'ERROR';
    result.exitCode = 2;
    result.error = String(e.stack ?? e);
    log(`  ERROR ${e.message}`);
  } finally {
    try { cdp?.close(); } catch { /* closed */ }
    try { chrome?.close(); } catch { /* gone */ }
    await server.stop().catch(() => {});
  }
  return finish();
  function finish() {
    mkdirSync(args.out, { recursive: true });
    writeFileSync(join(args.out, `${mode}${args.probe ? '-probe' : ''}.json`), JSON.stringify(result, (_k, v) => (v instanceof Set ? [...v] : v), 2));
    return result;
  }
}

function printMode(r, log) {
  const s = r.stats;
  log(`  ${r.scenario.durationSec}s of detection, ${r.detectionFramesPerSecond} video frames/s to MediaPipe, ${r.scenario.bitesLogged} bites + ${r.scenario.urgeLogged} urge${r.probe ? ` + ${r.scenario.alarmsRaised} real alarms (probe build)` : ''} logged, photo taken: ${r.scenario.photo?.length ?? 0}`);
  log(`  requests recorded: ${s.requests} http (${JSON.stringify(s.byTarget)} by context), ${s.webSocketFrames} web socket frames, ${s.hookCalls} in-page hook reports; ${s.bodiesChecked} bodies / ${s.bytesChecked} bytes inspected, ${s.bodiesUnreadable} unreadable`);
  log(`  hosts: ${Object.entries(s.hosts).map(([h, n]) => `${h} (${n})`).join(', ')}`);
  log(`  /api/events requests: ${s.eventsRequests}; sync POSTs: ${s.syncPosts} carrying ${s.syncEvents} events; event keys seen: ${s.eventKeysSeen.join(',') || '(none)'}`);
  if (r.distinctEventIdsSynced !== undefined) log(`  distinct events synced: ${r.distinctEventIdsSynced}`);
  log(`  service worker active: ${r.serviceWorkerActive}; requests it answered for the page: ${r.requests.filter(q => q.fromServiceWorker).length}; its own requests: ${r.requests.filter(q => q.target === 'service_worker').length}`);
  log(`  photo needles searched: ${s.needlesSearched}`);
  for (const f of r.findings) log(`  ${f.severity === 'fail' ? 'FINDING' : 'note   '} [${f.code}] ${f.message}\n           url: ${f.url}\n           evidence: ${f.evidence}`);
  log(`  => ${r.verdict}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = args.quiet ? () => {} : (s) => console.log(s);
  if (!existsSync(join(args.root, 'dist', 'index.html'))) { console.error(`no build in ${args.root}/dist: run \`npm run build:web\` first`); process.exit(2); }
  const modes = args.mode === 'both' ? ['off', 'on'] : args.mode === 'all' ? ['canary', 'flagsoff', 'off', 'on'] : [args.mode];
  for (const m of modes) if (!['off', 'on', 'flagsoff', 'canary'].includes(m)) { console.error(`unknown mode ${m}`); process.exit(2); }
  let commit = 'unknown';
  try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: args.root }).toString().trim(); } catch { /* not a repo */ }
  console.log(`privacy audit: commit ${commit}, ${args.seconds}s per mode, modes ${modes.join(', ')}, node ${process.version}`);
  const results = [];
  for (const m of modes) results.push(await auditMode(m, args, log));
  console.log('\n=== summary ===');
  for (const r of results) console.log(`${r.mode.padEnd(9)} ${r.verdict}  (${r.stats?.requests ?? 0} requests, ${Object.keys(r.stats?.hosts ?? {}).length} hosts, ${r.violations ?? 0} violations)`);
  writeFileSync(join(args.out, `summary${args.probe ? '-probe' : ''}.json`), JSON.stringify({ commit, finishedAt: new Date().toISOString(), seconds: args.seconds, results: results.map(r => ({ mode: r.mode, verdict: r.verdict, exitCode: r.exitCode, violations: r.violations, requests: r.stats?.requests, hosts: r.stats?.hosts })) }, null, 2));
  process.exit(Math.max(...results.map(r => r.exitCode ?? 2)));
}

main().catch((e) => { console.error(e); process.exit(2); });
