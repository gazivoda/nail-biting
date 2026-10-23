// Tables for lifetime, gift and referral purchases (WS9). Additive only: nothing here touches
// the existing `users` table or any of its columns.
//
//   paddle_events         Paddle event ids already handled, so a replayed webhook changes nothing
//   billing_transactions  completed Paddle transactions of OUR prices, one row each: which user paid,
//                         what for, and a hash of the card (type, last four, expiry) as a weak
//                         "same payment method" signal for the referral checks
//   entitlements          local access grants: lifetime (never ends), gift and referral credit
//                         (a number of days that starts when nothing else gives access). `source` is
//                         unique, which is what makes every grant idempotent
//   gift_codes            one per gift purchase; only a SHA-256 of the code is stored
//   referral_codes        one short personal code per user
//   referrals             who was referred by whom, and what became of it

export const BILLING_MIGRATIONS = [
  {
    id: 'ws9_001_paddle_events',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS paddle_events (
          event_id     TEXT PRIMARY KEY,
          event_type   TEXT NOT NULL,
          occurred_at  TEXT,
          processed_at TEXT NOT NULL
        )`);
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_paddle_events_processed ON paddle_events (processed_at)');
    },
  },
  {
    id: 'ws9_002_billing_transactions',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS billing_transactions (
          txn_id              TEXT PRIMARY KEY,
          kind                TEXT NOT NULL,
          user_id             TEXT,
          customer_id         TEXT,
          price_id            TEXT,
          origin              TEXT,
          payment_fingerprint TEXT,
          created_at          TEXT NOT NULL,
          refunded_at         TEXT
        )`);
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_billing_transactions_user ON billing_transactions (user_id)');
    },
  },
  {
    id: 'ws9_003_entitlements',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS entitlements (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       TEXT NOT NULL,
          kind          TEXT NOT NULL,
          days          INTEGER,
          starts_at     TEXT,
          ends_at       TEXT,
          source        TEXT NOT NULL,
          created_at    TEXT NOT NULL,
          revoked_at    TEXT,
          revoke_reason TEXT
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_source ON entitlements (source)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements (user_id)');
    },
  },
  {
    id: 'ws9_004_gift_codes',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS gift_codes (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          txn_id        TEXT NOT NULL,
          code_hash     TEXT NOT NULL,
          days          INTEGER NOT NULL,
          buyer_email   TEXT,
          buyer_user_id TEXT,
          created_at    TEXT NOT NULL,
          expires_at    TEXT,
          email_sent_at TEXT,
          redeemed_by   TEXT,
          redeemed_at   TEXT,
          revoked_at    TEXT
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_codes_txn ON gift_codes (txn_id)');
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_codes_hash ON gift_codes (code_hash)');
    },
  },
  {
    id: 'ws9_005_referral_codes',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS referral_codes (
          user_id    TEXT PRIMARY KEY,
          code       TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes (code)');
    },
  },
  {
    id: 'ws9_006_referrals',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS referrals (
          referred_user_id   TEXT PRIMARY KEY,
          referrer_user_id   TEXT NOT NULL,
          code               TEXT NOT NULL,
          attached_at        TEXT NOT NULL,
          status             TEXT NOT NULL DEFAULT 'pending',
          reject_reason      TEXT,
          qualifying_txn_id  TEXT,
          rewarded_at        TEXT,
          revoked_at         TEXT
        )`);
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_user_id)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_referrals_txn ON referrals (qualifying_txn_id)');
    },
  },
];
