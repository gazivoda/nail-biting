# WS13 accessibility report (WIP)

Status: work in progress. A fuller version replaces this file when the audit and the fixes are done.

Scope: every new overlay and screen, with every UI feature flag ON, on a local run (port 3216), headless Chrome 155, Lighthouse 13.5.0
(axe-core engine), axe-core 4.13 injected into each state over the DevTools protocol, plus hand-written checks for what those cannot see
(real Tab walk, focus indicator pixels, Escape and focus return, reduced motion, live-region churn, computed contrast in both themes,
target size). No real screen reader and no real assistive technology were used.

## Lighthouse accessibility score (local server only)

| Page | Form factor | Score |
|---|---|---|
| /signin | mobile, desktop | 100, 100 |
| /share/<token> (public summary) | mobile, desktop | 100, 100 |
| / signed out (landing) | mobile | 100 |
| /pricing | mobile | 100 |
| / signed in (Watch tab, session cookie) | desktop, mobile | 100, 100 |
| /redeem (signed in) | mobile | 100 |

Lighthouse only reaches pages with a URL; every other state below was checked with axe-core and the hand-written checks.
