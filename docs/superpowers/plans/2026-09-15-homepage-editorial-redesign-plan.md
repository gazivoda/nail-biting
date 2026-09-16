# Implementation plan — Homepage "Journal" editorial redesign

Spec: `docs/superpowers/specs/2026-09-15-homepage-editorial-redesign-design.md`
Branch: `seo-geo-loop-sept`

Five tasks, strictly sequential (tasks 2–5 all edit `src/pages/Landing.tsx`).

---

## Global Constraints

Every task is bound by all of these. A violation is a spec failure.

1. **FAQ copy verbatim.** The six `FAQS` entries in `Landing.tsx` mirror the
   `FAQPage` JSON-LD in `index.html`. Not one character of any question or answer
   string changes.
2. **No copy deleted, no copy reworded.** Every sentence rendered today is
   rendered after. Moving a sentence to a different section is allowed;
   changing its words is not.
3. **No link dropped.** Every `href` present in `Landing.tsx` today is present
   after. Verify with the href-diff command in each task's verification block.
4. **Semantics preserved.** Exactly one `h1`. Sections keep `h2`. Every
   `aria-labelledby` keeps pointing at an element that exists with that `id`.
   Decorative elements carry `aria-hidden="true"`.
5. **Demo stays lazy.** `HeroDemo` remains behind `lazy()` and the `demoStarted`
   state gate. Never import it eagerly.
6. **Do not modify** `src/components/PricingSection.tsx`,
   `src/components/ContactForm.tsx`, `src/hooks/useScrollReveal.ts`, or any file
   under `src/pages/` other than `Landing.tsx`.
7. **`.reveal` / `.reveal-card` are load-bearing** — `PricingPage.tsx` uses them
   via `useScrollReveal`. Their class names, selectors and behaviour must not
   change. New primitives are additive only.
8. **No new dependencies.**
9. **Dark mode specified** for every element introduced.
10. **Verification gate for every task:** `npm run build` and `npm test` both
    pass (71 tests). Report the actual output.

---

## Task 1 — Editorial foundation (CSS + tokens + two bug fixes)

Files: `src/index.css`, `tailwind.config.js`. **Do not touch `Landing.tsx`.**

### 1a. Fix: body font falls back to system font

`src/index.css` `body { font-family: 'DM Sans', … }` — DM Sans has no
`@font-face` rule and is never loaded. Change `'DM Sans'` to `'Inter'`. Leave the
rest of the stack as-is.

### 1b. Fix: opacity modifiers silently compile to nothing

Every colour in `tailwind.config.js` is a bare `oklch(...)` string, so Tailwind
drops all opacity variants of them. `dark:bg-forest-900/20` in `Landing.tsx`
today produces **no CSS at all** (verified absent from `dist/assets/index-*.css`).

Root-cause fix: append ` / <alpha-value>` inside every colour function in the
`colors` block, e.g.

```js
forest: { 900: 'oklch(15% 0.050 148 / <alpha-value>)' }
```

Apply to all scales: `cream`, `paper`, `cream2`, `stone`, `ink`, `forest`,
`amber`, `alert`. When no opacity modifier is used Tailwind substitutes `1`, so
existing classes are unchanged. Verify after the change that
`bg-forest-900\/20` now appears in the built CSS.

### 1c. Add the editorial primitives

Append one clearly-commented block to `src/index.css`, after the existing landing
animations and **before** the `prefers-reduced-motion` block. Use these exact
class names and values — tasks 2–5 consume them:

