# Homepage figure program

Date: 2026-09-16
Target: `src/pages/Landing.tsx` (+ a new `src/components/figures/` directory)
Problem: the redesigned homepage is ~9,800px of type with 0.0% ink coverage across
roughly 5,600px of it. It needs graphics.

## Why figures, not decoration

The page is set as a journal article. A journal article's graphics are **figures**:
numbered, captioned, and carrying information the prose cannot. That is the bar.
Stock illustration, gradient blobs, floating 3D shapes and icon tiles all fail it.

Every figure here must pass three tests:

1. **It explains something the text cannot.** If the caption could replace it, cut it.
2. **It is honest.** No invented data points. See "Honesty rules" below.
3. **It is on-system.** Cream paper, forest as the only accent, hairline strokes,
   Instrument Serif for figure numerals, JetBrains Mono for labels and captions.

## Technical constraints

- **Inline SVG, hand-authored. No charting library.** `recharts` is already a
  dependency but is code-split into a ~269 KB (76 KB gzip) chunk that the landing
  page never loads. Pulling it onto the landing critical path to draw four small
  figures would be a serious LCP regression. Inline SVG costs zero JS.
- **No new dependencies. No raster images.** (`src/assets/hero.png` is an
  unreferenced purple 3D shape, off-brand and unused — do not press it into service.)
- Each figure is its own component under `src/components/figures/`, so
  `Landing.tsx` stays readable and figures can be reused on `/how-it-works`.
- **Light mode only.** No `dark:` classes.
- Strokes use `currentColor` or the `--ed-hairline` token so they stay in-system.
- **Accessibility:** each `<svg>` gets `role="img"` plus a `<title>` and `<desc>`,
  or `aria-hidden="true"` when the adjacent `<figcaption>` already carries the
  full meaning. Never a bare decorative SVG with no text equivalent.
- **Motion:** any figure animation must be transform/opacity only, must respect
  `prefers-reduced-motion`, and must not run perpetually. A figure that draws
  itself once on reveal is in keeping with the page's existing rule-draw gesture.
- Figures must not introduce horizontal overflow at 390px; they scale with
  `width: 100%; height: auto` and a `viewBox`.

## Honesty rules

This site's differentiator is that it refuses to fake things: it publishes real
citations and explicitly declines to invent testimonials. A fabricated chart would
be a worse breach of that than a fabricated review.

- **Never plot data points that do not exist.** The Azrin & Nunn (1980) figure is
  cited as a headline reduction over the trial's five months. We do not hold the
  per-month series, so we must not draw one.
- A diagram that shows a **mechanism** (how detection works, how the habit loop
  closes) is not data and needs no source.
- A figure that shows an **expected shape over time** without measurements is a
  schematic. It must carry no y-axis, no numbers implying measurement, and its
  caption must say it is illustrative.
- Any figure carrying a real statistic repeats the citation already on the page.

## The figures

### Fig. 1 — The detector (exists)
The live `HeroDemo`. Already being promoted to dominate the hero. Keep its
`FIG. 1` mono caption.

### Fig. 2 — Detection geometry  *(highest value)*
**Section 04, The instrument.** An SVG of the MediaPipe hand landmark topology
(21 points, correct connectivity) and the mouth landmark, with the measured
distance between fingertip and mouth drawn as a vector, and the threshold radius
that fires the alarm drawn as an arc. Labels in mono: `HAND LANDMARKS · 21`,
`THRESHOLD`, `DISTANCE`.

This is the product's actual mechanism and the page currently explains it in one
sentence. It is a diagram, not data, so it needs no source. It also makes the
"on-device" claim concrete: what is being computed is geometry, not imagery.

### Fig. 3 — The habit loop, and where it breaks
**Section 02, The method.** A cycle: trigger → urge → bite → brief relief →
reinforcement, closing back on trigger. An interrupt mark cuts the loop between
urge and bite, labelled with the competing response. Habit Reversal Training is
the science the entire page rests on and it is currently three paragraphs of prose
with no visual.

Set the cycle as a hairline ring with mono labels; the interrupt is the only
forest-coloured element, so the eye lands on the thing the product does.

### Fig. 4 — Prevalence
**Section 01, The problem.** A 10×10 dot matrix, ~25 of 100 dots filled forest,
the rest hairline. Caption carries the real range and the existing citation:
20-30% of adults, Halteh, Scher & Lipner (2017).

A proportion is exactly what a dot matrix is for, and it converts an abstract
percentage into something countable. The page already states the number; this
makes it land.

### Fig. 5 — Privacy architecture
**Section 04, adjacent to the privacy argument.** Camera → on-device WebAssembly
→ alarm, with the device boundary drawn as a closed hairline enclosure and the
path to a server shown as absent, not merely unused. Mono labels; the `0 bytes`
figure sits on the severed path.

This is the page's core trust claim and currently exists only as a sentence. A
diagram makes it checkable at a glance.

### Fig. 6 — The first eight weeks  *(schematic — optional)*
**Section 02 or near the FAQ.** The page already describes the arc in prose: more
episodes noticed in week one (awareness rising, not relapse), frequency falling
through weeks two to four, the competing response feeling natural around weeks six
to eight.

If built, it is a **schematic**: two unlabelled curves (awareness, episodes) over
a week axis, with the three phases marked as bands. **No y-axis, no numbers.**
Caption must state plainly that it is illustrative and not trial data. If that
cannot be made to read honestly at a glance, cut this figure — it is the one with
real fabrication risk and the least explanatory value of the six.

## Placement principle

Figures go in `.ed-aside`, the margin column — which a separate critique measured
as empty across most of the page. That solves two problems at once: the figures
get a home, and the asymmetric grid stops being a lie. Where a figure is wide
enough to need it (Fig. 2, Fig. 3), let it span the full grid with the caption in
the margin instead.

## Verification

- `npm run build`, `npm test` (71), `npx eslint` all clean.
- Landing chunk size must not regress meaningfully — report the before/after
  gzip size of the landing entry. Inline SVG should add only a few KB of markup.
- No horizontal overflow at 390 / 768 / 1024 / 1440.
- Every figure has a caption and a text equivalent.
- Re-measure ink coverage right of x=760px: the previously empty bands must now
  carry content.
- A page view must still fetch **zero** MediaPipe resources.
