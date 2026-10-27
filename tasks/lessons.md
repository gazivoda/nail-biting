
## 2026-09-16 — Homepage editorial redesign (nail-habit-app)

**Never bulk-replace a Tailwind colour class without anchoring the variant prefix.**
`perl -pi -e 's/\btext-stone-400\b/text-stone-500/g'` also rewrote
`dark:text-stone-400` -> `dark:text-stone-500`. The scales are inverted between
themes: on light backgrounds stone-500 is *darker* (better contrast), on dark
backgrounds it is *darker* too (worse contrast). One sed fixed light mode and
broke dark mode on /pricing, 5.18:1 -> 3.15:1. Caught only by the final review.
Rule: match `(^|\s)text-stone-400` or handle `dark:` explicitly, and re-measure
BOTH themes after any colour sweep.

**getComputedStyle returns `oklch()` in current Chrome — do not parse it as RGB.**
A contrast checker that regex-extracted the three numbers and treated them as
sRGB reported a near-black h1 on cream as 1.14:1 (true value 15.83:1), which
would have sent me chasing phantom failures. Resolve colours by painting them to
a 1x1 canvas and reading the pixel back, so the browser does the conversion.
Always include a sanity anchor (a known high-contrast element) in the output.

**A design token named "border" can be darker than every surface it separates.**
`ink-400` (oklch 9%) sat below `ink-100` page bg (15%) and `ink-50` cards (18%),
so 99 `border-ink-400` hairlines were invisible in dark mode across 31 files.
Check token *ordering* against the surfaces, not just that the token exists.

**Verify a shared-config change on the surfaces it reaches, not the one you are building.**
Adding `<alpha-value>` to tailwind colours fixed the homepage but silently
activated ~31 previously-dead opacity utilities app-wide, including the
AlertOverlay's `bg-alert-900/90` — the core "Hands away!" panel, which had been
rendering with no background at all. Correct fix, but scope-check before landing.

## 2026-09-16 — Head-term SEO/GEO push (nail-habit-app)

**A well-built derived-schema pipeline can be wired to only half the routes.**
`visibleFaqSection()` derives FAQPage from a page's own rendered `<h3>/<p>` pairs,
with careful comments about never marking up what does not render. It was only
ever called on the compare/solutions route, so no blog post could emit FAQPage
whatever its markup. The quality of a helper says nothing about its coverage.
Grep for every call site before concluding a feature works sitewide.

**Inserting a key into an object literal that already has it fails silently.**
Adding `html:` to a section that already had one produced a duplicate key; JS
takes the later value, so the newly-written FAQ markup was discarded with no
error and `tsc` stayed green. Count the keys per object after any structural
insert. The edit "succeeding" is not evidence the value survived.

**The same wrong fact hides in more copies than the first grep finds.**
Reconciling "how long does it take" took five passes: pillar prose, the homepage
FAQPage JSON-LD, the hand-mirrored `FAQS` array in Landing.tsx, and — found only
later, while editing for an unrelated reason — a `HowTo` step inside server.js
that asserted the same week range as structured data. Search the schema builders,
not just the content files, and finish by grepping the retired string to zero.

**Verify schema by fetching from a running server, not by reading the source.**
Boot with `GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x JWT_SECRET=<32 chars>`. Both
FAQ defects looked fixed in the data file and were still absent from the response.

**A gate that refuses to fire is often right.** `visibleConditionSchema` ignored
"Onychophagia" appearing in a citation title because `visibleArticleText()` strips
citation blocks first. The fix was to earn the entity by naming the term in the
prose, not to loosen the gate. It then withheld one therapy whose exact phrasing
the page does not use — also correct. Let the schema follow the copy.

**Implementation subagents burned their budget re-researching and shipped nothing.**
Four in a row: 28-32 tool calls each, zero file edits, stopping mid-investigation.
The three diagnosis agents were genuinely excellent. Pattern: use subagents for
research and audit, do precise edits directly. If an implementation agent is used,
give it the verified finding plus exact file/line targets and tell it to edit
within its first few tool calls.

## 2026-09-25 — UI/UX + conversion pass (nail-habit-app)

**Review subagents share one Chrome profile, so a cookie one sets changes what the others see.**
The app-usability agent set the dev `nh_session` cookie; after that, `/` rendered the Dashboard
for every other agent, and the detector agent had to measure Landing in iframes with a patched
fetch. When a reviewer needs a signed-in state, say in its prompt that it must expire the cookie
before closing its tab, or give signed-in and signed-out reviewers separate origins/ports.

