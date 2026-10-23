// An in-memory better-sqlite3 database for server tests. Same engine as
// production, no file on disk. Server tests must never open data/users.db.

import Database from 'better-sqlite3';

// Mirrors the CREATE TABLE in server.js. If that table changes, change this too;
// server/db/migrate.test.js fails loudly if the two drift apart in column names.
export const USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id                    TEXT PRIMARY KEY,
    email                 TEXT,
    name                  TEXT,
    avatar                TEXT,
    trial_end_date        TEXT NOT NULL,
    subscription_status   TEXT NOT NULL DEFAULT 'trial',
    subscription_plan     TEXT,
    subscription_end_date TEXT,
    paddle_subscription_id TEXT,
    paddle_customer_id     TEXT,
    created_at            TEXT NOT NULL
  )
`;

/** Fresh `:memory:` database. Pass `{ users: true }` to pre-create the production users table. */
export function createMemoryDb({ users = false } = {}) {
  const db = new Database(':memory:');
  if (users) db.exec(USERS_TABLE_SQL);
  return db;
}
