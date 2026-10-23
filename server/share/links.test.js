import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { runMigrations } from '../db/migrate.js';
import { STALE_RETENTION_MS, SHARE_MIGRATIONS, VIEW_TOUCH_INTERVAL_MS, createShareStore } from './links.js';
import { generateToken, hashToken } from './tokens.js';

const DAY = 86400000;

let db;
let t;
let store;
const clock = () => t;

function make(userId, over = {}) {
  const token = generateToken();
  const r = store.create({
    userId, tokenHash: hashToken(token), detailed: false, label: '', expiresAt: null, timezone: 'UTC', maxActive: 5, ...over,
  });
  return { token, ...r };
}

beforeEach(() => {
  db = createMemoryDb();
  runMigrations(db, SHARE_MIGRATIONS);
  t = 1_800_000_000_000;
  store = createShareStore(db, { now: clock });
});

describe('the table', () => {
  it('is additive and can be migrated twice', () => {
    expect(() => runMigrations(db, SHARE_MIGRATIONS)).not.toThrow();
    const cols = db.prepare('PRAGMA table_info(share_links)').all().map(c => c.name);
    expect(cols).toEqual(['id', 'user_id', 'token_hash', 'scope', 'label', 'created_at', 'expires_at', 'revoked_at', 'last_viewed_at', 'timezone']);
  });

  it('never stores a token: only its hash, and a token cannot be found in any column', () => {
    const { token } = make('u1', { label: 'for my therapist' });
    const rows = db.prepare('SELECT * FROM share_links').all();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].token_hash).toBe(hashToken(token));
  });

  it('does not allow two links with the same hash', () => {
    const h = hashToken('same');
    make('u1', { tokenHash: h });
    expect(() => make('u1', { tokenHash: h })).toThrow();
  });
});

describe('creating and listing', () => {
  it('lists active links newest first, without tokens, hashes or user ids', () => {
    make('u1', { label: 'first' });
    t += 1000;
    make('u1', { label: 'second', detailed: true, expiresAt: t + DAY });
    const list = store.listActive('u1');
    expect(list.map(l => l.label)).toEqual(['second', 'first']);
    expect(Object.keys(list[0]).sort()).toEqual(['createdAt', 'detailed', 'expiresAt', 'id', 'label', 'lastViewedAt']);
    expect(list[0].detailed).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/token|hash|u1/);
  });

  it('keeps one owner away from another owner\'s links', () => {
    make('u1');
    make('u2');
    expect(store.listActive('u1')).toHaveLength(1);
    expect(store.listActive('u2')).toHaveLength(1);
    expect(store.listActive('nobody')).toEqual([]);
  });

  it('stops at the maximum number of active links', () => {
    for (let i = 0; i < 3; i++) expect(make('u1', { maxActive: 3 }).ok).toBe(true);
    expect(make('u1', { maxActive: 3 })).toMatchObject({ ok: false, code: 'too_many_links', limit: 3 });
    expect(make('u2', { maxActive: 3 }).ok).toBe(true); // per user
  });

  it('does not count revoked or expired links against the maximum', () => {
    const a = make('u1', { maxActive: 2 });
    make('u1', { maxActive: 2, expiresAt: t + DAY });
    expect(make('u1', { maxActive: 2 }).ok).toBe(false);
    store.revoke('u1', a.link.id);
    expect(make('u1', { maxActive: 2 }).ok).toBe(true);
    expect(make('u1', { maxActive: 2 }).ok).toBe(false);
    t += 2 * DAY; // the expiring one lapses
    expect(make('u1', { maxActive: 2 }).ok).toBe(true);
  });

  it('cannot exceed the maximum when two creates race (the check and the insert are one transaction)', () => {
    const results = Array.from({ length: 10 }, () => make('u1', { maxActive: 4 }).ok);
    expect(results.filter(Boolean)).toHaveLength(4);
  });
});

