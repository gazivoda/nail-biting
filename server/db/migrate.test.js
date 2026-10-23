import { describe, it, expect } from 'vitest';
import {
  tableExists, columnExists, createTable, createIndex, addColumn, runMigrations,
} from './migrate.js';
import { createMemoryDb, USERS_TABLE_SQL } from '../../test-utils/memorySqlite.js';
import { readFileSync } from 'node:fs';

describe('guards', () => {
  it('createTable and createIndex accept only the idempotent forms', () => {
    const db = createMemoryDb();
    expect(() => createTable(db, 'CREATE TABLE t (a)')).toThrow(/IF NOT EXISTS/);
    expect(() => createTable(db, 'DROP TABLE users')).toThrow();
    expect(() => createIndex(db, 'CREATE INDEX i ON t (a)')).toThrow(/IF NOT EXISTS/);
    createTable(db, 'create table if not exists t (a TEXT)');
    createTable(db, 'CREATE TABLE IF NOT EXISTS t (a TEXT)'); // twice is fine
    createIndex(db, 'CREATE INDEX IF NOT EXISTS i ON t (a)');
    createIndex(db, 'CREATE INDEX IF NOT EXISTS i ON t (a)');
    expect(tableExists(db, 't')).toBe(true);
  });

  it('addColumn adds once, reports whether it did, and keeps existing rows', () => {
    const db = createMemoryDb({ users: true });
    db.prepare("INSERT INTO users (id, email, trial_end_date, created_at) VALUES ('u1', 'a@b.c', 'x', 'y')").run();

    expect(addColumn(db, 'users', 'referral_code', 'TEXT')).toBe(true);
    expect(addColumn(db, 'users', 'referral_code', 'TEXT')).toBe(false);
    expect(addColumn(db, 'users', 'credits', 'INTEGER NOT NULL DEFAULT 0')).toBe(true);

    expect(columnExists(db, 'users', 'referral_code')).toBe(true);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get('u1');
    expect(row).toMatchObject({ id: 'u1', email: 'a@b.c', referral_code: null, credits: 0 });
  });

  it('addColumn rejects what SQLite cannot do in place, and anything that is not a plain clause', () => {
    const db = createMemoryDb({ users: true });
    expect(() => addColumn(db, 'users', 'x', 'TEXT NOT NULL')).toThrow(/DEFAULT/);
    expect(() => addColumn(db, 'users', 'x', 'TEXT UNIQUE')).toThrow(/UNIQUE/);
    expect(() => addColumn(db, 'users', 'x', 'TEXT PRIMARY KEY')).toThrow();
    expect(() => addColumn(db, 'users', 'x', 'TEXT; DROP TABLE users')).toThrow();
    expect(() => addColumn(db, 'users; DROP TABLE users', 'x', 'TEXT')).toThrow(/invalid table/);
    expect(() => addColumn(db, 'nope', 'x', 'TEXT')).toThrow(/does not exist/);
    expect(tableExists(db, 'users')).toBe(true);
  });
});

describe('runMigrations', () => {
  it('runs each step once, in order, and records it', () => {
    const db = createMemoryDb({ users: true });
    const calls = [];
    const steps = [
      { id: 't_001', up: h => { calls.push('001'); h.createTable('CREATE TABLE IF NOT EXISTS things (id TEXT PRIMARY KEY, n INTEGER)'); } },
      { id: 't_002', up: h => { calls.push('002'); h.addColumn('things', 'label', 'TEXT'); h.createIndex('CREATE INDEX IF NOT EXISTS idx_things_n ON things (n)'); } },
    ];
    expect(runMigrations(db, steps)).toEqual(['t_001', 't_002']);
    expect(runMigrations(db, steps)).toEqual([]);
    expect(calls).toEqual(['001', '002']);
    expect(columnExists(db, 'things', 'label')).toBe(true);
    expect(db.prepare('SELECT id FROM schema_migrations ORDER BY id').all().map(r => r.id)).toEqual(['t_001', 't_002']);
  });

  it('a failing step rolls back and is retried next time; earlier steps stay applied', () => {
    const db = createMemoryDb();
    let broken = true;
    const steps = [
      { id: 'r_001', up: h => h.createTable('CREATE TABLE IF NOT EXISTS a (x TEXT)') },
      {
        id: 'r_002',
        up: h => {
          h.createTable('CREATE TABLE IF NOT EXISTS b (x TEXT)');
          if (broken) throw new Error('boom');
        },
      },
    ];
    expect(() => runMigrations(db, steps)).toThrow('boom');
    expect(tableExists(db, 'a')).toBe(true);
    expect(tableExists(db, 'b')).toBe(false); // r_002 rolled back
    broken = false;
    expect(runMigrations(db, steps)).toEqual(['r_002']);
    expect(tableExists(db, 'b')).toBe(true);
  });

  it('refuses duplicate or malformed steps before touching anything', () => {
    const db = createMemoryDb();
    expect(() => runMigrations(db, [{ id: 'x', up() {} }, { id: 'x', up() {} }])).toThrow(/duplicate/);
    expect(() => runMigrations(db, [{ id: '', up() {} }])).toThrow();
    expect(() => runMigrations(db, [{ id: 'y' }])).toThrow();
  });

  it('leaves the existing users table and its rows alone', () => {
    const db = createMemoryDb({ users: true });
    db.prepare("INSERT INTO users (id, email, trial_end_date, created_at) VALUES ('u1', 'a@b.c', 't', 'c')").run();
    runMigrations(db, [{ id: 'z_001', up: h => h.createTable('CREATE TABLE IF NOT EXISTS z (id TEXT)') }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(1);
  });
});

describe('the in-memory users table', () => {
  it('has the same columns as the CREATE TABLE in server.js', () => {
    const src = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
    const block = src.match(/CREATE TABLE IF NOT EXISTS users \(([\s\S]*?)\n  \)/)[1];
    const cols = s => [...s.matchAll(/^\s*(\w+)\s+(?:TEXT|INTEGER)/gm)].map(m => m[1]);
    const mine = USERS_TABLE_SQL.match(/\(([\s\S]*)\)/)[1];
    expect(cols(mine)).toEqual(cols(block));
  });
});
