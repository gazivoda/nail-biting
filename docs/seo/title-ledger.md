# Title and description ledger

Every deliberate change to a page's `seoTitle` or `description` is recorded here with the number it is meant to
move, so that a later edit can be judged against it instead of against a hunch. Read it before touching a title.

**Rule for this ledger.** A page listed under "Changed" is frozen until its evaluation date. Do not edit its
`seoTitle`, `title` or `description` again before **2026-11-24**. If the page has to change for a correctness
reason, add a row below saying so, and treat the evaluation of that page as restarted.

Evidence base: `docs/seo/audits/2026-10-27/gsc-data.md` (Search Console, 90 days to 2026-10-25, 122 clicks in total).
That window mostly predates the 2026-10-20 and 2026-10-23 rewrites, so it is the baseline for the pages below, none
of which had a title or description change after 2026-10-19 (checked with `git log -L` on each entry).

## How to read the result on 2026-11-24

The pages are small. Each of the four measured pages (pinworm, toenails, acrylics, fingerprints) got roughly 15 to 30
impressions a week in the baseline window, so one extra click a week is a 3 to 7 point CTR swing and none of it is
statistically distinguishable from noise on a single page. So:

1. In Search Console, filter Performance by Page and compare the 28 complete days after the push date with the 28
   complete days before it, for the four pages pooled, then page by page. Fill in the push date in the list below.
2. A snippet change must not move rank. If a page's average position moved by more than 2, say so and do not read its
   CTR change as a snippet effect.
3. Impressions grew about 5x in the last two weeks of the baseline window, so compare CTR at similar position, not
   across windows with a different query mix. For pinworm and toenails use the per-query rows named below.
4. Call it a win only if the pooled CTR rose and at least three of the four pages did not fall. Anything weaker is
   "no detectable effect", and the right response is to leave the titles alone, not to try another variant.
5. Push date: **not yet known** (set by whoever merges and pushes this branch).

## Changed

Rendered title is `seoTitle ?? title`, with " | Stop Biting" added only when the result stays within 60 characters
(`buildPageTitle`, `src/utils/pageTitle.ts`, mirrored in `server.js`). The `h1`, slug and body are untouched. Neither
`dateModified` nor the sitemap `lastmod` moved (precedent: 78e72fb, a849ead, d21ce60; the lead of this pass asked for
it). Social cards for the three pages whose `seoTitle` changed were regenerated, because the card bakes the same string.

| Date | URL | What changed | Baseline (90 d to 2026-10-25) | Evaluate on |
|---|---|---|---|---|
| 2026-10-27 | `/blog/pinworm-nail-biting` | seoTitle | 1 click / 236 impr / 0.4% CTR / pos 9.1 | 2026-11-24 |
| 2026-10-27 | `/blog/nail-biting-toenails` | seoTitle added | 3 / 282 / 1.1% / 7.5 | 2026-11-24 |
| 2026-10-27 | `/blog/acrylics-to-stop-nail-biting` | description | 2 / 407 / 0.5% / 8.4 | 2026-11-24 |
| 2026-10-27 | `/blog/nail-biting-fingerprints` | description | 2 / 231 / 0.9% / 6.5 | 2026-11-24 |
| 2026-10-27 | `/blog/nail-biting-alternatives` | seoTitle and description | not in the pack's page list (Search Console: crawled, currently not indexed) | 2026-11-24, only if it is indexed by then |

### /blog/pinworm-nail-biting

- Old seoTitle: `Pinworms and Nail Biting: What Studies Show` (43 chars, rendered with brand, 57)
- New seoTitle: `Does Biting Your Nails Give You Worms? Pinworm Studies` (54 chars, rendered without brand, 54)
- Description: unchanged, `Studies link nail biting to pinworm in children, but only as an association. What three studies and two reviews found, and what to do if you suspect it.` (152). It is already answer-first and says "association".
- Query evidence (from the pack, 116 impressions, 0 clicks, average position 9.7): "does biting your nails give you
  worms" 27, "can you get pinworms from biting your nails" 15, "can you get worms from biting your nails" 13, "can biting
  your nails give you worms" 12, "pinworms nail biting" 11. The old seoTitle contained none of them.
