NEEDS HUMAN REVIEW

# WS9 draft: Refund Policy changes for the lifetime plan, gifts and referral credit

Status: DRAFT. Not published; `src/pages/RefundPage.tsx` has not been edited (and neither has the server-rendered copy of
it in `server.js`). Nothing here is legal advice. Every **OWNER DECISION PENDING** is a policy the owner must choose; the
code implements the "what happens to access" half of it (below), not the "who gets money back" half, which is done in
Paddle's dashboard.

## What the code does when Paddle reports a refund or chargeback

Paddle sends `adjustment.created` / `adjustment.updated` with `action` = `refund` or `chargeback`. The server acts only on
a **full refund once its status is `approved`**, and on a **chargeback** (any amount, unless Paddle marks it rejected or
reversed). A partial refund, a refund still pending approval, a rejected refund and a credit change nothing.

| Purchase | On a full approved refund or a chargeback |
|---|---|
| Lifetime plan | the lifetime grant is revoked at once; the account falls back to whatever else it has (trial, subscription, saved days, free plan or the paywall) |
| Gift, not yet redeemed | the code stops working |
| Gift, already redeemed | the code is revoked AND the recipient's gift days are revoked (running or saved) |
| First payment that earned a referral reward | the reward is taken back from BOTH accounts (running or saved); the referral is marked revoked and is not rewarded again |
| Monthly / yearly subscription | unchanged by this workstream: the existing handlers decide (a refund ends the subscription in Paddle, which sends `subscription.canceled`) |

Replaying the same event, or a second event for the same payment, changes nothing the second time.

**Known gaps** (also in `ws9-notes.md`): a `chargeback_reverse` (the bank sides with the customer afterwards) does not give
anything back automatically; a partial refund never revokes; a refund the owner issues by hand in Paddle's dashboard is
seen by the server exactly like any other refund.

## Proposed new sections for the Refund Policy

> **Lifetime plan**
> You may request a full refund of the Lifetime plan within **[OWNER DECISION PENDING: 14 / 30 days]** of payment. When a
> refund is issued, Lifetime access ends. **[OWNER DECISION PENDING: whether refunds are available only for the first
> Lifetime payment per person.]**

> **Gifts**
> A gift can be refunded within **[OWNER DECISION PENDING: 14 days]** of payment **if the gift link has not been redeemed**
> **[OWNER DECISION PENDING: or also after it was redeemed, in which case the recipient's access ends]**. Ask by email to
> hello@stopbiting.today from the address you paid with, with the Paddle transaction id. A refunded gift can no longer be
> redeemed.

> **Referral bonus access**
> Bonus access has no cash value and is not refundable. If the payment that earned it is refunded or charged back, the
> bonus access it earned is removed from both accounts.

> **Free trial wording**
> See `ws9-terms.md` section 0: the sentence "All new users receive a 3-day free trial" must be edited by hand when `TRIAL_DAYS`
> changes.

## Points for the reviewer

1. The existing policy gives a full refund "within 14 days of your initial subscription payment" and says refunds are
   available "for the first payment of a new subscription only". That wording does not cover a one-time payment: the
   Lifetime and Gift sections above fill the gap, and section 3 ("Refund Eligibility") should be reworded so a one-time
   purchase is not excluded by "subscription".
2. Consumer-law rights (for example a statutory withdrawal period for digital content in the EU and UK, and any waiver at
   checkout) are not addressed in this draft. Paddle, as merchant of record, applies its own buyer terms; check them.
3. Chargebacks are treated like refunds for access. Decide whether a chargeback should also close the account.
4. A gift refund after redemption takes access from a person who did nothing wrong. The default chosen in code is to
   revoke (so a refunded gift cannot be kept); if you prefer to let a redeemed gift stand, `gifts.revokeByTransaction` in
   `server/billing/gift.js` is the one place to change.
