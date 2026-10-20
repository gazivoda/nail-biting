# SEO/GEO swarm plan, 2026-10-20

Inputs: Search Console (18 Jul to 17 Oct: 110 clicks, 11.8K impressions, CTR 0.9%, position 13.8; 168 indexed, 16 not) and six research agents (competitors, AI-search citations, SERP intent, technical, clusters, off-site). Agents read abstracts/SERP summaries only; WebSearch is US-only and cannot show AI Overview citation lists. Treat "inferred" items as hypotheses.

## Tranche 1: bug fixes (server.js / public), low risk
1. `/shots` and `/video` 301 loop: `express.static(..., { redirect: false })` at both mounts (server.js ~722, ~1894). Probable cause of "Page with redirect".
2. `/favicon.ico` 404: add a real `public/favicon.ico` and a `<link rel="icon" href="/favicon.ico" sizes="48x48">`.
3. `X-Robots-Tag: noindex` for `.json`/`.txt` non-pages (`/seo-content.json`, `/shots/*.json`, IndexNow key), keeping robots.txt, llms.txt, sitemap.xml indexable.
4. `rel="nofollow"` on the 7 `/api/auth/google` anchors.
5. Check nothing still serves "Free AI Habit Tracker"; request re-indexing of `/` in GSC (owner action).

## Tranche 2: titles, descriptions, first paragraphs (highest click upside)
Rendered title = seoTitle + " | Stop Biting" (limit seoTitle 46). Proposed text is in the SERP agent report; key items:
- grow-nails-after-nail-biting (611 impr, 2 clicks): answer-first "3 to 6 months", week-by-week H3s, nail-bed section, FAQ. Needs sourcing for new claims.
- nail-biting-vitamin-deficiency (944 impr, 11 clicks): title "What Deficiency Causes Nail Biting? Evidence"; engage the children's mineral-deficiency paper only after reading its abstract.
- nail-biting-dermatophagia: definition first; add "dermatodaxia" (verify via PMC); "finger biting".
- Home page: put "app" in the title ("Nail Biting App: ...").
- best-apps post: say "apps" in the title.
- bfrb-guide: definition-first snippet, UK spelling "behaviours".

## Tranche 3: structure (hubs and internal links)
- `src/data/related.ts` links by tag in file order, not topic. Replace with the sub-cluster map (4 hubs: how-to-stop-nail-biting, bfrb-guide, nail-biting-health-risks, nail-biting-in-children; plus a decision on a fifth "situations" hub). Map and validator: scratchpad/hubs.py.
- Cannibalisation: how-to-stop-nail-biting vs stop-nail-biting-fast (5/6 SERP overlap, merge or retarget); stress-and-nail-biting vs nail-biting-anxiety-treatment (retitle); stopping-for-good vs relapse (retitle); 30-day-plan vs challenge (differentiate).
- Near-duplicates: /solutions/for-mac vs for-windows (72%), health-risks vs teeth-damage (45%).
- Blog index: categorised hubs instead of one flat list.

## Tranche 4: new content
20 ranked topics in the cluster report (lowest competition: decoupling technique, insurance for therapy, Pavlok review, Invisalign, manicure with bitten nails, bleeding first aid, lead exposure in children). Also a "Best apps (2026)" comparison page that includes us, honest about where we lose. Same PubMed pipeline.

## Tranche 5: trust and entity (needs owner)
- Named clinician reviewer on top pages + `reviewedBy` schema (AAD/WebMD have it; ours says "not a doctor"). Owner must find a reviewer.
- `sameAs`: only GitHub today; add YouTube/LinkedIn/Product Hunt once they exist.
- VideoObject schema + crawlable watch page for the one video.

## Owner decisions
- robots.txt: A keep (contradictory `ai-train=no` vs GPTBot/ClaudeBot allow), B allow Google-Extended (Gemini grounding), C disallow GPTBot/ClaudeBot but allow the search/user agents. Add explicit Claude-SearchBot/Claude-User allow in any case.
- Supported platforms list (still unresolved).
- Fifth hub for situation posts.

## Off-site (owner acts under their own name; nothing automated)
Product Hunt, AlternativeTo, Zur Institute apps list, TLC Foundation, Reddit (read rules first, answer without links for two weeks), resource pages, podcasts. Avoid Wikipedia self-edits, paid links, mass directories, vote requests. Set up Bing Webmaster and Ahrefs Webmaster Tools first.

## Ignore
"bitesolgemokz" queries: content-farm spam token. Core Web Vitals "no data": traffic too low, source review shows low risk.
