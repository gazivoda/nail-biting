---
name: Stop Biting
description: A webcam alarm for nail biting, explained the way a safety sign explains a hazard.
colors:
  sign-white: "oklch(98.5% 0.004 85)"
  plate-white: "oklch(100% 0 0)"
  pictogram-ink: "oklch(19% 0.014 255)"
  ink-secondary: "oklch(40% 0.014 255)"
  plate-rule: "oklch(89% 0.006 255)"
  warning-yellow: "oklch(86% 0.175 92)"
  mandatory-blue: "oklch(45% 0.155 257)"
  mandatory-blue-pressed: "oklch(39% 0.15 257)"
  mandatory-blue-tint: "oklch(95% 0.025 257)"
  safe-green: "oklch(46% 0.13 148)"
  safe-green-tint: "oklch(96% 0.03 148)"
typography:
  display:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.75rem, 1.4rem + 4.6vw, 5.25rem)"
    fontWeight: 850
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.9rem, 1.25rem + 2.2vw, 3.1rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.5rem, 1.8rem + 2.4vw, 3.75rem)"
    fontWeight: 850
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "'tnum' 1"
  lede:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.15rem, 1rem + 0.55vw, 1.4rem)"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Overpass, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 650
    lineHeight: 1.45
  measurement:
    fontFamily: "'Overpass Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    letterSpacing: "0.02em"
    fontFeature: "'tnum' 1"
rounded:
  tag: "0.25rem"
  button: "0.375rem"
  focus: "0.5rem"
  safe-plate: "0.5rem"
  safe-sign: "0.6rem"
  field: "0.75rem"
  plate: "1.5rem"
  disc: "999px"
spacing:
  gutter: "clamp(1.25rem, 4vw, 2.5rem)"
  container: "76rem"
  measure: "62ch"
  plate-padding: "2rem"
  heading-gap: "3rem"
  column-gap: "2.5rem"
  section: "5rem"
  section-lg: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.mandatory-blue}"
    textColor: "{colors.plate-white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 1.6rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.mandatory-blue-pressed}"
    textColor: "{colors.plate-white}"
  button-primary-sm:
    backgroundColor: "{colors.mandatory-blue}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.button}"
    padding: "0 1.1rem"
    height: "2.75rem"
  button-ink:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.pictogram-ink}"
    rounded: "{rounded.button}"
    padding: "0 1.6rem"
    height: "3.25rem"
  button-ink-hover:
    backgroundColor: "{colors.pictogram-ink}"
    textColor: "{colors.plate-white}"
  button-light:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.mandatory-blue}"
    rounded: "{rounded.button}"
    padding: "0 1.6rem"
    height: "3.25rem"
  button-light-hover:
    backgroundColor: "{colors.mandatory-blue-tint}"
    textColor: "{colors.mandatory-blue}"
  sign-mandatory:
    backgroundColor: "{colors.mandatory-blue}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.disc}"
    size: "3.25rem"
  sign-safe:
    backgroundColor: "{colors.safe-green}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.safe-sign}"
    size: "3.25rem"
  plate:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.pictogram-ink}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate-padding}"
  plate-safe:
    backgroundColor: "{colors.safe-green-tint}"
    textColor: "{colors.pictogram-ink}"
    rounded: "{rounded.safe-plate}"
    padding: "2.5rem"
  plate-safe-header:
    backgroundColor: "{colors.safe-green}"
    textColor: "{colors.plate-white}"
    padding: "2.5rem"
  plan-tag:
    backgroundColor: "{colors.mandatory-blue}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.tag}"
    padding: "0.25rem 0.625rem"
  input-field:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.pictogram-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0.75rem 1rem"
  cta-band:
    backgroundColor: "{colors.mandatory-blue}"
    textColor: "{colors.plate-white}"
    padding: "{spacing.section} 0"
  nav-bar:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.ink-secondary}"
    height: "4rem"
---

# Design System: Stop Biting

## Overview

**Creative North Star: "The Safety Sign"**

The homepage borrows the plainness of safety signage: a colour means one thing, and the page says what the product is in one sentence. Blue "mandatory" plates are the things the visitor does. Forest-green "safe condition" plates are privacy. Everything else is black ink on sign-white enamel. The hero shows the real app (a captured screen, labelled as example data), never an illustration of the visitor's habit: a drawn hand-to-mouth pictogram was tried and removed on 2026-09-25 because it read as mocking the person it is for.

