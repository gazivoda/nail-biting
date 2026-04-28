# Site Structure & URL Architecture — Stop Biting

> Last updated: 2026-04-28

---

## Current URL Structure

```
stopbiting.today/
├── /                          (homepage — landing page + app entry)
├── /blog                      (blog index)
│   └── /blog/:slug            (40 individual posts — flat, no categories)
├── /privacy                   (privacy policy)
├── /terms-and-conditions      (terms)
├── /refund-policy             (refund policy)
└── /app/*                     (authenticated app routes)
```

**Problem:** All 40 blog posts are in a flat structure with no topical grouping. This means no URL-level authority clustering, no hub pages to pass link equity, and harder crawl paths for search engines.

---

## Target URL Structure

```
stopbiting.today/
├── /                                    (homepage)
├── /about                               (NEW — founder story, E-E-A-T)
├── /blog                                (blog index)
│   │
│   ├── /blog/how-to-stop-nail-biting    (NEW — Pillar: Treatment hub)
│   ├── /blog/nail-biting-guide          (NEW — Pillar: Understanding hub)
│   ├── /blog/nail-biting-health         (NEW — Pillar: Health hub)
│   ├── /blog/bfrb-guide                 (NEW — Pillar: Clinical hub)
│   ├── /blog/nail-biting-tools          (NEW — Pillar: Products hub)
│   │
│   └── /blog/:slug                      (40+ individual posts)
│
├── /privacy
├── /terms-and-conditions
└── /refund-policy
```

---

## Pillar Page Specifications

### Pillar 1: `/blog/how-to-stop-nail-biting`
**Target keyword:** "how to stop nail biting" (27,100/mo)
**Intent:** Informational → Commercial
**Format:** Comprehensive guide, 2,500+ words
**Sections:**
1. Why nail biting is hard to stop (mechanism)
2. The evidence ladder (HRT → AI detection → bitter polish → alternatives)
3. Step-by-step approach (7-day plan)
4. When to seek professional help
5. Tools and resources
**Links to spokes:** habit-reversal-training-guide, best-nail-biting-remedies, stop-nail-biting-fast, nail-biting-cure, nail-biting-alternatives, how-ai-can-help
**CTA:** Start free trial — positioned after the AI detection section

---

### Pillar 2: `/blog/nail-biting-guide`
**Target keyword:** "nail biting" (navigational + informational)
**Intent:** Top of funnel — education
**Format:** "Complete guide" hub, 2,000+ words
**Sections:**
1. What is nail biting? (definition block for GEO)
2. How common is it? (prevalence statistics)
3. Why do people do it? (causes)
4. Health risks
5. Is it a disorder?
6. Treatment options overview
7. For children vs adults
**Links to spokes:** why-do-people-bite, nail-biting-health-risks, nail-biting-statistics, nail-biting-in-children, nail-biting-adults-why-persists

---

### Pillar 3: `/blog/nail-biting-health`
**Target keyword:** "nail biting health effects"
**Intent:** Informational / health-concerned
**Format:** Health guide hub
**Sections:**
1. Overview of health risks
2. Dental damage
3. Infections and bacteria
4. Pathogen transfer
5. Pregnancy risks
6. Psychological costs
**Links to spokes:** nail-biting-health-risks, nail-biting-bacteria-parasites, nail-biting-pregnancy, grow-nails-after-nail-biting

---

### Pillar 4: `/blog/bfrb-guide`
**Target keyword:** "body-focused repetitive behaviors" / "BFRB"
**Intent:** Clinical / informational
**Format:** Clinical reference hub
**Sections:**
1. What are BFRBs?
2. DSM-5 classification
3. Types of BFRBs
4. Connection to OCD and ADHD
5. Treatment approaches
6. Finding professional help
**Links to spokes:** nail-biting-ocd-connection, nail-biting-adhd, nail-biting-stimming, nail-biting-vs-skin-picking, nail-biting-genetics

---

### Pillar 5: `/blog/nail-biting-tools`
**Target keyword:** "nail biting products" / "tools to stop nail biting"
**Intent:** Commercial
**Format:** Product category guide
**Sections:**
1. Overview of available tools
2. AI detection apps (comparison)
3. Bitter nail polish (review)
4. Physical barriers
5. Wearables
6. Combination approaches
**Links to spokes:** best-apps-to-stop-nail-biting, stop-biting-vs-mavala-stop, bitter-nail-polish-review, acrylics-to-stop-nail-biting

---

## Internal Linking Map

### Hub → Spoke (each pillar links down to its spoke posts)

```
how-to-stop-nail-biting (pillar)
  → habit-reversal-training-guide
  → best-nail-biting-remedies
  → stop-nail-biting-fast
  → nail-biting-cure
  → nail-biting-alternatives
  → how-ai-can-help-stop-nail-biting
  → stopping-nail-biting-for-good

nail-biting-guide (pillar)
  → why-do-people-bite-their-nails
  → nail-biting-statistics
  → nail-biting-genetics
  → nail-biting-in-children
  → nail-biting-adults-why-persists
  → nail-biting-emotional-regulation
  → breaking-any-habit-science

nail-biting-health (pillar)
  → nail-biting-health-risks
  → nail-biting-bacteria-parasites
  → nail-biting-pregnancy
  → nail-biting-during-sleep
  → grow-nails-after-nail-biting

bfrb-guide (pillar)
  → nail-biting-ocd-connection
  → nail-biting-adhd
  → nail-biting-stimming
  → nail-biting-vs-skin-picking
  → nail-biting-genetics
  → nail-biting-anxiety-treatment

nail-biting-tools (pillar)
  → best-apps-to-stop-nail-biting
  → stop-biting-vs-mavala-stop
  → bitter-nail-polish-review
  → acrylics-to-stop-nail-biting
  → how-ai-can-help-stop-nail-biting
```

### Spoke → Spoke (contextual cross-links, 3–5 per post)
Each spoke post should link to:
1. Its parent pillar page
2. 2–3 closely related spoke posts
3. The homepage or free trial CTA

---

## Schema Per Page Type

| Page Type | Schema |
|-----------|--------|
| Homepage | WebSite, Organization, SoftwareApplication, FAQPage, MedicalCondition |
| Pillar pages | Article, BreadcrumbList, FAQPage |
| Spoke blog posts | Article, BreadcrumbList |
| About page | Person, Organization |
| Legal pages | WebPage |

---

## About Page Requirements

The `/about` page is critical for E-E-A-T. It must include:

1. **Founder story** — personal nail biting experience (when did it start, how long, what failed, what worked)
2. **Why the app was built** — authentic origin, not marketing copy
3. **Privacy commitment** — architectural explanation of on-device AI
4. **Contact information** — email, social links
5. **Person schema** — name, sameAs (LinkedIn, GitHub), jobTitle

This page is also the target for the author byline link on every blog post, so it must convincingly establish the human behind the content.

---

## Breadcrumb Structure

Every blog post should show:
```
Stop Biting > Blog > [Post Title]
```

With BreadcrumbList schema:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Stop Biting", "item": "https://stopbiting.today/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://stopbiting.today/blog" },
    { "@type": "ListItem", "position": 3, "name": "[Post Title]", "item": "https://stopbiting.today/blog/[slug]" }
  ]
}
```
