# GEO citability audit for the 16 target pages, 2026-11-09 (P4, read-only)

Everything below was fetched or read on 2026-11-09 (about 17:30 UTC). Inference is marked **(inference)**. No repo file other
than this one was touched. Metadata (title, seoTitle, description) is frozen until 2026-11-24 (`docs/seo/title-ledger.md`);
every proposal below is body, structure, schema or robots only.

## Verdict in six lines

1. **No cloaking, nothing missing in raw HTML.** All 16 pages return 200 with identical bytes for GPTBot, OAI-SearchBot,
   PerplexityBot, ClaudeBot, Claude-SearchBot, Googlebot and a Chrome user agent (one MD5 per page; 30,305 to 44,039 bytes).
   Answer text, h1/h2s, byline, dates and JSON-LD are all in that HTML, and every paragraph in `/posts/<slug>.json` (what the
   client renders) appears in the server copy.
2. **The pages Google cites are not winning on passage structure, reviewer or citations. They win on domain.** The UCLA Health
   nail-biting article is dated 2022-09-02, bylined "uclahealth", lists no sources and never uses "cancer", "worm" or
   "toenail"; CHOP's polish page has no author, date or sources. Both appear as chips in the baseline. Caveat: the baseline
   records chip names from screenshots, not URLs, so the chip may point to a different UCLA page.
3. **Our pages already beat those two on sourcing** (primary studies linked per section, dated checks on 7 pages, visible
   byline and non-clinician disclosure). The real structural gaps are narrow (section 2).
4. **Perplexity's 2 of 17 does not show that lead structure predicts citation.** Cancer (122-word dated answer, per-section
   sources) and acrylics (37-word lead, no source, no date) are both cited; pinworm and self-harm have well-formed leads and are not.
5. **Expect little from copy alone.** Google says there are "no additional requirements to appear in AI Overviews" and no need
   for "AI text files, or markup". llms.txt and FAQPage have no Google effect; any value is for other engines **(inference)**.
6. **One robots.txt line can cost citation, in Gemini only:** `Google-Extended: Disallow: /` (section 4). AI Overviews are unaffected.

## 1. Raw-HTML check (curl, 7 user agents x 16 pages, 112 fetches)

- Same bytes for every agent. `Last-Modified` equals `dateModified` (cancer: Tue, 20 Oct 2026). All 16 are in sitemap.xml with
  `lastmod` equal to `dateModified`. `robots` meta is `index, follow, max-image-preview:large, max-snippet:-1` (no snippet limit).
- JSON-LD parses on every page: BlogPosting + BreadcrumbList on 16; MedicalCondition (a generic "Onychophagia" entity, gated by the
  repo's visible-text rule) on 7 (self-harm, pinworm, how-to, onychophagia, children, why, bitter); FAQPage on 2 (apps, how-to; all 7 answers
  appear verbatim in the visible text); HowTo on 1 (HRT guide); MedicalWebPage on none. `headline` equals the visible h1; dates equal the visible dates.
  No `citation`, `about` or `reviewedBy`. Person `sameAs` is GitHub only.
- **Server copy and client copy are not identical text** (not cloaking, same source): server writes "Published 2026-10-08 · Updated 2026-10-19"
  in ISO form with no `<time>`; `BlogPost.tsx` writes "Updated 19 October 2026" in a `<time>` and drops "Published" once the two dates differ. The
  client header also shows "A software developer who bit his nails for over 20 years, not a clinician."; the server `bylineHtml()` does not (it appears only in the author box at the end).
- `#ssr-page-content` is `display:none` once JS runs (`html.js`). A JS-executing fetcher therefore depends on one extra request,
  `/posts/<slug>.json`; if it fails the client shows its error state **(inference from `usePost.ts` and the CSS; not observed)**.

## 2. Per-page findings (lead = first paragraph under the first h2; "checks" = strings like "read 6 November 2026" in the body)