```css
/* ── Editorial system ("Journal" homepage) ──────────────────────────────── */

.ed-container { width: 100%; max-width: 1240px; margin-inline: auto;
                padding-inline: clamp(1.25rem, 4vw, 2.5rem); }

.ed-grid  { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr));
            column-gap: clamp(1.5rem, 3vw, 2.5rem); row-gap: 2.5rem; }
.ed-main  { grid-column: 1 / -1; }
.ed-aside { grid-column: 1 / -1; }
@media (min-width: 1024px) {
  .ed-main  { grid-column: 1 / span 7; }
  .ed-aside { grid-column: 9 / span 4; }
}

.ed-measure { max-width: 62ch; }

.ed-display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
              font-size: clamp(2.75rem, 7.5vw, 5.25rem); line-height: 0.95;
              letter-spacing: -0.02em; }
.ed-h2      { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
              font-size: clamp(1.875rem, 3.6vw, 2.875rem); line-height: 1.05;
              letter-spacing: -0.01em; }
.ed-lede    { font-size: clamp(1.0625rem, 1.35vw, 1.1875rem); line-height: 1.65; }
.ed-body    { font-size: 0.9375rem; line-height: 1.7; }
.ed-caption { font-size: 0.75rem; line-height: 1.55; }
.ed-mono    { font-family: 'JetBrains Mono', ui-monospace, monospace;
              font-weight: 500; font-size: 0.6875rem; letter-spacing: 0.18em;
              text-transform: uppercase; }
.ed-figure  { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
              font-size: clamp(2rem, 4vw, 3rem); line-height: 1; }

/* Section mark: 01 ─────────────────── THE PROBLEM */
.ed-mark      { display: flex; align-items: center; gap: 1rem; }
.ed-mark-rule { flex: 1 1 auto; height: 1px; background: currentColor;
                opacity: 0.18; }

/* Signature motion: rules draw themselves left-to-right when their section
   reveals. Driven by the .revealed class useScrollReveal already applies to
   the ancestor .reveal element — no JS change needed. */
.ed-rule-draw           { transform: scaleX(0); transform-origin: left;
                          transition: transform 0.52s cubic-bezier(0.22, 1, 0.36, 1); }
.revealed .ed-rule-draw,
.ed-rule-draw.revealed  { transform: scaleX(1); }

/* Hairline separator */
.ed-hr { height: 1px; border: 0; background: currentColor; opacity: 0.14; }

/* Link underline grows from the left. Transform-only. */
.ed-link          { position: relative; text-decoration: none; }
.ed-link::after   { content: ''; position: absolute; left: 0; right: 0;
                    bottom: -2px; height: 1px; background: currentColor;
                    transform: scaleX(0); transform-origin: left;
                    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
.ed-link:hover::after,
.ed-link:focus-visible::after { transform: scaleX(1); }

/* Visible focus for the editorial page only — scoped so the app UI is
   unaffected. */
.ed-page a:focus-visible,
.ed-page button:focus-visible,
.ed-page summary:focus-visible {
  outline: 2px solid oklch(46% 0.130 148); outline-offset: 3px; border-radius: 2px;
}
```

### 1d. Extend the reduced-motion block

Add `.ed-rule-draw` (force `transform: none`, `transition: none`) and
`.ed-link::after` (force `transform: scaleX(0)`, `transition: none`) to the
existing `@media (prefers-reduced-motion: reduce)` block. Do not alter the rules
already in it.

### Verification

- `npm run build` and `npm test` pass.
- `grep -o 'bg-forest-900\\/20[^}]*}' dist/assets/*.css` now returns a match
  (it returns nothing before this task).
- `grep -c "DM Sans" src/index.css` returns 0.
- `git diff --stat` shows only `src/index.css` and `tailwind.config.js`.

---

## Task 2 — Nav + hero

File: `src/pages/Landing.tsx`.

### Nav

Keep it structurally compatible with the other pages' navs (fixed, full-width,
hairline bottom border, backdrop blur, same three items: Blog / ThemeToggle /
sign-in CTA, same hrefs). Refine only: set the wordmark in Instrument Serif,
give the Blog link the `.ed-link` underline treatment, drop the
`hover:-translate-y-0.5` and the coloured drop-shadow from the CTA in favour of a
flat forest fill with a simple `hover:bg-forest-500`. Keep `aria-label="Site navigation"`.

### Hero

Replace the entire current hero section. Remove all three blurred orb `div`s and
the `ChevronDown` scroll cue. Target layout, using `.ed-container` + `.ed-grid`:

