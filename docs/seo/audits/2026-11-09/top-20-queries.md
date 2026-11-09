# Top 20 query targets, 2026-11-09

Built by the owner's request ("create list of top 20 queries and improve our positioning for each").

## Limitations, stated first

- **There is no third-party search-volume data here** (no Ahrefs, Semrush or Keyword Planner access). "Top" means two
  things: (1) queries and pages that already earn impressions on our own property, and (2) head terms the product
  should own where we currently rank deep. Volumes for group B are not known; Search Console only shows us where we
  appear, and we barely appear for them.
- Search Console numbers: 28 days to 2026-11-07 (page totals) or to 2026-11-03 (where marked). Page totals include
  rare queries that Search Console hides from the query table, so a page's impressions are larger than the sum of its
  listed queries (the cancer page: 961 in total, 453 under queries containing "cancer").
- 89 clicks and 13.2K impressions in 28 days for the whole site; three referring domains (reddit.com, producthunt.com,
  awaira.app), all linking to the home page. Pages at position 40 to 90 will not move on copy alone.

## Freeze rule

`docs/seo/title-ledger.md` freezes `title`, `seoTitle` and `description` for listed pages until **2026-11-24**, and this
repo has treated anything with metadata changed since 2026-10-19 the same way. Body, structure, internal links and
schema are not frozen. **Metadata on frozen pages: frozen until 24 Nov unless the owner lifts it.** Dates below are the
last metadata change per `git blame`.

## Group A: we already rank on page 1 or near it (lever: click capture, answer completeness, citability)

| # | Query cluster (representative) | Landing page | Page 28 d: impr / clicks / pos | Metadata | Lever now | Status |
|---|---|---|---|---|---|---|
| 1 | can nail biting cause cancer (12 phrasings) | /blog/nail-biting-cancer | 961 / 1 / 6.4 | frozen (changed 10-20; ledger watch) | body: 2018 thumb story, Choi 2022 | held for the 24 Nov read |
| 2 | is nail biting self harm (10) | /blog/is-nail-biting-self-harm | 666 / 3 / 8.1 | frozen (ledger) | none beyond optional Mann 2020 line | SXO verdict: nothing |
| 3 | worms / pinworms from biting nails (15) | /blog/pinworm-nail-biting | 806 / 2 / 8.9 | frozen (seoTitle 10-27) | body: CDC and NHS lead | held to 24 Nov |
| 4 | what happens if you swallow nail polish | /blog/swallowing-nail-polish-biting | 1,241 / 5 / 9.7 | changed 10-20 | body done 11-06 (Poison Control lead) | shipped |
| 5 | what happens if you swallow a fingernail | /blog/swallowing-fingernails | 624 / 1 / 12.1 (to 11-03) | frozen (ledger) | long tail, no head query | nothing |
| 6 | do people bite their toenails | /blog/nail-biting-toenails | 279 / 4 / 7.7 | frozen (ledger) | none | nothing |
| 7 | nails growing back after biting | /blog/grow-nails-after-nail-biting | 851 / 5 / 9.1 | frozen (ledger, deliberately untouched) | needs query evidence first | research |
| 8 | nail biting and vitamin deficiency | /blog/nail-biting-vitamin-deficiency | 356 / 5 / 7.5 | frozen (ledger, untouched) | needs query evidence first | research |
| 9 | nail biting tape | /blog/nail-biting-finger-tape | 187 / 3 / 7.1 | frozen (evaluation 11-27) | AAD line after 27 Nov | held |
| 10 | acrylics to stop nail biting | /blog/acrylics-to-stop-nail-biting | 243 / 0 / 7.8 (to 11-03) | frozen (changed 10-27) | needs query evidence first | research |
| 11 | smartwatch for nail biting | /blog/nail-biting-wearable-technology | 10 / 0 / 6.6 (to 11-03) | free (08-11) | body done 11-06 | shipped |
| 12 | nail biting app (also biting app, stop nail biting app) | /blog/best-apps-to-stop-nail-biting, home | 14 / 0 / 12.0 and 12 / 0 / 16.6 (to 11-03) | frozen (10-23) | optional manual-logging apps | SXO verdict: no structural change |

## Group B: head terms where we rank deep (lever: off-site authority first, then intent fit)

| # | Query cluster | Landing page | Evidence | Metadata | Lever now |
|---|---|---|---|---|---|
| 13 | how to stop nail biting (also how can i stop biting my nails) | /blog/how-to-stop-nail-biting | page 73 impr / 1 click / pos 24.4; the head query itself 3 impr at position 89.7 | seoTitle 10-21, treat as frozen | authority; body deepened 10-30 |
| 14 | why do people bite their nails | /blog/why-do-people-bite-their-nails | page 7 impr, pos 33.4; query at 47 to 58 | title 10-19, treat as frozen | authority |
| 15 | nail biting (head term) | home, /blog/bfrb-guide | "nail biting" 6 impr at 66.8; bfrb-guide 1 impr | home frozen | authority |
| 16 | nail biting treatment / cure / therapy | /blog/how-to-choose-nail-biting-treatment, /blog/nail-biting-cure | "treatment" 46, "cures" 47, "therapy" 70 | free (09-15) | research SERP, then body |
| 17 | habit reversal training for nail biting | /blog/habit-reversal-training-guide | page 131 impr / 0 / pos 7.9; the exact queries 15.7 to 23 | free (09-15) | research SERP, then body |
| 18 | nail biting in children / kids | /blog/nail-biting-in-children | page 115 impr / 0 / pos 15.0; "childhood nail biting" 83.8 | description 10-19 | research SERP, then body |
| 19 | onychophagia, nail biting disorder, dermatophagia | /blog/onychophagia | page 79 impr / 0 / pos 8.1 | free (08-11) | research SERP, then body |
| 20 | bitter nail polish for nail biting | /blog/bitter-nail-polish-review, /compare/bitter-polish-alternative | no query data yet | free (09-15) | research SERP, then body |

## What this list is for

For each row: the real Google result page (AI Overview present and who it cites, our position, People Also Ask,
featured snippet) and the same query in Perplexity, recorded in `serp-baseline.md` in this folder. Then body, structure,
internal-link and citability edits that the evidence supports, shipped through the usual gates. Nothing here claims a
traffic effect; the next measurement is 2026-11-24, with a second read on 2026-12-08.
