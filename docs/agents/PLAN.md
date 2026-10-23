# Stop Biting — Implementation Plan for an Agent Swarm

Source: product gap analysis of https://stopbiting.today (October 2026).
Audience: Claude Code agents working in parallel on the Stop Biting codebase.

This file lists only work that can be done in code. Business tasks are listed separately at the end for the human owner: collecting testimonials, therapist outreach, and Paddle dashboard settings.

> Orchestrator note: this is the owner's plan, copied verbatim. Repo-specific operating rules, assumptions and
> the decisions the orchestrator made where the plan is ambiguous live in `docs/agents/SWARM_RULES.md`. Read both.

---

## 0. Read this first (all agents)

### What the product is today
- A browser web app for laptop and desktop. It uses the webcam with MediaPipe (hand landmarks + face mesh) running in WebAssembly, entirely on the user's device.
- Detection checks about 5 times per second. The alarm fires when the hand stays near the mouth for about 0.6 s.
- Detection has 3 sensitivity levels. Alerts can be a sound or a screen flash.
- A "Minimize" mini-window keeps watching when the user switches tabs.
- History (alarms + manual bite logs + trigger tags such as stress, boredom, focus) is stored **only in this browser**.
- Streak and habit tracking.
- Sign-in is Google only. Payments go through Paddle: $2.99/month or $29/year, with a 3-day trial and no card.
- The marketing site includes a homepage with a 60-second live demo (no account), `/how-it-works`, `/about`, `/pricing`, `/blog`, `/compare/*`, `/solutions/*`, and the legal pages.
- The app is installable as a PWA.

### Step 1 for every agent: discover, don't assume
Before writing code, find out:
- the framework and router
- where detection logic lives (the MediaPipe setup, the "hand near mouth" rule, dwell timer, sensitivity)
- the history storage layer (localStorage or IndexedDB) and its schema
- the auth and Paddle integration, including webhooks
- the backend (if any) and its database
- the test setup
- how marketing pages and meta tags are generated

Write findings to `docs/agents/ARCHITECTURE.md` (Phase 0 agent only). Every other agent reads that file first.