- **`.ed-main` (cols 1–7), left-aligned:**
  - Eyebrow: existing string "For everyone who's tried to quit — and couldn't",
    class `ed-mono`, forest-600.
  - `h1` with `.ed-display`: "Stop biting your nails." then a line break, then
    "For good, this time." in forest-600 — keep the existing `<em className="not-italic">`
    structure so the serif's roman is used.
  - Lede paragraph, `.ed-lede .ed-measure`, existing copy verbatim including the
    emphasised `<span>` around "Stop Biting catches the exact moment…".
  - The on-device trust line, existing copy, set as a mono-labelled row with a
    `ShieldCheck` icon and the existing pulsing dot — not a pill with a rounded
    border.
  - CTA row: primary "Start free trial" (forest fill, `rounded-xl`, no shimmer —
    remove `btn-shimmer` from this button) and the secondary "Read the science"
    link with `.ed-link`.
  - The 5 tags ("Web App", "PWA install", "MediaPipe AI", "100% private",
    "No cloud") as a mono row separated by hairline dividers.
- **`.ed-aside` (cols 9–12): Figure 1.**
  - The existing `#live-demo` section moves here, keeping `id="live-demo"`,
    `aria-labelledby="live-demo-heading"`, and its `h2#live-demo-heading`.
  - Above the frame, a mono caption row: `FIG. 1` + "The detector, running on
    your device".
  - The framed card keeps the existing opaque-background comment's intent
    (`bg-white dark:bg-ink-50`) — it is one of the three sanctioned cards.
  - The existing `h2` "Try the detector right now" and its paragraph stay,
    rendered on page view (crawler-visible), set smaller than the hero.
  - `demoStarted` gate, `Suspense` fallback and `DEMO_LOADING_LABEL` unchanged.
  - Below the frame, the three key data points pulled from the existing stats
    strip — "20–30%", "~99%", "0 bytes" — as mono-labelled margin rows. **The
    stats strip itself stays in Task 3**; these are short margin echoes using the
    same numbers, each with its existing label text.
- A single vertical hairline on the column boundary (`lg` and up only),
  `aria-hidden`.

Keep `animate-fade-up` staggering for the hero's own entrance (it is above the
fold, so `.reveal` would never fire).

### Verification

- Build + tests pass.
- `grep -c "animate-float\|blur(6\|blur(5\|blur(4" src/pages/Landing.tsx` → 0.
- Every href that existed before still exists (see href-diff below).
- `grep -c "HeroDemo" src/pages/Landing.tsx` still shows the `lazy()` import.

---

## Task 3 — Sections 01 (The problem) and 02 (The method)

File: `src/pages/Landing.tsx`.

Introduce the section-mark component pattern once, inline, and reuse it:
a `.reveal .ed-mark` row containing `<span class="ed-mono">01</span>`,
`<span class="ed-mark-rule ed-rule-draw" aria-hidden="true">`, and
`<span class="ed-mono">The problem</span>`.

**01 — The problem.** Built from the existing `why-bite-heading` article. Heading
becomes `.ed-h2` (keep `id="why-bite-heading"` and the `aria-labelledby`). No
card frame. The three triggers (Stress / Deep focus / Pure habit) become a
definition-style list separated by hairlines rather than bullet dots. The closing
paragraph and the "Read the full article" link (`.ed-link`) stay.

In `.ed-aside`, place the **stats figure**: a real `<figure>` containing the
three existing stats ("20–30%", "~99%", "0 bytes" with their existing labels)
set with `.ed-figure` numbers in forest and `.ed-mono` labels, separated by
hairlines, and the existing long source-note paragraph verbatim as the
`<figcaption>`. Keep `aria-label="Key statistics"` semantics on the figure.

**02 — The method.** Built from the existing `hrt-heading` article followed by
the existing three-step "How it works" content. Heading `.ed-h2`, keep
`id="hrt-heading"`. The three HRT steps keep their existing structure. The three
"how it works" steps (`01`/`02`/`03`, Camera / Cpu / Bell) become a numbered
process list in the narrative column — numerals in `.ed-mono`, no cards, hairline
between steps. Keep the "Read the full HRT guide" link.