| Page | Lead words / named source / list in 1st section | Dated checks | Gap against cited pages | Body-only change |
|---|---|---|---|---|
| nail-biting-cancer | 122 / PubMed search, dated / yes | 1 | Verdict sentence comes last in the paragraph. Perplexity cites it first. | None. Keep as a control. |
| is-nail-biting-self-harm | 74 / TLC Foundation quoted / no | 1 | No dated check of the TLC page. SXO verdict was "nothing". | None now. |
| pinworm-nail-biting | 62 / Wendt 2019 / yes | 0 | Lead says "pinworms"; query says "worms"; Mayo/CDC-type pages hold the answer. | Dated CDC and NHS check (planned in top-20 doc); verify at source first. |
| swallowing-nail-polish-biting | 105 / Poison Control, CHOP / yes | 8 | CHOP and Poison Control open with severity plus action (call 1-800-222-1222, 911 if choking); ours puts the number in section 6 of 10. | Move severity and action into the lead. |
| swallowing-fingernails | 74 / none / no | 0 | "We could not find a study" with no search string, count or date; nailedapp.io outranks us. | Add the dated PubMed query and count, as the cancer page does, after re-running it. |
| nail-biting-toenails | 94 / Lee and Lipner 2022 / yes | 0 | First h2 is "How common is toenail biting?", not the query "do people bite their toenails". | Rename the first h2 to the query form. |
| acrylics-to-stop-nail-biting | 37 / none / no | 0 | Real answer lives only in the frozen description. Cited by Perplexity anyway. | None. Control page. |
| nail-biting-wearable-technology | 64 / none / no | 5 | First h2 is webcam vs wearable; the dated BiteLess and KeenLite answer (6 Nov) is section 2. NailGuard appears 0 times. | Lead with the smartwatch answer; add NailGuard only after checking its site. |
| best-apps-to-stop-nail-biting | 58 / none / no | 1 | Lead names no tool. Page names 2 of the 7 apps Perplexity lists (Unbite, NailKeeper). | Name the picks and the checked date in the lead. |
| how-to-stop-nail-biting | 37 / none / no | 0 | Lead says HRT has "the strongest evidence" with no trial named. | Add Twohig 2003 or Azrin 1980 with the caveats already in llms.txt. |
| habit-reversal-training-guide | 70 / trial year only / yes | 0 | "Landmark 1980 trial ... 99%" with no author; first section runs 379 words. | Put "(Azrin, Nunn and Frantz, 1980; self-recorded)" in that sentence. |
| onychophagia | 52 / none / no | 0 | Definition only; DermNet holds the AIO. | Add the classification source in the lead. |
| nail-biting-in-children | 96 / Lee and Lipner, Winebrake 2018 / yes | 0 | Strongest lead of the 16 after cancer. Institutions hold the SERP. | None. |
| why-do-people-bite-their-nails | 113 / Lee and Lipner 2022 / no | 1 | Fine. | None. |
| nail-biting-finger-tape | 118 / dated PubMed search / yes | 1 | Fine; metadata evaluation 11-27. | None. |
| bitter-nail-polish-review | 67 / none / no | 0 | Lead is mechanism (denatonium); the evidence answer (26% vs 12% drop-out) is in h2 two. | Lead with the evidence, then the mechanism. |

Totals: 8 of 16 leads name no source (fingernails, acrylics, wearable, apps, how-to, HRT, onychophagia, bitter); 9 of 16 have no dated check;
none has a consolidated Sources list (sources sit under each h2 as "Source for this section"). Speakable points at `.article-summary`, which is the frozen meta description, not an answer paragraph.

## 3. Comparison with pages the engines cited (all opened 2026-11-09)

| Page | Opens with | Named person | Visible date | Sources | Schema seen |
|---|---|---|---|---|---|
| UCLA Health, uclahealth.org/news/article/how-biting-your-nails-is-affecting-your-health | 3 plain sentences, then h2s and bullets | none (byline "uclahealth") | 2022-09-02 | none | microdata Person only |
| CHOP Poison Control, chop.edu/centers-programs/poison-control-center/nail-polish | "Quick take": Toxicity minimal to none; symptom upset stomach; 911 if choking | none | none (copyright only) | none | WebPage |
| Poison Control, poison.org/articles/nail-polish | "The bottom line", 3 sentences, then prevention bullets | Karen Crisostomo, BSN, RN (author, not reviewer) | JSON-LD only (published 2025-09-19, modified 2026-01-19) | about 9 references | Article, Person |
| Cleveland Clinic HRT, my.clevelandclinic.org/health/treatments/habit-reversal-training (via WebFetch, so a summary) | one-sentence definition under "Medically Reviewed. Last updated on 08/16/2024" | reviewer not named | visible | 3 references | not seen (403 to curl) |

**Shared:** an answer or definition in the first 25 to 60 words, often labeled ("Quick take", "The bottom line"); short sections; plain bullets; an
institutional domain. **Not shared:** a named clinician (0 of 4), a visible date (2 of 4), sources (2 of 4). **What ours lack:** the labeled
fact line at the top (CHOP, Poison Control), action and severity in the polish lead, and the query-form first h2 on toenails and wearable.

**What the missing clinician reviewer costs.** Google's helpful-content page asks that YMYL content be written or reviewed by someone who
"demonstrably knows the topic" (paraphrase; see section 7), so it is a standing quality gap on health pages. But UCLA and CHOP name nobody and are cited,
so the reviewer is not what separates us from the chips; their institutional brand stands in for it, and we have no equivalent **(inference)**. Honest substitutes, none
of which fully replaces a reviewer: claim-level primary sources (have), dated checks that name the query and result count (cancer page is the model), explicit negative
results (have), a visible non-clinician and paid-product line near the top (partly; section 5 item 4), in-page corrections (editorial policy says so). Owner-only: ask a named BFRB clinician to review one or two pages with consent, then add a "Reviewed by" line and `reviewedBy`. Not before.

