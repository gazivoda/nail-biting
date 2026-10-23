// Tests for the detection evaluation harness itself: the fixture format and loader, the scoring, the
// gate and its exit code, that the committed synthetic fixtures are exactly what the generator writes,
// that the committed report is current, and that nothing but landmark numbers is in a fixture.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEHAVIORS } from '../../src/storage/eventModel.ts';
import { BEHAVIOR_REGISTRY } from '../../src/detection/registry.ts';
import { FACE_LANDMARKS_USED } from '../../src/detection/zones.ts';
import { loadFixtures, parseFixture } from './lib/fixtures.mjs';
import { scoreRule } from './lib/score.mjs';
import { evaluateAll, gate, loadThresholds } from './lib/evaluate.mjs';
import { renderReport } from './lib/report.mjs';
import { generateAll, FIXTURE_DIR } from './generate-fixtures.mjs';
import { runEvaluation } from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const THRESHOLDS = join(HERE, 'thresholds.json');

// ── a tiny valid fixture to break ──────────────────────────────────────────

const faceIndices = [...FACE_LANDMARKS_USED];
const face = faceIndices.map(() => [0.5, 0.5]);
const hand = Array.from({ length: 21 }, () => [0.4, 0.8]);
const tiny = (over = {}) => ({
  format: 'stop-biting-landmark-fixture', version: 1, id: 'tiny', description: 'x', source: 'synthetic', tags: ['positive'],
  image: { width: 640, height: 480 }, frameIntervalMs: 200, faceIndices, labels: [],
  frames: [{ t: 0, hands: [], face }, { t: 200, hands: [hand] }, { t: 400, hands: [], face: null }],
  ...over,
});

describe('fixture loader', () => {
  it('reads a valid fixture, resolving a missing face to the previous one and null to none', () => {
    const f = parseFixture(tiny());
    expect(f.frames).toHaveLength(3);
    expect(f.frames[1].face).toBe(f.frames[0].face);       // carried forward
    expect(f.frames[2].face).toBeNull();
    expect(f.frames[0].face).toHaveLength(478);            // dense, ready for the rules
    expect(f.frames[1].hands[0]).toHaveLength(21);
  });

  it.each([
    ['a wrong format', { format: 'nope' }, /format/],
    ['an unknown version', { version: 2 }, /version/],
    ['a bad id', { id: 'Not Snake' }, /id must be/],
    ['an unknown source', { source: 'imagined' }, /source/],
    ['a frame interval other than 200', { frameIntervalMs: 100 }, /200/],
    ['face indices missing one the rules read', { faceIndices: faceIndices.slice(1), frames: [{ t: 0, hands: [], face: face.slice(1) }] }, /missing/],
    ['a label with an unknown behaviour', { labels: [{ behaviors: ['dancing'], startMs: 0, endMs: 1 }] }, /behaviors/],
    ['a label that ends before it starts', { labels: [{ behaviors: ['nail_biting'], startMs: 5, endMs: 1 }] }, /startMs/],
    ['a hand with 20 points', { frames: [{ t: 0, hands: [hand.slice(1)], face }] }, /21/],
    ['a non-increasing clock', { frames: [{ t: 0, hands: [], face }, { t: 0, hands: [] }] }, /increase/],
    ['a first frame that does not say what the face is', { frames: [{ t: 0, hands: [] }] }, /first frame/],
    ['a face of the wrong length', { frames: [{ t: 0, hands: [], face: face.slice(1) }] }, /face must be/],
    ['no frames', { frames: [] }, /frames/],
  ])('rejects %s', (_name, over, message) => {
    expect(() => parseFixture(tiny(over))).toThrow(message);
  });
});

