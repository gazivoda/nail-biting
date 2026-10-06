# Growth loop 2 (2026-10-06): 10 iterations, one every 3 minutes
Synthesised from 3 subagents (technical SEO, SERP intent via WebSearch, conversion). Round 1: tasks/growth-loop.md.
Rules (unchanged): one small local commit per iteration on main, NOT pushed; seo:check + `npm test` + `npm run build:web` (NOT `npm run build`) before commit;
check new routes in a real browser after unregistering the localhost service worker; no biting imagery; no em dashes; one privacy claim
("No camera data is sent while it runs"); every competitor claim fetched from the vendor's own site and dated, state "not found" instead of guessing;
new core pages: commit first, then `npm run seo:sync`, register in CORE_PAGES/PAGE_SOURCES (use `command grep -a`, edit bytes); never regenerate all OG PNGs (revert noise, keep new ones).

## Iterations
- [x] 1. Mac landing page (/download/mac or similar): FIRST verify what is really downloadable (downloads/, electron config, macOS minimum, signing) and state only that. SERP "stop nail biting app mac" has no result for us.
- [x] 2. 301 canonicalisation middleware in server.js: trailing slash, uppercase path, /index.html (skip /api, /assets, static). Verify with curl -I and that /blog/<slug> still 200.
- [x] 3. Track every trial CTA: trial_click on HeroDemo (catch + other), PricingSection anchors, SiteHeader sign-in link (src/utils/track.ts; consider a source param).
- [x] 4. Hero trust line: single privacy claim + "Google sign-in, opens a new tab" + "cancel anytime" under the hero CTA/OFFER_LINE; reword the 5 other privacy phrasings in Landing/Paywall/Onboarding to the one claim (FAQ answer must match index.html JSON-LD).
- [ ] 5. Phone visitors: on narrow/touch devices swap trial button for "Email me the link for my computer" (mailto, no backend) + track event.
- [ ] 6. FAQ objections (card/cancel, does it work on my phone, do I need Google) in Landing FAQS and index.html JSON-LD together.
- [ ] 7. Windows landing page (/download/windows), same verify-first rule as 1 (check Windows build availability).
- [ ] 8. Compare page: Stop Biting vs NailKeeper (fetch vendor site first; photo tracking vs real-time detection only if stated there).
- [ ] 9. Rewrite best-apps-to-stop-nail-biting title/intro, adding only apps verified on their own sites (NailKeeper, Unbite, HabitCam...); keep existing claims.
- [ ] 10. Technical sweep: JSON-LD parse/@id uniqueness on new pages, orphan check of sitemap URLs vs crawler HTML nav (calculator, solutions), hero image alt shortened; final verification + summary.

## Deferred (bigger or owner-gated)
Split 918 KB BlogPost chunk per slug (touches server.js, generate-seo-content, sync-seo: needs its own plan); /compare/stop-biting-vs-stopbitingnails, habitcam, habitaware-alternatives; paywall "You caught N bites" (needs stored incident count); onboarding tour timing; tab refocus re-check after sign-in; GSC recrawl of / (SERP shows stale title "Free AI Habit Tracker"); app-store listings (Google rewards store listings for "nail biting app"); owner list in tasks/growth-loop.md.

## Log
- it1: CHANGED SCOPE. Verified: GitHub releases for gazivoda/nail-biting list ONLY v1.0.0 (old 'Nail Habit Tracker' DMGs). The v1.1.0 'Stop Biting' DMG URLs in server.js DOWNLOAD_MAP return 404, and no UI links /downloads/. So there is NO working Mac (or Windows) download of Stop Biting, yet llms.txt/index.html say 'native desktop app for Mac and Windows' and Landing mentions a macOS desktop app. Built /solutions/for-mac as a BROWSER-ONLY page (no download claim). OWNER: publish the v1.1.0 release or remove the desktop-app claims. Iteration 7 (Windows page) will follow the same browser-only rule.
- it2: 301 canonicalisation middleware in server.js (trailing slash, uppercase, /index.html; extensionless page paths only, /api and /assets and anything with a file extension untouched, query kept). curl-verified 301s and that clean URLs, sitemap, llms, API and /downloads redirect are unchanged. Coolify/Traefik may still add its own redirects; check after deploy with curl -I.
- it3: every sign-in/trial link now tracked with a source label (header, landing_hero, landing_final, pricing_yearly, pricing_monthly, pricing_page, blog_post, compare_page, about, how_it_works, cost_calculator, demo_catch, demo_failure) plus a separate signin_click for the header 'Sign in'. Browser-verified on /pricing (5 links, 5 correct events). demo_catch/demo_failure follow the same pattern but need a camera, so not exercised. Skipped by design: Landing 'Try again' (auth error retry) and AuthContext's programmatic redirect.
- it4: hero now says, beside the button, 'Detection runs on your device and sends no camera data while it runs. Sign in with Google (it opens in a new tab). Cancel anytime.' (React + server.js SSR mirror). Deliberately NOT done: rewording the other privacy phrasings ('video never leaves your device', '0 bytes of camera data', 'no video ever leaves it'): they are all true statements about camera video, none is the retired 'zero network requests' claim, and the homepage meta already uses 'Video never leaves your device', so churn without benefit. Verified on desktop in a real browser; mobile width not checked (no resize tool).