## 4. Crawlers, robots.txt, llms.txt

- **Allowed (checked with Python `robotparser` on the live file):** Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User,
  PerplexityBot, Perplexity-User, plus unlisted Amazonbot, Applebot-Extended, CCBot, FacebookBot, Meta-ExternalAgent (they inherit `*`). **Blocked:** Google-Extended, Bytespider, cohere-ai, anthropic-ai.
  `Disallow: /api/` does not touch pages, `/posts/*.json` or `/llms*.txt`. No crawl-delay. One sitemap reference.
- **Google-Extended** (developers.google.com/search/docs/crawling-indexing/google-common-crawlers): "a standalone product token" to manage whether crawled content "may be used for
  training future generations of Gemini models"; it also covers grounding ("providing content from the Google Search index to the model at prompt time") in Gemini Apps and Grounding with Google Search on Vertex AI;
  "does not impact a site's inclusion in Google Search nor is it used as a ranking signal"; it has no separate user-agent string. So our `Disallow: /` opts the site out of Gemini-app answers, not out of AI Overviews or ranking.
  The comment in robots.txt says the same and is accurate. Owner decision: lifting it also permits Gemini training, which `ai-train=no` says we do not want.
- **OpenAI** (developers.openai.com/api/docs/bots): blocking OAI-SearchBot means "will not be shown in ChatGPT search answers"; GPTBot is for training and blocking it does not affect search. **Anthropic**
  (support.claude.com article 8896518): ClaudeBot is the training crawler; Claude-User and Claude-SearchBot serve answers; `anthropic-ai` is not among its three bots, so that block is inert. **Perplexity** (docs.perplexity.ai/guides/bots): PerplexityBot "is not used to crawl content for AI foundation models".
- **Inconsistency, not a citation cost:** GPTBot and ClaudeBot are allowed (the file comments call them search crawlers) while `Content-Signal` says `ai-train=no`. Per the vendor pages above, blocking either would not remove us from search answers. Owner decision.
- **Content-Signal** `search=yes, ai-input=yes, ai-train=no` sits only in the `*` group. Cloudflare's policy (blog.cloudflare.com/content-signals-policy) defines `search`, `ai-input`, `ai-train` and places the line in a User-agent group; an absent signal "neither grants nor restricts". Named groups (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot) have none, so under most-specific-group matching they may not see it **(inference; it is a preference, not enforcement)**. The task brief listed other key names; the file uses Cloudflare's three, which I could confirm.
- **llms.txt** is valid: H1, blockquote, H2 sections, `- [Title](url): description` lines, 220 links; all 16 targets present with the page description as the blurb (answer-first for cancer, self-harm, pinworm, polish, acrylics, tape; descriptive only for wearable, onychophagia). `/llms-full.txt` (1.37 MB, 211 articles) has every target with Published/Updated lines. By the rubric that is 90 to 100. Value is unproven: Google says it needs no such file, and I found no evidence that any engine reads it. Leave as is.

## 5. Proposals, ranked by expected value over effort (E = effort, V = value)

