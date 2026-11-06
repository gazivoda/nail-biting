# SXO read: health-worry pages, 2026-11-06

Read-only; nothing else in the repo was changed. Data: `gsc-data.md`, `gsc-queries.tsv` (28 days to 2026-11-03).

## How the SERP was read, and what that cannot show

Google itself could not be read: `google.com/search` returned only an access notice, DuckDuckGo a bot check, Bing "no
results" (all 2026-11-06). So the "SERP" below is (1) the WebSearch tool's results, which are not Google's ranking, and
(2) the competing pages I opened myself, with their `<title>` and meta description read from raw HTML
(`render_page.py --mode never`). I could not see AI Overview, People Also Ask, featured snippets, or the snippet text
Google actually shows (it may rewrite ours from the body). Everything said about those is inference.

Two inferences that hold for every cluster below:
- An impression is not a view. At position 6 under an AI Overview, PAA and five results, a result is often counted
  without being scrolled to. That alone can push CTR far below the usual position-6 curve.
- If Search Console gives an AI Overview citation the Overview's position, an average of 6.3 suggests we are not
  the cited source there. Not verified (I did not open Google's documentation on this).

## 1. Cancer: `/blog/nail-biting-cancer` (736 impr, 1 click, pos 6.3, published 2026-10-20, 16 days old)

Ours: title `Can Nail Biting Cause Cancer? What Studies Show`; description `No study shows nail biting causes cancer. What a
case report, a 261-patient nail cancer study and a melanonychia study found, and which signs need a doctor.`
Does the description answer completely? **Yes.** The yes/no question is settled in the first five words.

Competing pages opened 2026-11-06 (title; meta or first line):
- yourhealthmagazine.net/article/cancer-awareness/can-biting-your-nails-cause-cancer/: `Can Biting Your Nails Cause Cancer?`; no meta, body opens "No, nail biting is not known to cause cancer".
- acsh.org/news/2018/09/07/could-biting-nails-cause-skin-cancer-yes-possibly-13390 (advocacy site): `Could Biting Nails Cause Skin Cancer? Yes, Possibly`; thumb story "could very well be true".
- marieclaire.com/beauty/a23071163/nail-biting-thumb-cancer-amputation/, newsweek.com/woman-nail-biting-habit-has-thumb-amputated-after-developing-cancer-1110869, uk.style.yahoo.com/woman-reportedly-got-cancer-biting-092600643.html (Cosmopolitan, 2018): all the Whithorn thumb amputation story. healthtap: 403.

Reading: we are tied with yourhealthmagazine for the "plain no" slot, an answer an AI Overview can give in one line
(the WebSearch tool's own summary did exactly that). Every other non-scraper result is the 2018 Whithorn thumb story,
with a hook ("Yes, Possibly", "amputated"). The searcher very likely heard that story; **our page never mentions it.**
Its only case is a 1988 report. That is the real gap: not the snippet, the body.

Is answering in the snippet still right? Yes. The worried reader who reads "No study shows nail biting causes cancer"
and leaves has been served. Do not withhold it.

Verdict: (b) body change now, then (a) a description change after 2026-11-24.

- **(b) Body, now.** New section after "Is there any case of nail biting and cancer on record?". Heading: `What about the
  woman who lost her thumb?` Draft: "In 2018 news outlets reported that a 20-year-old Australian student had her thumb
  amputated because of a rare melanoma under the nail, years after she bit the nail off entirely (Newsweek, 2018). That
  is a news report, not a published medical case. A Yale dermatologist quoted in the coverage, Dr Mona Gohara, said
  there are no studies showing that trauma contributes to this type of melanoma, that trauma might contribute, and that
  nail biting is not considered a risk factor for cancer (Cosmopolitan, 2018). One Korean hospital study of 87 people
  with nail melanoma found that 21.8% had a history of trauma to the nail, and its authors say trauma may play a role.
  Its abstract does not mention nail biting (Choi et al., 2022)."
  Sources opened 2026-11-06: Newsweek URL above; Yahoo/Cosmopolitan URL above (four Gohara quotes); Choi ME et al.,
  Dermatology 2023;239(1):165-173, PMID 35878586, abstract via NCBI eutils. ACSH is not cited (advocacy, secondhand).
  Expected effect: better answer for readers who arrive; no measurable traffic effect expected from the body alone.
  Caveat: the page is on a watch for 11-24; a body edit muddies that read. Add a ledger row with the date.
  Failed if: the description and new section contradict (they do not: "no study shows" stays true).
- **(a) Description, after 2026-11-24** (158 chars): `No study shows nail biting causes cancer. What the 2018 thumb
  melanoma story, a case report and a 261-patient study found, and which nail signs need a doctor.`
  Hypothesis: the searcher's trigger is the viral story; naming it tells them this result addresses it, without removing
  the answer. Metric: pooled clicks on the 8 cancer phrasings in the TSV, 28 days after vs before, at average position
  within 2 of 6.3. Baseline about 0.1% (1 click per ~736 page impressions). Win: 5 or more clicks on comparable
  impressions. Failed if: 2 or fewer, which would mean the answer above the results absorbs the click and the right
  response is to stop editing this snippet. The page is still ramping; read 11-24 before deciding at all.

## 2. Self-harm: `/blog/is-nail-biting-self-harm` (552 impr, 3 clicks, 0.5%, pos 7.9)

Ours: `Is Nail Biting a Form of Self-Harm?`; `By the usual definitions, no: nail biting is a body-focused repetitive
behavior. What the TLC Foundation and a 1,523-person study say about the difference.` Answers completely: **yes**,
and it names the authority. The body opens with the answer and the TLC quote "BFRBs are not self-harm", and ends with a
crisis pointer. The mid-article CTA is excluded for this slug (`midCtaRules.ts`); only the plain product paragraph shows.

Opened 2026-11-06: bfrb.org/faq/diagnosis-treatment-what-is-nail-biting (title `FAQs | The TLC Foundation`, no meta);
my.clevelandclinic.org/health/diseases/body-focused-repetitive-behavior-bfrb (meta "...self-grooming behaviors that may
cause harm"); lindnercenterofhope.org BFRB post; inkl.com psychologist piece (paywalled); PubMed 32567695 (403 on the
page, abstract via eutils). The authorities answer "what is a BFRB", not this question; the direct answers in the tool's
results were a crochet blog, voi.id and a scraper. Ours is arguably the best direct answer present.

Verdict: **(c) nothing.** 0.5% at position 7.9 is unremarkable for an answerable question. The lost clicks are the
price of answering correctly in the snippet. Optional body line, low priority: Mann et al. 2020 (J Clin Psychol,
PMID 32567695) argued from three cases, one of nail biting, that the DSM-5 proposed NSSI criteria should not exclude it.
One sentence in "What does the research say?" would make the "boundary is not always drawn cleanly" line concrete.

## 3. Worms: `/blog/pinworm-nail-biting` (609 impr, 1 click, pos 9.0); `nail-biting-bacteria-parasites` related

Ours: `Does Biting Your Nails Give You Worms? Pinworm Studies` (seoTitle changed 2026-10-27, **in a running ledger
experiment**); description `Studies link nail biting to pinworm in children, but only as an association...` Answers
completely: **partly**. Body lead: "Possibly, but the studies show an association, not a proven route."

Opened 2026-11-06: cdc.gov/pinworm/about/index.html (eggs "under their fingernails, they then touch their mouth");
cdc.gov/pinworm/prevention/index.html (dated 2026-04-29: "avoid biting nails", "Keep fingernails clean and short");
nhs.uk/conditions/threadworms/ (reviewed 2023-12-01: "do not bite nails or suck thumbs and fingers");
health.ny.gov pinworm fact sheet; healthline.com/health/pinworms (no nail mention in meta); wormmy.com (no meta, "The
answer is yes"); archive.imascientist.org.uk Q&A (2011). Competitors say "yes" and the health agencies give the route.
Our lead is accurate about the studies but under-states what CDC and NHS say, and names neither.

Verdict: **(b) body change, but after the ledger read** (2026-11-24, or 28 days after the 10-27 push, whichever is
later), not now, so the seoTitle test is not confounded. Draft lead: "It can be one way pinworm eggs reach the mouth.
The CDC describes infection after people get eggs under their fingernails and then touch their mouth, and both the CDC
and the NHS advise not biting nails. The studies in children show an association: nail biting was more common in
infected children, which does not prove it was the route." Expected effect: none measurable; it is an accuracy and
authority fix. Failed if: the description ("only as an association") reads as contradicting it; it should not, since
it speaks about studies. Leave `nail-biting-bacteria-parasites` alone (newly indexed, no query data).

## 4. Nail polish: `/blog/swallowing-nail-polish-biting` (993 impr, 4 clicks, pos 9.8)

Ours: `Is Swallowing Nail Polish Harmful?`; `No study covers flakes of polish, gel or acrylic swallowed by adult nail biters.
Poisoning reports mainly involve liquid remover swallowed by toddlers.` Answers: **no**, it states what is unknown.
The queries ask about polish ("what happens if you eat nail polish" 13, "...gets in your mouth" 9, "...swallow nail
polish" 7); the body is about remover, acetonitrile, a toddler death and gel allergy, and cites no Poison Control.

Toxicology sources opened 2026-11-06: chop.edu/centers-programs/poison-control-center/nail-polish (CHOP Poison Control
Center: toxicity "Minimal to none", most common symptom "Upset stomach", "non-toxic in small amounts, but large
ingestions may be concerning", child-focused); poison.org/articles/nail-polish (National Capital Poison Center: "a taste
or lick of nail polish is not likely to result in significant toxicity", eating it likely causes "nausea, vomiting, and
abdominal pain", for polish in the mouth "wipe out as much as possible and drink small sips of water", 1-800-222-1222;
and an adult who ate polish for a year was advised a medical evaluation); medlineplus.gov/ency/article/002722.htm (lists
toluene, butyl acetate, ethyl acetate, dibutyl phthalate); ufhealth.org copy of the same. This is the cluster with a
true page-type and intent mismatch: the SERP is Poison Control answering "what happens", we answer "what is unstudied".

Verdict: **(b) body change now** (page is not in the ledger experiment) **and (a) description after 2026-11-24.**

- **(b) First section, new opening paragraph:** "Poison Control says a taste or lick of nail polish is not likely to
  cause significant toxicity, and that eating it is likely to cause nausea, vomiting and stomach pain. The Poison
  Control Center at Children's Hospital of Philadelphia rates the toxicity of swallowed polish as minimal to none in
  small amounts, says large amounts may be concerning, and writes for children who swallowed liquid polish. We found no
  study of the dried flakes of polish, gel or acrylic that an adult bites off." Then the existing text. In "What should
  I do?" add: "If polish is in someone's mouth, Poison Control advises wiping out as much as possible and drinking small
  sips of water. In the US, Poison Help is 1-800-222-1222, free and open 24 hours. Poison Control also describes an
  adult who ate polish for a year and was told to get a medical evaluation." Remover cases stay, below.
  Expected effect: the page finally answers its queries; rank effect unknowable. Failed if: the description no longer
  matches the body (it still does: remover reports remain).
- **(a) Description after 2026-11-24** (157): `Poison Control says a taste of nail polish is unlikely to be toxic; eating it
  can upset the stomach. No study covers bitten flakes of polish, gel or acrylic.` Hypothesis: naming the authority and
  the answer in the query's own terms raises CTR at unchanged position. Baseline 4/993 (0.4%) at 9.8. Win: CTR at least
  doubles with position within 2. Honest expectation: small; queries are fragmented and near page two.

## 5. Swallowing fingernails (624 impr, 1 click, pos 12.1) and toenails (286 impr, 4 clicks, pos 8.1)

Fingernails: **(c) nothing.** Position 12, largest query 10 impressions; the tool's results were scrapers, Q&A and
forums. Toenails: **(c) nothing.** In the running ledger experiment; results were spam mirrors; our title already gives
the cited answer ("Yes, but Rarely").

## Product bridge (all clusters)

Health-worry slugs are excluded from the mid-article CTA; the only product mention is a plain paragraph after the
article ("a webcam alarm ...", free trial of `TRIAL_DAYS` days, default 3, no card, demo link) plus the footer. It does not overclaim and should stay
as is. No change proposed; pushing the product harder on cancer or self-harm readers would read as exploiting a worry.

## Ranked list

1. Nail polish body: lead with Poison Control (CHOP, poison.org), add the mouth advice and Poison Help line. Now.
2. Cancer body: add the 2018 thumb story section with the Gohara quotes and Choi 2022. Now, with a ledger row.
3. Cancer description naming the thumb story, keeping "No study shows". After 2026-11-24, only if the page has
   finished ramping; stop if it fails.
4. Pinworm lead naming CDC and NHS. After the ledger read for that page.
5. Nail polish description naming Poison Control. After 2026-11-24, small expected effect.

Could not verify: Google's real ranking, AI Overview, PAA, featured snippets and the snippet text Google shows for our
pages; mobile vs desktop split; whether we are cited in an AI Overview; healthtap (403); the Marie Claire article body
(truncated, Gohara quotes taken from the Yahoo/Cosmopolitan copy instead).
