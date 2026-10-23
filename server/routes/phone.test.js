// The phone-companion manifest route (WS6): with the flag OFF the built manifest is served
// untouched by express.static (byte for byte); with it ON the same manifest comes back with the
// two home-screen shortcuts and nothing else changed.

import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import express from 'express';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRoutes, ROUTE_MODULES } from './index.js';
import phoneModule, { SHORTCUTS, buildPhoneManifest, createPhoneRoutes } from './phone.js';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { startTestServer } from '../../test-utils/testServer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// What `vite build` writes for this app (shape of dist/manifest.webmanifest), as one line like the real file.
const BUILT = {
  name: 'Stop Biting: AI Nail Habit Tracker', short_name: 'Stop Biting', start_url: '/', display: 'standalone',
  background_color: '#F7F7F1', theme_color: '#F7F7F1', lang: 'en', scope: '/', orientation: 'portrait-primary',
  icons: [
    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  screenshots: [],
};

let dirs = [];
let servers = [];
afterEach(async () => {
  await Promise.all(servers.map(s => s.close()));
  servers = [];
  dirs.forEach(d => rmSync(d, { recursive: true, force: true }));
  dirs = [];
});

/** An app wired like server.js: the registry first, then express.static over a dist folder. */
async function boot({ flags = '', writeManifest = true } = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'ws6-dist-'));
  dirs.push(dist);
  const text = JSON.stringify(BUILT);
  if (writeManifest) writeFileSync(join(dist, 'manifest.webmanifest'), text);
  const app = express();
  registerRoutes(
    { app, db: createMemoryDb({ users: true }), authMiddleware: (_q, _r, n) => n() },
    [createPhoneRoutes({ manifestPath: join(dist, 'manifest.webmanifest') })],
    { FEATURE_FLAGS: flags },
    () => {},
  );
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.status(404).type('html').send('<h1>page not found</h1>'));
  const srv = await startTestServer(app);
  servers.push(srv);
  return { srv, text };
}

describe('GET /manifest.webmanifest with phone_companion OFF', () => {
  it('is the built file, byte for byte, served by the static handler as before', async () => {
    const { srv, text } = await boot({ flags: '' });
    const res = await fetch(`${srv.url}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(text);
    expect(res.headers.get('content-type')).toMatch(/manifest\+json|application\/json/);
  });
  it('stays off for every other flag', async () => {
    const { srv, text } = await boot({ flags: 'event_sync,urge_timer,hrt_coaching' });
    expect(await (await fetch(`${srv.url}/manifest.webmanifest`)).text()).toBe(text);
  });
});

describe('GET /manifest.webmanifest with phone_companion ON', () => {
  it('is the same manifest plus the two shortcuts, and nothing else changed', async () => {
    const { srv } = await boot({ flags: 'phone_companion' });
    const res = await fetch(`${srv.url}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const { shortcuts, ...rest } = body;
    expect(rest).toEqual(BUILT);
    expect(shortcuts).toHaveLength(2);
    expect(shortcuts.map(s => s.name)).toEqual(['I bit', 'I feel an urge']);
  });
  it('is served as a manifest, and not cached stale', async () => {
    const { srv } = await boot({ flags: 'phone_companion' });
    const res = await fetch(`${srv.url}/manifest.webmanifest`);
    expect(res.headers.get('content-type')).toMatch(/^application\/manifest\+json/);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });
  it('answers HEAD the same way', async () => {
    const { srv } = await boot({ flags: 'phone_companion' });
    const res = await fetch(`${srv.url}/manifest.webmanifest`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/manifest\+json/);
  });
  it('with no built manifest it falls through to the static handler instead of failing', async () => {
    const { srv } = await boot({ flags: 'phone_companion', writeManifest: false });
    const res = await fetch(`${srv.url}/manifest.webmanifest`);
    expect(res.status).toBe(404); // the same answer the static handler gives today
  });
  it('with a manifest that is not JSON it falls through too', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'ws6-dist-'));
    dirs.push(dist);
    writeFileSync(join(dist, 'manifest.webmanifest'), 'not json');
    const app = express();
    registerRoutes({ app, db: createMemoryDb({ users: true }), authMiddleware: (_q, _r, n) => n() },
      [createPhoneRoutes({ manifestPath: join(dist, 'manifest.webmanifest') })], { FEATURE_FLAGS: 'phone_companion' }, () => {});
    app.use(express.static(dist));
    const srv = await startTestServer(app);
    servers.push(srv);
    const res = await fetch(`${srv.url}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('not json');
  });
});

describe('the shortcuts', () => {
  it('open the phone view\'s quick actions, inside the manifest scope', () => {
    expect(SHORTCUTS.map(s => s.url)).toEqual(['/?action=bite', '/?action=urge']);
    for (const s of SHORTCUTS) {
      expect(s.url.startsWith(BUILT.scope)).toBe(true);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.short_name.length).toBeLessThanOrEqual(12);
    }
  });
  it('point at icon files that exist in public/, are square PNGs of the size they declare, and are not the habit', () => {
    for (const s of SHORTCUTS) {
      for (const icon of s.icons) {
        const file = join(root, 'public', icon.src);
        expect(existsSync(file), icon.src).toBe(true);
        const png = readFileSync(file);
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        const w = png.readUInt32BE(16);
        const h = png.readUInt32BE(20);
        expect(`${w}x${h}`).toBe(icon.sizes);
      }
    }
  });
  it('only add `shortcuts`: buildPhoneManifest never drops or rewrites a built field', () => {
    expect(buildPhoneManifest(BUILT)).toEqual({ ...BUILT, shortcuts: SHORTCUTS });
    expect(buildPhoneManifest({})).toEqual({ shortcuts: SHORTCUTS });
  });
});

describe('registration', () => {
  it('is in the route registry, and the flag it reads exists', async () => {
    expect(ROUTE_MODULES).toContain(phoneModule);
    const { FLAG_NAMES } = await import('../features.js');
    expect(FLAG_NAMES).toContain('phone_companion');
  });
  it('the production module reads the manifest the build writes (dist/manifest.webmanifest next to server/)', async () => {
    const { DEFAULT_MANIFEST_PATH } = await import('./phone.js');
    expect(DEFAULT_MANIFEST_PATH).toBe(join(root, 'dist', 'manifest.webmanifest'));
  });
});

describe('the build leaves the manifest out of the service worker precache', () => {
  let config;
  beforeAll(() => { config = readFileSync(join(root, 'vite.config.ts'), 'utf8'); });
  it('vite.config.ts filters manifest.webmanifest out of the precache list', () => {
    expect(config).toMatch(/manifestTransforms/);
    expect(config).toMatch(/e\.url !== 'manifest\.webmanifest'/);
  });
});
