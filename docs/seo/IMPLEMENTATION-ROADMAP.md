# SEO Implementation Roadmap — Stop Biting

> Last updated: 2026-04-28

---

## Phase 1 — Technical Foundation (Weeks 1–4)

**Goal:** Fix all crawlability and indexability issues. Google can't rank what it can't read.

### Week 1 — Sitemap & Indexability

- [ ] **Fix sitemap.xml** — add all 20+ missing blog posts, fix `onychophagia-ocd-connection` → `nail-biting-ocd-connection` slug
- [ ] **Update llms.txt** — add all 40 blog posts with one-line descriptions
- [ ] **Verify server-side meta tags** — ensure title and description are SSR'd for `/blog/:slug` routes (already partially done in server.js — audit and complete)
- [ ] **Submit sitemap to Google Search Console** — request indexing for all new URLs
- [ ] **Submit to Bing Webmaster Tools** — IndexNow protocol for faster indexing

### Week 2 — Schema Markup

- [ ] **Add Article schema to blog posts** — inject server-side for each blog post (author, datePublished, dateModified, headline, image, publisher)
- [ ] **Add BreadcrumbList schema** — `Home > Blog > [Post Title]` on all blog pages
- [ ] **Add Person schema** — for author bio (link to About page and LinkedIn)
- [ ] **Verify existing homepage schemas** — FAQPage, SoftwareApplication, Organization, MedicalCondition all working correctly

### Week 3 — About Page & E-E-A-T

- [ ] **Create `/about` page** — founder story with personal nail biting narrative (Experience signal), product origin, privacy commitment, credentials
- [ ] **Add author byline to all blog posts** — name, bio snippet, link to About page
- [ ] **Add "Last reviewed" date** visible on each blog post
- [ ] **Add to server.js routes** — ensure `/about` has SSR'd meta title/description

### Week 4 — Internal Linking

- [ ] **Create 5 pillar/hub pages** — see Site Structure doc for content
- [ ] **Add 3–5 internal links per blog post** — link to related posts and relevant pillar page
- [ ] **Add "Related posts" section** to blog post template
- [ ] **Link from homepage** to top 3–4 blog posts

---

## Phase 2 — Content Expansion (Weeks 5–12)

**Goal:** Fill remaining keyword gaps and build topical authority in each pillar.

### Priority New Content

In order of search volume and strategic value:

| Post | Target Keyword | Est. Volume | Priority |
|------|---------------|------------|---------|
| `/blog/nail-biting-guide` (pillar) | nail biting guide | hub | P1 |
| `/blog/how-to-stop-nail-biting` (pillar) | how to stop nail biting | 27K | P1 |
| `/blog/nail-biting-in-adults` | nail biting adults | 3K | P1 |
| `/blog/onychophagia` | onychophagia | 4.4K | P1 |
| `/blog/nail-biting-and-depression` | nail biting depression | 1.8K | P2 |
| `/blog/how-to-grow-nails-fast` | grow nails after biting | 2.4K | P2 |
| `/blog/nail-biting-worms` | can nail biting cause worms | 1.2K | P2 |
| `/blog/nail-biting-quiz` | nail biting severity quiz | tool | P2 |
| `/blog/nail-biting-toddler` | toddler nail biting | 2.1K | P3 |
| `/blog/nail-biting-during-test-exam` | nail biting during exams | 900 | P3 |
| `/blog/nail-biting-and-gut-health` | nail biting gut health bacteria | 1.1K | P3 |
| `/blog/stop-nail-biting-challenge` | 30 day nail biting challenge | 800 | P3 |

### Content Upgrades (Existing Posts)

- [ ] Add "What is [X]?" definition block in first 60 words of each post (GEO optimization)
- [ ] Add a "Key takeaways" summary box at top of each post
- [ ] Add 2–3 research citations visible in text (link to PubMed/PMC) for top 10 posts
- [ ] Update `dateModified` on all April 3 posts to 2026-05-xx after updates

### Community Content

- [ ] Post original content on r/nailbiting — introduce Stop Biting authentically, reference blog
- [ ] Post on r/ADHD about nail biting + ADHD connection (link to `/blog/nail-biting-adhd`)
- [ ] Post on r/BFRBs about the AI detection approach
- [ ] Create Product Hunt listing for Stop Biting

---

## Phase 3 — Authority Building (Weeks 13–24)

**Goal:** Build backlinks and brand mentions that lift domain authority and AI citations.

### Link Building Targets

**Tier 1 — Editorially earned (highest value)**
- [ ] TLC Foundation for BFRBs (bfrb.org) — submit for directory/resource listing
- [ ] Psychology Today — pitch guest post: "A New Technology Approach to BFRB Awareness Training"
- [ ] ADDitude Magazine — pitch article about ADHD and nail biting with Stop Biting as a tool
- [ ] Healthline / Medical News Today — pitch correction/addition to their nail biting articles

**Tier 2 — Listing/citation sites**
- [ ] AlternativeTo.net — add Stop Biting as an alternative to Hands Off and vice versa
- [ ] GetApp / Capterra / G2 — add SaaS listing
- [ ] Crunchbase — company profile
- [ ] Product Hunt — dedicated launch

**Tier 3 — Press/media**
- [ ] Write "original research" post using anonymized Stop Biting detection data
- [ ] Pitch data story to tech/health journalists: "We analyzed 10K nail biting sessions — here's what triggers them most"
- [ ] HARO (Help A Reporter Out) — respond to nail biting, habit, and BFRB queries

### Wikipedia Strategy
- [ ] Expand the Onychophagia Wikipedia article — add missing clinical sections, properly cite sources
- [ ] Add Stop Biting as an external resource (requires editorial consensus, approach carefully)
- [ ] Ensure key statistics cited in Stop Biting blog posts are verifiable on Wikipedia or primary sources

---

## Phase 4 — Scale & Dominance (Months 7–12)

**Goal:** Reach top 3 for core nail biting queries. Become the default AI citation source for onychophagia.

### Content at Scale
- [ ] Publish 2 new blog posts per month (focused on remaining keyword gaps)
- [ ] Create 3–5 original research pieces using app data (with proper privacy treatment)
- [ ] Commission or record video content for top 5 posts (YouTube = strong GEO citation signal)

### AI Search Optimization
- [ ] Submit to AI reference databases where applicable
- [ ] Ensure all posts have 134–167 word self-contained citability blocks
- [ ] Add structured data for statistics (specific numbers that AI cites)
- [ ] Build `sameAs` entity links: LinkedIn, GitHub, ProductHunt, Reddit

### Revenue Alignment
- [ ] A/B test blog-to-trial CTA placement
- [ ] Add exit-intent CTA for visitors spending 2+ minutes on blog
- [ ] Create "Start Here" page for new visitors from organic search

---

## Success Checkpoints

| Checkpoint | Date | Target |
|-----------|------|--------|
| All blog posts indexed | May 2026 | Google Search Console: 45+ indexed |
| First top-10 ranking | June 2026 | At least 5 long-tail keywords |
| 1,000 organic monthly visits | July 2026 | GA4 organic channel |
| DR 10+ | August 2026 | Ahrefs/Moz |
| First AI citation | June 2026 | ChatGPT/Perplexity returns stopbiting.today |
| 5,000 organic monthly visits | October 2026 | GA4 organic channel |
| Top 10 for "nail biting app" | November 2026 | Google SERP |
| Top 5 for "how to stop nail biting" | March 2027 | Google SERP |
