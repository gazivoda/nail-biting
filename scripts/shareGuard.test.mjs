// Source-level guards for the share-link workstream (WS10). They read the code, so they catch
// a mistake the behavioural tests cannot: a new call site nobody exercised.
//
//  1. The public share code (server/share/*, server/routes/share.js) cannot reach a user's
//     name or email: it never names the users table, getUser, findUserByEmail, saveUser,
//     sendEmail or an email column, and imports only what it needs.
//  2. The page renderer imports nothing but node:crypto: no network, no fs, no express.
//  3. The share endpoints are named in ONE client file (src/share/api.ts), and the client code
//     for sharing never touches analytics, storage or window.confirm: a link lives in memory
//     for as long as its panel is open and nowhere else.
//  4. The shared-file lines this workstream added are still there: the redirect exemption
//     (mixed-case tokens), the service worker denylist, the module registration, the flag.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
const rel = p => relative(root, p).split('\\').join('/');
const isTest = f => /\.test\.(ts|tsx|js|mjs)$/.test(f);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Strips // and block comments so a mention in prose does not count. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const serverShareFiles = [
  ...walk(join(root, 'server', 'share')).filter(f => /\.js$/.test(f) && !isTest(f)).map(rel),
  'server/routes/share.js',
];
const clientShareFiles = [
  ...walk(join(root, 'src', 'share')).filter(f => /\.(ts|tsx)$/.test(f) && !isTest(f)).map(rel),
  'src/pages/settings/SharingSettings.tsx',
  'src/pages/settings/sections/SharingSection.tsx',
];

