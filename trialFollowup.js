// ─── Post-trial follow-up email ──────────────────────────────────────────────
// 24h after a free trial ends, email the user once: subscribe, or tell us what
// didn't work. Runs hourly inside the web server; each user is mailed at most
// once (trial_followup_sent_at), so restarts and redeploys never double-send.

import { tableExists } from './server/db/migrate.js';

const HOUR = 60 * 60 * 1000;
const DELAY = 24 * HOUR;
// Only trials that ended within this window qualify. Without it, the first run
// would mail everyone whose trial lapsed months ago.
const MAX_AGE = 7 * 24 * HOUR;

export function migrateTrialFollowup(db) {
  try { db.exec('ALTER TABLE users ADD COLUMN trial_followup_sent_at TEXT'); } catch { /* already added */ }
}

// Trial users (status 'trial' or lazily-flipped 'expired') who never subscribed.
// 'cancelled' users paid at some point, so they are not trial leavers.
// WS9: someone who bought a lifetime plan, redeemed a gift or has referral days is not a trial leaver
// (the table exists once server/billing has migrated; before that there is nothing to exclude).
const NO_GRANT = `AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = users.id AND e.revoked_at IS NULL)`;

export function findDueUsers(db, now = Date.now()) {
  return db.prepare(`
    SELECT * FROM users
    WHERE trial_followup_sent_at IS NULL
      AND email IS NOT NULL AND email != ''
      AND subscription_status IN ('trial', 'expired')
      AND paddle_subscription_id IS NULL
      AND trial_end_date <= ?
      AND trial_end_date >  ?
      ${tableExists(db, 'entitlements') ? NO_GRANT : ''}
  `).all(new Date(now - DELAY).toISOString(), new Date(now - MAX_AGE).toISOString());
}

export async function runTrialFollowup(db, send, now = Date.now()) {
  const markSent = db.prepare('UPDATE users SET trial_followup_sent_at = ? WHERE id = ?');
  for (const user of findDueUsers(db, now)) {
    try {
      await send(user);
      markSent.run(new Date().toISOString(), user.id);
      console.log(`[trial-followup] sent to ${user.email}`);
    } catch (err) {
      // Left unmarked, so the next hourly run retries until the user ages out.
      console.error(`[trial-followup] failed for ${user.email}:`, err);
    }
  }
}

export function startTrialFollowupJob(db, send) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[trial-followup] RESEND_API_KEY not set — job disabled');
    return;
  }
  migrateTrialFollowup(db);
  const tick = () => runTrialFollowup(db, send).catch(err => console.error('[trial-followup] run failed:', err));
  tick();
  setInterval(tick, HOUR).unref();
}
