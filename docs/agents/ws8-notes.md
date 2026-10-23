# WS8 (More sign-in options) — notes

Emailed sign-in link, Sign in with Apple and Sign in with Microsoft, next to the existing Google sign-in.
All three are behind flags (off), and each is also offered only when its keys are in the server environment.
**None of the real provider flows has been run** (no Apple or Microsoft registration, no real email): see
"What is and is not verified" at the end.

## What exists

| | |
|---|---|
| Server module | `server/routes/authProviders.js` (registered in `server/routes/index.js`) |
| Helpers | `server/auth/`: `linkPolicy.js` (pure rules), `accounts.js` (identities and linking), `magicLink.js`, `magicLinkEmail.js`, `apple.js`, `microsoft.js`, `jwks.js` (id_token verification), `oauthState.js`, `session.js`, `schema.js` (migrations), `googleLink.js` (the Google seam) |
| Tables (additive) | `auth_identities`, `magic_link_tokens`, `auth_oauth_states`. The `users` table is untouched. Migration ids `ws8_001..003`. |
| Client | `src/pages/SignIn.tsx` (route `/signin`), `src/components/auth/ProviderButtons.tsx`, `src/auth/` (providers cache, hooks, pure client logic) |
| Flags | `signin_magic_link`, `signin_apple`, `signin_microsoft` (already registered by WS0) |
| Tests | 238 new tests (260 -> 498, 8 new files): `server/auth/*.test.js` (incl. `session.test.js`), `server/routes/authProviders.test.js`, `src/auth/*.test.ts`; helpers in `test-utils/authHarness.js` |

### Routes

| Route | Purpose |
|---|---|
| `GET /auth/providers` | `{magic_link, apple, microsoft}` booleans: flag on AND configured. 404 while all three flags are off. Deliberately **not** under `/api/` (see findings). |
| `POST /api/auth/magic-link/request` | `{email}` -> always `{ok:true}` for a valid address. Sends the link. |
| `POST /api/auth/magic-link/verify` | `{token}` -> sets the session, returns `{ok, redirect}`. JSON only. |
| `GET /api/auth/apple` | starts Sign in with Apple (302 to Apple). |
| `POST /auth/apple/callback` | Apple's `form_post` return. **Outside `/api/` on purpose.** Parks the result, 303 to the finish URL. |
| `GET /api/auth/apple/finish` | second hop: checks the cookie, exchanges the code, verifies the id_token, signs in. **Under `/api/` on purpose** (see the service worker finding): a plain GET navigation carries no `Origin`, so the `/api/` CORS check passes. |
| `GET /api/auth/microsoft`, `GET /api/auth/microsoft/callback` | Microsoft authorization code + PKCE. |
| `GET /.well-known/apple-developer-domain-association.txt` | Apple's domain check (only exists while `APPLE_DOMAIN_VERIFICATION` is set). |
| `GET /signin` | the sign-in page (the app's HTML shell, `noindex`). 404 (the normal branded one) while all flags are off. |

## How to turn it on (owner)

1. Do the provider setup below for the methods you want.
2. In Coolify set the env vars (names in `.env.example`) and add the flag(s) to `FEATURE_FLAGS`, e.g.
   `FEATURE_FLAGS=signin_magic_link` (flags are independent: you can ship the emailed link alone).
3. Restart the app. Check `https://stopbiting.today/auth/providers` (it shows what is on) and open `/signin`.
4. To switch back: remove the flag and restart. Accounts and identities created meanwhile keep working:
   Google sign-in still finds an account made by another method (see "Google seam").

Before turning anything on, read **NEEDS HUMAN REVIEW** `docs/agents/legal/ws8-privacy.md` and `ws8-terms.md`
(the Privacy Policy and Terms still say Google is the only sign-in).

### Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | emailed link | already used by welcome emails. `EMAIL_FROM` must be on a domain verified in Resend or mail only reaches the Resend account owner. |
| `APPLE_CLIENT_ID` | Apple | the **Services ID** (not the App ID) |
| `APPLE_TEAM_ID` | Apple | 10 characters |
| `APPLE_KEY_ID` | Apple | 10 characters, id of the Sign in with Apple key |
| `APPLE_PRIVATE_KEY` | Apple | contents of the `.p8` file. Newlines may be real, written as `\n`, or the whole PEM base64-encoded. |
| `APPLE_DOMAIN_VERIFICATION` | Apple (once) | contents of Apple's `apple-developer-domain-association.txt`; served at `/.well-known/apple-developer-domain-association.txt` while set. Works without any flag, so it can be live before the first Apple sign-in. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft | the secret **value**, not its id. Secrets expire (24 months at most): put the date in a calendar. |
| `MICROSOFT_TENANT` | Microsoft | default `common`. `consumers` = personal accounts only; `organizations` = work/school only; or one tenant id. |
| `APP_URL` | all | already required. Must be the public `https://stopbiting.today`: Apple refuses anything else. |

### Apple setup (human)

1. developer.apple.com -> Identifiers: create a **Services ID** (e.g. `today.stopbiting.web`) and enable *Sign in with Apple*.
2. Configure it: primary App ID (create one if there is none), domain `stopbiting.today`, **Return URL**
   `https://stopbiting.today/auth/apple/callback`. Apple verifies the domain by fetching
   `https://stopbiting.today/.well-known/apple-developer-domain-association.txt`: download that file, paste its
   contents into the env var `APPLE_DOMAIN_VERIFICATION`, restart, then press Verify in Apple's dialog. (A file in
   `public/.well-known/` would NOT be served: `express.static` ignores dot directories, verified on the real server,
   so the module serves the text itself.) Apple does not accept `localhost` or `http`, so Apple sign-in cannot be
   tested against a local server.
