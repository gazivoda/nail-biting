// Accounts and identities against an in-memory SQLite database: linking by
// verified email, lazy Google backfill, and the pre-hijacking guard.

import { describe, it, expect } from 'vitest';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { seedUser } from '../../test-utils/authHarness.js';
import { runMigrations } from '../db/migrate.js';
import { AUTH_MIGRATIONS } from './schema.js';
import { createAccounts, TRIAL_MS } from './accounts.js';
import { createGoogleLinker } from './googleLink.js';
import { appleAssertion, googleAssertion, microsoftAssertion, MS_PERSONAL_TENANT } from './linkPolicy.js';

const GOOGLE_SUB = '112233445566778899001';
const NOW = 1_800_000_000_000;

function setup() {
  const db = createMemoryDb({ users: true });
  runMigrations(db, AUTH_MIGRATIONS);
  const getUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
  const saveUser = u => { seedUser(db, u); return getUser(u.id); };
  let n = 0;
  const accounts = createAccounts({ db, getUser, saveUser, now: () => NOW, randomId: () => `uuid-${++n}` });
  const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const identities = () => db.prepare('SELECT provider, provider_subject, user_id, email, email_verified FROM auth_identities ORDER BY id').all();
  return { db, accounts, getUser, userCount, identities };
}

const verifiedEmail = email => ({ email, verified: true });

describe('migrations', () => {
  it('create the three tables and are safe to run twice', () => {
    const db = createMemoryDb({ users: true });
    expect(runMigrations(db, AUTH_MIGRATIONS)).toHaveLength(3);
    expect(runMigrations(db, AUTH_MIGRATIONS)).toEqual([]);
    for (const t of ['auth_identities', 'magic_link_tokens', 'auth_oauth_states']) {
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t)).toBeTruthy();
    }
  });

  it('leave the users table exactly as it was', () => {
    const db = createMemoryDb({ users: true });
    const before = db.prepare('PRAGMA table_info(users)').all();
    runMigrations(db, AUTH_MIGRATIONS);
    expect(db.prepare('PRAGMA table_info(users)').all()).toEqual(before);
  });

  it('(provider, subject) is unique', () => {
    const { db } = setup();
    const add = () => db.prepare(
      "INSERT INTO auth_identities (provider, provider_subject, user_id, email_verified, created_at) VALUES ('apple','s1','u1',0,'now')").run();
    add();
    expect(add).toThrow(/UNIQUE/);
  });
});

describe('a person signing in two ways ends up in ONE account', () => {
  it('existing Google user, then an emailed link with the same address', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'ann@example.com', name: 'Ann' });

    const first = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    expect(first).toMatchObject({ status: 'ok', isNewUser: false, linked: true });
    expect(first.user.id).toBe(GOOGLE_SUB);
    expect(t.userCount()).toBe(1);
    // the Google identity was recorded lazily, plus the new one
    expect(t.identities().map(i => `${i.provider}:${i.provider_subject}`).sort()).toEqual(['email:ann@example.com', `google:${GOOGLE_SUB}`]);

    // and the second time it is recognised without any email matching
    const again = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    expect(again).toMatchObject({ isNewUser: false, linked: false });
    expect(again.user.id).toBe(GOOGLE_SUB);
  });

  it('Google user, then Apple with the same verified email (real address)', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'ann@example.com' });
    const r = t.accounts.signIn({
      provider: 'apple', subject: '001.apple', assertion: appleAssertion({ email: 'Ann@Example.com', email_verified: 'true', is_private_email: 'false' }),
    });
    expect(r.user.id).toBe(GOOGLE_SUB);
    expect(t.userCount()).toBe(1);
  });

  it('Google user, then Microsoft personal account with the same email', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'ann@outlook.com' });
    const r = t.accounts.signIn({
      provider: 'microsoft', subject: `${MS_PERSONAL_TENANT}:oid-1`,
      assertion: microsoftAssertion({ email: 'ann@outlook.com', tid: MS_PERSONAL_TENANT }),
    });
    expect(r.user.id).toBe(GOOGLE_SUB);
    expect(t.userCount()).toBe(1);
  });

  it('emailed link first, then Apple, then link again: all one account', () => {
    const t = setup();
    const a = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    expect(a).toMatchObject({ isNewUser: true });
    const b = t.accounts.signIn({ provider: 'apple', subject: 'apple-1', assertion: appleAssertion({ email: 'ann@example.com', email_verified: true }) });
    const c = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    expect(b.user.id).toBe(a.user.id);
    expect(c.user.id).toBe(a.user.id);
    expect(t.userCount()).toBe(1);
  });

  it('emailed link first, then GOOGLE with the same email (the Google callback hook)', () => {
    const t = setup();
    const created = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    const link = createGoogleLinker({ db: t.db, getUser: t.getUser });
    const user = link({ sub: GOOGLE_SUB, email: 'Ann@example.com', email_verified: true });
    expect(user.id).toBe(created.user.id);
    expect(t.userCount()).toBe(1);
    // remembered: the next Google sign-in resolves through the identity even if the email changed
    expect(link({ sub: GOOGLE_SUB, email: 'new-address@example.com', email_verified: true }).id).toBe(created.user.id);
  });

  it('the Google hook ignores an unverified Google email', () => {
    const t = setup();
    t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    const link = createGoogleLinker({ db: t.db, getUser: t.getUser });
    expect(link({ sub: GOOGLE_SUB, email: 'ann@example.com', email_verified: false })).toBeNull();
    expect(link({ sub: GOOGLE_SUB, email: 'ann@example.com' })).toBeNull();
  });
});

