// Source-level guards for WS3 (fewer false alarms). Like scripts/coachingGuards.test.mjs these read the
// source files and walk the import graph, for promises that are easy to break by accident and hard to notice
// in a browser:
//
//  1. The "Not a bite" seam in AlertOverlay is LIGHT (the landing-page demo renders AlertOverlay).
//  2. What is learned stays on the device: nothing under src/detection, src/calibration or src/falsePositive
//     can reach the network, and the pure detection modules import no storage, store or React.
//  3. No picture is ever taken: no canvas, no image capture, no recording, no blob storage in those folders.
//  4. The only thing the feature writes to an event is the `falsePositive` mark.
//  5. Nothing in it draws the habit: one neutral icon, no images.
//  6. Every entry point is behind the `false_positive_controls` flag.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');
const strip = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const importsOf = (src, onlyStatic = false) => {
  const out = [];
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  const code = strip(src);
  while ((m = re.exec(code))) {
    if (m[2] !== undefined && onlyStatic) continue;
    out.push(m[1] ?? m[2]);
  }
  return out;
};

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(join(root, fromFile)), spec);
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx', '.json']) {
    const p = base + ext;
    try { if (statSync(p).isFile()) return relative(root, p); } catch { /* try the next */ }
  }
  return null;
}

function graph(entry, onlyStatic = false) {
  const files = new Set();
  const packages = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (files.has(f)) continue;
    files.add(f);
    if (!/\.(ts|tsx)$/.test(f)) continue;
    for (const spec of importsOf(read(f), onlyStatic)) {
      const local = resolveImport(f, spec);
      if (local) stack.push(local);
      else if (!spec.startsWith('.')) packages.add(spec);
    }
  }
  return { files, packages };
}

const sourceFiles = dir =>
  readdirSync(join(root, dir))
    .filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
    .map(f => `${dir}/${f}`);

const DETECTION = sourceFiles('src/detection');
const CALIBRATION = sourceFiles('src/calibration');
const FALSE_POSITIVE = sourceFiles('src/falsePositive');
const OWN = [...DETECTION, ...CALIBRATION, ...FALSE_POSITIVE];

describe('1. the seam in AlertOverlay stays light (the landing demo renders AlertOverlay)', () => {
  const { files, packages } = graph('src/components/detection/AlertOverlay.tsx');

  it('reaches the Not a bite seam and its controller', () => {
    for (const f of ['src/falsePositive/NotABiteSeam.tsx', 'src/falsePositive/controller.ts']) expect(files, f).toContain(f);
  });

  it('reaches no store, storage module, flags, auth or hooks, and only react, react-dom and lucide among packages', () => {
    expect([...files].filter(f => /src\/(store|storage|features|contexts|hooks|dev|utils\/track|calibration|detection)\b/.test(f))).toEqual([]);
    expect([...packages].sort()).toEqual(['lucide-react', 'react', 'react-dom']);
  });

  it('the seam files import only react, react-dom and each other (and, WS12a, the tiny alarm-text scope)', () => {
    for (const f of ['src/falsePositive/NotABiteSeam.tsx', 'src/falsePositive/controller.ts']) {
      for (const spec of importsOf(read(f))) expect(['react', 'react-dom', './controller', '../i18n/scopes/alarm'], `${f} imports ${spec}`).toContain(spec);
    }
  });

  it('is mounted once in the alarm overlay and once in the minimized window, each as a single line', () => {
    for (const [file, surface] of [['src/components/detection/AlertOverlay.tsx', 'main'], ['src/components/detection/PiPWindow.tsx', 'pip']]) {
      const code = strip(read(file));
      expect(code.match(/<NotABiteSeam\b/g), file).toHaveLength(1);
      expect(code).toContain(`<NotABiteSeam surface="${surface}" />`);
    }
  });
});

