# Swarm operating rules (orchestrator, repo-specific)

Applies to every agent working from `docs/agents/PLAN.md`. Where this file and the plan disagree, this file wins:
it records decisions the orchestrator made so you do not have to guess. Anything marked **OWNER DECISION PENDING**
stays configurable and defaults to the safe value.

## Read first, in this order
1. `docs/agents/PLAN.md` — section 0 plus your own workstream.
2. This file.
3. `tasks/lessons.md` — all of it. It records real mistakes in this repo (CSS layering, `build` vs `build:web`,
   stale service worker, no-JS crawler copy, dark-token inversion, etc.).
4. `docs/agents/ARCHITECTURE.md` (written by WS0; it exists for every agent after WS0).
5. `PRODUCT.md` and `DESIGN.md` before touching UI or copy.

## Repo facts (verified 2026-10-23)
- Vite 5 + React 19 + TypeScript + Tailwind 3 + Zustand 5 (persist → localStorage). `recharts`, `date-fns`,
  `lucide-react`, `resend`, `jsonwebtoken`, `google-auth-library`, `better-sqlite3` are already dependencies.
- Backend: one Express 5 file, `server.js` (~150 KB, also server-renders per-route meta/schema/crawler copy),
  SQLite at `data/users.db` (never commit), transactional email via `email.js` (Resend).
- Auth: Google OAuth only today (`/api/auth/google`, `/api/auth/callback`), JWT cookie, `authMiddleware`.
- Payments: Paddle webhook `POST /api/paddle/webhook`, `verify-subscription`, `portal-session`.
- Tests: vitest, `environment: node`, includes `src/**/*.test.ts` only (WS0 widens this). Baseline: 18 files, 119 tests, all green.
- An Electron wrapper already exists (`electron/`, `vite.electron.config.ts`, `npm run electron:*`). It is NOT marketed
  on the site (the claim was removed on purpose). Do not add desktop-app claims to any page.
- Pushing `main` auto-deploys to stopbiting.today (Coolify). Existing users' browsers run the new bundle at once.
  So: flags default OFF; migrations are non-destructive; nothing user-visible changes with every flag off,
  except WS11a's explicit site fixes.

## Decisions made by the orchestrator
- **Trial length (WS9):** make it configurable from one constant, but the default STAYS 3 days. "7" is the plan's
  proposal and the owner's checklist says the owner decides. **OWNER DECISION PENDING.**
- **Feature flags (WS0):** server-side runtime flags, so the owner flips an env var and restarts with no rebuild.
  Recommended shape: env `FEATURE_FLAGS=sync,hrt,...` read by the server, exposed at `GET /api/features`
  (public, no auth, no PII), cached in the client (last-known value in the storage module so offline use keeps working),
  default all OFF. Dev override: `?ff=a,b` or a localStorage key, guarded by `import.meta.env.DEV`. SSR'd marketing pages
  read the same server flags. Every flagged server route returns 404 when its flag is off. WS0 may refine this but must
  document the final mechanism and how the owner turns a flag on, in ARCHITECTURE.md and `.env.example`.
- **Server structure (WS0):** do not add more code inline to `server.js`. WS0 adds `server/routes/index.js`
  (a registry) and a `ctx` object (`app`, `db`, `authMiddleware`, `sendEmail`, `flags`, ...). Each workstream adds ONE file
  `server/routes/<workstream>.js` and ONE line in the registry. DB tables are created with `CREATE TABLE IF NOT EXISTS`
  / guarded `ALTER TABLE ... ADD COLUMN` only. Never drop or rewrite existing tables.
- **Comparison pages (WS11a):** build both, but they ship behind a flag (off), `noindex` while off, and are NOT in the
  sitemap/footer until the flag is on. Competitor facts need a source URL in a code comment and a
  `NEEDS HUMAN VERIFICATION` marker. Use WebFetch/WebSearch on the vendors' own pages; never write a fact you did not read.
- **Legal (rule 8):** draft wording into `docs/agents/legal/<workstream>-privacy.md` / `-terms.md`, each starting with
  `NEEDS HUMAN REVIEW`. Do NOT edit `PrivacyPage.tsx`, `TermsPage.tsx`, `LegalPage.tsx` or `RefundPage.tsx`.
- **Detection "validated" level (WS1):** only synthetic fixtures exist. Nail biting (and cuticle/skin biting, which is
  the same zone) can be `validated`; every other behavior is `experimental` until the owner records real fixtures and
  sets a precision threshold. Experimental behaviors are hidden unless the `experimental` flag is on.
- **WS7b:** Electron already exists, so use it (no Tauri). Add tray, launch-at-login, pause-from-tray, native
  notifications, CI build workflow, and signing/notarization docs. You cannot run signed installers here: say so.
