// Accounts and identities for the extra sign-in methods.
//
// An ACCOUNT is a row in `users` (unchanged). An IDENTITY is one way of proving
// who you are: ('google', <sub>), ('email', <address>), ('apple', <sub>),
// ('microsoft', <tid>:<oid>). `auth_identities` maps identities to accounts, so
// one account can have several, and one person signing in two ways with the same
// verified email lands in ONE account.
//
// Existing Google users have no identity rows (the table is new) and do not need
// any: their `users.id` IS the Google subject. They are recognised by that, and
// their Google identity is recorded lazily, the first time another method links to
// them. The Google callback itself still looks users up by `users.id`, untouched.
//
// All decisions come from linkPolicy.js; this file only reads and writes.

import { randomUUID } from 'node:crypto';
import { TRIAL_MS } from '../../shared/plans.js';
import { normalizeEmail } from './emailAddress.js';
import { decideSignIn, googleAssertion, isLegacyGoogleUserId, pickLinkTarget } from './linkPolicy.js';

/** The trial new accounts get: the one TRIAL_DAYS constant (shared/plans.js), the same as the Google callback. */
export { TRIAL_MS };

export function createAccounts({ db, getUser, saveUser, now = Date.now, randomId = randomUUID, trialMs = TRIAL_MS }) {
  const selIdentity = db.prepare('SELECT * FROM auth_identities WHERE provider = ? AND provider_subject = ?');
  const insIdentity = db.prepare(`
    INSERT OR IGNORE INTO auth_identities (provider, provider_subject, user_id, email, email_verified, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const delIdentity = db.prepare('DELETE FROM auth_identities WHERE id = ?');
  const selUsersByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = ?');
  const selVerifiedBacking = db.prepare(
    'SELECT 1 FROM auth_identities WHERE user_id = ? AND email_verified = 1 AND lower(email) = ? LIMIT 1');

  function findIdentity(provider, subject) {
    return selIdentity.get(provider, subject) ?? null;
  }

  /** @returns {boolean} true if a row was written (false if the identity already existed) */
  function recordIdentity({ provider, subject, userId, email = null, verified = false }) {
    const res = insIdentity.run(provider, subject, userId, email, verified ? 1 : 0, new Date(now()).toISOString());
    return res.changes === 1;
  }

  /** Accounts that may be joined by a verified email: the address on them is itself vouched for. */
  function linkTargetsForEmail(email) {
    return selUsersByEmail.all(email).filter(u =>
      isLegacyGoogleUserId(u.id) || !!selVerifiedBacking.get(u.id, email));
  }

  function createUserRow({ email, name, avatar }) {
    const t = now();
    return saveUser({
      id: randomId(),
      email,
      name: name ?? null,
      avatar: avatar ?? null,
      trial_end_date: new Date(t + trialMs).toISOString(),
      subscription_status: 'trial',
      subscription_plan: null,
      subscription_end_date: null,
      paddle_subscription_id: null,
      paddle_customer_id: null,
      created_at: new Date(t).toISOString(),
    });
  }

  /** Records the Google identity of an existing Google user the first time it is needed. */
  function backfillGoogleIdentity(user) {
    if (!isLegacyGoogleUserId(user.id)) return;
    recordIdentity({ provider: 'google', subject: user.id, userId: user.id, email: normalizeEmail(user.email), verified: true });
  }

  const signInTx = db.transaction(({ provider, subject, assertion, profile }) => {
    let identity = findIdentity(provider, subject);
    if (identity && !getUser(identity.user_id)) {
      // The account was removed; the identity is stale. Forget it and decide afresh.
      delIdentity.run(identity.id);
      identity = null;
    }

    const email = assertion.email;
    const decision = decideSignIn({
      identityUserId: identity?.user_id ?? null,
      assertion,
      linkTargets: email && assertion.verified ? linkTargetsForEmail(email) : [],
      emailInUse: email ? selUsersByEmail.all(email).length > 0 : false,
    });

    if (decision.action === 'blocked_unverified') return { status: 'blocked_unverified' };

    if (decision.action === 'existing') {
      return { status: 'ok', user: getUser(decision.userId), isNewUser: false, linked: false };
    }

    if (decision.action === 'link') {
      const user = getUser(decision.userId);
      recordIdentity({ provider, subject, userId: user.id, email, verified: assertion.verified });
      backfillGoogleIdentity(user);
      return { status: 'ok', user, isNewUser: false, linked: true };
    }

    // create
    const user = createUserRow({
      email: decision.storeEmail ? email : null,
      name: profile?.name,
      avatar: profile?.avatar,
    });
    recordIdentity({ provider, subject, userId: user.id, email, verified: assertion.verified });
    return { status: 'ok', user, isNewUser: true, linked: false };
  });

  return {
    findIdentity,
    recordIdentity,
    linkTargetsForEmail,

    /**
     * Signs a person in with an identity the provider has proven, creating or
     * joining an account as linkPolicy decides.
     *
     * @param {object} input
     * @param {string} input.provider   'email' | 'apple' | 'microsoft'
     * @param {string} input.subject    the provider's stable id for this person
     * @param {{ email: string | null, verified: boolean }} input.assertion
     * @param {{ name?: string | null, avatar?: string | null }} [input.profile]
     * @returns {{ status: 'ok', user: object, isNewUser: boolean, linked: boolean } | { status: 'blocked_unverified' }}
     */
    signIn(input) {
      return signInTx(input);
    },

    /**
     * The hook for the Google callback (server.js calls it only when no user
     * has the Google subject as id, i.e. never for an existing Google user).
     * Joins a Google sign-in to an account made with another method when Google
     * vouches for the same email, or when this Google identity was linked before.
     * Never joins another Google account, so Google-only behaviour is unchanged.
     * @returns the user row, or null (the callback then creates a user exactly as before)
     */
    linkGoogleSignIn(payload) {
      const subject = typeof payload?.sub === 'string' ? payload.sub : null;
      if (!subject) return null;
      return db.transaction(() => {
        const identity = findIdentity('google', subject);
        if (identity) return getUser(identity.user_id);

        const assertion = googleAssertion(payload);
        if (!assertion.email || !assertion.verified) return null;
        const targets = linkTargetsForEmail(assertion.email).filter(u => !isLegacyGoogleUserId(u.id));
        if (targets.length === 0) return null;
        const user = getUser(pickLinkTarget(targets).id);
        recordIdentity({ provider: 'google', subject, userId: user.id, email: assertion.email, verified: true });
        return user;
      })();
    },
  };
}
