# GEO and structured data evidence — Stop Biting

Audited 23 October 2026. Live public pages checked: homepage, /how-it-works, /pricing, /about, /blog/nail-biting-detection-accuracy and /compare/ai-detection-apps. Site discovery files: /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt. Source reviewed from origin/main without modifying the active merge workspace.

## Decision

The site already has substantial crawler infrastructure: useful HTML before JavaScript, answer paragraphs, comparison tables, visible author attribution, current prices, shared entity identifiers, route-specific JSON-LD, XML sitemap and two generated LLM files. Another generic robots/FAQ/llms implementation would duplicate existing work. The stronger opportunities are fixing inaccurate product/health claims, qualifying desktop users before a trial, and earning independently verifiable product mentions. Search performance and AI citation frequency were not measured; Search Console, Bing Webmaster Tools, server crawl logs and conversion analytics were unavailable to this worker.

## Findings that can ship

1. **Medium: Person identity links point to source code.** `server.js` SCHEMA_AUTHOR and /about Person use `sameAs: [https://github.com/gazivoda/nail-biting]`. That page is a source repository, not Igor's personal profile. The same repository is used as Organization identity in index.html. The repository and https://github.com/gazivoda both returned HTTP 200; the latter identifies Igor and gazivoda. Replace Person sameAs with the verified personal profile. Prefer describing the repository as a SoftwareSourceCode subject of the product, with `codeRepository`, rather than declaring the organization identical to a repository. Do not invent LinkedIn/Wikipedia profiles to increase a count. Schema.org's definition requires the destination to unambiguously identify the item: https://schema.org/sameAs.

2. **Medium: articles and their pages share one identifier.** BlogPosting and comparison Article use `@id: canonical` and `mainEntityOfPage: { @type: WebPage, @id: canonical }`. This merges the article and page and creates a self-reference. Use `${canonical}#article` for Article/BlogPosting, keep `url` and mainEntityOfPage at canonical, and update /blog CollectionPage.hasPart stubs to the same #article identifiers. This is graph clarity, not a demonstrated ranking defect. Schema reference: https://schema.org/mainEntityOfPage.

3. **High: product accuracy copy has unsupported efficacy statements.** Live /blog/nail-biting-detection-accuracy says unassisted biters notice well under half of episodes and implies the detector catches most episodes. No measured sensitivity/precision study is provided. Replace estimates with a clear description of the actual hand-to-mouth proxy and known false positives/misses. The same page's explanation of high and low sensitivity should be checked against the actual thresholds. Content specialist has been notified.

4. **Low: SoftwareApplication screenshot is missing despite genuine captures now existing.** The index.html comment says no real screenshot exists, but the live homepage shows /shots/app-watch-1280.webp with explicit example data. It can be added as an optional screenshot ImageObject and the obsolete comment removed, if the capture's representation is kept truthful. This does not establish eligibility for Google's app rich result.

## Existing strengths

- All six HTML responses contained parseable JSON-LD in the original HTTP response, not only after React executed.
- Homepage: WebSite, Organization, SoftwareApplication, FAQPage, narrowly scoped MedicalCondition, WebPage and BreadcrumbList.
- How-it-works: WebSite, Organization, SoftwareApplication, HowTo, FAQPage and BreadcrumbList.
- Pricing: shared site/org/app nodes plus WebPage, FAQPage and BreadcrumbList. Monthly $2.99/P1M, yearly $29/P1Y and three-day free trial are represented separately.
- About: AboutPage and Person with visible founder account and transparent developer credentials.
- Blog: BlogPosting with headline matching the visible article, author, publisher, images, dates, reading time and breadcrumb. Comparison: Article, ItemList and visible Q&A-derived FAQPage.
- No invented ratings, addresses, professional qualifications, founding dates or phone numbers were detected in the sampled markup. Optional missing data should remain omitted when unverifiable.
- Homepage's 11 marked-up FAQ answers are emitted from the same data source as the server-rendered FAQ, limiting markup/copy drift.

## Crawler access

