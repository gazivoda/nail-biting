// Microbenchmark: what it costs, per frame, to run the detection RULES (not MediaPipe).
//
//   node scripts/eval-detection/bench.mjs            all variants, each in its own process
//   node scripts/eval-detection/bench.mjs --variant legacy
//
// Variants
//   legacy        src/detection/__reference__/legacyBiteDetector.ts, the detector as it was before WS1
//   nail          the new engine, nail biting only, no getBehaviors (what the landing-page demo runs)
//   nail+hook     the new engine, nail biting only, getBehaviors returning one shared array (what the app runs
//                 with every flag off: useDetection always passes it)
//   all-six       the new engine with all six behaviours on (the experimental flag, everything selected)
//   controls      WS3: the new engine, nail biting, with the false_positive_controls flag on (chin-rest rule, both hands)
//   controls+40   the same with 40 learned poses to compare every contact frame against (the most it ever holds)
//
// Each variant runs in a fresh process so one cannot warm the JIT for another. Frames come from a fixed pool of
// 2,000 synthetic landmark frames (some with no hand, most with a hand away from the face, some at the mouth, nose,
// brow, cheek and scalp) so branches are exercised in a realistic mix. The landmark source just hands out
// pre-built arrays: the number is the rules plus the call overhead, nothing else.
//
// MediaPipe inference (the hand and face landmarkers) is what takes the time in a real frame, and it is unchanged by
// this work. The budget is one frame every 200 ms.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBiteDetector as createLegacy } from '../../src/detection/__reference__/legacyBiteDetector.ts';
import { createBiteDetector as createNew } from '../../src/hooks/biteDetector.ts';
import { buildHand, mulberry32, neutralFace, facePoint } from '../../src/detection/synthetic.ts';
import { defaultControls } from '../../src/detection/controls.ts';

const ROUNDS = 7;
const FRAMES_PER_ROUND = 1_000_000;
const WARMUP = 300_000;
const BUDGET_NS = 200 * 1e6;

function buildPool() {
  const rnd = mulberry32(2024);
  const face = neutralFace();
  const targets = ['mouth', 'noseBase', 'browRight', 'cheekRight', 'chinAnchor', 'foreheadAnchor', 'scalpTop'];
  const pool = [];
  for (let i = 0; i < 2000; i++) {
    const r = rnd();
    let hands = [];
    if (r > 0.2) {
      const near = rnd() < 0.4;
      const [x, y] = near
        ? facePoint(targets[Math.floor(rnd() * targets.length)])
        : [60 + rnd() * 520, 330 + rnd() * 140];
      hands = [buildHand({
        side: 'right', pin: 8, at: [x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30], angleDeg: 150 + rnd() * 60,
        ext: { index: 0.7, middle: 0.4, ring: 0.3, pinky: 0.3, thumb: 0.5 }, pinch: rnd() < 0.3,
      })];
    }
    pool.push({ hands, faces: rnd() < 0.95 ? [face] : [] });
  }
  return pool;
}

function makeDetector(variant, source) {
  const base = { getVideo: () => VIDEO, getSensitivity: () => 'medium', source, onBiteStart: () => { sink++; }, onBiteEnd: () => { sink++; } };
  switch (variant) {
    case 'legacy': return createLegacy(base);
    case 'nail': return createNew(base);
    case 'nail+hook': { const only = ['nail_biting']; return createNew({ ...base, getBehaviors: () => only }); }
    case 'all-six': { const all = ['nail_biting', 'cuticle_skin_biting', 'nose_picking', 'eye_area_pulling', 'face_skin_picking', 'hair_pulling']; return createNew({ ...base, getBehaviors: () => all }); }
    case 'controls': { const only = ['nail_biting']; const c = defaultControls(); return createNew({ ...base, getBehaviors: () => only, getControls: () => c }); }
    case 'controls+40': {
      const only = ['nail_biting'];
      const rnd = mulberry32(5);
      const learned = Array.from({ length: 40 }, () => ({ at: Date.now(), v: [Math.floor(rnd() * 4), rnd() * 0.5, rnd() * 0.5, Math.floor(rnd() * 8), rnd(), rnd() - 0.5] }));
      const c = defaultControls({ learned });
      return createNew({ ...base, getBehaviors: () => only, getControls: () => c });
    }
    default: throw new Error(`unknown variant ${variant}`);
  }
}

const VIDEO = { readyState: 4 };
let sink = 0;

function runVariant(variant) {
  const pool = buildPool();
  let k = 0;
  const source = {
    detectHands: () => pool[k].hands,
    detectFace: () => pool[k].faces,
  };
  const detector = makeDetector(variant, source);
  const step = n => { for (let i = 0; i < n; i++) { k = (k + 1) % 2000; detector.step(i); } };

  step(WARMUP);
  const perFrame = [];
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = process.hrtime.bigint();
    step(FRAMES_PER_ROUND);
    const t1 = process.hrtime.bigint();
    perFrame.push(Number(t1 - t0) / FRAMES_PER_ROUND);
  }
  perFrame.sort((a, b) => a - b);
  return { variant, medianNs: perFrame[Math.floor(ROUNDS / 2)], minNs: perFrame[0], maxNs: perFrame[ROUNDS - 1], sink };
}

const arg = process.argv.indexOf('--variant');
if (arg !== -1) {
  console.log(JSON.stringify(runVariant(process.argv[arg + 1])));
} else {
  const script = fileURLToPath(import.meta.url);
  const results = [];
  for (const variant of ['legacy', 'nail', 'nail+hook', 'all-six', 'controls', 'controls+40', 'legacy', 'nail+hook']) {
    const out = spawnSync(process.execPath, [script, '--variant', variant], { encoding: 'utf8' });
    if (out.status !== 0) { console.error(out.stderr); process.exit(1); }
    results.push(JSON.parse(out.stdout));
  }
  const first = Object.fromEntries(results.map(r => [r.variant, r]));
  const legacyNs = (results.filter(r => r.variant === 'legacy').reduce((s, r) => s + r.medianNs, 0)) / results.filter(r => r.variant === 'legacy').length;
  console.log(`Node ${process.version}, ${ROUNDS} rounds of ${FRAMES_PER_ROUND.toLocaleString('en')} frames per run, median of the rounds.\n`);
  console.log('variant       ns/frame (median, min..max)      vs legacy   share of the 200 ms frame budget');
  for (const r of results) {
    const rel = ((r.medianNs / legacyNs - 1) * 100);
    console.log(`${r.variant.padEnd(13)} ${r.medianNs.toFixed(1).padStart(7)}  (${r.minNs.toFixed(1)}..${r.maxNs.toFixed(1)})`.padEnd(48)
      + `${(rel >= 0 ? '+' : '') + rel.toFixed(0)}%`.padStart(9) + `   ${(r.medianNs / BUDGET_NS * 100).toExponential(2)} %`);
  }
  void first;
}
