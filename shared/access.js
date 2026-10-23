// What a signed-in account may reach: the one function behind both the client
// (src/utils/access.ts, which the app router reads) and the server
// (server/billing/entitlements.js, which decides what /api/user/me reports).
// Plain JavaScript with a hand-written access.d.ts, like shared/plans.js.
//
// The states, in the order they are tried:
//
//   1. subscribed   a Paddle subscription that is active or paused (monthly / yearly)
//   2. subscribed   a local grant that is running now: lifetime, gift, referral credit
//   3. trial_active the free trial, until trial_end_date
//   4. free_tier    the free tier, ONLY when the account carries free-tier limits
//   5. paywall      expired: none of the above
//
// A paid subscription is judged exactly as it always was: `subscription_status`
// is authoritative and `subscription_end_date` is deliberately not a gate (see
// the long comment in src/utils/access.ts). Steps 2 and 4 read `user.entitlement`,
// which the server adds to /api/user/me only when the account has a running grant
// or the `free_tier` flag is on. An account without it goes through steps 1, 3
// and 5 and gets the answer it always got (src/utils/access.test.ts pins this over
// every combination of the fields those steps read).
//
// Flags decide who is SOLD something and what the server REPORTS; they never decide
// whether a grant that was paid for is honoured: a lifetime buyer keeps access
// the day the owner turns `lifetime_plan` off.

const GRANT_ORDER = ['lifetime', 'gift', 'referral_credit'];

/** True while a grant is running: no end (lifetime) or an end in the future. */
export function grantIsRunning(grant, now = Date.now()) {
  if (!grant || !GRANT_ORDER.includes(grant.kind)) return false;
  if (grant.ends_at === null || grant.ends_at === undefined) return true;
  const end = new Date(grant.ends_at).getTime();
  return Number.isFinite(end) && end > now;
}

/** The running grant that counts: lifetime first, then gift, then referral credit; the later end wins within a kind. */
export function bestGrant(entitlement, now = Date.now()) {
  const running = (entitlement?.grants ?? []).filter(g => grantIsRunning(g, now));
  running.sort((a, b) => {
    const byKind = GRANT_ORDER.indexOf(a.kind) - GRANT_ORDER.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    const ea = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
    const eb = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
    return eb - ea;
  });
  return running[0] ?? null;
}

/**
 * @param user  { trial_end_date, subscription_status, subscription_plan?, entitlement? }
 * @returns { status, source, until, limits? }
 *   status   'subscribed' | 'trial_active' | 'free_tier' | 'paywall'  (what the app router switches on)
 *   source   what grants it: 'monthly' | 'yearly' | 'subscription' | 'lifetime' | 'gift' | 'referral_credit'
 *            | 'trial' | 'free_tier' | 'expired'
 *   until    ISO end of the access when it has one, else null (lifetime, an open subscription, free tier)
 */
export function evaluateAccess(user, now = Date.now()) {
  if (user.subscription_status === 'active' || user.subscription_status === 'paused') {
    const source = user.subscription_plan === 'yearly' || user.subscription_plan === 'monthly' ? user.subscription_plan : 'subscription';
    return { status: 'subscribed', source, until: user.subscription_end_date ?? null };
  }

  const grant = bestGrant(user.entitlement, now);
  if (grant) return { status: 'subscribed', source: grant.kind, until: grant.ends_at ?? null };

  if (
    user.trial_end_date &&
    new Date(user.trial_end_date).getTime() > now &&
    user.subscription_status !== 'expired' &&
    user.subscription_status !== 'cancelled'
  ) {
    return { status: 'trial_active', source: 'trial', until: user.trial_end_date };
  }

  const free = user.entitlement?.free_tier;
  if (free && typeof free === 'object') {
    return { status: 'free_tier', source: 'free_tier', until: null, limits: free };
  }

  return { status: 'paywall', source: 'expired', until: null };
}
