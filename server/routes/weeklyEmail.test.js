import { describe, it, expect, afterEach, vi } from 'vitest';
import { makeWeeklyEmailHarness, TEST_APP_URL } from '../../test-utils/weeklyEmailHarness.js';
import { ROUTE_MODULES } from './index.js';
import weeklyEmailModule, { createWeeklyEmailModule } from './weeklyEmail.js';
import { HOUR, startWeeklyEmailJob } from '../jobs/weeklyEmail.js';
import { signUnsubscribeToken, newUnsubscribeSecret } from '../weeklyEmail/token.js';

let open = [];
async function boot(opts) {
  const h = await makeWeeklyEmailHarness(opts);
  open.push(h);
  return h;
}
afterEach(async () => {
  await Promise.all(open.map(h => h.close()));
  open = [];
  vi.restoreAllMocks();
});

const form = { 'content-type': 'application/x-www-form-urlencoded' };

describe('registration', () => {
  it('is in the route registry, once, and is the default export', () => {
    expect(ROUTE_MODULES.filter(m => m.name === 'weeklyEmail')).toHaveLength(1);
    expect(ROUTE_MODULES).toContain(weeklyEmailModule);
  });

  it('creates its table, once', async () => {
    const h = await boot();
    const cols = h.db.prepare('PRAGMA table_info(email_preferences)').all().map(c => c.name);
    expect(cols).toEqual(['user_id', 'weekly_summary', 'timezone', 'unsubscribe_secret', 'last_sent_week', 'opted_in_at', 'updated_at']);
    const { runMigrations } = await import('../db/migrate.js');
    const { WEEKLY_EMAIL_MIGRATIONS } = await import('../weeklyEmail/prefs.js');
    expect(runMigrations(h.db, WEEKLY_EMAIL_MIGRATIONS)).toEqual([]);
  });

  it('the preferences default to OFF', async () => {
    const h = await boot();
    h.addUser('u1');
    h.prefs.ensure('u1');
    expect(h.prefs.get('u1').weekly_summary).toBe(0);
  });
});

describe('flag and sign-in', () => {
  it('with weekly_email off, the opt-in paths are plain 404s for everyone', async () => {
    const h = await boot({ flags: '' });
    h.addUser('u1');
    for (const user of [undefined, 'u1']) {
      expect((await h.call('GET', '/api/email/weekly', { user })).status).toBe(404);
      expect((await h.call('PUT', '/api/email/weekly', { user, body: { enabled: true } })).status).toBe(404);
    }
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM email_preferences').get().n).toBe(0);
  });

  it('with the flag on, they need a signed-in user', async () => {
    const h = await boot();
    expect((await h.call('GET', '/api/email/weekly')).status).toBe(401);
    expect((await h.call('PUT', '/api/email/weekly', { body: { enabled: true } })).status).toBe(401);
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM email_preferences').get().n).toBe(0);
  });
});

describe('GET /api/email/weekly', () => {
  it('a new person: off, no zone, nothing synced, has an address, nothing sent', async () => {
    const h = await boot();
    h.addUser('u1');
    const r = await h.state('u1');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enabled: false, timezone: null, hasSyncedData: false, hasEmail: true, lastSentWeek: null });
    // Looking does not create a row.
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM email_preferences').get().n).toBe(0);
  });

  it('says whether there is synced history, whether the account has an address, and is never cached', async () => {
    const h = await boot();
    h.addUser('u1');
    h.seedEvent('u1');
    h.addUser('u2', '');
    expect((await h.state('u1')).body.hasSyncedData).toBe(true);
    expect((await h.state('u2')).body).toMatchObject({ hasSyncedData: false, hasEmail: false });
    expect((await h.call('GET', '/api/email/weekly', { user: 'u1' })).headers.get('cache-control')).toBe('no-store');
  });

  it('does not return the email address or the secret', async () => {
    const h = await boot();
    h.addUser('u1', 'private.person@example.com');
    await h.put('u1', { enabled: true });
    const text = await (await h.call('GET', '/api/email/weekly', { user: 'u1' })).text();
    expect(text).not.toContain('private.person');
    expect(text).not.toContain(h.prefs.get('u1').unsubscribe_secret);
  });
});

