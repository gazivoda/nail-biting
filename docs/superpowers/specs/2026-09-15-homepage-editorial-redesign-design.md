# Homepage redesign — "Journal" editorial direction

Date: 2026-09-15
Target: `src/pages/Landing.tsx` (+ `src/index.css`, `tailwind.config.js`)
Status: approved (aesthetic direction, content scope, shared-component scope all confirmed by user)

---

## 1. Why redesign

The current homepage is well-written and technically careful, but visually it is
textbook generic-AI output. Concretely, measured against the page as it stands:

| Symptom | Count / evidence |
|---|---|
| Identical `rounded-2xl` + `border` + `shadow-card` + `hover:-translate-y-1` cards | ~25 instances |
| `text-center` on section headings and body copy | every section except two |
| `h2` set at `text-2xl font-bold` | 11 of 13 headings — no hierarchy variance |
| Blurred ambient "orbs" as decoration | 3 in the hero |
| Instrument Serif (self-hosted, paid-for LCP budget) actually used | 2 elements total |
| JetBrains Mono (self-hosted) used on the landing page | 0 elements |

The content's real differentiator — genuine citations, a refusal to fake
testimonials, privacy claims the reader can verify — is invisible in the design.
The page looks like every other SaaS landing page, so the honesty reads as
boilerplate rather than as the point.

## 2. Concept

**The page is set as a journal article about a behaviour, in which the product is
the instrument.**

The site's credibility *is* its brand. So it should look like a publication:
hairline rules, numbered sections, a wide measure for narrative and a narrow
margin for figures and sources, data set in mono, headings set in the display
serif already in the build. The live detector is the article's Figure 1.

This is the direction the existing tokens were already reaching for — warm cream
paper, forest-green accent, Instrument Serif — and never committed to.

## 3. Design system

### 3.1 Grid

- Page container: `max-width: 1240px`, gutters `clamp(1.25rem, 4vw, 2.5rem)`.
- 12-column grid on `lg`. Below `lg` everything collapses to one column and
  marginalia flows inline after the text it annotates.
- **Narrative column**: columns 1–7 (measure caps at ~62ch).
- **Margin column**: columns 9–12 (~30ch) — figures, data, source notes, asides.
- Section rules span all 12 columns.

Left-aligned by default. Centring is reserved for exactly two places: the final
CTA and the colophon signature.

### 3.2 Type scale (fluid)

| Role | Family | Size | Other |
|---|---|---|---|
| Hero display | Instrument Serif 400 | `clamp(2.75rem, 7.5vw, 5.25rem)` | `lh 0.95`, `ls -0.02em` |
| Section opener (h2) | Instrument Serif 400 | `clamp(1.875rem, 3.6vw, 2.875rem)` | `lh 1.05`, `ls -0.01em` |
| Sub-head (h3) | Inter 600 | `1.0625rem` | `lh 1.4` |
| Lede | Inter 400 | `clamp(1.0625rem, 1.35vw, 1.1875rem)` | `lh 1.65`, stone-600 |
| Body | Inter 400 | `0.9375rem` | `lh 1.7`, stone-500 |
| Caption / marginalia | Inter 400 | `0.75rem` | `lh 1.55`, stone-500 |
| Section mark, data label, figure number | JetBrains Mono 500 | `0.6875rem` | `uppercase`, `ls 0.18em` |
| Figure number (stats) | Instrument Serif 400 | `clamp(2rem, 4vw, 3rem)` | forest-600 |

Rule: **three families, three jobs.** Serif = voice. Inter = prose. Mono = data
and apparatus. Mono is never used for "technical vibes" decoration.

### 3.3 The section mark (signature device)

Every major section opens with a full-width hairline carrying a mono label:

```
01 ─────────────────────────────────────────────  THE PROBLEM
```

Markup: flex row — mono ordinal, a `1px` rule with `flex: 1`, mono label.
This replaces the current centred eyebrow + `text-2xl font-bold` heading pattern.

### 3.4 Cards are rationed

A framed, shadowed container is reserved for **three** elements:

1. The live demo (Figure 1) — it is an instrument panel; it earns a frame.
2. `PricingSection` (existing shared component, untouched).
3. `ContactForm` (existing shared component, untouched).

Everything else separates with hairline rules and whitespace. The 6-item feature
grid becomes a specification list. The 3-step "how it works" becomes a numbered
process set against the margin. The two honesty cards become margin notes.

### 3.5 Colour discipline

- Paper `cream-100` / `ink-100`; ink `stone-800` / `stone-100`. Unchanged.
- **Forest is the only accent.** Links, figure numbers, the primary CTA, and the
  rule beneath an active item.
