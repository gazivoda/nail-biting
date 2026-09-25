---
target: homepage
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
target_identity: "file:/Users/igorgazivoda/nail-habit-app/src/pages/Landing.tsx"
target_fingerprint: "sha256:ce44e8d87c11fc2c3ec0490266fc113271a2f8efac946df142af0557248dca61"
target_path: /Users/igorgazivoda/nail-habit-app/src/pages/Landing.tsx
timestamp: 2026-09-25T12-55-59Z
slug: src-pages-landing-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score (Persuade; 7 and 10 n/a) — 19/32, Acceptable
1 Status 2 · 2 Match 3 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 2 · 6 Recognition 3 · 8 Minimalist 3 · 9 Error recovery 1

## Specificity
Authored for this product (journal system carries the evidence + verifiable-privacy argument; Fig.1 live detector, Fig.4/5 drawn from the real detector). Weakness: every conversion element was styled as quiet apparatus.
Detector: CLI 0 findings (does not resolve .ed-* CSS). Browser: 22 findings on / (mostly deliberate .ed-mono all-caps labels; real: 20 tap targets <44px, long mono lines, pulsing dot), low contrast text-stone-400 (~3.2:1) on /pricing and /how-it-works.

## Priority issues
- [P0] Trial terms (3 days, no card, price) absent near every CTA until 68% depth; hero trial was a grey text link.
- [P0] Demo: denied/no camera showed a fake "Watching..." wave and a dead end; 0-catch result read as "nothing happened"; success CTA only after 60s.
- [P1] No CTA between hero and pricing (12 mobile screens); 06 Further reading (13 exits) between pricing and final CTA.
- [P1] Yearly/Monthly buttons identical in effect; choice silently dropped.
- [P2] CTA copy ("(it's free)", unmeasured "under ten seconds"); macOS-only verification advice on a web app.
- [P2] Tap targets; pricing/contact gutter mismatch.

## Persona red flags
Jordan: jargon tags (PWA, MediaPipe), no "no card" near CTA, surprise camera prompt. Privacy developer: fake "Watching" after denial; Activity Monitor advice. Mobile searcher: 12 screens without an in-body CTA.
