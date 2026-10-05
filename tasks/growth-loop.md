# Growth loop (2026-10-05): 10 iterations, one every 3 minutes

Goal: more traffic and more customers. Plan synthesised from 3 subagents (SEO content, GEO/AI visibility, growth).
Rules: one small commit per iteration on main (local, NOT pushed), `npm run seo:check` + `npm test` + build before commit,
no hand-to-mouth/biting imagery, no em dashes in copy, one privacy claim only (the verifiable one), tick the box + log below.

## In-repo iterations (in order)
- [x] 1. Compare page: Stop Biting vs HabitAware (comparePages.ts, server.js meta map + links list, sitemap, llms.txt)
- [x] 2. Unique title/description for /pricing, /how-it-works, /about (check injectMeta in server.js first; may already be fixed)
- [x] 3. Solutions page /solutions/for-students (+ link from exam and college posts)
- [ ] 4. Solutions page /solutions/for-remote-workers (+ link from WFH, meetings, screen-time posts)
- [ ] 5. PRODUCT_LINKS in src/data/related.ts: top 15 posts link to compare/solutions pages (BlogPost.tsx + server.js renderer)
- [ ] 6. Content-Signal line in robots.txt + VideoObject schema for the homepage video (silent video, no "sound on")
- [ ] 7. Citability pass: self-contained number-bearing answer paragraph on homepage + compare pages; "Last verified" + spec table; run seo:sync
- [ ] 8. Funnel: email capture (/api/subscribe via Resend) + mid-article blog block; privacy-friendly demo_start/trial_click events
- [ ] 9. Free tool: "What type of biter are you?" quiz or yearly-cost calculator page, in sitemap, ending in trial CTA
- [ ] 10. Long-tail post(s): nail-biting-subconscious-habit, nail-bed-damage-from-biting; cross-link compare/solutions hubs; final verification + summary

## Owner actions (off-repo, cannot be done here)
Product Hunt + Show HN launch (docs/off-site-kit/); AlternativeTo + directories; LinkedIn/X/YouTube then sameAs; Reddit value-first
(r/nailbiting, r/BFRBs; disclose maker); 5-10 real reviews; YouTube demo; Bing Webmaster + `npm run seo:indexnow` after deploy;
GSC recrawl of /; fix www TLS cert; decide Google-Extended; partnerships (BFRB therapists, TLC Foundation, dentists, ADHD creators).
Trial-end rescue emails (day 2/3) and 7-day trial test are a follow-up after funnel events exist.

## Log
- it1: HabitAware page live (price NOT stated on vendor pages, so none quoted). NOTE for it3/it4: new /solutions pages must ALSO be added to CORE_PAGES in scripts/sync-seo.mjs (use `command grep -a`, file has binary bytes) and committed BEFORE `npm run seo:sync`, then commit synced files.
- it2: already done. /pricing, /how-it-works, /about each serve a unique title, description and h1 (verified by curl against server.js). No code change. Side note: how-it-works/about metas say '100% private'/'No cloud, no server'; check against the one-privacy-claim rule in it7.
- it3: /solutions/for-students live (no invented stats, only the exam post's 40-undergrad study), linked from exam + college posts; CORE_PAGES updated; sitemap 164 URLs.
