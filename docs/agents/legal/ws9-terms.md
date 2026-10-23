NEEDS HUMAN REVIEW

# WS9 draft: Terms and Conditions changes for the lifetime plan, gifts, referrals, the free plan and the trial length

Status: DRAFT. Not published. `src/pages/TermsPage.tsx`, `RefundPage.tsx`, `PrivacyPage.tsx` and `LegalPage.tsx` have not
been edited. Publish each part together with turning on its flag (`lifetime_plan`, `gift_plan`, `referrals`,
`free_tier`). Nothing here is legal advice; every number marked **OWNER DECISION PENDING** is the owner's to set, and the
code reads it from the environment (`docs/agents/ws9-notes.md`).

## 0. If the trial length changes (`TRIAL_DAYS`)

The trial length is one setting (`TRIAL_DAYS`, default 3) and every page and email follows it, with two exceptions this
workstream was not allowed to touch:

- `src/pages/TermsPage.tsx`, section 3: *"New users receive a 3-day free trial ..."*
- `src/pages/RefundPage.tsx`, section 2: *"All new users receive a 3-day free trial ..."*
- and the server-rendered copy of the refund policy in `server.js` (the `/refund-policy` article summary: *"All new users get a 3-day free trial ..."*).

When the owner changes `TRIAL_DAYS`, these three sentences must be changed by hand (they are the only places that still
spell the number; `scripts/trialLength.test.mjs` lists them as `legal`). Suggested wording that never needs editing again:
*"New users receive a free trial with full access to all features. The length of the trial is stated on our Pricing page
and in the app. No credit card is required."*

## 1. New section for Terms: "Lifetime plan" (flag `lifetime_plan`)

> **Lifetime plan**
> The Lifetime plan is a one-time payment. It gives you access to the features of the monthly plan for as long as Stop
> Biting is offered, without further payments. It is personal to the account it was bought for and cannot be transferred
> or resold. "As long as Stop Biting is offered" means we may stop offering the Service; if we do, we will tell you in
> advance by email and **[OWNER DECISION PENDING: refund the part of the payment that covers the period you did not get /
> keep access for 12 months / other]**. The Lifetime plan does not include any new product we launch separately.
> Lifetime access is added to your account when Paddle confirms the payment, which is usually within a minute. Paddle is the
> merchant of record and handles the payment, taxes and receipts.

Points for the reviewer:
1. "Lifetime" is a marketing word with legal weight in some countries. The sentence about stopping the Service is the
   honest limit; the owner must choose the remedy in the brackets.
2. The plan includes what the monthly plan includes (`PLAN_FEATURES` in `src/components/site/plans.ts`), not "Priority
   support" (yearly only). Decide whether Lifetime should include it, and change the copy and this section together.
3. The price is created in Paddle, not in code. The site shows what Paddle reports, or "Price shown at checkout".

## 2. New section for Terms: "Gifts" (flag `gift_plan`)

> **Gifts**
> You can buy a gift of **[OWNER DECISION PENDING: one year; the length is the product you create in Paddle and the
> variable `GIFT_PLAN_DAYS`]** of Stop Biting for someone else. After payment we email a link to the address you paid with.
> Whoever opens the link and redeems it while signed in gets the gift; the link works once, so send it only to the person
> you mean to give it to, and keep it private until then. We cannot replace a link that was forwarded to, or redeemed by,
> someone else. The gift starts when the person who redeemed it has no other access to the Service (no trial, no active
> subscription, no Lifetime plan), and runs for its full length from that moment. **[OWNER DECISION PENDING: a gift link
> expires N days after purchase / never expires.]** A gift has no cash value, cannot be exchanged for money, and is not a
> subscription: it does not renew and no card is kept for it.

Points for the reviewer:
1. "Anyone who has the link can redeem it" is how it works (bearer code). The email says the same in plain words.
2. If the email does not arrive, the code cannot be read back (only a hash is stored); the purchase retries until the email
   is accepted, but a lost or forwarded link is a support case. Decide the policy.
3. Redemption by the buyer for their own account is allowed by the code. Say so, or forbid it.

## 3. New section for Terms: "Referral program" (flag `referrals`)

> **Referral program**
> You can share a personal link. When a new user who signed up through your link makes their first payment for Stop Biting,
> both of you receive **[OWNER DECISION PENDING: 30 days; variable `REFERRAL_CREDIT_DAYS`]** of bonus access. Bonus access
> is saved on your account and starts automatically when you have no trial, subscription or other access running. It
> has no cash value, is not transferable, and does not change, pause or credit any subscription you have with Paddle. A
> referral counts once per new user and only for that user's first payment. We do not give bonus access for payments that
> are refunded or charged back, and we take back bonus access given for a payment that is later refunded or charged back.
> We do not give it for referring yourself, for accounts that share your email address (ignoring dots and "+" tags), your
> payment method or your Paddle customer record, or where we reasonably think the program is being abused. We may change or
> end the program at any time; bonus access already earned is not removed except as described here.

Points for the reviewer:
1. The checks (same user, same normalised email, same Paddle customer, same card type + last four digits + expiry) are
   listed in `docs/agents/ws9-notes.md` with their limits. The wording above names them so that a refused reward is
   explainable; remove any you would rather not disclose.
2. Referral links are stored in the visitor's browser (local storage, key `sb:billing:pending-referral`, 30 days) and the
   code is sent to our server once, after sign-up. **Privacy Policy impact:** add that the referral link code is stored in
   the browser, that we store the relationship between the two accounts, and that for a reward we process a hash of the
   card type, last four digits and expiry that Paddle reports for the payment (never the card number). See section 6 below.
3. Both accounts see only their own count ("N people have paid through your link"), never who.

## 4. New section for Terms: "Free plan" (flag `free_tier`)

> **Free plan**
> After a free trial ends, you may continue on the free plan **[OWNER DECISION PENDING: with detection for up to 30 minutes
> a day and the last 7 days of history shown; variables `FREE_TIER_DETECTION_MINUTES` and `FREE_TIER_HISTORY_DAYS`]**. Your
> older history stays on your device and is shown again if you subscribe. We may change the limits of the free plan; we
> will tell you in the app first.

The daily allowance is counted in the browser on the device being used. Say so if you want it in the Terms: it can be
reset by clearing site data, and the Terms need not promise otherwise.

## 5. Prices in local currency (flag `regional_pricing`)

If the pricing section shows local prices, add to Terms section 4 ("Subscriptions and Billing"): *"Prices are shown in your
local currency where Paddle supports it and include or exclude taxes as Paddle shows at checkout. The amount at checkout is
the amount you pay."* The USD list prices ($2.99 a month, $29 a year) stay in the Terms until the owner decides otherwise.

## 6. Privacy Policy additions (to be merged into the Privacy Policy review; there is no separate privacy draft for WS9)

- Referral: link code kept in the browser (30 days); server stores referral code per account, who referred whom, the
  reward status, and a hash of card type + last four + expiry per payment of this product, for fraud checks. Kept as long
  as the account exists. Not shared.
- Gifts: we store the buyer's email address (from Paddle) with the gift, a hash of the code, and who redeemed it and when.
  The code is never in a URL that reaches our servers (it is in the link's fragment).
- Payments: Paddle sends us payment events (identifiers and totals, never card numbers) and we store the transaction id,
  your account id and the Paddle customer id for each payment of this product.
- Analytics: nothing new; the new surfaces send no analytics events.