describe('the Google hook cannot change anything for Google-only people', () => {
  it('returns null when no account was made with another method (the callback then creates a user exactly as before)', () => {
    const t = setup();
    const link = createGoogleLinker({ db: t.db, getUser: t.getUser });
    expect(link({ sub: GOOGLE_SUB, email: 'new@example.com', email_verified: true })).toBeNull();
    expect(t.userCount()).toBe(0);
    expect(t.identities()).toEqual([]);
  });

  it('never joins a different LEGACY Google account that shares the address', () => {
    const t = setup();
    seedUser(t.db, { id: '999999999999999999999', email: 'ann@example.com' });
    const link = createGoogleLinker({ db: t.db, getUser: t.getUser });
    expect(link({ sub: GOOGLE_SUB, email: 'ann@example.com', email_verified: true })).toBeNull();
    expect(t.identities()).toEqual([]);
  });

  it('survives a database that has no auth tables (returns null and logs, never throws)', () => {
    const db = createMemoryDb({ users: true });
    const logs = [];
    const link = createGoogleLinker({ db, getUser: () => null, log: (...a) => logs.push(a.join(' ')) });
    expect(link({ sub: GOOGLE_SUB, email: 'a@b.com', email_verified: true })).toBeNull();
    expect(logs[0]).toMatch(/skipped/);
  });

  it('ignores a payload with no subject', () => {
    const t = setup();
    const link = createGoogleLinker({ db: t.db, getUser: t.getUser });
    expect(link({})).toBeNull();
    expect(link(null)).toBeNull();
  });
});

describe('new accounts', () => {
  it('get a 3 day trial and the verified email', () => {
    const t = setup();
    const r = t.accounts.signIn({ provider: 'email', subject: 'new@example.com', assertion: verifiedEmail('new@example.com') });
    expect(r).toMatchObject({ status: 'ok', isNewUser: true, linked: false });
    expect(r.user).toMatchObject({ id: 'uuid-1', email: 'new@example.com', subscription_status: 'trial' });
    expect(new Date(r.user.trial_end_date).getTime() - NOW).toBe(TRIAL_MS);
  });

  it('Apple private relay address: stored as the email, flagged verified', () => {
    const t = setup();
    const r = t.accounts.signIn({
      provider: 'apple', subject: 'apple-9',
      assertion: appleAssertion({ email: 'abc@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true' }),
      profile: { name: 'Ann Lee' },
    });
    expect(r.user).toMatchObject({ email: 'abc@privaterelay.appleid.com', name: 'Ann Lee' });
    expect(t.identities()[0]).toMatchObject({ provider: 'apple', email_verified: 1 });
  });

  it('Apple returning user: recognised by sub even when no email comes back', () => {
    const t = setup();
    const first = t.accounts.signIn({ provider: 'apple', subject: 'apple-9', assertion: appleAssertion({ email: 'ann@example.com', email_verified: true }) });
    const again = t.accounts.signIn({ provider: 'apple', subject: 'apple-9', assertion: appleAssertion({}) });
    expect(again.user.id).toBe(first.user.id);
    expect(again.isNewUser).toBe(false);
  });

  it('a stale identity (its account was deleted) is dropped and the sign-in starts afresh', () => {
    const t = setup();
    const first = t.accounts.signIn({ provider: 'email', subject: 'a@example.com', assertion: verifiedEmail('a@example.com') });
    t.db.prepare('DELETE FROM users WHERE id = ?').run(first.user.id);
    const again = t.accounts.signIn({ provider: 'email', subject: 'a@example.com', assertion: verifiedEmail('a@example.com') });
    expect(again).toMatchObject({ isNewUser: true });
    expect(again.user.id).not.toBe(first.user.id);
  });
});