- Why not the verbatim query alone: "worms" is broader than the evidence, which is about pinworm in children. "Pinworm
  Studies" keeps the scope honest and keeps the word that 26 of the 78 listed impressions use.
- Hypothesis: the result did not echo the question being asked, at a position where the title is what is compared.
  Echoing it should raise CTR at unchanged position. Per-query check: the five queries above.
- Claim check: a question is not a claim, and the description beside it says "only as an association", which the body
  states in its first paragraph.

### /blog/nail-biting-toenails

- Old: no seoTitle. The rendered title was the h1, `Do People Bite Their Toenails? Yes. Here's What to Know`: 55 chars, no brand (it does not fit), **not truncated**
  (live `<title>` fetched from stopbiting.today on 2026-10-27: 55 characters, no brand, no ellipsis). It already led with the
  verbatim query, so the premise that a missing seoTitle cost it a truncated title does not hold.
- New seoTitle: `Do People Bite Their Toenails? Yes, but Rarely` (46 chars, rendered `... | Stop Biting` at exactly 60).
- Description: unchanged (159).
- Query evidence: "do people bite their toenails" 18 impressions at position 6.1; cluster of four queries 47 impressions, 0
  clicks, position 10.5.
- Hypothesis (small effect expected): the old title spent its second half on filler ("Here's What to Know"). "Yes, but
  Rarely" is the cited answer (the standard review says toenails are rarely bitten, Lee and Lipner 2022) and the brand now fits.
  This is the weakest of the five changes; if nothing moves, that is the expected result, not a failure.
- Claim check: "rarely" is the review's own word, quoted in the body's first section.

### /blog/acrylics-to-stop-nail-biting

- seoTitle unchanged: `Can Acrylic Nails Stop Nail Biting?`
- Old description (153): `Acrylic nails are one of the most popular ways to stop nail biting. What the evidence shows, when they work, when they don't, and what to pair them with.`
- New description (158): `Possibly: dermatology reviews say manicures can reduce biting in motivated patients, but no controlled trial has tested acrylics. When they help, what to add.`
- Query evidence: none listed in the pack for this page; the question form is derived from the h1 and title. The old
  description was a table of contents, not an answer.
- Hypothesis: a hedged direct answer at position 8.4 earns more clicks than a topic sentence.
- Claim check, against the body: "dermatology reviews ... professional manicures can reduce nail biting in patients who are
  motivated to preserve the manicure" and "no controlled trial of manicures or artificial nails for nail biting exists"
  are both in the second section. The body's stronger claim that acrylics alone "rarely produce lasting change" is
  deliberately NOT repeated: the same page calls it "a mechanistic argument, not a measured finding".
- Written with a colon rather than a full stop after the first word, because `firstSentence()` in `scripts/sync-seo.mjs`
  builds the `llms.txt` blurb from the first sentence, and "Possibly." alone is not a blurb.

### /blog/nail-biting-fingerprints

- No seoTitle (the h1 is already the question, 42 chars, rendered with brand, 56).
- Old description (149): `Ridges are templated in the dermis and regrow after surface wear, so ordinary biting leaves them intact. Only deep fingertip damage could alter them.`
- New description (156): `Usually not: ridges are set in the dermis and regrow after surface wear, so ordinary biting leaves them intact. Only deep fingertip damage could alter them.`
- Query evidence: none listed; derived from the h1. Position 6.5 with 0.9% CTR points at the snippet, since the rank is fine.
- Hypothesis: the old description never said the answer in plain words ("templated in the dermis" is jargon).
- Claim check: "Usually not" restates the body's "for the vast majority of nail biters, no". No claim was added. Open
  issue for the owner, not touched here: the page's only citation (Lee and Lipner 2022) is about nail changes, so the
  dermis and ridge-regrowth statements, in the body and in the old and new description alike, are uncited.

