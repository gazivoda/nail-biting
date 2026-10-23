// Additive-only SQLite migrations for route modules.
//
// The production database (data/users.db) holds real users' subscriptions.
// Route modules therefore get a deliberately small toolbox: create a table or
// index if it is missing, add a column if it is missing. There is no way to
// drop, rename, rewrite or delete through these helpers, and the raw SQL they
// accept is checked to be the idempotent form. Anything that cannot be
// expressed this way needs the owner's sign-off, not a helper.
//
// A route module declares its tables once:
//
//   export default {
//     name: 'events',
//     migrations: [
//       { id: 'events_001_create', up: h => h.createTable(`
//           CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, ...)`) },
//       { id: 'events_002_user_index', up: h => h.createIndex(
//           'CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_id, updated_at)') },
//     ],
//     register(ctx) { ... },
//   };
//
// server/routes/index.js runs every module's migrations at boot, in order, each
// inside a transaction, and records the id in `schema_migrations` so it runs
// once. Because each step is also idempotent on its own, a crash between the
// step and the bookkeeping row is harmless.

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdent(name, what) {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(`migrate: invalid ${what} "${name}"`);
  }
  return name;
}

export function tableExists(db, table) {
  assertIdent(table, 'table name');
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

export function columnExists(db, table, column) {
  assertIdent(table, 'table name');
  assertIdent(column, 'column name');
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

/** `CREATE TABLE IF NOT EXISTS ...` only. */
export function createTable(db, sql) {
  if (!/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i.test(sql)) {
    throw new Error('migrate: createTable only accepts CREATE TABLE IF NOT EXISTS');
  }
  db.exec(sql);
}

/** `CREATE [UNIQUE] INDEX IF NOT EXISTS ...` only. */
export function createIndex(db, sql) {
  if (!/^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+/i.test(sql)) {
    throw new Error('migrate: createIndex only accepts CREATE [UNIQUE] INDEX IF NOT EXISTS');
  }
  db.exec(sql);
}

/**
 * Adds a column unless it is already there. The table must already exist.
 * SQLite cannot add a PRIMARY KEY or UNIQUE column in place, and a NOT NULL
 * column needs a DEFAULT; both are rejected up front with a clear message
 * instead of a half-applied migration.
 *
 * @returns {boolean} true if the column was added, false if it already existed.
 */
export function addColumn(db, table, column, definition) {
  assertIdent(table, 'table name');
  assertIdent(column, 'column name');
  if (typeof definition !== 'string' || /[;]/.test(definition)) {
    throw new Error('migrate: column definition must be a single type clause');
  }
  if (/\b(PRIMARY\s+KEY|UNIQUE)\b/i.test(definition)) {
    throw new Error('migrate: SQLite cannot add a PRIMARY KEY or UNIQUE column with ALTER TABLE');
  }
  if (/\bNOT\s+NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition)) {
    throw new Error('migrate: a NOT NULL column needs a DEFAULT');
  }
  if (!tableExists(db, table)) throw new Error(`migrate: table "${table}" does not exist`);
  if (columnExists(db, table, column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

/**
 * Runs each step once, in order. Steps are `{ id, up(helpers) }`; ids must be
 * unique across the whole codebase (prefix them with the module name).
 *
 * @returns {string[]} ids that ran this time.
 */
export function runMigrations(db, steps) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const seen = new Set();
  for (const step of steps) {
    if (typeof step?.id !== 'string' || step.id === '' || typeof step.up !== 'function') {
      throw new Error('migrate: every migration needs a string id and an up() function');
    }
    if (seen.has(step.id)) throw new Error(`migrate: duplicate migration id "${step.id}"`);
    seen.add(step.id);
  }

  const helpers = {
    createTable: sql => createTable(db, sql),
    createIndex: sql => createIndex(db, sql),
    addColumn: (table, column, definition) => addColumn(db, table, column, definition),
    tableExists: table => tableExists(db, table),
    columnExists: (table, column) => columnExists(db, table, column),
  };

  const done = new Set(db.prepare('SELECT id FROM schema_migrations').all().map(r => r.id));
  const ran = [];
  const mark = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  for (const step of steps) {
    if (done.has(step.id)) continue;
    db.transaction(() => {
      step.up(helpers);
      mark.run(step.id, new Date().toISOString());
    })();
    ran.push(step.id);
  }
  return ran;
}
