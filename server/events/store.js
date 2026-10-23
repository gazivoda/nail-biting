// The server's copy of a user's history (WS4): table `habit_events`.
//
// Contract for other workstreams (weekly email, phone companion, share links):
//
//   import { createEventStore } from '../events/store.js';
//   const events = createEventStore(ctx.db);
//   events.listUserEvents(userId, { since, until, includeDeleted });   // canonical wire events
//
// Rows hold HabitEvent records ONLY (id, ts, source, behavior, hand, triggers,
// falsePositive, competingResponse, confirmed, deviceId, updatedAt, deleted).
// There is nowhere to put a frame, a landmark, an image or a calibration
// sample, and the validator (validate.js) refuses to accept one.
//
// `seq` is the sync cursor. It is `INTEGER PRIMARY KEY AUTOINCREMENT`, so it
// only ever grows, even after rows are deleted (a wipe, a rewrite): SQLite
// remembers the high-water mark in sqlite_sequence. A row that changes is
// written again (INSERT OR REPLACE), which gives it a fresh, higher seq; a
// write that changes nothing writes nothing, so replaying a batch is a no-op
// that moves no cursor.
//
// Conflicts are decided by compareEventVersions (compare.js): last write wins by
// `updatedAt`, with a deterministic tie-break.

import { randomUUID } from 'node:crypto';
import { compareEventVersions } from './compare.js';
import { LIMITS } from './limits.js';

