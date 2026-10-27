NEEDS HUMAN REVIEW

# Analytics draft: Privacy Policy wording for in-app milestones sent to Google Analytics

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx`, the About copy and the no-JS mirrors in `server.js` have NOT been
edited (rule 8). The flag `app_analytics` ships OFF and **must stay off until the wording in "Suggested text" (or your own
version of it) is approved and applied**. The statements under "What the code does" are checked against the code and its
tests; the wording under "Suggested text" is for the owner or a lawyer to adapt. Line numbers are as of `d5bf284` plus the
analytics commits and will drift.

## Why this exists

Google Analytics (GA) cannot see anything inside the app today, so the owner cannot tell where people drop after the
landing page. Three parameter-free events close that gap: `signin_complete`, `detection_start`, `first_alarm`.

The Privacy Policy currently promises (`src/pages/PrivacyPage.tsx:29`, section 3, "Data We Collect"):

> Website analytics: Google Analytics records page visits (pages viewed, approximate location, device and browser type) so we
> can see how people find and use the site. **It never receives anything from your camera or your habit log.**

`detection_start` (the camera is on and the detector is running) and `first_alarm` (the habit detector fired) are signals
from the camera and the habit detector, even when they carry no parameter. So they cannot go out under that sentence, and
they ship behind a new flag, `app_analytics`, that is off. `signin_complete` is not such a signal (see its own section).

## What the code does (facts to check the wording against)

All three go through the existing `track()` (`src/utils/track.ts`): `window.gtag('event', name, undefined)`. **No
parameters of any kind**: no `source`, no count, no time, no duration, no label derived from the log or the user. There is
no `user_id`, no `gtag('set', ...)` and no custom dimension anywhere in the code; `index.html` only calls
`gtag('config', '<measurement id>')`. GA attaches its usual pseudonymous browser identifier (the `_ga` cookie the policy
already discloses in section 10) and the usual page data (page address, approximate location, device and browser type) to
every event it receives, as it does to a page visit. Nothing is sent when `gtag` has not loaded (blocked, offline).

| Event | Flag | Fires when | Where (file:line) | At most |
|---|---|---|---|---|
| `signin_complete` | none | A session first appears on a browser that had no `sb_has_session` marker, confirmed by the server (`/api/user/me`). Not for a returning session restored silently, the offline phone grant, the dev preview or `refreshProfile`. Sign-out clears the marker, so a later sign-in on the same browser counts again. | `src/contexts/AuthContext.tsx:77-80` (`applyUser`), helper `claimFreshSignIn` and `trackSignInComplete` in `src/utils/appAnalytics.ts` | once per sign-in |
| `detection_start` | `app_analytics` | Detection really started with the camera on: the switch is on, nothing has paused it, the camera works and the detector is running (`isDetecting`, `src/background/pauseMachine.ts`). Only the signed-in app's `CameraView`; the landing-page demo never counts. | `src/components/detection/CameraView.tsx:84` (effect on `running`) | once per page load |
| `first_alarm` | `app_analytics` | The detector raised an alert in the signed-in app (`handleAlert`, the single seam every alarm passes through, in the foreground, in the mini window and in a hidden tab). The marker `sb:app:first-alarm-sent` (a boolean, no value derived from the log) is written only after the event was sent. | `src/components/detection/CameraView.tsx:54` | once per device |

- **Flag off is the current behaviour, byte for byte.** `trackApp` returns before it reads or writes anything except the
  cached feature flags. Nothing is sent, and no marker is written, so a device that raised alarms while the flag was off
  still sends its `first_alarm` after the flag is turned on.
- **The flag is read from the cached `/api/features` answer**, not from the build: the owner turns it on with
  `FEATURE_FLAGS` and a restart, no rebuild. A page that has not yet received the answer reads it as off, so the first
  event after a cold first visit can be missed (an undercount, never an overcount).
- **What is NOT sent**: camera frames, images, landmarks, how many alarms there were, when, for how long, which behaviour,
  which trigger, anything typed, the account's email or id, the plan or trial state.
- **What a person can see**: the Network tab shows a request to `www.google-analytics.com/g/collect` carrying
  `en=detection_start` (or `first_alarm`, `signin_complete`). That request carries no camera data, so "no camera data is sent
  while it runs" stays literally true. The wording around "check it yourself" is listed below because a person who looks
  will now see it.
- **Existing users**: every existing device sends `first_alarm` once, at its next alarm after the flag is turned on, so
  the count at the start is not "new people". In GA use a closed funnel that starts at `signin_complete` (which only new
  sign-ins send) or segment by new users.
- **What the privacy audit says**: see "Privacy audit evidence" at the end. In short, it passes with the flag on and off,
  because it checks for images, landmarks and video, not for event names. A green audit is not approval of the wording.

## Suggested text (adapt, do not paste blindly)

### 1. Privacy Policy, section 3 (`PrivacyPage.tsx:29`), replace the "Website analytics" sentence

Current:

> Website analytics: Google Analytics records page visits (pages viewed, approximate location, device and browser type) so we
> can see how people find and use the site. It never receives anything from your camera or your habit log.

Proposed:

> Website analytics: Google Analytics records page visits (pages viewed, approximate location, device and browser type) so we
> can see how people find and use the site. Inside the app it also receives three counts, each with nothing attached: that
> someone signed in, that camera detection was started, and that the habit detector raised its first alert on a device.
> These counts carry no camera images, no video, no entries from your habit log, and no times or numbers. Google Analytics
> never receives your camera images, anything the camera sees, or the contents of your habit log.

Why this wording: it names the three milestones honestly (including the two that come from the camera and the detector),
says plainly that they carry nothing, and keeps the promise that is still true (no images, nothing the camera sees, no log
contents). It does not say "nothing from your camera", which is no longer a fair summary. It does not say "nothing leaves
your device" (not allowed, sign-in and payments use the network). The approved line stays as it is: "Detection runs on
your device. No camera data is sent while it runs."

### 2. Privacy Policy, section 4 (`PrivacyPage.tsx:40`)

Current: `To understand, in aggregate, which pages people visit (Google Analytics).`

Proposed: `To understand, in aggregate, which pages people visit and how far people get in the app: signed in, started detection, first alert (Google Analytics).`

### 3. Privacy Policy, section 3, last bullet (`PrivacyPage.tsx:31`), decide, probably leave

`We do not collect biometric data or any data from your camera.` Still literally true: the three counts are not camera data
and are not biometric. A cautious reader could still weigh "camera detection was started" against it. Decide with the
owner or a lawyer whether to leave it or add "(the counts above say only that something happened)".

### 4. About page (the English source and its three translations)

`src/i18n/scopes/marketing-about.ts:26` (`privacy.p2`): "No video, no frames and **no detections are transmitted**." This is
the one that becomes **untrue** with `first_alarm` (a first alert is a detection result, even as a bare count). Proposed:

> All video processing runs in WebAssembly on your device. No video and no frames are transmitted, and no record of any
> detection is sent to us. You can disconnect your internet connection after the app loads and it will function
> identically. You can verify this by watching your network traffic while the app runs: you will see only a Google
> Analytics count when detection starts and one when the first alert happens, with nothing attached.

`src/i18n/scopes/marketing-about.ts:27` (`privacy.p3`): "...The site counts page visits with Google Analytics; **that never
includes anything from your camera**." Proposed:

> Your alarm and bite log is stored in your browser. The site counts page visits with Google Analytics, plus three bare
> counts inside the app: signed in, detection started, first alert. None of them carries anything from your camera or your log.

## Every place that repeats the promise, and what to do (grep, `d5bf284`)

Searches: `never receives anything from your camera`, `never includes anything from your camera`, `no detections`, `Google
Analytics` (all of `server.js`, `server/`, `src/pages`, `src/components`, `src/i18n`, `public/llms.txt`, `index.html`), and
the approved line `No camera data is sent while it runs`.

**Must change together with the flag (the promise itself):**

| File:line | Sentence | Change |
|---|---|---|
| `src/pages/PrivacyPage.tsx:29` | "...It never receives anything from your camera or your habit log." | Proposed text 1. This is the sentence the flag is gated on. |
| `src/pages/PrivacyPage.tsx:40` | "To understand, in aggregate, which pages people visit (Google Analytics)." | Proposed text 2. |
| `src/pages/PrivacyPage.tsx:7` | `lastUpdated="September 26, 2026"` | The publish date. |
| `server.js:2032` | the `/privacy` no-JS mirror: "Last updated September 26, 2026. ..." (it mirrors only the overview and the table of contents, not line 29) | The same date. No sentence change. |
| `server.js:2220` | About no-JS mirror: "No video, no frames and no detections are transmitted." | Proposed text 4 (`privacy.p2`). Becomes untrue with `first_alarm`. |
| `server.js:2222` | About no-JS mirror: "The site counts page visits with Google Analytics; that never includes anything from your camera." | Proposed text 4 (`privacy.p3`). |
| `src/i18n/scopes/marketing-about.ts:26`, `:27` | `privacy.p2`, `privacy.p3`, the English source the About page renders | As above. |
| `src/i18n/locales/es/marketing-about.ts:22-23`, `.../de/marketing-about.ts:22-23`, `.../pt-BR/marketing-about.ts:22-23` | The Spanish, German and Brazilian Portuguese copies of the same two sentences ("No se transmiten ... detecciones", "eso nunca incluye nada de tu cámara"; "weder Video noch Einzelbilder noch Erkennungen", "dabei wird nie etwas von deiner Kamera erfasst"; "nenhuma detecção é transmitido", "isso nunca inclui nada da sua câmera") | Re-translate from the final English. They are machine translations: have the same native speaker who reviews the rest (`src/i18n/locales/<language>/reviewed.ts`) read these two. Keep the ICU `{sync, select, ...}` part of `privacy.p3` as it is. |
| `src/data/blogPosts.ts:395` (post `how-ai-can-help-stop-nail-biting`, FAQ answer "What are the privacy implications...") | "...the site counts page visits with Google Analytics, but none of that includes camera data." | With the flag on this becomes a half-truth ("counts page visits" is no longer all it counts). Suggested: "...the site counts page visits with Google Analytics, plus three bare counts inside the app (signed in, detection started, first alert) that carry no camera data." Posts are built into `dist/posts/<slug>.json` and `dist/seo-content.json`; edit the source, rebuild, and check the built JSON. |
| `src/data/blogPosts.ts:2026` (post `stop-biting-app-review`) | "...the site counts page visits with Google Analytics; neither ever sees your camera." | "neither ever sees your camera" is the promise again. Suggested: "...the site counts page visits with Google Analytics, plus three bare counts inside the app (signed in, detection started, first alert); none of it includes anything from your camera or your log." |
| `src/i18n/coverage/site.coverage.test.tsx:221` | The test pins the English `privacy.p3` text word for word | Update the string in the same commit, or the test fails (that is the test doing its job). |
| `src/data/pageUpdates.json` (`/privacy` fingerprint `67afffd0b4b0371e`, lastmod `2026-09-26`; `/about`) and `public/sitemap.xml` (`/privacy` line 203 and `/about` line 56, both `lastmod` 2026-09-26) | The freshness ledger and the sitemap | **Do not hand-edit.** Run `npm run seo:sync` after the wording is in; it fingerprints the page content, bumps both `lastmod` values (and the `/about` ones in es, de and pt-BR when those flags are on) and regenerates `public/llms*.txt`. Then `npm run seo:check`. |

**Still literally true, no change needed (the approved line, and the invitation to look at the network).** None of these
says GA gets nothing, and the new counts carry no camera data. Listed so the owner can decide whether to add "apart from
the anonymous counts in the Privacy Policy" to the one place that invites a person to look:

- `src/i18n/scopes/marketing-home.ts:90` (`privacy.p2.rest`, "open your browser's developer tools, go to the Network tab and
  start detection. Once the detection models have downloaded, nothing carrying camera data is sent while it watches") and
  its es, de and pt-BR copies (`marketing-home.ts:68`). This is the sentence a person will test. With the flag on they
  will see a Google Analytics request at the start. The sentence is still true (it carries no camera data); a short
  "apart from..." would stop it looking like a contradiction.
- `src/i18n/scopes/marketing-how.ts:46` (`faq.1.a`), `server.js:2428` and `public/llms.txt:16` ("you can check this yourself by
  watching your network traffic", "which anyone can verify in a browser network monitor"). Same reasoning.
- The approved line "No camera data is sent while it runs" in `public/llms.txt:2,17,29,30,35,57`, `server.js:1732,1736,1763-1765,1788,
  2023,2154,2407,2428,2459,2476,2535`, `src/i18n/scopes/marketing-home.ts:32,88`, `marketing-how.ts`, `src/data/comparePages.ts`
  (lines 185, 330, 380, 425, 471, 751, 1018 and others), `src/data/blogPosts.ts` and `blogIndex.ts`. Not changed: it is
  about camera data, and none is sent. A reviewer who reads "detection started" as camera data would change all of these.
  That is the judgment call this draft cannot make for you.
- Not affected: `src/data/featurePages.ts:137` ("The page carries no analytics" is about the read-only share page, which
  does not load Google Analytics at all), `src/data/comparePages.ts:828,965` ("no analytics" describes competitors, not
  this site) and `server.js:167` (the CSP already allows the Google Analytics hosts; no change).
- No FAQ, JSON-LD or `llms` text outside the list above mentions Google Analytics or repeats the promise. After a build, check
  `dist/seo-content.json`, `dist/posts/*.json` and `dist/llms-full.txt` for the retired strings too (they are generated from
  the sources above).

## `signin_complete`: does it need any wording change? No.

It is not a signal from the camera or the habit log: it says only that a sign-in finished, which is about the account. The
current sentence says Google Analytics records "how people find and use the site", and signing in is a use of the site.
The existing `signin_click` event (a count sent when someone presses "Sign in") has been live since `track.ts` was
introduced under the same sentence. It sends no `user_id`, no email and no account data, so GA cannot tie it to a person
beyond the pseudonymous browser identifier it already has for page visits. It therefore ships live with this change and
needs no flag.

For tidiness, the proposed text above names it ("that someone signed in") so the policy describes all three milestones in
one place. If you apply only that, nothing is wrong in the meantime.

## Turn-on order (exact)

1. **Approve the wording.** Edit "Suggested text" to your liking; decide the three open questions (below). Do not shorten it
   back to "never receives anything from your camera".
2. **Apply it in one commit** (rule 8 means no agent did): `PrivacyPage.tsx:7,29,40`; `server.js:2032,2220,2222`;
   `src/i18n/scopes/marketing-about.ts:26,27`; the es, de and pt-BR copies; `src/data/blogPosts.ts:395,2026`; `site.coverage.test.tsx:221`. Then
   `npm run build:web`, `npm test`, `npm run seo:sync`, `npm run seo:check`, `npm run og:check`, and a grep of the retired
   sentences to zero across `src`, `server.js`, `dist/seo-content.json`, `dist/posts` and `dist/llms-full.txt`.
3. **Deploy** (push `main`, Coolify) with `app_analytics` still off. Check the live `/privacy` and `/about` (raw HTML for the
   no-JS mirror as well as the rendered page).
4. **Wait a day or two** so returning visitors' service workers pick up the new bundle. A tab that still runs an older
   bundle has either no event code at all or the old wording, and the events must not start for a device that only knows
   the old wording.
5. **Turn it on**: in Coolify add `app_analytics` to `FEATURE_FLAGS` (comma separated) and restart. No rebuild. Check
   `https://stopbiting.today/api/features` shows `"app_analytics": true`.
6. **Verify in GA** (Admin > DebugView or Reports > Realtime): `detection_start` appears when you start detection in the
   app, `first_alarm` at your first alarm on that browser (once), and neither has any parameter other than the standard ones.
   Build the funnel in Explore: `page_view` > `trial_click` > `signin_complete` > `detection_start` > `first_alarm`, closed,
   so existing users do not count.
7. **Roll back** by removing the name from `FEATURE_FLAGS` and restarting: browsers re-read the flags within ten minutes of
   the next page load, or at the next load. Events already received stay in GA (delete them there if needed).

## Open questions for you or a lawyer

- Do "camera detection started" and "first alert" count as data from the camera for the purposes of the promise
  "No camera data is sent while it runs" and the line "We do not collect ... any data from your camera"? This draft says
  no (they are bare counts) and says so openly. If you disagree, the approved line needs a qualifier everywhere it
  appears (the list above is long).
- Consent: GA is already loaded for everyone and sets `_ga` cookies; there is no consent banner. Whether adding in-app events
  changes anything where you operate (EU/UK in particular) is not something this draft decides.
- Do you want to name the three milestones in the policy (as proposed), or only say "aggregate counts of how far people get
  in the app"? Naming them is more honest and is what this draft does.

## Privacy audit evidence (`npm run privacy:audit`)

Run on this branch (`433b3fa`, built with `npm run build:web`), headless Chrome with a fake camera, the real server and
a real sign-in, as the audit's own documentation describes (`docs/agents/privacy-audit-report.md`).

**Flag off (`app_analytics` not in `FEATURE_FLAGS`), every mode, 300 s of detection each**

| Mode | Result | Video frames/s to MediaPipe | Logged | Requests | Google Analytics requests |
|---|---|---|---|---|---|
| canary (the audit's negative control) | CAUGHT, 11 of 11 deliberate leaks | n/a | n/a | 135 | n/a |
| flagsoff (`FEATURE_FLAGS` empty) | PASS | 9.64 | 7 bites | 136 | 3 |
| off (sync flag on, nobody opted in) | PASS | 9.63 | 7 bites, 1 urge, 1 photo | 150 | 3 |
| on (opted in to sync) | PASS | 9.60 | 7 bites, 1 urge, 1 photo | 160 | 3 |
| off, probe build (real alarms) | PASS | 9.48 | + 2 real alarms | 151 | 3 |
| on, probe build (real alarms) | PASS | 9.44 | + 2 real alarms | 162 | 3 |

The committed baseline in `privacy-audit-report.md` shows 2 Google Analytics requests per run; it is now 3 with the flag
off because the audit's fresh browser signs in, which is what `signin_complete` counts. No request left for a host outside
the allowlist and none carried an image, a landmark or a video.

**Flag on (`app_analytics` added), which Google Analytics events went out.** The audit's own result file keeps only the first
300 characters of each URL and no beacon bodies, so the event names were read with a scratch copy of the runner that is
identical except that it prints the `en=` name and any custom parameter of every `google-analytics.com/g/collect`
request (not committed; the judge is untouched).

| Run | Verdict | Events seen, in order | Custom parameters on our events |
|---|---|---|---|
| flag off, 60 s | PASS | `page_view`, `signin_complete`, `scroll` (GA's own) | none |
| flag on, 60 s | PASS | `page_view`, `signin_complete`, `scroll`, **`detection_start`** (about 5.9 s in, once) | none |
| flag on, probe build, 120 s, 1 real alarm | PASS | the above + **`first_alarm`** | none |
| flag on, probe build, 300 s, 2 real alarms | PASS | the above, `first_alarm` exactly once | none |

(`scroll` carries GA's built-in `percent_scrolled`; that is Google's own event, not ours.) `signin_complete` goes out right
after `page_view`, which shows the wait for the page's load event works: the Google Analytics tag exists by then.

**What this does and does not prove.** The audit **passes with the flag on**, and that is correct by its own rules: it
hunts for images, landmarks, video, the diary photo and hosts outside the allowlist, and `en=detection_start` is none of
those. It does not look at event names, so it cannot tell the owner that a camera-derived signal now reaches Google. **A
green audit here is not approval of the wording**; this draft is the gate. If you want the audit to enforce the promise
too, the follow-up is a rule that lists the allowed Google Analytics event names and fails on any other name or any
custom (`ep.`/`epn.`) parameter on ours. That changes what the audit judges, so it is your call and was not done here.

Not exercised: a real camera, a real hand, Safari, Firefox, a real Google Analytics property (the audit never reaches
Google's collector; it only records the request the page makes).