- Amber and alert-red are removed from decorative use. Alert-red keeps its
  semantic meaning inside the detector UI only.
- All three blurred orbs are deleted. The hero's only ornament is a single
  vertical hairline on the column boundary, reading as a print gutter.

### 3.6 Motion

Keep the existing one-orchestrated-load approach (`animate-fade-up`, `.reveal`),
with three changes:

- **Add the signature motion:** section rules draw themselves in —
  `scaleX(0) → scaleX(1)`, `transform-origin: left`, `cubic-bezier(0.22, 1, 0.36, 1)`,
  520ms. Transform-only, so it stays off the compositor's critical path.
- **Remove `.btn-shimmer`** from the page. A perpetual sweep on the CTA is
  decoration that never stops asking for attention.
- **Replace hover-lift** on links/rows with a forest underline that grows from
  the left (`scaleX` on a pseudo-element). Lift stays only on Figure 1.

`prefers-reduced-motion: reduce` must neutralise every new animation, matching
how the existing block already handles `.reveal` / `.animate-*`.

> **Constraint:** `.reveal` and `.reveal-card` are also consumed by
> `src/pages/PricingPage.tsx` through `useScrollReveal`. Their class names and
> behaviour must not change. New primitives are additive.

## 4. Section sequence

Copy is preserved verbatim; sequence and grouping change. New arc:

| # | Section | Sourced from current page |
|---|---|---|
| — | **Hero** — headline, lede, CTA, trust pill \| Figure 1 (live demo) + key data in margin | Hero + live demo |
| 01 | **The problem** — why people bite + prevalence figure | "Why do people bite their nails?" + stats strip |
| 02 | **The method** — HRT theory, then the three steps the app implements | "The approach that actually works" + "How it works" |
| 03 | **The evidence** — pull quote + citations; honesty notes in the margin | Evidence section |
| 04 | **The instrument** — spec list + privacy, merged | Feature grid + privacy statement + privacy deep-dive |
| 05 | **Why we built this** — set as a signed colophon | "Why we built this" |
| — | **Pricing** | `PricingSection` (unchanged) |
| 06 | **Further reading** — one reading list | Featured guides + blog preview, merged |
| 07 | **Questions** — FAQ, verbatim | FAQ |
| — | **Final CTA**, then **Contact** | unchanged |

Rationale for the two merges: the page currently states its privacy case twice in
two separate sections, and carries two adjacent link lists. Merging removes
redundancy without losing a single sentence or link.

## 5. Hard constraints

These are non-negotiable and every implementation task is bound by them.

1. **FAQ copy is verbatim.** All six `FAQS` question/answer strings mirror the
   `FAQPage` JSON-LD in `index.html` (line ~257). Google requires the visible
   counterpart to match. Not one character changes.
2. **No copy is deleted.** Every sentence on the page today appears on the page
   after. Rewording is out of scope.
3. **No link is dropped.** All 10 featured-guide hrefs, 3 blog-post hrefs, both
   PubMed links, the BFRB link, and every footer link survive.
4. **Heading levels stay semantic.** One `h1`; sections keep `h2`;
   `aria-labelledby` wiring stays intact on every `section` / `article`.
5. **The demo stays lazy.** `HeroDemo` must remain behind `lazy()` + the
   `demoStarted` click gate. A page view must not fetch MediaPipe.
6. **`PricingSection` and `ContactForm` are not modified.**
7. **Build and tests stay green:** `npm run build`, `npm test` (71 tests),
   `npm run seo:check`.
8. **Dark mode is fully specified** for every new element.
9. **Accessibility:** visible focus states on all interactive elements, contrast
   ≥ 4.5:1 for body text, decorative elements `aria-hidden`.

## 6. Bugs found during survey (fix as part of this work)

1. `src/index.css` sets `body { font-family: 'DM Sans', … }` but DM Sans is never
   loaded — only Inter, Instrument Serif and JetBrains Mono have `@font-face`
   rules. Body text outside a Tailwind font utility silently falls back to
   `-apple-system`. Should be `'Inter'`.
2. `dark:bg-forest-900/20` on the evidence card compiles to **nothing** —
   verified absent from `dist/assets/index-*.css`. The `forest` scale is defined
   as raw `oklch()` strings with no `<alpha-value>` placeholder, so Tailwind drops
   every opacity variant of it. That card has no dark-mode background today.

## 7. Out of scope

- Rewriting copy, or changing the FAQ.
- Redesigning `PricingSection` / `ContactForm` internals.
- Any change to `/blog`, `/pricing`, `/about` page bodies (nav + footer restyle
  reaches them by design, and is intended).
- Adding dependencies. No new packages.