describe('the public share code cannot reach a person', () => {
  it('lists the files it is guarding', () => {
    expect(serverShareFiles).toEqual(expect.arrayContaining([
      'server/share/links.js', 'server/share/page.js', 'server/share/summary.js', 'server/share/tokens.js', 'server/routes/share.js',
    ]));
  });

  it('never names the users table, a user lookup, an email, or the mailer', () => {
    for (const f of serverShareFiles) {
      const code = stripComments(read(f));
      expect(code, f).not.toMatch(/\busers\b/i);
      expect(code, f).not.toMatch(/\bgetUser\b|\bfindUserByEmail\b|\bsaveUser\b|\bsendEmail\b|\bsignToken\b/);
      expect(code, f).not.toMatch(/\.email\b|\bemail\s*[:=]|_email|email_|\bavatar\b|req\.user\b|req\.cookies/i);
      // the page may SAY "no name, email, ..." in its words; nothing else may use the word
      if (f !== 'server/share/page.js') expect(code, f).not.toMatch(/\bemail\b/i);
    }
  });

  it('imports only the modules it needs', () => {
    const allowed = {
      'server/routes/share.js': ['express-rate-limit', '../events/store.js', '../auth/session.js', '../share/links.js', '../share/tokens.js', '../share/summary.js', '../share/page.js'],
      'server/share/links.js': ['node:crypto'],
      'server/share/tokens.js': ['node:crypto'],
      'server/share/summary.js': [],
      'server/share/page.js': ['node:crypto'],
    };
    for (const f of serverShareFiles) {
      const imports = [...read(f).matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map(m => m[1]);
      expect(imports.sort(), f).toEqual([...(allowed[f] ?? [])].sort());
    }
  });
});

describe('the page renderer is pure', () => {
  it('summary.js and page.js do no I/O: no fetch, fs, network, process, env, timers or Date.now on their own', () => {
    for (const f of ['server/share/summary.js', 'server/share/page.js']) {
      const code = stripComments(read(f));
      expect(code, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|\brequire\s*\(|process\.|child_process|node:fs|node:http|node:net|setTimeout|setInterval/);
    }
  });

  it('page.js writes no absolute URL and no external script, stylesheet or font', () => {
    const code = stripComments(read('server/share/page.js'));
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/<script[^>]*\ssrc=|rel="stylesheet"|@import/);
  });

  it('summary.js builds its output by naming keys: no spread, Object.assign or copying of an event', () => {
    const code = stripComments(read('server/share/summary.js'));
    const toPublic = code.slice(code.indexOf('export function toPublicView'), code.indexOf('export function buildShareView'));
    expect(toPublic).toContain('version: VIEW_VERSION');
    expect(toPublic).not.toMatch(/\.\.\./);
    expect(toPublic).not.toMatch(/Object\.assign|structuredClone|JSON\.parse|\bevents?\b/);
  });
});

describe('the client side of sharing', () => {
  it('names the share endpoint in one file', () => {
    expect(read('src/share/api.ts')).toContain("'/api/share/links'");
    const offenders = walk(join(root, 'src'))
      .filter(f => /\.(ts|tsx|js)$/.test(f) && !isTest(f))
      .filter(f => rel(f) !== 'src/share/api.ts')
      .filter(f => /api\/share/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('never sends a link anywhere: no analytics, no storage, no beacon, no confirm dialog', () => {
    for (const f of clientShareFiles) {
      const code = stripComments(read(f));
      expect(code, f).not.toMatch(/utils\/track|\bgtag\b|\btrack\s*\(|dataLayer|sendBeacon|XMLHttpRequest|\bWebSocket\b/);
      expect(code, f).not.toMatch(/localStorage|sessionStorage|indexedDB|\bkv\b|storage\//);
      expect(code, f).not.toMatch(/\bconfirm\s*\(|window\.confirm|\balert\s*\(/);
      expect(code, f).not.toMatch(/console\.(log|info|debug)/);
    }
  });

  it('no request but the injected one: no fetch of its own', () => {
    for (const f of clientShareFiles.filter(x => x.startsWith('src/share/'))) {
      expect(stripComments(read(f)), f).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('draws no picture of the habit: no images and no icon but the sharing glyph', () => {
    const code = read('src/pages/settings/SharingSettings.tsx');
    expect(code).not.toMatch(/<img|<svg|\.png|\.jpg|\.svg|\.webp/);
    expect([...code.matchAll(/from 'lucide-react'/g)]).toHaveLength(1);
    expect(code).toMatch(/import \{ Share2 \} from 'lucide-react'/);
  });
});

describe('the shared-file lines are in place', () => {
  it('server.js keeps /share/ out of the lower-casing redirect (tokens are mixed case)', () => {
    const s = read('server.js');
    const block = s.slice(s.indexOf('One URL per page'), s.indexOf('Compression'));
    expect(block).toMatch(/path\.startsWith\('\/share\/'\)\) return next\(\)/);
    expect(block).toContain('toLowerCase()'); // the redirect it is exempt from is still there
  });

  it('server.js has no other WS10 edit', () => {
    expect(read('server.js')).not.toMatch(/share_links|createShareModule|server\/routes\/share/);
  });

  it('the service worker never answers /share/ with the cached app shell', () => {
    expect(read('vite.config.ts')).toMatch(/navigateFallbackDenylist:\s*\[[^\]]*\/\^\\\/share\\\/\//);
  });

  it('the module is registered, and the flag exists on both sides', () => {
    expect(read('server/routes/index.js')).toMatch(/import share from '\.\/share\.js'/);
    expect(read('server/routes/index.js')).toMatch(/^\s+share,/m);
    expect(read('server/features.js')).toContain("'share_links'");
    expect(read('src/features/registry.ts')).toMatch(/share_links:\s*\{/);
  });

  it('every public route is behind the flag (page: next("route"); data and owner API: requireFeature)', () => {
    const code = stripComments(read('server/routes/share.js'));
    expect(code).toMatch(/flags\.isOn\('share_links'\)\s*\?\s*next\(\)\s*:\s*next\('route'\)/);
    const registrations = [...code.matchAll(/app\.(get|post|delete|put|patch)\(([^;]*?)\);/gs)].map(m => m[0]);
    expect(registrations).toHaveLength(5);
    for (const r of registrations) expect(r, r).toMatch(/requireFeature\('share_links'\)|pageGate|ownerGate/);
  });
});
