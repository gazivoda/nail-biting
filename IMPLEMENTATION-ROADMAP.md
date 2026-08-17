# Implementation Roadmap: stopbiting.today

**Generated:** 2026-05-13  
**Target:** SEO score 78/100 in 12 months  
**Current score:** 53/100  
**Stack:** Vite + React SPA, Express SSR, Render/Vercel hosting

---

## Phase 1 — Foundation (Weeks 1–4: May 2026)

**Goal:** Eliminate all critical technical blockers and establish E-E-A-T baseline  
**Target score after phase:** 60/100

### Week 1: Hosting & Technical Fixes

#### 1.1 Fix www subdomain 503 → 301 *(Hosting config, ~30 min)*
- [ ] Go to hosting provider (Render/Vercel/Netlify)
- [ ] Add redirect rule: `www.stopbiting.today → https://stopbiting.today` (301 permanent)
- [ ] Verify: `curl -I https://www.stopbiting.today` shows `301` with `Location: https://stopbiting.today`

#### 1.2 Fix HTTP→HTTPS 307 → 301 *(Hosting config, ~30 min)*
- [ ] Change redirect type from 307 Temporary to 301 Permanent
- [ ] Verify: `curl -I http://stopbiting.today` shows `301`

#### 1.3 Unblock CCBot in robots.txt *(Code, ~15 min)*
- [ ] Remove `User-agent: CCBot / Disallow: /` from robots.txt
- [ ] This allows Common Crawl indexing → training corpus for open-weight AI models
- [ ] All blog content is public already; no data protection concern

### Week 2: E-E-A-T Foundation

#### 2.1 Create real /about page *(React component, ~4 hours)*
- [ ] Create `src/pages/About.tsx` with: founder name, photo, personal story, credentials
- [ ] Personal story: X years of nail biting, what you tried, why you built this
- [ ] Add Person JSON-LD schema injection in server.js /about route
- [ ] Verify: `/about` returns 200 with unique title, description, canonical, Person schema

#### 2.2 Add author bylines to all blog posts *(Component + data, ~2 hours)*
- [ ] Add `author` field to `BlogPost` interface in blogPosts.ts
- [ ] Update blog post template to show "Written by [Name], Published [Date]"
- [ ] Update BlogPosting schema in server.js to use Person type instead of Organization

#### 2.3 Add visible publication dates *(Component, ~1 hour)*
- [ ] Dates already exist in schema and blogPosts.ts
- [ ] Add `<time dateTime={post.datePublished}>` to blog post header component
- [ ] Format: "Published May 2026 · 6 min read"

### Week 3: On-Page Quick Wins

#### 3.1 Fix title tag length *(server.js, ~1 hour)*
```js
// In server.js, find pageTitle construction for blog routes
const MAX_TITLE = 45;
const baseTitle = meta.title.length > MAX_TITLE
  ? meta.title.substring(0, MAX_TITLE).trim() + '…'
  : meta.title;
const pageTitle = `${baseTitle} | Stop Biting`;
```
- [ ] Implement length cap
- [ ] Verify top 10 posts have titles ≤ 60 chars total

#### 3.2 Audit meta descriptions *(blogPosts.ts + server.js, ~3 hours)*
- [ ] Run script to find all descriptions > 160 chars
- [ ] Edit each to be 140–160 chars with value prop in first 120
- [ ] Priority: homepage (203 chars → target 145 chars), then high-traffic posts

#### 3.3 Fix FAQPage scope *(server.js, ~30 min)*
- [ ] Move FAQPage schema injection out of global head to homepage-only route
- [ ] Blog posts should not have homepage FAQ schema

### Week 4: Content Structure

#### 4.1 Create /how-it-works page *(React + server.js, ~4 hours)*
- [ ] Create `src/pages/HowItWorks.tsx` with: step-by-step, MediaPipe explanation, privacy proof
- [ ] Add server.js route with appropriate title, description, HowTo schema
- [ ] Add to sitemap.xml

#### 4.2 Add paid pricing to SoftwareApplication schema *(server.js, ~30 min)*
```json
{
  "@type": "Offer",
  "name": "Monthly",
  "price": "2.99",
  "priceCurrency": "USD",
  "billingIncrement": "P1M"
},
{
  "@type": "Offer",
  "name": "Annual",
  "price": "29.00",
  "priceCurrency": "USD",
  "billingIncrement": "P1Y"
}
```

