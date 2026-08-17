# Site Structure: stopbiting.today

**Generated:** 2026-05-13  
**Current:** 55 URLs (45 sitemap + 10 new) + 3 utility routes  
**Target (12 months):** ~90 URLs

---

## Current URL Inventory

### Core Pages (currently SPA shell only — need content)
| URL | Status | Issue |
|-----|--------|-------|
| / | ✅ Good | Homepage with strong schema |
| /pricing | ⚠️ Needs work | Exists in Express, needs React content |
| /about | 🔴 Critical | Express route exists, React component needs real content |
| /faq | ⚠️ Needs work | Exists in Express, needs React content with real questions |
| /blog | ✅ Good | Blog index page |
| /blog/:slug | ✅ Good | 50 posts, all with SSR meta and schema |

### Missing Core Pages
| URL | Priority | Why |
|-----|----------|-----|
| /how-it-works | 🔴 Critical | No dedicated product explanation page |
| /privacy | ⚠️ High | Privacy is top differentiator — needs a proper page |
| /compare | 🟡 Medium | Comparison hub page |
| /solutions | 🟡 Medium | Use-case landing pages |

---

## Target Information Architecture

```
https://stopbiting.today/
│
├── / ──────────────────────────── Homepage
│     Title: "Stop Biting — AI Nail Biting Detection App"
│     Schema: WebSite, Organization, SoftwareApplication, FAQPage
│
├── /how-it-works ──────────────── Product explanation
│     Title: "How AI Nail Biting Detection Works | Stop Biting"
│     Schema: HowTo, SoftwareApplication
│
├── /pricing ───────────────────── Pricing page
│     Title: "Pricing — $2.99/mo or $29/yr | Stop Biting"
│     Schema: SoftwareApplication with Offer objects
│
├── /faq ───────────────────────── Full FAQ
│     Title: "Frequently Asked Questions | Stop Biting"
│     Schema: FAQPage (15+ questions)
│
├── /about ─────────────────────── Founder + company
│     Title: "About Stop Biting | Built by Igor Gazivoda"
│     Schema: Person, Organization
│
├── /privacy ───────────────────── Privacy policy + explanation
│     Title: "Privacy: How Stop Biting Protects Your Data"
│     Schema: WebPage
│
├── /compare/ ──────────────────── Comparison hub
│   ├── /compare/bitter-polish-alternative
│   │     Title: "Stop Biting vs Bitter Nail Polish: Which Works?"
│   │     Schema: FAQPage, ItemList
│   │
│   ├── /compare/habit-tracking-apps
│   │     Title: "Why Habit Tracking Apps Don't Work for Nail Biting"
│   │     Schema: FAQPage, Comparison
│   │
│   └── /compare/nail-biting-apps ── (hub page linking to all comparisons)
│
├── /solutions/ ────────────────── Use-case landing pages
│   ├── /solutions/for-desk-workers
│   │     Title: "Stop Nail Biting While Working at a Computer"
│   │
│   ├── /solutions/for-adhd
│   │     Title: "Nail Biting and ADHD: AI Detection That Works With Your Brain"
│   │
│   └── /solutions/for-gamers
│         Title: "Stop Nail Biting While Gaming | Stop Biting"
│
├── /blog/ ─────────────────────── Blog index
│   └── /blog/:slug ────────────── 50 posts (growing to 80)
│
└── /resources/ (Month 7+) ─────── Resource hub
    ├── /resources/glossary
    └── /resources/hrt-guide ────── (redirect or canonical to blog post)
```

---

## Content Pillar → URL Mapping

### Pillar 1: Why It Happens
**Hub URL:** /blog/why-do-people-bite-their-nails  
**Spoke URLs:**
- /blog/nail-biting-ocd-connection
- /blog/nail-biting-anxiety-treatment
- /blog/nail-biting-genetics
- /blog/nail-biting-adhd
- /blog/nail-biting-stimming
- /blog/nail-biting-and-perfectionism
- /blog/nail-biting-personality
- /blog/nail-biting-adults-why-persists
- /blog/nail-biting-in-children
- /blog/nail-biting-teenagers

**Internal linking pattern:** Each spoke links back to hub + 2 other spokes + /how-it-works CTA

---

### Pillar 2: How to Stop (Treatment)
**Hub URL:** /blog/habit-reversal-training-guide  
**Spoke URLs:**
- /blog/nail-biting-cure
- /blog/stop-nail-biting-fast
- /blog/stopping-nail-biting-for-good
- /blog/how-long-to-stop-nail-biting
- /blog/nail-biting-30-day-plan
- /blog/nail-biting-habit-tracking
- /blog/nail-biting-alternatives
- /blog/nail-biting-fidget-toys
- /blog/nail-biting-hypnosis
- /blog/nac-nail-biting
- /blog/acrylics-to-stop-nail-biting

**Internal linking pattern:** /blog/nail-biting-cure and /blog/habit-reversal-training-guide should both link to /how-it-works (trial CTA) and /pricing

---

### Pillar 3: The App (Product)
**Hub URL:** /how-it-works  
**Spoke URLs:**
- /blog/stop-biting-app-review
- /blog/mediapipe-ai-detection-explained
- /blog/how-ai-can-help-stop-nail-biting
- /blog/webcam-privacy-nail-biting-app
- /blog/best-apps-to-stop-nail-biting
- /compare/bitter-polish-alternative
- /compare/habit-tracking-apps

