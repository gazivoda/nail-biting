// Writes the committed synthetic fixtures: node scripts/eval-detection/generate-fixtures.mjs
// Deterministic (every scene has its own seed), so running it again changes nothing unless a
// scene or src/detection/synthetic.ts changed. `--check` fails if the files on disk differ.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE, renderScene } from '../../src/detection/synthetic.ts';
import { FACE_LANDMARKS_USED } from '../../src/detection/zones.ts';
import { FIXTURE_FORMAT, FIXTURE_VERSION, formatFixture, roundedPairs } from './lib/fixtures.mjs';
import { SCENES } from './scenes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixtures');

const faceIndices = [...FACE_LANDMARKS_USED];
const norm = ([x, y]) => ({ x: x / IMAGE.width, y: y / IMAGE.height });

export function sceneToFixture(scene) {
  let previousFace = 'unset';
  const frames = renderScene(scene).map(frame => {
    const out = { t: frame.t, hands: frame.hands.map(h => roundedPairs(h)) };
    const face = frame.face ? roundedPairs(faceIndices.map(i => norm(frame.face.get(i)))) : null;
    const key = JSON.stringify(face);
    if (key !== previousFace) out.face = face;
    previousFace = key;
    return out;
  });

  const fixture = {
    format: FIXTURE_FORMAT,
    version: FIXTURE_VERSION,
    id: scene.id,
    description: scene.description,
    source: 'synthetic',
    tags: scene.tags,
  };
  if (scene.knownIssue) fixture.knownIssue = scene.knownIssue;
  Object.assign(fixture, {
    generator: { script: 'scripts/eval-detection/generate-fixtures.mjs', scene: 'scripts/eval-detection/scenes.mjs', seed: scene.seed },
    image: { width: IMAGE.width, height: IMAGE.height },
    frameIntervalMs: 200,
    faceIndices,
    labels: scene.labels,
    frames,
  });
  return fixture;
}

/** { "<id>.json": "<file text>" } for every scene. */
export function generateAll() {
  const ids = new Set();
  const files = {};
  for (const scene of SCENES) {
    if (ids.has(scene.id)) throw new Error(`two scenes share the id ${scene.id}`);
    ids.add(scene.id);
    files[`${scene.id}.json`] = formatFixture(sceneToFixture(scene));
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = generateAll();
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([name, text]) => {
      const path = join(FIXTURE_DIR, name);
      return !existsSync(path) || readFileSync(path, 'utf8') !== text;
    });
    if (stale.length > 0) {
      console.error(`These fixtures are out of date: ${stale.map(([n]) => n).join(', ')}\nRun: node scripts/eval-detection/generate-fixtures.mjs`);
      process.exit(1);
    }
    console.log(`${Object.keys(files).length} fixtures are up to date.`);
  } else {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(FIXTURE_DIR, name), text);
    console.log(`Wrote ${Object.keys(files).length} fixtures to ${FIXTURE_DIR}`);
  }
}