describe('PUT /api/email/weekly', () => {
  it('switches on with the browser\'s time zone, then off, and remembers the zone', async () => {
    const h = await boot();
    h.addUser('u1');
    const on = await h.put('u1', { enabled: true, timezone: 'Europe/Belgrade' });
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ enabled: true, timezone: 'Europe/Belgrade' });
    const row = h.prefs.get('u1');
    expect(row).toMatchObject({ weekly_summary: 1, timezone: 'Europe/Belgrade', last_sent_week: null });
    expect(row.opted_in_at).toBeGreaterThan(0);
    expect(row.unsubscribe_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const off = await h.put('u1', { enabled: false });
    expect(off.body).toMatchObject({ enabled: false, timezone: 'Europe/Belgrade' });
    expect(h.prefs.get('u1')).toMatchObject({ weekly_summary: 0, timezone: 'Europe/Belgrade', unsubscribe_secret: row.unsubscribe_secret });
  });

  it('is repeatable: switching on twice keeps the first opt-in time, off then on restarts it', async () => {
    let t = 1_000;
    const h = await boot({ module: { now: () => t } });
    h.addUser('u1');
    await h.put('u1', { enabled: true });
    t = 5_000;
    await h.put('u1', { enabled: true });
    expect(h.prefs.get('u1').opted_in_at).toBe(1_000);
    await h.put('u1', { enabled: false });
    t = 9_000;
    await h.put('u1', { enabled: true });
    expect(h.prefs.get('u1').opted_in_at).toBe(9_000);
  });

  it('a later change of zone is kept when the zone is sent, and left alone when it is not', async () => {
    const h = await boot();
    h.addUser('u1');
    await h.put('u1', { enabled: true, timezone: 'Asia/Tokyo' });
    await h.put('u1', { enabled: true });
    expect(h.prefs.get('u1').timezone).toBe('Asia/Tokyo');
    await h.put('u1', { enabled: true, timezone: 'America/Chicago' });
    expect(h.prefs.get('u1').timezone).toBe('America/Chicago');
  });

  it('rejects a body that is not exactly { enabled, timezone? }', async () => {
    const h = await boot();
    h.addUser('u1');
    const bad = [
      [{}, 'enabled'],
      [{ enabled: 'yes' }, 'enabled'],
      [{ enabled: 1 }, 'enabled'],
      [{ enabled: null }, 'enabled'],
      [{ enabled: true, timezone: 'Not/AZone' }, 'timezone'],
      [{ enabled: true, timezone: 5 }, 'timezone'],
      [{ enabled: true, timezone: '' }, 'timezone'],
      [{ enabled: true, timezone: 'x'.repeat(200) }, 'timezone'],
      // an address can never be supplied by the client
      [{ enabled: true, email: 'someone.else@example.com' }, 'email'],
      [{ enabled: true, to: 'someone.else@example.com' }, 'to'],
      [{ enabled: true, userId: 'u2' }, 'userId'],
      [{ enabled: true, weekly_summary: 1 }, 'weekly_summary'],
    ];
    for (const [body, field] of bad) {
      const r = await h.put('u1', body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body).toEqual({ error: 'invalid_request', field });
    }
    for (const raw of ['[]', '"on"', 'null', '5']) {
      const res = await h.call('PUT', '/api/email/weekly', { user: 'u1', raw, headers: { 'content-type': 'application/json' } });
      expect(res.status, raw).toBe(400);
    }
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM email_preferences').get().n).toBe(0);
  });

  it('refuses to switch on for an account with no email address, but lets it switch off', async () => {
    const h = await boot();
    h.addUser('noemail', '');
    h.addUser('nullemail', null);
    for (const id of ['noemail', 'nullemail']) {
      const r = await h.put(id, { enabled: true });
      expect(r).toMatchObject({ status: 400, body: { error: 'no_email' } });
      expect(h.prefs.get(id)).toBeNull();
    }
    expect((await h.put('noemail', { enabled: false })).status).toBe(200);
  });

  it('an unknown account (signed in but no user row) cannot switch on', async () => {
    const h = await boot();
    expect((await h.put('ghost', { enabled: true })).body).toEqual({ error: 'no_email' });
  });

  it('people are independent of each other', async () => {
    const h = await boot();
    h.addUser('a');
    h.addUser('b');
    await h.put('a', { enabled: true, timezone: 'UTC' });
    expect((await h.state('b')).body.enabled).toBe(false);
    await h.put('b', { enabled: true });
    await h.put('a', { enabled: false });
    expect((await h.state('b')).body.enabled).toBe(true);
    expect(h.prefs.get('a').unsubscribe_secret).not.toBe(h.prefs.get('b').unsubscribe_secret);
  });

  it('is rate limited per account', async () => {
    const h = await boot({ module: { manageRateLimit: { limit: 3 } } });
    h.addUser('a');
    h.addUser('b');
    for (let i = 0; i < 3; i++) expect((await h.state('a')).status).toBe(200);
    expect((await h.state('a')).status).toBe(429);
    expect((await h.state('b')).status).toBe(200); // another person is not affected
  });
});

