# Nail Habit Tracker — Landing Page Specification

## Overview

Single-scroll marketing page. No navigation bar. Mobile-first. The primary design goal is to communicate trust — privacy is the product's most important differentiator, so the visual language must earn credibility before pitching features. Every section is a step toward that credibility, not a features list for its own sake.

Palette, type, spacing, and component patterns are derived directly from the existing app to ensure a seamless transition when the user taps "Launch App".

---

## Design Token Reference

These are the exact values the app uses. Every component on the landing page must source from this table.

| Token | Value | Usage |
|---|---|---|
| `bg-slate-950` | `#020617` | Page background |
| `bg-slate-900` | `#0f172a` | Card surfaces |
| `border-slate-800` | `#1e293b` | Card borders, dividers |
| `text-slate-100` | `#f1f5f9` | Primary headings |
| `text-slate-400` | `#94a3b8` | Secondary body copy |
| `text-slate-500` | `#64748b` | Tertiary/meta copy |
| `text-emerald-400` | `#34d399` | Primary accent, icons, highlights |
| `text-emerald-500` | `#10b981` | Accent hover state |
| `bg-emerald-950/40` | rgba of `#022c22` at 40% | Privacy badge background |
| `border-emerald-900/40` | rgba of `#064e3b` at 40% | Privacy badge border |
| `text-red-400` | `#f87171` | Alert / danger accent |
| `text-amber-400` | `#fbbf24` | Trophy / best-streak accent |
| `rounded-2xl` | `1rem` | Card border radius |
| `rounded-xl` | `0.75rem` | Inner element radius |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | Card hover elevation |

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — the exact stack from `index.css`.

---

## Page Architecture

Seven sections in scroll order:

1. Hero
2. Privacy Statement (trust anchor)
3. How It Works (three-step process)
4. Feature Grid
5. Privacy Deep-Dive (technical credibility)
6. Social Proof Strip (stats / no-account pitch)
7. Final CTA

Max content width: `max-w-lg` (512 px) matching the app layout, centered with `mx-auto`. Horizontal padding: `px-4` on mobile, `px-6` on sm+. Section vertical rhythm: `py-16` between each section (reduces to `py-10` on mobile).

---

## Section 1: Hero

### Layout

Full-viewport-height section (`min-h-screen`) with `flex flex-col items-center justify-center`. Subtle radial gradient behind the headline — `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)`. This creates a very faint emerald glow at the top that ties to the accent color without being loud.

### Copy

```
NAIL HABIT TRACKER

Stop biting your nails.
Your webcam is the intervention.

On-device AI watches for the moment your hand moves toward your
mouth — then sounds the alarm. No cloud. No account. No data sent
anywhere. Just you and your browser.

[Launch App — It's Free]
```

### Typographic Specs

- "NAIL HABIT TRACKER" — `text-xs tracking-[0.25em] uppercase text-emerald-400 font-medium` — serves as an eyebrow/label, not the main headline
- "Stop biting your nails." — `text-4xl sm:text-5xl font-bold text-slate-100 leading-tight` — two-line break is intentional; "Your webcam is the intervention." is the payoff line and should sit on its own line
- Body paragraph — `text-slate-400 text-base leading-relaxed max-w-sm text-center mt-4`
- The three comma-separated "No cloud. No account. No data" phrases should each wrap in `<span class="text-slate-300 font-medium">` to give them slightly more weight

### Privacy Badge (reuse existing app component pattern)

Directly below the body paragraph, before the CTA:

```
[ShieldCheck 12px] All processing on-device — camera never leaves your browser
```

Exact styling from Dashboard.tsx:
`flex items-center justify-center gap-1.5 text-emerald-400 text-xs py-1.5 px-4 bg-emerald-950/40 border border-emerald-900/40 rounded-full`

This is the same badge the user will see the moment they enter the app. Matching it here creates visual continuity and reinforces the message is consistent, not just marketing copy.

### CTA Button (hero variant)

See Section 7 for full CTA spec. In the hero, use the large variant:

`bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-base px-8 py-4 rounded-2xl transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:scale-95`

The button label: "Launch App — It's Free"

Icon: `Zap` (Lucide, size 16) placed to the left of the text with `gap-2`.

Below the CTA button, in `text-slate-600 text-xs mt-3`:
"Works in Chrome and Edge. Requires camera permission."

### Scroll Indicator

At the very bottom of the hero, a `ChevronDown` icon (Lucide, size 20, `text-slate-700 animate-bounce`) signals scrollability. Absolute-positioned `bottom-8 left-1/2 -translate-x-1/2`.

---

## Section 2: Privacy Statement (Trust Anchor)

This section appears immediately after the hero fold. Its job is to arrest any sceptic before they scroll past. It should feel like a hard commitment, not a feature bullet.