Because the "How it works" `h2` ("Three steps to start stopping nail biting.")
merges into this section, demote it to an `h3` and keep its text verbatim. Keep
`id="how-heading"` on it and its `aria-labelledby` wiring valid.

### Verification

Build + tests pass; href diff clean; `aria-labelledby` targets all resolve.

---

## Task 4 — Sections 03 (Evidence), 04 (The instrument), 05 (Colophon)

File: `src/pages/Landing.tsx`.

**03 — The evidence.** From the existing `evidence-heading` section. The long
evidence paragraph becomes a pull quote: `.ed-lede`, set against a thick forest
left rule (3px), no card, no tinted background. Both PubMed links stay, set as
`.ed-mono` source lines beneath. The two honesty cards ("No fake reviews here",
"An app is not a clinician") move to `.ed-aside` as margin notes — hairline top
rule, mono label, small body, no frames. BFRB link preserved.

**04 — The instrument.** Merge three current sections: the feature grid, the
privacy statement, and the privacy deep-dive.

- The 6 features become a **specification list**: each row is a hairline-separated
  grid row with the icon, the name in Inter 600, and the description. No cards,
  no hover lift. Keep all six names and descriptions verbatim.
- The privacy statement's heading "Your camera never leaves this app." becomes
  the section's `.ed-h2` (keep `id="privacy-heading"`), with "Not even for a
  millisecond." as a serif sub-line, and its body paragraph plus the
  "Disconnect from the internet…" line verbatim. Drop the big rounded icon tile.
- The three privacy deep-dive items keep their headings and details verbatim,
  set as margin notes or a second hairline list. Keep `id="privacy-details-heading"`
  on its heading and its intro paragraph verbatim.

**05 — Why we built this.** The existing `why-built-heading` section, set as a
signed colophon: narrow measure, centred is permitted here, no card frame,
hairline above and below, the "— The Stop Biting team" signature in `.ed-mono`.

### Verification

Build + tests pass; href diff clean; all six feature descriptions present
verbatim; `grep -c "aria-labelledby" src/pages/Landing.tsx` targets all resolve.

---

## Task 5 — Sections 06 (Further reading), 07 (Questions), CTA, footer

File: `src/pages/Landing.tsx`.

**06 — Further reading.** Merge the "Featured Guides" list (10 links) and the
"From the blog" preview (3 posts) into one reading list. All 13 destinations
survive. Set as hairline-separated rows: `.ed-mono` kicker (the post `tag` for
blog entries, "Guide" for the guide links), the title, and reading time where it
exists. Use `.ed-link` on hover, no cards, no lift. Keep the "All articles" link
to `/blog`. Keep the `featured-guides-heading` and `blog-preview-heading` ids
valid against whatever headings remain.

**07 — Questions.** The FAQ. **All six question and answer strings verbatim.**
Keep `<details>`/`<summary>` (it is the accessible, no-JS disclosure). Restyle:
no card frame — hairline between entries, `ChevronDown` rotates on open, question
in Inter 600, answer in `.ed-body` at `.ed-measure`. Keep `id="faq"` and
`id="faq-heading"`. Keep the trailing "More on all of this in the…" paragraph
with its `BLOG_INDEX.length` interpolation.

**Final CTA.** Centring permitted. Remove the tinted rounded panel; use hairlines
above and below, the heading in `.ed-h2`, the existing body copy, the primary CTA
(no `btn-shimmer`), and the "3-day free trial · no credit card required" line in
`.ed-mono`.

**Contact.** `<ContactForm />` renders unchanged.

**Footer.** Restyle to match: hairline top rule, the wordmark in Instrument
Serif, the description paragraph verbatim, the 8 footer links set as a mono
column with `.ed-link`, and the copyright line verbatim including the dynamic
year. All 8 hrefs preserved.

