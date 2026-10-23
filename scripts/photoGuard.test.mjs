// Source-level guards for the nail photo diary (WS5). They read the code, so they catch what a
// behavioural test cannot: a new call site nobody exercised.
//
//  1. Nothing under src/photos can make a network request: no fetch / XHR / beacon / socket /
//     event stream / Image / blob URL, and no import that reaches sync, export, auth or the server.
//     The only outside modules it may import are listed; everything they import in turn is
//     followed, and none of it may contain a network call (the one exception, the feature-flag
//     reader used by the two files that gate themselves, is checked on its own).
//  2. The photo bytes cannot ride along with history: WS4's sync whitelist, the server's event
//     keys and table have no photo-ish field, and sync / backup / export never mention the
//     photo store.
//  3. The service worker never sees a photo (they are IndexedDB blobs, not requests).
//  4. Nothing in the diary draws the habit: no emoji, no svg of its own, no image elements,
//     and only a short list of plain icons.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(f, 'utf8');
const rel = p => relative(root, p).split('\\').join('/');
const isTest = f => /\.test\.(ts|tsx|js|mjs)$/.test(f);
const isCode = f => /\.(ts|tsx|js|mjs)$/.test(f);
/** Strips // and block comments so prose that mentions a word does not count. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const photoFiles = walk(join(root, 'src', 'photos')).filter(isCode).filter(f => !isTest(f));
const photoCode = new Map(photoFiles.map(f => [f, stripComments(read(f))]));

// Files that only decide whether the feature is switched on. They are the only ones allowed to
// import the flag reader; neither can reach photo bytes except through the lazily loaded card.
const GATING = new Set(['src/photos/PhotoReminder.tsx', 'src/photos/PhotoDiarySettings.tsx']);

// ── import graph ─────────────────────────────────────────────────────────────

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function specifiers(code) {
  const out = [];
  for (const m of code.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

function resolveRelative(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Every repo file reachable from `entries` through relative imports (including lazy ones). */
function closure(entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!isCode(f)) continue;
    for (const spec of specifiers(stripComments(read(f)))) {
      if (!spec.startsWith('.')) continue;
      const target = resolveRelative(f, spec);
      if (target && !isTest(target)) stack.push(target);
    }
  }
  return [...seen];
}