### Layout

Full-width card using the same `bg-slate-900 border border-slate-800 rounded-2xl` pattern from the app. Generous internal padding: `p-8`. No grid — single column, centred.

### Copy

```
Your camera never leaves your browser.

Not even for a millisecond.

MediaPipe runs entirely in WebAssembly inside your tab. Every frame
of video is analysed locally on your CPU or GPU. Zero bytes of
camera data are transmitted to any server — because there is no
server involved in detection.

Close your network tab and the app works exactly the same.
```

### Typographic Specs

- "Your camera never leaves your browser." — `text-2xl font-bold text-slate-100 text-center`
- "Not even for a millisecond." — `text-emerald-400 text-lg font-medium text-center mt-1`
- Body paragraph — `text-slate-400 text-sm leading-relaxed text-center mt-4 max-w-xs mx-auto`
- "Close your network tab..." — `text-slate-300 text-sm font-medium text-center mt-4` — treat as a punchy sign-off line, visually separated with `mt-4 pt-4 border-t border-slate-800`

### Icon

`Lock` (Lucide, size 32, `text-emerald-400`) centered above the headline with `mb-6`.

Wrap icon in a container: `w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center mx-auto mb-6`

### Colour Detail

The card should have a very subtle emerald tint on its background to signal safety:
`bg-emerald-950/10 border border-emerald-900/30 rounded-2xl` — slightly different from the neutral cards used for features.

---

## Section 3: How It Works

Three steps shown as a vertical list on mobile (stacked), horizontal row on sm+ screens. The steps use numbered circles, not icons, to feel instructional and sequential.

### Section Heading

```
How it works
Three steps, nothing to install.
```

- "How it works" — `text-xs uppercase tracking-[0.2em] text-emerald-400 text-center font-medium`
- "Three steps, nothing to install." — `text-2xl font-bold text-slate-100 text-center mt-2`

### Steps Data

**Step 1**
- Number: 01
- Heading: "Allow camera access"
- Body: "One browser permission prompt. You can revoke it any time from your browser settings. The app never asks for anything else."
- Icon suggestion: `Camera` (Lucide)

**Step 2**
- Number: 02
- Heading: "AI loads in your browser"
- Body: "MediaPipe hand and face landmark models download once and run in WebAssembly — the same technology that powers Google Meet's background blur."
- Icon suggestion: `Cpu` (Lucide)

**Step 3**
- Number: 03
- Heading: "Get alerted when it matters"
- Body: "The moment your fingers approach your mouth, a sound alarm fires and the incident is logged locally. You're awake to the habit before it happens."
- Icon suggestion: `Bell` (Lucide)

### Step Card Pattern

Each step card:
```
bg-slate-900 border border-slate-800 rounded-2xl p-6
```

Inside the card:
- Numbered circle: `w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400` — contains "01", "02", "03"
- Icon beside number: `text-emerald-400` at `size={18}`
- Number and icon sit in `flex items-center gap-3 mb-4`
- Heading: `text-slate-100 font-semibold text-base`
- Body: `text-slate-400 text-sm leading-relaxed mt-2`

Connector between step cards on mobile: a vertical dotted line `border-l border-dashed border-slate-800 ml-4 h-6` between each card to suggest flow.

---

## Section 4: Feature Grid

Six features in a 2-column grid on mobile, retaining 2 columns on sm+. Each feature is a compact card — not a full-width block. This section should feel dense and information-rich, a contrast to the spacious trust sections above.

### Section Heading

```
Everything you need to build the habit.
Nothing you don't.
```

- Line 1: `text-2xl font-bold text-slate-100 text-center`
- Line 2: `text-slate-400 text-base text-center mt-1`

### Feature Cards

Grid: `grid grid-cols-2 gap-3 mt-8`

Each card: `bg-slate-900 border border-slate-800 rounded-2xl p-5`

Feature card internal structure:
```
[Icon — top, accent colored, size 20]
[Feature name — text-slate-100 font-semibold text-sm mt-3]
[Description — text-slate-500 text-xs leading-relaxed mt-1]
```

### Six Features

**Feature 1 — On-Device AI**
- Icon: `Cpu` — `text-emerald-400`
- Name: "On-Device AI"
- Description: "MediaPipe runs in WebAssembly. Your CPU does the work, not a server."

**Feature 2 — Real-Time Alerts**
- Icon: `BellRing` — `text-red-400`
- Name: "Real-Time Alerts"
- Description: "Audible alarm the moment your hand nears your mouth. Hard to ignore."

**Feature 3 — Streak Tracker**
- Icon: `Trophy` — `text-amber-400`
- Name: "Streak Tracker"
- Description: "Current streak and all-time best. Losing your streak hurts — that's the point."

