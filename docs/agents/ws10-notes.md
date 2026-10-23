# WS10 (Therapist / accountability share link) — notes

A signed-in person makes a read-only link, gives it to someone they choose (a therapist, a friend), and that person opens
a calm summary page with no sign-in. Behind one flag, `share_links`, off by default. For the owner, for WS11b (copy facts)
and for WS13 (release notes). Reference: `docs/agents/ARCHITECTURE.md` (sections 6, 8, 9, 12 gained WS10 lines).

## How to turn it on (owner)

1. Read `docs/agents/legal/ws10-privacy.md` and `ws10-terms.md` (**NEEDS HUMAN REVIEW**) and publish the wording with the flag.
2. In Coolify set `FEATURE_FLAGS=event_sync,share_links` and restart. No rebuild, no new env var, no new dependency. A link
   shows the owner's SYNCED history, so `event_sync` should be on too; with it off every link says "no history yet" (the
   Settings card says so). It is not enforced as a flag dependency: adding `dependsOn` made a WS0 test warn, so it was left out.
3. Check: Settings shows a "Sharing" card; `GET /api/share/links` answers 401 when signed out (404 with the flag off).
4. To switch off: remove the flag and restart. Every route answers 404 at once; links stay in the database and work again when
   the flag returns. To kill one link: the owner of it revokes it (Settings > Sharing).

## What exists

| | |
|---|---|
| Server route module (registered in `server/routes/index.js`) | `server/routes/share.js` |
| Table, token, summary, page | `server/share/links.js`, `tokens.js`, `summary.js`, `page.js` |
| Client | `src/share/{types,api,copy,clipboard}.ts`, `src/pages/settings/SharingSettings.tsx`, `sections/SharingSection.tsx` (lazy chunk, fetched only with the flag on) |
| Tests | `server/routes/share.test.js` (42), `server/share/{summary,semantics,links,tokens}.test.js` (40, 12, 17, 5), `src/share/share.test.ts` (15), `src/pages/settings/sharingSettings.test.tsx` (15), `scripts/shareGuard.test.mjs` (15); helper `test-utils/shareHarness.js` |
| Shared-file edits (named) | `server.js`: ONE condition (below). `vite.config.ts`: `/^\/share\//` in `navigateFallbackDenylist`. `server/routes/index.js`: one import, one entry. `src/pages/settings/settings.test.tsx`: `share_links` removed from the "sections are empty" fixture. `docs/agents/ARCHITECTURE.md`: lines. |

### Endpoints

Owner (flag first, then sign-in; 60 requests / 15 min per account):

| | |
|---|---|
| `POST /api/share/links` | body: exactly `label?` (string, at most 60), `expiresInDays?` (7, 30, 90 or null; absent = 30), `detailed?` (boolean, absent = false), `timezone?` (IANA name, bad value = UTC). Anything else is 400 naming the field. 201 `{ id, token, url, label, createdAt, expiresAt, lastViewedAt, detailed }`. **The only time the token is returned.** 409 `too_many_links` at 5 active links. |
| `GET /api/share/links` | `{ links: [{ id, label, createdAt, expiresAt, lastViewedAt, detailed }], max, syncedEntries }`. Active links only, newest first, no token, no hash, no user id. (`detailed` is in the list beside the five fields asked for, so the card can say "With dates".) |
| `DELETE /api/share/links/:id` | revoke one of the caller's active links: `{ ok: true }`, or 404 (not yours, not active, not there: all the same). Needs no entitlement, so an expired or free account can always revoke (test). |

Public (no sign-in, no cookie; the address is the credential; 120 requests / 10 min per caller, and only 20 misses / 10 min):

| | |
|---|---|
| `GET /share/:token` | the summary page: one self-contained HTML document (below) |
| `GET /share/:token/data.json` | the same summary as JSON, the shape pinned below |

Both: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, no `Set-Cookie`. The page also
has `<meta name="robots" content="noindex, nofollow, noarchive">`. A revoked, expired, unknown or malformed token gets ONE
answer per route: the same status (404), body and headers (test compares all of them, byte for byte, with the date removed).
The lookup is a single query that already excludes revoked and expired rows, so inside the code they are not even different
cases; `last_viewed_at` is only written on a successful, non-HEAD view, at most once a minute.

### Schema (additive migration `ws10_001_share_links`)

`share_links(id TEXT PK, user_id, token_hash UNIQUE, scope JSON, label, created_at, expires_at, revoked_at, last_viewed_at, timezone)`.
The token is 32 random bytes as 43 base64url characters; only its SHA-256 is stored. Revoked/expired rows are deleted when
they are more than 30 days old, whenever anyone next makes a link (`STALE_RETENTION_MS`, `purgeStale`).

## What a link reveals: the scope table

The output is built by `toPublicView` in `server/share/summary.js`, which names every key literally (no spread, no copying
of an event). Exact key sets are pinned in tests for both modes.

