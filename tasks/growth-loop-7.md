# Growth loop 7 (2026-10-19): 30 iterations, one every 3 minutes
State: rounds 1-5 are LIVE (health commit 4abf41f). Round 6 (13 commits, up to llms.txt sync) is committed locally on main and NOT pushed: the owner declined the push tool call, so do NOT push. Round 7 commits stack on top. Owner items open: push + IndexNow, Search Console recrawl, GA check of events, subreddit rules, email capture, Google-Extended, Content-Signal policy.
Inputs: seo-geo/technical audit (file:line evidence, verified against a built server by the agent), content-strategist backlog (20 items, NO sources fetched by it), Growth Hacker funnel list. All agent claims are SECOND-HAND: verify in the repo or on the primary page before building or writing.
Rules: one local commit per iteration on main, NO push. `npm run build:web` (never plain build), seo:check, `npm test`, route smoke on a built server (spare port, kill after). Content commit BEFORE `npm run seo:sync`, then commit the sync. No em dashes in anything new; one privacy claim ("no camera data is sent while it runs"); web app only; never draw habit imagery. Every outside fact: fetched by me THIS iteration from PubMed (mcp__plugin_bio-research_pubmed__*) or the official page, dated, in the log. If a PubMed query finds nothing citable, write a 'no study found' post (round 5 pattern) or skip the item and say so. Bump dateModified only for new content, not for links or heading wording. Tick the box and add a log line each iteration.

## Iterations
Technical and linking
- [x] 1. PRODUCT_LINKS (src/data/related.ts:90): the audit says 136 of 150 posts show no "Put it into practice" link and 9 compare/solutions pages (pavlok, nailed, smartbehavior, hands-off, biteless, habitcam, nailbitemenu, for-mac, for-windows) have no in-body inbound link. Verify, then add map entries one post each where the topic truly matches.
- [x] 2. og:image:alt / twitter:image:alt missing on 171 of 180 pages (server.js ~1014): emit page title as alt.
- [ ] 3. Speakable on the two tool pages and three legal pages (class article-summary exists); calculator typed WebApplication in addition to WebPage; fix the stale comment near server.js:1820.
- [ ] 4. Em dashes left in 3 rendered titles (/blog, /pricing, toenails), 9 H1s, 8 compare/solutions subtitles feeding llms.txt; align best-apps title vs H1 ("5 Best Tools"). Then seo:sync.
- [ ] 5. Question headings batch 3: why-do-people-bite-their-nails, vs-hair-pulling, dermatophagia, vs-teeth-grinding, plus others whose opening already answers.
- [ ] 6. Contextual in-body links: posts that mention bitter polish / students / cost without linking (audit counts: 26/23/45), 10 posts, each link only where the sentence is about that thing.
- [ ] 7. HowTo schema generic (server.js:1287 hardcoded slug): enable for nail-biting-trigger-mapping if its four "Step N:" sections mirror visible text.
- [ ] 8. llms.txt Blog articles grouped by tag (scripts/sync-seo.mjs holds binary bytes; use python bytes edit, `command grep -a`).
- [ ] 9. One real app screenshot with alt text from public/shots in the /how-it-works crawler HTML (real app only). Check what the shot shows first.
- [ ] 10. Trim descriptions 161-165 chars (36 posts + 11 compare metas), keep the vitest ceiling, tighten to 160 if all pass.
Content from primary sources (each: fetch, verify, write, OG card, seo:sync)
- [ ] 11. New post: acceptance-commitment-therapy-nail-biting (Twohig 2003 and related abstracts).
- [ ] 12. New post: Azrin 1980 habit reversal trial for nail biting (abstract-level only).
- [ ] 13. New post: nail biting vs tics/Tourette (DSM-5-TR via APA; no "same thing" claim unless a source states it).
- [ ] 14. New post: inositol and nail biting (or 'no trial found').
- [ ] 15. New post: nail bed / hyponychium regrowth (only what sources give).
- [ ] 16. Tool page: nail growth timeline calculator (client-side, rate quoted from the source cited by grow-nails).
- [ ] 17. New post: habit vs compulsion vs tic.
- [ ] 18. New post: pinworm (Enterobius) and nail biting (CDC page + PubMed).
- [ ] 19. New post: staph/MRSA carriage and nail biting.
- [ ] 20. New post: sleep deprivation and nail biting (likely 'no study found').
- [ ] 21. Expansion: nail-and-cuticle-picking (394 words) from onychotillomania sources.
- [ ] 22. Expansion: is-nail-biting-self-harm, careful non-clinical wording.
- [ ] 23. Expansion: nail-biting-fsa-hsa from IRS Publication 502/969 text (quote, no advice).
- [ ] 24. Expansion: nail-biting-wearable-technology from official product pages, dated.
- [ ] 25. Tool/page: relapse plan worksheet (HTML only) from Lee & Lipner 2022 on relapse.
Funnel and trust
- [ ] 26. Camera-permission pre-line in HeroDemo (approved wording, no new claim).
- [ ] 27. Cancellation/refund reassurance near the pricing trial button, wording read from RefundPage that day.
- [ ] 28. Listing kit docs/listing-kit.md (50/150/300-word descriptions, price and trial text read from code, screenshot specs, targets); press one-pager docs/press/one-pager.md quoting only figures already cited in nail-biting-statistics.
Wrap up
- [ ] 29. Question headings batch 4 + internal link pass on the new posts (each new post linked from 2+ existing posts; Related reading).
- [ ] 30. Sweep (all sitemap URLs: 200, one canonical, h1, JSON-LD, article meta, alt, links, orphans), final review, delete cron, ask the owner about push + IndexNow (rounds 6 and 7 together).

## Log
- it1: audit claim checked: PRODUCT_LINKS had 14 entries (so 136 of 150 posts had no 'Put it into practice' link; confirmed). Added 14 entries, each to a page the post is already about: gaming -> for-gamers; exams and college-students -> for-students; laptop-working-from-home -> for-remote-workers; focus-and-work and at-work-meetings -> for-desk-workers; bitter-nail-polish-review -> bitter-polish-alternative; best-apps and how-ai-can-help -> ai-detection-apps; webcam-privacy, mediapipe explained, detection-accuracy, camera-setup, app-battery-performance -> /how-it-works. Labels reuse existing page titles. NOT linked (no natural post): pavlok, nailed, smartbehavior, hands-off, biteless, habitcam, nailbitemenu, for-mac, for-windows; they stay reachable from ai-detection-apps and the nav, and forcing a link would be a worse experience. dist/seo-content.json now has 28 posts with a productLink; built server shows the block in crawler HTML on four sampled posts and none on an unmapped post. Links only, dateModified not bumped. tsc, build:web, seo:check, 99 tests pass.
- it2: audit claim confirmed in code: injectMeta (server.js) removed the shell's og:image:alt and twitter:image:alt whenever a page had its own og image and put nothing back. Now it rewrites both to the page title (the OG cards are rendered from the title, so it is a truthful alt). Crawled all 180 sitemap URLs on a built server: every page has exactly one non-empty og:image:alt and one twitter:image:alt (pages without their own card keep the shell's site-card alt). Example: nail-biting-cost -> 'The Real Cost of Nail Biting Over Time | Stop Biting'. build:web, seo:check, 99 tests pass.
