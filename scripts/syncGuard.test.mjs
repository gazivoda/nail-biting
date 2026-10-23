// Source-level guards for the sync workstream (WS4). They read the code, so they
// catch a mistake the behavioural tests cannot: a new call site that nobody
// exercised.
//
//  1. The events endpoints are written in ONE file (src/sync/api.ts). Nothing else
//     in src/ or electron/ may name them, so "sync off means no event network
//     calls" has one place to audit.
//  2. Inside src/sync every network request goes through the injected HttpRequest:
//     no fetch, XMLHttpRequest, beacon, socket or event stream of its own.
//  3. Nothing in the sync or backup code can reach the camera, the detector or the
//     local-only photo store.
//  4. No browser confirm dialogs in the data controls (confirmations are in the page).
//  5. The landing page's entry chunk does not carry the sync engine or its endpoints.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = p => relative(root, p).split('\\').join('/');
const isCode = f => /\.(ts|tsx|js|mjs)$/.test(f);
const isTest = f => /\.test\.(ts|tsx|js|mjs)$/.test(f);
const read = f => readFileSync(f, 'utf8');
/** Strips // and block comments so a mention in prose does not count. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const appFiles = [...walk(join(root, 'src')), ...(existsSync(join(root, 'electron')) ? walk(join(root, 'electron')) : [])].filter(isCode);
const syncFiles = walk(join(root, 'src', 'sync')).filter(isCode);
const backupFiles = walk(join(root, 'src', 'backup')).filter(isCode);

describe('the events endpoints live in one file', () => {
  it('src/sync/api.ts names them', () => {
    const api = read(join(root, 'src/sync/api.ts'));
    expect(api).toContain("'/api/events/sync'");
    expect(api).toContain("'/api/events/status'");
    expect(api).toContain("'/api/events'");
  });

  it('nothing else under src/ or electron/ does', () => {
    const offenders = appFiles
      .filter(f => rel(f) !== 'src/sync/api.ts')
      .filter(f => !isTest(f))
      .filter(f => /api\/events/.test(stripComments(read(f))))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('src/sync makes no request of its own', () => {
  const code = syncFiles.filter(f => !isTest(f));

  it.each([
    ['fetch(', /(^|[^A-Za-z_.])fetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['sendBeacon', /sendBeacon/],
    ['WebSocket', /WebSocket/],
    ['EventSource', /EventSource/],
  ])('no %s', (_name, re) => {
    const offenders = code.filter(f => re.test(stripComments(read(f)))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the only network call is the injected request, wired in apiFetchRequest.ts', () => {
    const users = code.filter(f => /\bapiFetch\b/.test(stripComments(read(f)))).map(rel);
    expect(users).toEqual(['src/sync/apiFetchRequest.ts']);
  });
});

describe('sync and backup cannot reach the camera or the local-only photo store', () => {
  const FORBIDDEN = [
    ['the local blob store', /storage\/blobs|localBlobs/],
    ['the detector', /biteDetector|useDetection|useCamera/],
    ['MediaPipe', /mediapipe|HandLandmarker|FaceLandmarker/i],
    ['getUserMedia', /getUserMedia/],
    ['a canvas (frames)', /\bcanvas\b|toDataURL|toBlob|createImageBitmap|ImageData/i],
    ['detection components', /components\/detection|components\/dashboard\/Camera/],
  ];
  for (const [name, re] of FORBIDDEN) {
    it(`does not touch ${name}`, () => {
      const offenders = [...syncFiles, ...backupFiles].filter(f => !isTest(f)).filter(f => re.test(stripComments(read(f)))).map(rel);
      expect(offenders).toEqual([]);
    });
  }
});

describe('confirmations are in the page', () => {
  it('no window.confirm / alert / prompt in the data and sync controls', () => {
    const files = [
      'src/pages/settings/DataSettings.tsx',
      'src/pages/settings/SyncSettings.tsx',
      ...syncFiles.filter(f => !isTest(f)).map(rel),
      ...backupFiles.filter(f => !isTest(f)).map(rel),
    ];
    for (const f of files) {
      expect(/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(stripComments(read(join(root, f)))), f).toBe(false);
    }
  });
});

describe('server.js', () => {
  it('has no events logic of its own, only the one body-parser exemption', () => {
    const src = read(join(root, 'server.js'));
    expect(src).not.toMatch(/habit_events/);
    expect((src.match(/\/api\/events/g) ?? []).length).toBe(1); // the one condition
  });
});

describe('the landing page does not download the sync engine', () => {
  const dist = join(root, 'dist');
  const built = existsSync(join(dist, 'index.html'));

  (built ? it : it.skip)('the entry chunk has no events endpoint and no engine', () => {
    const html = read(join(dist, 'index.html'));
    const entry = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
    expect(entry).toBeTruthy();
    const text = read(join(dist, entry.replace(/^\//, '')));
    expect(text).not.toContain('/api/events');
    expect(text).not.toContain('habit_events');
    expect(text).not.toContain('epoch_changed');
  });

  (built ? it : it.skip)('the endpoints appear only in chunks that load on demand (Settings, the sync runner)', () => {
    const assets = readdirSync(join(dist, 'assets')).filter(f => f.endsWith('.js'));
    const withEndpoint = assets.filter(f => read(join(dist, 'assets', f)).includes('/api/events'));
    expect(withEndpoint.length).toBeGreaterThan(0);
    const html = read(join(dist, 'index.html'));
    const entry = html.match(/<script[^>]+type="module"[^>]+src="\/?assets\/([^"]+)"/)?.[1];
    expect(withEndpoint).not.toContain(entry);
  });
});