### Rules that cannot be broken
1. **Privacy:** no camera frames, images, landmarks or video ever leave the device. Only small event records (timestamp, behavior type, tags, flags) may be synced, and only after the user opts in. Nail photos stay local (IndexedDB) and are never uploaded.
2. **No made-up facts:** never invent testimonials, user counts, statistics, study results or competitor details. Use clearly marked placeholders (`<!-- TODO(owner): real quote -->`) and keep them hidden until real content exists.
3. **No medical claims:** keep the "an app is not a clinician" stance. Do not claim the app treats any condition.
4. **Claims follow tests:** do not advertise a new detection behavior on the marketing site until WS1 has validated it (see WS1 acceptance criteria).
5. **Feature flags:** every new user-facing feature ships behind a flag (`features.ts` or the project's equivalent), off in production until the owner turns it on.
6. **Data migrations** must be backwards compatible and non-destructive. Old local history must survive every change.
7. **Isolation:** each workstream works in its own git worktree or branch and touches only its own area. Shared files (schema, flags, i18n keys, nav) are changed only by the owner named in the "Shared files" table, or through a small separate PR.
8. **Legal pages:** any change that affects data handling (sync, email, sharing, new sign-in providers) must also draft updates to `/privacy` and `/terms`, marked **NEEDS HUMAN REVIEW**. Do not publish them automatically.

### Shared files and who owns them
| File / area | Owner workstream |
|---|---|
| Event/history schema + migrations | WS0 (then frozen; changes go through a PR to WS0's module) |
| Feature flags registry | WS0 |
| Settings page shell / navigation | WS0 creates the slots; others add their section inside their own slot |
| i18n string extraction | WS12 (runs last) |
| Marketing nav / sitemap | WS11 |

---

## Execution phases

```
Phase 0 (sequential): WS0
Phase 1 (parallel):   WS1, WS2, WS3, WS7a, WS8, WS9, WS11a
Phase 2 (parallel):   WS4 first → then WS5, WS6, WS10 (depend on sync)
                      WS7b (desktop wrapper, optional, any time after WS0)
Phase 3 (sequential): WS11b (marketing for new features), WS12 (i18n)
Final:                WS13 QA/integration agent
```

---

## WS0 — Foundation (Phase 0, one agent)

**Goal:** make the shared structures the other workstreams build on.

Tasks:
- Write `docs/agents/ARCHITECTURE.md` (stack, file map, how detection, storage, auth and payments work).
- **Event schema v2.** Extend the history record with optional fields. Migrate v1 records by filling defaults.
  ```ts
  type HabitEvent = {
    id: string;              // uuid
    ts: number;              // epoch ms
    source: 'alarm' | 'manual';
    behavior: 'nail_biting' | 'cuticle_skin_biting' | 'nose_picking'
            | 'eye_area_pulling' | 'face_skin_picking' | 'hair_pulling'; // default 'nail_biting'
    hand?: 'left' | 'right' | 'unknown';
    triggers?: string[];     // existing tags
    falsePositive?: boolean; // set by WS3
    competingResponse?: { done: boolean; durationSec?: number }; // set by WS2
    deviceId?: string;       // for WS4 sync
    updatedAt: number;
    deleted?: boolean;       // tombstone for sync
  };
  ```
- A schema version number plus a migration runner, with unit tests (v1 → v2 must not lose any events).
- A feature flags registry, with flags for every workstream below.
- A settings page shell with sections: Detection, Alerts, Behaviors, Schedule, Account & Sync, Data, Sharing.
- One storage access module that every other workstream must use (no direct localStorage/IndexedDB calls).

**Acceptance:** existing users' history and streaks are unchanged after migration. All existing tests pass. ARCHITECTURE.md is complete.

---

## WS1 — Detect more behaviors (Phase 1)

**Why:** this is the biggest competitive gap. Hands Off detects 6 behaviors (nail biting, eyebrow and eyelash pulling, nose picking, ear picking, skin picking). Stop Biting detects nail biting only.

**Approach:** generalize "hand near mouth" into **face zones** defined by face mesh landmarks, each with its own distance threshold and dwell time:

| Behavior | Zone (face-mesh based) | Fingertip rule | Priority |
|---|---|---|---|
| Cuticle / skin biting around nails | Mouth (same as nails) | Same as nail biting; logged as a separate behavior chosen by the user | P0 — cheapest |
| Nose picking | Nostrils | Index/pinky tip inside the nostril zone | P1 |
| Eyelash / eyebrow pulling | Eye + brow region | Thumb–index pinch near the eye/brow zone | P1 |
| Face skin picking | Cheeks / chin / forehead | Fingertip touching skin, held for a while, with small repeated motion | P2 |
| Hair pulling (scalp) | Above the forehead (estimated) | Hand above the head outline, pinch gesture | P2 (hardest; may need the camera framed higher) |

Tasks:
- Refactor the detector into a `ZoneRule` interface (`zone`, `fingerFilter`, `distanceThreshold`, `dwellMs`, `gesture?`). Keep nail biting behavior **exactly the same** (regression test).
- Settings → Behaviors: a multi-select list of behaviors to monitor. Show only behaviors that have reached the "validated" level.
- Every alarm event records `behavior`.
- History and stats filter by behavior.
- A validation harness: `scripts/eval-detection` replays recorded landmark sequences (JSON fixtures — landmarks only, not video), and reports precision and recall per rule. Commit a fixture format and a handful of synthetic fixtures. The owner records real ones.
- Keep CPU cost reasonable. Measure the frame-processing budget before and after, and don't push it more than about 20% higher.

**Acceptance:** nail biting regression tests pass unchanged. Each new rule has fixtures and an eval report. Rules below a precision threshold the owner sets stay behind the `experimental` flag.

---

## WS2 — Post-alarm coaching / HRT program (Phase 1)

**Why:** right now the app stops at awareness, and the site says the competing response "is yours". HabitAware sells HRT strategies as an upgrade. Turning the competing response into a guided program makes the product more complete.

Tasks:
- **Competing response prompt:** after an alarm, show an optional overlay (also in the minimized window) with the user's chosen competing response (e.g. "Clench your fists — 30 s", "Palms flat on the desk"). It has a countdown ring and Done / Skip buttons, and saves `competingResponse` on the event.
- Settings: pick or write your own competing responses. Duration 15–60 s. Prompt on: every alarm, first alarm per hour, or off.
- **Urge surfing / breathing timer:** a "I feel an urge" button that starts a 60–90 s guided breathing animation and logs a manual event with source `manual` and trigger `urge`.
- **Guided 4-week program (content-driven):** a JSON/MD lesson set (one short lesson per day: awareness, competing response, trigger mapping, relapse handling). Track progress and unlock lessons daily. Write lesson text carefully, without medical claims, and mark it **NEEDS HUMAN REVIEW**.
- Stats: % of alarms followed by a completed competing response.

**Acceptance:** the overlay never blocks the alarm and can always be dismissed. Everything works offline. Flagged.

---

## WS3 — Fewer false alarms (Phase 1)

**Why:** the site itself warns that resting your chin on your fingers can trigger the alarm. False alarms are the main reason people quit tools like this.

Tasks:
- **"Not a bite" button** on the alarm toast, the minimized window and History. It sets `falsePositive: true` and doesn't count toward stats or streaks.
- **Adaptive suppression:** keep a local, per-user record of false-positive poses (e.g. knuckles under the chin, palm against the cheek). Learn a simple local adjustment: for example, raise the dwell time or require fingertips (not knuckles or palm) to be closest to the lips when the pose matches recent false positives. Everything local; no training data leaves the device.
- **Optional 60-second calibration** at onboarding: "rest your chin normally" (negative sample) and "bring a fingertip to your lips" (positive sample). Use these to tune thresholds.
- **Hand filter:** monitor both hands, the left only, or the right only.
- **Chin-rest rule:** if the palm or knuckles touch the chin and no fingertip is within X of the lips, don't fire.
- Show false-positive rate in stats so users can see accuracy improving.

**Acceptance:** an eval harness (shared with WS1) shows fewer false positives on chin-rest fixtures, with nail-biting recall no more than about 5% lower. Flagged.

---

## WS4 — Optional sync of history (Phase 2, do first)

**Why:** history lives in one browser. Clearing the cache or switching computers wipes the streak. Sync is also required by WS5 (email), WS6 (mobile) and WS10 (therapist sharing).

Tasks:
- Backend: an authenticated endpoint for HabitEvent records only (`POST /api/events/sync` with a since-cursor; server is last-write-wins by `updatedAt`; supports tombstones). Use the existing backend and DB if there is one. Otherwise propose the smallest option in ARCHITECTURE.md and stop for owner approval before adding infrastructure.
- Client: **opt-in** toggle in Account & Sync. The first sync merges local + server records by `id`. Background sync runs every N minutes and on page focus, and works offline-first with a queue.
- **Never sync:** video, frames, landmarks, nail photos, calibration samples.
- Data controls: **Export** (JSON + CSV), **Import** (JSON), **Delete synced data** (server wipe) and **Delete everything**.
- Also make export/import available without sync, so users have a manual backup even without an account change.
- Draft privacy policy wording for the change (NEEDS HUMAN REVIEW).

**Acceptance:** two browsers on one account converge to the same history. Sync off = zero event network calls (verify in a test). Export → wipe → import restores the history exactly.

---

## WS5 — Progress & insights (Phase 2, after WS4 for email; local parts can start in Phase 1)

Tasks:
- **Charts (local):** daily and weekly counts, a heatmap by hour × weekday, trigger breakdown, trend vs previous week, competing-response rate (WS2), false-positive rate (WS3).
- **Nail photo diary (local only, IndexedDB):** take a guided photo of your hands with the webcam (hands only, framing guide) once a week. Before/after comparison slider. Never synced or uploaded; say so in the UI. Delete per photo or all.
- **Milestones:** first alarm-free hour, first day, 7 days, 30 days, "100 bites caught". Show a celebration screen plus an optional share card (generated image with stats only, no photo unless the user adds it).
- **Weekly email (requires WS4 + opt-in):** a server-side job builds a summary from synced events (count, % change, top trigger, best day). Includes an unsubscribe link. Use the project's email provider, or put a TODO for the owner to pick one.

**Acceptance:** charts render with 0, 1 and 10,000 events. Photo diary works offline, and a test verifies no photo data appears in any network request. Email only goes to opted-in users.

---

## WS6 — Phone companion (Phase 2, after WS4)

**Why:** biting happens away from the desk too. Today the phone experience is just "Email me the link".

Tasks:
- A responsive, installable **phone view** of the app (no detection), shown when the device is mobile or has no suitable webcam:
  - big "I bit / I felt an urge" buttons with quick trigger tags
  - current streak, today's count, recent history
  - the WS2 urge/breathing timer
- With sync on, logs from the phone merge into desktop history. With sync off, events stay local on the phone (and the UI says so).
- Keep "Email me the link" as a secondary action for setting up the desktop.
- PWA manifest and icons that work well on iOS and Android home screens.

**Acceptance:** Lighthouse PWA and mobile checks pass. Logging takes 2 taps or fewer.

---

## WS7a — Keep watching in the background (browser) (Phase 1)

Tasks:
- Use the **Document Picture-in-Picture API** where supported (Chromium) for the minimized watcher, with a fallback to the current Minimize window. Make sure detection keeps its rate when the main tab is hidden (run the detection loop in the PiP window, a worker, or wherever the browser doesn't throttle it; measure and document what you find).
- **Schedules:** auto-start reminders during the user's work hours (a notification that says "Start watching?" and opens the app). Ask for Notification permission only when the user enables this.
- **Pause controls:** pause for 15 min / 1 h / until tomorrow, plus a "meeting mode" that is silent and shows a flash only. Show the pause state clearly, and auto-resume.
- Optional gentle reminder if the app has been closed during scheduled hours (only if notifications were allowed).

**Acceptance:** with the main tab hidden for 10 minutes, detection still fires within about 1 s (on supported browsers). Behavior on unsupported browsers is documented in ARCHITECTURE.md.

## WS7b — Desktop app wrapper (optional, any time after WS0)

- Wrap the web app with **Tauri** (preferred for size) or Electron. Features: tray icon, launch at login, runs while minimized, native notifications, pause from the tray menu.
- Reuse the web code; no separate detection logic.
- Code signing and notarization steps are documented for the owner (needs certificates — human task).
- Build CI for macOS (universal) and Windows.

**Acceptance:** the installer runs on macOS and Windows. The camera permission prompt is explained. Detection runs with the window hidden.

---

## WS8 — More sign-in options (Phase 1)

**Why:** Google-only sign-in turns away privacy-minded users — the very people the local-AI pitch attracts.

Tasks:
- Add **email magic link**, **Sign in with Apple** and **Microsoft**. Link them to existing accounts by verified email.
- Keep existing Google users unaffected.
- Update the homepage copy and FAQ about "Do I need a Google account?" (WS11 owns the copy and gets the new facts from this workstream).
- Provider app registration and keys are a human task. Read them from env vars and document them in `.env.example`.

**Acceptance:** all four methods work in staging. One person signing in with two methods (same email) ends up in one account.

---

## WS9 — Pricing, trial, referrals (Phase 1)

Tasks:
- Make the **trial length configurable** (default proposal: 7 days). Update every place that shows "3-day" (site, FAQ, meta descriptions, emails) from one constant.
- Add an optional **free tier** behind a flag (e.g. X hours of detection per day, or basic history only). The owner decides the limits.
- Support a **lifetime plan** and **gift purchase** in the Paddle integration (checkout + webhook handling + entitlement). Creating the products in the Paddle dashboard is a human task. Use env/config IDs.
- **Referral program:** a personal link per user. When a referred user pays, both get 1 free month (or whatever the owner configures). Track this server-side from Paddle webhooks. Add basic fraud checks (no self-referral, same payment method).
- Pricing page shows regional pricing if Paddle localized prices are enabled (read from Paddle; don't hardcode).

**Acceptance:** entitlements are correct for trial, monthly, yearly, lifetime, gift and referral credit. Webhook handling is idempotent, with tests.

---

## WS10 — Therapist / accountability share link (Phase 2, after WS4)

Tasks:
- The user creates a **read-only share link** (random token, revocable, optional expiry) showing: counts over time, triggers, competing-response rate, streak. No photos, no raw timestamps unless the user turns on "detailed".
- Optional printable / PDF summary for appointments.
- A list of active links in Settings → Sharing, each with a "Revoke" button.
- Pages use `noindex`.
- Draft privacy wording (NEEDS HUMAN REVIEW).

**Acceptance:** a revoked link returns 404. The share page leaks nothing beyond the selected scope (test it).

---

## WS11a — Marketing site fixes (Phase 1)

Tasks:
- **`/how-it-works` meta fixes:**
  - It uses an older social share image (`/og-image.png`); switch to the current `/og/site.png` style (or a page-specific image in the same style).
  - Its `theme-color` is `#020617`, while the homepage uses `#F7F7F1`. Use one consistently.
- **Make privacy claims consistent:** `/how-it-works` says "No cloud, no server, 100% private", while the homepage carefully says "no camera data is sent while it runs". Use the precise homepage wording everywhere (sign-in and payments do use the network). Search the whole site for similar overclaims.
- **Per-page meta keywords/descriptions:** every page currently shares the same `meta-keywords` list (including "nail care"). Generate page-specific descriptions. Keywords can be dropped entirely.
- **Social proof section** on the homepage and pricing page: a testimonial component (quote, first name, how long they bit, optional before/after photo with consent). It renders **only when real entries exist** in a content file. Ship it with an empty data file and a `README` for the owner. Never make up quotes.
- **Comparison pages:** `/compare/hands-off` and `/compare/habitaware-keen` in the same tone as the existing compare pages: factual, dated, linking to each vendor's own site, and saying honestly where the other product is the better fit. Every competitor fact needs a source URL in a code comment. Mark facts **NEEDS HUMAN VERIFICATION** before publishing. Add them to the sitemap and footer.
- Add structured data (FAQPage, SoftwareApplication with offers) if it's missing, and validate it.

**Acceptance:** Lighthouse SEO is 100 on changed pages. No unsourced claims. The testimonial section is hidden when empty.

## WS11b — Marketing for new features (Phase 3)

- Once WS1 behaviors are validated: landing pages (e.g. `/solutions/cuticle-biting`, `/solutions/skin-picking`, `/solutions/nose-picking`, `/solutions/trichotillomania` only if validated). Update the homepage hero/FAQ ("detects nail biting only" → the accurate list).
- Pages for the HRT program (WS2), the phone companion (WS6), the desktop app (WS7b), therapist sharing (WS10) and the referral program (WS9). Each page publishes only when its feature flag is on in production.
- Update FAQ answers affected by WS4 (history now syncs, optionally), WS8 (sign-in options) and WS9 (trial length).

---

## WS12 — Localization (Phase 3, last)

- Extract every user-facing string (app + marketing) into i18n files. Add **Spanish (es)**, **German (de)** and **Brazilian Portuguese (pt-BR)**.
- Localized routes for marketing pages (`/es/...`), with `hreflang` tags and localized meta/OG tags.
- Machine-draft translations, marked **NEEDS NATIVE REVIEW** before going live (flag per locale).
- Number, date and currency formatting by locale.

**Acceptance:** no hardcoded strings remain (lint rule). Switching locale covers 100% of app screens.

---

## WS13 — Integration & QA (final agent)

- Merge order: WS0 → Phase 1 branches → WS4 → Phase 2 → Phase 3. Resolve conflicts in shared files following the ownership table.
- Run the full test suite, the detection eval harness (WS1/WS3), Lighthouse (site + PWA) and an accessibility check (keyboard navigation for all new overlays, reduced-motion support for the breathing animation, color contrast).
- **Privacy audit:** a test that records all network requests during a 5-minute detection session (sync off and sync on) and fails if any request contains image data, landmarks or frames.
- Write `docs/agents/RELEASE_NOTES.md`: what was built, which flags exist, what the human must do before turning each flag on.

---

## Human-owner checklist (not for agents)

- [ ] Collect 3–10 real testimonials (with consent), plus before/after nail photos if possible → put them in the testimonial data file.
- [ ] Record real landmark fixtures for each new behavior and set the precision threshold for WS1/WS3.
- [ ] Review all **NEEDS HUMAN REVIEW** items: privacy policy, terms, HRT lesson text, comparison-page facts, translations.
- [ ] Paddle: create lifetime/gift products, decide the trial length and free-tier limits, enable localized pricing.
- [ ] OAuth app registrations (Apple, Microsoft) and an email provider (magic link + weekly email).
- [ ] Code-signing certificates if shipping the desktop app (WS7b).
- [ ] Contact BFRB-informed therapists once sharing (WS10) is live.
- [ ] Turn on feature flags one by one and watch false-positive rate, trial→paid conversion and churn after each.
