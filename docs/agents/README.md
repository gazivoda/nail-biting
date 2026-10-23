# docs/agents: index

Everything the Stop Biting multi-agent build left behind, in one list. Written by WS13 on 2026-10-24 (`main` at b6b16f9). WS12
(localization) had not landed yet: when it does it adds `ws12*-notes.md` here and the WS13 agent updates this index.

## Start here

| If you are | Read first |
|---|---|
| **The owner** | [`RELEASE_NOTES.md`](RELEASE_NOTES.md): what was built, the 27 flags and the order to turn them on, every environment variable, everything that needs your review, known gaps, deploy and rollback. Then the "Owner TODOs" at the end of the `wsN-notes.md` of any flag you are about to turn on, and the matching draft in [`legal/`](legal/). |
| **An agent or developer joining the code** | [`ARCHITECTURE.md`](ARCHITECTURE.md) (the reference, kept at its final state), then [`SWARM_RULES.md`](SWARM_RULES.md) (the rules that still apply), then `tasks/lessons.md`. |
| **Looking for what a QA run found** | The WS13 QA reports below and the "QA results" section at the end of `RELEASE_NOTES.md`. |

Owner-facing files, in reading order: `RELEASE_NOTES.md`, `legal/*`, `../DESKTOP_SIGNING.md`, then the notes of the features you care about.
Everything else is for people working on the code.

## The plan and the rules

| File | What it is | Who should read it |
|---|---|---|
| [`PLAN.md`](PLAN.md) | The owner's implementation plan for the swarm, verbatim: section 0 (rules that cannot be broken), then WS0 to WS13 and the owner's checklist. | Anyone who wants to know what was asked for. |
| [`SWARM_RULES.md`](SWARM_RULES.md) | The orchestrator's repo-specific rules and decisions where the plan was ambiguous (flags are server-side, no new dependencies, never depict the habit, approved privacy wording, definition of done). Where it disagrees with the plan, it wins. | Every agent; the owner for the decisions marked OWNER DECISION PENDING. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The reference: stack, detection, history and event schema v2, storage module, feature flags, server and database, Settings shell, marketing pages, PWA, Electron, tests, file ownership map, gotchas, and sections per feature area (background watching, sign-in providers, sync, billing, coaching, insights, share links) ending with a table of where each flag is checked. | Developers and agents. |
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | The owner's guide to the finished build (above). | **The owner.** |

## Per-workstream notes

Each says what exists, how to turn it on, what the human must do first, what was and was not verified, and the seams it left in shared
files. The first block is what the owner needs; the rest is detail.

| File | Workstream | What it covers | Read it if |
|---|---|---|---|
| [`ws0-notes.md`](ws0-notes.md) | WS0 Foundation | Event schema v2, the pre-migration backup, storage module, 27 flags, route registry, empty Settings sections. | You turn flags on or off, or need to undo the history upgrade. |
| [`ws1-notes.md`](ws1-notes.md) | WS1 More behaviours | Zone rules, six behaviours, validated versus experimental, how to record real fixtures and promote a rule. | You consider `detection_behaviors` or `experimental`. |
| [`ws2-notes.md`](ws2-notes.md) | WS2 Coaching | Competing-response prompt, urge timer, the 28-lesson program (NEEDS HUMAN REVIEW), why it cannot block an alarm. | Before `hrt_coaching`. |
| [`ws3-notes.md`](ws3-notes.md) | WS3 Fewer false alarms | "Not a bite", chin-rest rule, learned poses, hand filter, calibration, what is stored, the NOT verified list. | Before `false_positive_controls`. |
| [`ws4-notes.md`](ws4-notes.md) | WS4 Sync, export, import | Endpoints, limits, schema, the contract other features use to read events, privacy enforcement, known limits. | Before `event_sync` or `data_backup`; when deleting an account by hand. |
| [`ws5-notes.md`](ws5-notes.md) | WS5 Insights | Charts, milestones, photo diary, weekly email; event semantics; what is not verified. | Before `insights`, `photo_diary`, `weekly_email`. |
| [`ws6-notes.md`](ws6-notes.md) | WS6 Phone companion | The phone view, tap budget, offline start, install on iOS and Android, Lighthouse numbers, NOT verified. | Before `phone_companion`. |
| [`ws7a-notes.md`](ws7a-notes.md) | WS7a Background watching | What a browser does to a hidden tab (measured), the mechanism, pause and meeting mode, schedule, what was not built. | Before `background_watching`. |
| [`ws7a-measurements/`](ws7a-measurements/) | WS7a | Raw JSON results of the 700-second runs behind those numbers. `node scripts/background-probe/tables.mjs` prints them as tables. | You want to re-check or repeat a measurement. |
| [`ws7b-notes.md`](ws7b-notes.md) | WS7b Desktop app | Tray, launch at login, camera card, the contract with WS7a, known gaps before a public release (sign-in does not work, unsigned, Windows never built). | Before any desktop work; **before `desktop_app`**. |
| [`ws8-notes.md`](ws8-notes.md) | WS8 Sign-in options | Routes, Apple and Microsoft setup steps, the account-linking rule, security review, findings in existing code (`trust proxy`, Resend, `ELECTRON_PROTOCOL`). | Before any `signin_*` flag. |
| [`ws9-notes.md`](ws9-notes.md) | WS9 Pricing, trial, referrals | `TRIAL_DAYS`, the access decision, Paddle steps, the webhook step by step, referral rules and limits, owner decisions. | Before any pricing flag or a trial-length change. |
| [`ws10-notes.md`](ws10-notes.md) | WS10 Share links | Endpoints, exactly what a link reveals, the page, the service-worker caveat. | Before `share_links`. |
| [`ws11a-notes.md`](ws11a-notes.md) | WS11a Site fixes | Privacy wording changes, meta, FAQ markup, testimonials, the two competitor pages and **every competitor fact with its source URL**. | Before `compare_competitors` or `social_proof`. |
| [`ws11b-notes.md`](ws11b-notes.md) | WS11b Feature marketing | The six gated pages, flag-aware copy rules, the desktop STOP banner, stale legal-page sentences. | Before turning on any feature that has a page. |
| `ws12*-notes.md` | WS12 Localization | **Pending.** Not in this tree yet. | Before any `locale_*` flag. |

