// Source-level guards for WS2 (post-alarm coaching, urge timer, 4-week program).
// These check structural promises that are easy to break by accident and hard to
// notice in a browser: they read the source files and walk the import graph.
//
//  1. The seam that AlertOverlay mounts is LIGHT. AlertOverlay is also rendered by
//     the landing-page demo, which must never pull the app store (or the storage
//     module, flags or auth) into its bundle. (ARCHITECTURE.md sections 2 and 14.)
//  2. Nothing in the coaching code can touch the alarm: it imports no detector,
//     camera, sound or Picture-in-Picture code. Its only link to the alarm is the
//     history changing after the alarm is already sounding.
//  3. Nothing in the coaching code uses the network.
//  4. Nothing in it draws the habit: the only icons are a short allowlist of
//     neutral glyphs, and no image, video or canvas is used.
//  5. Every entry point is behind its feature flag.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');
// Line comments first (one of them contains "/*" in a path), then block comments. Good enough for a guard.
const strip = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const importsOf = src => {
  const out = [];
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  const code = strip(src);
  while ((m = re.exec(code))) out.push(m[1] ?? m[2]);
  return out;
};

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(join(root, fromFile)), spec);
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx', '.json']) {
    if (existsSync(base + ext) && !base.endsWith('/') ) {
      const p = base + ext;
      try { readFileSync(p); return relative(root, p); } catch { /* a directory; try the next */ }
    }
  }
  return null;
}

