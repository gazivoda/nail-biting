# Stop Biting: SEO and GEO traffic review

23 October 2026 · https://stopbiting.today/ · SaaS with an educational publisher section

## Decision

Improve the pages that already receive search exposure, preserve accurate page metadata on repeat visits, and make the product's claims easier to verify. The site already has 188 articles, topic hubs, source citations, an author page, crawlable content, comparison pages, a sitemap, robots rules and generated LLM indexes. Adding another large content batch would repeat work without evidence that volume is the constraint.

The audit used three independent specialists: technical SEO and browser delivery; content and search intent; and AI discovery and structured data. The implementation started from deployed branch origin/main at 0071bb4 in an isolated worktree. The original checkout's unfinished billing merge and unpublished application changes were preserved.

## Traffic baseline and interpretation

The existing October 20 plan records Search Console data for July 18–October 17: 110 clicks, 11,800 impressions, 0.9% CTR and average position 13.8. The nail-growth article had 611 impressions and 2 clicks; the deficiency article had 944 impressions and 11 clicks. These historical figures identify pages worth improving. They are not a current analytics export or evidence of an uplift from this work.

Several titles changed on October 21. Their observation window is too short to justify another round of title changes. This pass keeps the existing SEO titles and URLs, corrects contradictory body copy and improves decision usefulness instead. It does not forecast traffic or revenue.

## Implemented improvements

### Route-specific metadata for returning visitors

The live service worker used the cached homepage shell for every public navigation. In an isolated browser, a visitor could open pricing or the blog and see that page's interface with the homepage title, canonical, description and structured data. First network visits had correct metadata, so raw HTML checks alone missed the bug.

The fallback is now limited to the root app entry, including campaign query strings. Blog, comparison, tool, pricing, legal, unknown and API URLs reach their own server responses. This preserves existing offline root behavior without adding a cache of potentially authenticated HTML. Twenty-four tests exercise the real Workbox navigation matcher with the actual VitePWA build options.

This is a demonstrated delivery and metadata consistency fix. It is not proof that Google previously indexed the wrong canonical; Search Console's selected canonical and URL Inspection remain the appropriate checks for that question.

### Five existing articles improved

- **Nail growth:** removed unmeasured week-by-week recovery and relapse promises. Growth-rate arithmetic is distinguished from healing, and gentle care replaces claims that oils or supplements accelerate recovery. The existing calculator provides a relevant next step.
- **Vitamin deficiency:** gives a direct, respectful answer without claiming that an entire literature proves a negative. Nail biting alone cannot identify a deficiency; the cited studies' limitations remain visible.
- **Apps and tools:** replaces unsupported efficacy rankings and habituation claims with practical feature/context comparisons. The author's commercial relationship remains explicit. Nailed's current free price was checked against its official website and linked App Store listing.
- **BFRB guide:** breaks up long clinical sentences and separates findings for different behaviours and trial populations.
- **Detection accuracy:** removes unsupported awareness/accuracy estimates and clarifies that hand-to-mouth proximity can generate false positives and misses. Sensitivity descriptions are checked against the existing detector settings.

Only changed articles receive October 23 modification dates. Original publication dates, slugs and SEO titles remain stable. The generated article index, sitemap and LLM descriptions must be synchronized with the final text.

Nine social preview cards were regenerated to match their current title and reading time. Three needed updates because of this content pass; six were already stale from prior changes. The remaining 202 cards are byte-identical. All 211 generated cards pass the repository's freshness check.

### Clearer author and article identities

Person markup now identifies Igor's verified GitHub profile rather than treating a product source repository as a person. BlogPosting and comparison Article entities use distinct `#article` identifiers; their canonical page URLs and `mainEntityOfPage` stay at the normal URL. The blog collection references those same article identifiers. Six real HTTP regression checks cover the author, blog article, comparison and collection responses.

This corrects the entity graph. It is not a promise of a ranking change or a rich result.

### Useful source repository documentation

The default Vite README is replaced with a factual product description, author attribution, canonical product/resource links, limitations and development commands. This makes the owned repository understandable to visitors and systems that discover it. It does not create independent third-party authority.

## Verified existing foundations

