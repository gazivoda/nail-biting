# WS9 (Pricing, trial, referrals) — notes

One trial-length constant, a free tier, a lifetime plan, gift purchases, a referral program and localized prices.
Every user-facing part is behind a flag (all off). **Nothing was run against a real Paddle account**: see
"What is and is not verified" at the end. Legal drafts: `docs/agents/legal/ws9-terms.md`, `ws9-refund.md`
(NEEDS HUMAN REVIEW).

## Owner decisions still pending (everything is configurable, safe defaults)

| Decision | Default now | Where to set it |
|---|---|---|
| Trial length (the plan proposes 7) | **3 days** | `TRIAL_DAYS` (build AND runtime), see "Trial length" |
| Free-tier limits | 30 minutes of detection a day, last 7 days of history (placeholders) | `FREE_TIER_DETECTION_MINUTES`, `FREE_TIER_HISTORY_DAYS` (runtime) |
| Referral reward | 30 days for each side | `REFERRAL_CREDIT_DAYS` (runtime) |
| Gift length | 365 days (the Paddle gift price must match) | `GIFT_PLAN_DAYS` (runtime) |
| Gift link expiry | never | `GIFT_CODE_EXPIRY_DAYS` (runtime) |
| When bonus days (gift, referral) start | when the account has no other access (saved until then) | `server/billing/entitlements.js` header comment; see "Access" |
| What a refunded gift does after it was redeemed | the recipient loses it | `gifts.revokeByTransaction` in `server/billing/gift.js` |
| Wording of "Lifetime", gift, referral, refund terms | drafts | `docs/agents/legal/` |
| The Lifetime and Gift prices | not in code | created in Paddle by the owner |

## What exists

| | |
|---|---|
| Shared numbers | `shared/plans.js` (+ `plans.d.ts`): `TRIAL_DAYS`, `TRIAL_MS`, the copy tokens, free-tier limits, referral and gift numbers |
| One access decision | `shared/access.js` (+ `.d.ts`): states trial, monthly, yearly, lifetime, gift, referral credit, free tier, expired. `src/utils/access.ts` (`computeAccessStatus`, `computeAccess`) and the server both call it |
| Server | `server/billing/` (`schema`, `config`, `paddleData`, `entitlements`, `gift`, `giftEmail`, `referrals`, `purchases`, `webhook`, `userDecorator`), route module `server/routes/billing.js` (registered in `server/routes/index.js`) |
| Tables (additive, migration ids `ws9_001..006`) | `paddle_events`, `billing_transactions`, `entitlements`, `gift_codes`, `referral_codes`, `referrals`. `users` is untouched |
| Client | `src/billing/` (env, Paddle loader, localized prices, referral and gift-code storage, free-tier meter, plan wording), `src/components/billing/` (`PlanExtras`, `LifetimePlate`, `ReferralCard`, `FreeTierNotice`, `BillingHost`), `src/pages/RedeemPage.tsx` |
| Tests | `shared/*.test.js`, `scripts/trialLength.test.mjs`, `server/billing/*.test.js`, `server/routes/billing.test.js`, `scripts/billingWebhook.test.mjs` (real `server.js`), `src/billing/billing.test.ts`, extended `src/utils/access.test.ts`; helper `test-utils/billingHarness.js` |
| Flags | `free_tier`, `lifetime_plan`, `gift_plan`, `referrals`, `regional_pricing` (registered by WS0) |

### Routes (all 404 while their flag is off)

| Route | Flag | |
|---|---|---|
| `GET /api/referrals/me` | `referrals` | my code, link, counts |
| `POST /api/referrals/attach` `{code}` | `referrals` | tie a NEW account (under 7 days old, nothing paid) to a link; answers `{ok}` or `{ok:false, reason}` |
| `GET /api/billing/gift-info` | `gift_plan` | `{days}`; public; the copy says "one year" from it |
| `POST /api/billing/gift/redeem` `{code}` | `gift_plan` | single use; 10 tries per 15 minutes per address |
| `POST /api/billing/verify-transaction` `{transactionId}` | `lifetime_plan` | fallback after checkout: asks Paddle for the payment and runs the webhook's handler (only for the caller's own payment) |
| `GET /redeem` | `gift_plan` | the app shell, `noindex`, with the gift code moved out of the address bar; the normal branded 404 while off |

