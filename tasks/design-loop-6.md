# Design loop, round 6 (10 iterations, every 5 min)

iterations: 4

## Backlog
- 5: Trial countdown: 'Ends today at <time>' in the last 24h (Math.ceil never shows 0); trial status visible below lg.
- 6: Performance: drop the Inter preload nobody uses; lazy-load ComparePage (+94KB source out of the main bundle).
- 7: Performance: preload the hero screenshot from the / server response.
- 8: A11y: scroll-padding-top for the fixed header, skip link, <main id=main> on blog posts and all pages.
- 9: Onboarding tour's first step says 'Detection is already running' before the camera is allowed; make it true.
- 10: Final short review and fixes; report.

## Log
- 1/10: paywall explains a blocked/failed checkout (Paddle load error surfaced above the plans)
- 2/10: hero: 'Made for a laptop or desktop with a webcam.' under the offer
- 3/10: failed/cancelled Google sign-in shown on the homepage with Try again
- 4/10: site header: 'Sign in' for returning customers (sm and up)