The technical sample covered 22 canonical pages, including 10 of the 188 articles. All returned HTTP 200, one expected canonical and H1, no unintended noindex, substantial text before JavaScript and parseable JSON-LD. The sitemap has 219 unique page URLs. All 188 articles are linked in the initial blog HTML; there is no missing pagination to implement. Ten sampled article bodies contained roughly 1,012–2,111 words, excluding site chrome.

At 390 pixels wide, sampled homepage, blog and comparison layouts fit the viewport. The comparison table scrolls within its container. Sampled images are already compressed WebP with appropriate dimensions, so this audit does not replace them without a measured need. Field LCP, INP and CLS remain unknown: the PageSpeed API returned 429 and an unthrottled cached browser visit is not a substitute for field data.

Search and user agents for ChatGPT, Claude and Perplexity can access public pages under the current robots rules. Googlebot and Bingbot are allowed. Google-Extended and selected training agents remain intentionally blocked; this pass preserves those preferences. Robots permission is not proof that requests from vendors' actual IP ranges bypass every network control.

`llms.txt` and `llms-full.txt` already return HTTP 200 and are generated from site content. The index has 218 links and the sitemap 219 page URLs; selected legal boilerplate is intentionally absent from the LLM index. These files are optional discovery aids. Google says no special AI files or schema are required for AI Search features, and llms.txt is not a Google ranking signal. See [Google's AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) and [documentation updates](https://developers.google.com/search/updates).

Existing FAQ and HowTo data must match visible content, but do not promise Google FAQ/HowTo rich results. SoftwareApplication markup is not eligible for Google's app rich result without a genuine review or aggregate rating. No ratings are invented to satisfy eligibility. See [Google's software app requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app).

## Remaining actions, in priority order

1. **Repair www at the hosting layer.** `https://www.stopbiting.today/` presents a self-signed Traefik default certificate and HTTP 503. Provision a valid certificate for www, add its router in Coolify/Traefik, and permanently redirect to the apex while preserving paths and queries. Verify without disabling certificate checks. A Node redirect cannot repair a TLS handshake or unmatched proxy router. The apex works; this is not evidence that all indexed URLs fail.
2. **Use a permanent HTTP redirect.** The live proxy sends HTTP-to-HTTPS 302 before the application's 301 middleware. Change it to a permanent redirect in the proxy. Verify both hostnames with a nested route and query, checking each response location and hop count.
3. **Measure before expanding content.** Use the 28-day comparison below. Prioritize pages with meaningful impressions and relevant intent rather than creating near-duplicate platform pages or more articles simply to raise a page count.
4. **Build verifiable independent authority.** Sampled exact-domain searches did not establish independent Reddit, YouTube, LinkedIn, Wikipedia or industry mentions. That is a search-sample limitation, not proof of universal absence. An actual product demo, useful listings and voluntary user accounts can help people evaluate the product. No outreach, submissions to communities, paid links, Wikipedia self-promotion or invented profiles were performed.
5. **Review privately measured indexing and conversions.** Confirm GSC selected canonicals, exclusions and page/query performance; verify Bing Webmaster coverage. The existing IndexNow script should run only after deployment and should submit changed URLs. An accepted submission is a notification, not an indexing or traffic guarantee.

Hosting changes remain outside this code commit: no connected Coolify credentials or hosting management capability was provided. Public reads do not authorize inventing or editing server credentials.

## Measurement plan

Record the actual deployment date, then export 28 complete days before and 28 complete days after deployment from Search Console. Annotate the October 21 changes separately. Compare clicks, impressions, CTR and position for the growth, deficiency and apps pages, then check which queries changed. Separate country/device changes before interpreting aggregate CTR.

Use existing analytics to compare organic visits to guides, guide-to-product or comparison navigation, and completed trial starts where those events are confirmed available. A traffic increase with no relevant product engagement is not automatically a success. Do not report a conversion rate without its numerator, denominator and event definition.

For AI referrals, record the actual source/referrer and directly observed citations with their date/query where possible. Crawler access, an optional text file and an editorial passage score do not measure citation frequency. Compare comparable periods; no post-change AI citation or traffic lift has been measured in this session.

## All-skill coverage

All 27 installed SEO/GEO skills were reviewed and applied to their relevant scope:

