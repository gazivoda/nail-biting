// usage: node scripts/background-probe/tables.mjs [all|a-short|a|b|cpu|pause]
// Prints the markdown tables used in docs/agents/ws7a-notes.md and ARCHITECTURE.md section 15, straight from the
// result files in docs/agents/ws7a-measurements, so no number in the docs is typed by hand.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SP } from './cdp.mjs';

const load = (name) => { const f = join(SP, name); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const md = (rows, cols) => [`| ${cols.map((c) => c[0]).join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => c[1](r)).join(' | ')} |`)].join('\n');

const VARIANTS = [['plain', 'no camera'], ['camera', 'camera on'], ['camerapip', 'camera on + mini window open'], ['audio', 'camera on + audio worklet']];
const COLS = [['iv100', 'page `setInterval` 100 ms (10/s)'], ['chain200', 'page `setTimeout` chain 200 ms (5/s)'], ['raf', 'animation frames'], ['wkiv100', 'worker timer 100 ms (10/s)'], ['wkchain200', 'worker chain 200 ms (5/s)'], ['audio200', 'audio worklet (5/s)']];

function printA(short) {
  if (short) {
    const wins = ['10..60s', '300..360s', '600..660s'];
    const rows = [];
    for (const [v, label] of VARIANTS) {
      const r = load(`probe-${v}.json`);
      if (!r) continue;
      for (const w of wins) {
        const row = r.table.find((t) => t.window === w);
        if (row) rows.push({ label, w, row });
      }
    }
    const cols = COLS.filter(([k]) => rows.some((x) => x.row[k] !== undefined));
    console.log(md(rows, [['hidden, condition', (x) => `${x.label}, ${x.w.replace('..', '-').replace('s', ' s')}`], ...cols.map(([k, n]) => [n, (x) => x.row[k] ?? '-'])]));
    return;
  }
  for (const [v, label] of VARIANTS) {
    const r = load(`probe-${v}.json`);
    if (!r) continue;
    console.log(`**${label}**\n`);
    const names = COLS.map(([k]) => k).filter((k) => r.table.some((t) => t[k] !== undefined));
    console.log(md(r.table, [['window (s since hidden)', (x) => x.window], ...names.map((n) => [COLS.find(([k]) => k === n)[1], (x) => x[n] ?? '-'])]));
    console.log();
  }
}

const RUNS = ['base-hidden', 'base-pip', 'flagoff-hidden', 'after-hidden', 'after-pip'];
const RUN_NAMES = { 'base-hidden': 'before, hidden', 'base-pip': 'before, hidden + mini window', 'flagoff-hidden': 'flag off, hidden (probe build)', 'after-hidden': 'flag on, hidden', 'after-pip': 'flag on, hidden + mini window' };
const runs = () => RUNS.map((l) => [l, load(`app-${l}.json`)]).filter(([, r]) => r);

function printB() {
  const rs = runs();
  const windows = ['-30..0s', '0..10s', '10..60s', '60..180s', '180..300s', '300..360s', '360..480s', '480..600s', '600..660s'];
  const cell = (r, w) => r.table.find((t) => t.window === w)?.stepsPerSecond ?? '';
  console.log('Detection steps per second (the injected-hand windows, 10..60 s and 600..660 s of the "flag on" runs, are lower because the model is not called while a synthetic hand is shown):\n');
  console.log(md(windows.map((w) => ({ w })), [['hidden time (s)', (x) => x.w === '-30..0s' ? 'visible, before hiding' : x.w.replace('..', ' to ').replace('s', '')], ...rs.map(([l, r]) => [RUN_NAMES[l], (x) => cell(r, x.w)])]));
  console.log('\nAlarm latency in ms, from "a hand is on the mouth" to the alarm starting (synthetic hand through the real loop; probe builds):\n');
  console.log(md(rs.filter(([, r]) => r.alarms?.length), [['run', (x) => RUN_NAMES[x[0]]], ['tab visible', (x) => x[1].alarms.find((a) => a.tag === 'visible')?.latencyMs ?? ''], ['hidden 20 s', (x) => x[1].alarms.find((a) => a.tag === 'hidden+20s')?.latencyMs ?? ''], ['hidden 650 s', (x) => x[1].alarms.find((a) => a.tag === 'hidden+650s')?.latencyMs ?? ''], ['alarm logged each time', (x) => x[1].alarms.every((a) => a.logged === 1) ? 'yes' : 'NO']]));
  console.log('\nVideo frames in the hidden tab were new (not a repeat of one picture) at every checkpoint: ' + rs.map(([l, r]) => `${RUN_NAMES[l]}: ${r.checkpoints.every((c) => c.fresh === true) ? 'yes' : 'NO'}`).join('; ') + '.');
}

function printCPU() {
  const rs = runs();
  console.log(md(rs, [['run', (x) => RUN_NAMES[x[0]]], ['visible: renderer', (x) => x[1].cpu.visible?.renderer ?? ''], ['visible: GPU', (x) => x[1].cpu.visible?.GPU ?? ''], ['hidden: renderer', (x) => x[1].cpu.hiddenRest?.renderer ?? ''], ['hidden: GPU', (x) => x[1].cpu.hiddenRest?.GPU ?? ''], ['hidden: browser', (x) => x[1].cpu.hiddenRest?.browser ?? '']]));
}

function printPause() {
  const p = load('pause-scenarios.json');
  if (p) console.log('```json\n' + JSON.stringify(p.scenarios, null, 1) + '\n```');
}

const mode = process.argv[2] ?? 'all';
if (mode === 'a-short') printA(true);
else if (mode === 'a') printA(false);
else if (mode === 'b') printB();
else if (mode === 'cpu') printCPU();
else if (mode === 'pause') printPause();
else { console.log('### A\n'); printA(false); console.log('### B\n'); printB(); console.log('\n### CPU\n'); printCPU(); console.log('\n### Pause scenarios\n'); printPause(); }
