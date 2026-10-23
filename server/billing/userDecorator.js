// What /api/user/me adds for the WS9 states.
//
// The row from `users` goes out as it always did. This adds ONE optional key, `entitlement`
// (shared/access.d.ts), and only when there is something to say:
//   * the account has a running lifetime / gift / referral-credit grant       -> grants
//   * it has saved gift or credit days waiting                                -> banked_days
//   * the `free_tier` flag is on                                              -> free_tier limits
// With none of those the user object is returned untouched, byte for byte, so an account without
// them (every account while the flags are off) sees the response it always saw.
//
// Saved days START here, lazily, the first time the account is looked at while nothing else gives it
// access (see entitlements.js). The decision uses the same function as the client
// (shared/access.js), so the server and the app cannot disagree about "nothing else".
//
// Flags do not gate grants: a lifetime buyer is reported as one whatever the flags say. Only the free
// tier, which is a product decision rather than something paid for, follows its flag.

import { evaluateAccess } from '../../shared/access.js';
import { freeTierLimits } from '../../shared/plans.js';

export function createUserDecorator({ entitlements, flags, env = process.env, now = Date.now }) {
  return function decorateUser(user) {
    if (!user) return user;
    const at = now();

    let grants = entitlements.running(user.id, at);
    let banked = entitlements.bankedDays(user.id);

    if (banked > 0) {
      const withoutBanked = evaluateAccess({ ...user, entitlement: { grants } }, at);
      if (withoutBanked.status === 'paywall' && entitlements.activateNext(user.id, at)) {
        grants = entitlements.running(user.id, at);
        banked = entitlements.bankedDays(user.id);
      }
    }

    const entitlement = {};
    if (grants.length) entitlement.grants = grants.map(g => ({ kind: g.kind, ends_at: g.ends_at ?? null }));
    if (banked > 0) entitlement.banked_days = banked;
    if (flags.isOn('free_tier')) {
      const limits = freeTierLimits(env);
      entitlement.free_tier = { detection_minutes_per_day: limits.detectionMinutesPerDay, history_days: limits.historyDays };
    }
    return Object.keys(entitlement).length ? { ...user, entitlement } : user;
  };
}
