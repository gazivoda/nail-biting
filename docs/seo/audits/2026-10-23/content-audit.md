# Content growth audit: stopbiting.today

Audit date: 23 October 2026. Baseline: `origin/main`, read with `git show`; live official sources checked where noted. The shared workspace has an unfinished merge and was not changed. This is an editorial review of six existing pages, not a prediction of rankings or traffic.

## Executive finding

The immediate opportunity is to make the existing content more reliable and easier to act on. There are 188 blog posts already. Topic hubs, descriptive internal links, a named author, visible update dates, editorial policy and medical disclaimers are implemented on the deployed branch. Recommending them as missing would repeat completed work. Several recently corrected introductions still contradict older sections farther down the same page.

The 20 October plan preserves a historical Search Console baseline (18 July–17 October: 110 clicks, 11.8K impressions, 0.9% CTR, average position 13.8). It names grow-nails-after-nail-biting (611 impressions, 2 clicks) and nail-biting-vitamin-deficiency (944 impressions, 11 clicks). Those figures are supplied historical evidence, not a fresh Search Console export. Both pages' titles/descriptions changed on 21 October; no post-change outcome can be inferred yet. Do not churn their titles again or report an uplift without later data.

## Editorial scores

Content quality: **60/100**. E-E-A-T: **57/100**, using the requested weights: Experience **13/20** (founder experience and process explanations; few original measured outcomes), Expertise **15/25** (many direct research citations and explicit study limitations; no clinician review and some unsupported generalizations), Authoritativeness **5/25** (strong topical breadth but independent clinical recognition was not established by the sampled search), Trustworthiness **24/30** (named commercial owner, editorial/corrections policy, contact, privacy and terms; comparative efficacy overstatements weaken trust).

AI citation readiness: **63/100**, an editorial assessment rather than measured AI visibility. Answer quality **65**, passage self-containment **70**, structure **80**, evidence specificity **50**, unique contribution **25**. The weighted rubric is 30/25/20/15/10%; 19.5 + 17.5 + 16 + 7.5 + 2.5 = 63. There is no evidence here of current citation frequency across AI engines.

## Measured sample

Word counts include source article headings, body, lists and text inside HTML blocks; they exclude site navigation and shared page chrome. Readability uses prose/list text only, excluding source lists and boilerplate. Flesch scores use a simple English syllable heuristic and are approximate; long drug names and clinical terms inflate difficulty.

- grow-nails-after-nail-biting: **1,424 words**; approximate Flesch **53.1**, grade **10.7**, **19.4 words/sentence**; modified 21 October.
- nail-biting-vitamin-deficiency: **916 words**; Flesch **39.1**, grade **13.9**, **24.7 words/sentence**; modified 21 October.
- nail-biting-dermatophagia: **999 words**; Flesch **49.1**, grade **11.2**, **19.3 words/sentence**; modified 20 October.
- best-apps-to-stop-nail-biting: **2,420 words**; Flesch **51.1**, grade **10.5**, **17.5 words/sentence**; modified 21 October.
- bfrb-guide: **1,138 words**; Flesch **12.4**, grade **21.8**, **41.3 words/sentence**; modified 15 September.
- how-to-stop-nail-biting: **1,913 words**; Flesch **49.4**, grade **11.2**, **19.4 words/sentence**; modified 16 September.

Against the skill's 1,500-word blog coverage guideline, four sample pages are below it. This is a coverage prompt, not a Google threshold or a recommendation to add filler. The main guide and app roundup exceed it. The BFRB guide should be simplified before it is expanded. No keyword stuffing was evident in the six-page sample; keyword density is not an implementation target. The existing primary terms already appear in the title/H1/opening of each target.

## Four concrete existing-page fixes

### 1. Reconcile the nail-growth page (highest historical CTR opportunity)

Path: `src/data/blogPosts.ts`, slug `grow-nails-after-nail-biting`, sections "What you'll see week by week", "Care tips that genuinely speed recovery" and "The urge to bite growing nails".