Two things on `app.locals` are read by the existing handlers in `server.js`: `billingWebhook.take(event, res)` (webhook) and
`decorateUser(user)` (`GET /api/user/me`). With every flag off and no grants, `/api/user/me` is exactly the users row
(`scripts/billingWebhook.test.mjs` pins it).

## Trial length: one constant

`TRIAL_DAYS` in `shared/plans.js`. Default **3**; **OWNER DECISION PENDING** (the plan proposes 7).

* Read from `process.env.TRIAL_DAYS` when the module is first imported: whole number 1 to 90, anything else is ignored
  (and the server logs it at boot). It is used by: new accounts (`server.js` Google callback, `server/auth/accounts.js`
  `TRIAL_MS`), every server-rendered page and schema, `index.html` (placeholders, filled by a Vite transform), the client
  bundle (`vite.config.ts` `define`), `dist/seo-content.json`, `dist/llms-full.txt`, blog and compare copy.
* `email.js` and `trialFollowup.js` contain no trial length (they read `trial_end_date`; the 7 in `trialFollowup.js` is the
  "who is still worth emailing" window), and neither does `src/utils/trial.ts` (`trialLeft` counts from the end date).
  Nothing to change there; the guard test covers them.
* Copy spells the length with `${TRIAL_HYPHEN}` ("3-day"), `${TRIAL_DAYS_TEXT}` ("3 days"), `${TRIAL_WORD_HYPHEN}`,
  `${TRIAL_WORDS}`, `${TRIAL_WORDS_CAP}`, and `{{...}}` in `index.html`. `scripts/sync-seo.mjs` fills the same tokens in the
  source text before any of its extractors run (fingerprints, llms.txt, mirror checks), which is why `npm run seo:check`
  passes with no `seo:sync` after the swap.
* `scripts/trialLength.test.mjs` fails when a literal trial length appears anywhere else. Its `ALLOWED` list is the
  record of what was left alone on purpose:
  * competitor facts: Hands Off's "3 days free" (several places in `competitorPages.ts`, `comparePages.ts`, `blogPosts.ts`,
    `server.js` COMPARE_META) and HabitCam's 7-day trial;
  * **sentences about both products** ("each with a 3-day free trial", "identically ... with a 3-day free trial",
    "Both offer a 3-day free trial", and `server.js` "price, privacy, 3-day trials" in the Hands Off meta description).
    They are true only while our trial equals Hands Off's. **If you change `TRIAL_DAYS`, rewrite these four by hand
    (WS11b).** The 7-day build shows the rest of the site moving and these staying at 3, on purpose;
  * the legal pages: `TermsPage.tsx` section 3, `RefundPage.tsx` section 2 and the matching `/refund-policy` article summary
    in `server.js`. Edit by hand with the legal review (`ws9-terms.md` section 0 has wording that needs no number).

### How to change the trial length

1. Coolify: add `TRIAL_DAYS=7` as a **build** variable (Docker build arg; the Dockerfile has `ARG TRIAL_DAYS`) AND as a
   **runtime** variable. A line in `.env` is not enough.
