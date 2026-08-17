# SEO Strategy: stopbiting.today

**Generated:** 2026-05-13  
**Business Type:** SaaS — Behavioral Health / AI Habit Tool  
**Site:** https://stopbiting.today  
**Current Score:** 53/100 (Poor) → **Target: 78/100 in 12 months**  
**Stack:** Vite + React SPA, Express SSR meta injection, MediaPipe WASM

---

## Executive Summary

Stop Biting occupies a defensible niche: it is the only webcam-based AI nail biting detection tool on the market. The technical moat is real — but the SEO moat is nearly zero. The site has 50 blog posts and a solid content foundation, but no comparison pages, no author attribution, no solutions architecture, and structural technical debt (cloaking risk, wrong redirect types, no 404s).

The strategy is three layers:

1. **Fix the foundation** — technical debt that caps all organic gains (Months 1–2)
2. **Build commercial intent pages** — comparison, alternatives, and feature pages that convert (Months 2–5)
3. **Compound authority** — external brand presence, case studies, and E-E-A-T signals that elevate all content (Months 3–12)

The blog already covers top-of-funnel well. The gap is middle and bottom of funnel, plus the site architecture that sends commercial-intent visitors nowhere productive.

---

## Business Context

| Signal | Detail |
|--------|--------|
| Product | AI webcam detection, fires alarm on nail biting detection |
| Technology | Google MediaPipe WASM, 100% on-device, no cloud |
| Pricing | $2.99/mo · $29/yr · 3-day free trial |
| Platforms | Web (Chrome/Edge/Firefox) · macOS · Windows |
| Key differentiator | No data leaves the device — verifiable via network monitor |
| Primary audience | Desk workers, gamers, students; people who've tried and failed with willpower |
| Secondary audience | People with ADHD, OCD-spectrum, anxiety who bite chronically |

---

## Keyword Strategy

### Tier 1 — Commercial Intent (highest priority)

| Keyword | Intent | Est. Monthly Volume | Competition | Target Page |
|---------|--------|---------------------|-------------|-------------|
| nail biting app | Transactional | 2,400 | Medium | Homepage |
| stop biting nails app | Transactional | 880 | Low | Homepage |
| best app to stop nail biting | Commercial | 590 | Low | /blog/best-apps-to-stop-nail-biting |
| nail biting detection | Informational/Commercial | 320 | Low | Homepage / /how-it-works |
| AI nail biting | Informational | 210 | None | Homepage |
| stop biting app review | Commercial | 170 | None | /blog/stop-biting-app-review |

### Tier 2 — High-Intent Informational (drives trial signups)

| Keyword | Est. Monthly Volume | Target Page |
|---------|---------------------|-------------|
| how to stop nail biting | 18,100 | /blog/stopping-nail-biting-for-good |
| habit reversal training nail biting | 1,300 | /blog/habit-reversal-training-guide |
| nail biting treatment | 2,900 | /blog/nail-biting-cure |
| nail biting ADHD | 1,200 | /blog/nail-biting-adhd |
| stop nail biting fast | 880 | /blog/stop-nail-biting-fast |
| nail biting statistics | 720 | /blog/nail-biting-statistics |
| nail biting 30 day plan | 290 | /blog/nail-biting-30-day-plan |

### Tier 3 — Comparison / Alternative (bottom-funnel, high conversion)

| Keyword | Est. Monthly Volume | Target Page (to create) |
|---------|---------------------|--------------------------|
| Mavala Stop alternative | 480 | /blog/stop-biting-vs-mavala-stop |
| bitter nail polish alternative | 720 | /compare/bitter-polish-alternative |
| nail biting app vs bitter polish | 110 | /compare/app-vs-bitter-polish |
| habit reversal training app | 390 | Homepage / /how-it-works |

### Tier 4 — Long-Tail Topic Clusters (authority building)

- Onychophagia + [condition]: ADHD, OCD, anxiety, pregnancy, autism
- Nail biting + [context]: gaming, work, studying, driving, sleep
- Nail biting + [demographic]: children, teenagers, adults, men, women
- Nail biting + [treatment]: HRT, bitter polish, hypnosis, NAC, acrylic nails
- Nail biting + [science]: genetics, bacteria, psychology, statistics

---

## Content Pillar Architecture

### Pillar 1: Why It Happens (Psychology & Science)
**Hub:** /blog/why-do-people-bite-their-nails  
**Spokes:** ADHD, OCD, anxiety, genetics, perfectionism, stress, stimming, personality  
**Status:** Strong — 15+ posts covering this

### Pillar 2: How to Stop (Treatment)
**Hub:** /blog/habit-reversal-training-guide  
**Spokes:** 30-day plan, competing responses, fidget toys, HRT, hypnosis, NAC, bitter polish  
**Status:** Good — 10+ posts. Gaps: lack of internal links between posts

### Pillar 3: The App (Product)
**Hub:** Homepage  
**Spokes:** How it works, privacy, platform pages, review, comparison  
**Status:** Weak — only homepage and one review post. Needs /how-it-works, /privacy-explained, /compare pages

