// Local access grants (WS9): lifetime, gift, referral credit.
//
//   lifetime         starts now, never ends.
//   gift, credit     a number of DAYS that is SAVED ("banked") when granted and starts running only
//                    when the account has nothing else that gives access (no active/paused
//                    subscription, no running trial, no lifetime, no other running grant). Then the
//                    oldest saved block starts: it runs for exactly its days from that moment.
//                    OWNER DECISION PENDING: this "use them when you would otherwise lose access" rule
//                    is the one that makes a bonus worth something to someone who is already paying
//                    (the alternative, starting the days at the moment of the grant, would spend a
//                    paying referrer's reward on a month they are already being charged for).
//
// Every grant has a unique `source` (for example `txn:txn_123`, `gift:7`,
// `referral:<referred user id>:referrer`), so granting twice is a no-op: that is the second line of
// idempotency behind the processed-event table.
//
// Nothing here writes the `users` table or touches a Paddle subscription.

const iso = t => new Date(t).toISOString();

export function createEntitlements(db, { now = Date.now } = {}) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO entitlements (user_id, kind, days, starts_at, ends_at, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const selRunning = db.prepare(`
    SELECT kind, ends_at FROM entitlements
    WHERE user_id = ? AND revoked_at IS NULL AND starts_at IS NOT NULL AND starts_at <= ?
      AND (ends_at IS NULL OR ends_at > ?)
    ORDER BY id`);
  const selBanked = db.prepare(`
    SELECT COALESCE(SUM(days), 0) AS days FROM entitlements
    WHERE user_id = ? AND revoked_at IS NULL AND starts_at IS NULL`);
  const selNextBanked = db.prepare(`
    SELECT id, days FROM entitlements
    WHERE user_id = ? AND revoked_at IS NULL AND starts_at IS NULL
    ORDER BY id LIMIT 1`);
  const startBlock = db.prepare('UPDATE entitlements SET starts_at = ?, ends_at = ? WHERE id = ? AND starts_at IS NULL AND revoked_at IS NULL');
  const revoke = db.prepare('UPDATE entitlements SET revoked_at = ?, revoke_reason = ? WHERE source = ? AND revoked_at IS NULL');
  const bySource = db.prepare('SELECT * FROM entitlements WHERE source = ?');
  const forUser = db.prepare('SELECT * FROM entitlements WHERE user_id = ? ORDER BY id');

  return {
    /** @returns {boolean} true when a grant was written, false when this source already existed */
    grantLifetime(userId, source) {
      const t = iso(now());
      return insert.run(userId, 'lifetime', null, t, null, source, t).changes === 1;
    },

    /** Saves `days` of gift or credit for the user. @returns {boolean} true when newly written */
    bank(userId, kind, days, source) {
      if (kind !== 'gift' && kind !== 'referral_credit') throw new Error(`entitlements: cannot bank a ${kind} grant`);
      if (!Number.isInteger(days) || days < 1) throw new Error('entitlements: days must be a whole number of at least 1');
      return insert.run(userId, kind, days, null, null, source, iso(now())).changes === 1;
    },

    /** Takes the grant away (a refund or chargeback). Idempotent. @returns {boolean} true when something was revoked */
    revokeBySource(source, reason) {
      return revoke.run(iso(now()), reason, source).changes > 0;
    },

    find: source => bySource.get(source) ?? null,
    forUser: userId => forUser.all(userId),

    /** Grants running at `at`, as the client reads them: [{ kind, ends_at }]. */
    running(userId, at = now()) {
      const t = iso(at);
      return selRunning.all(userId, t, t);
    },

    /** Days saved and not yet started. */
    bankedDays(userId) {
      return selBanked.get(userId).days;
    },

    /**
     * Starts the oldest saved block, now. Safe to call twice: the UPDATE only fires on a block that has
     * not started.
     * @returns {boolean} true when a block was started
     */
    activateNext(userId, at = now()) {
      const tx = db.transaction(() => {
        const next = selNextBanked.get(userId);
        if (!next) return false;
        return startBlock.run(iso(at), iso(at + next.days * 86_400_000), next.id).changes === 1;
      });
      return tx();
    },
  };
}