**Cleanup.** Remove `.btn-shimmer` usage from `Landing.tsx` entirely (leave the
CSS rule in place — verify nothing else uses it first; if nothing does, remove
the rule too). Update the now-stale comment in `Landing.tsx` about `<alpha-value>`
opacity variants being dropped, since Task 1 fixed that.

### Verification

Build + tests pass. `npm run seo:check` passes. href diff clean. FAQ strings
byte-identical to the `FAQPage` JSON-LD in `index.html`.

---

## href-diff command (use in every task's verification)

```bash
git show HEAD:src/pages/Landing.tsx | grep -o 'href="[^"]*"' | sort -u > /tmp/hrefs-before.txt
grep -o 'href="[^"]*"' src/pages/Landing.tsx | sort -u > /tmp/hrefs-after.txt
comm -23 /tmp/hrefs-before.txt /tmp/hrefs-after.txt   # must print nothing
```

Anything printed by that `comm` is a dropped link and a spec failure.

---

## AMENDMENT (user request, mid-execution)

Two new requirements supersede parts of the Global Constraints above.

### A. No dash symbols in homepage UI copy

Constraint 2 ("no copy reworded") is **relaxed for dash characters only**. Remove
every em dash (`—`) and en dash (`–`) from copy rendered by `src/pages/Landing.tsx`.
Everything else about constraint 2 still holds: no sentence is deleted, no
meaning changes, no other rewording.

Replacement convention — this needs editorial judgement per sentence, not a
mechanical swap:

- A parenthetical pair of em dashes becomes commas, or parentheses where the
  aside is genuinely incidental.
- A single trailing em dash introducing a clause becomes a colon, or the
  sentence splits into two with a full stop.
- A dash used as "namely"/"that is" becomes a colon.
- **Never** substitute a plain hyphen (`-`) for an em dash. It is typographically
  wrong and reads worse than what it replaced.
- En dashes in numeric ranges (`20–30%`) become plain hyphens (`20-30%`). This is
  the one case where a hyphen is the correct replacement.

**Hard coupling:** the six FAQ answers are mirrored verbatim in the `FAQPage`
JSON-LD in `index.html` (~line 257). Google requires the visible copy and the
structured data to match. Any dash edit inside a FAQ question or answer **must
be made identically in `index.html` in the same commit.** After editing, the FAQ
strings in the two files must still be byte-identical to each other.

Out of scope, flagged for a separate decision: the 1,607 em dashes in
`src/data/blogPosts.ts` and the rest of the site. Do not touch them.

### B. Homepage is light-mode only

The homepage must always render light, to read as health and wellbeing.

- Remove `<ThemeToggle />` from the Landing nav, and its now-unused import.
- Landing must stop calling `useTheme()` and instead force light by removing the
  `dark` class from `<html>` on mount.
- **Do not corrupt the stored preference.** `useTheme` reads `theme` from
  `useAppStore`; the signed-in app and the other pages still honour it. Forcing
  light on Landing must not write to the store. Verify that a user whose stored
  theme is `dark` still gets a dark app after signing in, and still gets a dark
  `/blog` and `/pricing`.
- Remove every `dark:` variant class from `Landing.tsx` — they become dead code
  and hide the real styling. This is a large but purely mechanical cleanup.
- Other pages keep their theme toggle. This change is homepage-only.

### Task 6 (new, runs last)

A whole-file sweep of `src/pages/Landing.tsx` applying A and B to the sections
built in Tasks 2 and 3 (nav, hero, 01, 02), plus:

- Migrate every remaining hairline from `border-stone-200 dark:border-ink-400`
  to the `border-hairline` token added by the foundation fix (commit `3ea1f70`).
- Collapse the duplicated key-figure echo: the hero's `HERO_FIGURES` and the
  Section 01 stats figure render the same three numbers ~600px apart in the same
  margin column. Keep the Section 01 figure (it carries the source note) and
  reduce the hero echo to something that does not restate all three verbatim.
- Remove the stale comment about `<alpha-value>` opacity variants being dropped
  (fixed in Task 1) and remove `.btn-shimmer` usage.