### Pillar 4: Specific Contexts (Situational)
**Hub:** /blog/nail-biting-during-focus-and-work  
**Spokes:** Gaming, work meetings, laptop, evening, phone/screen, interview  
**Status:** Decent — 8+ posts now. Needs proper hub page

### Pillar 5: Products & Comparisons (Commercial)
**Hub:** /blog/best-apps-to-stop-nail-biting (upgrade to real comparison page)  
**Spokes:** vs. Mavala Stop, vs. bitter polish, app review, fidget toys  
**Status:** Very weak — 2 posts, no /compare/ architecture

---

## E-E-A-T Strategy

Current E-E-A-T score is near zero. No named author, no credentials, no about page with human information. This is the single highest-leverage non-technical improvement available.

### Step 1: Author Identity (Month 1)
- Create `/about` page: founder name, photo, personal nail biting experience, why you built this
- Add "Built by Igor, a developer who bit his nails for 20 years" to homepage footer
- This is the Experience signal — the founder IS the expert user

### Step 2: Author Attribution (Month 1–2)
- Add "Written by [Name]" byline to all 50 blog posts
- Add publication date visibly on all posts (already in schema, needs to be visible)
- Add Person schema to /about page

### Step 3: Credentials & Citation (Month 2–3)
- Cite PubMed links for all named studies in blog posts
- Add "Fact-checked against HRT clinical literature" disclaimer
- Link to TLC Foundation for BFRBs as an authority reference

### Step 4: External Presence (Months 3–6)
- Product Hunt launch → creates indexed discussion + backlinks
- Reddit r/StopSelfHarm, r/OCD, r/ADHD genuine participation as founder
- AlternativeTo listing
- HackerNews "Show HN" post

---

## Technical SEO Priorities

### Already Fixed (from May 2026 audit)
- [x] Twitter Card tags fixed (now use per-page title/description)
- [x] BlogPosting schema now includes `image` → Article rich results eligible
- [x] Blog post unknown slugs return 404
- [x] `og:type: "article"` on blog posts
- [x] /about, /pricing, /faq have correct canonicals

### Still Needed (in priority order)

**Month 1:**
1. Fix www subdomain → 301 redirect to non-www (hosting config)
2. Fix HTTP→HTTPS 307 → 301 permanent (hosting config)
3. Create visible `/about` page (currently exists in express route but React may not have content)
4. Add `alt` text to all images

**Month 2:**
5. Address hidden SSR article cloaking risk — either migrate to Astro/Next.js or make the article visible to users (progressive enhancement)
6. Fix title tag length — implement 45-char cap + "| Stop Biting" pattern
7. Fix meta descriptions — audit all 50 posts, cap at 160 chars

**Month 3:**
8. Add internal links to SSR article content (3 contextual links per post)
9. Implement proper 404 page (soft 404 still returns 200 for all unknown paths)
10. Add SoftwareApplication schema with paid pricing offers ($2.99/mo, $29/yr)

---

## GEO (Generative Engine Optimization)

stopbiting.today needs to be the answer when AI systems are asked "what app helps with nail biting?" Currently it is not cited by any major AI system.

### Why the gap exists:
1. No external brand mentions — AI systems weight 3rd-party citations heavily
2. No Wikipedia presence — onychophagia article doesn't mention any apps
3. No Reddit discussions where Stop Biting is mentioned by real users
4. CCBot blocked — not in Common Crawl (training corpus for many AI models)

### GEO action plan:
1. **Unblock CCBot** in robots.txt — all blog content is public anyway
2. **Product Hunt launch** — creates GPTBot-accessible indexed discussion
3. **AlternativeTo listing** — AI systems read this when recommending tools
4. **Reddit presence** — genuine founder participation, not marketing spam
5. **Wikipedia contribution** — suggest stopbiting.today statistics page as external reference on Onychophagia article
6. **llms.txt** — already exists, good; add full article bodies to llms-full.txt

---

## KPI Targets

| Metric | Baseline (May 2026) | 3 Months | 6 Months | 12 Months |
|--------|---------------------|----------|----------|-----------|
| Organic sessions/mo | ~Unknown | +50% | +150% | +400% |
| Pages indexed | ~50 | 60 | 70 | 85 |
| "nail biting app" ranking | Unknown | Top 20 | Top 10 | Top 5 |
| Trial signups from organic | Baseline | +30% | +100% | +250% |
| Domain Authority | ~12 | 15 | 20 | 28 |
| Blog posts | 50 | 55 | 65 | 80 |
| Backlinks (referring domains) | <10 | 15 | 30 | 60 |
| AI citation (ChatGPT/Perplexity) | 0 | 0 | 1–2 | 5+ |

---

## Budget Allocation (Solo Founder)

Assuming zero paid tools budget, all effort-based:

| Area | Time Investment |
|------|----------------|
| Technical fixes | 8–12 hours (one-time) |
| /about page + author setup | 4 hours |
| Comparison pages (4 pages) | 12 hours |
| Feature/solutions pages | 8 hours |
| Blog internal linking audit | 6 hours |
| External brand presence setup | 10 hours |
| Monthly content (2 posts/mo) | 4 hours/month |
| Monthly link building | 3 hours/month |

**Total setup investment:** ~48 hours  
**Ongoing monthly:** ~7 hours