The material is enamel plate: flat, printed, with keylines set in from the edge the way a road sign carries its border. Nothing glows, nothing floats, nothing is glassy except the fixed navigation bar. Density is low and legible from a distance: heavy, tight Overpass headings (Overpass descends from Highway Gothic, the US road-sign face), open body copy, generous section bands that alternate between sign-white and plate-white. One thing moves on the page: the pictogram hand rising to the mouth, crossing the dashed threshold ring, and the warning plate flashing. The surface is light only; it is read at a desk in daylight.

This system is scoped to the sign surface (the homepage and the shared pricing block, which carries the tokens on /pricing too). The rest of the site lives in two other worlds that this file does not restate: the editorial "journal" world (`.ed-*` primitives in `src/index.css`, Instrument Serif / Inter / JetBrains Mono) still serves /blog, /pricing chrome, /how-it-works and the policy pages; the signed-in app (dashboard and friends) is its own incumbent system built on Tailwind `cream` / `ink` / `forest` tokens with Inter, in light and dark. Neither should borrow sign-system colors, and the sign surface should not borrow theirs.

**Key Characteristics:**
- Three sign kinds with fixed meanings: yellow warning (the alarm), blue mandatory (actions), green safe condition (privacy).
- Enamel-plate buttons: blue plate, white keyline inset 3px to 5px, 0.375rem corners.
- Overpass throughout, heavy (750 to 850) and tightly tracked for headings; Overpass Mono only for measurements.
- Flat: no drop shadows; depth is inset keylines and 1px rules.
- No decorative motion and no scroll-reveal; the page is still until the visitor starts the demo.
- Light only, on a warm sign-white ground.

## Colors

A near-monochrome ink-on-enamel palette with three saturated sign colors, each bound to a single meaning.

