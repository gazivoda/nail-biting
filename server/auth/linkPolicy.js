// When may a new sign-in method join an existing account? (pure functions)
//
// The rule, in one sentence: a sign-in attaches to an existing account by email
// ONLY when the identity provider vouches that the person controls that address
// AND the address on the existing account was itself vouched for. Anything less
// is a different person until proven otherwise.
//
// Why so strict: if "same email string" were enough, anyone able to put
// someone else's address in a provider profile (Microsoft work/school tenants
// can; this is the "nOAuth" problem) could walk into that person's account.
// And if an unverified sign-up could become a link target later, an attacker
// could pre-create an account for a victim's address and keep a way in after the
// victim signs up properly ("pre-hijacking"). So accounts only count as link
// targets while their email is backed by a verified assertion, and an unverified
// sign-in never stores its address on the account at all.
//
// Nothing here touches the database; server/auth/accounts.js applies the
// decisions. Everything is covered by linkPolicy.test.js.

import { normalizeEmail } from './emailAddress.js';

/** Microsoft's fixed tenant id for personal (consumer) Microsoft accounts. */
export const MS_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

/** Claims arrive as true, "true", 1 or "1" depending on provider and token path. */
export function truthy(value) {
  return value === true || value === 1 || value === 'true' || value === '1';
}

/**
 * Google ID token payload -> what Google vouches for.
 * @returns {{ email: string | null, verified: boolean }}
 */
export function googleAssertion(payload) {
  const email = normalizeEmail(payload?.email);
  return { email, verified: !!email && truthy(payload?.email_verified) };
}

/**
 * Apple ID token claims. Apple only returns addresses it has verified, but the
 * claim is still checked. `is_private_email` is not always present, so the relay
 * domain is checked too. A relay address is a real, working mailbox that forwards
 * to the person, so it may link by email like any verified address.
 * @returns {{ email: string | null, verified: boolean, isRelay: boolean }}
 */
export function appleAssertion(claims) {
  const email = normalizeEmail(claims?.email);
  const isRelay = truthy(claims?.is_private_email) || (!!email && email.endsWith(APPLE_RELAY_SUFFIX));
  return { email, verified: !!email && truthy(claims?.email_verified), isRelay };
}

/**
 * Microsoft ID token claims. The `email` claim is NOT proof of anything: for
 * work or school accounts an administrator can set it to any value, and
 * Microsoft documents it as "not guaranteed to be correct and mutable". It
 * counts as verified only when
 *   1. the sign-in was to the personal Microsoft account tenant (tid is the fixed
 *      consumer tenant id; the issuer check in microsoft.js guarantees tid is the
 *      one Microsoft signed), or
 *   2. Microsoft itself says the email's domain owner is verified: the optional
 *      `xms_edov` claim (the owner must add it in the app registration).
 * Otherwise the address is only a hint and must not be used to join an account.
 * @returns {{ email: string | null, verified: boolean, reason: 'personal_account' | 'xms_edov' | 'unverified' | 'no_email' }}
 */
export function microsoftAssertion(claims) {
  const email = normalizeEmail(claims?.email);
  if (!email) return { email: null, verified: false, reason: 'no_email' };
  if (claims?.tid === MS_PERSONAL_TENANT) return { email, verified: true, reason: 'personal_account' };
  if (truthy(claims?.xms_edov)) return { email, verified: true, reason: 'xms_edov' };
  return { email, verified: false, reason: 'unverified' };
}

/** Google subject ids are decimal strings; every other user id is a uuid. */
export function isLegacyGoogleUserId(id) {
  return typeof id === 'string' && /^\d+$/.test(id);
}

/**
 * Which of several accounts sharing an address should a sign-in join? Paying
 * accounts first, then the oldest. Deterministic, so two requests agree.
 * @param {Array<{ id: string, subscription_status?: string, created_at?: string }>} users
 */
export function pickLinkTarget(users) {
  if (!users || users.length === 0) return null;
  const rank = u => (u.subscription_status === 'active' || u.subscription_status === 'paused' ? 0 : 1);
  return [...users].sort((a, b) =>
    rank(a) - rank(b)
    || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    || String(a.id).localeCompare(String(b.id)),
  )[0];
}

/**
 * The decision for one sign-in.
 *
 * @param {object} input
 * @param {string | null} input.identityUserId  user already attached to this exact provider identity
 * @param {{ email: string | null, verified: boolean }} input.assertion
 * @param {Array} input.linkTargets   accounts with this email whose email is itself verified-backed
 * @param {boolean} input.emailInUse  ANY account has this email (verified-backed or not)
 * @returns {{ action: 'existing', userId: string }
 *   | { action: 'link', userId: string }
 *   | { action: 'create', storeEmail: boolean }
 *   | { action: 'blocked_unverified' }}
 *   `storeEmail` says whether the new account may carry the address: only when verified.
 */
export function decideSignIn({ identityUserId, assertion, linkTargets, emailInUse }) {
  if (identityUserId) return { action: 'existing', userId: identityUserId };

  if (assertion.email && assertion.verified) {
    const target = pickLinkTarget(linkTargets);
    if (target) return { action: 'link', userId: target.id };
    return { action: 'create', storeEmail: true };
  }

  // Not vouched for. Never join an account on it, and never let it shadow one.
  if (assertion.email && emailInUse) return { action: 'blocked_unverified' };
  return { action: 'create', storeEmail: false };
}