2. Locally: `TRIAL_DAYS=7 npm run seo:sync`, review and commit `public/llms.txt`, `public/sitemap.xml`,
   `src/data/pageUpdates.json` (the pages whose visible text changed get a new `lastmod`. Plainly: because `sync-seo` fills the tokens with the CURRENT
   `TRIAL_DAYS` in every commit it looks at, it finds the same text back to the commit that introduced the tokens, so that
   `lastmod` is the date of that commit, not the date of the deploy. It is an older-than-true date, not a freshness claim
   that is false; edit `src/data/pageUpdates.json` by hand if you want today's date on them). `seo:check`
   reports exactly these as stale until you do; the Docker build does not run it.
3. Hand-edit the four shared sentences and the three legal sentences above, deploy.
4. At boot the server warns when `dist` was built with a different `TRIAL_DAYS` than it runs with.

## Access: how every state is decided

Tried in this order (`shared/access.js`): active or paused Paddle subscription (monthly, yearly) -> running grant
(lifetime, then gift, then referral credit) -> trial (unchanged rule) -> free tier (only if the account carries the limits)
-> expired/paywall. `src/utils/access.test.ts` pins that for every combination of the fields the old function read the
answer is unchanged, and covers each new state and precedence.

* **Flags decide who is sold something and what the server reports, never whether a paid-for grant is honoured.** A
  lifetime payment is granted whenever its price id is configured, even with `lifetime_plan` off; a refund still revokes it.
* Grants live in `entitlements`, not in `users`, so `subscription.canceled` or a payment failure cannot overwrite a
  lifetime buyer, and `saveUser` cannot clobber them.
* **Gift and referral days are saved and start when the account has no other access** (no subscription, no trial, no lifetime,
  no running grant); the oldest block starts first and runs for exactly its days from that moment. The first
  `/api/user/me` after the access lapses starts it. OWNER DECISION PENDING: the alternative (start at the moment of
  the grant) would spend a paying referrer's reward on a month they are already paying for.
* `/api/user/me` gets an optional `entitlement` key: `grants` (running), `banked_days` (saved), `free_tier` (limits, only
  while that flag is on). Absent when there is nothing to say.
* Free tier: detection minutes are counted **in the browser** (detection runs there) per local day, and the camera is
  switched off when the day's allowance is used; History lists the last N days (older entries stay on the device,
  statistics and streaks use everything). It can be reset by clearing site data; there is no server-side enforcement to
  bypass because the server never sees detection. `trialFollowup.js` skips accounts that have any grant.

## Paddle: what the owner must do (human)

1. **Create the products and prices** (sandbox first): Lifetime (one-time, any currency set) and Gift (one-time; its
   duration is what you will promise, then set `GIFT_PLAN_DAYS` to match). Note the `pri_...` ids.
2. **Notification destination:** the webhook must also be sent `transaction.completed`, `adjustment.created` and
   `adjustment.updated` (the existing destination was probably created for `subscription.*` and
   `transaction.payment_failed` only). Without them lifetime, gifts, referral rewards and refunds do nothing.
3. **Environment** (Coolify). Build arguments: `VITE_PADDLE_PRICE_ID_LIFETIME`, `VITE_PADDLE_PRICE_ID_GIFT` (the app shows
   the options only when its id is present), `TRIAL_DAYS` if changed. Runtime: `PADDLE_PRICE_ID_LIFETIME`,
   `PADDLE_PRICE_ID_GIFT`, **`PADDLE_PRICE_ID_MONTHLY` and `PADDLE_PRICE_ID_YEARLY`** (or `PADDLE_PRICE_IDS`; the `VITE_` ones
   are build arguments and are not in the running server's environment, and without the server-side names no monthly or yearly
   payment is recognised as ours, so no referral is ever rewarded; the server warns at boot), `PADDLE_API_KEY` (needed to look
   up the email of a gift buyer who is not signed in, and for verify-transaction),
   `REFERRAL_CREDIT_DAYS`, `GIFT_PLAN_DAYS`, `GIFT_CODE_EXPIRY_DAYS`, `FREE_TIER_*`, `TRIAL_DAYS`, and the Paddle filter below.
   `EMAIL_FROM` on a domain verified in Resend, or no gift email reaches anybody but you.
4. **The shared Paddle account:** the owner's uncommitted patch (`PADDLE_PRICE_IDS`, `isOurPaddleData`) is compatible
   (`git apply --check` passes on this branch). When you apply it: **list the lifetime and gift ids in `PADDLE_PRICE_IDS`**
   along with monthly and yearly (and archived ones). The WS9 hook runs before that filter and recognises its own two ids
   from `PADDLE_PRICE_ID_LIFETIME` / `_GIFT`, so a purchase is not lost if you forget, but the server logs a warning at boot
   and referral rewards need every price of ours to be known (a payment is only rewarded when its price is positively one of
   ours: `PADDLE_PRICE_IDS` and the price-id variables; with none configured nothing is rewarded).
5. **Regional pricing:** enable localized pricing in Paddle, then the `regional_pricing` flag. Needs `VITE_PADDLE_CLIENT_TOKEN`
   and the monthly/yearly price ids in the build (as the paywall already does).
