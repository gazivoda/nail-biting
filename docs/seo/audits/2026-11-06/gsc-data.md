# Search Console read, 2026-11-06

Source: Google Search Console, domain property `stopbiting.today`, read through the owner's signed-in Chrome on
2026-11-06 (owner approved "read and submit"). Window: the last 28 days, 2026-10-07 to 2026-11-03 (the report said
"last update 4.5 hours ago"). Web search only. Numbers are what the UI showed; nothing is estimated.

This is the baseline for the 2026-11-24 read described in `docs/seo/title-ledger.md`. It is not a before and after:
the 28 days overlap the 2026-10-20 to 2026-10-30 edits, and the earlier baseline (`audits/2026-10-27/gsc-data.md`) was a
90-day window.

## Totals, 28 days

| Clicks | Impressions | CTR | Average position | Pages with impressions | Queries |
|---|---|---|---|---|---|
| 81 | 11.8K | 0.7% | 9.1 | 210 | 308 |

Impressions were flat at roughly 200 to 250 a day (read off the chart) until about 2026-10-20, then rose to roughly 700
a day and held through 11-03. Clicks stayed at about 10 a day or fewer. For scale, the 90 days to 2026-10-25 had 122 clicks in total.

## Pages with the most impressions (28 days)

| Page | Clicks | Impressions | Position |
|---|---|---|---|
| `/blog/swallowing-nail-polish-biting` | 4 | 993 | 9.8 |
| `/blog/grow-nails-after-nail-biting` | 4 | 800 | 9.2 |
| `/blog/nail-biting-cancer` | 1 | 736 | 6.3 |
| `/blog/swallowing-fingernails` | 1 | 624 | 12.1 |
| `/blog/pinworm-nail-biting` | 1 | 609 | 9.0 |
| `/blog/is-nail-biting-self-harm` | 3 | 552 | 7.9 |
| `/blog/nail-biting-vitamin-deficiency` | 4 | 387 | 7.3 |
| `/blog/nail-biting-toenails` | 4 | 286 | 8.1 |
| `/blog/acrylics-to-stop-nail-biting` | 0 | 243 | 7.8 |
| `/blog/nail-biting-pregnancy` | 1 | 200 | 6.1 |

## Top queries by impressions (28 days)

All ten had 0 clicks.

| Query | Impressions | Position |
|---|---|---|
| can biting nails cause cancer | 86 | 6.3 |
| is biting your nails self harm | 74 | 8.5 |
| does biting nails cause cancer | 66 | 6.8 |
| does biting your nails give you worms | 61 | 9.2 |
| is nail biting self harm | 53 | 8.7 |
| can biting your nails give you worms | 42 | 10.0 |
| can you get worms from biting your nails | 42 | 12.2 |
| can you get cancer from biting your nails | 41 | 6.4 |
| do people bite their toenails | 30 | 6.7 |
| can nail biting cause cancer | 29 | 6.4 |

## What this says (and does not)

- The demand that finds the site is health-worry questions (cancer, worms, self-harm, swallowing). These are
  informational, so clicks are scarce and the product CTA is a long way from the query.
- **The one CTR anomaly:** `nail-biting-cancer` has 736 impressions at position 6.3 and 1 click (0.14%). Four phrasings
  of the same question add up to about 220 impressions with 0 clicks. A position-6 result normally earns a few percent.
  Likely cause (inference, not seen): the question is answered above the results (AI Overview or a featured answer), and
  its meta description also answers it ("No study shows nail biting causes cancer"). A title change would not fix a
  SERP feature. The page was published 2026-10-20 and is ramping, so this is a watch item for 2026-11-24, not an edit.
- **No striking-distance head query.** `swallowing-fingernails` (position 12.1, 624 impressions) earns them from dozens
  of tiny queries (the largest has 10 impressions). A body rewrite has no single query to aim at.
- Sample sizes are still small: a page with 3 or 4 clicks cannot be ranked against another.

## Indexing

The Pages report (`Page indexing`) says "last update 10/23/26", so its counts are 14 days old: 212 indexed, 13 not
indexed (2 alternate page with proper canonical, 1 not found 404, 1 blocked by robots.txt, 1 page with redirect, 8
crawled - currently not indexed). The reasons' example URLs for the 4 small buckets were not opened.

URL Inspection (live index, 2026-11-06) of the eight "crawled, currently not indexed" pages from
`audits/2026-10-27/index-health.md`:

| Page | Status 2026-11-06 | Action |
|---|---|---|
| `/features/phone-companion` | on Google, indexed | none |
| `/blog/nail-biting-reward-chart-children` | on Google, indexed | none |
| `/solutions/cuticle-biting` | on Google, indexed | none |
| `/blog/nail-biting-bacteria-parasites` | on Google, indexed | none |
| `/blog/nail-biting-alternatives` | on Google, indexed | none |
| `/blog/nail-biting-anxiety-treatment` | not indexed: crawled, currently not indexed | indexing requested |
| `/blog/nail-biting-and-perfectionism` | not indexed: crawled, currently not indexed | indexing requested |
| `/blog/mediapipe-ai-detection-explained` | not indexed: crawled, currently not indexed | indexing requested |

Five of the eight are in the index now. Re-inspect the other three on 2026-11-24.

## Sitemap

`https://stopbiting.today/sitemap.xml` was resubmitted on 2026-11-06. Before: submitted 2026-04-20, last read
2026-05-02, 45 discovered pages. After the resubmit the table showed submitted and last read 2026-11-06, status
Success, 221 discovered pages (the production sitemap has 221 URLs).