#### 4.3 Fix stale content *(blogPosts.ts, ~15 min)*
- [ ] Update `nail-biting-statistics` title from "(2025 Research Data)" → "(2026 Research Data)"
- [ ] Fix lastmod mismatch: `nail-biting-and-perfectionism` sitemap shows 2026-04-28, blogPosts.ts shows 2026-04-23 — pick one and make consistent

---

## Phase 2 — Expansion (Weeks 5–12: June–July 2026)

**Goal:** Commercial intent pages live, internal linking improved, comparison pages indexed  
**Target score after phase:** 67/100

### Weeks 5–6: Comparison Pages

#### 5.1 Create /compare/stop-biting-vs-bitter-polish
- [ ] New React page + Express route
- [ ] Content: mechanism comparison, evidence base, context coverage, cost analysis
- [ ] Schema: FAQPage, ItemList
- [ ] Internal links from: bitter-nail-polish-review, stop-biting-vs-mavala-stop, nail-biting-cure

#### 5.2 Upgrade /blog/best-apps-to-stop-nail-biting
- [ ] Expand to comparison table format (currently thin)
- [ ] Add: app name, mechanism, price, evidence, platform, privacy, verdict
- [ ] Schema: ItemList, Review for Stop Biting
- [ ] Target: "best nail biting app 2026"

### Weeks 7–8: Solutions Pages

#### 6.1 Create /solutions/for-desk-workers (or /blog upgrade)
- [ ] Target audience: remote workers, developers, analysts
- [ ] Content: gaming/computer context stats, how detection works in the background
- [ ] Links from: nail-biting-gaming, nail-biting-laptop-working-from-home, nail-biting-during-focus-and-work

#### 6.2 Create /solutions/for-adhd
- [ ] Content: ADHD-specific mechanism, stimulation-seeking, how AI fits ADHD working style
- [ ] Links from: nail-biting-adhd, nail-biting-stimming, nail-biting-alternatives

### Weeks 9–10: Internal Linking Audit

#### 7.1 Add internal links across top 20 posts
- [ ] Each post should have 3–5 outbound internal links
- [ ] Priority links: →/pricing, →/how-it-works (trial CTA), →pillar posts
- [ ] Also update server.js SSR articles with contextual links (currently zero links in SSR content)

#### 7.2 Add links from SSR articles to related posts
```js
// In BLOG_SECTIONS_DATA, add links to related slugs in section bodies
// Example: href="/blog/habit-reversal-training-guide" in awareness sections
```

### Weeks 11–12: Cloaking Risk Resolution

#### 8.1 Evaluate SSR article approach *(Architectural decision)*
**Option A (Recommended — Lower effort):** Make the SSR article visible to users
- Remove `position:absolute;left:-9999px` 
- Style it as the article body that React then enhances
- Progressive enhancement: SSR shows content → React hydrates → same content

**Option B (Higher effort):** Migrate blog section to Astro/Next.js SSG
- Blog posts are fully static — ideal for SSG
- No cloaking risk, better Core Web Vitals, same content for all agents

**Decision criteria:** If the React app can be progressively enhanced without major UI work, do Option A. If it requires significant redesign, plan the migration for Phase 3.

---

## Phase 3 — Scale (Weeks 13–24: August–October 2026)

**Goal:** Authority signals, external presence, GEO optimization  
**Target score after phase:** 73/100

### Month 5 (August): Brand Authority Launch

#### 9.1 Product Hunt Launch
- [ ] Prepare launch: screenshots, GIF demo, clear value prop
- [ ] Hunter outreach (3 weeks before)
- [ ] Launch day: post on r/productivity, r/ADHD, r/SideProject
- [ ] First comment: founder story + how the AI works
- [ ] Expected: 200–500 upvotes → AlternativeTo picks it up → Google indexes PH page

#### 9.2 AlternativeTo Listing
- [ ] Create product page at alternativeto.net
- [ ] Category: "Nail Biting App", "Habit Tracker", "BFRB Tool"
- [ ] Description mirrors positioning statement from COMPETITOR-ANALYSIS.md