- `seo`, `seo-audit`: live discovery, three-agent orchestration, weighted categories reviewed, consolidated findings. A composite score is withheld because field performance and private indexing inputs are unknown.
- `seo-page`, `seo-technical`: response/head/content checks, redirects, raw/rendered parity, statuses, security, mobile and service-worker behavior.
- `seo-images`: image format, transfer size, dimensions and above-fold/lazy-loading review; no measured image problem warrants a rewrite.
- `seo-sitemap`: 219 unique canonical URLs, modification dates, route coverage and sampled successful responses.
- `seo-content`: existing high-impression pages, source-to-claim accuracy, readable answers, author transparency and comparative claims.
- `seo-plan`: SaaS priorities tied to qualified traffic, historical exposure and a measurement window.
- `seo-programmatic`: quality and duplication checks across the generated 188-article corpus and solution routes; no mass template expansion.
- `seo-competitor-pages`: disclosure, vendor facts, source dates and feature-versus-efficacy distinction.
- `seo-schema`: parseable raw JSON-LD, identity consistency and rich-result limitations.
- `seo-hreflang`: reviewed; not applicable because the current site has one English version and no translated regional equivalents. No invented language URLs.
- `geo`, `geo-audit`, `geo-technical`: AI discovery and technical infrastructure checked alongside ordinary search; crawlable text already present.
- `geo-crawlers`: actual robots groups, training-versus-search distinctions and preserved owner preferences.
- `geo-llmstxt`: both files, status, format, link coverage, factual content and synchronization reviewed.
- `geo-citability`, `geo-content`: direct answers, passage independence, sourcing, readability and transparent limits; five pages improved.
- `geo-brand-mentions`: sampled branded searches and verified founder/source links, with search limits recorded.
- `geo-platform-optimizer`: Google/AIO, ChatGPT, Claude, Perplexity, Gemini and Bing/Copilot access and evidence gaps; no fabricated platform percentages.
- `geo-schema`: author/article identities fixed, verified visible/schema alignment, no invented testimonials or reviewer credentials.
- `geo-compare`: compared historical evidence and completion status; no comparable second traffic export or reliable outcome delta available.
- `geo-report`, `geo-report-pdf`: this consolidated report and printable PDF, plus specialist evidence. The PDF omits speculative score gauges and revenue forecasts because the required measurements are unavailable.
- `geo-proposal`, `geo-prospect`: reviewed; not applicable to improving the owner's own product. No agency proposal, invented fees or CRM records created.

Superpowers used: skill discovery, brainstorming/scope assessment, planning, isolated worktree, parallel specialists, systematic debugging, regression tests, independent review, verification before completion and branch finishing. The user's instruction already authorizes implementation, commit and push; routine workflow menus do not require another approval round.

## Verification record

Baseline: 119/119 tests passed before implementation. The navigation regression failed on 16 public routes before the fix; all 24 cases pass afterward. All six schema checks failed for the intended old identities and pass after the fix. The final combined suite, web build, artifact checks, HTTP sweep, browser checks, review and remote push results are recorded in VERIFICATION.md beside this report.

No current Search Console export, search-engine selected-canonical results, reliable field CWV, clinical efficacy study or measured traffic uplift is claimed.

## Evidence and primary sources

See technical-audit.md, content-audit.md and geo-schema-audit.md for sampling, source details and specialist observations. Their editorial scores are qualitative rubrics, not rankings, measured AI visibility or comparable business outcomes.

- [Nail growth study, 22 healthy young adults](https://pubmed.ncbi.nlm.nih.gov/19744178/)
- [American Academy of Dermatology nail-care guidance](https://www.aad.org/public/everyday-care/nail-care-secrets/basics/healthy-nail-tips)
- [HRT trial, not an app trial](https://pubmed.ncbi.nlm.nih.gov/12590622/)
- [Nailed official product information](https://nailedapp.io/)
- [Nailed App Store listing](https://apps.apple.com/us/app/nailed-quit-nail-biting/id6761733224?mt=12)
- [Schema.org sameAs](https://schema.org/sameAs) and [mainEntityOfPage](https://schema.org/mainEntityOfPage)
- [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