The site's user-agent groups permit public pages while disallowing /api/. For agents without a specific group, the wildcard group permits public pages and restricts /api/. No crawl-delay was found, and the sitemap URL is declared.

| Crawler | Effective public-page access | Notes |
|---|---|---|
| OAI-SearchBot | Allowed | Search agent; /api/ restricted |
| ChatGPT-User | Allowed | User-requested fetcher; /api/ restricted |
| GPTBot | Allowed | Training crawler, separate from ChatGPT search |
| Claude-SearchBot | Allowed | Anthropic search agent; /api/ restricted |
| Claude-User | Allowed | Anthropic user-requested fetcher; /api/ restricted |
| ClaudeBot | Allowed | Anthropic training crawler; /api/ restricted |
| PerplexityBot | Allowed | Search crawler; /api/ restricted |
| Googlebot, Bingbot | Allowed by wildcard | /api/ restricted |
| Amazonbot, Applebot-Extended, FacebookBot, CCBot | Allowed by wildcard | Not specifically named; /api/ restricted |
| Google-Extended | Blocked intentionally | Gemini Apps/Vertex training AND grounding; does not affect Google Search/AIO |
| Bytespider, cohere-ai, anthropic-ai | Blocked intentionally | Existing training policy |

The Content-Signal extension says search=yes, ai-input=yes, ai-train=no. Its semantics are distinct from standard robots permissions. Do not change the training policy as a routine SEO fix. No access was tested from the vendors' actual IP ranges, so robots permission is not proof against CDN/WAF blocking. Standard Python urllib.robotparser returned incorrect /api/ results because it selected the first matching Allow rule; the table uses longest matching path semantics instead.

Current primary reference for Anthropic's separate bots: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler. Google-Extended training/grounding scope: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended.

## llms.txt

- /llms.txt: HTTP 200, text/plain; 52,287 bytes, 281 lines, 218 Markdown entries. Proper H1, blockquote, H2-organized linked content with descriptions. Covers primary product pages, tools, about/editorial/privacy pages, comparisons, solutions and blog topics. Its descriptions are derived by scripts/sync-seo.mjs.
- /llms-full.txt: HTTP 200, text/plain; 1,336,742 bytes. Generated at build from the same site content. Links to canonical pages and includes editorial limitations.
- Sitemap: 219 canonical page URLs. The LLM index intentionally omits terms/refund legal boilerplate; the full-content artifact is an extra linked resource.
- No replacement file is needed. A future optional improvement is a smaller curated index and links from page HTML/headers to llms.txt, as proposed in llms.txt v2. This is lower priority than accurate, useful public pages.
- This is an optional agent convention, not a Google ranking factor. The current proposal: https://llmstxt.org/. Google's 15 June 2026 note explicitly says llms.txt is not needed and does not positively or negatively affect Google Search visibility/rankings: https://developers.google.com/search/updates.

## Brand mention evidence

Business name as printed on site: Stop Biting. Disambiguation used founder Igor Gazivoda and domain stopbiting.today because generic stop-biting searches refer to many unrelated products.

| Platform | Result of sampled checks | Limit |
|---|---|---|
| Wikipedia | No entity article found | API queries for quoted brand + nail app and exact domain both returned empty results; /wiki/Stop_Biting returned 404 |
| Reddit | No independently verified product discussion found | Exact-domain site-restricted searches returned no matching brand evidence; generic nail-biting discussion is not a brand mention |
| YouTube | No independently verified official/product video found | Existing on-site promotional video does not establish YouTube presence |
| LinkedIn | No verified company page found | Search results with coincidental words/first names were excluded |
| Industry/review/news sites | No independently verified mention found | Exact-domain search excluding own site returned empty results |
| GitHub | Owned source repository and founder profile found | Both resolve HTTP 200; not independent validation or a customer review |

No meaningful independent sentiment, engagement, video count or recency can be reported from these results. No claim is made that the product is absent from all platforms or unknown to any model. Do not create a Wikipedia article absent independently established notability. Focus on a genuine demo, useful relevant directory listings and voluntary customer accounts; off-site publication requires separate user authorization.

## Heuristic scoring, with limits