export const EVENTS_MIGRATIONS = [
  {
    id: 'ws4_001_habit_events',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS habit_events (
          seq               INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id           TEXT    NOT NULL,
          id                TEXT    NOT NULL,
          ts                INTEGER NOT NULL,
          source            TEXT    NOT NULL,
          behavior          TEXT    NOT NULL,
          hand              TEXT,
          triggers          TEXT,
          false_positive    INTEGER,
          confirmed         INTEGER,
          competing_response TEXT,
          device_id         TEXT,
          updated_at        INTEGER NOT NULL,
          deleted           INTEGER NOT NULL DEFAULT 0,
          server_updated_at INTEGER NOT NULL,
          UNIQUE (user_id, id)
        )`);
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_habit_events_user_seq ON habit_events (user_id, seq)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_habit_events_user_ts ON habit_events (user_id, ts)');
    },
  },
  {
    id: 'ws4_002_habit_event_epochs',
    up: h => {
      // One row per user who has synced. The epoch changes when the user wipes their synced data,
      // so a device that still holds the old one stops instead of quietly re-uploading.
      h.createTable(`
        CREATE TABLE IF NOT EXISTS habit_event_epochs (
          user_id    TEXT PRIMARY KEY,
          epoch      TEXT    NOT NULL,
          created_at INTEGER NOT NULL
        )`);
    },
  },
];

const boolOrNull = v => (v === undefined ? null : v ? 1 : 0);

/** A stored row -> the canonical wire event. A deleted row carries only what a tombstone carries. */
export function rowToEvent(row) {
  const e = { id: row.id, ts: row.ts, source: row.source, behavior: row.behavior, updatedAt: row.updated_at };
  if (row.device_id !== null) e.deviceId = row.device_id;
  if (row.deleted) {
    e.deleted = true;
    return e;
  }
  if (row.hand !== null) e.hand = row.hand;
  if (row.triggers !== null) e.triggers = JSON.parse(row.triggers);
  if (row.false_positive !== null) e.falsePositive = row.false_positive === 1;
  if (row.competing_response !== null) e.competingResponse = JSON.parse(row.competing_response);
  if (row.confirmed !== null) e.confirmed = row.confirmed === 1;
  return e;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ now?: () => number, newEpoch?: () => string }} [opts]
 */
export function createEventStore(db, { now = Date.now, newEpoch = () => randomUUID() } = {}) {
  const q = {
    getRow: db.prepare('SELECT * FROM habit_events WHERE user_id = ? AND id = ?'),
    put: db.prepare(`
      INSERT OR REPLACE INTO habit_events
        (user_id, id, ts, source, behavior, hand, triggers, false_positive, confirmed,
         competing_response, device_id, updated_at, deleted, server_updated_at)
      VALUES
        (@user_id, @id, @ts, @source, @behavior, @hand, @triggers, @false_positive, @confirmed,
         @competing_response, @device_id, @updated_at, @deleted, @server_updated_at)`),
    since: db.prepare('SELECT * FROM habit_events WHERE user_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?'),
    total: db.prepare('SELECT COUNT(*) AS n FROM habit_events WHERE user_id = ?'),
    deleted: db.prepare('SELECT COUNT(*) AS n FROM habit_events WHERE user_id = ? AND deleted = 1'),
    newest: db.prepare('SELECT MAX(server_updated_at) AS t FROM habit_events WHERE user_id = ?'),
    wipe: db.prepare('DELETE FROM habit_events WHERE user_id = ?'),
    getEpoch: db.prepare('SELECT epoch FROM habit_event_epochs WHERE user_id = ?'),
    insertEpoch: db.prepare('INSERT OR IGNORE INTO habit_event_epochs (user_id, epoch, created_at) VALUES (?, ?, ?)'),
    setEpoch: db.prepare(`
      INSERT INTO habit_event_epochs (user_id, epoch, created_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET epoch = excluded.epoch, created_at = excluded.created_at`),
  };

  /** Column values for a wire event. A tombstone keeps none of the content. */
  function toParams(userId, e, at) {
    const dead = e.deleted === true;
    return {
      user_id: userId,
      id: e.id,
      ts: e.ts,
      source: e.source,
      behavior: e.behavior,
      hand: dead ? null : e.hand ?? null,
      triggers: dead || e.triggers === undefined ? null : JSON.stringify(e.triggers),
      false_positive: dead ? null : boolOrNull(e.falsePositive),
      confirmed: dead ? null : boolOrNull(e.confirmed),
      competing_response: dead || e.competingResponse === undefined ? null : JSON.stringify(e.competingResponse),
      device_id: e.deviceId ?? null,
      updated_at: e.updatedAt,
      deleted: dead ? 1 : 0,
      server_updated_at: at,
    };
  }

  const api = {
    getEpoch(userId) {
      return q.getEpoch.get(userId)?.epoch ?? null;
    },

    /** The user's epoch, created on first use. */
    ensureEpoch(userId) {
      q.insertEpoch.run(userId, newEpoch(), now());
      return q.getEpoch.get(userId).epoch;
    },

    counts(userId) {
      const total = q.total.get(userId).n;
      const deleted = q.deleted.get(userId).n;
      return { total, live: total - deleted, deleted, lastChangeAt: q.newest.get(userId).t ?? null };
    },

    /**
     * Applies a validated batch for `userId`, then returns what changed on the
     * server since `since` (never echoing the rows this very batch wrote).
     *
     * Returns `{ ok: false, code: 'quota_exceeded', limit, count }` without
     * writing anything if the batch would put the user over `quota`.
     *
     * Otherwise `{ ok: true, events, cursor, hasMore, applied, kept }` where
     *  - `events`  rows with seq > since (oldest first, at most `pageSize`), plus the
     *              server's version of any pushed event it kept instead of the pushed one
     *  - `cursor`  pass it back as `since`; when `hasMore` is true there is more to fetch
     *  - `applied` pushed events that changed the server
     */
    sync(userId, batch, { since = 0, pageSize = LIMITS.pageSize, quota = LIMITS.quotaPerUser } = {}) {
      return db.transaction(() => {
        const at = now();

        // Pass 1: read, so a quota failure leaves the database untouched.
        const existing = new Map();
        let newRows = 0;
        for (const e of batch) {
          if (existing.has(e.id)) continue;
          const row = q.getRow.get(userId, e.id);
          existing.set(e.id, row ?? null);
          if (!row) newRows++;
        }
        const before = q.total.get(userId).n;
        if (before + newRows > quota) return { ok: false, code: 'quota_exceeded', limit: quota, count: before };

        // Pass 2: last write wins; ties are broken deterministically.
        const wrote = new Set();
        const kept = new Map();
        for (const incoming of batch) {
          const current = existing.get(incoming.id);
          if (current) {
            const mine = rowToEvent(current);
            const cmp = compareEventVersions(incoming, mine);
            if (cmp <= 0) {
              if (cmp < 0) kept.set(incoming.id, mine); // the server's version wins: tell the pusher
              continue;
            }
          }
          q.put.run(toParams(userId, incoming, at));
          existing.set(incoming.id, q.getRow.get(userId, incoming.id));
          wrote.add(incoming.id);
          kept.delete(incoming.id);
        }

        // Pull.
        const rows = q.since.all(userId, since, pageSize + 1);
        const hasMore = rows.length > pageSize;
        const page = hasMore ? rows.slice(0, pageSize) : rows;
        const cursor = page.length > 0 ? page[page.length - 1].seq : since;
        const out = [];
        const sent = new Set();
        for (const row of page) {
          if (wrote.has(row.id)) continue; // this batch wrote it: the pusher already has it
          out.push(rowToEvent(row));
          sent.add(row.id);
        }
        for (const [id, version] of kept) {
          if (!sent.has(id)) out.push(version);
        }
        return { ok: true, events: out, cursor, hasMore, applied: wrote.size, kept: kept.size };
      })();
    },

    /** Deletes every synced event of the user and starts a new epoch. */
    wipe(userId) {
      return db.transaction(() => {
        const deleted = q.wipe.run(userId).changes;
        const epoch = newEpoch();
        q.setEpoch.run(userId, epoch, now());
        return { deleted, epoch };
      })();
    },

    /**
     * The user's events as canonical wire events (`{ id, ts, source, behavior,
     * updatedAt, hand?, triggers?, ... }`), oldest first. For server-side
     * features (weekly email, share links). Deleted events are left out unless
     * `includeDeleted` is true. `since` / `until` bound `ts` (since inclusive,
     * until exclusive), like the client's EventQuery.
     */
    listUserEvents(userId, { since, until, includeDeleted = false, limit } = {}) {
      const where = ['user_id = @userId'];
      const params = { userId };
      if (!includeDeleted) where.push('deleted = 0');
      if (since !== undefined) { where.push('ts >= @since'); params.since = since; }
      if (until !== undefined) { where.push('ts < @until'); params.until = until; }
      let sql = `SELECT * FROM habit_events WHERE ${where.join(' AND ')} ORDER BY ts ASC, id ASC`;
      if (limit !== undefined) { sql += ' LIMIT @limit'; params.limit = limit; }
      return db.prepare(sql).all(params).map(rowToEvent);
    },
  };
  return api;
}