6. Turn flags on one at a time (`FEATURE_FLAGS=lifetime_plan`, restart), buy once in the sandbox, read the server log
   (`[billing] ...`). Turning a flag off stops new sales and the new routes; it does not take away what was paid for.

## The webhook, step by step

`POST /api/paddle/webhook` keeps its raw-body parser and its `Paddle-Signature` check exactly as they were. After the JSON parse
it calls `billingWebhook.take(event, res)` once:

1. an event id already in `paddle_events` is acknowledged (200) and ignored;
2. `transaction.completed` -> `purchases.onTransactionCompleted`: our price? lifetime -> grant (unique key `txn:<id>`);
   gift -> make a code, email the buyer (`gift_codes.txn_id` is unique; a rejected email makes the event fail, 500, Paddle
   retries and a NEW code is issued because the old one cannot be read back); monthly/yearly -> recorded and offered to the
   referral program. A payment that matches no account is recorded with no user, logged as an error, acknowledged;
3. `adjustment.created|updated` with `action` refund (full, `approved`) or chargeback -> revoke the lifetime grant, the gift
   code (and the recipient's days), the referral credits that payment earned;
4. only after step 2 or 3 succeeded is the event id recorded; a throw leaves it unrecorded and answers 500;
5. every other event (the `subscription.*` family) is left to the existing handlers; its id is recorded when they answer 2xx.

Idempotency has two layers: the event id, and a unique key on every effect (grant source, gift txn, referral per referred
user), so a fresh event id for the same payment (Paddle's "resend" button) also changes nothing. Event ids are forgotten
after 60 days. `scripts/billingWebhook.test.mjs` runs this against the real `server.js`; disabling the hook line in
`server.js` makes four of its tests fail (checked). The same file also passes (12 of 12) on a scratch copy of this tree with the
owner's Paddle patch applied and `PADDLE_PRICE_IDS=pri_m` (lifetime and gift ids deliberately not listed).

## Referral program: rules and honest limits

Link `<site>/?ref=CODE` (8 random characters, stored per user). The visitor's browser keeps the code 30 days (only if the
`referrals` flag is on, which costs one `GET /api/features` on a visit that came from a link); after sign-up the app sends it
once. Reward: when the referred user's FIRST payment completes (web checkout, not a renewal, amount above 0, no earlier
payment of theirs on record), both get `REFERRAL_CREDIT_DAYS`. Checks, each tested: not the same user; not the same email
after normalising (case, `+tag`, Gmail dots); not the same Paddle customer; the card (type, last four, expiry, hashed) is not
one the referrer paid with; one reward per referred user (guarded UPDATE + unique credit keys); a refund or chargeback of
that payment takes both credits back.

Limits: a second card, a wallet that reports no card (PayPal, Apple Pay) or another email defeats them; the referrer's payment
history is only known for payments after this feature was deployed; two different cards can share type, last four and
expiry (a rare false positive that only costs a reward); there is no cap on rewards per referrer; an account may attach
only within 7 days of creation and before it has paid. Every reward still needs a real, unrefunded payment.

## What is visible, and how "nothing changes with every flag off" was checked

| Surface | Flag | Where |
|---|---|---|
| Lifetime and Gift cards | `lifetime_plan`, `gift_plan` (+ the VITE price id in the build) | `/pricing`, below the plans |
| Lifetime plate, gift link | same | in-app paywall |
| Localized prices | `regional_pricing` | pricing section (home and `/pricing`) and paywall; any failure keeps $2.99 / $29 |
| Referral card | `referrals` | Settings > Account & Sync (`ReferralCard`, mounted by one line in `AccountSyncSection.tsx`) |
| Free plan line, history window, plan wording | `free_tier` | Dashboard, History, Settings > Plan |
| Redeem page | `gift_plan` | `/redeem` |

