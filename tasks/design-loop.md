# Design loop (10 iterations, every 5 min)

iterations: 4

## Log
- 1/10: grid alignment (History, Why this exists, privacy 2-col), hero demo column de-duplicated, contact form gap + voice

## Backlog (from the loop-4 reviews; one per iteration, top first)
- 5: History screen: time+pill left group and actions in their own ml-auto group (pills stop jumping); one vocabulary, Alarm vs Bite (chart "All"/"Bites", summary "Alarms to review"/"Bites", row tag "Alarm", TodayStats labels); PageHeader title "History" (no milestones exist); chart one fill (forest) + text summary line "{n} this week, most on {day}"; hide chart when empty; recapture public/shots History image.
- 6: App a11y floor: 10px stone-400 labels -> text-xs stone-500 (dark stone-400); amber text (Best value, amber numbers, Alarm tag) to AA; app-wide :focus-visible ring (forest); aria-current on tabs; ThemeToggle aria-label/aria-pressed; remove 28px theme toggle from the mobile bottom bar; "Clear all" min-h-11; Last 7 days/Summary as h2, day groups h3.
- 7: App typography: Overpass in the app (tailwind sans/display), PageHeader h1 in Overpass 800, remove eyebrows ("TODAY", "NAVIGATE", "PROGRESS"); keep cream/forest palette; update DESIGN.md.
- 8: Paywall: no "Pro" tier name, sentence case, honest privacy line (sign-in/payment use network), FEATURES from PricingSection, "$29" consistent, badge without em dash, buttons "Subscribe monthly/yearly".
- 9: /pricing + /how-it-works copy: PLAN_INCLUDES reuse card wording; "About 0.6 seconds" consistently; competing response matches the app's suggestions; video-never-leaves wording; drop em dashes; mirror in server.js.
- 10: Final dual review pass of everything; fix what remains (candidate: mobile-specific hero screenshot).