describe('unsubscribe page and one-click', () => {
  async function optedIn(h, id = 'u1') {
    h.addUser(id);
    await h.put(id, { enabled: true, timezone: 'Europe/Belgrade' });
    return `/api/email/unsubscribe/${h.tokenFor(id)}`;
  }

  it('GET asks first and changes nothing; the page is private and not indexable', async () => {
    const h = await boot();
    const path = await optedIn(h);
    const before = h.prefs.get('u1');
    const res = await h.call('GET', path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const html = await res.text();
    expect(html).toContain('<form method="post" action="' + path + '">');
    expect(html).toContain('noindex');
    expect(h.prefs.get('u1')).toEqual(before); // untouched, byte for byte
    await h.call('GET', path); // a mail scanner opening it twice changes nothing either
    expect(h.prefs.get('u1')).toEqual(before);
    expect((await h.state('u1')).body.enabled).toBe(true);
  });

  it('POST switches off, shows a confirmation, and touches nothing else', async () => {
    const h = await boot();
    const path = await optedIn(h);
    h.prefs.claimWeek('u1', '2026-W40');
    const before = h.prefs.get('u1');
    const res = await h.call('POST', path, { headers: form, raw: '' });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('You are unsubscribed');
    const after = h.prefs.get('u1');
    expect(after.weekly_summary).toBe(0);
    expect({ ...after, weekly_summary: 1, updated_at: 0 }).toEqual({ ...before, updated_at: 0 });
    expect((await h.state('u1')).body.enabled).toBe(false);
  });

  it('works as RFC 8058 one-click: form body, no cookie, no Origin, no sign-in', async () => {
    const h = await boot();
    const path = await optedIn(h);
    const res = await fetch(`${h.url}${path}`, { method: 'POST', headers: form, body: 'List-Unsubscribe=One-Click' });
    expect(res.status).toBe(200);
    expect(h.prefs.get('u1').weekly_summary).toBe(0);
  });

  it('is safe to repeat', async () => {
    const h = await boot();
    const path = await optedIn(h);
    for (let i = 0; i < 3; i++) expect((await h.call('POST', path, { headers: form, raw: 'List-Unsubscribe=One-Click' })).status).toBe(200);
    expect(h.prefs.get('u1').weekly_summary).toBe(0);
  });

  it('answers JSON to a client that asks for it', async () => {
    const h = await boot();
    const path = await optedIn(h);
    const res = await h.call('POST', path, { headers: { accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await h.call('POST', '/api/email/unsubscribe/nope', { headers: { accept: 'application/json' } })).status).toBe(404);
  });

  it('only switches off the person the token names', async () => {
    const h = await boot();
    const pathA = await optedIn(h, 'a');
    await optedIn(h, 'b');
    await h.call('POST', pathA, { headers: form, raw: '' });
    expect(h.prefs.get('a').weekly_summary).toBe(0);
    expect(h.prefs.get('b').weekly_summary).toBe(1);
  });

  it('works with the flag OFF and without signing in (a dead link would be a compliance problem)', async () => {
    const h = await boot({ flags: '' });
    h.addUser('u1');
    h.prefs.setEnabled('u1', true, 'UTC');
    const path = `/api/email/unsubscribe/${h.tokenFor('u1')}`;
    expect((await h.call('GET', path)).status).toBe(200);
    expect((await h.call('POST', path, { headers: form, raw: '' })).status).toBe(200);
    expect(h.prefs.get('u1').weekly_summary).toBe(0);
    // ...while the opt-in endpoints stay dark.
    expect((await h.call('GET', '/api/email/weekly', { user: 'u1' })).status).toBe(404);
  });

  it('a forged, damaged, truncated or unknown link is the same neutral 404, for GET and POST', async () => {
    const h = await boot();
    const path = await optedIn(h, 'u1');
    const good = path.split('/').pop();
    const [id, mac] = good.split('.');
    const otherSecret = newUnsubscribeSecret();
    const links = [
      `${id}.${mac.slice(0, -2)}AA`, // tampered MAC
      good.slice(0, -5), // truncated
      id, // no MAC
      signUnsubscribeToken('u1', otherSecret), // right person, wrong secret
      signUnsubscribeToken('nobody', otherSecret), // a person who has no row
      `${Buffer.from('nobody').toString('base64url')}.${mac}`, // someone else's MAC on an unknown person
      'x', 'a.b', '....', '%00', 'A'.repeat(300),
    ];
    const reference = await (await h.call('GET', `/api/email/unsubscribe/${links[0]}`)).text();
    for (const l of links) {
      const g = await h.call('GET', `/api/email/unsubscribe/${encodeURIComponent(l)}`);
      expect(g.status, l).toBe(404);
      expect(await g.text(), l).toBe(reference); // unknown and forged are indistinguishable
      const p = await h.call('POST', `/api/email/unsubscribe/${encodeURIComponent(l)}`, { headers: form, raw: 'List-Unsubscribe=One-Click' });
      expect(p.status, l).toBe(404);
      expect(await p.text(), l).toBe(reference);
    }
    expect(h.prefs.get('u1').weekly_summary).toBe(1); // nothing was switched off by any of them
    expect(reference).toContain('does not work');
    expect(reference).not.toContain('u1');
  });

  it('a token made before the secret was rotated stops working', async () => {
    const h = await boot();
    const path = await optedIn(h);
    expect((await h.call('GET', path)).status).toBe(200);
    h.db.prepare('UPDATE email_preferences SET unsubscribe_secret = ? WHERE user_id = ?').run(newUnsubscribeSecret(), 'u1');
    expect((await h.call('GET', path)).status).toBe(404);
  });

  it('is rate limited per address', async () => {
    const h = await boot({ module: { unsubscribeRateLimit: { limit: 3 } } });
    const path = await optedIn(h);
    for (let i = 0; i < 3; i++) expect((await h.call('GET', path)).status).toBe(200);
    expect((await h.call('GET', path)).status).toBe(429);
  });

  it('the page it shows after unsubscribing links back to the app address', async () => {
    const h = await boot();
    const path = await optedIn(h);
    const html = await (await h.call('POST', path, { headers: form, raw: '' })).text();
    expect(html).toContain(`href="${TEST_APP_URL}"`);
  });
});

describe('the hourly job is started only when it should be', () => {
  // The rate limiters also use setInterval (for their own housekeeping), so look for the hourly one.
  const hourly = spy => spy.mock.calls.filter(c => c[1] === HOUR);

  it('flag on, provider configured: started once with the database, the sender and the site address', async () => {
    const h = await boot({ module: { env: { RESEND_API_KEY: 're_test' } } });
    expect(h.startJobCalls).toHaveLength(1);
    const arg = h.startJobCalls[0][0];
    expect(arg.db).toBe(h.db);
    expect(typeof arg.send).toBe('function');
    expect(arg.appUrl).toBe(TEST_APP_URL);
    expect(arg.env.RESEND_API_KEY).toBe('re_test');
  });

  it('flag off: never started, even with a provider configured', async () => {
    const h = await boot({ flags: 'event_sync,insights', module: { env: { RESEND_API_KEY: 're_test' } } });
    expect(h.startJobCalls).toHaveLength(0);
  });

  it("the desktop app's embedded server (ELECTRON_PROTOCOL) never sends mail", async () => {
    const h = await boot({ config: { ELECTRON_PROTOCOL: 'stopbiting' }, module: { env: { RESEND_API_KEY: 're_test' } } });
    expect(h.startJobCalls).toHaveLength(0);
  });

  it('with the real starter: flag off starts no timer', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    const h = await boot({ flags: '', module: { env: { RESEND_API_KEY: 're_test' }, startJob: startWeeklyEmailJob } });
    expect(h.startJobCalls).toHaveLength(0);
    expect(hourly(spy)).toHaveLength(0);
  });

  it('with the real starter: no RESEND_API_KEY starts no timer', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await boot({ flags: 'weekly_email,event_sync,insights', module: { env: {}, startJob: startWeeklyEmailJob } });
    expect(hourly(spy)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith('[weekly-email] RESEND_API_KEY not set, job disabled');
  });

  it('with the real starter: flag on and a provider starts one hourly timer, which does not keep the process alive', async () => {
    const real = globalThis.setInterval;
    const timers = [];
    const spy = vi.spyOn(globalThis, 'setInterval').mockImplementation((...a) => {
      const t = real(...a);
      if (a[1] === HOUR) timers.push(t);
      return t;
    });
    try {
      await boot({ flags: 'weekly_email,event_sync,insights', module: { env: { RESEND_API_KEY: 're_test' }, startJob: startWeeklyEmailJob } });
      expect(hourly(spy)).toHaveLength(1);
      expect(timers).toHaveLength(1);
      expect(timers[0].hasRef()).toBe(false);
    } finally {
      for (const t of timers) clearInterval(t);
    }
  });
});

describe('createWeeklyEmailModule', () => {
  it('has a name and migrations the registry can run', () => {
    const m = createWeeklyEmailModule();
    expect(m.name).toBe('weeklyEmail');
    expect(m.migrations.map(s => s.id)).toEqual(['ws5_001_email_preferences']);
    expect(typeof m.register).toBe('function');
  });
});
