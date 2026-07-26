import type { UserProfile, AccessStatus } from '../types/access';

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
 */
export function computeAccessStatus(
  user: UserProfile,
  now: number = Date.now(),
): Exclude<AccessStatus, 'loading'> {
  if (user.subscription_status === 'active' || user.subscription_status === 'paused') {
    return 'subscribed';
  }

  if (
    user.trial_end_date &&
    new Date(user.trial_end_date).getTime() > now &&
    user.subscription_status !== 'expired' &&
    user.subscription_status !== 'cancelled'
  ) {
    return 'trial_active';
  }

  return 'paywall';
}