3. Keys: create a key with *Sign in with Apple* enabled, download the `.p8` once (Apple will not show it again).
   Note the Key ID and your Team ID.
4. **Private email relay:** people who choose "Hide my email" get an `@privaterelay.appleid.com` address. Apple
   only forwards mail from senders you have registered: *Certificates, Identifiers & Profiles -> More ->
   Sign in with Apple for Email Communication*, add the sending domain of `EMAIL_FROM` (and set up SPF/DKIM as
   Apple describes). Without this, the welcome email, the trial follow-up and magic links to those users are
   dropped silently.

### Microsoft setup (human)

1. portal.azure.com -> Microsoft Entra ID -> App registrations -> New registration.
2. *Supported account types:* "Accounts in any organizational directory and personal Microsoft accounts" (matches
   `MICROSOFT_TENANT=common`). Redirect URI, platform **Web**: `https://stopbiting.today/api/auth/microsoft/callback`.
3. Certificates & secrets -> new client secret -> copy the **Value** into `MICROSOFT_CLIENT_SECRET`.
4. Token configuration -> Add optional claim -> token type **ID** -> `email` and `xms_edov`. (Optional but
   recommended: it is what lets a work or school account be connected to an existing account by email. Without
   it those people can still sign in, but are asked to use the emailed link to connect an existing account.)
5. Publisher verification is not needed for personal accounts; work and school tenants whose admins have disabled
   user consent for unverified publishers will show a consent block until you do it.

### Emailed link setup (human)

Nothing but a working Resend sender. **Turn Resend's click/open tracking OFF** for that domain: link tracking
rewrites URLs and would break the `#t=` fragment the link depends on.

## Account linking: the exact rule

One person, one account. Every sign-in becomes an **identity** (`provider`, `subject`) in `auth_identities`:
`google:<sub>`, `email:<address>`, `apple:<sub>`, `microsoft:<tid>:<oid>`.