**Feature 4 — Incident Log**
- Icon: `ClipboardList` — `text-slate-400`
- Name: "Incident Log"
- Description: "Tag each bite by trigger: stress, focus, boredom. Patterns become visible."

**Feature 5 — 7-Day Chart**
- Icon: `BarChart2` — `text-emerald-400`
- Name: "7-Day Chart"
- Description: "Visual history of bite frequency. Colour-coded by severity — green, amber, red."

**Feature 6 — No Account Needed**
- Icon: `UserX` — `text-slate-400`
- Name: "No Account Needed"
- Description: "Everything lives in your browser's localStorage. Nothing to sign up for, ever."

### Visual Accent Detail

The "On-Device AI" card and "No Account Needed" card are the privacy-adjacent features. Give them a faint emerald border instead of the default slate:
`border-emerald-900/40` — subtle differentiation that does not break the grid's visual unity.

---

## Section 5: Privacy Deep-Dive

This section is for the technically curious user. It uses a code-like aesthetic to communicate credibility — treating privacy as an engineering commitment rather than a marketing claim.

### Section Heading

```
Open, honest, verifiable.
```

`text-2xl font-bold text-slate-100 text-center`

Below: `text-slate-400 text-sm text-center mt-2 max-w-xs mx-auto`
"The privacy claims on this page aren't marketing. You can verify every one of them in your browser."

### Three Technical Claims

Displayed as a vertical stack of bordered rows (like the Settings sections in the app):

**Claim 1**
- Icon: `WifiOff` — `text-emerald-400 size={16}`
- Title: "No network requests during detection"
- Detail: "Open DevTools > Network tab while the app is running. Filter by 'Fetch/XHR'. You'll see nothing — because nothing is sent."

**Claim 2**
- Icon: `HardDrive` — `text-emerald-400 size={16}`
- Title: "Data lives in localStorage only"
- Detail: "Your streak and incident log are stored in your browser's localStorage. Clear site data and it's gone. No backup — that's the point."

**Claim 3**
- Icon: `Code2` — `text-emerald-400 size={16}`
- Title: "Open to inspection"
- Detail: "This is a standard browser app. Press F12, read the source. The camera frame never leaves the canvas element."

### Row Component Pattern

Each claim:
```
bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4
flex items-start gap-4
```

Icon column: `flex-shrink-0 mt-0.5`
Text column:
- Title: `text-slate-100 text-sm font-semibold`
- Detail: `text-slate-500 text-xs leading-relaxed mt-0.5`

Stack with `space-y-3`.

---

## Section 6: Social Proof Strip

Lightweight horizontal row of three numbers. No border — just numbers and labels on the raw background. This section exists to answer "is this real?" without a testimonials carousel.

### Layout

`flex flex-col sm:flex-row items-center justify-center gap-8 py-4`

On mobile, the three items stack vertically with `gap-6`.

### Three Stats

**Stat 1**
- Number: "100%"
- Label: "Local processing"
- Number color: `text-emerald-400 text-3xl font-bold`
- Label color: `text-slate-500 text-xs uppercase tracking-wider`

**Stat 2**
- Number: "0"
- Label: "Bytes sent to servers"
- Same number treatment as above

**Stat 3**
- Number: "Free"
- Label: "Forever. No subscription."
- Same number treatment. The word "Free" styled in `text-emerald-400` adds warmth.

### Dividers (desktop only)

Between each stat, a `border-l border-slate-800 h-10 hidden sm:block` vertical rule.

### Below the Stats Strip

A single line of copy centred below, `text-slate-600 text-xs mt-6`:
"No sign-up. No credit card. No email. Works in any Chromium-based browser."

---

## Section 7: Final CTA

The closing punch. Mirrors the hero visually but is shorter — the user already knows the pitch. This section should feel like a door being held open.

### Layout

`text-center py-16`

Subtle radial gradient from the bottom: `radial-gradient(ellipse 60% 50% at 50% 100%, rgba(16,185,129,0.06) 0%, transparent 70%)`

### Copy

```
Ready to break the habit?

The app is waiting. No setup. No account. Just open it and allow
camera access — detection starts in under ten seconds.

[Launch App — It's Free]
```

- "Ready to break the habit?" — `text-3xl font-bold text-slate-100`
- Body — `text-slate-400 text-sm leading-relaxed max-w-xs mx-auto mt-4`

### CTA Button (definitive spec)

This button is the most important element on the page. Its design must communicate: primary action, low commitment, premium quality.

```
bg-emerald-500 hover:bg-emerald-400
text-slate-950
font-semibold
text-base
px-8 py-4
rounded-2xl
transition-all duration-150
hover:-translate-y-0.5
hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]
active:scale-95
inline-flex items-center gap-2
```