describe('scoring', () => {
  const fixture = (id, labels) => ({ id, labels });
  const label = (startMs, endMs, behaviors = ['nail_biting']) => ({ behaviors, startMs, endMs });

  it('counts a correct alarm, a late-but-graced alarm, a false alarm and a missed event', () => {
    const results = [
      { fixture: fixture('a', [label(1000, 3000)]), alarms: [{ t: 1600 }] },                    // correct
      { fixture: fixture('b', [label(1000, 3000)]), alarms: [{ t: 3900 }] },                    // within the 1000 ms grace
      { fixture: fixture('c', [label(1000, 3000)]), alarms: [{ t: 4100 }] },                    // too late: false alarm and a miss
      { fixture: fixture('d', []), alarms: [{ t: 500 }, { t: 9000 }] },                        // two false alarms
      { fixture: fixture('e', [label(1000, 3000)]), alarms: [] },                               // missed
    ];
    const s = scoreRule(results, 'nail_biting');
    expect(s).toMatchObject({ alarms: 5, correct: 2, falseAlarms: 3, events: 4, detected: 2 });
    expect(s.precision).toBeCloseTo(2 / 5);
    expect(s.recall).toBeCloseTo(2 / 4);
    expect(s.falseList).toEqual([{ fixture: 'c', t: 4100 }, { fixture: 'd', t: 500 }, { fixture: 'd', t: 9000 }]);
    expect(s.missedList.map(m => m.fixture)).toEqual(['c', 'e']);
  });

  it('two correct alarms in one event are two correct alarms but one event found', () => {
    const s = scoreRule([{ fixture: fixture('a', [label(0, 9000)]), alarms: [{ t: 1000 }, { t: 5000 }] }], 'nail_biting');
    expect(s).toMatchObject({ correct: 2, falseAlarms: 0, events: 1, detected: 1, precision: 1, recall: 1 });
  });

  it('a label only counts for the behaviours it lists', () => {
    const results = [{ fixture: fixture('a', [label(0, 5000, ['nose_picking'])]), alarms: [{ t: 1000 }] }];
    expect(scoreRule(results, 'nail_biting')).toMatchObject({ correct: 0, falseAlarms: 1, events: 0, precision: 0, recall: null });
    expect(scoreRule(results, 'nose_picking')).toMatchObject({ correct: 1, falseAlarms: 0, events: 1, precision: 1, recall: 1 });
  });

  it('a mouth label serves both mouth behaviours', () => {
    const results = [{ fixture: fixture('a', [label(0, 5000, ['nail_biting', 'cuticle_skin_biting'])]), alarms: [{ t: 1000 }] }];
    expect(scoreRule(results, 'cuticle_skin_biting').recall).toBe(1);
    expect(scoreRule(results, 'nail_biting').recall).toBe(1);
  });

  it('has no precision without alarms and no recall without events', () => {
    const s = scoreRule([{ fixture: fixture('a', []), alarms: [] }], 'nail_biting');
    expect(s.precision).toBeNull();
    expect(s.recall).toBeNull();
  });
});

describe('the committed synthetic fixtures', () => {
  const fixtures = loadFixtures(FIXTURE_DIR);

  it('are byte for byte what the generator writes (rerun generate-fixtures.mjs if you changed a scene)', () => {
    const generated = generateAll();
    const onDisk = readdirSync(FIXTURE_DIR).filter(n => n.endsWith('.json')).sort();
    expect(onDisk).toEqual(Object.keys(generated).sort());
    for (const name of onDisk) expect(readFileSync(join(FIXTURE_DIR, name), 'utf8'), name).toBe(generated[name]);
  });

  it('each parse, are labelled synthetic, and carry only landmark numbers', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
    for (const f of fixtures) expect(f.source, f.id).toBe('synthetic');
    // Re-read the raw files: nothing may be in a frame but a time, hands and a face; nothing in a hand but pairs of numbers.
    for (const name of readdirSync(FIXTURE_DIR).filter(n => n.endsWith('.json'))) {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));
      expect(Object.keys(raw).sort(), name).toEqual(
        ['description', 'faceIndices', 'format', 'frameIntervalMs', 'frames', 'generator', 'id', 'image', 'labels', 'source', 'tags', 'version', ...(raw.knownIssue ? ['knownIssue'] : [])].sort());
      for (const frame of raw.frames) {
        expect(Object.keys(frame).every(k => ['t', 'hands', 'face'].includes(k)), name).toBe(true);
        for (const h of frame.hands) for (const p of h) expect(p.length === 2 && p.every(Number.isFinite), name).toBe(true);
      }
    }
  });

  it('give every behaviour at least two positive events, and every rule scenes it must not fire on', () => {
    for (const b of BEHAVIORS) {
      const events = fixtures.flatMap(f => f.labels).filter(l => l.behaviors.includes(b)).length;
      expect(events, `${b}: positive events`).toBeGreaterThanOrEqual(2);
    }
    const negatives = fixtures.filter(f => f.labels.length === 0).map(f => f.id);
    for (const required of ['neg_chin_rest', 'neg_scratch_cheek', 'neg_adjust_glasses', 'neg_drinking', 'neg_talking_with_hands']) {
      expect(negatives, required).toContain(required);
    }
  });

  it('their labels fall inside the recording', () => {
    for (const f of fixtures) {
      const end = f.frames.at(-1).t;
      for (const l of f.labels) expect(l.endMs, f.id).toBeLessThanOrEqual(end);
    }
  });
});

