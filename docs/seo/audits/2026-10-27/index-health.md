# Index health: the eight "crawled, currently not indexed" pages

Date: 2026-10-27. Source of the list: Search Console "Pages" report as of 2026-10-23 (`gsc-data.md`). The count peaked
near 25 around 2026-10-20 and fell back to 8, so most of the pages that were waiting got indexed on a later crawl.

**Nothing here has been merged, redirected or deleted.** Every consolidation below is a proposal with an exact 301 for
the owner to approve. The only changes made are non-destructive: in-body links, and one snippet that contradicted its
own body (`title-ledger.md`).

## What was measured, and how

A throwaway script (not committed) read the 188 posts and the two feature pages, with citations, "Related reading",
"Where to go next" and the medical disclaimer removed, and computed:

- **Words** of the remaining prose. Corpus of 188 posts: median 699, 10th percentile 510, 90th percentile 999.
- **Shingle overlap**: share of a page's 5-word shingles that also occur in another page. Highest pair in the whole
  corpus: `nail-biting-health-risks` and `nail-biting-teeth-damage`, Jaccard 0.103.
- **TF-IDF cosine** over unigrams and bigrams (stop words removed). Corpus median 0.012, 99th percentile 0.055, maximum 0.306 (the same pair).
- **Shared citations**: cited source URLs two posts have in common.
- **Inbound links**: distinct posts that link to the page in body text (`href` in a section's `html`), plus posts whose
  "Related articles" list (`getRelated`) includes it. Counted before and after this branch's edits.
- **Cluster position** in `TOPIC_HUBS` (`src/data/related.ts`).

Read this as a screen, not as proof. Search Console never gives a reason for "crawled, currently not indexed"; it is a
quality and priority decision. What follows is what the repository can show, with inference marked as inference.

## Result in one line

**None of the eight is a duplicate.** The largest 5-word-shingle overlap of any of them with any other page is 5.1%
(`nail-biting-bacteria-parasites` against `swallowing-fingernails`), and the largest cosine is 0.152. The suspected
near-duplicate "alternatives" pair does not exist: "What to Do Instead of Biting Your Nails: 12 Evidence-Based
Alternatives" and "Nail Biting Alternatives: 12 That Really Work" are the h1 and the old seoTitle of the SAME post,
`nail-biting-alternatives`. The pages differ from the ones Google indexed in other ways (age, links, unsourced claims),
listed per page below.

## Summary table

| URL | Published | Words | In-body links in (before to after) | In related lists | Cluster position | Closest page (cosine / shingle share) | Recommendation |
|---|---|---|---|---|---|---|---|
| `/features/phone-companion` | 2026-10-23 (flag `phone_companion`) | 654 | 0 to 0 | 0 | none (not a post) | `/solutions/cuticle-biting` 0.038 / 1.9%; `best-apps-to-stop-nail-biting` 0.063 | Keep. Needs a rendered link, which is not in this lane (see below). |
| `/blog/nail-biting-reward-chart-children` | 2026-10-20 | 479 | 6 to 6 | 2 | `nail-biting-in-children`, K2, 2 of 3 | `nail-biting-dark-line-on-nail` 0.038 / 0%; `nail-biting-home-remedies` 2.7% shingle | Keep and wait. It was three days old when Search Console was read. Fallback merge below. |
| `/solutions/cuticle-biting` | 2026-10-23 (flag `detection_behaviors`) | 604 | 0 to 0 | 0 | none (not a post) | `nail-biting-detection-accuracy` 0.055 / 0%; `/features/phone-companion` 2.0% shingle | Keep. Same link problem as the phone page. |
| `/blog/nail-biting-bacteria-parasites` | 2026-04-23 | 1,424 | 7 to 9 | 3 | `nail-biting-health-risks`, H2, 1 of 10 | `swallowing-fingernails` 0.152 / 5.1% | Keep for now. The parasite section duplicates the pinworm post and states it more strongly. Fallback merge below. |
| `/blog/nail-biting-anxiety-treatment` | 2026-04-07 | 752 | 3 to 6 | 3 | `bfrb-guide`, B4, 4 of 8 | `stress-and-nail-biting` 0.090 / 1.3% | Keep, but the page contradicts itself (quoted below). Owner edit first; fallback merge below. |
| `/blog/nail-biting-alternatives` | 2026-04-21 | 986 | 2 to 5 | 3 | `how-to-stop-nail-biting`, T2, 9 of 9 | `nail-biting-stimming` 0.103 / 2.2% | Keep. Snippet fixed in this pass; the h1 still over-claims. |
| `/blog/nail-biting-and-perfectionism` | 2026-04-23 | 1,141 | 1 to 3 | 3 | `bfrb-guide`, B4, 8 of 8 | `nail-biting-personality` 0.114 / 2.0% | Keep, but half the page is uncited (quoted below). Fallback merge into `nail-biting-personality` below. |
| `/blog/mediapipe-ai-detection-explained` | 2026-04-07 | 693 | 0 to 6 | 3 | `how-to-stop-nail-biting`, T7, 6 of 9 | `how-ai-can-help-stop-nail-biting` 0.106 / 1.7% | Keep. It cites nothing; add sources or soften the numbers. |

"In related lists" is the number of posts whose automatic "Related articles" block lists the page. Every post in a
cluster of four or more gets exactly three of those, so it cannot explain why these eight differ from the other 180.
Sitewide, before this branch the median post had 2 in-body links in and the 75th percentile had 5; 35 of 188 posts had
none, and several of those are indexed and earn clicks (`nail-biting-finger-tape`, `nail-biting-famous-people`, `nail-biting-toenails`,
`nail-biting-fingerprints`). **Inbound link count alone does not separate indexed from not indexed**, so the links added
here are a cheap, safe help, not a diagnosis.

## Per page

### /features/phone-companion and /solutions/cuticle-biting

- **Overlap:** none that matters. Together they share 2% of 5-word shingles, and neither is closer than cosine 0.063
  to any post. They describe things nothing else on the site describes (the two-tap phone view; logging alarms as
  "cuticle and skin biting").
- **Inbound links:** the only ones are the `<noscript>` site navigation that `server.js` injects into every page and the
  sitemap. On the live homepage both links sit inside `<noscript><nav aria-label="Site">`. Nothing in the React app
  renders a link to either (`SiteFooter.tsx`, the header, `/how-it-works` and `/pricing` do not). A crawler that renders
  the page sees no link to them. This is the most likely reason they are waiting, together with being new.
- **Not fixed here, deliberately.** Both pages exist only while their flag is on (`phone_companion`, `detection_behaviors`;
  `src/data/featurePagePaths.ts`). A link from a blog post is a plain string in `blogPosts.ts` and would become a link to
  the branded 404 the moment the owner turns the flag off, which is exactly what the flag design promises will not
  happen (`scripts/featurePages.test.mjs`, "flags off", asserts it for the home, About, How it works and Pricing
  pages and for `sitemap.xml`, `llms.txt`, `llms-full.txt` and `seo-content.json`). A `PRODUCT_LINKS` entry would also put the path into `dist/seo-content.json`,
  which the same test forbids. So no static link was added to either page.
- **Recommended fix, for whoever owns the flag layer:** a link that exists only while the flag is on. Two clean options:
  (a) in `src/components/site/SiteFooter.tsx` render `<a href="/features/phone-companion">` and
  `<a href="/solutions/cuticle-biting">` when `useFeature('phone_companion')` / `useFeature('detection_behaviors')`
  is on, plus the same two anchors in the server-rendered footer HTML; (b) a `RULES` entry in `shared/flagCopy.js` that
  appends one sentence with the link to a named blog section only while the flag is on. Candidate sentences and
  hosts, ready for (b): in `nail-and-cuticle-picking`, `nail-biting-cuticle-damage` and `nail-biting-vs-skin-picking`,
  "Stop Biting can record its alerts as <a>cuticle and skin biting</a>; the page says how early that support is";
  in `nail-biting-habit-tracking` and `best-apps-to-stop-nail-biting`, "On a phone you can <a>log a bite or an urge in
  two taps</a>; the alarm itself still needs a computer webcam".
- **Merge:** none proposed. They are product pages, not articles.
- Side note found while checking: `/features` (no slug) answers the branded 404 on production. No page links to it, so
  this is only worth knowing.

### /blog/nail-biting-reward-chart-children

- **Overlap:** negligible (closest cosine 0.038). It is 479 words, below the corpus 10th percentile of 510, and
  deliberately modest: its answer is "no study has tested reward charts", backed by one PubMed search (0 results, dated
  2026-10-20), a 1990 review and a 1999 trial.
- **Links:** already linked in a "Related reading" or "Where to go next" list from all six children and parenting
  posts (`nail-biting-in-children`, `-toddler`, `-teenagers`, `-parents-modeling`, `-punishing-children`,
  `how-to-help-someone-who-bites-their-nails`). That is above the median, so no link was added.
- **Likely reason:** age. It was published 2026-10-20 and the report is dated 2026-10-23.
- **Recommendation:** leave it; re-read Search Console on 2026-11-24.
- **Fallback, only if it is still not indexed then and has no impressions:**
  301 `/blog/nail-biting-reward-chart-children` to `/blog/nail-biting-in-children`. Survivor: `nail-biting-in-children`
  (the hub). Carry over as a new H2 "Do reward charts help? No study has tested them": the PubMed search sentence with
  its date, the Leung and Robson 1990 paragraph, the Woods 1999 paragraph, and the 2026 pediatric case report
  (Riyadh et al.), with the four source links. Retarget the six in-body links above (they point at the old slug) and
  drop the page from `TOPIC_HUBS` K2 in `related.ts`. Do not do this before 2026-11-24.

### /blog/nail-biting-bacteria-parasites

- **Overlap, measured:** shingle share 5.1% with `swallowing-fingernails`, 2.9% with `nail-biting-gut-health`, 3.9% with
  `nail-biting-health-risks`; cosine 0.152, 0.131, 0.107, ranks 4, 6 and 14 among the 17,955 page pairs measured (188 posts plus the two feature pages).
  The textual overlap is small because the posts paraphrase; the **evidence base overlap is not**:
  of its 12 cited sources, 5 are also cited by `nail-biting-gut-health`, 4 by `nail-biting-health-risks` and 4 by
  `swallowing-fingernails` (which has only 5 sources, so 4 of its 5 are this page's); both sources of
  `nail-biting-immune-system` are this page's too. The Baydas 2007 saliva figure (76% against 26.5%) appears in seven
  posts (this one, `nail-biting-health-risks`, `-immune-system`, `-gum-disease`, `-myths`, `-statistics`,
  `swallowing-fingernails`), and the Sung 2001 pinworm study in four (this one, `pinworm-nail-biting`,
  `nail-biting-gut-health`, `swallowing-fingernails`).
- **Timeline, with no causal claim:** the germ and infection posts (the hub, its H1 and H2 clusters and the gum-disease
  post) grew from 9 posts to 17 between 2026-10-08 and 2026-10-20. This page is the long general one (1,424 words, 90th percentile is 999) among
  narrower pages that each answer one question (`pinworm-nail-biting`, `swallowing-fingernails`,
  `staph-mrsa-nail-biting`, `nail-biting-colds-flu-norovirus`). It fell out of the index after 2026-10-02, which is
  before most of those existed, so I cannot show the siblings caused it.
- **A claim-strength inconsistency between two live pages, worth fixing regardless of indexing.** This page says in
  its parasite section: "the short answer is: yes, in specific circumstances, parasites can be transmitted via nail
  biting" and repeats the Sung 2001 and Al-Adhroey 2022 numbers. `pinworm-nail-biting`, written later from the same
  studies, opens "Possibly, but the studies show an association, not a proven route". One of them is wrong in
  emphasis; the later one is the careful one.
- **The hub did not link to it.** `nail-biting-health-risks` (the hub of this cluster) linked to eight of its spokes in the
  body but not to this page, although its section "How nail biting spreads pathogens" is exactly this page's topic. Fixed:
  the hub now links it from "Where to go next", and `nail-biting-immune-system` lists it under "Related reading".
  In-body links went from 7 to 9.
- **Snippet:** left alone. The seoTitle `Nail Biting Bacteria: What's Under Your Nails` and the saliva-study description
  already carry the page's own angle (what is under the nail, not what the nail does to the gut or the worm risk).
- **Recommendation:** keep, and let the owner decide whether to cut the "Can nail biting cause worm or parasite
  infections?" section to two sentences plus a link to the pinworm post. That removes the duplicate evidence and the
  inconsistent claim without removing a page.
- **Fallback merge, only if still not indexed on 2026-11-24:**
  301 `/blog/nail-biting-bacteria-parasites` to `/blog/nail-biting-health-risks`. Survivor: `nail-biting-health-risks`.
  Carry over into its section "How nail biting spreads pathogens": the McGinley 1988 and Hedderwick 2000 subungual
  paragraph (the hub already cites McGinley), the Baydas 2007 paragraph with its "detection, not transfer" caveat, and
  the harm-reduction paragraph. Do not carry the parasite section (it is in the pinworm post) or the HPV and herpes
  paragraphs (they belong to `nail-biting-warts` and `nail-biting-herpetic-whitlow`). Retarget the nine in-body links in:
  `nail-biting-gym-sports`, `swallowing-fingernails`, `pinworm-nail-biting`, `staph-mrsa-nail-biting`,
  `nail-biting-colds-flu-norovirus`, `nail-biting-gum-disease`, `nail-biting-hand-sanitizer`, `nail-biting-health-risks`,
  `nail-biting-immune-system`. This loses the only page that is about the subungual space itself; prefer the owner
  cut above.

### /blog/nail-biting-anxiety-treatment

- **Overlap:** the closest page is `stress-and-nail-biting` (cosine 0.090, higher than 99% of all pairs in the corpus,
  shingle share 1.3%). They are two pages on "anxiety and nail biting". The anxiety page's distinct angle is "is YOUR
  biting anxiety-driven (self-test), and does treating anxiety help". The stress page is the broader mechanism essay.
- **The page contradicts itself, which is a plausible quality reason and is not fixed by links.** Its h1 is "When Treating
  Anxiety Is the Key to Stopping the Habit" and its section heading is "Evidence-based anxiety treatments that reduce nail
  biting". The body, after the 2026-10-21 edit, says "We found no study testing whether treating anxiety reduces nail
  biting" and that the 339-student study found no association. Still on the page, uncited: "MBSR ... 8-week structured
  program with the strongest evidence for reducing anxiety-driven behavioral habits", "Diaphragmatic breathing activates
  the parasympathetic nervous system within 2-3 minutes", and "HRT produces faster visible results, reducing biting
  frequency within 2-4 weeks". The editorial policy says an untraceable claim is softened or deleted.
- **Done:** three in-body links added (from `nail-biting-panic-disorder`, `nail-biting-cognitive-behavioral-therapy`,
  `nail-biting-magnesium`), 3 to 6. The seoTitle `Nail Biting and Anxiety: Treatment Options` was not changed: it
  matches the h1's promise, and changing the snippet without changing the body would widen the gap. Owner decision: soften those three claims and the h1.
- **Fallback merge, only if still not indexed on 2026-11-24, and only after the owner edit above:**
  301 `/blog/nail-biting-anxiety-treatment` to `/blog/stress-and-nail-biting`. Survivor: `stress-and-nail-biting`
  (older, 2026-04-03, broader). Carry over: the three-profile self-assessment (one-week habit diary, with the page's own caveat
  that it is a practical framing rather than a validated typology) and the Pacan 2014 paragraph (22.5% against 26.2%). Retarget
  the six in-body links in (`stress-and-nail-biting`, `nail-biting-lack-of-sleep`, `nail-biting-exercise`,
  `nail-biting-panic-disorder`, `nail-biting-cognitive-behavioral-therapy`, `nail-biting-magnesium`; the one from
  `stress-and-nail-biting` itself becomes a self-link and should be removed) and remove the slug from the B4 cluster in
  `TOPIC_HUBS`. Note the survivor's own h1 ("Why Anxiety Drives the Habit") makes the claim the Pacan study does not support, so it needs the same edit.

### /blog/nail-biting-alternatives

- **Overlap:** closest is `nail-biting-stimming` (cosine 0.103, shingle 2.2%); then `nail-biting-fidget-toys` (0.061).
  Not a duplicate of any. Position 9 of 9 in its cluster, the last, which only affects which three posts list it.
- **Defect found and fixed:** the snippet said the options "only work when they meet the same need" and "12 That Really
  Work"; the body, since 2026-10-20, says matching is "not a proven requirement" and that several options have never
  been studied. New snippet in `title-ledger.md`. The h1 still says "12 Evidence-Based Alternatives": owner decision.
- **Links:** 2 to 5 in-body (from `habit-reversal-training-guide`, `nail-biting-fidget-toys`, `nail-biting-boredom`).
- **Merge:** none proposed.

### /blog/nail-biting-and-perfectionism

- **Overlap:** `nail-biting-personality` (cosine 0.114, the 10th highest pair of the corpus and twice its 99th
  percentile; shingle share 2.0%). Both pages
  rest on the same single citation, Roberts 2015 (24 people, no perfectionism scale), and the personality page's
  "Perfectionism" section already states the finding and its limits in four paragraphs. This page's distinct content is
  the practical part, and that is where the uncited claims are: "Research on ACT for BFRBs (including nail biting) shows
  meaningful improvements in habit frequency, particularly in the perfectionism-driven subgroup"; "Perfectionists who track
  frequency tend to produce significantly better outcomes"; "Four-count box breathing ... changes baseline frustration
  tolerance over 4-8 weeks"; "Research on behavior change in perfectionist populations consistently shows that
  all-or-nothing framing dramatically worsens outcomes". None has a source; two follow directly after paragraphs saying
  the evidence stops at "boredom and frustration raised urges in a lab".
- **Done:** links from `nail-biting-personality` (its Perfectionism section now points to the full write-up) and
  `nail-biting-cognitive-behavioral-therapy`, 1 to 3. The perfectionism page's own body links only to `nail-biting-self-esteem`
  and `/solutions/for-remote-workers`; it does not link back to the personality page, which would be the natural
  cross-link (a body edit, left for the owner).
- **Recommendation:** soften or delete the four claims above (owner), then keep.
- **Fallback merge, only if still not indexed on 2026-11-24:**
  301 `/blog/nail-biting-and-perfectionism` to `/blog/nail-biting-personality`. Survivor: `nail-biting-personality`. Carry
  over only what is sourced or labelled: the frustration-versus-stress reading of Roberts 2015, and the sensory
  perfectionism paragraph relabelled "readers describe", plus the "frequency not success/failure" framing as advice.
  Retarget the three in-body links (`nail-biting-self-esteem`, `nail-biting-personality`,
  `nail-biting-cognitive-behavioral-therapy`) and remove the slug from the B4 cluster in `TOPIC_HUBS`
  (`src/data/related.ts`); the "Related articles" lists that include it (`nail-biting-and-depression`,
  `nail-biting-panic-disorder`, `nail-biting-ptsd`) then recompute on their own, because `getRelated` is derived.

### /blog/mediapipe-ai-detection-explained

- **Overlap:** low (closest `how-ai-can-help-stop-nail-biting`, cosine 0.106, shingle 1.7%).
- **Inbound links were the lowest of any post:** 3 in total and none in the body, the minimum of all 188, although seven
  other posts name MediaPipe. Fixed: in-body links from `how-ai-can-help-stop-nail-biting`,
  `webcam-privacy-nail-biting-app`, `nail-biting-app-battery-performance`, `stop-biting-vs-mavala-stop`,
  `stop-biting-app-review` and `nail-biting-detection-accuracy` (0 to 6), each in the section that already discusses the
  detector or its models. Verified in the server HTML and in `dist/posts/<slug>.json` for each.
- **Another plausible reason:** it has no Sources section and states specifics as fact: "sub-centimetre accuracy",
  "roughly 50-80% of native C++ performance", model sizes of 3.9 MB, 8.4 MB and about 6 MB, "typically under 5
  seconds". The same site's `nail-biting-detection-accuracy` was rewritten on 2026-10-23 to say what is unmeasured. Owner
  decision: source the numbers or soften them.
- **Merge:** none proposed; six posts now link it by name.

## What I could not measure

- Why Google declined any of them. Search Console gives no reason, and I did not use the Chrome tools or the URL
  Inspection tool. The "likely reason" lines above are inferences from age, links and content.
- Per-URL index history. Only the sitewide count (25 near 2026-10-20, 8 on 2026-10-23) is known, so "dropped after
  2026-10-02" for the bacteria page is the orchestrator's note, not something I could reproduce.
- Query-level data for any of the eight; none is in the pack.

## Re-check

On 2026-11-24 read the Pages report again. If a page is indexed, close its fallback. If not, the fallback above is the
exact redirect to approve. The owner can also request indexing from the URL Inspection tool once the two feature pages
have a rendered link, and resubmit the sitemap (the report shows it last read 2026-05-02 with 45 URLs).
