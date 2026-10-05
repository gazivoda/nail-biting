# Growth loop (2026-10-05): 10 iterations, one every 3 minutes

Goal: more traffic and more customers. Plan synthesised from 3 subagents (SEO content, GEO/AI visibility, growth).
Rules: one small commit per iteration on main (local, NOT pushed), `npm run seo:check` + `npm test` + build before commit,
no hand-to-mouth/biting imagery, no em dashes in copy, one privacy claim only (the verifiable one), tick the box + log below.

## In-repo iterations (in order)
- [x] 1. Compare page: Stop Biting vs HabitAware (comparePages.ts, server.js meta map + links list, sitemap, llms.txt)
- [x] 2. Unique title/description for /pricing, /how-it-works, /about (check injectMeta in server.js first; may already be fixed)
- [x] 3. Solutions page /solutions/for-students (+ link from exam and college posts)
- [x] 4. Solutions page /solutions/for-remote-workers (+ link from WFH, meetings, screen-time posts)
- [x] 5. PRODUCT_LINKS in src/data/related.ts: top 15 posts link to compare/solutions pages (BlogPost.tsx + server.js renderer)
- [x] 6. Content-Signal line in robots.txt + VideoObject schema for the homepage video (silent video, no "sound on")
- [x] 7. Citability pass: self-contained number-bearing answer paragraph on homepage + compare pages; "Last verified" + spec table; run seo:sync
- [x] 8. Funnel: email capture (/api/subscribe via Resend) + mid-article blog block; privacy-friendly demo_start/trial_click events
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
- it4: /solutions/for-remote-workers live; deliberately makes NO claim that detection runs during a video call (camera sharing is OS/app dependent, unverified); linked from 3 posts; sitemap 165 URLs.
- it5: PRODUCT_LINKS (14 posts) in related.ts, rendered as 'Put it into practice' in BlogPost.tsx and server.js via seo-content.json; the 5 posts that already link a compare/solutions page in-body were left alone. React render not eyeballed in a browser, only tsc + SSR checked.
- it6: Content-Signal (search=yes, ai-input=yes, ai-train=no) added under User-agent: * in robots.txt, matching the existing training-bot blocks; VideoObject was ALREADY on the homepage (server.js homeVideo, loop 11), the GEO agent was wrong, no change. Owner may still want to revisit ai-train and Google-Extended.
- it7: citability already in place (homepage 158-word answer FAQ, answer-first compare intros, spec tables, dated verification sections), so no rewrite. Real fix: removed unverifiable '100% private' / 'No cloud, no server' / 'no data ever leaves' from /about + /how-it-works metas, index.html twitter + JSON-LD, llms.txt prose; all now say what is checkable (no camera data sent while it runs).
- it8: PARTIAL by design. Shipped trial_click + demo_start GA events (src/utils/track.ts, tested; GA is already loaded and disclosed in the privacy policy). Email capture NOT built: it needs owner decisions first (storage table, double opt-in + unsubscribe, privacy-policy text, a real worksheet PDF) and email.js sends from onboarding@resend.dev, Resend's test sender, which cannot mail arbitrary recipients; a verified sending domain is needed. signin_complete event also not added (OAuth redirect is server-side).
