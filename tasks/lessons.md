
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