### /blog/nail-biting-alternatives (truthfulness fix, not a CTR experiment)

- Old seoTitle: `Nail Biting Alternatives: 12 That Really Work` (59 with brand)
- New seoTitle: `What to Do Instead of Biting Your Nails: 12 Options` (51)
- Old description (155): `Competing responses only work when they meet the same need as nail biting. 12 evidence-based alternatives that work, organized by the trigger they address.`
- New description (150): `Match the substitute to your trigger and to where you bite. 12 options by stress, focus and boredom biting, with what research does and does not show.`
- Why: the page's own body (edited 2026-10-20) says sensory matching "is not a proven requirement", that a randomised
  trial found similar and dissimilar competing responses worked no differently, and that no study has tested cold water
  or gum for nail biting. The snippet still said "only work when they meet the same need" and "That Really Work". The
  mirror gate in `scripts/sync-seo.mjs` checks figures and cited surnames, not claim strength, so it could not catch this.
- "12" is supported: the three groups hold 4 + 4 + 4 items, which the gate counts as enumerated.
- The page is "crawled, currently not indexed", so there is no CTR to measure until it is indexed.
- Left alone on purpose: the h1 `What to Do Instead of Biting Your Nails: 12 Evidence-Based Alternatives` has the same
  over-claim, and the brief fixes h1/title. Owner decision.

### Compliance trims (not experiments)

Two descriptions had grown past the repo's 160-character ceiling when the 2026-10-23 privacy wording went in. They are
trimmed because those two posts were being edited anyway (see `index-health.md`). No meaning was removed. Note the
exception: the data pack says not to re-edit a snippet that changed after 2026-10-20, and these two did change on
2026-10-23. They are length-only trims, are not in the experiment, and can be reverted line by line in commit d1f2f36
if that rule is meant to cover them.

| URL | Old | New |
|---|---|---|
| `/blog/webcam-privacy-nail-biting-app` | 163 chars, "See exactly what data is collected" | 155 chars, "See what data is collected" |
| `/blog/nail-biting-detection-accuracy` | 161 chars, "false alarms and missed episodes occur" | 152 chars, "false alarms and misses occur" |

## Considered and not changed

| URL | Baseline | Why left alone |
|---|---|---|
| `/blog/is-nail-biting-self-harm` | 111 impr on its cluster, 0 clicks, pos 9.0 | The seoTitle is already the question and matches three of its five queries almost verbatim; the top query is "is biting your nails self harm" (34). Swapping "nail biting a form of" for "biting your nails" would be a near no-op and would cost a four-week freeze. The description already opens "By the usual definitions, no". |
| `/blog/swallowing-fingernails` | 1 / 298 / 0.3% / 12.7 | The only listed queries are tiny ("is it bad to swallow fingernails" 7, "swallowing fingernails" 6 at 17.7). The current question-form title matches the h1 and the likely head query, and position 12.7 means most impressions are page two, where the title rarely decides. |
| `/blog/nail-biting-statistics` | 1 / 340 / 0.3% / 10.7 | Title already pairs the head term with the question ("How Common Is It?"), the description already opens with the figures. Last description edit 2026-10-19. |
| `/blog/nail-biting-oral-fixation` | 1 / 204 / 0.5% / 15.9 | Position 15.9 is outside the 6 to 13 band; a snippet cannot fix a page-two position. |
| `/blog/nail-biting-seniors-elderly` | 1 / 239 / 0.4% / 7.9 | No query data, and no honest question-form title exists: the only citations are nail growth studies, and the page says it found no study on healing or infection at any age. The description leads with a thumbnail-growth measurement, which is why it does not answer the query, but a better lead needs a sourced "no study found" sentence in the body first. Needs the page's query list from Search Console. |
| `/blog/nail-biting-bacteria-parasites` | 2 / 222 / 0.9% / 10.8 | Currently not indexed, so a snippet cannot earn clicks. Its seoTitle and description already carry its distinct angle (what lives under the nail, the saliva study). Handled as an index problem in `index-health.md`. |