**Internal linking pattern:** All blog posts about the app → /how-it-works → /pricing → trial

---

### Pillar 4: Specific Contexts
**Hub URL:** /blog/nail-biting-during-focus-and-work (upgrade to proper hub)  
**Spoke URLs:**
- /blog/nail-biting-laptop-working-from-home
- /blog/nail-biting-at-work-meetings
- /blog/nail-biting-gaming
- /blog/nail-biting-evening
- /blog/nail-biting-screen-time
- /blog/nail-biting-interview-anxiety
- /blog/nail-biting-during-sleep
- /solutions/for-desk-workers (to create)
- /solutions/for-gamers (to create)

---

### Pillar 5: Products & Comparisons (Commercial)
**Hub URL:** /compare/ (hub page, to create)  
**Spoke URLs:**
- /blog/best-apps-to-stop-nail-biting (upgrade)
- /blog/stop-biting-vs-mavala-stop
- /blog/bitter-nail-polish-review
- /compare/bitter-polish-alternative (to create)
- /compare/habit-tracking-apps (to create)
- /solutions for each audience segment

---

## Schema Map (Per Page Type)

| Page Type | Schema Applied | Status |
|-----------|---------------|--------|
| Homepage | WebSite + Organization + SoftwareApplication + FAQPage | ✅ Done |
| /about | Person + Organization | 🔴 Needs Person schema |
| /pricing | SoftwareApplication + Offer (x2) | 🟡 Missing paid offers |
| /faq | FAQPage (15+ Qs) | 🟡 Only 6 Qs currently |
| /how-it-works | HowTo + SoftwareApplication | 🔴 Page doesn't exist |
| /compare/* | FAQPage + ItemList | 🔴 Pages don't exist |
| /solutions/* | WebPage + FAQPage | 🔴 Pages don't exist |
| /blog/:slug | BlogPosting + BreadcrumbList | ✅ Done |
| /resources/glossary | DefinedTerm (per entry) | 🔴 Page doesn't exist |

---

## Sitemap Strategy

### Current sitemap structure:
- 1 homepage
- 4 utility pages (/blog, /about, /pricing, /faq)
- 50 blog posts
- **Missing:** /how-it-works, /compare/*, /solutions/*, /privacy

### Sitemap priority assignments:
```xml
/ ────────────── priority 1.0, weekly
/how-it-works ── priority 0.9, monthly
/pricing ──────── priority 0.9, monthly
/faq ──────────── priority 0.8, monthly
/about ────────── priority 0.8, monthly
/compare/* ────── priority 0.8, monthly
/solutions/* ──── priority 0.8, monthly
/blog/* ────────── priority 0.7–0.8 based on traffic, monthly
/resources/* ──── priority 0.6, monthly
```

### Quality gates per URL before sitemap inclusion:
- Returns HTTP 200
- Has unique `<title>` ≠ homepage title
- Has unique canonical pointing to itself
- Has at least 400 words of indexable content
- Has at least 1 internal inbound link

---

## Internal Linking Architecture

### Link flow priority:
```
Blog posts → /how-it-works → /pricing → trial signup
Blog posts → related posts (pillar cohesion)
/compare/* → /pricing → trial signup
/solutions/* → /how-it-works + /pricing
Homepage → /how-it-works + /blog (3 featured posts) + /pricing
```

### Link equity targets:
- /pricing should receive links from: homepage, /how-it-works, all /compare/* pages, top 10 blog posts
- /how-it-works should receive links from: all context blog posts (gaming, desk work, evening), /compare/* pages
- Pillar hub posts should receive links from all their spokes

### Current internal link gaps (critical):
1. Zero posts currently link to /how-it-works (page doesn't exist yet)
2. SSR articles have zero `<a href>` links — AI crawlers can't follow anything
3. Blog posts don't link to /pricing
4. No hub pages linking to spoke clusters

---

## URL Conventions

- All URLs lowercase with hyphens: `/blog/nail-biting-gaming` ✅
- No trailing slashes: `/blog/habit-reversal-training-guide` ✅ (not `.../training-guide/`)
- Blog slugs: `/blog/{descriptive-slug}` — no date-based structure
- Comparison pages: `/compare/{product-a}-vs-{product-b}` or `/compare/{category}`
- Solutions pages: `/solutions/for-{audience}` (not `/solutions/{audience}`)
- No index pages: every URL should have substantive content or 301 elsewhere

---

## Redirect Strategy

### Existing redirects needed:
- `http://stopbiting.today/*` → `https://stopbiting.today/*` (301, permanent)
- `https://www.stopbiting.today/*` → `https://stopbiting.today/*` (301, permanent)
- Any unknown URL → custom 404 page (currently returns 200 — soft 404 bug)

### Future redirects (as content evolves):
- If blog posts are consolidated: 301 old slug → new slug
- If /blog/best-apps-to-stop-nail-biting is upgraded to /compare/nail-biting-apps: 301 redirect

---

## Mobile & Performance Considerations

- All pages: mobile-first responsive (React SPA inherits this)
- Core Web Vitals targets: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Images: serve WebP, include width/height attributes to prevent CLS
- The SSR article is `position:absolute;left:-9999px` — this does NOT affect CLS but is a cloaking risk
- Font loading: ensure no FOIT (Flash of Invisible Text) from custom fonts