1. A known identity signs in to its account. (Email is never consulted.)
2. A new identity **joins an existing account only if both** hold:
   - the provider vouches that the person controls the address (below), and
   - the existing account's address is itself vouched for: it belongs to a legacy Google user (the Google
     subject is the account id, and Google verifies its addresses), or an identity row with `email_verified = 1`
     carries it.
   Matching is case-insensitive. If several accounts share the address, a paying one wins, then the oldest.
3. Otherwise a new account is created.
4. If the address is **not** vouched for and an account already has it: **no sign-in** (`email_unverified`), nothing
   is linked or created, and the person is told to use the emailed link instead.
5. An address that is not vouched for is **never stored on the new account** (`users.email` stays NULL; the claimed
   value is kept only in `auth_identities.email` with `email_verified = 0`). So it can neither be matched later nor
   collide with the real owner's address (pre-hijacking), and nobody is mailed an address nobody proved.

What each provider vouches for:

| Provider | Address counts as verified when |
|---|---|
| Emailed link | always: the link was delivered to it and used |
| Google | `email_verified` true (only used by the Google seam; legacy Google users are trusted as before) |
| Apple | `email_verified` is `true` / `"true"`. Apple only returns verified addresses. A private relay address (`is_private_email`, or the `@privaterelay.appleid.com` suffix, since the claim is not always present) is flagged but treated like any other verified address: it is a working mailbox that forwards to that one person. |
| Microsoft | **only** if the token's `tid` is the personal-account tenant `9188040d-6c67-4c5b-b112-36a304b66dad`, **or** the optional claim `xms_edov` is true. Never from `email` alone, never from `preferred_username` or `upn`. |

Microsoft's own documentation says the `email` claim "isn't guaranteed to be correct and is mutable... never use it
for authorization or to save data for a user" (learn.microsoft.com, ID token claims reference and optional claims
reference, read 2026-10-23); `xms_edov` is "a boolean value indicating whether the user's email domain owner has
been verified". The identity key is `<tid>:<oid>` (`sub` only as a fallback), as Microsoft recommends.