Checks with all flags off, in headless Chrome against the base commit built in a scratch directory: the rendered DOM of 12
server-rendered pages at 1280 px (`/`, `/pricing`, `/about`, `/how-it-works`, `/blog`, `/privacy`, `/terms-and-conditions`,
`/refund-policy`, a calculator, a compare page, `/redeem`, `/signin`), `/` and `/pricing` at 390 px, and the signed-in app
(Watch, History, Settings) for the trial, subscribed and paywall previews: **46 of 46 files identical**. Also `dist/**` HTML, JSON,
text and XML: **199 of 199 identical** to the base build (hashed file names and `generatedAt` normalised), and **224 of 224**
server responses identical (all pages, blog posts, sitemap, llms files). With the flags on I rendered and read the pages above
at 1280 and 390 px (no horizontal overflow).

## Seams in shared files (for the merge)

`server.js` (import, `TRIAL_MS`, token swaps in strings, 8 lines in the webhook after the parse, one line in `/api/user/me`; none of
the lines the Paddle patch needs as context moved), `Dockerfile`, `vite.config.ts` (`define`, html transform, SW denylist for
`/redeem`), `vitest.config.ts`, `scripts/sync-seo.mjs` (edited in bytes: it holds a NUL), `index.html`, `src/App.tsx` (route,
`BillingHost` twice, paywall `onBack`), `Settings.tsx` (`PlanSection` only), `Dashboard.tsx`, `Log.tsx`, `PaywallPage.tsx`,
`PricingSection.tsx`, `PricingPage.tsx`, `main.tsx`, `trialFollowup.js`, `src/pages/settings/sections/AccountSyncSection.tsx`.
**WS4 owns the body of `AccountSyncSection.tsx`:** keep `return <ReferralCard />` (or render it inside your card list); the card
reads its own flag and needs no session when the flag is off. `email.js` was not touched.

## Known gaps and notes

* **`email.js` reports Resend errors as success** (`sendEmail` returns Resend's `{ error }` instead of throwing). Not changed, as
  instructed. WS9's gift email checks `result.error` itself so a rejected gift email stays retryable; every other caller of
  `sendEmail` still cannot tell.
* Out-of-order delivery of `subscription.*` events is not guarded (Paddle recommends comparing `occurred_at`).
* `chargeback_reverse` and a partial refund do not change access; a lost or forwarded gift link is a support case.
* Unmatched lifetime payments (no `userId`, no account with the payer's email) are in `billing_transactions` with `user_id`
  NULL and in the log at error level: grant them by hand with an `entitlements` row (`source` = `txn:<id>`, `kind` `lifetime`).
* A referral reward needs the Paddle API only for lifetime/gift lookups; it works from the webhook payload alone.
* The `/pricing` Lifetime card sends visitors to start the free trial; the purchase itself is in the app (it needs an account).
* After a change of `TRIAL_DAYS` the generated `public/llms.txt` is stale until `seo:sync` (see above).
* `PaywallPage` shows "N days left in your free trial" from `trial_end_date` whenever the voluntary paywall is open and the
  trial has time left, even for an account that also has a lifetime grant (one-line fix for the orchestrator: gate
  `trialLeftText` on `accessStatus === 'trial_active'`). Left alone: it already behaves this way for a subscriber who upgraded
  mid-trial, and changing it changes flag-off output. `TabBar` and `Dashboard` already gate on `accessStatus`.

## What is and is not verified

Verified (automated): the access matrix; every webhook path against the real `server.js` (bad and missing signatures, replays,
fresh id for the same payment, subscription handlers still working, foreign-product payments ignored, referral reward and
refund, flag-off honouring); gift codes (format, hash only, single use, expiry, revoke, reissue); referral fraud checks; the
trial constant (default byte-identical output, `TRIAL_DAYS=7` changes only trial words across the generated pages, a 224-route
server diff, the guard test and a mutation check that it fails on a new literal); the Dockerfile copies `shared/`; the Electron
server bundle still builds; the Paddle WIP patch still applies.

**NOT verified:** anything against a real or sandbox Paddle account. The webhook payloads in the tests are written from
Paddle's documented shapes (`transaction.completed` items/payments/origin/totals, `adjustment.*` action/type/status), not
recorded; check one sandbox purchase of each product against `server/billing/paddleData.js`. `Paddle.PricePreview` is called
without an address and relied on to price for the visitor's location; not tried. Real email delivery (Resend). The owner's
legal review. Gift and lifetime checkout inside Paddle's overlay.
