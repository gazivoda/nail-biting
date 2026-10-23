import type { UserProfile, AccessStatus } from '../types/access';
import { evaluateAccess, type Access } from '../../shared/access.js';

/**
 * Decides what a signed-in user can reach.
 *
 * `subscription_status` is authoritative: it is only ever written server-side by
 * the signature-verified Paddle webhook or the verify-subscription endpoint, and
 * the server moves it off 'active' itself on cancellation and payment failure.
 *
 * `subscription_end_date` is deliberately NOT a gate for active subscriptions.
 * The server fills it from Paddle's `current_billing_period.ends_at` or
 * `next_billed_at`, and stores null when neither is present — so requiring it
 * locked out anyone whose webhook payload omitted both. Worse, it holds the end
 * of the *current* billing period, so it falls into the past on every renewal
 * until a webhook refreshes it: a delayed or dropped renewal webhook paywalled a
 * customer who was still being charged.
 *
 * The remaining failure mode is the opposite one — a missed downgrade webhook
 * leaves access on slightly too long. That is the right direction to fail.
 *
 * WS9 added lifetime, gift and referral-credit grants and the free tier. They
 * arrive as `user.entitlement` (see shared/access.js for the order the states are
 * tried in) and are absent for every account that has none, which then gets the
 * answer it always got: the matrix test in access.test.ts pins that.
 */
export function computeAccessStatus(
  user: UserProfile,
  now: number = Date.now(),
): Exclude<AccessStatus, 'loading'> {
  return evaluateAccess(user, now).status;
}

/**
 * The same decision with the reason attached: what grants access (`source`) and until
 * when. Screens that word the plan ("Lifetime", "Gift", "Referral credit") read this.
 * The rules live in shared/access.js so the server judges an account the same way.
 */
export function computeAccess(user: UserProfile, now: number = Date.now()): Access {
  return evaluateAccess(user, now);
}