#### 9.3 Reddit Community Presence
- [ ] r/nailbiting — genuine founder post: "I built an AI that caught me biting 47 times in one day"
- [ ] r/ADHD — share the ADHD nail biting article, mention app in context
- [ ] r/OCD — respond to existing "how do you stop nail biting" threads
- [ ] r/StopSelfHarm — thoughtful founder introduction
- **Critical:** Never post commercial-only content. Always lead with value.

### Month 6 (September): E-E-A-T Deepening

#### 10.1 Add PubMed citation links to top 10 posts
- [ ] nail-biting-statistics: link each named study
- [ ] habit-reversal-training-guide: Azrin & Nunn 1973, Deckersbach et al., Cochrane 2012
- [ ] nail-biting-adhd: Ghanizadeh 2015 meta-analysis
- [ ] nail-biting-ocd-connection: DSM-5 reference

#### 10.2 Testimonials/Case Studies
- [ ] Collect 3–5 user stories from trial/paid users (with permission)
- [ ] Create /testimonials page or add to /about
- [ ] Schema: Review, Person

#### 10.3 Wikipedia Outreach
- [ ] Onychophagia Wikipedia article currently lacks external tool references
- [ ] The nail-biting-statistics page is the strongest candidate for a Wikipedia external link
- [ ] Must meet Wikipedia's external link guidelines (not promotional, genuinely informative)

---

## Phase 4 — Authority (Months 7–12: November 2026 – May 2027)

**Goal:** Domain authority building, AI citation, compounding organic growth  
**Target score after phase:** 78/100

### Month 7–8: Thought Leadership

#### 11.1 "The Awareness Gap" — Original Research Post
- [ ] Survey 50–100 Stop Biting users: "How many times did you think you bit per day vs. what the AI detected?"
- [ ] Publish findings with visualizations
- [ ] Original data → linkable asset → citable by psychology/health sites

#### 11.2 Glossary Page
- [ ] `/glossary` with definitions: onychophagia, BFRB, HRT, competing response, etc.
- [ ] DefinedTerm schema for each entry
- [ ] High AI citability for definitional queries

### Month 9–10: Link Building

#### 12.1 BFRB Organization Outreach
- [ ] TLC Foundation for Body-Focused Repetitive Behaviors: request listing as a tool
- [ ] BFRB organizations in UK, Australia, Canada
- [ ] Psychology Today contributor application (author bio credibility)

#### 12.2 Journalist/Media Outreach
- [ ] HARO/Qwoted: respond to queries about habit formation, ADHD, tech for mental health
- [ ] Target: productivity blogs, tech/wellness newsletters, ADHD-focused media

### Month 11–12: Continuous Optimization

#### 13.1 Annual content refresh
- [ ] Update top 10 posts with 2027 data references
- [ ] Add new sections where research has evolved
- [ ] Update sitemap lastmod dates

#### 13.2 AI citation monitoring
- [ ] Monthly: ask ChatGPT, Perplexity, Gemini "what app helps with nail biting?"
- [ ] Track when Stop Biting starts being cited
- [ ] Adjust llms.txt and content based on what AI systems highlight

---

## Quick Reference: Action Priority

### Do this week:
1. Fix www → 301 (hosting, 30 min)
2. Fix HTTP → HTTPS 301 (hosting, 30 min)
3. Create /about page with real founder content (4 hours)
4. Unblock CCBot in robots.txt (15 min)

### Do this month:
5. Add author bylines to blog posts (2 hours)
6. Fix title tag length cap in server.js (1 hour)
7. Audit and fix meta descriptions >160 chars (3 hours)
8. Add paid offers to SoftwareApplication schema (30 min)
9. Create /how-it-works page (4 hours)
10. Fix FAQPage scope to homepage only (30 min)

### Do next month:
11. Create comparison pages (stop-biting vs bitter-polish, vs habit trackers)
12. Upgrade best-apps-to-stop-nail-biting to full comparison page
13. Internal linking audit across top 20 posts
14. Add PubMed links to named studies in top 10 posts

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Google manual action for hidden SSR article | Medium | High | Migrate to visible content ASAP (Phase 2) |
| Well-funded competitor enters webcam detection space | Low | High | Build content moat and brand recognition now |
| Reddit posts seen as spam | Medium | Medium | Always founder-authentic, value-first framing |
| E-E-A-T penalty for YMYL content without credentials | Low | Medium | Founder story + clinical citation links |
| Product Hunt flop | Medium | Low | Plan launch carefully, build waitlist first |
