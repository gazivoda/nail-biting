// Source-level guards for WS7a (keep watching in the background). They check structural promises that are easy to
// break by accident and hard to see in a browser: they read the source and walk the import graph.
//
//  1. What useDetection.ts pulls in from src/background is LIGHT. useDetection is also loaded by the landing-page demo,
//     which must never pull the app store, the storage index, auth or the network into its bundle.
//  2. Nothing in src/background uses the network or the camera or draws anything: it moves no data and shows no
//     picture of the habit (text and neutral shapes only).
//  3. The notification prompt is asked in exactly one place, reached only from the Settings switch.
//  4. The tick worker is a self-contained file (the page's CSP, `worker-src 'self'`, allows no blob: workers).
//  5. The loop's new tick source is behind the flag, and the seams WS1, WS2 and WS3 put into the files WS7a owns are
//     still there, byte for byte.
//  6. The measurement hook exists only behind the build-time define.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
    if (existsSync(p)) {
      try { readFileSync(p); return relative(root, p); } catch { /* a directory */ }
    }
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

const BG = 'src/background';
const bgFiles = readdirSync(join(root, BG)).filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));

describe('what the landing-page demo loads with useDetection', () => {
  const { files, packages } = graph('src/hooks/useDetection.ts', true);
  const local = [...files];

  it('does not reach the app store, the storage index, auth, the network helpers or React components of the app', () => {
    for (const bad of ['src/store/useAppStore.ts', 'src/storage/index.ts', 'src/contexts/AuthContext.tsx', 'src/utils/track.ts']) {
      expect(local, bad).not.toContain(bad);
    }
    expect(local.filter(f => /\/billing\/|\/sync\/|\/desktop\//.test(f))).toEqual([]);
    expect(local.filter(f => f.endsWith('.tsx') && f.startsWith(BG))).toEqual([]);
  });

  it('brings in only these files from src/background', () => {
    const fromBg = local.filter(f => f.startsWith(BG)).map(f => f.slice(BG.length + 1)).sort();
    expect(fromBg).toEqual([
      'appTicker.ts', 'hiddenSource.ts', 'pauseMachine.ts', 'probeHook.ts', 'silent.ts', 'tickHost.ts', 'ticker.ts', 'watchStore.ts',
    ]);
  });

  it('adds no package (the worker is plain browser API)', () => {
    expect([...packages].sort()).toEqual(['@mediapipe/tasks-vision', 'react']);
  });
});

describe('src/background moves no data and shows no picture', () => {
  it('has no network call', () => {
    for (const f of bgFiles) {
      const code = strip(read(`${BG}/${f}`));
      expect(code, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|apiFetch|\btrack\s*\(/);
    }
  });

  it('never opens the camera, captures a frame or touches pixels', () => {
    for (const f of bgFiles) {
      const code = strip(read(`${BG}/${f}`));
      expect(code, f).not.toMatch(/getUserMedia|getDisplayMedia|ImageCapture|<canvas|createElement\(['"]canvas|toDataURL|toBlob|drawImage|MediaRecorder|<img|<video|<svg|<picture/);
    }
  });

  it('does not touch Web Storage or IndexedDB directly (it uses the storage module)', () => {
    for (const f of bgFiles) {
      expect(strip(read(`${BG}/${f}`)), f).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
    }
  });

  it('draws only text and neutral shapes: icons are the one calendar glyph in Settings', () => {
    const icons = new Set();
    for (const f of bgFiles) {
      for (const m of read(`${BG}/${f}`).matchAll(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g)) m[1].split(',').forEach(n => icons.add(n.trim()));
    }
    expect([...icons]).toEqual(['CalendarClock']);
  });
});

describe('the notification prompt', () => {
  it('is asked for in one function, called from one place: the Settings switch', () => {
    const asks = [];
    const callers = [];
    for (const f of bgFiles) {
      const code = strip(read(`${BG}/${f}`));
      if (/requestPermission\s*\(/.test(code)) asks.push(f);
      if (/askNotificationPermission\s*\(/.test(code) && f !== 'reminders.ts') callers.push(f);
    }
    expect(asks).toEqual(['reminders.ts']);
    expect(callers).toEqual(['ScheduleSettings.tsx']);
    // nothing outside src/background asks either (the old reminders in useNotifications.ts have their own switch)
    const outside = [];
    const walk = dir => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (p !== BG) walk(p); }
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && /askNotificationPermission/.test(read(p))) outside.push(p);
      }
    };
    walk('src');
    expect(outside).toEqual([]);
  });
});

describe('the tick worker', () => {
  const src = read(`${BG}/tickWorker.ts`);
  it('has no imports and is tiny', () => {
    expect(importsOf(src)).toEqual([]);
    expect(src.length).toBeLessThan(2500);
  });
  it('is created from a same-origin URL (Vite turns it into a file under /assets/), never from a blob', () => {
    const app = strip(read(`${BG}/appTicker.ts`));
    expect(app).toContain("new Worker(new URL('./tickWorker.ts', import.meta.url)");
    for (const f of bgFiles) expect(strip(read(`${BG}/${f}`)), f).not.toMatch(/createObjectURL|new Blob\(|data:text\/javascript/);
  });
  it('the page policy still allows exactly that', () => {
    expect(read('server.js')).toContain(`workerSrc:   ["'self'"]`);
  });
});

describe('the loop and the seams it must keep', () => {
  const detection = read('src/hooks/useDetection.ts');

  it('uses the new tick source only behind the flag, and falls back to the 500 ms interval', () => {
    const at = detection.indexOf('createHiddenSource({');
    expect(at).toBeGreaterThan(0);
    expect(detection.slice(Math.max(0, at - 250), at)).toContain("isFeatureOn('background_watching')");
    expect(detection).toContain('startBgInterval()');
    expect(detection).toContain('}, 500);');
    // the worker/ticker is also used for the alarm repeat, behind the same flag
    expect(detection).toMatch(/document\.hidden && isFeatureOn\('background_watching'\)/);
  });

  it('keeps WS3\'s hand-source line and WS1\'s behaviours line byte for byte', () => {
    expect(detection).toContain('detectHands: (video, ts) => detectHandsWithSides(hand, video as HTMLVideoElement, ts),');
    expect(detection).toContain('getBehaviors: () => behaviorsRef.current ?? DEFAULT_BEHAVIOR_LIST,');
    expect(detection).toContain('face.detectForVideo(video as HTMLVideoElement, ts).faceLandmarks ?? [],');
  });

  it('keeps WS2\'s and WS3\'s mini-window seams', () => {
    const pip = read('src/components/detection/PiPWindow.tsx');
    expect(pip).toContain('<CoachingSeam surface="pip" />');
    expect(pip).toContain('<NotABiteSeam surface="pip" />');
    const overlay = read('src/components/detection/AlertOverlay.tsx');
    expect(overlay).toContain('<CoachingSeam surface="main" />');
    expect(overlay).toContain('<NotABiteSeam surface="main" />');
    expect(read('src/components/detection/CameraView.tsx')).toContain('...alarmHandExtras()');
  });

  it('meeting mode is checked in the alarm itself, so no path can sound or notify', () => {
    const start = detection.indexOf('const startBiting');
    const block = detection.slice(start, detection.indexOf('const stopBiting'));
    expect(block).toContain('silentNow()');
    expect(block).toMatch(/document\.hidden && !silent/);
    expect(block).toMatch(/if \(!silent\) window\.electronAPI/);
  });

  it('the document PiP window is told to the loop and forgotten when it closes', () => {
    const pip = read('src/hooks/usePictureInPicture.ts');
    expect(pip).toContain('setPipTickWindow(win)');
    expect(pip.match(/setPipTickWindow\(null\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the measurement hook', () => {
  it('exists only behind a build-time define, and only the loop uses it', () => {
    const hook = read(`${BG}/probeHook.ts`);
    expect(hook).toContain("import.meta.env.VITE_WS7A_PROBE !== '1'");
    const users = [];
    const walk = dir => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && /withProbe|VITE_WS7A_PROBE|__sbProbe/.test(read(p))) users.push(p);
      }
    };
    walk('src');
    expect(users.sort()).toEqual(['src/background/probeHook.ts', 'src/hooks/useDetection.ts']);
  });
});