**Lazy Google backfill.** Existing Google users have no `auth_identities` row and need none. The first time another
method joins them, their `google:<id>` identity is recorded. This assumes the email stored from Google was verified
(Google accounts' addresses are); legacy rows do not record `email_verified`.

## The Google seam (the only edit to existing server code)

`server.js`, three lines (named in the report):

```js
import { createGoogleLinker } from './server/auth/googleLink.js';
const linkGoogleSignIn = createGoogleLinker({ db, getUser });          // after the db is opened
...
let user = getUser(googleId);
if (!user) user = linkGoogleSignIn(googlePayload);                      // new, in the Google callback
```

Why it is needed: someone who first signed in with an emailed link (account id is a uuid) and later uses Google with
the same address would otherwise get a **second** account, because the callback looks users up by the Google subject.
The hook runs only when no user has that Google subject, so **an existing Google user never reaches it**. It returns
a user only if (a) this Google identity was linked before, or (b) Google says the address is verified and an account
made by another method has it. Never another Google account. With no such accounts it returns `null` and the callback
proceeds exactly as before. Any error inside returns `null` (logged). Nothing else in the Google routes changed.

## Security review notes

| Concern | What is done | Test |
|---|---|---|
| Token guessing / DB leak | 32 random bytes, base64url; only the SHA-256 is stored; the raw token exists only in the email | `magicLink.test.js` |
| Replay | single use via one conditional `UPDATE ... WHERE used_at IS NULL AND expires_at > now`, checking `changes === 1` | `magicLink.test.js`, route tests |
| Expiry | 15 minutes, exact boundary tested | `magicLink.test.js` |
| Timing | `timingSafeEqual` on the digests after lookup (lookup is by an indexed digest of a 256-bit secret) | code review |
| Account enumeration | a valid address always gets the same `200 {ok:true}`: sign-up and sign-in are one door, so there is nothing to reveal. A rate-limited address is answered identically. | `authProviders.test.js` |
| Email bombing | per address: 5 per hour and 30 s apart (counted in the database, survives restarts); per caller: 20 requests per hour (express-rate-limit, same pattern as server.js); plus the existing `/api/auth/` limiter. "Caller" = the last `X-Forwarded-For` entry **when the TCP peer is on a private network** (a proxy in front of us), else the socket address; independent of `NODE_ENV` (the Dockerfile does not set it). Behind a second proxy such as a CDN the last entry is the CDN's address, so per-caller limiting degrades to per-CDN-edge. | `session.test.js`, route tests |
| **Mail scanners that open links** | opening the link only loads the sign-in page (`GET /signin`, never consumes). The token is in the **URL fragment** (`#t=...`), which is never sent to a server, so it is not in access logs and a scanner that fetches the URL never even sees it. Signing in needs the person to press **"Sign in to Stop Biting"**, which POSTs the token. Chosen over "GET consumes" because scanners (Outlook Safe Links, corporate gateways) do GET links and would burn every token. | `authProviders.test.js` ("opening the link ... spends nothing") |
| Fragment leaking | the page shell is served with a script placed first in `<head>` that moves the token into a page variable and clears the address bar before analytics loads; `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `noindex` | `prepareSigninShell` test |
| Login CSRF on verify | JSON body only (`Content-Type: application/json`), and a request carrying a foreign `Origin` is refused. A cross-site form cannot send JSON, and a cross-site `fetch` needs a CORS preflight the API allow-list refuses. | route tests |
| OAuth CSRF | single-use `state` stored hashed in the database, plus an HttpOnly Lax cookie holding it (checked unless `ELECTRON_PROTOCOL`, as Google's is) | route tests |
| id_token forgery | signature against the provider's JWKS (RS256 pinned before any key is used, so `alg: none` and HS256-with-public-key are refused), `aud`, `iss`, `exp`, `nonce` (constant-time) | `idTokens.test.js` |
| Microsoft `iss` | with `common` the issuer differs per tenant: checked as `https://login.microsoftonline.com/<tid>/v2.0` against the token's own `tid`, then against the owner's `MICROSOFT_TENANT` restriction | `idTokens.test.js` |
| PKCE | S256; the verifier lives only in the database, never in the browser | route tests |
| JWKS abuse | cached 1 h; an unknown `kid` causes one refetch, at most once a minute; stale keys keep working if the provider is down; fails closed if never fetched | `idTokens.test.js` |
| Apple name/email forgery | the `user` form field comes via the browser, so it is used only as a display name (sanitised, 100 chars); email always comes from the verified id_token | `idTokens.test.js` |
| nOAuth / pre-hijacking | see "Account linking" | `accounts.test.js`, `linkPolicy.test.js` |
| Open redirect | client only follows `/`-paths, our origin, or `stopbiting://auth` | `signInClient.test.js` |
| Secrets | read from env at boot, never in `/auth/providers`, never in logs (errors log a code, not tokens) | route tests |
| Mutation check | I broke 7 security-critical lines one at a time (state cookie check, personal-tenant rule, single-use claim, alg pin, nonce check, verified-backed link targets, origin/content-type check): each broke 7-18 tests. | |

Retention: `magic_link_tokens` rows (hash, address, requester IP) are deleted 24 hours after they expire; used or
not. `auth_oauth_states` rows are deleted when used or after 10 minutes.

## Findings in the existing code (not changed here; for the owner / orchestrator)

1. **Apple's callback cannot live under `/api/`.** Apple posts back from `appleid.apple.com`, so the request carries
   `Origin: https://appleid.apple.com`. The `/api/` CORS middleware in `server.js` rejects unknown origins with an
   error, which becomes an HTTP 500 (verified against the real server: `POST /auth/apple/callback` -> 303,
   `POST /api/...` with that Origin -> 500). Hence `/auth/apple/callback`.
2. **No `trust proxy`.** `server.js` never calls `app.set('trust proxy', ...)`. Behind Coolify/Traefik `req.ip` is
   then the proxy, so the existing limiters (`/api/` 100 per 15 min, `/api/auth/` 10 per minute) may be **one shared
   bucket for every visitor**. Not verified in production. It matters because: my own limiters avoid it by reading
   the proxy's `X-Forwarded-For` entry (only from a private-network peer, see the table), `/auth/providers` is outside
   `/api/` so marketing traffic cannot use up the shared budget, and the owner may want `app.set('trust proxy', 1)` once
   the proxy chain is known (a global change, so not made here). Owner check: if a CDN such as Cloudflare sits in
   front of Traefik, tell me and use its client-IP header instead.
3. **Resend does not throw on API errors.** `resend` 6.x returns `{ data: null, error }`. `sendEmail` in `email.js` therefore
   "succeeds" with a bad key or an unverified domain. The magic-link route checks `result.error`; the welcome and
   trial follow-up emails do not (`trialFollowup.js` would mark users as mailed even when nothing was sent).
4. **The service worker does not answer the sign-in GETs only because of two choices made here.** The PWA's
   `navigateFallback` serves the cached app shell for any GET navigation outside `/api/`, `/downloads/`, `/posts/`
   (`vite.config.ts`). Verified with a real installed worker in headless Chrome: a GET to a non-`/api` path is answered
   by the worker (`fromServiceWorker: true`), so (a) Apple's second hop had to live under `/api/` (it does), and (b)
   `/signin` would have been served from the cache, bypassing the server's flag gate and the token-moving script. The
   one shared-file edit of this workstream: `/^\/signin/` added to `navigateFallbackDenylist` in `vite.config.ts`.
   Visitors whose browser still runs the previous worker (precache and denylist from before this deploy) keep the cached
   shell for `/signin` until the new worker activates: with flags off that shows a Google-only sign-in page; the
   client-side code reads the token from the fragment itself in that case, so links still work.
5. **The service worker may not install at all against `server.js` today.** Against `main`'s `server.js` in headless
   Chrome the worker fails to install ("ServiceWorker failed to install ... waitUntil Promise rejected", "Failed to fetch").
   Likely cause: the precache list contains `index.html`, which the canonicalising middleware in `server.js` 301s to `/`.
   A scratch copy of `dist/sw.js` with the precache entry and navigation handler pointed at `/` installed and
   controlled the page, which is how finding 4 was verified. **Not verified in production**: if installs fail there too,
   the "installable PWA" is not working for anyone; worth a look by whoever owns WS6/WS13.
6. **`ELECTRON_PROTOCOL` in production.** `COOLIFY_DEPLOY.md` step 3 lists `ELECTRON_PROTOCOL=stopbiting`. If that were
   set, Google's redirect URI would be `http://localhost:3000/api/auth/callback`, which step 4 does not register, so web
   sign-in could not work; so production almost certainly does not have it. Please delete the variable if it is
   there: all three new flows honour it exactly like Google does (no state cookie check, results to the
   `stopbiting://auth` deep link, Microsoft redirect URI on localhost) and would break the same way.
7. The packaged desktop app has no routable sign-in screen (`signInWithGoogle` in `AuthContext` is not called from any
   component; the Landing buttons are plain links). I did not invent one. The new start endpoints answer with a 302
   to the provider like `/api/auth/google`, so the existing main-process pattern (`fetch(..., {redirect:'manual'})`
   then `openExternal`) works for them; wiring `electron/main.ts` is WS7b's area. Not verified.
8. `UserProfile.email` is typed `string` but is now `NULL` for accounts created by an unverified Microsoft sign-in. The
   client only reads it as `user?.email ?? ...` or `user?.email ? ...`, which is safe; keep that in mind elsewhere.

## Seams and files touched outside the new ones

- `server.js`: the 3 lines above.
- `server/routes/index.js`: one import, one array entry.
- `src/App.tsx`: a lazy import and one `/signin` branch.
- `vite.config.ts`: `/^\/signin/` added to `navigateFallbackDenylist` (one array element; finding 4).
- `src/components/site/SiteHeader.tsx`, `TrialButton.tsx`: the Google link's `href` comes from `useSignInHref()`, which is
  `/api/auth/google` (identical to before) unless a method is on and configured, then `/signin`. PricingSection and
  HeroDemo still link straight to Google (WS11a's files).
- `.env.example`: the new variables.
- Not touched: `Landing.tsx`, FAQ data, `PrivacyPage`, `TermsPage`, `COOLIFY_DEPLOY.md`, detection files, `electron/`.

**WS9 note:** new accounts get their trial length from `TRIAL_MS` in `server/auth/accounts.js` (3 days, same as the Google
callback). When WS9 centralises the trial length, change that one constant too.

## Nothing changes with all flags off: how that was checked (and where it is not literally true)

- Recorded a transcript of `GET /health`, `/api/auth/google`, `/api/auth/callback` (three variants), `POST /api/auth/signout`,
  `GET /api/user/me`, `/api/features`, `/pricing` from `main`'s `server.js` and from this branch with `FEATURE_FLAGS` unset,
  then diffed them: the Google, session and page responses are byte-identical (status, `Location`, `Set-Cookie`,
  content type, cache headers, start of body, after normalising random state values). The only differences are the
  new routes themselves, which answer `404 {"error":"Not found"}` (flagged routes) or the normal branded 404 (`/signin`).
- With all three flags **on**, the same Google lines are still identical.
- Caveats, stated plainly: (1) one extra small request on marketing pages (below); (2) the `vite.config.ts` denylist edit changes the generated `sw.js` (one more entry), which every returning visitor's browser downloads once; (3) a browser still running the previous worker serves a Google-only `/signin` page from cache until the new worker activates (nothing links to `/signin` while the flags are off).
- Client: with all flags off the server answers `/auth/providers` with 404, the client treats that as "no extra
  providers", so the header "Sign in" and every "Start free trial" button keep `href="/api/auth/google"`. The one
  visible-in-the-network-tab change is that marketing pages now make one small `GET /auth/providers` (404 while off),
  deferred to browser idle and remembered for 10 minutes. It is outside `/api/`, so it does not use the shared limits.

## Copy facts for WS11

These are the facts as of this branch. **Nothing below is live until the owner turns the flags on**, so any sentence
that mentions a method must appear only when that method's flag is on in production (server-rendered pages can read
`createFlags(process.env)`; the client can read `useFeature`).

- Methods and flags: Google (always), emailed link (`signin_magic_link`), Apple (`signin_apple`), Microsoft (`signin_microsoft`).
  Each needs its keys too; `GET /auth/providers` is the source of truth for "is it really on".
- New page: `/signin` (noindex, not in the sitemap). Once any method is on, "Sign in" and "Start free trial" buttons
  lead there; it offers every method, Google included. New accounts start the free trial exactly like Google sign-ups
  (length per WS9).
- Emailed link: the visitor enters an address, receives a link, opens it and presses a button. The link works once and
  expires after 15 minutes. No password. This also creates an account for a new address.
- Same address, different method: if a person uses two methods with the same verified email they get one account.
  Microsoft work or school accounts may be asked to use the emailed link once to connect an existing account.
- Apple: people can hide their email; we then hold an Apple relay address, and Apple only passes on our emails if the
  sender domain is registered with Apple (owner TODO above).
- Do not claim: "no personal data", "100% private", "no cloud", or anything about what Apple or Microsoft do with the
  sign-in. Approved line stays: *Detection runs on your device. No camera data is sent while it runs.*

### "Do I need a Google account to use it?" (FAQ, `src/pages/Landing.tsx` line ~139, plus its mirror)

Current answer, true while all three flags are off: *"Accounts are created through Google sign-in, which gives us your
name, email address and profile picture and never your Google password. The live demo on the homepage needs no
account at all."*

Proposed answer **when all three methods are on** (adjust by flag): *"No. You can sign in with Google, Apple, Microsoft
or an emailed link, so you do not need a Google account. Signing in with Google, Apple or Microsoft gives us the name and
email address on that account, or an Apple relay address if you hide yours, and never your password; the emailed link
needs only your email address. The live demo on the homepage needs no account at all."* The question text may then be
shortened to "Do I need a Google account?". NEEDS HUMAN REVIEW (it describes data handling).

### Other places that say Google is the only way in (all outside this workstream)

- `src/pages/Landing.tsx`: ~216 and ~392 ("Sign in with Google", "it opens in a new tab"); mirrors in `server.js` ~1584 and ~1592
  (the no-JS copy: keep them in step).
- `src/data/comparePages.ts` ~1002, ~1015, ~1029: "Stop Biting requires a Google sign-in" (NailBiteMenu comparison);
  ~399 and ~445 ("sign in with Google").
- `src/pages/PrivacyPage.tsx` ~48, ~58, ~77 and `src/pages/TermsPage.tsx` ~42: see the drafts in `docs/agents/legal/`.
- `src/data/blogPosts.ts`: two mentions (not checked individually).
- llms files and `public/seo-content*` are generated; WS11/orchestrator regenerate.

## What is and is not verified

Verified (automated, no real providers): link policy decisions (verified / unverified / relay / personal vs work
tenant / `xms_edov`); token lifecycle against in-memory SQLite (hash only stored, expiry, reuse, wrong token, per-address
and per-IP limits); Apple client-secret JWT (ES256, claims, signature round-trip with a locally generated key, key
formats); Apple and Microsoft id_token validation with locally generated keys and a mocked JWKS (signature, `aud`,
`iss` per tenant, `exp`, `nonce`, algorithm confusion, key rotation, provider outage); all callbacks end to end against a
mocked provider over HTTP; one account for the same address across Google, emailed link, Apple and Microsoft;
flag-off 404s for every route and `/signin`; the sign-in page rendered from the real server with `build:web` output in
headless Chrome driven over CDP against the real server, including a cross-site form POST to the Apple callback with an installed service worker (POST -> 303 -> `/api/auth/apple/finish` -> state and Lax-cookie check passed -> `/signin?error=callback_failed` because the dummy Apple exchange failed; Chrome only) and a negative control showing the old non-`/api` finish path would have been swallowed by the worker (all methods shown, the buttons' targets, a failed send reported
honestly, the confirm step with the token removed from the address bar, an invalid link, the Microsoft unverified-email
message, no horizontal scroll at 390 px, header and trial links point at `/signin` with flags on and at
`/api/auth/google` with flags off); the real `server.js` booted on port 3208 with a scratch
`DATA_DIR`, dummy keys and flags on: migrations apply, `/auth/providers`, `/signin`, and both provider redirects are
correct, and the CORS finding above.

**NOT verified:** any real Apple, Microsoft or Resend call; that Apple accepts our client secret and domain
verification; that a browser really delivers Apple's cross-site POST to the callback in each browser (the two-hop
design avoids the known cookie problems but was not run against Apple); Microsoft consent screens and the optional
claims; delivery of the emailed link to real inboxes (and that scanners behave as assumed); the desktop app path;
other browsers than headless Chrome (Safari and Firefox in particular, for the Apple two-hop return and the SameSite cookie behaviour); a real service worker install in production (finding 5).

## Follow-ups (not done)

- Settings -> Account & Sync: show which methods are linked to the account (`auth_identities`), with a "link another
  method" action (needs a signed-in link flow, which would also let an unverified Microsoft person connect an existing
  account safely).
- Make `PricingSection` and `HeroDemo` links use `useSignInHref()` (WS11a's files).
- Delete the identity rows when a user deletes their account (WS4's "delete everything"): `auth_identities.user_id`.
