// The share_links table (WS10) and the only code that reads or writes it.
//
//   share_links(id, user_id, token_hash, scope, label, created_at, expires_at,
//               revoked_at, last_viewed_at, timezone)
//
// * `token_hash` is the SHA-256 of the token (see tokens.js). The token itself is
//   never stored, so it cannot be listed again and a copy of the database cannot be
//   used to open a link.
// * `scope` is JSON, today `{"detailed":boolean}`. It is the owner's choice of what
//   the link may reveal; summary.js is what enforces it.
// * `label` is the owner's private note ("for Dr. X"). It is shown to the owner only;
//   nothing public ever reads it.
// * `timezone` is the IANA zone the owner was in when they made the link, so "a day"
//   on the public page is the owner's day.
// * Times are epoch milliseconds. NULL `expires_at` means "never expires".
//
// A link is ACTIVE when it is not revoked and has not expired. The public lookup
// (findActiveByHash) is ONE query that already applies both conditions, so a revoked
// or expired link is, to everything above this file, simply a link that does not exist:
// there is no branch that could answer the two cases differently.

import { randomUUID } from 'node:crypto';

export const SHARE_MIGRATIONS = [
  {
    id: 'ws10_001_share_links',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS share_links (
          id             TEXT PRIMARY KEY,
          user_id        TEXT    NOT NULL,
          token_hash     TEXT    NOT NULL,
          scope          TEXT    NOT NULL,
          label          TEXT    NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL,
          expires_at     INTEGER,
          revoked_at     INTEGER,
          last_viewed_at INTEGER,
          timezone       TEXT    NOT NULL DEFAULT 'UTC'
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links (token_hash)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_share_links_user ON share_links (user_id, created_at)');
    },
  },
];

/** Revoked and expired rows are kept this long (so the owner's list can be audited), then deleted. */
export const STALE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** A view is written to `last_viewed_at` at most this often per link. */
export const VIEW_TOUCH_INTERVAL_MS = 60 * 1000;

function parseScope(text) {
  try {
    const s = JSON.parse(text);
    return { detailed: s !== null && typeof s === 'object' && s.detailed === true };
  } catch {
    return { detailed: false }; // an unreadable scope reveals the LEAST
  }
}

/** The owner's view of a row. No token, no hash, no user id. */
function toOwnerRecord(row) {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastViewedAt: row.last_viewed_at,
    detailed: parseScope(row.scope).detailed,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ now?: () => number, newId?: () => string }} [opts]
 */
export function createShareStore(db, { now = Date.now, newId = () => randomUUID() } = {}) {
  const q = {
    insert: db.prepare(`
      INSERT INTO share_links (id, user_id, token_hash, scope, label, created_at, expires_at, timezone)
      VALUES (@id, @user_id, @token_hash, @scope, @label, @created_at, @expires_at, @timezone)`),
    countActive: db.prepare(`
      SELECT COUNT(*) AS n FROM share_links
      WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`),
    listActive: db.prepare(`
      SELECT * FROM share_links
      WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC, id ASC`),
    revoke: db.prepare(`
      UPDATE share_links SET revoked_at = ?
      WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`),
    // THE public lookup: one query, revoked and expired folded in.
    findActive: db.prepare(`
      SELECT id, user_id, scope, timezone, last_viewed_at FROM share_links
      WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`),
    touch: db.prepare(`
      UPDATE share_links SET last_viewed_at = ?
      WHERE id = ? AND (last_viewed_at IS NULL OR last_viewed_at <= ?)`),
    purge: db.prepare(`
      DELETE FROM share_links
      WHERE (revoked_at IS NOT NULL AND revoked_at < @before) OR (expires_at IS NOT NULL AND expires_at < @before)`),
    wipeUser: db.prepare('DELETE FROM share_links WHERE user_id = ?'),
  };

  const create = db.transaction(({ userId, tokenHash, detailed, label, expiresAt, timezone, maxActive }) => {
    const at = now();
    if (q.countActive.get(userId, at).n >= maxActive) return { ok: false, code: 'too_many_links', limit: maxActive };
    const id = newId();
    q.insert.run({
      id,
      user_id: userId,
      token_hash: tokenHash,
      scope: JSON.stringify({ detailed: detailed === true }),
      label,
      created_at: at,
      expires_at: expiresAt,
      timezone,
    });
    return {
      ok: true,
      link: { id, label, createdAt: at, expiresAt, lastViewedAt: null, detailed: detailed === true },
    };
  });

  return {
    /**
     * Makes a link unless the owner already has `maxActive` active ones.
     * @returns {{ ok: true, link: object } | { ok: false, code: 'too_many_links', limit: number }}
     */
    create(args) {
      return create(args);
    },

    countActive(userId) {
      return q.countActive.get(userId, now()).n;
    },

    /** The owner's active links, newest first. No tokens. */
    listActive(userId) {
      return q.listActive.all(userId, now()).map(toOwnerRecord);
    },

    /** Revokes one of THIS owner's active links. False when it is not theirs, not active, or not there. */
    revoke(userId, id) {
      const at = now();
      return q.revoke.run(at, id, userId, at).changes === 1;
    },

    /**
     * The public lookup. Returns `{ id, userId, detailed, timezone, lastViewedAt }` for an active link,
     * or null for an unknown, revoked or expired one (indistinguishable by construction).
     */
    findActiveByHash(tokenHash) {
      const row = q.findActive.get(tokenHash, now());
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        detailed: parseScope(row.scope).detailed,
        timezone: row.timezone,
        lastViewedAt: row.last_viewed_at,
      };
    },

    /** Records a successful view, at most once per VIEW_TOUCH_INTERVAL_MS. */
    touchViewed(id) {
      const at = now();
      q.touch.run(at, id, at - VIEW_TOUCH_INTERVAL_MS);
    },

    /** Deletes links revoked or expired more than STALE_RETENTION_MS ago. Returns how many. */
    purgeStale() {
      return q.purge.run({ before: now() - STALE_RETENTION_MS }).changes;
    },

    /** Deletes every link of a user (account removal). Returns how many. */
    removeAllForUser(userId) {
      return q.wipeUser.run(userId).changes;
    },
  };
}
