// HTTP tests for the share-link routes, against a real Express app on an ephemeral port,
// an in-memory SQLite database and the real event store. These are the privacy acceptance
// tests of WS10: dead links are indistinguishable, the page and the API show only the
// whitelisted summary, nothing third-party is on the page, and nothing is reachable without
// the flag, sign-in, or the token.

import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createEventStore } from '../events/store.js';
import { ev, makeClock, makeShareHarness, stableHeaders } from '../../test-utils/shareHarness.js';
import { MAX_ACTIVE_LINKS, parseCreateRequest } from './share.js';

const DAY = 86400000;
const HOUR = 3600000;
const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);

const open = [];
async function boot(opts = {}) {
  const h = await makeShareHarness({ clock: makeClock(T0), ...opts });
  open.push(h);
  return h;
}
afterEach(async () => {
  while (open.length) await open.pop().close();
});

const BASE_KEYS = ['version', 'detailed', 'hasData', 'window', 'streak', 'totals', 'daily', 'weekly', 'triggers', 'competingResponse'];

/** History with every kind of field a real account has, including personal-looking ones. */
function seedRich(h, userId = 'u1') {
  h.addUser(userId, { email: 'owner-LEAK@leak.example', name: 'Owner LEAK Person' });
  h.seed(userId, [
    ev({ id: 'LEAK-id-1', ts: T0 - 2 * HOUR, source: 'manual', triggers: ['stress'], hand: 'left', deviceId: 'LEAK-device-A' }),
    ev({ id: 'LEAK-id-2', ts: T0 - 30 * HOUR, source: 'alarm', confirmed: true, triggers: ['custom-LEAKtag'], deviceId: 'LEAK-device-B', competingResponse: { done: true, durationSec: 30 } }),
    ev({ id: 'LEAK-id-3', ts: T0 - 3 * DAY, source: 'alarm', competingResponse: { done: false, durationSec: 3 } }),
    ev({ id: 'LEAK-id-4', ts: T0 - 5 * DAY, source: 'manual', triggers: ['urge'] }),
    ev({ id: 'LEAK-id-5', ts: T0 - 9 * DAY, source: 'manual', triggers: ['boredom'], behavior: 'nose_picking' }),
    ev({ id: 'LEAK-id-6', ts: T0 - 40 * DAY, source: 'manual', triggers: ['focus'] }),
    ev({ id: 'LEAK-id-7', ts: T0 - 4 * HOUR, source: 'manual', deleted: true }),
  ]);
}

const LEAKS = /LEAK|owner-|leak\.example|Owner|u1@|Dr Who|private note/i;

// ── Flag off ─────────────────────────────────────────────────────────────────

describe('with the flag off', () => {
  it('every route answers 404 and nothing is served, even for a token that was issued while it was on', async () => {
    const on = await boot();
    seedRich(on);
    const made = await on.create('u1', { label: 'x', detailed: true });
    expect(made.status).toBe(201);
    const token = made.body.token;
    expect((await on.page(token)).status).toBe(200);

    const off = await boot({ db: on.db, flags: 'event_sync' }); // same data, flag removed
    for (const [method, path] of [['POST', '/api/share/links'], ['GET', '/api/share/links'], ['DELETE', `/api/share/links/${made.body.id}`]]) {
      const res = await off.call(method, path, { user: 'u1', body: method === 'POST' ? {} : undefined });
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found' });
    }
    const page = await off.page(token);
    expect(page.status).toBe(404);
    expect(page.text).toBe('<h1>site not found page</h1>'); // the site's own 404, not the share page
    expect(page.headers.get('x-robots-tag')).toBeNull();
    const data = await off.data(token);
    expect(data.status).toBe(404);
    expect(data.json).toEqual({ error: 'Not found' });
  });

  it('is off when FEATURE_FLAGS is empty (the default)', async () => {
    const h = await boot({ flags: '' });
    expect((await h.create('u1', {})).status).toBe(404);
    expect((await h.page('a'.repeat(43))).text).toBe('<h1>site not found page</h1>');
  });
});

// ── Owner API: sign-in and validation ────────────────────────────────────────