- **WS12 scope:** app screens + core marketing pages + legal chrome (not the legal text). The ~150 blog posts and
  data-driven long-form pages are NOT translated; document that. Locale flags default off.
- **WS5 charts:** use the existing `recharts` dependency (or plain SVG). No new chart library.

## Hard "do nots" (from the owner's memory and lessons)
- **Never depict the habit.** No drawing, animation, icon or illustration of a hand at the mouth, a biting figure, a
  "warning" pictogram of nail biting — anywhere: HRT overlay, urge timer, photo-diary framing guide, share cards,
  marketing pages, OG images. Show real product UI or neutral shapes. (Owner called a previous one "insulting".)
- **Privacy wording:** never write "100% private", "no cloud, no server", "zero network requests", "nothing leaves your
  device". The approved wording is: *Detection runs on your device. No camera data is sent while it runs.* Sign-in,
  payments and (when on) opt-in sync do use the network; say so where it matters.
- **No invented facts:** testimonials, user counts, stats, study results, competitor details. Placeholders stay hidden.
- **No medical claims.** "Not a medical treatment or a replacement for a therapist." Lesson text is `NEEDS HUMAN REVIEW`.
- **No new npm dependencies.** If you truly cannot do without one, do not install it: implement without it, or list it
  under "NEEDS DEP" in your report.
- **Never copy secrets.** `.env` is real. Use throwaway values in your shell for tests; never commit env files.
- **Do not edit `tasks/lessons.md`** (orchestrator merges lessons from your report). Do not run `npm run seo:sync`
  or `og:generate`, and do not commit generated files (`public/sitemap.xml`, `public/llms*.txt`,
  `public/seo-content*`, `dist/**`) — except WS11a/WS11b/WS13 whose job includes them. The orchestrator regenerates.
- **Do not touch the main checkout** at `/Users/igorgazivoda/nail-habit-app`, and do not push anything.

## Working in your worktree
- You are in an isolated git worktree on your own branch. Commit on that branch as you go with clear messages and
  `git add <specific paths>` (check `git status` first). End each commit message with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not create other branches. Do not push.
- Setup: `ln -s /Users/igorgazivoda/nail-habit-app/node_modules node_modules` (git ignores it; never commit it).
- Ports: never bind 3000 or 5173 (the owner's dev ports). If you need a server use `PORT=32NN` / `vite --port 52NN`
  with NN = your workstream number (WS7a → 3207/5207, WS11a → 3211/5211, etc.). Do not use the shared Chrome automation
  tabs (other agents run at the same time); use unit tests, `npm run build:web`, and headless Chrome
  (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom <url>` or `--screenshot`;
  puppeteer/playwright are NOT installed and you may not install them) instead. `src/dev/preview.ts` gives `?preview=trial|subscribed|paywall` fixtures on the Vite dev server.
- `npm run build` is the Electron build. The site is `npm run build:web`. Judge TypeScript by `build:web`.
- Keep new logic in plain TS modules without DOM or React imports where possible, so vitest (node env) can test it.
  Put server logic in `server/**` as ESM and test it with vitest (WS0 adds `server/**/*.test.*` to the include list).
- Touch shared files minimally and locally (add, do not restructure). Settings: only your own section component.
  `App.tsx` routes: one added line per route. `useAppStore.ts`: do not reshape persisted state; go through WS0's
  storage module.

## Definition of done (every agent)
Run and report the real result of each of these, from your worktree:
1. `npm test` — all pass (plus your new tests).
2. `npm run build:web` — exit 0.
3. `node --check server.js` and `node --check` on each server file you touched.
4. `npm run lint` — no NEW errors versus baseline (record the baseline count first).
5. Your plan section's **Acceptance** line, item by item: say verified (how) or NOT verified (why).
6. Everything flagged, and nothing visible with all flags off (state how you checked).

## Report format (reply with this, under 450 words)
- Branch name + last commit sha.
- What was built (bullets), files added/changed (grouped), flags added.
- Test/build/lint results (numbers, not adjectives).
- Acceptance: verified vs NOT verified, honestly. Things that need a camera, a real provider, or a real Paddle account are NOT verified.
- NEEDS HUMAN REVIEW / NEEDS HUMAN VERIFICATION items, owner TODOs (env vars, dashboards), and `.env.example` additions.
- Deviations from the plan and why. Lessons worth recording (pitfalls you hit).
- Also write `docs/agents/<ws>-notes.md` (e.g. `ws2-notes.md`): what exists, how to turn it on, what the human must do first.
  WS13 turns these into `RELEASE_NOTES.md`.