| Output | `detailed: false` (default) | `detailed: true` |
|---|---|---|
| `streak` | whole days since the last bite (`since: last_bite`) or since the first synced entry when no bite is logged (`first_entry`); `null` with no history | same |
| `totals` | bites in the last 7 days, the 7 days before, the last 12 weeks | same |
| `daily` / `weekly` | 28 daily and 12 weekly counts, oldest first, **positions only** (no dates) | same numbers |
| `triggers` | counts of the bites' first reason in the fixed groups `stress, focus, boredom, unknown, other` | same |
| `competingResponse` | `{ alarms, completed, ratePercent }` (WS2 rule, same 12 weeks) | same |
| `detail` | absent | `{ today, lastBiteDate, byHour[24] }`: day-level dates and an hour-of-day histogram. Never an exact time, id or device. |
| `hasData`, `version`, `detailed`, `window` | yes | yes |

Never present in either mode: event ids, device ids, hands, behaviors, free text, custom reason names (anything that is not
one of the four preset reason ids is `other`), per-event timestamps, the owner's name, email, account id or time zone, photos,
and the owner's private label (it is not even passed to the page renderer).

### Definitions (the server's own, matching the app's WS3 predicates; pinned by `server/share/semantics.test.js`)

- **Bite**: live (not a tombstone), `falsePositive !== true` (it outranks `confirmed`), not an urge (a manual entry whose
  first trigger is `urge`), and either manual or an alarm with `confirmed === true`. This is the app's `isBite` on the wire
  shape; the test compares the two over the WS3 state table and over 3,000 random combinations.
- **Not a bite**: an unconfirmed alarm ("alarms to review"), a false positive, an urge, a deleted entry.
- **Alarm** (for the competing-response rate): live, `source: 'alarm'`, not a false positive (WS2's `coachingStats` rule;
  parity test over 200 random sets). The window opens at the first alarm carrying a prompt; rate = completed / alarms.
- **Streak**: whole days since the NEWEST bite, however old. With synced entries but no bite, since the OLDEST synced
  entry of any kind. No synced entries: `null`. **WS4 limitation applies**: the app's streak start date is per device and not
  synced, and an entry that has not synced yet is missing, so this figure can differ from the app's (the page says so).
- Windows are in the owner's time zone (stored on the link); an entry dated in the future is counted in no bucket, shown as
  "today" at most, and makes the streak 0.
- Every behavior is counted together (behaviors are not in the scope list).

## The page

`server/share/page.js` renders from the summary object alone. It is **not** the app shell: `index.html` loads Google
Analytics and the app bundle, and the address holds the token. The page has: no `<script src>`, no stylesheet link, not one
absolute URL; fonts and the logo from this site only; one inline stylesheet and one small inline script (the Print button),
each allowed by SHA-256 in the page's own CSP (`default-src 'none'`, no `unsafe-inline`); charts as inline SVG; light/dark by
`prefers-color-scheme` with the site's tokens; a print stylesheet that fits one A4 page (measured: 1 page, light and with
dates); "Shared by the person who made this link ... revoked links stop working" and "not a clinician" always shown; a plain
"No history to show yet" when nothing was synced. No analytics, no cookies, no third party (tests, plus a headless-Chrome request
log: only the page, `/logo.svg`, two `/fonts/*.woff2`, `/favicon.svg`).

`server.js` (the one edit): the canonicalising redirect lower-cases page paths, which would turn `/share/AbC...` into
`/share/abc...` and kill every link, so `/share/` is exempt there (`path.startsWith('/share/')`, one condition). A test reads
`server.js` to keep it. Tokens are case sensitive (a lower-cased one is a 404, test).

**Service worker.** `/share/` is in `navigateFallbackDenylist`. With a real installed worker in headless Chrome (a scratch
copy of `dist/sw.js` patched, as WS8 did, so that it installs against `server.js`): `/pricing` is answered by the worker,
`/share/<token>` is not, and nothing but this origin is contacted. **With the denylist entry removed the worker serves the app
shell for `/share/<token>` and the page loads `googletagmanager.com` with the token in the address** (reproduced), so the
entry is load-bearing. Residual: a returning visitor whose browser still runs the PREVIOUS worker (one that was installed
before this deploy) gets the cached shell on the first navigation to a share address, and with it Google Analytics. Nothing the
server can do fixes that for the first visit; it affects only someone who had visited the site before and opens a link in the
first moments after the deploy (the new worker activates on that same visit). Mitigation if it matters: turn the flag on a day
or two after the deploy, so workers have updated.

## Verification (what was actually run)

- `npm run build:web`: exit 0. `npm test`: **103 files / 1,900 tests** (main was 95 / 1,739). Lint scoped to `src server scripts
  electron shared`: 23 errors / 4 warnings, the baseline. `node --check` on `server.js` and every server file touched.
  `npm run seo:check`: in sync. The two dev-leak greps print nothing; `api/share/links` appears only in the lazy
  `SharingSettings-*.js` chunk.