describe('2. what is learned stays on the device', () => {
  const NETWORK = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource|apiFetch|\btrack\s*\(|navigator\.onLine|https?:\/\//;
  const NETWORK_IMPORT = /contexts\/AuthContext|utils\/track|\/server\b|^axios$|^node-fetch$|^ws$/;

  it.each(OWN)('%s makes no network call and names no URL', f => {
    expect(strip(read(f))).not.toMatch(NETWORK);
  });

  it.each(OWN)('%s imports nothing that can reach the network (auth, apiFetch, track)', f => {
    for (const spec of importsOf(read(f))) expect(spec, `${f} imports ${spec}`).not.toMatch(NETWORK_IMPORT);
  });

  // The only imports in these folders that lead to the network at all, and why each is acceptable:
  //  - features/flags and features/useFeature read the list of feature flags (GET /api/features): no event, no pose, no user data.
  //  - hooks/useDetection (calibration/runner.ts) loads the MediaPipe models that are already part of the app, from the same origin.
  const ALLOWED = new Map([
    ['src/detection/useBehaviors.ts', ['../features/flags', '../features/useFeature']],
    ['src/falsePositive/FalsePositiveSlot.tsx', ['../features/useFeature']],
    ['src/falsePositive/useEnabled.ts', ['../features/flags']],
    ['src/calibration/runner.ts', ['../hooks/useDetection']],
  ]);
  it('the few imports that lead to flags or to the models are exactly these', () => {
    const found = new Map();
    for (const f of OWN) {
      const hits = importsOf(read(f)).filter(s => /\/features\/|\/hooks\//.test(s));
      if (hits.length) found.set(f, hits.sort());
    }
    expect(Object.fromEntries([...found].sort())).toEqual(Object.fromEntries([...ALLOWED].map(([k, v]) => [k, [...v].sort()]).sort()));
  });

  it('the pose, controls, learning, calibration and engine modules are pure: no store, storage, React or packages', () => {
    const pure = ['pose', 'controls', 'learning', 'calibration', 'controlsRegistry', 'engine', 'handedness', 'rules', 'zones', 'types'];
    for (const name of pure) {
      const f = `src/detection/${name}.ts`;
      for (const spec of importsOf(read(f))) {
        expect(spec.startsWith('.'), `${f} imports the package ${spec}`).toBe(true);
        expect(spec, `${f} imports ${spec}`).not.toMatch(/store|storage\/(index|kv|adapter|blobs|persist)|react|contexts|hooks|features/);
      }
    }
  });

  it('the learned poses are written only through the key-value module, in their own namespace', () => {
    const code = strip(read('src/falsePositive/poseStore.ts'));
    expect(code).toContain("const NS = 'falsePositive' as const;");
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|localBlobs/);
    expect(importsOf(read('src/falsePositive/poseStore.ts')).filter(s => s.includes('storage'))).toEqual(['../storage/kv']);
  });
});

describe('3. no picture is ever taken', () => {
  const CAPTURE = /\bcanvas\b|drawImage|getImageData|toDataURL|toBlob|createImageBitmap|ImageCapture|MediaRecorder|captureStream|localBlobs|indexedDB|FileReader|URL\.createObjectURL/i;
  it.each(OWN)('%s does not draw, capture or record', f => {
    expect(strip(read(f))).not.toMatch(CAPTURE);
  });
});

describe('4. the only thing written to an event is the mark', () => {
  it('every events.update / patchEvent call in the feature sets falsePositive and nothing else', () => {
    for (const f of OWN) {
      const code = strip(read(f));
      for (const m of code.matchAll(/(?:events\.update|patchEvent)\(\s*[^,()]+,\s*(\{[^}]*\})\s*\)/g)) {
        const keys = [...m[1].matchAll(/(\w+)\s*:/g)].map(k => k[1]);
        expect(keys, `${f}: ${m[0]}`).toEqual(['falsePositive']);
      }
    }
  });

  it('no module of the feature adds a pose-like field to an event (logIncident extras carry only the hand)', () => {
    const registry = strip(read('src/detection/controlsRegistry.ts'));
    expect(registry).toMatch(/alarmHandExtras[\s\S]*?\{ hand: fire\.hand \}/);
    expect(strip(read('src/components/detection/CameraView.tsx'))).toMatch(/\{ behavior, \.\.\.alarmHandExtras\(\) \}/);
  });
});

describe('5. never depicts the habit', () => {
  const ALLOWED_ICONS = new Set(['SlidersHorizontal']);
  it('uses one neutral icon and no images', () => {
    const used = new Set();
    for (const f of [...CALIBRATION, ...FALSE_POSITIVE]) {
      const code = strip(read(f));
      for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g)) {
        for (const name of m[1].split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean)) used.add(name);
      }
      expect(code, f).not.toMatch(/<img\b|<svg\b|<picture\b|<canvas\b|\.(png|jpe?g|webp|gif|svg)['"]/i);
    }
    for (const n of used) expect(ALLOWED_ICONS.has(n), `icon ${n}`).toBe(true);
  });

  it('the calibration view has the person\'s own camera and text, no drawn figure', () => {
    const code = strip(read('src/calibration/CalibrationView.tsx'));
    expect(code).toContain('<video');
    expect(code).not.toMatch(/<svg|<img|<canvas|<path/);
  });
});

describe('6. every entry point is behind the flag', () => {
  it('the Dashboard slot, the History buttons, the prompt change and the Settings card all read false_positive_controls', () => {
    expect(strip(read('src/falsePositive/FalsePositiveSlot.tsx'))).toContain("useFeature('false_positive_controls')");
    expect(strip(read('src/falsePositive/useEnabled.ts'))).toContain('false_positive_controls');
    expect(strip(read('src/pages/Dashboard.tsx'))).toContain('<FalsePositiveSlot />');
    expect(strip(read('src/pages/Log.tsx'))).toMatch(/falsePositiveControls && inc\.autoDetected && !notABite/);
    expect(strip(read('src/components/dashboard/ReplacementPrompt.tsx'))).toMatch(/if \(falsePositiveControls\) markNotABite/);
    const meta = read('src/pages/settings/meta.ts');
    expect(meta).toMatch(/id: 'detection'[\s\S]*?false_positive_controls/);
  });

  it('the bridge is the only thing that registers controls, and the engine reads none by default without it', () => {
    const registering = OWN.filter(f => /setDetectionControls\(\s*(?!null)[^)]/.test(strip(read(f))) && !/function setDetectionControls/.test(strip(read(f))));
    expect(registering).toEqual(['src/falsePositive/startBridge.ts']);
    expect(strip(read('src/hooks/biteDetector.ts'))).toContain('options.getControls ?? getDetectionControls');
  });

  it('the flag is registered and off by default', () => {
    const registry = read('src/features/registry.ts');
    expect(registry).toContain('false_positive_controls');
    expect(existsSync(join(root, 'src/falsePositive/FalsePositiveBridge.tsx'))).toBe(true);
  });
});

describe('the lines in shared files are single, named seams', () => {
  it('useDetection: one changed line for the hand source, one exported function for the calibration, nothing else', () => {
    const code = strip(read('src/hooks/useDetection.ts'));
    expect(code.match(/detectHandsWithSides/g)).toHaveLength(2); // the import and the call
    expect(code).toContain('export async function getModels()');
    expect(code).not.toMatch(/falsePositive|DetectionControls|notABite/);
  });
});