describe('an email a provider does not vouch for (nOAuth, pre-hijacking)', () => {
  const WORK = '11111111-2222-3333-4444-555555555555';
  const unverifiedMs = email => microsoftAssertion({ email, tid: WORK });

  it('does NOT join the existing account that has that email, and does not create one', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'victim@example.com' });
    const r = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:attacker`, assertion: unverifiedMs('victim@example.com') });
    expect(r).toEqual({ status: 'blocked_unverified' });
    expect(t.userCount()).toBe(1);
    expect(t.identities()).toEqual([]);
  });

  it('with no existing account: creates one WITHOUT storing the unverified email', () => {
    const t = setup();
    const r = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:o1`, assertion: unverifiedMs('someone@corp.com'), profile: { name: 'Some One' } });
    expect(r.status).toBe('ok');
    expect(r.user.email).toBeNull();
    expect(t.identities()[0]).toMatchObject({ provider: 'microsoft', email: 'someone@corp.com', email_verified: 0 });
  });

  it('that unverified account is never a link target: the real owner signing up later gets their own account', () => {
    const t = setup();
    const attacker = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:attacker`, assertion: unverifiedMs('victim@example.com') });
    const victim = t.accounts.signIn({ provider: 'email', subject: 'victim@example.com', assertion: verifiedEmail('victim@example.com') });
    expect(victim.user.id).not.toBe(attacker.user.id);
    expect(victim.linked).toBe(false);
    // and the attacker's identity still points only at the attacker's account
    expect(t.accounts.findIdentity('microsoft', `${WORK}:attacker`).user_id).toBe(attacker.user.id);
  });

  it('an identity linked WITHOUT a verified email never lets a later email sign-in join it', () => {
    const t = setup();
    seedUser(t.db, { id: 'plain-uuid-user', email: 'x@example.com' }); // not legacy, no verified identity
    expect(t.accounts.linkTargetsForEmail('x@example.com')).toEqual([]);
  });

  it('work tenant WITH xms_edov may join by email', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'bob@corp.com' });
    const r = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:bob`, assertion: microsoftAssertion({ email: 'bob@corp.com', tid: WORK, xms_edov: true }) });
    expect(r.user.id).toBe(GOOGLE_SUB);
    expect(t.userCount()).toBe(1);
  });

  it('a known Microsoft identity signs in even though its email is unverified now', () => {
    const t = setup();
    const first = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:o1`, assertion: unverifiedMs('someone@corp.com') });
    const again = t.accounts.signIn({ provider: 'microsoft', subject: `${WORK}:o1`, assertion: unverifiedMs('changed@corp.com') });
    expect(again.user.id).toBe(first.user.id);
  });
});

describe('several accounts share an address', () => {
  it('joins the paying one', () => {
    const t = setup();
    seedUser(t.db, { id: '111111111111111111111', email: 'dup@example.com', created_at: '2026-01-01T00:00:00Z' });
    seedUser(t.db, { id: '222222222222222222222', email: 'dup@example.com', created_at: '2026-02-01T00:00:00Z', subscription_status: 'active' });
    const r = t.accounts.signIn({ provider: 'email', subject: 'dup@example.com', assertion: verifiedEmail('dup@example.com') });
    expect(r.user.id).toBe('222222222222222222222');
  });

  it('matching is case-insensitive against what Google stored', () => {
    const t = setup();
    seedUser(t.db, { id: GOOGLE_SUB, email: 'Ann@Example.COM' });
    const r = t.accounts.signIn({ provider: 'email', subject: 'ann@example.com', assertion: verifiedEmail('ann@example.com') });
    expect(r.user.id).toBe(GOOGLE_SUB);
  });
});

describe('googleAssertion feeds the hook the same way', () => {
  it('is verified only with email_verified', () => {
    expect(googleAssertion({ email: 'a@b.com', email_verified: true }).verified).toBe(true);
  });
});