## Evaluation reports (synthetic: do not quote them)

| File | What it is | Read it if |
|---|---|---|
| [`ws1-eval-report.md`](ws1-eval-report.md) | Precision and recall per detection rule on 35 synthetic landmark scenes (generated by `npm run eval:detection`). Labelled SYNTHETIC at the top. | You want to know what "validated" does and does not mean. |
| [`ws3-eval-report.md`](ws3-eval-report.md) | The same scenes with and without the false-alarm controls (shipped 0.35 against controls 0.41 at medium sensitivity). Labelled SYNTHETIC. | Before trusting the chin-rest rule. |

## Legal drafts: every file starts with NEEDS HUMAN REVIEW (owner)

None of these is published; `PrivacyPage.tsx`, `TermsPage.tsx`, `RefundPage.tsx` and `LegalPage.tsx` were not edited by any agent. Publish
each with the flag named. The sentences on those pages that go stale are tabled in `RELEASE_NOTES.md` section (d2).

| File | Turn on with | Covers |
|---|---|---|
| [`legal/ws3-privacy.md`](legal/ws3-privacy.md) | `false_positive_controls` | Learned poses and calibration kept in the browser. |
| [`legal/ws4-privacy.md`](legal/ws4-privacy.md), [`ws4-terms.md`](legal/ws4-terms.md) | `event_sync`, `data_backup` | What is synced and stored, deletion, portability, "sync is not a backup". |
| [`legal/ws5-privacy.md`](legal/ws5-privacy.md), [`ws5-terms.md`](legal/ws5-terms.md) | `weekly_email`, `photo_diary`, `insights` | Weekly email, photo diary, charts and the share picture. |
| [`legal/ws8-privacy.md`](legal/ws8-privacy.md), [`ws8-terms.md`](legal/ws8-terms.md) | `signin_*` | Apple, Microsoft and emailed link; cookies; link records. |
| [`legal/ws9-terms.md`](legal/ws9-terms.md), [`ws9-refund.md`](legal/ws9-refund.md) | `lifetime_plan`, `gift_plan`, `referrals`, `free_tier`, `regional_pricing` | Lifetime, gifts, referrals, free plan, local prices, refunds; the sentences to edit if `TRIAL_DAYS` changes. |
| [`legal/ws10-privacy.md`](legal/ws10-privacy.md), [`ws10-terms.md`](legal/ws10-terms.md) | `share_links` | Share links. |

## WS13 QA reports

Written by the WS13 agent at the same time as this index, so some may not exist yet when you read this; the summary is in the "QA
results" section at the end of `RELEASE_NOTES.md`. Owner and developers.

| File | What it is |
|---|---|
| `privacy-audit-report.md` | What the privacy audit recorded during detection sessions with sync off and on: whether any request carried image data, landmarks or frames. (The audit script lives in `scripts/privacy-audit/`.) |
| `flags-off-diff-report.md` | A comparison of the build with every flag off against what was live before: that nothing visible changed. |
| `accessibility-report.md` | Keyboard navigation of the new overlays, reduced-motion support for the breathing animation, colour contrast. |
| `lighthouse-report.md` | Lighthouse results for the site and the PWA / mobile checks. |

## Outside this folder, but part of the same hand-over

| File | What it is | Who should read it |
|---|---|---|
| [`../DESKTOP_SIGNING.md`](../DESKTOP_SIGNING.md) | Step by step code signing and notarization for the Mac and Windows desktop app (OWNER TODO), what unsigned costs, the desktop CI workflow. | The owner, before any desktop release. |
| [`../../COOLIFY_DEPLOY.md`](../../COOLIFY_DEPLOY.md) | Deploy instructions. **Line 24 (`ELECTRON_PROTOCOL=stopbiting`) is wrong for the website and should be deleted.** | The owner. |
| [`../../.env.example`](../../.env.example) | Every environment variable with its default and a comment. | The owner. |
| [`../../src/data/README-testimonials.md`](../../src/data/README-testimonials.md) | How to add real, consented testimonials (the section stays hidden while the file is empty). | The owner. |
| [`../../scripts/eval-detection/README.md`](../../scripts/eval-detection/README.md) | The detection evaluation harness and the dev recorder for real landmark fixtures. | The owner and developers. |
| [`../../tasks/todo.md`](../../tasks/todo.md), [`../../tasks/lessons.md`](../../tasks/lessons.md) | The orchestrator's running log of the swarm ("Swarm: Stop Biting gap-analysis plan") and the repo's lessons. | The owner and agents. |