The machine-readable block appendix is /tmp/sbt-geo-citability.json. It scores 23 actual homepage SSR prose/list blocks across answer quality 25%, self-containment 20%, structure 20%, specific numbers 20%, uniqueness 15%. Headings/navigation were excluded; the requirements list was treated as one block. These are editorial judgments, not measured citation probabilities.

Top five: pricing/trial/refund summary 83.5; card/cancellation FAQ 81.75; live-demo instructions 81.25; product standfirst 81.0; what-the-app-is FAQ 79.0. Page score = 81.3. No substantive block scored below 30; none is fabricated to populate an output heading. Accuracy/sourcing concerns remain separate: a structurally extractable statement can still be unsupported.

Using the requested visibility formula only: citability 81.3, observed-brand-sample score 0, crawler access 85, llms files 90 gives 58.7/100. The crawler formula's three five-point deductions concern intentional Google-Extended/Bytespider/cohere policies and should not be called accidental search blockers. Brand 0 means no independently verified mentions in the sample, not proof of universal absence. This composite is a rubric-based readiness indicator, not observed AI traffic, model awareness, Google score, or business value.

Platform readiness is best reported as evidence and gaps, rather than inventing platform percentages: Google/AIO has crawlable text and matching schema but actual index/rank coverage requires Search Console; ChatGPT/Claude/Perplexity search bots are allowed but actual citations were not tested; Gemini grounding is opted out through Google-Extended; Bing/Copilot verification and index coverage require Bing Webmaster Tools. Product is not a local business or merchant catalog, so Business Profile, Bing Places, Merchant Center and fabricated physical-address schema are N/A.

## Current guidance overrides stale skill claims

- FAQ rich results ended 7 May 2026, not merely restricted to authority government/health pages. Google removed the FAQ feature documentation on 15 June: https://developers.google.com/search/updates. Existing valid FAQPage may remain as matching semantic data; no rich-result promise.
- HowTo's Google rich result was retired; HowTo remains a Schema.org type. Existing matching steps are not a syntax error, but adding it is not a rich-result strategy.
- Google removed the sitelinks search box in November 2024. No SearchAction should be invented on a site without a search endpoint: https://developers.google.com/search/blog/2024/10/sitelinks-search-box.
- Speakable remains a limited Google Assistant news/TTS beta, not a universal AI citation factor: https://developers.google.com/search/docs/appearance/structured-data/speakable.
- The SoftwareApplication object lacks review/aggregateRating, so it does not meet Google's software app rich-result requirements. That is preferable to manufactured reviews: https://developers.google.com/search/docs/appearance/structured-data/software-app.
- Google says no special AI files or schema are required for AIO/AI Mode; conventional crawling, textual content, links and accurate visible markup matter: https://developers.google.com/search/docs/appearance/ai-features.
- No minimum 2,000-word page length, specific Wikipedia/Reddit citation percentage, predicted traffic multiplier or guaranteed ROI from the skill text has been used as a verified fact.

## Skill coverage and applicability

Applied: geo (discovery and evidence-first scope); geo-audit (delegated audit contribution, root owns orchestration); geo-crawlers (effective rules plus current vendor distinctions); geo-llmstxt (both files, format, coverage, source synchronization); geo-platform-optimizer (per-platform evidence/gaps; unavailable private metrics explicitly unknown); geo-schema and seo-schema (raw JSON-LD, properties, identity consistency and Google eligibility).

Reviewed and passed deliverable requirements to root: geo-report and geo-report-pdf. Root should generate one consolidated Markdown report and PDF with this evidence, unknowns and realistic actions, without fabricated traffic/revenue forecasts. Correct PDF crawler labels to Anthropic/Claude rather than the skill template's incorrect Codex label. The generator script actually exists at /Users/igorgazivoda/.agents/skills/geo/scripts/generate_pdf_report.py.

Reviewed but N/A: geo-proposal (no agency engagement, approved scope/fees or revenue baseline; do not invent a paid proposal), geo-prospect (owner's product optimization, no CRM enrollment requested; do not write ~/.geo-prospects). No messages were sent externally and no account resources were modified.