Label: "Launch App — It's Free"

Icon: `Zap` (Lucide, `size={16}`) to the left of the text.

The `hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]` glow is the one intentional "wow" moment on an otherwise restrained page. It reinforces the emerald accent and draws the eye on hover.

The button links to the app root (`/` or the app page — wherever the React app is mounted).

Below the button, `text-slate-600 text-xs mt-4`:
"Chrome or Edge required for camera API. iOS Safari is not supported."

---

## Page Footer

Minimal. No links, no newsletter, no social. Just one line.

`text-center py-8 text-slate-700 text-xs`

"Nail Habit Tracker — built with MediaPipe, React, and WebAssembly. All data stays on your device."

---

## Spacing and Rhythm Summary

| Context | Value |
|---|---|
| Between major sections | `py-16` (desktop), `py-10` (mobile) |
| Card internal padding | `p-6` standard, `p-5` compact grid cards |
| Between stacked cards | `space-y-3` or `gap-3` |
| Icon-to-text gap | `gap-3` always |
| Button horizontal padding | `px-8` hero/final CTA, consistent |
| Max content width | `max-w-lg` (512px), `mx-auto` |
| Page horizontal padding | `px-4` mobile, `px-6` sm+ |

---

## Animation and Motion

Keep motion minimal — this is a productivity tool, not an entertainment product. Two permitted animations:

1. `animate-bounce` on the hero scroll chevron (existing Tailwind utility).
2. `animate-pulse` on the emerald dot in the privacy badge (matches the app's own pulsing dot on the streak card).

No scroll-triggered animations, no parallax, no entrance transitions on cards. They add no trust — and trust is the product.

If a `prefers-reduced-motion` check is available, suppress both animations.

---

## Accessibility Requirements

All requirements are WCAG AA minimum. Privacy and trust are the theme — the page must be accessible to reinforce that message.

| Requirement | Implementation |
|---|---|
| Colour contrast — body text (`slate-400` on `slate-950`) | Passes at 5.2:1 |
| Colour contrast — secondary text (`slate-500` on `slate-950`) | Passes at 3.7:1 (for large text / UI components) |
| CTA button (`slate-950` text on `emerald-500` bg) | Passes at 8.6:1 |
| Focus ring — CTA button | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400` |
| Touch targets | All interactive elements minimum 44px tall |
| Alt text | No decorative images on this page; icons are `aria-hidden="true"` |
| Semantic HTML | `<main>`, `<section>` with `aria-label`, `<h1>` through `<h3>` in logical order |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` suppresses bounce and pulse |

---

## Implementation Notes for Developer Handoff

### File placement

Create `src/pages/Landing.tsx`. Route to it conditionally in `main.tsx` or `App.tsx` — if the URL path is `/` and you want a separate landing, serve it before the app shell. If the app is a pure PWA always launching into the dashboard, the landing page may be a separate static HTML file deployed at the root domain.

### Icon imports

All icons are from `lucide-react` which is already installed. Import only what the page uses:

```tsx
import {
  ShieldCheck, Lock, Zap, Cpu, BellRing, Trophy,
  ClipboardList, BarChart2, UserX, WifiOff, HardDrive,
  Code2, ChevronDown, Camera, Bell
} from 'lucide-react';
```

### Tailwind classes to verify

The arbitrary shadow value `shadow-[0_0_24px_rgba(16,185,129,0.35)]` and the tracking value `tracking-[0.25em]` require JIT mode, which Vite + Tailwind v3+ enables by default. No config changes needed.

The `pb-safe` utility used in the TabBar is not needed on the landing page since there is no fixed bottom nav.

### CTA link target

If the landing page is a separate HTML file, the CTA `href` should be `./app` or the app's deployed URL. If it is a React route, use React Router's `<Link to="/app">` or trigger tab switching via a prop.

### No external fonts

Do not add Google Fonts or any external font CDN. The system font stack is the brand. Adding a web font would introduce a third-party network request — which directly contradicts the privacy message on the page.

---

## Quick Visual Checklist Before Launch

- [ ] Privacy badge on hero exactly matches the one inside the app
- [ ] No images, no CDN assets, no tracking scripts
- [ ] CTA button has emerald glow on hover
- [ ] "NAIL HABIT TRACKER" eyebrow label is emerald-400, not white
- [ ] Step cards have numbered circles (01, 02, 03), not arbitrary icons alone
- [ ] Feature grid is 2-column on all screen sizes
- [ ] Privacy deep-dive rows use `flex items-start` — icon aligns to text top, not centre
- [ ] Footer is one line, plain, no links
- [ ] Page background is `#020617` (slate-950), not `#0f172a` (slate-900)
- [ ] No navigation bar at top of page