0. **Authority, not a copy edit (out of this lane).** Three referring domains, all to the home page; head-term SERPs are institutions. Every page-level change below is a long shot against that.
1. **Rewrite 8 leads and 3 first-h2s (E small, V medium).** Pages and gaps are in section 2. Where: first-section `body` in `src/data/blogPosts.ts` (not frozen). Pattern: 40 to 90 words, verdict first, source with year, one limit, date of check only if a check was run. Evidence: comparators open with 25 to 60 word answers (observed); a self-contained lead is what retrieval quotes **(inference)**. Check: new `scripts/leadAnswer.test.mjs` (first paragraph 40 to 170 words, not a question, contains `(Name, year)` or a dated check) for the 16 slugs; then grep the served HTML. Fails if: the 2026-11-24 and 2026-12-08 re-runs of the 20 queries show no new AIO chip for us and Perplexity stays at 2 of 17 or drops. Leave cancer and acrylics untouched as controls.
2. **Polish lead: severity and action first (E small, V medium).** Mirror CHOP and Poison Control: "minimal to none", upset stomach, 1-800-222-1222 (US), 911 if choking, each already in our body. The page ranks about 10th for a query where both are the cited side cards.
3. **Dated checks, only where a check is actually re-run (E small, V low to medium).** Pinworm (CDC, NHS), fingernails (PubMed string and count), toenails, self-harm. Never bump a date without a changed sentence: Google's helpful-content page warns against "changing the date of pages to make them seem fresh", and the editorial policy says dates come from a text fingerprint. Evidence is weak: the cancer page has one and is cited; acrylics has none and is cited.
4. **Fix server/client parity and add one trust line (E small, V low to medium, defect fix).** `server.js` `bylineHtml()` (about line 1081) and `blogArticleHtml()` (about 1024): wrap dates in `<time datetime>`, add the non-clinician sentence the client shows, add "Stop Biting is a paid product. How sources are checked: Editorial policy." Same line in `src/pages/BlogPost.tsx` header (lines 138 to 175). Evidence: Google's Who/How/Why guidance (documented). Check: extend `scripts/marketingSite.test.mjs` to assert equal text; `src/utils/serverSchema.test.ts` for the `<time>`. Fails if the strings differ.
5. **Robots hygiene (E small, V low for citation).** In `public/robots.txt` repeat the `Content-Signal` line in each named group; drop inert `anthropic-ai`; owner to decide Google-Extended and GPTBot/ClaudeBot. Check: `robotparser` run plus `scripts/llmsTxt.test.mjs`. No citation gain expected.
6. **"Short answer" block as a data field (E medium, V uncertain, do after the 11-24 read).** The lede is `post.description`, which is frozen, so editing it is not an option. Needs optional `shortAnswer` on `BlogPost` (`src/data/blogPosts.ts`, line 10), pass-through in the `posts[...]` map and llms-full builder of `scripts/generate-seo-content.mjs` (about lines 73 to 93, 300 to 320), `PostData` in `src/hooks/usePost.ts`, render in `BlogPost.tsx` under the lede and in `blogArticleHtml()`, and retarget `SCHEMA_SPEAKABLE` (server.js line 1288). It should replace the first paragraph of section 1, not repeat it. Evidence is only that two of four comparators label one. Fails if: SSR and client text differ, the speakable selector matches nothing, or the block repeats the description.
7. **Schema: add nothing.** No `MedicalWebPage` with `reviewedBy` or `lastReviewed` (there is no reviewer; it would assert what the page cannot show). No new FAQPage: Google's FAQ page says the feature "will no longer appear in Google Search starting May 7, 2026"; the 2 existing ones are harmless. A `citation` mirror has no evidence behind it.
8. **Measure.** Re-run `serp-baseline.md` on 2026-11-24 and 2026-12-08 unchanged. Add, if available, GA4 sessions by source for chatgpt.com, perplexity.ai and gemini.google.com, and per-page hits from OAI-SearchBot, PerplexityBot and Claude-SearchBot (I did not check whether the host keeps access logs). Volume is 13.2K impressions in 28 days, so only large moves are readable. Stop rule: if 12-08 shows nothing, treat the lever as authority and stop editing copy for citation.

## 6. Could not verify

- Mayo, Cleveland Clinic's other pages and HealthTap returned 403 to curl or WebFetch; Mayo and HealthTap were not opened, and Cleveland's page was read through a summarizing fetch, so its reviewer name and schema are unconfirmed. I did not retry with a spoofed user agent on third-party sites.
- The AIO chips in `serp-baseline.md` are partial screenshot reads with no URLs. I did not re-query Google AI Overviews, ChatGPT search, Gemini, Copilot or Claude web search.
- contentsignals.org returned a bare heading (JavaScript); the Content-Signal meaning is from Cloudflare's blog. The IETF draft was not read. Google's doc pages show no last-updated date.
- Whether speakable has any effect on AI Overviews: not verified; Google's AI features page does not mention it.
- Brand mentions (Wikipedia, Reddit, YouTube, LinkedIn) were not scanned; this run did not cover them.
- A search tool in this session, scoped to our domain, retrieved our toenail page and called its source "a nail-biting app company, so treat it as secondary". That is one sample from a tool, not a production engine, and no conclusion above uses it.

## 7. URLs opened on 2026-11-09

Ours: stopbiting.today/robots.txt, /llms.txt, /llms-full.txt, /sitemap.xml, the 16 `/blog/<slug>` pages, their `/posts/<slug>.json`, `/og/nail-biting-cancer.png`.
Others: uclahealth.org (article above), chop.edu and poison.org (pages above), my.clevelandclinic.org (HRT page, via WebFetch),
developers.google.com/search/docs/crawling-indexing/google-common-crawlers, .../appearance/ai-features, .../appearance/structured-data/faqpage,
.../fundamentals/creating-helpful-content, developers.openai.com/api/docs/bots, docs.perplexity.ai/guides/bots,
support.claude.com/en/articles/8896518 (search summary), blog.cloudflare.com/content-signals-policy.