describe('the public lookup', () => {
  it('finds an active link by the hash of its token', () => {
    const { token, link } = make('u1', { detailed: true, timezone: 'Europe/Belgrade' });
    expect(store.findActiveByHash(hashToken(token))).toEqual({
      id: link.id, userId: 'u1', detailed: true, timezone: 'Europe/Belgrade', lastViewedAt: null,
    });
  });

  it('answers null, the same null, for unknown, revoked and expired links', () => {
    const live = make('u1');
    const revoked = make('u1');
    const expiring = make('u1', { expiresAt: t + DAY });
    store.revoke('u1', revoked.link.id);
    t += 2 * DAY;
    expect(store.findActiveByHash(hashToken(live.token))).not.toBeNull();
    expect(store.findActiveByHash(hashToken(revoked.token))).toBeNull();
    expect(store.findActiveByHash(hashToken(expiring.token))).toBeNull();
    expect(store.findActiveByHash(hashToken('never issued'))).toBeNull();
  });

  it('expires at the exact millisecond (expires_at is exclusive)', () => {
    const { token } = make('u1', { expiresAt: t + 1000 });
    t += 999;
    expect(store.findActiveByHash(hashToken(token))).not.toBeNull();
    t += 1;
    expect(store.findActiveByHash(hashToken(token))).toBeNull();
  });

  it('reads an unreadable scope as the narrowest one (never detailed)', () => {
    const { token, link } = make('u1', { detailed: true });
    db.prepare('UPDATE share_links SET scope = ? WHERE id = ?').run('{not json', link.id);
    expect(store.findActiveByHash(hashToken(token)).detailed).toBe(false);
    db.prepare('UPDATE share_links SET scope = ? WHERE id = ?').run('{"detailed":"true"}', link.id);
    expect(store.findActiveByHash(hashToken(token)).detailed).toBe(false);
  });
});

describe('revoking', () => {
  it('works once, for the owner only', () => {
    const { token, link } = make('u1');
    expect(store.revoke('u2', link.id)).toBe(false);          // someone else's
    expect(store.findActiveByHash(hashToken(token))).not.toBeNull();
    expect(store.revoke('u1', link.id)).toBe(true);
    expect(store.findActiveByHash(hashToken(token))).toBeNull(); // immediately
    expect(store.revoke('u1', link.id)).toBe(false);          // already revoked
    expect(store.revoke('u1', 'no-such-id')).toBe(false);
    expect(store.listActive('u1')).toEqual([]);
  });

  it('cannot be undone by revoking again or by an id that is a hash or token', () => {
    const { token } = make('u1');
    expect(store.revoke('u1', token)).toBe(false);
    expect(store.revoke('u1', hashToken(token))).toBe(false);
  });
});

describe('last viewed', () => {
  it('is written on a view and then at most once a minute', () => {
    const { token, link } = make('u1');
    const id = link.id;
    store.touchViewed(id);
    const first = t;
    expect(store.findActiveByHash(hashToken(token)).lastViewedAt).toBe(first);
    t += VIEW_TOUCH_INTERVAL_MS - 1;
    store.touchViewed(id);
    expect(store.findActiveByHash(hashToken(token)).lastViewedAt).toBe(first);
    t += 1;
    store.touchViewed(id);
    expect(store.findActiveByHash(hashToken(token)).lastViewedAt).toBe(t);
  });
});

describe('retention', () => {
  it('deletes links revoked or expired more than 30 days ago, and nothing else', () => {
    const live = make('u1');
    const old = make('u1');
    const recent = make('u1');
    const expired = make('u1', { expiresAt: t + DAY });
    store.revoke('u1', old.link.id);
    t += STALE_RETENTION_MS / 2;
    store.revoke('u1', recent.link.id);
    t += STALE_RETENTION_MS / 2 + 2 * DAY;
    expect(store.purgeStale()).toBe(2); // `old` (revoked 30+ days ago) and `expired`
    const left = db.prepare('SELECT id FROM share_links').all().map(r => r.id).sort();
    expect(left).toEqual([live.link.id, recent.link.id].sort());
    expect(expired.ok).toBe(true);
  });

  it('removes every link of a user', () => {
    make('u1'); make('u1'); make('u2');
    expect(store.removeAllForUser('u1')).toBe(2);
    expect(db.prepare('SELECT COUNT(*) AS n FROM share_links').get().n).toBe(1);
  });
});
