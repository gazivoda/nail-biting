import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { registerRoutes, buildContext, ROUTE_MODULES } from './index.js';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { startTestServer } from '../../test-utils/testServer.js';
import { FLAG_NAMES } from '../features.js';

let servers = [];
afterEach(async () => {
  await Promise.all(servers.map(s => s.close()));
  servers = [];
  vi.restoreAllMocks();
});
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

// A stand-in for server.js's authMiddleware: a header carries the user id.
const fakeAuth = (req, res, next) => {
  const id = req.headers['x-user'];
  if (!id) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = id;
  next();
};

async function boot(env = {}, modules = ROUTE_MODULES) {
  const app = express();
  const db = createMemoryDb({ users: true });
  const ctx = registerRoutes({ app, db, authMiddleware: fakeAuth }, modules, env);
  // What server.js has after the registry: a catch-all that would swallow a missed API route.
  app.get('/{*path}', (_req, res) => res.status(404).type('html').send('<h1>page not found</h1>'));
  const srv = await startTestServer(app);
  servers.push(srv);
  return { srv, ctx, db, app };
}

describe('GET /api/features', () => {
  it('with FEATURE_FLAGS unset: JSON, every flag explicitly false, short public cache', async () => {
    const { srv } = await boot({});
    const res = await fetch(`${srv.url}/api/features`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    const body = await res.json();
    expect(Object.keys(body)).toEqual(FLAG_NAMES);
    expect(Object.values(body).every(v => v === false)).toBe(true);
  });

  it('reflects the environment', async () => {
    const { srv } = await boot({ FEATURE_FLAGS: 'event_sync, insights' });
    const body = await (await fetch(`${srv.url}/api/features`)).json();
    expect(body.event_sync).toBe(true);
    expect(body.insights).toBe(true);
    expect(body.referrals).toBe(false);
  });

  it('is public: no cookie or header needed, nothing user-specific in the payload', async () => {
    const { srv } = await boot({});
    const res = await fetch(`${srv.url}/api/features`, { headers: { cookie: 'nh_session=anything' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('wins over the page catch-all registered after it', async () => {
    const { srv } = await boot({});
    const api = await fetch(`${srv.url}/api/features`);
    const other = await fetch(`${srv.url}/some-page`);
    expect(api.headers.get('content-type')).toMatch(/json/);
    expect(other.status).toBe(404);
    expect(await other.text()).toContain('page not found');
  });
});

describe('the worked example route', () => {
  it('is a 404 while its flag is off, even for a signed-in caller', async () => {
    const { srv } = await boot({});
    const res = await fetch(`${srv.url}/api/_example/ping`, { headers: { 'x-user': 'u1' } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('with the flag on: still needs auth, then answers', async () => {
    const { srv } = await boot({ FEATURE_FLAGS: 'experimental,detection_behaviors' });
    expect((await fetch(`${srv.url}/api/_example/ping`)).status).toBe(401);
    const ok = await fetch(`${srv.url}/api/_example/ping`, { headers: { 'x-user': 'u1' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, userId: 'u1', experimental: true });
  });
});

describe('registerRoutes', () => {
  it('hands modules the documented context', () => {
    const seen = {};
    const mod = { name: 'probe', register(ctx) { Object.assign(seen, ctx); } };
    const app = express();
    const db = createMemoryDb();
    registerRoutes({ app, db, authMiddleware: fakeAuth, getUser() {}, saveUser() {}, signToken() {}, findUserByEmail() {}, config: { APP_URL: 'http://x' } }, [mod], {});
    for (const key of ['app', 'db', 'authMiddleware', 'getUser', 'saveUser', 'signToken', 'findUserByEmail', 'sendEmail', 'flags', 'requireFeature', 'config']) {
      expect(seen[key], key).toBeDefined();
    }
    expect(typeof seen.sendEmail).toBe('function');
    expect(seen.config).toMatchObject({ APP_URL: 'http://x', isProduction: false });
  });

  it('runs a module\'s migrations before registering, against the real DB handle', async () => {
    const mod = {
      name: 'things',
      migrations: [{ id: 'things_001', up: h => h.createTable('CREATE TABLE IF NOT EXISTS things (id TEXT PRIMARY KEY, n INTEGER)') }],
      register({ app, db, requireFeature }) {
        app.get('/api/things', requireFeature('referrals'), (_req, res) => {
          db.prepare('INSERT OR IGNORE INTO things (id, n) VALUES (?, ?)').run('a', 1);
          res.json(db.prepare('SELECT * FROM things').all());
        });
      },
    };
    const { srv, db } = await boot({ FEATURE_FLAGS: 'referrals' }, [mod]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'things'").get()).toBeTruthy();
    expect(await (await fetch(`${srv.url}/api/things`)).json()).toEqual([{ id: 'a', n: 1 }]);
  });

  it('fails at boot, not at request time, when a module gates on a mistyped flag', () => {
    const bad = { name: 'bad', register({ app, requireFeature }) { app.get('/x', requireFeature('evnt_sync'), () => {}); } };
    expect(() => registerRoutes({ app: express(), db: createMemoryDb(), authMiddleware: fakeAuth }, [bad], {})).toThrow(/unknown feature flag/);
  });

  it('buildContext keeps an explicitly supplied flag set', () => {
    const flags = { names: FLAG_NAMES, isOn: () => true, all: () => ({}), enabled: () => [], unknown: [] };
    expect(buildContext({ flags }, {}).flags).toBe(flags);
  });
});

describe('server.js wiring', () => {
  it('imports the registry and calls it once, above the static/SSR block', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
    expect(src.match(/registerRoutes\(/g)).toHaveLength(1);
    expect(src.indexOf('registerRoutes({')).toBeLessThan(src.indexOf('// ─── Static (production)'));
    expect(src.indexOf('registerRoutes({')).toBeGreaterThan(src.indexOf("app.get('/api/paddle/portal-session'"));
  });

  it('the Dockerfile copies server/ into the runtime image', async () => {
    const { readFileSync } = await import('node:fs');
    const docker = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');
    expect(docker).toMatch(/^COPY server \.\/server$/m);
  });
});
