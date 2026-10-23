// Email preferences (WS5): one row per person who has ever touched the weekly
// summary setting. Additive table only (server/db/migrate.js); nothing here reads
// or changes the users table.
//
//   email_preferences
//     user_id            the account (same id as users.id)
//     weekly_summary     0 or 1. Default 0: nobody is opted in until they say so.
//     timezone           IANA zone the browser reported when they opted in (week boundaries)
//     unsubscribe_secret random per person; signs the link in every email (token.js)
//     last_sent_week     'YYYY-Www' of the last summary CLAIMED for sending (idempotency)
//     opted_in_at        epoch ms of the most recent switch-on
//     updated_at         epoch ms of the last change

import { newUnsubscribeSecret } from './token.js';

export const WEEKLY_EMAIL_MIGRATIONS = [
  {
    id: 'ws5_001_email_preferences',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS email_preferences (
          user_id            TEXT    PRIMARY KEY,
          weekly_summary     INTEGER NOT NULL DEFAULT 0,
          timezone           TEXT,
          unsubscribe_secret TEXT    NOT NULL,
          last_sent_week     TEXT,
          opted_in_at        INTEGER,
          updated_at         INTEGER NOT NULL
        )`);
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_email_preferences_weekly ON email_preferences (weekly_summary)');
    },
  },
];

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ now?: () => number, newSecret?: () => string }} [opts]
 */
export function createPrefsStore(db, { now = Date.now, newSecret = newUnsubscribeSecret } = {}) {
  const q = {
    get: db.prepare('SELECT * FROM email_preferences WHERE user_id = ?'),
    insert: db.prepare(`
      INSERT OR IGNORE INTO email_preferences (user_id, weekly_summary, unsubscribe_secret, updated_at)
      VALUES (?, 0, ?, ?)`),
    enable: db.prepare(`
      UPDATE email_preferences
         SET weekly_summary = 1,
             timezone = COALESCE(@timezone, timezone),
             opted_in_at = CASE WHEN weekly_summary = 1 THEN COALESCE(opted_in_at, @at) ELSE @at END,
             updated_at = @at
       WHERE user_id = @userId`),
    disable: db.prepare(`
      UPDATE email_preferences
         SET weekly_summary = 0,
             timezone = COALESCE(@timezone, timezone),
             updated_at = @at
       WHERE user_id = @userId`),
    optedIn: db.prepare('SELECT * FROM email_preferences WHERE weekly_summary = 1 ORDER BY user_id'),
    claim: db.prepare(`
      UPDATE email_preferences SET last_sent_week = @week
       WHERE user_id = @userId AND weekly_summary = 1 AND (last_sent_week IS NULL OR last_sent_week < @week)`),
    release: db.prepare(`
      UPDATE email_preferences SET last_sent_week = @previous
       WHERE user_id = @userId AND last_sent_week = @week`),
  };

  const api = {
    get(userId) {
      return q.get.get(String(userId)) ?? null;
    },

    /** The person's row, created (opted out) on first use. */
    ensure(userId) {
      const id = String(userId);
      q.insert.run(id, newSecret(), now());
      return q.get.get(id);
    },

    /** Switch on or off. `timezone` (already validated) is kept when given. Returns the row. */
    setEnabled(userId, enabled, timezone = null) {
      const id = String(userId);
      api.ensure(id);
      const params = { userId: id, timezone, at: now() };
      (enabled ? q.enable : q.disable).run(params);
      return q.get.get(id);
    },

    /** The link in an email switches only this: off, nothing else changes. */
    unsubscribe(userId) {
      const id = String(userId);
      if (!q.get.get(id)) return false;
      q.disable.run({ userId: id, timezone: null, at: now() });
      return true;
    },

    /** Everyone who is opted in, in a stable order. */
    listOptedIn() {
      return q.optedIn.all();
    },

    /**
     * Reserve `week` for this person. True for exactly one caller (the UPDATE is a single
     * statement, so two processes sharing the database file cannot both win). A week at or
     * before the one already recorded is refused, so an old week is never sent after a newer one.
     */
    claimWeek(userId, week) {
      return q.claim.run({ userId: String(userId), week }).changes === 1;
    },

    /** Undo a claim after a failed send, but only if it is still the one we made. */
    releaseWeek(userId, week, previous) {
      return q.release.run({ userId: String(userId), week, previous: previous ?? null }).changes === 1;
    },
  };
  return api;
}