// For the diary's own code: any mention counts.
const NETWORK = [
  ['fetch(', /(^|[^A-Za-z_.])fetch\s*\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['sendBeacon', /sendBeacon/],
  ['WebSocket', /WebSocket/],
  ['EventSource', /EventSource/],
];
// For code the diary merely reaches: a way to make a request (not a type that shares a name,
// like the `EventSource` alias in eventModel.ts, which means "alarm or manual").
const NETWORK_USE = [
  ['fetch', /(^|[^A-Za-z_.])fetch\b/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['sendBeacon', /sendBeacon/],
  ['new WebSocket', /new\s+WebSocket\b/],
  ['new EventSource', /new\s+EventSource\b/],
];

describe('src/photos makes no network request of its own', () => {
  it('there are source files to check', () => {
    expect(photoFiles.length).toBeGreaterThan(10);
  });

  it.each([
    ...NETWORK,
    ['apiFetch', /\bapiFetch\b/],
    ['new Image / Image(', /\bnew\s+Image\b|\bImage\s*\(/],
    ['createObjectURL (a blob: URL)', /createObjectURL|revokeObjectURL/],
    ['toDataURL / FileReader (data: URLs)', /toDataURL|FileReader/],
    ['a Notification or push call', /\bNotification\b|PushManager|pushManager|serviceWorker/],
    ['navigator.share / clipboard', /navigator\.(share|clipboard)/],
    ['postMessage / BroadcastChannel', /postMessage|BroadcastChannel/],
    ['a URL string (http, https, ws)', /['"`](https?|wss?):\/\//],
    ['an /api path', /['"`]\/api\//],
    ['direct browser storage', /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/],
  ])('no %s', (_name, re) => {
    const offenders = [...photoCode].filter(([, code]) => re.test(code)).map(([f]) => rel(f));
    expect(offenders).toEqual([]);
  });

  it('imports only from itself and a short list of outside modules', () => {
    const ALLOWED_OUTSIDE = new Set([
      'src/storage/blobs.ts', 'src/storage/kv.ts', 'src/store/useAppStore.ts', 'src/features/useFeature.ts', 'src/pages/settings/ui.tsx',
    ]);
    const ALLOWED_PACKAGES = new Set(['react', 'lucide-react', 'date-fns']);
    const bad = [];
    for (const [f, code] of photoCode) {
      for (const spec of specifiers(code)) {
        if (!spec.startsWith('.')) {
          if (!ALLOWED_PACKAGES.has(spec)) bad.push(`${rel(f)} imports package ${spec}`);
          continue;
        }
        const target = resolveRelative(f, spec);
        if (!target) { bad.push(`${rel(f)} imports ${spec}, which does not resolve`); continue; }
        const t = rel(target);
        if (t.startsWith('src/photos/')) continue;
        if (!ALLOWED_OUTSIDE.has(t)) bad.push(`${rel(f)} imports ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('never imports sync, backup, auth, the storage facade (events / export), the detector or the server', () => {
    const FORBIDDEN = /(^|\/)(sync|backup|contexts|server|electron)(\/|$)|storage\/index|from\s+'\.\.\/storage'|useCamera|useDetection|biteDetector|components\/detection|mediapipe/i;
    const offenders = [];
    for (const [f, code] of photoCode) for (const spec of specifiers(code)) if (FORBIDDEN.test(spec)) offenders.push(`${rel(f)}: ${spec}`);
    expect(offenders).toEqual([]);
  });

  it('the flag reader is imported only by the two files that gate themselves', () => {
    const users = [...photoCode].filter(([, code]) => /features\/useFeature/.test(code)).map(([f]) => rel(f)).sort();
    expect(users).toEqual([...GATING].sort());
  });

  it('nothing the photo pipeline reaches contains a network call', () => {
    const pipeline = photoFiles.filter(f => !GATING.has(rel(f)));
    const reached = closure(pipeline);
    // Sanity: the walk really followed imports into the store and the blob module.
    expect(reached.map(rel)).toEqual(expect.arrayContaining(['src/storage/blobs.ts', 'src/storage/kv.ts', 'src/store/useAppStore.ts']));
    const offenders = [];
    for (const f of reached.filter(isCode)) {
      const code = stripComments(read(f));
      for (const [name, re] of NETWORK_USE) if (re.test(code)) offenders.push(`${rel(f)} has ${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the gating files reach exactly one network file, the flag reader, and its one request carries no body', () => {
    const reached = closure(photoFiles.filter(f => GATING.has(rel(f))));
    const withNetwork = reached.filter(isCode).filter(f => NETWORK_USE.some(([, re]) => re.test(stripComments(read(f))))).map(rel);
    expect(withNetwork).toEqual(['src/features/flags.ts']);
    const flags = stripComments(read(join(root, 'src/features/flags.ts')));
    expect((flags.match(/doFetch\(/g) ?? []).length).toBe(1); // one request: GET /api/features
    expect(flags).toContain("doFetch('/api/features'");
    expect(flags).not.toMatch(/[{,]\s*(body|method)\s*:|POST|PUT/); // no request body, no non-GET method
    expect(flags).not.toMatch(/photo|blob|image|jpeg|diary/i);
    // And that file cannot reach the photo store or the blob module itself.
    const flagsReach = closure([join(root, 'src/features/flags.ts')]).map(rel);
    expect(flagsReach.filter(f => /photos\/|storage\/blobs/.test(f))).toEqual([]);
  });
});

describe('the photo bytes cannot ride along with history', () => {
  const FORBIDDEN_KEY = /photo|image|blob|picture|diary|jpeg|camera/i;

  it("WS4's client sync whitelist (SYNC_EVENT_FIELDS) has no photo-like field", () => {
    const src = read(join(root, 'src/sync/payload.ts'));
    const block = src.match(/SYNC_EVENT_FIELDS\s*=\s*\[([\s\S]*?)\]\s*as const/);
    expect(block, 'SYNC_EVENT_FIELDS not found').not.toBeNull();
    const keys = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(keys.length).toBeGreaterThan(8);
    expect(keys.filter(k => FORBIDDEN_KEY.test(k))).toEqual([]);
  });

  it("the server's accepted event keys (EVENT_KEYS) have no photo-like field", () => {
    const src = read(join(root, 'server/events/validate.js'));
    const block = src.match(/EVENT_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    expect(block, 'EVENT_KEYS not found').not.toBeNull();
    const keys = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(keys.length).toBeGreaterThan(8);
    expect(keys.filter(k => FORBIDDEN_KEY.test(k))).toEqual([]);
  });

  it("the server's habit_events table has no photo-like column", () => {
    const src = read(join(root, 'server/events/store.js'));
    const ddl = src.match(/CREATE TABLE IF NOT EXISTS habit_events \(([\s\S]*?)\)`\)/);
    expect(ddl, 'habit_events DDL not found').not.toBeNull();
    const columns = ddl[1].split('\n').map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
    expect(columns.length).toBeGreaterThan(8);
    expect(columns.filter(c => FORBIDDEN_KEY.test(c))).toEqual([]);
  });

  it('sync, backup and export never mention the photo store', () => {
    const files = [
      ...walk(join(root, 'src', 'sync')), ...walk(join(root, 'src', 'backup')),
      join(root, 'src/storage/eventModel.ts'), join(root, 'src/pages/settings/DataSettings.tsx'), join(root, 'src/pages/settings/SyncSettings.tsx'),
    ].filter(isCode).filter(f => !isTest(f));
    const offenders = files.filter(f => /src\/photos|\.\.\/photos|photo-diary|PHOTO_COLLECTION|photoStore|storage\/blobs|localBlobs/.test(stripComments(read(f)))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('events.exportAll (src/storage/index.ts) does not touch the blob store', () => {
    const src = stripComments(read(join(root, 'src/storage/index.ts')));
    const start = src.indexOf('exportAll');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('replaceAll', start));
    expect(body).not.toMatch(/blob|localBlobs|photo/i);
  });

  it('the server has no route, table or job that mentions photos', () => {
    const offenders = walk(join(root, 'server')).filter(isCode).filter(f => !isTest(f))
      .filter(f => /photo-diary|photoStore|nail[_ -]?photo|PHOTO_COLLECTION/i.test(stripComments(read(f)))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the local blob store has no upload, export, sync or URL helper', () => {
    const src = stripComments(read(join(root, 'src/storage/blobs.ts')));
    expect(src).not.toMatch(/upload|createObjectURL|toDataURL|exportAll|\bsync\b|fetch\(|sendBeacon|XMLHttpRequest/i);
    const exported = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m => m[1]).sort();
    expect(exported).toEqual(['blobStorageStatus', 'createIdbBlobStore', 'createMemoryBlobStore', 'localBlobs', 'setBlobStoreForTests']);
  });
});

describe('the service worker never sees a photo', () => {
  const vite = read(join(root, 'vite.config.ts'));

  it('no caching rule in vite.config.ts can match a photo request or blob URL', () => {
    const patterns = [...vite.matchAll(/urlPattern:\s*(\/(?:\\\/|[^/\n])+\/[a-z]*)/g)].map(m => {
      const lit = m[1];
      const i = lit.lastIndexOf('/');
      return new RegExp(lit.slice(1, i), lit.slice(i + 1));
    });
    expect(patterns.length).toBeGreaterThan(2);
    const samples = [
      'blob:http://localhost/3f6c-photo', 'http://localhost/photo-diary/abc.jpg', 'https://stopbiting.today/photo-diary/abc',
      'https://stopbiting.today/photos/abc.jpg', 'https://stopbiting.today/user-photo.jpeg', 'data:image/jpeg;base64,AAAA',
      'https://stopbiting.today/api/photos', 'https://stopbiting.today/assets/photo-diary.jpg',
    ];
    const hits = [];
    for (const re of patterns) for (const s of samples) if (re.test(s)) hits.push(`${re} matches ${s}`);
    expect(hits).toEqual([]);
  });

  it('vite.config.ts does not mention the photo diary at all (nothing precached or cached on its behalf)', () => {
    expect(vite).not.toMatch(/photo/i);
  });

  it('the photo bytes live in IndexedDB through the blob module, which no worker file imports', () => {
    const workerish = walk(join(root, 'src')).filter(isCode).filter(f => !isTest(f)).filter(f => /sw\.|serviceWorker|service-worker/i.test(f));
    expect(workerish.filter(f => /blobs|photos/.test(read(f))).map(rel)).toEqual([]);
  });

  const sw = join(root, 'dist/sw.js');
  (existsSync(sw) ? it : it.skip)('the built dist/sw.js names no photo store, collection or route', () => {
    const text = read(sw);
    expect(text).not.toMatch(/photo-diary|stop-biting-local-blobs/);
    // Its precache list holds app files only: no stored image of a person.
    const entries = [...text.matchAll(/url:\s*"([^"]+)"/g)].map(m => m[1]);
    expect(entries.length).toBeGreaterThan(5);
    expect(entries.filter(u => /diary|photo-|user-|capture/i.test(u) && !/\/assets\/[A-Za-z]+-[\w-]+\.(js|css)$/.test(u))).toEqual([]);
  });
});

describe('the diary draws nothing of the habit', () => {
  it('has no emoji or pictograph characters anywhere in its source', () => {
    const offenders = photoFiles.filter(f => /\p{Extended_Pictographic}/u.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('has no <img>, no svg or path of its own and no image URL', () => {
    const offenders = [...photoCode]
      .filter(([, code]) => /<img\b|<svg\b|<path\b|<polygon\b|viewBox|\bsrc=|\.(png|jpe?g|gif|svg|webp)['"`]/.test(code))
      .map(([f]) => rel(f));
    expect(offenders).toEqual([]);
  });

  it('uses only plain icons (a camera, a check, a lock, a bin, arrows)', () => {
    const ALLOWED = new Set(['Camera', 'Check', 'Images', 'Lock', 'RotateCcw', 'Trash2', 'X']);
    const used = new Set();
    for (const [, code] of photoCode) {
      for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g)) {
        for (const name of m[1].split(',').map(s => s.trim()).filter(Boolean)) used.add(name.replace(/^type\s+/, ''));
      }
    }
    expect([...used].filter(n => !ALLOWED.has(n))).toEqual([]);
    expect(used.size).toBeGreaterThan(3);
  });

  it('the words it shows never name the habit, a mouth or a face', () => {
    const offenders = [...photoCode]
      .filter(([, code]) => /\b(mouth|lips?|bit(e|ing|es)?|chew(ing)?)\b/i.test(code.replace(/Stop Biting/g, '')))
      .map(([f]) => rel(f));
    expect(offenders).toEqual([]);
  });

  it('keeps the framing guide sentence exactly', () => {
    expect(read(join(root, 'src/photos/copy.ts'))).toContain("'Place your hands flat in the frame, nails facing the camera'");
  });

  it('never uses the banned privacy wording', () => {
    const offenders = photoFiles.filter(f => /100% private|nothing leaves|zero network|no cloud|no server/i.test(stripComments(read(f)))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('in-app reminders only', () => {
  it('nothing in the diary sends a notification, a push or an email', () => {
    const offenders = [...photoCode].filter(([, code]) => /new Notification|requestPermission|showNotification|mailto:|sendEmail|resend/i.test(code)).map(([f]) => rel(f));
    expect(offenders).toEqual([]);
  });

  it('the server has no photo-diary reminder job', () => {
    const offenders = walk(join(root, 'server')).filter(isCode).filter(f => !isTest(f)).filter(f => /photo.?reminder/i.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });
});