/** Every local file reachable from `entry`, plus every bare package it imports. */
function graph(entry) {
  const files = new Set();
  const packages = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (files.has(f)) continue;
    files.add(f);
    if (!/\.(ts|tsx)$/.test(f)) continue;
    for (const spec of importsOf(read(f))) {
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

const COACHING = [
  ...sourceFiles('src/coaching'),
  'src/pages/Program.tsx',
  'src/pages/settings/CoachingSettings.tsx',
  'src/utils/coachingStats.ts',
];

describe('1. the seam in AlertOverlay stays light (the landing demo renders AlertOverlay)', () => {
  const { files, packages } = graph('src/components/detection/AlertOverlay.tsx');

  it('reaches the coaching seam, its card, controller and session machine', () => {
    for (const f of ['src/coaching/CoachingSeam.tsx', 'src/coaching/CoachingCard.tsx', 'src/coaching/controller.ts', 'src/coaching/session.ts']) {
      expect(files, f).toContain(f);
    }
  });

  it('reaches no store, storage module, flags, auth or hooks', () => {
    const heavy = [...files].filter(f => /src\/(store|storage|features|contexts|hooks|dev|utils\/track)\b/.test(f));
    expect(heavy).toEqual([]);
  });

  it('reaches only react, react-dom and lucide-react among packages', () => {
    expect([...packages].sort()).toEqual(['lucide-react', 'react', 'react-dom']);
  });

  it('PiPWindow mounts the same seam', () => {
    expect(importsOf(read('src/components/detection/PiPWindow.tsx'))).toContain('../../coaching/CoachingSeam');
  });
});

describe('2. the coaching code has no handle on the alarm', () => {
  const forbidden = /(biteDetector|useDetection|useCamera|usePictureInPicture|useNotifications|src\/detection|\/detection\/(?!AlertOverlay))/;
  it.each(COACHING)('%s imports no detector, camera, alarm sound or PiP code', f => {
    for (const spec of importsOf(read(f))) expect(spec, `${f} imports ${spec}`).not.toMatch(forbidden);
    expect(strip(read(f))).not.toMatch(/\b(startAlarm|stopAlarm|AudioContext|setAppBadge)\b/);
  });

  it('the only thing it reads from the app is the history, after the alarm has sounded', () => {
    const bridge = strip(read('src/coaching/CoachingBridge.tsx'));
    expect(bridge).toMatch(/useAppStore\.getState\(\)\.incidents/);
    expect(bridge).toMatch(/useAppStore\.subscribe/);
    expect(bridge).not.toMatch(/logIncident|setCameraEnabled|setDetecting|setSensitivity|setAlert/);
  });

  it('does not edit the detector files', () => {
    for (const f of ['src/hooks/biteDetector.ts', 'src/hooks/useDetection.ts']) {
      expect(strip(read(f))).not.toMatch(/coaching/i);
    }
  });
});

describe('3. no network', () => {
  const network = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource|apiFetch|\btrack\s*\(|navigator\.onLine|https?:\/\//;
  it.each(COACHING)('%s makes no network call and names no URL', f => {
    expect(strip(read(f))).not.toMatch(network);
  });

  it('imports nothing that can reach the network (auth, apiFetch, track)', () => {
    for (const f of COACHING) {
      for (const spec of importsOf(read(f))) expect(spec, `${f} imports ${spec}`).not.toMatch(/contexts\/AuthContext|utils\/track/);
    }
  });
});

describe('4. never depicts the habit', () => {
  const ALLOWED_ICONS = new Set(['Check', 'Wind', 'BookOpen', 'Lock', 'ArrowLeft', 'Bell']);

  it('uses only neutral icons (a deliberate allowlist: adding one means a conscious decision)', () => {
    const used = new Set();
    for (const f of COACHING) {
      const code = strip(read(f));
      for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g)) {
        for (const name of m[1].split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean)) used.add(name);
      }
    }
    for (const n of used) expect(ALLOWED_ICONS.has(n), `icon ${n}`).toBe(true);
  });

  it('draws no image, video, canvas or custom path; the only SVG is the ring made of two circles', () => {
    for (const f of COACHING) {
      const code = strip(read(f));
      expect(code, f).not.toMatch(/<img\b|<picture\b|<video\b|<canvas\b|<path\b|<polygon\b|<polyline\b|<ellipse\b|<line\b|<use\b|\.(png|jpe?g|gif|webp|svg|avif|mp4|webm)['"]/i);
    }
    const card = strip(read('src/coaching/CoachingCard.tsx'));
    expect((card.match(/<circle\b/g) ?? []).length).toBe(2);
    expect((card.match(/<svg\b/g) ?? []).length).toBe(1);
  });

  it('no emoji in any coaching string', () => {
    for (const f of [...COACHING, 'src/data/hrtProgram.json']) {
      expect(read(f), f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('5. everything is behind its flag', () => {
  it('the Dashboard slot gates the bridge, the timer and the program link', () => {
    const slot = strip(read('src/coaching/CoachingDashboardSlot.tsx'));
    expect(slot).toMatch(/useFeature\('hrt_coaching'\)/);
    expect(slot).toMatch(/useFeature\('urge_timer'\)/);
    expect(slot).toMatch(/\{hrt && <CoachingBridge \/>\}/);
    expect(slot).toMatch(/\{urge && <UrgeTimer \/>\}/);
    expect(slot).toMatch(/\{hrt && <ProgramEntry \/>\}/);
  });

  it('the program view is only mounted when hrt_coaching is on, and loads lazily', () => {
    const host = strip(read('src/coaching/ProgramHost.tsx'));
    expect(host).toMatch(/useFeature\('hrt_coaching'\)/);
    expect(host).toMatch(/if \(!enabled \|\| !open/);
    expect(host).toMatch(/lazy\(\(\) => import\('\.\.\/pages\/Program'\)/);
  });

  it('the shared files carry exactly the expected one-line seams', () => {
    expect(importsOf(read('src/pages/Dashboard.tsx'))).toContain('../coaching/CoachingDashboardSlot');
    expect(importsOf(read('src/App.tsx'))).toContain('./coaching/ProgramHost');
    expect(importsOf(read('src/pages/settings/sections/AlertsSection.tsx'))).toContain('../CoachingSettings');
    expect((read('src/pages/Dashboard.tsx').match(/<CoachingDashboardSlot \/>/g) ?? []).length).toBe(1);
    expect((read('src/App.tsx').match(/<ProgramHost \/>/g) ?? []).length).toBe(1);
  });

  it('registers both flags', () => {
    const registry = read('src/features/registry.ts');
    expect(registry).toMatch(/hrt_coaching:/);
    expect(registry).toMatch(/urge_timer:/);
  });
});
