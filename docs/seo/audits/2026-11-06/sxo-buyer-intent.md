# SXO read: buying-intent queries, 2026-11-06

Read-only. GSC numbers from `gsc-data.md` / `gsc-queries.tsv` (28 days to 2026-11-03). Every query below has
single-digit or low-double-digit impressions and 0 clicks, so nothing here can be shown to move traffic; the point is
intent fit. SERP lists come from the WebSearch tool, which is **not Google**: it shows no AI Overview, ads, PAA,
app packs or exact Google positions. "Top results" means what that engine returned, checked by opening each page.

## 1. Apps: "nail biting app" (17 @18.2), "biting app" (9 @7.2), "stop nail biting app" (2 @10)

**SERP evidence (opened 2026-11-06).** Both app queries returned almost only store listings and app aggregators.
- NoBite (App Store, https://apps.apple.com/us/app/id6760501258): store listing. Azen Labs LLC; free, in-app Pro
  Annual $29.99, Pro Weekly $2.99; iOS/iPadOS 26.0+; manual streak and trigger logging plus weekly nail photos;
  no automatic detection described; too few ratings to show.
- StopBite (App Store, https://apps.apple.com/us/app/id6755230351): store listing. Weekly $3.99, Monthly $7.99
  (its description says $8.99), Lifetime $24.49; iOS 16.4+; manual bite logging, daily photos, "Personalized 90-day
  plan"; 1.0 stars from 2 ratings.
- NailFree (App Store, https://apps.apple.com/us/app/id6761150154): store listing. Free, Pro Annual $29.99, Pro $4.99;
  iOS 17.0+, watchOS 10.0+; manual "Caught It" logging, including from the watch; 5.0 from 1 rating.
- KeepNails (Google Play, com.keepnails.app): fetch returned no readable content twice. Not verified, not used.
- The only roundup returned: "5 Best Nail Biting Apps" (https://freeappsforme.com/?p=108953): about 900 to 1,000
  words, dates June 16 2022 and July 17 2026, five apps (NailKeeper, Stop Nail Biting Hypnosis, StopBite, Raylex,
  NoMoreNailBitting), no table, no prices with dates, no verdict first, team byline.

**Ours.** `/blog/best-apps-to-stop-nail-biting` (14 impr @12.0): answer first, disclosure in paragraph 2, 14-row table
with dated vendor checks (10 Sep to 23 Oct 2026), PubMed sources, FAQ. Homepage (12 @16.6) is the vendor page type.

**Judgement.** The SERP rewards the store listing, a page type a website cannot be. Among editorial pages ours is
already deeper and better dated than the one roundup found. Homepage and best-apps both showing is not evidence of
cannibalisation at 17 impressions. **Verdict: no structural change, no new page.** One optional body addition:

- **Change A (optional), `best-apps-to-stop-nail-biting`, section "Also worth knowing" + 3 table rows.** The SERP is
  full of phone logging apps; our table has Unbite and NailKeeper only. Draft:
  > Several phone apps log bites by hand rather than detecting them. On 6 November 2026 their US App Store listings
  > showed: NoBite, free with Pro at $29.99/year or $2.99/week, iOS 26 or later, with trigger logging and weekly nail
  > photos. StopBite, free with Pro at $3.99/week, $7.99/month per its purchase list (its
  > description says $8.99) or $24.49 lifetime, with a 90-day plan and daily photos.
  > NailFree, free with Pro at $29.99/year or $4.99, with a "Caught It" button on iPhone and Apple Watch. None of the
  > three listings describes automatic detection.
  Sources: the three App Store URLs above. Expected effect: honest answer is "probably none measurable"; it makes the
  page match what searchers are comparing. Failure signal: no change in best-apps impressions for app queries by the
  2026-12 read; with ~20 impressions that read may be undecidable. Bump `dateModified` only if the facts change.

## 2. Smartwatch: "smartwatch for nail biting" (11 @7.0)

**SERP evidence (opened 2026-11-06).**
- BiteLess (https://apps.apple.com/us/app/biteless-nail-biting-alert/id6743394450): store listing. Mobtaps; free,
  $9.99/month or $69.99/year; iOS 16.0+, watchOS 9.0+; automatic alert when biting is detected "for over 1-2
  seconds"; left wrist only; 1.0 from 1 rating.
- KeenLite (https://apps.apple.com/us/app/keenlite-for-trichotillomania/id1673593723): store listing. HABITAWARE
  L. L. C.; free, in-app $4.99 to $79.99; uses "1-hour awareness training sessions", and says Apple Watch's "closed
  development system ... limits access to the sensors needed for full behavior monitoring"; 4.1 from 9 ratings.
- Research record: Alesmaeil A, Sehirli E. "Real-Time Nail-Biting Detection on a Smartwatch Using Three CNN Models
  Pipeline." Computational Intelligence 41(1), online 13 Jan 2025, doi:10.1111/coin.70020 (Crossref,
  https://api.crossref.org/works/10.1111/coin.70020). Abstract summary: three-model pipeline that reduces false
  positives versus one model. Full text and figures not readable (EBSCO and Wiley 403, Karabuk repository refused).
- Trial: NCT06111729 (https://clinicaltrials.gov/api/v2/studies/NCT06111729), Weill Cornell, "Habit Awareness Device
  for Treatment of Onychophagia": HabitAware wristband, single group, 10 estimated participants, 12 weeks, recruiting,
  primary completion May 2027 (est.), no results posted, last update 2026-04-21.
- Also returned, not opened: older press (IEEE Spectrum, TCB 2017) about the HabitAware Liv bracelet.

**Ours.** `/blog/nail-biting-wearable-technology` (10 impr @6.6), 2-minute read: explains motion sensing, names only
HabitAware, links only `/compare/stop-biting-vs-habitaware`. It names **no smartwatch app**, although we have a live
`/compare/stop-biting-vs-biteless` (HTTP 200 and in sitemap, checked today). It says "We found no published accuracy
figures" and "Not from trials that we could find"; both were true of the 19 Oct PubMed search, but a trial and an
engineering paper exist outside it. Not in `title-ledger.md`, so not frozen, but 10 impressions cannot support a
CTR judgement: do not retitle.

**Verdict: change (body only).** This is the clearest intent mismatch: the searcher asks "which smartwatch", the
SERP answers with watch apps, our page answers "how motion sensing works".
- **Change B, same slug, new section after "How does wearable detection differ...": "Which smartwatch apps exist?"**
  > On 6 November 2026 we found two Apple Watch apps for nail biting on the US App Store. BiteLess says it alerts you
  > automatically when it detects biting for over one to two seconds; it costs $9.99 a month or $69.99 a year and
  > supports the left wrist only. HabitAware's KeenLite uses one-hour awareness sessions instead, and its listing says
  > Apple Watch limits access to the sensors needed for full monitoring. Both listings require an iPhone.
  Plus link: `/compare/stop-biting-vs-biteless`. Not searched: Wear OS / Android watch apps; check before claiming none.
- **Change C, same slug, section "Is there evidence that wearables work?":** append
  > One trial is registered: NCT06111729 at Weill Cornell is testing the HabitAware wristband for nail biting in about
  > 10 adults over 12 weeks, with no comparison group. On 6 November 2026 it was recruiting, with results expected
  > after May 2027. A 2025 engineering paper (Alesmaeil and Sehirli, Computational Intelligence) describes a
  > smartwatch detector built to cut false alarms; we could not read its results.
  Sources: ClinicalTrials.gov API and Crossref URLs above. Expected effect: better intent match at position ~7 on an
  11-impression query; any CTR gain is unmeasurable at this volume. Failure signal: by 2026-12 the page still shows 0
  clicks with stable impressions, or position drops below 10 (also possibly noise).

## 3. Tape: "nail biting tape" (7 @7.4)

**SERP evidence (opened 2026-11-06).** All general "how to stop" listicles in which tape is one tip:
- AAD (https://www.aad.org/public/everyday-care/nail-care-secrets/basics/stop-biting-nails): about 350 words,
  author plus seven dermatologist reviewers, updated 12/4/24: "cover your nails with tape or wear gloves".
- Makeup.com (https://makeup.com/nails/all-nails/how-to-stop-biting-nails-tiktok), 2021, ~400 words, TikTok
  hacks incl. clear tape. Bustle (https://www.bustle.com/wellness/how-to-stop-nail-biting-tiktok-hacks), 2021,
  ~1,000 words, clear tape. Dermelect (https://professional.dermelect.com/blogs/the-confidence-edit-blog/5-ways-to-stop-nail-biting-for-good),
  vendor blog, no byline or date, "fabric-based medical tape for 2-3 days", sells a bitter polish.
- Livestrong result 301s to everydayhealth.com homepage (a dead page still listed). Forum (ubpn.org) failed TLS;
  Reddit is blocked to this tool.

**Ours.** `/blog/nail-biting-finger-tape`: the only dedicated page found, sourced (PubMed search, Lee and Lipner 2022),
practical guidance, failure mode. Deeper and more honest than every result opened. Gaps vs SERP: no AAD citation, no
mention of clear tape. Body rewritten and description changed 2026-10-30; evaluation date 2026-11-27.

**Verdict: no change until 2026-11-27.** A body edit now would confound that read. After it, optional (Change D):
add to the first section "The American Academy of Dermatology lists covering your nails with tape or wearing
gloves among its tips." with the AAD URL. Expected effect: none measurable at 7 impressions.

## Proposed metadata (not before 2026-11-24)
None. No page here has enough impressions for a title hypothesis to be testable.

## Ranked list
1. Change C, wearable evidence section (trial + paper; fixes two now-incomplete statements).
2. Change B, wearable "Which smartwatch apps exist?" section + link to `/compare/stop-biting-vs-biteless`.
3. Change A, best-apps phone-logging apps (optional).
4. Change D, tape AAD sentence, only after 2026-11-27.
5. Owner housekeeping, known since WS11a: the live `/compare/stop-biting-vs-habitaware` still says no bracelet price is
   stated; HabitAware's homepage today shows Keen3 on preorder, shipping January 2027 (no Keen3 price on the homepage).

**Could not verify:** Google's actual SERP (AI Overview, app pack, PAA, positions); the Keen3 price
(habitaware.com/products/keen3-bracelet returned 429 twice, so the $199.00 in `ws11a-notes.md` is not re-verified);
the coin.70020 abstract and figures; KeepNails' Play listing; the ubpn and Reddit tape threads.