### Primary
- **Mandatory Blue** (oklch(45% 0.155 257), about #0651A9): every action the visitor takes. The filled trial button, the numbered step discs and the section discs, the recommended plan's 2px inset outline and its tag, text links, focus rings, and the one full-bleed call-to-action band.
- **Mandatory Blue, Pressed** (oklch(39% 0.15 257)): hover and pressed state of filled blue buttons and of links.
- **Mandatory Blue Tint** (oklch(95% 0.025 257)): hover fill of the light (white) button on the blue band. Nothing else.

### Secondary
- **Safe Green** (oklch(46% 0.13 148), about #076B29): the safe-condition sign. The privacy plate's header band and 2px inset border, the square safe sign, and the small check / shield icons that mark trust statements (trust list, plan features, pricing terms, form success message).
- **Safe Green Tint** (oklch(96% 0.03 148)): the body ground of the privacy plate. Its inner divider is safe green at 20% alpha.

### Tertiary
- **Warning Yellow** (oklch(86% 0.175 92), about #FACC08): reserved; today it is only the text selection highlight on the sign surface.

### Neutral
- **Sign-White** (oklch(98.5% 0.004 85), #FBFAF7): the page ground and the navigation bar (at 90% alpha).
- **Plate-White** (oklch(100% 0 0)): plates, alternate section bands (how it works, pricing, footer), inputs, and the face of ink and light buttons.
- **Pictogram Ink** (oklch(19% 0.014 255), about #10141A): headings, primary text, the triangle border and pictogram, the ink button outline, the finished-demo plate.
- **Secondary Ink** (oklch(40% 0.014 255), about #43484F): lede, body, small copy, notes, nav links at rest.
- **Plate Rule** (oklch(89% 0.006 255), about #D8DBDF): every 1px divider, section top border, plate border, and field border.

### Named Rules
**The One Warning Rule.** Warning yellow belongs to the alarm. Today it only highlights selected text; it appears nowhere else: no yellow buttons, badges, backgrounds or highlights of "important" copy.

**The Blue Means Do Rule.** Blue marks something the visitor does. If an element is not an action or a step toward one, it is not blue. The full blue field is used once per page, for the closing call to action.

**The Green Means Safe Rule.** Green only ever says "this is safe / this is private / this is included". It is never a success-flavored action color.

## Typography

**Display Font:** Overpass (variable, weights 400 to 900, self-hosted), with -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
**Body Font:** Overpass, same stack
**Label/Mono Font:** Overpass Mono (500 and 700, self-hosted), with ui-monospace, monospace

**Character:** A road-sign face used at two temperatures: heavy and tight like sign lettering for anything you should read from across the room, regular and open for anything you read up close.

### Hierarchy
- **Display** (850, clamp(2.75rem, 1.4rem + 4.6vw, 5.25rem), 0.96, -0.035em, balanced): the one h1.
- **Headline** (800, clamp(1.9rem, 1.25rem + 2.2vw, 3.1rem), 1.04, -0.025em, balanced): section headings, also on the blue band and inside the green plate header.
- **Title** (750, 1.25rem, 1.25, -0.01em): step titles, plan names, the demo heading.
- **Figure** (850, clamp(2.5rem, 1.8rem + 2.4vw, 3.75rem), 1, -0.03em, tabular): prices.
- **Lede** (400, clamp(1.15rem, 1rem + 0.55vw, 1.4rem), 1.45, secondary ink): the sentence under the h1 and under the pricing heading.
- **Body** (400, 1.0625rem, 1.6, secondary ink): running copy, capped at 62ch.
- **Small** (400, 0.9375rem, 1.5, secondary ink): footnotes, plan features, trust terms, footer copy.
- **Label** (650, 0.9375rem, 1.45, secondary ink): the offer line beside every trial button, demo instructions, citations. Nav and footer links, trust items and form labels sit at the same 0.9375rem size in 600 to 700.
- **Measurement** (Overpass Mono 700, 0.8125rem, +0.02em, tabular): timestamps and durations only.

### Named Rules
**The Measurement Mono Rule.** Overpass Mono is for numbers that measure something (a countdown, a timestamp, a duration). Labels, offers and citations are set in Overpass at 650, the sign's own face.

**The Comma Offer Rule.** Offer and meta lines separate their parts with commas ("3 days free, no card, then $2.99/month"). Overpass sets the middle dot hard against the following word, so dotted lines read as broken.

## Layout

A 12-column grid at `lg` (1024px) inside a centered container of 76rem with a fluid side gutter (clamp(1.25rem, 4vw, 2.5rem)). Common splits: hero 6/6 (headline and trial button left, the real Watch screen and the demo right), science 7/5 (argument left, evidence right), FAQ and contact 4/8 (heading left, content right). Pricing is a centered 4xl pair of plates.

Sections are full-width bands separated by a 1px plate-rule top border, alternating sign-white and plate-white grounds, padded 5rem vertically and 7rem from `lg` (the hero clears the fixed 4rem nav with 7rem / 9rem top padding). Headings sit 3rem above their content; grid gaps are 2.5rem to 3rem; body copy is capped at 62ch.

Responsive behavior: below `lg` everything stacks to one column. On a phone the order is headline, lede, trial button and offer line, then the app screen and demo, so the trial button reaches the first screen first. Nav links collapse below `md`, leaving the logo and a small trial button.

Every interactive element keeps a 44px minimum hit area (`min-h-11`), including inline text links.

## Elevation & Depth

The system is flat. There are no drop shadows anywhere on the sign surface. Depth and grouping come from three devices only: a 1px plate-rule border or divider, a change of ground between sign-white and plate-white, and inset keylines (box-shadow `inset`) that draw a sign's border inside its edge. The only translucency is the fixed nav bar: sign-white at 90% over a medium backdrop blur, so content scrolling under it stays legible.

### Shadow Vocabulary
- **Enamel keyline** (`box-shadow: inset 0 0 0 3px <plate color>, inset 0 0 0 5px oklch(100% 0 0 / 0.9)`): filled blue buttons and mandatory discs. A 2px white line set 3px in from the edge.
- **Reverse keyline** (`box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 5px <mandatory blue>`): the light button on the blue band.
- **Outline plate** (`box-shadow: inset 0 0 0 2px <color>`): ink buttons (pictogram ink), the recommended plan plate (mandatory blue), the privacy plate (safe green), the safe sign inside the green header (white).

### Named Rules
**The Flat Enamel Rule.** Signs are printed, not lit. Never add an outer shadow, glow or gradient to a plate or button; draw borders inside the edge with an inset keyline.

## Shapes

Corners encode what kind of object something is. Buttons are nearly square enamel plates (0.375rem). Content plates, like the pricing cards, are large softly rounded boards (1.5rem). The safe-condition family is squarer: the privacy plate (0.5rem) and the green square sign (0.6rem). Mandatory signs are perfect circles (999px). The plan tag is almost sharp (0.25rem). Form fields sit between (0.75rem) because they must read as affordances, not signs. Focus outlines round at 0.5rem.

Product screenshots sit on the ground with a 1px rule border and 0.5rem corners: no device frame, no browser chrome, no shadow.

## Components

### Buttons
Enamel sign plates: flat, keylined, decisive.
- **Shape:** nearly square corners (0.375rem), 3.25rem tall, 1.6rem side padding, Overpass 750 at 1.0625rem, icon gap 0.6rem.
- **Primary (blue):** mandatory blue with the enamel keyline and white text. Reserved for starting the trial. Every trial button carries an arrow that nudges 2px right on hover, and has the offer line (label style) directly beside or below it.
- **Hover / Focus / Active:** hover darkens to pressed blue (keyline follows); active drops 1px; transitions are 150ms ease-out on background, shadow and transform, removed under reduced motion. Focus is a 3px mandatory-blue outline offset 3px (white on the blue band).
- **Ink:** plate-white face, 2px inset ink outline, ink text; hover inverts to an ink fill with white text. Used for every non-trial action (live demo, monthly plan, contact submit) so the blue fill stays the trial's.
- **Light:** plate-white face with the reverse keyline and blue text, only on the blue band; hover fills with blue tint.
- **Small:** 2.75rem tall, 1.1rem padding, 0.9375rem text (nav).

### Chips
- **Plan tag:** a small mandatory-blue label (0.25rem corners, 0.8125rem bold white text) pinned over the top edge of the recommended plan. One per pricing block.

### Cards / Containers
- **Plate:** plate-white, 1px plate-rule border, 1.5rem corners, 1.75rem to 2rem padding. The recommended plan adds the 2px blue inset outline.
- **Safe-condition plate (privacy):** a green-tint board with a 2px safe-green inset border and 0.5rem corners, headed by a solid safe-green band carrying the white-keylined square sign and the section headline in white. Padding 1.5rem, 2.5rem from `sm`.
- **Evidence rule:** statistics sit under a 2px pictogram-ink top rule rather than in a card.

### Inputs / Fields
- **Style:** plate-white field, 1px plate-rule border, 0.75rem corners, 0.75rem by 1rem padding, body-size ink text; placeholder in a mid grey (oklch(54% 0.012 255)). Labels are Overpass 700 at 0.9375rem above the field.
- **Focus:** border turns mandatory blue with a 2px blue ring at 30% alpha; the browser outline is suppressed only because this ring replaces it.
- **Disabled:** the submit drops to 50% opacity with a not-allowed cursor.

### Navigation
- **Style:** fixed, 4rem tall, sign-white at 90% with backdrop blur, 1px plate-rule bottom border. Logo and wordmark (Overpass 800) left, section links in label weight and secondary ink center-right, small blue trial button right. Links darken to ink on hover. Below `md` only the logo and trial button remain.

### Mandatory and Safe Signs
- **Mandatory disc:** a 3.25rem mandatory-blue circle with the enamel keyline and a white icon. Used once, beside "How to start", to say "this is something you do". Never as decoration beside other headings.
- **Safe square:** a 3.25rem safe-green square (0.6rem corners) with a white icon; inside the green header it takes a 2px white inset keyline.

### Product screenshot (signature)
The real app, captured from a running build with example data and labelled as such: the Watch screen in the hero (it becomes the live demo in place when the visitor asks) and the History screen on a phone beside its explanation. Provenance is embedded in each WebP under public/shots.

## Do's and Don'ts

### Do:
- **Do** bind each sign color to its one meaning: yellow for the alarm, blue for actions, green for privacy and inclusion.
- **Do** put the offer line ("3 days free, no card, then $2.99/month") beside every trial button, in the label style.
- **Do** draw button and sign borders as inset keylines (white 2px line, 3px in) on flat fills.
- **Do** mark a section with a mandatory disc or safe square beside its heading when the section is an instruction or a privacy statement.
- **Do** say short sequences as a sentence ("sign in, allow the camera, keep working") rather than a numbered grid.
- **Do** keep every section visible at first paint and every hit area at least 44px.
- **Do** keep Overpass Mono for measured numbers only; tabular figures for prices and timers.

### Don't:
- **Don't** use warning yellow for anything but the alarm sign and text selection.
- **Don't** fill a second button blue beside the trial button; secondary actions are ink-outlined.
- **Don't** add drop shadows, glows, gradients or glassy surfaces (the fixed nav's blur is the only translucency).
- **Don't** print ISO sign codes (W01, M01, E01) or section numbers in the UI; they were removed from the UI for clarity.
- **Don't** put eyebrows or kickers above headings; the sign beside the heading does that job.
- **Don't** build the wellness-app hero: no gradient field, no phone mockup, no grid of icon feature cards.
- **Don't** add scroll-reveal or ambient motion.
- **Don't** illustrate the habit itself (a drawn hand at a mouth, a cartoon biter): show the real app instead. The owner found the animated pictogram insulting.
- **Don't** give the sign surface a dark theme or borrow the app's cream / forest tokens or the journal's `.ed-*` type.

## Authenticity rules (2026-09-25 loop)

- Show the real product: captured app screens with labelled example data, provenance embedded (public/shots).
- A person is on the page: the "Why this exists" note from Igor, facts from /about only.
- Say the limits plainly ("Before you start"), each line checked against the code.
- No icon-plus-label triplets, no stat callouts in big bold numbers, no stock phrases ("We'd love to hear from you"), no icon badges beside headings.
- Never illustrate the habit itself.