**A background automation tab freezes CSS transitions at t=0, so `.reveal` reads opacity 0.**
`document.visibilityState === 'hidden'` pauses animations; every revealed section, old and new,
measured opacity 0 until a screenshot brought the tab forward. Check visibilityState before
calling a reveal broken.

**A code comment can claim a mirror that no longer exists.** HeroDemo said its strings were
"reproduced verbatim" in server.js; grep found only Landing's heading and paragraph there. Grep
the mirror before treating copy as frozen, then fix the comment.

**Keep deliberate owner decisions even when a reviewer flags them.** Two reviewers wanted the
trial links out of `target="_blank"`; `git log -S` showed 92360d2 did it on purpose (the landing
tab keeps the demo running). Check history before reverting a pattern that looks like a mistake.

**Work on main unless told otherwise (user correction, 2026-09-25).** I built and pushed the
UI/UX pass on the `seo-geo-loop-sept` branch, and the user had to ask for it to go to main.
Rule: default to `main` (which auto-deploys via Coolify) for this project; create or use a
branch only when the user explicitly asks for one.

## 2026-09-25 — Authenticity loop (nail-habit-app homepage)

**The biggest "AI slop" tell was absence, not decoration: the page never showed the product.**
Ten rounds of de-slopping, and the one that changed the page most was capturing the real app
(CDP + Chrome's `--use-fake-device-for-media-stream`, seeded example data, labelled "example
data", provenance embedded with `impeccable embed-prompt`). Before polishing icon rows or copy,
ask: does this page show the real thing anywhere?

**Headless Chrome ignores `--window-size` below ~500px wide.** 390px "mobile" captures silently
rendered wider and cropped. Use CDP `Emulation.setDeviceMetricsOverride` (script in the session
scratchpad, cap.mjs) and assert `scrollWidth === innerWidth` in the output.

**Custom CSS outside a Tailwind layer beats every utility.** The `.sg-*` block sat after
`@tailwind utilities`, so `text-white/90` on a `.sg-note` lost and a CTA offer line rendered
invisible on blue. Put design-system classes in `@layer components`.

**Never illustrate the user's own problem behaviour (user correction, 2026-09-25).** An
animated hand-to-mouth "warning" pictogram was the homepage's signature; the owner called it
"insulting and idiotic". Drawing the visitor's habit, even as a clever sign, reads as mockery
to the person who has it. Show the product and the outcome instead (real app screens), and
treat any cartoon of the habit (biting figure, hand at mouth) as off-limits for this product.

## 2026-10-02 — Loop 11 (video, SEO/GEO, UX)

**A label can promise what the asset does not have.** The play button said "sound on" over
a video rendered silent on purpose (music cannot be heard or verified in-session). Caught only
in the final review. Rule: after generating media, re-read every string around it (label, alt,
schema description) against what the file actually contains.

**The PWA service worker serves the previous build to the browser you are testing in.** After a
rebuild the page still showed the old layout until the worker and caches were unregistered
(`navigator.serviceWorker.getRegistrations()` + `caches.delete`). Unregister before judging a
change, or test in headless Chrome, which starts clean.

**A backgrounded automation tab never fetches `preload="none"` video.** `visibilityState` was
`hidden`, readyState stayed 0 after a real click. Verify click-to-play in headless puppeteer
(request log before/after the click, `currentTime` > 0), not in the shared tab.

**A no-JS copy of a page must follow the page, not paraphrase it.** The crawler article had its
own h1 and section names ("How it works", "Pricing") against the visible "How to start" and
"$2.99 a month…". Fixing it meant mirroring headings and copy section by section, then fetching
the raw HTML to compare. Re-run `sync-seo` after: the page-freshness ledger fingerprints content.

**Grep a retired claim to zero across data files, built artifacts and llms.txt.** "Zero network
requests during detection" lived in a FAQ, llms.txt and five compare-page sentences; the page
itself said models download once. Check `dist/seo-content.json` and `dist/llms-full.txt` too.

## 2026-10-05 — Growth loop (nail-habit-app)

**`npm run build` is the Electron build; the site is `npm run build:web`.**
`vite.config.ts` sets `base: './'` unless `VITE_BUILD_TARGET=web`, so a plain build
emits `./assets/...` and every nested route (`/tools/x`, `/compare/x`) loads its
script from a path that 404s. SSR-only curl checks cannot see this: the HTML is fine
and the React app silently never mounts. Verify any new route in a real browser
against a `build:web` bundle, and unregister the localhost service worker first, or
it serves the previous bundle.

**New core pages are not picked up by `seo:sync` until committed, and need three registrations.**
`CORE_PAGES` and `PAGE_SOURCES` in scripts/sync-seo.mjs (the file contains binary
bytes: use `command grep -a`, and edit it in bytes), plus the llms core-route list.
Commit the page first, then sync, then commit the generated files.

## 2026-10-08 — Growth loop 3 (nail-habit-app)

**Scope greps to the claim, not the topic.** A regex on 'onychotillomania' matched every citation in 150 posts and flooded the context. Search for the specific phrase, or count matches first.

**Reusable copy goes stale faster than the site.** docs/off-site-kit still carried the removed desktop-app claim, the retired 'zero network requests' / '100% private' wording and a false 'no analytics' (the site runs Google Analytics). After any claim is removed from the site, grep the kit and drafts for it before they are pasted anywhere.

**A subagent's confident correction can be wrong.** The GEO agent called `ai-input` an invalid Content-Signal key; the published spec lists search, ai-input and ai-train. Check the primary source before changing working config.

**NCBI eutils is the fallback when PubMed pages need cookies.** `efetch.fcgi?db=pubmed&id=PMID&rettype=abstract&retmode=text` returns citation and abstract; when no abstract exists, cite the title only and do not describe the findings.

**Read the diff output before the commit runs.** I chained `cmp` checks and a `git commit` in one command; the HTML showed DIFFERENT (only because the rebuilt bundle changed the hashed asset filename) after the commit had already recorded 'byte-identical'. When comparing built HTML, normalise `/assets/<hash>` first, and do the comparison in a command that does not also commit.

**New post fields must go through the generator.** BlogPost.tsx now renders from dist/posts/<slug>.json, which is built from the same `posts` object as seo-content.json in scripts/generate-seo-content.mjs. A field added to blogPosts.ts but not copied there will exist for the crawler build step but never reach the client. Edit the generator, then check the page in a browser.

**Judge TypeScript by `npm run build:web`, not `tsc --noEmit -p .`.** The root tsconfig only has project references, so the quick check passes while `tsc -b` fails. Round 8 committed a broken build once (a `BlogMidCta.tsx` and a `blogMidCta.ts` that clash on a case-insensitive filesystem); the rule is: run build:web before every commit, and never name two files in one folder the same apart from case.

**Restart the local server after every build before a browser check.** server.js caches dist/index.html at startup, so a server started before the rebuild serves old asset hashes and the React app renders nothing.

**Add the post first, then run the link helper, then verify per post in dist/posts/<slug>.json.** A scripted insertion that searched for the next `\n  ],\n});` ran past the end of posts in the older 4-space layout and put links into neighbouring posts. The helper (scratchpad addlinks.py) now stays inside the post's own region and refuses duplicates; still check the built JSON of every target.

**A 'no study found' claim needs a clean query.** OR-joined PubMed queries return millions of meaningless hits and over-specific ones return zero. Run single-topic queries, say how many results and how many were read, and write the date.

**Do not tick a plan item you did not do.** In round 8 the audit item folded into slot 28 was replaced in my head by the older Web Share idea; I built that and only noticed when logging. Re-read the item text from the plan file before starting each iteration.

**Check scripts' date edits with `git diff` before committing.** A replace of '2026-04-03' hit `datePublished` instead of `dateModified`; the diff showed it.

**Run `node --check server.js` after merging any branch that touches it.** The design branch's server.js had an unescaped apostrophe ("today's") in a single-quoted string, so the server would not have started in production; nobody had run that branch. Treat an unrun branch as untested, not just unreviewed: after a merge run node --check, the full sweep (scratchpad sweep8.py), a curl of every new asset path, and a browser pass before pushing.

**A dev-only preview made the signed-in app reviewable.** `src/dev/preview.ts` plus a hook in AuthContext (loaded with a dynamic import behind `import.meta.env.DEV`) signs in a fixture user with two weeks of history on the Vite dev server: open `/?preview=trial|subscribed|paywall`. Before it, no agent could render a single app screen. It must stay out of production: after every build `grep -l "seedPreviewData\|previewKind" dist/assets/*.js` must print nothing. Several agents sharing one dev server and browser flip each other's preview user, so always navigate to the full `?preview=` URL before each check, and judge dark mode and 390px by rendering (class `dark`, a same-origin 390px iframe), not by reading classes.

**Dark tokens are the other way round than they look.** In tailwind.config.js ink-300 is the DARKEST surface (11% L) and ink-400 is the border/track colour (30%); a card tooltip wants ink-50 plus an ink-400 border. A QA suggestion to use ink-300 as a disabled-button fill or a border would have produced a hole, not a hairline.

## 2026-10-23 — Repeated permission prompts

**Reuse authorization and reduce permission interruptions (user correction).** The user explicitly requested implementation, commit and push, then asked to stop repeated permission prompts because they were approving every action. Do not add routine confirmation menus after that authorization. Reuse approved command prefixes and batch necessary setup, verification and report edits. Check writable roots before selecting an isolated workspace so a protected worktree does not create a new approval for every operation. Sandbox approvals remain enforced; do not bypass them or request unnecessarily broad prefixes.

## 2026-10-24 — Gap-plan swarm (16 workstreams, parallel agents in worktrees)

**Agent worktrees fork from `origin/main`, not from local `main`.** The first WS0 branch had no trace of the orchestrator's own docs commit. Every brief starts with `git reset --hard main` and a check that the top commit is the last merge.

**Remote refs are shared, so `origin/main` can move under a long swarm.** The owner's other session pushed three SEO commits in the middle of this one. Before every push: `git fetch`, `git merge-base --is-ancestor origin/main main`, merge (never force-push), re-run the gates on the merged tree.

**Build BEFORE tests when tests read `dist/`.** Tests that need `dist/seo-gated.json` skip silently when `dist/` is stale; "51 passed | 1 skipped" was the only hint. Read the skipped count after every merge.

**Cross-workstream bugs only show up on the merged tree.** A hook calling `useAuth` threw in 13 History render tests written by other agents; a test mock of the store lacked an export a later agent started using. Fix with `useAuth({ optional: true })` (an overload, no new export) and `importOriginal` mocks. Run the full gates after EVERY merge, not just per branch.

**`npm run lint` on the main checkout also scans `.claude/worktrees/*`.** Counts inflate by hundreds. Scope it: `eslint src server scripts electron shared` (baseline 23 errors / 4 warnings).

**The account usage limit is shared by all parallel agents.** It killed 4-5 agents mid-work three times. Agents that commit after every milestone lose nothing; resume with `SendMessage` after the reset and tell them to commit first. Prefer 2-3 concurrent long agents.

**Owner WIP and a shared stash stack.** Stash with a unique message, keep the SHA and a patch backup, restore with `git stash apply <sha>` (never bare `pop`), and `git apply --check` the patch after every merge.

**With the Docker daemon down, reproduce the Dockerfile by hand.** Copy only what stage 1 copies into a clean dir and build; copy only what stage 3 copies plus that `dist` and boot the server there. It catches missing `COPY` lines (`server/`, `shared/`) before Coolify does. Also run new migrations against a copy of `data/users.db`.

**A passing audit proves nothing unless it can fail.** The privacy audit has a synthetic meta-test and a canary build that leaks on purpose (caught 11/11). Do the same for any "no X leaves the device" claim.

**Identical HTML is not identical pixels.** Merging three text nodes into one translated string moved glyphs by 0.02 px. When a "no visible change" claim matters, diff pixels, not only DOM.

**Service worker and CSP traps.** `upgrade-insecure-requests` stops the service worker from installing on plain-http localhost (test behind https or strip the directive). A page with a secret in its URL (share links) must not use the SPA shell, because the shell loads analytics. `manifestTransforms` never sees vite-plugin-pwa's manifest entry (use `api.extendManifestEntries`). A Rollup chunk shared by two entries is named after one of its modules, so a glob on names (globIgnores) can precache the wrong thing.

**Machine translations ship in three states.** Flag off = 404; flag on but unreviewed = served `noindex`, no sitemap, no hreflang; flag on and reviewed = indexable. One `reviewed` marker per language (`src/i18n/locales/<x>/reviewed.ts`) controls the app and the marketing pages.

**Case-insensitive filesystems bite twice.** `phoneView.ts` next to `PhoneView.tsx` and `programView.ts` next to `ProgramView.tsx` both broke `tsc -b`; a guard test now catches it. Never name two files in a folder the same apart from case.

**Track on the state transition, not inside the handler.** `demo_start` lived in `start()`, but the landing mounts `<HeroDemo autoStart />`, whose first run begins in the reducer's initial state and never calls `start()`. Ten weeks of "1 demo start" were a code bug. When a flow can begin by prop, initial state or URL, put the event in an effect on the phase change.

**A queue stub must exist before anything can call it.** `index.html` created `window.gtag` inside the `load` handler, so every `track()` before `load` (effects, an IntersectionObserver already in view at mount, early clicks) vanished silently. Define `dataLayer` and the stub in the head (it is an array push, no network) and defer only the script download.

**Read the metric's bug before reading it as behaviour.** A tiny funnel (33 pricing views, 1 demo start) was first read as "visitors do not convert"; two tracking bugs were behind part of it. Before writing insights from analytics, check the events can fire in the situations the numbers describe.

**No jsdom here.** Test an inline script from an HTML file with `node:vm` plus a hand-built window (see `scripts/analyticsTag.test.mjs`); do not add a dependency for it. The privacy-audit Chrome has `navigator.webdriver` false (no `--enable-automation`), so a webdriver guard does not hide analytics from the audit.

**Agent runs against the real app hit production services.** The real-browser checks and the privacy audit loaded the built app, which loads the real GA tag, so a few `localhost` hits reached the production property. Tag test runs as internal (`?internal=1`) or use a disposable GA id; do not assume a localhost page is invisible.

**Check the other session's recent edits before an SEO rewrite.** The 90-day Search Console window mostly predates the 2026-10-20..23 title rewrites, so low CTR there says nothing about the new titles. Skip a rewrite the data cannot judge, and record the date to re-read it.

**An obsolete gate is a false alarm that trains people to ignore gates.** The "owner's Paddle WIP patch applies" check failed once the owner's change landed on main. Retire a gate in the same change that makes it meaningless.

**Check how old a page is before reading zero clicks as a snippet problem.** Cancer, self-harm and pinworm each showed about 110 impressions at positions 7-10 and 0 clicks, but they were published 2026-10-08..20 and their titles already matched the queries word for word. A week of data at a 3% click rate is 0 clicks one time in twenty. Pull the publish date and the git history of a title before proposing to change it, and write down a decision rule and an evaluate-on date (`docs/seo/title-ledger.md`).

**A brief's premise deserves one `curl`.** The brief said toenails had a truncated 70-character title; the live page showed a 55-character title with no truncation. Fetch the live page before building on a claim about it.

**A flag-dependent sentence that adds markup is not a `flagCopy` rule.** RULES forbid `<` and `>`, and a `{{if}}` marker enters the freshness fingerprint. Rewriting the exact source sentence at serve time (anchors, with a test that finds each anchor once in `server.js`) keeps flag-off responses byte-identical and the freshness ledger untouched. Prove byte identity by booting the base commit and the branch side by side and diffing status, headers and bodies of every sitemap URL.

**A static link to a flag-gated page is a latent 404.** Turn the flag off and the link points at the branded 404, and `featurePages.test.mjs` forbids the page in `seo-content.json`. Gated pages need a flag-aware rendered link (footer shown by `useFeature`), otherwise their only inbound link is the `<noscript>` nav and Google may skip them ("crawled, currently not indexed").

**SEO build details.** A `seoTitle` edit needs `og:generate` (the card bakes `seoTitle ?? title`). `firstSentence()` feeds the `llms.txt` blurb, so never open a description with a one-word sentence ("Possibly."); use a colon. The mirror gate checks figures and cited surnames, not claim strength: a snippet can contradict its body after a body edit and stay green. No gate enforces 160 on post descriptions (`seo:check` allows 165).

**Search Console numbers are tiny here.** 122 clicks in 90 days: per-page CTR is noise below about 100 impressions. Pool pages before judging a change.

**Two branches that each pass can fail together: run the gates on the merge.** Agent 3's footer tests imported the pages early in `featurePages.test.mjs` and froze `import.meta.env` with no Lifetime price id; agent 4's later `vi.stubEnv` then had no effect and 7 tests failed, though both branches were green alone. Stub env, then `vi.resetModules()`, then import. Never push a swarm on per-branch results.

**A brief's implementation hint can collide with pins already in the repo.** The brief said `useFeature(flag)` for the footer links; the repo pins "marketing pages make no flag request" and "no unreleased page path in `dist/assets`". Read the existing pins first; the agent that deviated and said why was right.

**A "no other X is linked" assertion also finds sibling dead links.** Written at the strictest scope, it showed an open gated page linking to a closed one (a link to the branded 404). Write the negative assertion first and widest.

**The first flag-copy rule that goes live changes how static files are served.** `COPY_ACTIVE` flips on, and `/posts/*.json`, `/seo-content.json` and `llms-full.txt` stop going through `express.static` (`Last-Modified` and `Accept-Ranges` lost, ETag becomes a content hash). A RULES `on` text must also not contain its own `off` text, or the idempotence test fails.

**Do not reuse a scratch directory for `git archive` exports.** A directory such as `base` can hold stale files from an earlier run and make a byte-identity proof meaningless. Use `mktemp`.