describe('the owner API', () => {
  it('requires sign-in for create, list and revoke', async () => {
    const h = await boot();
    expect((await h.call('POST', '/api/share/links', { body: {} })).status).toBe(401);
    expect((await h.call('GET', '/api/share/links')).status).toBe(401);
    expect((await h.call('DELETE', '/api/share/links/abc')).status).toBe(401);
    expect(h.linkRows()).toEqual([]);
  });

  it('creates a link, returns the token once, and stores only its hash', async () => {
    const h = await boot();
    const r = await h.create('u1', { label: '  for Dr Who  ', expiresInDays: 90, detailed: true, timezone: 'Europe/Belgrade' });
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const b = r.body;
    expect(Object.keys(b).sort()).toEqual(['createdAt', 'detailed', 'expiresAt', 'id', 'label', 'lastViewedAt', 'token', 'url']);
    expect(b.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b.url).toBe(`${h.url}/share/${b.token}`);
    expect(b.label).toBe('for Dr Who');
    expect(b.detailed).toBe(true);
    expect(b.expiresAt).toBe(T0 + 90 * DAY);
    expect(b.createdAt).toBe(T0);

    const row = h.linkRows()[0];
    expect(row.token_hash).toBe(createHash('sha256').update(b.token).digest('hex'));
    expect(JSON.stringify(row)).not.toContain(b.token);
    expect(row.timezone).toBe('Europe/Belgrade');
    expect(JSON.parse(row.scope)).toEqual({ detailed: true });
  });

  it('uses APP_URL for the link when the server has one', async () => {
    const h = await boot({ config: { APP_URL: 'https://stopbiting.today/' } });
    const r = await h.create('u1', {});
    expect(r.body.url).toBe(`https://stopbiting.today/share/${r.body.token}`);
  });

  it('defaults to the narrow, expiring choice: not detailed, 30 days', async () => {
    const h = await boot();
    const r = await h.create('u1', undefined);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ detailed: false, label: '', expiresAt: T0 + 30 * DAY });
  });

  it('accepts 7, 30, 90 days or no expiry, and nothing else', async () => {
    const h = await boot();
    for (const d of [7, 30, 90]) expect((await h.create('u1', { expiresInDays: d })).body.expiresAt).toBe(T0 + d * DAY);
    expect((await h.create('u1', { expiresInDays: null })).body.expiresAt).toBeNull();
    for (const bad of [0, 1, 365, -7, 7.5, '7', true, [], {}]) {
      expect((await h.create('u1', { expiresInDays: bad })).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('refuses bad input with 400 and names the field, never echoing the value', async () => {
    const h = await boot();
    const cases = [
      [{ label: 5 }, 'label'], [{ label: 'x'.repeat(61) }, 'label'], [{ detailed: 'yes' }, 'detailed'], [{ detailed: 1 }, 'detailed'],
      [{ timezone: 5 }, 'timezone'], [{ token: 'chosen-by-the-client' }, 'token'], [{ userId: 'u2' }, 'userId'],
      [{ scope: { detailed: true } }, 'scope'], [{ label: 'ok', extra: 1 }, 'extra'], [[], 'body'], ['text', 'body'],
    ];
    for (const [body, field] of cases) {
      const r = await h.call('POST', '/api/share/links', { user: 'u1', raw: JSON.stringify(body) });
      const text = await r.text(); // a bare JSON string is refused by the body parser before our code (HTML 400)
      expect(r.status, JSON.stringify(body)).toBe(400);
      if (field !== 'body' || Array.isArray(body)) expect(JSON.parse(text).field).toBe(field);
      expect(text).not.toContain('chosen-by-the-client');
    }
    expect(h.linkRows()).toEqual([]);
  });

  it('strips control characters from the label and falls back to UTC for a bad zone', async () => {
    const h = await boot();
    const r = await h.create('u1', { label: 'a\u0000b\nc\t d', timezone: 'Not/AZone' });
    expect(r.body.label).toBe('a b c d');
    expect(h.linkRows()[0].timezone).toBe('UTC');
  });

  it('stops at the maximum number of active links, per user, and frees a place on revoke', async () => {
    const h = await boot();
    const made = [];
    for (let i = 0; i < MAX_ACTIVE_LINKS; i++) made.push((await h.create('u1', { label: `l${i}` })).body);
    const over = await h.create('u1', {});
    expect(over.status).toBe(409);
    expect(over.body).toEqual({ error: 'too_many_links', limit: MAX_ACTIVE_LINKS });
    expect((await h.create('u2', {})).status).toBe(201); // another user is unaffected
    expect((await h.revoke('u1', made[0].id)).status).toBe(200);
    expect((await h.create('u1', {})).status).toBe(201);
  });

  it('lists only the caller\'s active links, with no token, hash or user id', async () => {
    const h = await boot();
    seedRich(h);
    const a1 = (await h.create('u1', { label: 'one' })).body;
    const a2 = (await h.create('u1', { label: 'two', detailed: true })).body;
    await h.create('u2', { label: 'someone else' });
    const l = await h.list('u1');
    expect(l.status).toBe(200);
    expect(Object.keys(l.body).sort()).toEqual(['links', 'max', 'syncedEntries']);
    expect(l.body.max).toBe(MAX_ACTIVE_LINKS);
    expect(l.body.syncedEntries).toBe(6); // seven written, one deleted
    expect(l.body.links.map(x => x.label).sort()).toEqual(['one', 'two']);
    for (const link of l.body.links) {
      expect(Object.keys(link).sort()).toEqual(['createdAt', 'detailed', 'expiresAt', 'id', 'label', 'lastViewedAt']);
    }
    const text = JSON.stringify(l.body);
    for (const secret of [a1.token, a2.token, 'token_hash', 'user_id', 'u2', 'someone else']) expect(text).not.toContain(secret);
    expect((await h.list('u3')).body).toEqual({ links: [], max: MAX_ACTIVE_LINKS, syncedEntries: 0 });
  });

  it('does not list revoked or expired links', async () => {
    const h = await boot();
    const a = (await h.create('u1', { label: 'revoked' })).body;
    await h.create('u1', { label: 'expires', expiresInDays: 7 });
    await h.create('u1', { label: 'stays', expiresInDays: null });
    await h.revoke('u1', a.id);
    h.clock.advance(8 * DAY);
    expect((await h.list('u1')).body.links.map(x => x.label)).toEqual(['stays']);
  });
});

// ── Cross-user isolation ─────────────────────────────────────────────────────

describe('one account cannot touch another\'s links', () => {
  it('cannot revoke them (404, the link keeps working), and cannot see them', async () => {
    const h = await boot();
    seedRich(h, 'alice');
    h.addUser('bob');
    const a = (await h.create('alice', { label: 'alice link' })).body;
    const b = (await h.revoke('bob', a.id));
    expect(b.status).toBe(404);
    expect(b.body).toEqual({ error: 'Not found' });
    expect((await h.page(a.token)).status).toBe(200);
    expect((await h.list('bob')).body.links).toEqual([]);
    expect((await h.list('alice')).body.links).toHaveLength(1);
    // a revoke of a link that never existed looks exactly the same
    expect(await h.revoke('bob', 'no-such-link')).toEqual(b);
  });

  it('shows each link the history of its OWN owner only', async () => {
    const h = await boot();
    h.seed('alice', [ev({ id: 'a1', ts: T0 - HOUR, source: 'manual', triggers: ['stress'] })]);
    h.seed('bob', [ev({ id: 'b1', ts: T0 - HOUR, source: 'manual', triggers: ['boredom'] }), ev({ id: 'b2', ts: T0 - 2 * HOUR, source: 'manual', triggers: ['boredom'] })]);
    const a = (await h.create('alice', {})).body;
    const b = (await h.create('bob', {})).body;
    expect((await h.data(a.token)).json.totals.last7Days).toBe(1);
    expect((await h.data(b.token)).json.totals.last7Days).toBe(2);
    expect((await h.data(a.token)).json.triggers.find(t => t.key === 'boredom').count).toBe(0);
  });
});

// ── Billing state never blocks revoking ──────────────────────────────────────

describe('an expired or lapsed account', () => {
  it('can still list and revoke its links (sharing has no entitlement check of its own)', async () => {
    const h = await boot();
    seedRich(h);
    const made = (await h.create('u1', { label: 'before the trial ended' })).body;
    h.db.prepare("UPDATE users SET subscription_status = 'expired', trial_end_date = '2000-01-01' WHERE id = 'u1'").run();
    expect((await h.list('u1')).body.links).toHaveLength(1);
    expect((await h.revoke('u1', made.id)).status).toBe(200);
    expect((await h.page(made.token)).status).toBe(404);
  });
});

// ── Revoked, expired, unknown: one answer ────────────────────────────────────

describe('a dead link gets ONE answer', () => {
  async function deadLinks(h) {
    seedRich(h);
    const live = (await h.create('u1', { label: 'live', expiresInDays: null })).body;
    const revoked = (await h.create('u1', { label: 'revoked' })).body;
    const expiring = (await h.create('u1', { label: 'expiring', expiresInDays: 7 })).body;
    await h.revoke('u1', revoked.id);
    h.clock.advance(8 * DAY);
    const flipped = live.token === live.token.toLowerCase() ? live.token.toUpperCase() : live.token.toLowerCase();
    return {
      live,
      dead: {
        revoked: revoked.token,
        expired: expiring.token,
        unknown: 'Zk3J9bQe7mV1xP0aLwT5uYhR8cN2dFgS4iOvEtXqH6M', // right shape, never issued
        wrongCase: flipped,                                      // a real token with its case changed
        tooShort: 'abc',
        tooLong: 'A'.repeat(80),
        badChars: `${'a'.repeat(42)}!`,
        percent: `${'a'.repeat(40)}%20ab`,
        dots: '..%2f..%2fetc%2fpasswd',
      },
    };
  }

  it('same status, same body, same headers for revoked, expired, unknown and malformed (page and JSON)', async () => {
    const h = await boot();
    const { dead } = await deadLinks(h);
    for (const kind of ['page', 'data']) {
      const results = {};
      for (const [name, token] of Object.entries(dead)) {
        const r = await h[kind](token);
        results[name] = { status: r.status, text: r.text, headers: stableHeaders(r.headers) };
      }
      const first = results.revoked;
      expect(first.status, kind).toBe(404);
      for (const [name, r] of Object.entries(results)) expect(r, `${kind}: ${name}`).toEqual(first);
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(first.headers['referrer-policy']).toBe('no-referrer');
      expect(first.headers['set-cookie']).toBeUndefined();
    }
  });

  it('the dead-link body says nothing about why, and contains no data', async () => {
    const h = await boot();
    const { dead } = await deadLinks(h);
    const page = await h.page(dead.revoked);
    expect(page.text).not.toMatch(/revoked by|has been revoked|expired on|\d{4}-\d{2}-\d{2}/i);
    expect(page.text).not.toMatch(LEAKS);
    expect((await h.data(dead.expired)).json).toEqual({ error: 'Not found' });
  });

  it('a link stops working the moment it is revoked, and the moment it expires', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { expiresInDays: 7 })).body;
    expect((await h.data(l.token)).status).toBe(200);
    h.clock.set(T0 + 7 * DAY - 1);
    expect((await h.data(l.token)).status).toBe(200);
    h.clock.set(T0 + 7 * DAY);
    expect((await h.data(l.token)).status).toBe(404);

    const m = (await h.create('u1', { expiresInDays: null })).body;
    expect((await h.page(m.token)).status).toBe(200);
    expect((await h.revoke('u1', m.id)).status).toBe(200);
    expect((await h.page(m.token)).status).toBe(404);
    expect((await h.data(m.token)).status).toBe(404);
    expect((await h.revoke('u1', m.id)).status).toBe(404); // already gone
  });

  it('dead-link requests do not touch last_viewed_at; live ones do (not HEAD)', async () => {
    const h = await boot();
    seedRich(h);
    const live = (await h.create('u1', { label: 'live' })).body;
    const dead = (await h.create('u1', { label: 'dead' })).body;
    await h.revoke('u1', dead.id);
    h.clock.advance(HOUR);

    await h.page(dead.token); await h.data(dead.token); await h.page('Zk3J9bQe7mV1xP0aLwT5uYhR8cN2dFgS4iOvEtXqH6M');
    await h.page(live.token, { method: 'HEAD' });
    expect(h.linkRows().map(r => r.last_viewed_at)).toEqual([null, null]);

    await h.page(live.token);
    const viewed = h.linkRows().find(r => r.id === live.id).last_viewed_at;
    expect(viewed).toBe(T0 + HOUR);
    expect((await h.list('u1')).body.links[0].lastViewedAt).toBe(T0 + HOUR);
    expect(h.linkRows().find(r => r.id === dead.id).last_viewed_at).toBeNull();
  });

  it('treats the token as case sensitive and ignores a trailing slash', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    expect(l.token).not.toBe(l.token.toLowerCase()); // mixed case, as a real token is
    expect((await h.page(l.token)).status).toBe(200);
    expect((await h.page(l.token.toLowerCase())).status).toBe(404);
    expect((await h.page(`${l.token}/`)).status).toBe(200);
  });

  it('refuses other methods on the public paths', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const r = await fetch(`${h.url}/share/${l.token}`, { method });
      expect(r.status, method).toBe(404);
      expect(await r.text()).not.toMatch(LEAKS);
    }
  });
});

