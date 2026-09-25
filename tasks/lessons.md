
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
