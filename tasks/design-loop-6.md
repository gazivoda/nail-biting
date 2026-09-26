# Design loop, round 6 (10 iterations, every 5 min)

iterations: 1

## Backlog
- 2: Hero says the app is for a laptop/desktop with a webcam, before a phone visitor starts the 3-day clock.
- 3: A failed/cancelled Google sign-in returns to the homepage silently (#auth_error only in console); say it and offer to retry.
- 4: Returning customers can only see 'Start free trial' in the header; add 'Sign in'.
- 5: Trial countdown: 'Ends today at <time>' in the last 24h (Math.ceil never shows 0); trial status visible below lg.
- 6: Performance: drop the Inter preload nobody uses; lazy-load ComparePage (+94KB source out of the main bundle).
- 7: Performance: preload the hero screenshot from the / server response.
- 8: A11y: scroll-padding-top for the fixed header, skip link, <main id=main> on blog posts and all pages.
- 9: Onboarding tour's first step says 'Detection is already running' before the camera is allowed; make it true.
- 10: Final short review and fixes; report.

## Log
- 1/10: paywall explains a blocked/failed checkout (Paddle load error surfaced above the plans)
