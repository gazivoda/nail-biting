---
name: Stop Biting
description: "Signal": one bold design language shared by the marketing site and the tracking app.
colors:
  paper: "oklch(97.6% 0.008 105)"
  surface: "oklch(100% 0 0)"
  ink: "oklch(19% 0.03 160)"
  ink-secondary: "oklch(42% 0.025 160)"
  line: "oklch(90% 0.01 130)"
  deep: "oklch(25% 0.05 162)"
  deep-raised: "oklch(31% 0.06 160)"
  brand: "oklch(46% 0.13 148)"
  signal: "oklch(90% 0.2 124)"
  alert: "oklch(60% 0.2 28)"
typography:
  display: { fontFamily: "Bricolage Grotesque", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.92 }
  heading: { fontFamily: "Bricolage Grotesque", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1 }
  body: { fontFamily: "Geist", fontWeight: 400, lineHeight: 1.65 }
  measure: { fontFamily: "Geist Mono", fontWeight: 600 }
rounded: { card: "1.75rem", hero: "3rem", pill: "999px" }
---

# Design System: Signal

## Idea

The product is an alarm, so the design is a signal: a deep forest ground, one
lime highlight, enormous confident numerals, and nothing decorative. It borrows
from the health and habit products that earn daily use (Whoop and Oura for big
numerals on dark ground, Headspace for saturated colour blocks and fully
rounded pills, Opal and Streaks for a single streak as the hero of the screen),
and keeps the layout calm and flat like Linear or Things.

One system serves every surface. Tokens live in `src/index.css` (`:root`),
`tailwind.config.js` maps the app's `cream` / `stone` / `ink` / `forest` / `lime`
/ `deep` scales onto them, and the marketing primitives (`.sg-*`) and the
journal primitives (`.ed-*`) read the same fonts, colours and radii.

## Colour

- **Deep forest** (`deep`, `#0B2A1E`): the loud surface. Landing hero, privacy
  and closing-CTA cards, the app's streak card, the trial card and the active
  nav item. Always paired with white text and lime accents.
- **Signal lime** (`signal` / `lime-300`, `#C6F24E`): the single highlight.
  Primary buttons on deep surfaces, the key word of a headline, units on the
  streak, the logo nail. Never used as text on paper.
- **Brand green** (`brand` / `forest-500`): links, focus rings, toggles and
  chart accents on paper.
- **Paper and surface**: a faintly warm off-white page with white cards, separated
  by ground change and a hairline, never by shadow.
- **Alert** (`alert-*`): bites and alarms only. Amber marks alarms awaiting review.
- Dark mode (app only): forest-black ground, lime replaces deep as the active fill.

## Type

- **Bricolage Grotesque** (display): every h1 to h3, big numerals, buttons, the
  wordmark. Heavy (750 to 800), tracking -0.03 to -0.045em.
- **Geist** (text): body, UI, forms. **Geist Mono**: only for measured values.
- Fonts are self-hosted variable files in `public/fonts`.

## Shape and depth

- Surfaces use large radii: cards 1.75rem (`rounded-2xl`), hero and CTA cards up
  to 3rem, controls and buttons are pills.
- Flat: no outer shadows or glows. Depth is ground colour plus a 1px hairline.
- Tailwind's `rounded-lg/xl/2xl/3xl` are redefined in `tailwind.config.js`, so the
  whole app follows from one change.

## Components

- **Primary button**: deep-forest pill with white text on paper; lime pill with
  deep text on dark surfaces (`.sg-btn`, scoped by `.sg-dark`). One per view.
- **Secondary button**: outlined pill (`.sg-btn-ink`).
- **Hero card** (`.sg-hero.sg-dark`): deep forest, 3rem radius, lime highlight word.
- **Streak card**: the largest thing in the app. Bricolage 92px numerals on deep,
  lime unit labels.
- **Nav**: deep (lime in dark mode) pill for the active item.
- **Logo**: an alarm target (lime ring with a centre dot) with a bite taken out
  of the ring, on a deep-forest tile (`public/logo.svg`; `logo-dark.svg` inverts
  it for dark grounds). Abstract on purpose: ring and dot say "detection", the
  bite says what it stops. The same geometry produces the favicon, app icon and
  PNG icons. Avoid anything finger- or nail-shaped.

## Do

- Use `.sg-dark` for any deep surface so text, rules and buttons re-point
  automatically.
- Keep one lime moment per surface.
- Keep screenshots on the landing page real: recapture them from the running app
  (`public/shots`) whenever the app UI changes.

## Don't

- Don't put lime text on paper, or add gradients, glows or drop shadows.
- Don't introduce a new font family or radius outside the tokens.
- Don't illustrate the habit itself (a hand at a mouth); show the real app.