Never touched, as instructed: `/blog/nail-biting-cancer` (published 2026-10-20), `/blog/nail-biting-vitamin-deficiency`,
`/blog/grow-nails-after-nail-biting`, `/blog/nail-biting-finger-tape`, the homepage, and the ranking-problem pages
(`nail-biting-dermatophagia`, `how-to-stop-nail-biting`, the BFRB pages): at positions 25 to 60 a snippet cannot help.

## Sitewide check, 2026-10-27 (read-only, then re-run after the edits)

Method: built this branch, served it locally with `phone_companion`, `detection_behaviors` and `lifetime_plan` on (as in
production), fetched all 221 sitemap URLs and read `<title>`, `<meta name="description">`, `<h1>` and the canonical.

| Check | Before | After |
|---|---|---|
| Non-200 URLs | 0 | 0 |
| Rendered titles over 60 characters | 0 | 0 |
| Titles ending in an ellipsis (truncated by the server) | 0 | 0 |
| Duplicate titles / descriptions / h1s | 0 / 0 / 0 | 0 / 0 / 0 |
| Em dashes in a title or description | 0 | 0 |
| Descriptions over 160 characters | 2 (`webcam-privacy-nail-biting-app` 163, `nail-biting-detection-accuracy` 161) | 0 |
| Canonical not equal to the URL | 0 | 0 |

Title length histogram after: 20s 2, 30s 2, 40s 45, 50s 158, 60 exactly 14. Fourteen pages sit at exactly 60
(`best-apps-to-stop-nail-biting`, `biotin-bitten-nails`, `nail-biting-alcohol`, `nail-biting-autism`,
`nail-biting-essential-oils`, `nail-biting-gut-health`, `nail-biting-knuckle-cracking`, `nail-biting-musicians`,
`nail-biting-self-esteem`, `nail-biting-teachers`, `nail-biting-toddler`, `nail-biting-toenails`,
`nail-biting-vs-tics-tourette`, `compare/stop-biting-vs-nailbitemenu`). That is inside the ceiling the repo set, but at
600 pixels some of them will still be cut in the result; it is a character budget, not a pixel budget.

Not fixed because outside this pass, worth knowing: no gate enforces 160 characters on post descriptions.
`npm run seo:check` allows up to 165 (`checkMetaLength` in `scripts/sync-seo.mjs`), and `src/utils/serverMeta.test.ts`
only reads the literals in `server.js`. The two overruns above got in on 2026-10-23 for that reason.

## Correctness change, 2026-10-30 (lane E)

| Date | URL | What changed | Baseline (90 d to 2026-10-25) | Evaluate on |
|---|---|---|---|---|
| 2026-10-30 | `/blog/nail-biting-finger-tape` | description only | 7 clicks / 306 impr / 2.3% / 7.1 (retitled 2026-10-20, so this restarts its evaluation) | 2026-11-27 |

- Old description: `Taping target fingers is cheap, discreet, and more sustainable than gloves. Here is how to use it well and what it can and cannot achieve.`
- New description (153 chars): `No study we found has tested finger tape for nail biting. What a 2022 review says about barriers, how tape differs from bitter polish, and how to use it.`
- Why it changed despite the freeze: the body of the post was rewritten the same day because "more sustainable than gloves" had no source (PubMed search, 30 October 2026: no study of tape for nail biting). A snippet that still said it would contradict the page. This is a correctness change, not a click-through experiment.
- `seoTitle` and `title` are untouched. The 2026-11-24 measurement of the other rows is unaffected.
- Not applied, owner decision: `/blog/nail-biting-famous-people` title `Famous People Who Bite Their Nails` and its description's last sentence ("Success doesn't end it") promise more than the new top section delivers (two people named, both with a source we opened). The page is the third best clicker, so a retitle risks the clicks it earns. Proposed, if wanted: seoTitle `Famous People Who Bite Their Nails: Two Who Have Said So`.