describe('thresholds.json', () => {
  const t = loadThresholds(THRESHOLDS);

  it('has a bar for every behaviour', () => {
    for (const b of BEHAVIORS) expect(t.rules[b], b).toBeDefined();
  });

  it('only nail biting and cuticle/skin biting are marked validated (docs/agents/SWARM_RULES.md); promoting another is the owner\'s decision, made with real fixtures', () => {
    const validated = BEHAVIORS.filter(b => BEHAVIOR_REGISTRY[b].validation === 'validated');
    expect(validated).toEqual(['nail_biting', 'cuticle_skin_biting']);
  });

  it('asks for real fixtures before any promotion', () => {
    expect(t.promotion.minRealEvents).toBeGreaterThanOrEqual(10);
  });
});

describe('the evaluation and its gate', () => {
  it('passes on the committed fixtures, and judges nothing but the validated rules', () => {
    const { verdict, bySensitivity, thresholds } = runEvaluation();
    expect(verdict).toMatchObject({ ok: true, failures: [] });
    const rows = bySensitivity[thresholds.gateSensitivity];
    expect(rows.filter(r => r.gated).map(r => r.behavior)).toEqual(['nail_biting', 'cuticle_skin_biting']);
    for (const r of rows.filter(x => x.gated)) {
      expect(r.recall, r.behavior).toBeGreaterThanOrEqual(r.bar.minRecall);
      expect(r.precision, r.behavior).toBeGreaterThanOrEqual(r.bar.minPrecision);
    }
  });

  it('nothing is promotable on synthetic fixtures alone', () => {
    const { bySensitivity } = runEvaluation();
    for (const rows of Object.values(bySensitivity)) for (const r of rows) {
      expect(r.realEvents).toBe(0);
      expect(r.promotable, r.behavior).toBe(false);
    }
  });

  it('fails the gate when a validated rule falls below its bar, and ignores an experimental one that does', () => {
    const fixtures = loadFixtures(FIXTURE_DIR);
    const t = loadThresholds(THRESHOLDS);
    const strict = { ...t, rules: { ...t.rules, nail_biting: { minPrecision: 0.99, minRecall: 1 }, hair_pulling: { minPrecision: 1, minRecall: 1 }, nose_picking: { minPrecision: 1, minRecall: 1 } } };
    const rows = evaluateAll(fixtures, strict, 'medium');
    const verdict = gate(rows, strict, 'medium');
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join(' ')).toMatch(/nail_biting: precision/);
    expect(verdict.failures.join(' ')).not.toMatch(/nose_picking|hair_pulling/);
  });

  // The command runs the app's TypeScript under plain Node (type stripping, Node 22.18 or newer).
  it.skipIf(!process.features?.typescript)('the command exits 0 on the committed bars and 1 on an impossible one', () => {
    const run = (thresholdsPath) => spawnSync(process.execPath, [join(HERE, 'run.mjs'), '--thresholds', thresholdsPath], { encoding: 'utf8', cwd: REPO });
    const ok = run(THRESHOLDS);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('ALL FIXTURES ARE SYNTHETIC');

    const t = JSON.parse(readFileSync(THRESHOLDS, 'utf8'));
    t.rules.nail_biting = { minPrecision: 1, minRecall: 1 };
    const dir = mkdtempSync(join(tmpdir(), 'eval-thresholds-'));
    const strict = join(dir, 'thresholds.json');
    writeFileSync(strict, JSON.stringify(t));
    const bad = run(strict);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/nail_biting: precision/);
  });

  it('the committed report is what the evaluation writes now (regenerate with: npm run eval:detection -- --report docs/agents/ws1-eval-report.md)', () => {
    const report = renderReport(runEvaluation());
    expect(readFileSync(join(REPO, 'docs', 'agents', 'ws1-eval-report.md'), 'utf8')).toBe(report);
  });

  it('the report says, up front, that it is synthetic', () => {
    const report = renderReport(runEvaluation());
    expect(report.split('\n').slice(0, 6).join('\n')).toMatch(/SYNTHETIC. This is not real-world accuracy/);
  });
});