- **Mutation check** of the privacy-critical code (a script that broke one line at a time and ran the share tests): revoked
  still found, expired still found, revoke ignoring the owner, a raw timestamp in the view, free-text reason echoed, dates in the
  narrow view, X-Robots-Tag dropped, Referrer-Policy dropped, a different 404 for revoked, analytics script on the page, noindex
  meta removed, unconfirmed alarms counted, false positives counted, miss limiter off: **14 of 14 caught** (a 15th, "label rendered
  on the page", could not be written because the renderer never receives the label).
- **Real server** (`server.js` on :3210, temp `DATA_DIR`, dummy env, real JWT cookies, the real sync endpoint, headless Chrome):
  create, view, revoke; mixed-case token not redirected (`lower-cased` 404, trailing slash 200); identical dead-link answers for
  revoked / unknown / malformed on both routes; no-auth create 401; another account's revoke 404 and the link still works;
  helmet's headers replaced as intended (`Referrer-Policy: no-referrer`, the page's own CSP); 390 px and 1,280 px, light and dark,
  `scrollWidth == innerWidth`, fonts load, no console errors; print to A4 PDF = 1 page; the Print button calls `window.print`.
- **The Settings card in a real signed-in session** (real server, real JWT cookie, built app, headless Chrome at 1,280 and
  390 px, light and dark): the card shows with "Sharing needs your history to be synced" and a working "Go to Account & Sync"
  (it scrolls to and focuses that card); a note and the dates switch, "Make a share link" shows the link once with the text
  selected; headless Chrome refuses the clipboard, so the card correctly showed its "press Ctrl+C" fallback (the real clipboard
  permission path is not exercised); after Done the token is nowhere in the page or in `localStorage`; the list shows the note,
  "With dates", expiry and "Not opened yet"; Revoke asks in the page (focus on "Keep it"), then the link answers 404 from outside;
  no overflow at 390 px; no console errors; the only requests were `/api/share/links` and `/api/share/links/:id`.
- **Flag off** (real server, `FEATURE_FLAGS` unset): `/share/<token>` and `/share/short` give the site's own branded 404 (no
  `X-Robots-Tag`, nothing share-specific), `/share/<token>/data.json` and all three `/api/share/links` calls give
  `404 {"error":"Not found"}`, `/api/features` says `share_links: false`, `/pricing` still 200. In the app the Sharing section
  renders `''` (test), loads no chunk, makes no request.

## Deviations from the plan, and why

- **Public JSON is at `/share/:token/data.json`**, not under `/api/`: it shares the page's exemption, rate limiter and
  headers, and does not use the shared `/api/` limit (WS8's finding: no `trust proxy`, so that limit may be one bucket for everybody).
- **Default expiry is 30 days** when the API is called without one (the card asks explicitly; "No expiry" is a choice).
- **`share_links` has no `dependsOn: event_sync`** (see "turn it on", item 2).
- The page shows counts as positions in the narrow mode ("4 weeks ago", "Today"); dates appear only in detailed mode.
- A link survives the owner's "Delete synced data" (it then shows "no history yet"); it is not revoked automatically.

## Known limits and owner TODOs

- Request paths are in the host's logs: a share address is a bearer secret and Traefik/Coolify access logs may record it.
  Decide whether to exclude `/share/` from access logs (the legal draft asks too). Revoking is the remedy; links expire in
  30 days by default.
- Link previews: a chat app that fetches the address to build a preview counts as a view ("Last opened"). HEAD is not counted.
- Account deletion (by hand) should also delete the account's `share_links` rows (`removeAllForUser` exists; nothing calls it).
- `listUserEvents` reads all of a person's rows per view (cap 50,000 per account; 50,000 summarised in about 25 ms in the test),
  behind the rate limit. No caching, so revocation and deletion apply at once.
- The public limiter uses the caller address as WS8's `clientIp` does; with no `trust proxy` and a second proxy such as a CDN
  in front, "per caller" may degrade to "per edge" (WS8 findings 2). Not verified in production.
- Electron's packaged app uses the hosted API, so `url` comes from `APP_URL` of the hosted server: fine. Not run.
- Marketing: nothing was written (WS11b owns it). Facts for it: counts-only by default, optional dates, revocable at any time,
  expires after 7/30/90 days or never, at most 5 active links, no sign-in for the viewer, no analytics on the shared page,
  not a clinician. Do not claim it is private from the host: the server computes it.
- A real therapist workflow (a clinician opening it) and a real print on paper were not tried.

## NOT verified

Production (hosting logs, `trust proxy`, CDN), Safari and Firefox rendering and printing, a real screen reader on the page,
real devices, the Electron app, the service-worker residual on a browser that held the previous worker, copying with a real
clipboard permission, the Settings card after sync has actually been switched on in the UI (the card's "sync is on" and "nothing
synced yet" states are covered by unit tests, and the sync engine itself is WS4's).

## Lessons worth recording

- A page whose address holds a secret cannot ride the SPA shell: GA is in `index.html`, and the PWA worker will serve that
  shell for any path not in its denylist. Reproduce the leak with the denylist entry removed before trusting the fix.
- The canonicalising redirect lower-cases every extensionless path; a mixed-case token dies silently. Look at the redirect
  before choosing a token alphabet.
- Fuzzing the whitelist found a real hole (an event dated year 275760 produced a `+275760-09` date): bound `ts` in the summary
  as the sync validator does.
