# Search data pack for stopbiting.today, read 2026-10-27

Source: Google Search Console (domain property), window = the last 90 days to 2026-10-25 unless stated. Pulled by the
orchestrator through the owner's Chrome. Treat as evidence, not as a target: these numbers are tiny (122 clicks in 90
days), most pages have 1 to 11 clicks.

Site totals (90 d): 122 clicks, 15.2K impressions, CTR 0.8%, average position 12.8, 547 distinct queries, 214 pages with
impressions. Impressions rose about 5x in the last two weeks of the window.

IMPORTANT caveat: many titles and descriptions were rewritten on 2026-10-20 (commit c97685a: home 'app', vitamin
deficiency, grow nails, dermatophagia, BFRB, best apps, finger tape) and 2026-10-23 (6a3445e, a2f94c5). The window mostly
predates those edits, so low CTR on those pages says nothing about their NEW titles. Do not re-edit a title or
description that git history shows changed since 2026-10-20 (check `git log -S` / `git log -p` on the page's entry).

## Index status (Search Console "Pages", data as of 2026-10-23)
212 indexed, 13 not indexed:
- Crawled, currently not indexed (8, "Google systems"): /features/phone-companion, /blog/nail-biting-reward-chart-children,
  /solutions/cuticle-biting, /blog/nail-biting-bacteria-parasites, /blog/nail-biting-anxiety-treatment,
  /blog/nail-biting-alternatives, /blog/nail-biting-and-perfectionism, /blog/mediapipe-ai-detection-explained.
  (The count peaked near 25 around 2026-10-20 and fell back to 8.)
- Not found (404): http://www.stopbiting.today/  (hosting: no router for www; owner/Coolify item, NOT code)
- Blocked by robots.txt: /api/auth/google (intended)
- Page with redirect: http://stopbiting.today/ (intended)
- Alternate page with proper canonical: /?ref=producthunt and /?q={search_term_string} (intended; the template URL is
  not produced by current code, grep finds no `search_term_string`)
- Sitemap report: https://stopbiting.today/sitemap.xml "last read May 2, 2026", 45 discovered pages, though the file now
  lists about 219 URLs. (Owner can resubmit in Search Console; not code.)

## Query clusters with impressions, positions 6 to 10 and ZERO clicks (page that ranks, from per-query page breakdown)
| cluster | page | impressions | clicks | avg position | example queries (impr) |
|---|---|---|---|---|---|
| cancer | /blog/nail-biting-cancer | 107 | 0 | 7.0 | can biting nails cause cancer (23), does biting nails cause cancer (22), can nail biting cause cancer (13), can you get cancer from biting your nails (11), does nail biting cause cancer (7) |
| self-harm | /blog/is-nail-biting-self-harm | 111 | 0 | 9.0 | is biting your nails self harm (34), is nail biting self harm (26), is fingernail biting a form of self harm (9), is biting nails self harm (8), does nail biting count as self harm (7) |
| worms | /blog/pinworm-nail-biting | 116 | 0 | 9.7 | does biting your nails give you worms (27), can you get pinworms from biting your nails (15), can you get worms from biting your nails (13), can biting your nails give you worms (12), pinworms nail biting (11) |
| toenails | /blog/nail-biting-toenails | 47 (these queries) | 0 | 10.5 | do people bite their toenails (18, pos 6.1), bite toenails (7), biting toenails (7), bitten toenails (6) |
| deficiency | /blog/nail-biting-vitamin-deficiency | 96+ | 0 | 9.0 | what deficiency causes nail biting (96), nail biting vitamin deficiency (9), is nail biting a sign of a vitamin deficiency (7). Title and description were REWRITTEN 2026-10-20/23 for exactly these: leave alone. |
Other non-trivial single queries: "smartwatch for nail biting" 12 @7.3, "nail biting tape" 9 @6.3, "finger tape for nail biting" 5 @6.4,
"is it bad to swallow fingernails" 7 @10.0, "swallowing fingernails" 6 @17.7, "what happens if you swallow nail polish" 4 @10.2.
Position 30 to 90 cluster (ranking problem, NOT a snippet problem; a title rewrite will not help): dermatophagia (43 @33),
finger biting (20 @59), bfrb / bfrbs / body-focused repetitive behaviours (about 100 total @48 to 60), nail biting therapy,
childhood nail biting, habit reversal training nail biting (13 @44), why do people bite their nails (15 @59), onychophagia (5 @46).
Junk: "what is bitesolgemokz" (31), "should avoid bitesolgemokz" (23), "warning about bitesolgemokz" (13): an unrelated string; ignore.

## Pages (clicks / impressions / CTR / avg position), top of the list
/blog/nail-biting-vitamin-deficiency 11 / 1040 / 1.1% / 8.4  (retitled 10-20, 10-23)
/ 10 / 218 / 4.6% / 5.5
/blog/nail-biting-famous-people 9 / 243 / 3.7% / 6.8
/blog/nail-biting-finger-tape 7 / 306 / 2.3% / 7.1  (retitled 10-20)
/blog/grow-nails-after-nail-biting 4 / 815 / 0.5% / 9.6  (retitled 10-20, 10-23)
/blog/nail-biting-support-groups 4 / 25 / 16% / 6.8
/blog/nail-biting-toenails 3 / 282 / 1.1% / 7.5
/blog/stop-biting-vs-mavala-stop 3 / 184 / 1.6% / 7.3
/blog/nail-biting-alcohol 3 / 153 / 2.0% / 7.0
/blog/nail-biting-gloves 3 / 140 / 2.1% / 8.4
/blog/nail-biting-after-quitting-smoking 3 / 102 / 2.9% / 5.6
/blog/nail-biting-gut-health 3 / 97 / 3.1% / 14.4
/blog/nail-biting-ptsd 3 / 58 / 5.2% / 5.9
/blog/acrylics-to-stop-nail-biting 2 / 407 / 0.5% / 8.4  (last modified 2026-09-11: not retitled recently)
/blog/nail-biting-fingerprints 2 / 231 / 0.9% / 6.5
/blog/nail-biting-bacteria-parasites 2 / 222 / 0.9% / 10.8  (also "crawled, currently not indexed")
/blog/nail-biting-adhd 2 / 179 / 1.1% / 12.9
/blog/nail-biting-evening 2 / 128 / 1.6% / 8.2
/blog/best-apps-to-stop-nail-biting 2 / 127 / 1.6% / 14.5
/blog/nail-biting-women 2 / 122 / 1.6% / 8.9
/blog/nail-biting-eczema 2 / 67 / 3.0% / 5.5
/blog/nail-biting-punishing-children 2 / 60 / 3.3% / 7.5
/blog/nail-biting-night-guard 2 / 17 / 11.8% / 4.8
/blog/nail-biting-dermatophagia 1 / 774 / 0.1% / 24.9  (ranking problem)
/blog/nail-biting-statistics 1 / 340 / 0.3% / 10.7  (last modified 2026-10-15)
/blog/swallowing-fingernails 1 / 298 / 0.3% / 12.7  (published 2026-10-08)
/blog/nail-biting-seniors-elderly 1 / 239 / 0.4% / 7.9
/blog/pinworm-nail-biting 1 / 236 / 0.4% / 9.1
/blog/nail-biting-oral-fixation 1 / 204 / 0.5% / 15.9
/blog/how-to-stop-nail-biting 1 / 153 / 0.7% / 46.6  (ranking problem)

## Other facts established today (verified against the live site)
- Live canonical on ?ref=..., ?internal=1, ?q=... is the clean URL (correct).
- robots.txt allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot; blocks
  Bytespider; `/api/` disallowed. HTTP to HTTPS is a 301. llms.txt and llms-full.txt are served.
- GAP created by the Lifetime plan launch (lifetime_plan flag is ON in production, price $99 one time): the visible pricing
  section shows three cards, but /pricing's <title> ("Pricing: $2.99/month or $29/year | Stop Biting"), its server-rendered
  prose, its Offer schema and llms.txt ("Pricing:" block lists only Monthly and Yearly) do not mention Lifetime.
- GA4 showed an old-brand page title "...| Nail Habit App" (about 300 views, 2026-04). It was live only 2026-04-03 to
  2026-04-19; current code cannot produce it. Ignore.