The opening properly distinguishes the 3.47 mm/month study from an unmeasured complete-recovery timeline. Later text promises a "predictable sequence", "full length reached by most people" at months 2–4, an unsupported "most common relapse window" at weeks 2–6, and care/supplements that "speed recovery". These sentences undermine the corrected opening.

Suggested replacement answer: "Fingernails grew an average of 3.47 mm per month in a study of 22 healthy young adults. At that rate, 5 mm of new growth would take about six weeks; this is a calculation, not a measured recovery time for nail biters. How your nails look also depends on where they were bitten and whether the nail-producing tissue was injured."

Replace the fixed recovery schedule with clearly labeled arithmetic/observations, and the care section with filing snags, protecting nails from repeated water exposure, moisturizing after washing, and avoiding cuticle trauma. Do not claim that oil or hardeners accelerate growth. Remove fixed relapse timing and qualify sensory triggers without invented prevalence. Link naturally to the existing nail-growth calculator, nail-care guide and habit-reversal guide after answering the reader's question.

Evidence: [Yaemsiri et al. primary study abstract](https://pubmed.ncbi.nlm.nih.gov/19744178/?dopt=Abstract) reports 22 participants, 3.47 mm/month and no significant onychophagia difference; [AAD nail-care guidance](https://www.aad.org/public/everyday-care/nail-care-secrets/basics/healthy-nail-tips) supports protective care, not accelerated growth.

### 2. Answer the deficiency query without an absolute or dismissive claim

Path: `src/data/blogPosts.ts`, slug `nail-biting-vitamin-deficiency`, description and first two sections.

"No evidence links nail biting to a vitamin or mineral deficiency" overstates a negative literature claim. The first paragraphs speculate about readers wanting an easy excuse, and the 92.2% automaticity survey does not establish or rule out nutrient causation.

Suggested opening: "Nail biting alone does not identify a vitamin or mineral deficiency. Research on nail biting describes it as a body-focused repetitive behaviour; the studies cited here do not establish that low iron, zinc or magnesium causes it. Damaged or brittle nails and the habit of biting them are separate questions. If you are worried about a deficiency, discuss your symptoms and diet with a clinician rather than choosing a supplement from the habit alone."

Keep claims narrowly tied to the available papers. Add a specific practical route to the existing habit-reversal guide and biotin article. Keep the medical disclaimer and author transparency. Do not present a 339-student study as a nutrient test, or say correcting a real deficiency cannot help any individual. A small 1964 observational anemia study exists, but does not establish causation or supplement efficacy; do not add it as proof of a cure.

### 3. Make the app roundup an honest purchase aid

Path: `src/data/blogPosts.ts`, slug `best-apps-to-stop-nail-biting`, title, opening, comparison table, verdict and FAQ.

Its SEO title already says "Best Apps"; the H1 still promises "5 Best Tools ... Ranked by Evidence" while the article covers more than five products and has no comparative app trial. The table calls Stop Biting's habituation risk "None", says it addresses the root trigger, and ranks other categories' risks without evidence. The verdict and FAQ say passive camera detection is the only effective real-time solution and prescribe a "most effective" combination. That does not follow from HRT trials, which tested packages of awareness training, competing responses and social support rather than these products.

Suggested H1: "Apps and Tools to Stop Nail Biting: Which Fits Your Routine?" Suggested opening: "The useful distinction is between apps that alert you while your hand is near your mouth and apps that help you record urges or track nail growth. A webcam app can cover time at your computer; a phone tracker or wearable may fit other parts of your day. This is a feature comparison, not a clinical ranking, and Stop Biting is our product."

Use columns for detection/logging method, device/context, documented features, verified price/date and limits. Replace clinical superiority/habituation assertions with "not assessed" unless supported. Retain an explicit maker disclosure and identify product facts as vendor-reported unless actually tested.

Verified correction on 23 October: [Nailed's official site](https://nailedapp.io/) now says free, and its linked [US Mac App Store listing](https://apps.apple.com/us/app/nailed-quit-nail-biting/id6761733224?mt=12) also says free, macOS 12+, Apple M1 or later. Remove the obsolete $4.99 vendor-price claim and update its check date. [Hands Off](https://handsoffapp.com/) still advertises €2.99/month after three free days. [NailKeeper](https://nailkeeper.app/) describes photos, reminders and a quit timer. Do not copy competitors' unsubstantiated clinical marketing statistics.

Clinical basis for restraint: [Twohig et al.](https://pubmed.ncbi.nlm.nih.gov/12590622/) randomized 30 adults to HRT or a conversation placebo; this is not a trial of Stop Biting. [Allen's 45-person study](https://pubmed.ncbi.nlm.nih.gov/8881096/) found significant nail-length improvement for mild aversion, while the competing-response arm just missed significance; it does not support universally dismissing bitter polish.

### 4. Make the existing BFRB hub readable

Path: `src/data/blogPosts.ts`, slug `bfrb-guide`, sections "What is a BFRB?", "What they share neurologically", "How treatment differs by BFRB type" and "Finding support".

Retain the definition, correct terms and links but divide 60–100-word sentences into two or three sentences. The treatment section mixes HRT effect size, trial populations, several behaviours, NAC adult results and pediatric limits in long paragraphs. Separate what HRT is, what the cited analysis measured, and why medication findings do not generalize from one BFRB to another. Do not silently expand a general-health hub into prescribing guidance.

Suggested definition: "Body-focused repetitive behaviours (BFRBs) are repeated actions directed at the body, such as nail biting, skin picking or hair pulling. They can cause physical damage and can be difficult to stop. The term describes a group of behaviours; it does not mean that everyone who occasionally bites a nail has a disorder."

## Brand visibility and independent authority

Exact-domain searches for Reddit, YouTube and LinkedIn did not return a relevant result in this sample; Product Hunt search returned another product, not Stop Biting. No mention volume, sentiment or absence conclusion can be justified from this alone. Wikipedia search API for exact `stopbiting.today` returned zero hits; Wikidata's entity search for that domain returned no entity. These checks do not establish that no company/founder entry exists under another name. Avoid creating a Wikipedia entry or adding guessed `sameAs` links.

Authority work belongs with the owner: publish a factual device/context demo and document an actual usability session or founder process with consented screenshots; pursue optional clinician review only once a real qualified reviewer has agreed. No invented credentials, fake review schema, fabricated outcomes, mass outreach or external posting.

## Skill coverage and limits

- Applied: `seo-content`, `geo-content`, `geo-citability`: content, E-E-A-T, word counts, approximate readability, answer blocks, claim alignment and actionable rewrites. AI-generated provenance cannot be inferred from style. Concerns are repetitive awareness-gap explanations, unsupported certainty and thin source-to-claim connections, regardless of production method.
- Applied: `seo-plan` with SaaS template: prioritize existing decision pages and context-specific routes to product over further mass publishing; measure organic trial starts as well as visits.
- Applied: `seo-competitor-pages`: affiliation disclosure, feature-vs-efficacy separation, source dates and a verified changed competitor price. No new comparison pages are required.
- Applied: `geo-brand-mentions`: sampled search plus Wikimedia APIs, with uncertainty stated. No invented presence/absence score or mention counts.
- Reviewed: `seo` and `geo` orchestrators and E-E-A-T reference. Unverified numerical claims in skill prose were not imported as evidence about Google's algorithm or AI-citation outcomes.
- Applied with limited inputs: `geo-compare`. The historical GSC baseline and action-status comparison are available; no second post-change GSC export or comparable previous scored audit exists, so traffic and score delta are **not measurable**. Do not use score changes as proof of business impact.
- N/A to this content subtask: technical crawler access, schema implementation, sitemap and image audits are owned by other agents. CRM prospect creation and sales proposals are not relevant to improving this owned product's organic traffic. No international/local intent was found in this content sample.

## Measurement plan

Export GSC query/page data for 28 days before and 28 days after deployment, with prior-period comparison and annotations for the 21 October changes. Track clicks, impressions, CTR and average position separately for the two historically exposed pages and the app roundup. Review queries by intent before interpreting a change. Track blog-to-comparison visits and organic trial starts using existing analytics only after confirming the available events; do not imply conversion data exists from this audit. Record AI-source citations only where they can be directly observed, keeping crawler access distinct from actual citations.
