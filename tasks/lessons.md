
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
