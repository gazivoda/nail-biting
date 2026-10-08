# Growth loop 3 (2026-10-08): 10 iterations, one every 3 minutes
Rounds 1 and 2 are LIVE (pushed and deployed 2026-10-08, health commit 8d29d08, new pages 200, 301s working). Desktop-app claims removed site-wide (owner chose this).
Planning inputs: seo-cluster (SERP gaps, WebSearch 2026-10-08), geo-ai-visibility (crawler + AI-answer check), Reddit drafts (done: docs/off-site-kit/reddit-and-community-drafts.md).
Rules: one local commit per iteration on main. PUSH only at the end of the round and only if the owner agreed (they approved a push on 2026-10-08 for the previous batch; ask again). `npm run build:web`, seo:check, `npm test`, route smoke, real browser for UI.
Every competitor claim: fetch the vendor's own page, date it, log it in the FACT-CHECK LOG, say "not found" otherwise (search snippets such as 'UCLA study 65%', 'FDA approved', '93% success' are NOT usable). Health claims: reuse only what existing posts already source, with their citations, or fetch PubMed first.
New pages: commit first, then `npm run seo:sync`, CORE_PAGES in scripts/sync-seo.mjs for compare/solutions pages (use `command grep -a`, edit in bytes). New posts auto-register via blogPosts.ts, OG PNG: run `npm run og:generate`, keep ONLY the new PNGs (git checkout -- public/og for the rest). No em dashes. One privacy claim. App detects NAIL BITING only.

## Iterations
- [ ] 1. robots.txt Content-Signal: fetch the spec (contentsignals.org) and use only valid keys; GEO agent says `ai-input` is invalid, verify before changing.
- [ ] 2. Homepage FAQ (Landing FAQS + index.html JSON-LD together): "Is there an app that detects nail biting with a webcam?" naming only competitors already verified on our compare pages (Hands Off, Nailed, SmartBehavior), honest about where they win.
- [ ] 3. /compare/stop-biting-vs-pavlok (fetch pavlok.com first; no snippet claims).
- [ ] 4. /compare/stop-biting-vs-biteless (Apple Watch app; fetch App Store listing + vendor site).
- [ ] 5. Post: nail biting and teeth damage (SERP is all small dentist blogs); reuse existing sourced claims or fetch PubMed.
- [ ] 6. Post: swallowing fingernails (reuse gut-health / bacteria posts' sources).
- [ ] 7. Post: is nail biting self-harm (BFRB definition; reuse bfrb-guide sources, gentle tone, no diagnosis).
- [ ] 8. Post: nail and cuticle picking (honest CTA: the app detects biting only).
- [ ] 9. best-apps comparison table rows for NailKeeper + HabitAware + Pavlok/BiteLess if shipped; fix stale "desktop apps" wording in docs/off-site-kit/*.md.
- [ ] 10. Sweep (JSON-LD parse, orphans, links to every new page from the named hub posts), final verification, review, ask about push + IndexNow.

## Deferred
Bitey compare (vendor claims need scrutiny: FDA/93%); printable tracker tool (needs a real PDF); StopBitingNails / HabitCam / Unbite compares; Hands Off alternatives page; BlogPost chunk split (918 KB); email capture (owner prerequisites); GSC recrawl of / (stale "Free AI Habit Tracker" title, owner); Google-Extended decision (owner).

## Log
