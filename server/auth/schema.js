// Tables for the extra sign-in methods (WS8). Additive only: nothing here
// touches the existing `users` table or any existing column.
//
//   auth_identities    one row per (provider, subject) a person has signed in with,
//                      pointing at the account (users.id) it belongs to
//   magic_link_tokens  emailed sign-in links: only a SHA-256 of the token is kept
//   auth_oauth_states  in-flight Apple / Microsoft sign-ins (state, nonce, PKCE verifier; for Apple
//                      also the code Apple posted back, held here instead of in a URL)

export const AUTH_MIGRATIONS = [
  {
    id: 'ws8_001_auth_identities',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS auth_identities (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          provider         TEXT NOT NULL,
          provider_subject TEXT NOT NULL,
          user_id          TEXT NOT NULL,
          email            TEXT,
          email_verified   INTEGER NOT NULL DEFAULT 0,
          created_at       TEXT NOT NULL
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_subject ON auth_identities (provider, provider_subject)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities (user_id)');
    },
  },
  {
    id: 'ws8_002_magic_link_tokens',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS magic_link_tokens (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL,
          email      TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at    INTEGER,
          created_ip TEXT
        )`);
      h.createIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_magic_link_tokens_hash ON magic_link_tokens (token_hash)');
      h.createIndex('CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens (email, created_at)');
    },
  },
  {
    id: 'ws8_003_auth_oauth_states',
    up: h => {
      h.createTable(`
        CREATE TABLE IF NOT EXISTS auth_oauth_states (
          state_hash    TEXT PRIMARY KEY,
          provider      TEXT NOT NULL,
          nonce         TEXT NOT NULL,
          code_verifier TEXT,
          auth_code     TEXT,
          profile_name  TEXT,
          provider_error TEXT,
          attached      INTEGER NOT NULL DEFAULT 0,
          created_at    INTEGER NOT NULL,
          expires_at    INTEGER NOT NULL
        )`);
    },
  },
];