// ── What the public API reveals ──────────────────────────────────────────────

describe('the public JSON', () => {
  it('has exactly the documented keys when detailed is off, and no dates or hours', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { detailed: false })).body;
    const r = await h.data(l.token);
    expect(r.status).toBe(200);
    expect(Object.keys(r.json).sort()).toEqual([...BASE_KEYS].sort());
    expect(r.text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(r.text).not.toContain('byHour');
    expect(r.json.detailed).toBe(false);
  });

  it('has exactly one extra key, detail, when detailed is on, holding only day-level dates and hour buckets', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { detailed: true, timezone: 'UTC' })).body;
    const r = await h.data(l.token);
    expect(Object.keys(r.json).sort()).toEqual([...BASE_KEYS, 'detail'].sort());
    expect(Object.keys(r.json.detail).sort()).toEqual(['byHour', 'lastBiteDate', 'today']);
    expect(r.json.detail.today).toBe('2026-10-21');
    expect(r.json.detail.lastBiteDate).toBe('2026-10-21');
    expect(r.json.detail.byHour).toHaveLength(24);
    // no timestamp-looking numbers anywhere: every number is a count, a day count or a percentage
    const nums = [];
    JSON.stringify(r.json, (_k, v) => { if (typeof v === 'number') nums.push(v); return v; });
    expect(Math.max(...nums)).toBeLessThan(1_000_000);
  });

  it('reports what the history says', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { detailed: false })).body;
    const j = (await h.data(l.token)).json;
    expect(j.hasData).toBe(true);
    expect(j.streak).toEqual({ days: 0, since: 'last_bite' });  // a manual entry 2 hours ago
    expect(j.totals).toEqual({ last7Days: 2, previous7Days: 1, last12Weeks: 4 });
    expect(Object.fromEntries(j.triggers.map(t => [t.key, t.count]))).toEqual({ stress: 1, focus: 1, boredom: 1, unknown: 0, other: 1 });
    expect(j.competingResponse).toEqual({ alarms: 2, completed: 1, ratePercent: 50 });
  });

  it('leaks nothing personal: not the label, email, name, user id, event ids, device ids or custom reasons', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { label: 'Dr Who private note', detailed: true })).body;
    for (const r of [await h.data(l.token), await h.page(l.token)]) {
      expect(r.status).toBe(200);
      expect(r.text).not.toMatch(LEAKS);
      expect(r.text).not.toContain(l.token);
      expect(r.text).not.toContain(l.id);
    }
  });

  it('says plainly there is nothing to show when no history was ever synced', async () => {
    const h = await boot();
    const l = (await h.create('nobody-synced', {})).body;
    const j = (await h.data(l.token)).json;
    expect(j).toMatchObject({ hasData: false, streak: null, totals: { last12Weeks: 0 } });
    const page = await h.page(l.token);
    expect(page.status).toBe(200);
    expect(page.text).toContain('No history to show yet');
    expect(page.text).not.toContain('Days since the last logged bite');
  });

  it('follows the owner: a wiped history shows as empty, deleted entries disappear', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    expect((await h.data(l.token)).json.hasData).toBe(true);
    createEventStore(h.db).wipe('u1');
    expect((await h.data(l.token)).json).toMatchObject({ hasData: false, streak: null });
  });
});

