// Reading, checking and writing landmark fixtures. Plain Node, no dependencies.
// The format is documented in ../README.md.
//
// It imports TypeScript from src/detection directly (Node strips the types), so the
// evaluation runs the same rule code the app runs, never a copy of it.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FACE_LANDMARKS_USED } from '../../../src/detection/zones.ts';
import { BEHAVIORS } from '../../../src/storage/eventModel.ts';

export const FIXTURE_FORMAT = 'stop-biting-landmark-fixture';
export const FIXTURE_VERSION = 1;
export const HAND_POINTS = 21;
export const FACE_POINTS = 478;

const fail = (where, message) => { throw new Error(`${where}: ${message}`); };
const isPair = p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/**
 * Checks a parsed fixture and returns it in the form the runner uses:
 * every frame has `hands` (Landmark[][]) and `face` (a 478-entry Landmark[] or null), with a
 * missing `face` key resolved to the previous frame's face.
 */
export function parseFixture(raw, where = 'fixture') {
  if (!raw || typeof raw !== 'object') fail(where, 'not an object');
  if (raw.format !== FIXTURE_FORMAT) fail(where, `format must be "${FIXTURE_FORMAT}"`);
  if (raw.version !== FIXTURE_VERSION) fail(where, `unsupported version ${raw.version} (this runner reads ${FIXTURE_VERSION})`);
  if (typeof raw.id !== 'string' || !/^[a-z0-9_]+$/.test(raw.id)) fail(where, 'id must be lower_snake_case');
  if (raw.source !== 'synthetic' && raw.source !== 'real') fail(where, 'source must be "synthetic" or "real"');
  where = `${where} (${raw.id})`;
  if (!Array.isArray(raw.tags)) fail(where, 'tags must be a list');
  if (!raw.image || !(raw.image.width > 0) || !(raw.image.height > 0)) fail(where, 'image.width and image.height are required');
  if (raw.frameIntervalMs !== 200) fail(where, 'frameIntervalMs must be 200 (the app runs detection at 5 frames per second)');

  const indices = raw.faceIndices;
  if (!Array.isArray(indices) || !indices.every(i => Number.isInteger(i) && i >= 0 && i < FACE_POINTS)) fail(where, 'faceIndices must be a list of face-mesh indices');
  const missing = FACE_LANDMARKS_USED.filter(i => !indices.includes(i));
  if (missing.length > 0) fail(where, `faceIndices is missing ${missing.join(', ')}, which the rules read (src/detection/zones.ts)`);

  if (!Array.isArray(raw.labels)) fail(where, 'labels must be a list (empty for a fixture with nothing to find)');
  for (const [n, label] of raw.labels.entries()) {
    if (!Array.isArray(label.behaviors) || label.behaviors.length === 0 || !label.behaviors.every(b => BEHAVIORS.includes(b))) {
      fail(where, `labels[${n}].behaviors must be a non-empty list of: ${BEHAVIORS.join(', ')}`);
    }
    if (!Number.isFinite(label.startMs) || !Number.isFinite(label.endMs) || label.endMs < label.startMs) fail(where, `labels[${n}] needs startMs <= endMs`);
  }

  if (!Array.isArray(raw.frames) || raw.frames.length === 0) fail(where, 'frames must be a non-empty list');

  let face = null;
  let lastT = -Infinity;
  const frames = raw.frames.map((frame, n) => {
    const at = `${where}, frame ${n}`;
    if (!Number.isFinite(frame.t) || frame.t <= lastT) fail(at, 't must increase');
    lastT = frame.t;
    if (!Array.isArray(frame.hands)) fail(at, 'hands must be a list');
    const hands = frame.hands.map((hand, h) => {
      if (!Array.isArray(hand) || hand.length !== HAND_POINTS || !hand.every(isPair)) fail(at, `hands[${h}] must be ${HAND_POINTS} [x, y] pairs`);
      return hand.map(([x, y]) => ({ x, y }));
    });
    if ('face' in frame) {
      if (frame.face === null) face = null;
      else {
        if (!Array.isArray(frame.face) || frame.face.length !== indices.length || !frame.face.every(isPair)) fail(at, `face must be null or ${indices.length} [x, y] pairs, one per faceIndices entry`);
        const dense = Array.from({ length: FACE_POINTS }, () => ({ x: 0, y: 0 }));
        frame.face.forEach(([x, y], k) => { dense[indices[k]] = { x, y }; });
        face = dense;
      }
    } else if (n === 0) {
      fail(at, 'the first frame must say what the face is (an array, or null for none)');
    }
    return { t: frame.t, hands, face };
  });

  return {
    id: raw.id,
    description: raw.description ?? '',
    source: raw.source,
    tags: raw.tags,
    knownIssue: raw.knownIssue ?? null,
    labels: raw.labels,
    frames,
  };
}

export function loadFixtureFile(path) {
  let raw;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { throw new Error(`${path}: ${e.message}`); }
  return parseFixture(raw, path);
}

/** Every *.json directly in `dir` and in `dir/real`, sorted by id. */
export function loadFixtures(dir) {
  const files = [];
  for (const folder of [dir, join(dir, 'real')]) {
    if (!existsSync(folder) || !statSync(folder).isDirectory()) continue;
    for (const name of readdirSync(folder).sort()) if (name.endsWith('.json')) files.push(join(folder, name));
  }
  const fixtures = files.map(loadFixtureFile);
  const ids = new Set();
  for (const f of fixtures) {
    if (ids.has(f.id)) throw new Error(`two fixtures share the id ${f.id}`);
    ids.add(f.id);
  }
  return fixtures.sort((a, b) => a.id.localeCompare(b.id));
}

// ── writing ────────────────────────────────────────────────────────────────

const round = v => Math.round(v * 10000) / 10000;
const pairs = list => list.map(p => [round(p.x ?? p[0]), round(p.y ?? p[1])]);

/** One fixture as text: the header keys, then one frame per line. Stable, so it diffs well. */
export function formatFixture(fixture) {
  const { frames, ...header } = fixture;
  const head = Object.entries(header).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const lines = frames.map(f => '    ' + JSON.stringify(f)).join(',\n');
  return `{\n${head},\n  "frames": [\n${lines}\n  ]\n}\n`;
}

export { pairs as roundedPairs };
