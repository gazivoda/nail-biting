// What the billing code reads from the environment, in one place.
//
// Server-side variables (runtime):
//   PADDLE_PRICE_ID_LIFETIME / PADDLE_PRICE_ID_GIFT   the two one-time prices (created in Paddle by the owner)
//   PADDLE_PRICE_IDS                                  every price id of THIS app, comma or space separated.
//                                                     Needed because the Paddle account is shared with another
//                                                     product (see the Paddle filter patch in the notes). The
//                                                     lifetime and gift ids MUST be in it once it is set.
//   PADDLE_PRICE_ID_MONTHLY / PADDLE_PRICE_ID_YEARLY  optional here, accepted as part of "ours" as well
//                                                     (the VITE_ spellings are read too, when present at runtime)
//   PADDLE_API_KEY, VITE_PADDLE_ENV or PADDLE_ENV     as server.js uses them
//   REFERRAL_CREDIT_DAYS, GIFT_PLAN_DAYS, GIFT_CODE_EXPIRY_DAYS, FREE_TIER_*   see shared/plans.js
//
// "Ours": the referral reward is paid when a payment completes, so the code must be SURE the payment
// was for this app. It is only sure when at least one price id is configured and the transaction carries
// one of them. With none configured nothing is rewarded (the safe direction on a shared account).

import { giftCodeExpiryDays, giftDays, referralCreditDays } from '../../shared/plans.js';

const list = value => String(value ?? '').split(/[\s,]+/).filter(Boolean);
const one = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

export function billingConfig(env = process.env) {
  const lifetime = one(env.PADDLE_PRICE_ID_LIFETIME);
  const gift = one(env.PADDLE_PRICE_ID_GIFT);
  const ours = new Set([
    ...list(env.PADDLE_PRICE_IDS),
    ...[env.PADDLE_PRICE_ID_MONTHLY, env.PADDLE_PRICE_ID_YEARLY, env.VITE_PADDLE_PRICE_ID_MONTHLY, env.VITE_PADDLE_PRICE_ID_YEARLY]
      .map(one).filter(Boolean),
    ...(lifetime ? [lifetime] : []),
    ...(gift ? [gift] : []),
  ]);
  const production = (env.VITE_PADDLE_ENV || env.PADDLE_ENV) === 'production';
  return {
    lifetimePriceId: lifetime,
    giftPriceId: gift,
    ourPriceIds: ours,
    referralCreditDays: referralCreditDays(env),
    giftDays: giftDays(env),
    giftCodeExpiryDays: giftCodeExpiryDays(env),
    paddleApi: production ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com',
    paddleApiKey: one(env.PADDLE_API_KEY),
  };
}

/** Names of the variables that are listed in PADDLE_PRICE_IDS' scope but missing from it. For a boot-time warning. */
export function priceIdsMissingFromFilter(env = process.env) {
  const filter = new Set(list(env.PADDLE_PRICE_IDS));
  if (filter.size === 0) return [];
  return [['PADDLE_PRICE_ID_LIFETIME', one(env.PADDLE_PRICE_ID_LIFETIME)], ['PADDLE_PRICE_ID_GIFT', one(env.PADDLE_PRICE_ID_GIFT)]]
    .filter(([, id]) => id && !filter.has(id)).map(([name]) => name);
}