// ── The page ─────────────────────────────────────────────────────────────────

describe('the page', () => {
  async function pageFor(opts) {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', opts)).body;
    return { h, l, page: await h.page(l.token) };
  }

  it('is private: no-store, noindex in the header AND the markup, no referrer, no cookie', async () => {
    const { page } = await pageFor({});
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/^text\/html/);
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(page.headers.get('set-cookie')).toBeNull();
    expect(page.text).toMatch(/<meta name="robots" content="noindex, nofollow/);
    expect(page.text).toMatch(/<meta name="referrer" content="no-referrer">/);
    expect(page.text).not.toMatch(/rel="canonical"|property="og:|name="twitter:|application\/ld\+json/);
  });

  it('has no analytics and nothing from any other site', async () => {
    const { page } = await pageFor({ detailed: true });
    const html = page.text;
    expect(html).not.toMatch(/googletagmanager|google-analytics|\bgtag\b|dataLayer|paddle|profitwell|formspree|gstatic|googleapis|facebook|hotjar|mixpanel|segment\.|plausible|clarity\.ms|sentry|doubleclick/i);
    expect(html).not.toMatch(/https?:\/\//i);               // not one absolute URL on the page
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);          // no external script
    expect(html).not.toMatch(/<link[^>]*rel="(stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload)"/i);
    expect(html).not.toMatch(/<(iframe|object|embed|form|video|audio|base)\b/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);                // no inline handlers
    expect(html).not.toMatch(/\sstyle=/i);                   // no style attributes (the CSP forbids them)
    // every URL the page can fetch is on this site and is on this short list
    const urls = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map(m => m[1]);
    const urlFns = [...html.matchAll(/url\(([^)]*)\)/g)].map(m => m[1]);
    for (const u of [...urls, ...urlFns]) {
      expect(['/', '/favicon.svg', '/logo.svg', '/fonts/bricolage-latin.woff2', '/fonts/geist-latin.woff2']).toContain(u);
    }
    expect(html).not.toMatch(/\/assets\//);                   // not the app bundle
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it('allows only its own inline style and script, by hash, and nothing else', async () => {
    const { page } = await pageFor({});
    const html = page.text;
    const csp = page.headers.get('content-security-policy');
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
    const hash = text => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
    expect(csp).toContain(`style-src ${hash(style)}`);
    expect(csp).toContain(`script-src ${hash(script)}`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
    expect(script).not.toMatch(/fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|document\.cookie|location\.|import\(/);
  });

  it('shows who it is from, that revoked links stop working, and that it is not a clinician', async () => {
    const { page } = await pageFor({});
    expect(page.text).toContain('Shared by the person who made this link');
    expect(page.text).toMatch(/revoked links stop working/);
    expect(page.text).toMatch(/not a clinician/);
    const visible = page.text.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    expect(visible).not.toMatch(/\b(cures?|heals?|treats|treatment for|clinically proven|therapy works|prevents?|100%)/i); // no medical or outcome claims
    expect(visible).not.toMatch(/no cloud|nothing leaves|zero network|100% private/i); // the retired privacy wording
  });

  it('is printable: an A4 print stylesheet and a Print or save as PDF button wired in the page script', async () => {
    const { page } = await pageFor({});
    expect(page.text).toContain('@page { size: A4');
    expect(page.text).toContain('@media print');
    expect(page.text).toContain('Print or save as PDF');
    expect(page.text).toContain('window.print()');
  });

  it('has no dates when detailed is off, and dates and a time-of-day chart when it is on', async () => {
    const narrow = await pageFor({ detailed: false });
    expect(narrow.page.text).not.toMatch(/\d{4}-\d{2}-\d{2}|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/);
    expect(narrow.page.text).not.toContain('Time of day');
    expect(narrow.page.text).toContain('chose not to include dates');

    const wide = await pageFor({ detailed: true, timezone: 'UTC' });
    expect(wide.page.text).toContain('21 Oct 2026');
    expect(wide.page.text).toContain('Time of day');
    expect(wide.page.text).toContain('chose to include calendar dates');
  });

  it('draws the charts as inline SVG with a text alternative', async () => {
    const { page } = await pageFor({ detailed: true });
    expect(page.text.match(/<svg class="chart"/g).length).toBe(3);
    expect(page.text).toMatch(/role="img" aria-label="Bar chart, bites per day/);
  });

  it('escapes anything it prints (the summary only ever holds numbers and fixed words, but still)', async () => {
    const { page } = await pageFor({ label: '<img src=x onerror=alert(1)><script>alert(1)</script>' });
    expect(page.text).not.toContain('alert(1)');
    expect(page.text).not.toContain('onerror');
  });
});

// ── The public routes never reach the users table ────────────────────────────

describe('the public routes and the users table', () => {
  it('run no SQL that mentions users or email, and touch only share_links and habit_events', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', { detailed: true })).body;
    h.sql.length = 0;
    await h.page(l.token); await h.data(l.token); await h.page('Zk3J9bQe7mV1xP0aLwT5uYhR8cN2dFgS4iOvEtXqH6M'); await h.data('short');
    const runtime = [...h.sql];
    expect(runtime.length).toBeGreaterThan(0);
    // every statement the share module prepared when it registered, plus every one it ran per request
    const statements = [...h.bootSql, ...runtime].filter(q => !/^\s*(CREATE|PRAGMA|INSERT OR REPLACE INTO users)/i.test(q) && !/schema_migrations|sqlite_master|sqlite_sequence/.test(q));
    for (const q of statements) expect(q, q).not.toMatch(/\busers\b|\bemail\b|\bname\b|\bavatar\b/i);
    const tables = new Set(statements.flatMap(q => [...q.matchAll(/\b(?:FROM|UPDATE|INTO|JOIN)\s+(\w+)/gi)].map(m => m[1].toLowerCase())));
    tables.delete('set'); // "ON CONFLICT ... DO UPDATE SET"
    expect([...tables].sort()).toEqual(['habit_event_epochs', 'habit_events', 'share_links']);
  });

  it('still work when the users table is gone', async () => {
    const h = await boot();
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    h.db.exec('ALTER TABLE users RENAME TO users_moved');
    expect((await h.page(l.token)).status).toBe(200);
    expect((await h.data(l.token)).status).toBe(200);
  });
});

// ── Rate limits ──────────────────────────────────────────────────────────────

describe('rate limits on the public routes', () => {
  it('limit every public request per caller, with a plain 429 that carries no data', async () => {
    const h = await boot({ module: { publicRateLimit: { limit: 4, windowMs: 60_000 } } });
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    for (let i = 0; i < 4; i++) expect((await h.data(l.token)).status).toBe(200);
    const blocked = await h.data(l.token);
    expect(blocked.status).toBe(429);
    expect(blocked.json).toEqual({ error: 'too_many_requests' });
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(blocked.headers.get('cache-control')).toBe('no-store');
    const page = await h.page(l.token);
    expect(page.status).toBe(429);
    expect(page.text).not.toMatch(LEAKS);
    expect(page.text).toContain('Please try again');
  });

  it('count misses separately: a few wrong tokens block the caller, a hundred valid views do not', async () => {
    const h = await boot({ module: { missRateLimit: { limit: 3, windowMs: 60_000 }, publicRateLimit: { limit: 1000, windowMs: 60_000 } } });
    seedRich(h);
    const l = (await h.create('u1', {})).body;
    for (let i = 0; i < 40; i++) expect((await h.data(l.token)).status).toBe(200);   // reading is not a miss
    for (let i = 0; i < 3; i++) expect((await h.data(`${'a'.repeat(42)}${i}`)).status).toBe(404);
    expect((await h.data(l.token)).status).toBe(429);                                  // the 4th attempt after 3 misses
    expect((await h.page(l.token)).status).toBe(429);
  });

  it('do not apply to the owner API', async () => {
    const h = await boot({ module: { publicRateLimit: { limit: 1, windowMs: 60_000 } } });
    for (let i = 0; i < 5; i++) expect((await h.list('u1')).status).toBe(200);
  });
});

describe('the owner API is rate limited per user', () => {
  it('429s one user without affecting another', async () => {
    const h = await boot({ module: { ownerRateLimit: { limit: 3, windowMs: 60_000 } } });
    for (let i = 0; i < 3; i++) expect((await h.list('u1')).status).toBe(200);
    expect((await h.list('u1')).status).toBe(429);
    expect((await h.list('u2')).status).toBe(200);
  });
});

describe('parseCreateRequest', () => {
  it('is pure and total', () => {
    expect(parseCreateRequest(undefined)).toEqual({ ok: true, value: { label: '', expiresInDays: 30, detailed: false, timezone: 'UTC' } });
    expect(parseCreateRequest(null).ok).toBe(true);
    for (const junk of [5, 'x', true, [], [1]]) expect(parseCreateRequest(junk).ok).toBe(false);
  });
});
