import { describe, it, expect } from 'vitest';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { runMigrations } from '../db/migrate.js';
import { AUTH_MIGRATIONS } from './schema.js';
import {
  MAGIC_LINK_TTL_MS, PER_EMAIL_MAX, PER_EMAIL_MIN_GAP_MS, PER_EMAIL_WINDOW_MS, createMagicLinkStore, hashToken,
} from './magicLink.js';
import { buildMagicLinkEmail, magicLinkUrl } from './magicLinkEmail.js';

function setup() {
  const db = createMemoryDb({ users: true });
  runMigrations(db, AUTH_MIGRATIONS);
  const clock = { t: 1_800_000_000_000 };
  const store = createMagicLinkStore(db, { now: () => clock.t });
  return { db, clock, store };
}

describe('magic link tokens', () => {
  it('issues a 32-byte random token and stores only its SHA-256', () => {
    const { db, store } = setup();
    const { token } = store.issue({ email: 'a@x.com', ip: '203.0.113.9' });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
    const rows = db.prepare('SELECT * FROM magic_link_tokens').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(hashToken(token));
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(token); // the raw token is nowhere in the database
    expect(rows[0]).toMatchObject({ email: 'a@x.com', created_ip: '203.0.113.9', used_at: null });
  });

  it('two tokens are never the same', () => {
    const { store } = setup();
    expect(store.issue({ email: 'a@x.com' }).token).not.toBe(store.issue({ email: 'b@x.com' }).token);
  });

  it('a valid token works once and returns the address', () => {
    const { store } = setup();
    const { token } = store.issue({ email: 'a@x.com' });
    expect(store.consume(token)).toEqual({ ok: true, email: 'a@x.com' });
  });

  it('single use: the second attempt is "used"', () => {
    const { store } = setup();
    const { token } = store.issue({ email: 'a@x.com' });
    store.consume(token);
    expect(store.consume(token)).toEqual({ ok: false, reason: 'used' });
  });

  it('is still valid one millisecond before the 15 minute mark', () => {
    const { store, clock } = setup();
    expect(MAGIC_LINK_TTL_MS).toBe(15 * 60 * 1000);
    const { token } = store.issue({ email: 'a@x.com' });
    clock.t += MAGIC_LINK_TTL_MS - 1;
    expect(store.consume(token).ok).toBe(true);
  });

  it('an unused token past its expiry is "expired", and stays unusable', () => {
    const { store, clock } = setup();
    const { token } = store.issue({ email: 'a@x.com' });
    clock.t += MAGIC_LINK_TTL_MS; // exactly at expiry is already expired
    expect(store.consume(token)).toEqual({ ok: false, reason: 'expired' });
    expect(store.consume(token)).toEqual({ ok: false, reason: 'expired' });
  });

  it('a wrong token is "invalid" and does not disturb the real one', () => {
    const { store } = setup();
    const { token } = store.issue({ email: 'a@x.com' });
    const wrong = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
    expect(store.consume(wrong)).toEqual({ ok: false, reason: 'invalid' });
    expect(store.consume(token).ok).toBe(true);
  });

  it.each([[undefined], [null], [42], [''], ['short'], ['x'.repeat(43) + '!'], ['x'.repeat(44)], [{}], [['a']]])(
    'malformed input %j is "invalid"', raw => {
      const { store } = setup();
      expect(store.consume(raw)).toEqual({ ok: false, reason: 'invalid' });
    },
  );

  it('a token cannot be used with a different address: the address comes from the row, not the caller', () => {
    const { store } = setup();
    const { token } = store.issue({ email: 'victim@x.com' });
    expect(store.consume(token)).toEqual({ ok: true, email: 'victim@x.com' });
  });

  it('two simultaneous spends: exactly one wins (atomic claim)', () => {
    const { db, store } = setup();
    const { token } = store.issue({ email: 'a@x.com' });
    // Simulate losing the race: another connection claims the row between our SELECT and UPDATE.
    db.prepare('UPDATE magic_link_tokens SET used_at = 1').run();
    expect(store.consume(token)).toEqual({ ok: false, reason: 'used' });
  });

  it('old rows are purged on the next issue', () => {
    const { db, store, clock } = setup();
    store.issue({ email: 'a@x.com' });
    clock.t += 3 * 24 * 60 * 60 * 1000;
    store.issue({ email: 'b@x.com' });
    expect(db.prepare('SELECT email FROM magic_link_tokens').all().map(r => r.email)).toEqual(['b@x.com']);
  });
});

describe('per-address rate limit', () => {
  it('allows the first link, then makes the person wait the minimum gap', () => {
    const { store, clock } = setup();
    expect(store.checkEmailAllowance('a@x.com')).toEqual({ allowed: true });
    store.issue({ email: 'a@x.com' });
    expect(store.checkEmailAllowance('a@x.com')).toEqual({ allowed: false, reason: 'too_soon' });
    clock.t += PER_EMAIL_MIN_GAP_MS;
    expect(store.checkEmailAllowance('a@x.com')).toEqual({ allowed: true });
  });

  it(`stops after ${PER_EMAIL_MAX} links in an hour, then recovers`, () => {
    const { store, clock } = setup();
    for (let i = 0; i < PER_EMAIL_MAX; i++) {
      expect(store.checkEmailAllowance('a@x.com').allowed).toBe(true);
      store.issue({ email: 'a@x.com' });
      clock.t += PER_EMAIL_MIN_GAP_MS;
    }
    expect(store.checkEmailAllowance('a@x.com')).toEqual({ allowed: false, reason: 'too_many' });
    clock.t += PER_EMAIL_WINDOW_MS; // the oldest links leave the window
    expect(store.checkEmailAllowance('a@x.com')).toEqual({ allowed: true });
  });

  it('one address being limited does not affect another', () => {
    const { store } = setup();
    store.issue({ email: 'a@x.com' });
    expect(store.checkEmailAllowance('b@x.com')).toEqual({ allowed: true });
  });
});

describe('the sign-in email', () => {
  it('puts the token in the URL fragment, never the query string', () => {
    const url = magicLinkUrl('https://stopbiting.today/', 'TOKEN123');
    expect(url).toBe('https://stopbiting.today/signin#t=TOKEN123');
    expect(url).not.toContain('?');
  });

  it('has a subject, html and plain text that both carry the link and say it expires', () => {
    const mail = buildMagicLinkEmail({ appUrl: 'https://stopbiting.today', token: 'TOKEN123' });
    expect(mail.subject).toMatch(/sign-in link/i);
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('https://stopbiting.today/signin#t=TOKEN123');
      expect(body).toMatch(/15 minutes/);
    }
  });

  it('makes no privacy overclaims (house rule)', () => {
    const { html, text } = buildMagicLinkEmail({ appUrl: 'https://stopbiting.today', token: 'T' });
    expect(`${html} ${text}`).not.toMatch(/100% private|no cloud|zero network|nothing leaves/i);
  });
});
