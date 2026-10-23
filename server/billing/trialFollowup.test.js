// The post-trial "how did it go" email must not go to someone who bought a lifetime plan, redeemed a
// gift or earned referral days. (trialFollowup.js is a root file; its only WS9 change is this exclusion.
// It contains no trial length: "24 hours after the trial ends" reads trial_end_date.)

import { describe, it, expect } from 'vitest';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { runMigrations } from '../db/migrate.js';
import { BILLING_MIGRATIONS } from './schema.js';
import { findDueUsers } from '../../trialFollowup.js';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ended = new Date(NOW - 30 * 3600_000).toISOString();   // ended 30 hours ago: due

function db({ withBilling }) {
  const d = createMemoryDb({ users: true });
  d.exec('ALTER TABLE users ADD COLUMN trial_followup_sent_at TEXT');
  if (withBilling) runMigrations(d, BILLING_MIGRATIONS);
  for (const id of ['plain', 'lifetime', 'credit']) {
    d.prepare(`INSERT INTO users (id, email, name, trial_end_date, subscription_status, created_at) VALUES (?, ?, ?, ?, 'expired', ?)`)
      .run(id, `${id}@example.com`, id, ended, '2026-10-01T00:00:00Z');
  }
  return d;
}

describe('findDueUsers', () => {
  it('still finds every trial leaver when the billing tables do not exist yet', () => {
    expect(findDueUsers(db({ withBilling: false }), NOW).map(u => u.id).sort()).toEqual(['credit', 'lifetime', 'plain']);
  });

  it('leaves out an account with a lifetime plan or saved referral days, but not a revoked grant', () => {
    const d = db({ withBilling: true });
    const t = new Date(NOW).toISOString();
    d.prepare("INSERT INTO entitlements (user_id, kind, days, starts_at, ends_at, source, created_at) VALUES ('lifetime', 'lifetime', NULL, ?, NULL, 'txn:1', ?)").run(t, t);
    d.prepare("INSERT INTO entitlements (user_id, kind, days, source, created_at) VALUES ('credit', 'referral_credit', 30, 'referral:x:referrer', ?)").run(t);
    expect(findDueUsers(d, NOW).map(u => u.id)).toEqual(['plain']);
    d.prepare("UPDATE entitlements SET revoked_at = ? WHERE user_id = 'lifetime'").run(t);   // refunded: back to being a trial leaver
    expect(findDueUsers(d, NOW).map(u => u.id).sort()).toEqual(['lifetime', 'plain']);
  });
});
