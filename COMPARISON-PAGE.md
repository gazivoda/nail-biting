# Competitor Comparison Pages — Implementation Spec

**Generated:** 2026-06-15
**Affiliation disclosure:** Stop Biting (stopbiting.today) is our product. Competitor data below is drawn from each competitor's public website as of June 2026 and cited per row.
**Implementation note:** Per `GEO-TECHNICAL-AUDIT.md`, the existing `/compare/*` routes are client-side-rendered (empty `<div id="root">`). Every page below must be **server-side rendered** the same way blog posts are (`server.js` → `injectBlogBody`) so AI crawlers and Googlebot read the body. Comparison-shopping queries are high-intent; an empty body wastes them.

> ⚠️ **Correction for `COMPETITOR-ANALYSIS.md`:** that doc (2026-05-13) claims "Stop Biting has no direct AI webcam competitor." That is no longer true. **Hands Off, Nailed, and SmartBehavior** are all live, marketed, on-device AI BFRB detectors. The moat is now a crowded category — comparison pages are how we win the head-to-head queries instead of pretending they don't exist.

---

## Verified Competitor Data (as of June 2026)

| | **Stop Biting** (ours) | **Hands Off** | **Nailed** | **SmartBehavior** |
|---|---|---|---|---|
| Site | stopbiting.today | handsoffapp.com | nailedapp.io | smart-behavior.com |
| Platforms | Mac, Windows, **Web (PWA)** | Mac, Windows | **macOS only** | iOS, Android, Windows |
| Detection | On-device (MediaPipe/WASM) | On-device | On-device (MediaPipe/WASM) | On-device, 100% offline |
| BFRBs covered | Nail biting (focused) | 5 (nail, skin, hair, brow/lash, nose) | Nail biting only | Nail, skin, hair |
| Free trial | **3 days, no card** | 3 days | ❌ none | Not stated |
| Price | **$2.99/mo or $29/yr** (~$2.42/mo) | €2.99/mo (monthly only) | $4.99 one-time | Not published |
| Tracking/streaks | ✅ streaks + incident history | ✅ statistics | ❌ minimal | ✅ daily/weekly/monthly |
| Mobile native app | ❌ (web PWA on mobile) | ❌ | ❌ | ✅ iOS + Android |
| Science/HRT content | ✅ 50+ article library | ❌ | ❌ | ❌ |

**Sources:** handsoffapp.com, nailedapp.io, smart-behavior.com/en (fetched 2026-06-15). Pricing subject to change — every published page must carry an "as of June 2026" disclaimer and be re-verified quarterly.

**Honest read of our position:**
- **Unique strengths:** only one with a no-install **web app**, only one with an **annual plan** (~19% cheaper than monthly), and by far the deepest **science-backed content / HRT framing**.
- **Honest weaknesses (state them):** we're nail-biting–focused (Hands Off and SmartBehavior cover more BFRBs); we have **no native mobile app** (SmartBehavior does); Nailed is cheaper as a one-time buy. All webcam tools, ours included, only work at the computer.

---

# FLAGSHIP PAGE — `/compare/stop-biting-vs-hands-off`

**Why this one first:** Hands Off is the closest substitute — same on-device positioning, same ~€2.99 price, a real marketing site people find when searching "AI app to stop nail biting." This is the head-to-head a comparison shopper actually runs.

### Meta
- **Title:** `Stop Biting vs Hands Off: Which AI Nail-Biting App Wins? (2026)` (58 chars)
- **H1:** `Stop Biting vs Hands Off`
- **Meta description:** `Honest 2026 comparison of Stop Biting and Hands Off — two on-device AI apps that catch nail biting via webcam. Platforms, price, privacy, and which to pick.`
- **Canonical:** `https://stopbiting.today/compare/stop-biting-vs-hands-off`
- **Breadcrumb:** Home › Compare › Stop Biting vs Hands Off
- **Last updated:** visible "Last updated June 2026" + author "Stop Biting Editorial Team" (add a named reviewer when available — see E-E-A-T gap in GEO-AUDIT-REPORT.md)

### Target keywords
- Primary: `stop biting vs hands off`, `hands off app alternative`
- Secondary: `ai nail biting app comparison`, `best app to stop nail biting mac`, `hands off vs stop biting`
- Long-tail: `is hands off app worth it`, `on-device nail biting app no subscription`, `nail biting app with free trial`

### Page structure (target 1,500+ words; all SSR'd)

**1. Above-fold summary (120–150 words + primary CTA)**
> Both Stop Biting and Hands Off use on-device AI and your webcam to catch nail biting the moment it starts, and both keep 100% of camera data on your machine. The practical differences: **Hands Off** covers five body-focused repetitive behaviors (nail biting, skin picking, hair pulling, brow/lash pulling, nose picking) on Mac and Windows. **Stop Biting** focuses on nail biting, adds a **no-install web app** and an **annual plan (~$2.42/mo)**, and pairs the detector with a science-backed habit-reversal library. If you have multiple BFRBs and live on the desktop, Hands Off is a strong pick. If you want nail biting specifically, prefer the browser or want the cheaper annual price, choose Stop Biting.
>
> **CTA:** *Try Stop Biting free for 3 days — no credit card* →

**2. At-a-glance comparison table** — embed the 2-column Stop Biting vs Hands Off subset of the matrix above (as a real `<table>`, like the blog comparison tables already in `server.js`).

**3. How they're the same (~150 words)** — on-device processing, no data leaves device, real-time webcam alerting, 3-day free trial, ~€/$2.99 monthly entry price. Establishes fairness/credibility before differentiating.

**4. Where Hands Off is stronger (~200 words — acknowledge honestly)**
- Covers 5 BFRBs vs our nail-biting focus — better if you also skin-pick or hair-pull.
- Mature multi-behavior settings.
- (Cite handsoffapp.com.)

**5. Where Stop Biting is stronger (~250 words)**
- **Web app (PWA):** runs in the browser, nothing to install — Hands Off is desktop-download only. Best for locked-down work laptops.
- **Annual plan:** $29/yr ≈ $2.42/mo vs Hands Off monthly-only €2.99 — ~19% cheaper if you commit.
- **Habit-reversal depth:** detection is the awareness trigger; our 50+ article HRT library turns that into a method, not just an alarm.
- **Streak + incident history** dashboard for the nail-biting habit specifically.

**6. Price breakdown (~150 words + table)** — Stop Biting $2.99/mo · $29/yr (3-day free trial, no card) vs Hands Off €2.99/mo (3-day free trial). Note Nailed ($4.99 one-time) as a no-subscription alternative for Mac-only users. "Pricing as of June 2026."

**7. Privacy (~120 words)** — both on-device; we publish the on-device explainer (`/blog/webcam-privacy-nail-biting-app`, `/blog/mediapipe-ai-detection-explained`). Hands Off states GDPR compliance, no recording. Tie to our privacy page.

**8. Verdict (~150 words + CTA)**
> **Pick Hands Off** if you have multiple BFRBs or want a battle-tested desktop multi-behavior app. **Pick Stop Biting** if nail biting is your focus, you want to run it in a browser with no install, you'd rather pay ~$2.42/mo annually, or you want the habit-reversal coaching around the detector.
>
> **CTA:** *Start your free 3-day Stop Biting trial* →

**9. FAQ (5 Q&As — also powers FAQPage schema)**
- "Is Stop Biting or Hands Off more private?" → Both are on-device; neither transmits camera data.
- "Does Hands Off have a web version?" → No; it's a Mac/Windows download. Stop Biting offers a web PWA.
- "Which is cheaper?" → Same monthly (~$2.99); Stop Biting's $29/yr annual plan is cheaper over a year.
- "Can either detect skin picking or hair pulling?" → Hands Off covers 5 BFRBs; Stop Biting focuses on nail biting.
- "Do both work on Windows?" → Yes, both support Windows; only Stop Biting also runs in the browser.

**10. Related comparisons (internal links)**
- Stop Biting vs Nailed · Stop Biting vs SmartBehavior · Stop Biting vs Mavala Stop (`/blog/stop-biting-vs-mavala-stop`) · Best apps to stop nail biting (`/blog/best-apps-to-stop-nail-biting`) · How it works · Pricing

---

# SECONDARY PAGES TO BUILD (same template)

### `/compare/stop-biting-vs-nailed`
- **Angle:** Nailed is a $4.99 one-time **macOS-only** menu-bar app, no free trial, nail-biting only, MediaPipe/WASM (same engine as us). Our edge: Windows + web, free trial, tracking dashboard, annual subscription value over time, HRT content. Their edge: one-time price, ultra-light menu-bar footprint, Mac-native. Title: `Stop Biting vs Nailed: Subscription vs One-Time Mac App (2026)`.

### `/compare/stop-biting-vs-smartbehavior`
- **Angle:** SmartBehavior has **native iOS + Android** (our biggest gap — acknowledge), plus Windows, 100% offline, "85% accuracy," no registration, no published price. Our edge: web PWA + Mac desktop, annual plan transparency, deep content, streak/incident tracking. Honest note: if the user wants a **phone** app, SmartBehavior is the better fit today. Title: `Stop Biting vs SmartBehavior: Desktop+Web vs Mobile (2026)`.

### `/compare/ai-detection-apps` (roundup hub — ItemList schema)
- **Angle:** "Best AI apps to stop nail biting (2026)" comparison hub using the full 4-product matrix above. Distinct from the existing `/blog/best-apps-to-stop-nail-biting` (which ranks methods broadly); this hub ranks **named AI detector apps** head-to-head and links to each `/compare/*` page. This becomes the canonical internal hub all the vs-pages link up to.

### Fix the existing thin `/compare/*` pages
- `/compare/bitter-polish-alternative` and `/compare/habit-tracking-apps` already exist but ship empty bodies (CSR). Give them real SSR content + FAQPage schema, reusing the Mavala/Habitica data already in `COMPETITOR-ANALYSIS.md` and `server.js` (~line 1045/1051). Don't create new URLs — fill the existing ones.

---

## Keyword Strategy Summary

| Page | Primary keyword | Intent | Competition |
|---|---|---|---|
| vs Hands Off | `stop biting vs hands off`, `hands off app alternative` | Commercial / comparison | Low (new) |
| vs Nailed | `nailed app alternative`, `nail biting app no subscription` | Commercial | Low |
| vs SmartBehavior | `smartbehavior alternative`, `nail biting app iphone vs desktop` | Commercial | Low |
| AI apps hub | `best ai app to stop nail biting 2026`, `nail biting detector app` | Commercial / roundup | Medium |
| bitter-polish (fix) | `bitter nail polish alternative`, `mavala stop alternative` | Commercial | Medium |
| habit-tracking (fix) | `nail biting habit tracker`, `habit app for nail biting` | Commercial | Medium |

**Content gap vs competitors:** none of Hands Off, Nailed, or SmartBehavior publish comparison pages or editorial content. We can own every `[competitor] alternative` and `[competitor] vs [competitor]` query in the category with first-mover, honestly-balanced pages.

---

## Recommendations (priority order)

1. **Build `/compare/stop-biting-vs-hands-off` first** and SSR it — highest-intent head-to-head, zero current competition for the query.
2. **SSR all `/compare/*` pages** (new and existing) via the blog injection mechanism — without this the pages are invisible to AI crawlers (see GEO-TECHNICAL-AUDIT.md Warning #1).
3. **Add per-page schema:** SoftwareApplication (both products) + FAQPage on each vs-page; ItemList on the roundup hub. See `comparison-schema.json`.
4. **Add `aggregateRating`** to our SoftwareApplication once real reviews exist (do not fabricate) — directly lifts "best app" recommendation odds in AI answers (GEO-AUDIT-REPORT.md High #3).
5. **Update `COMPETITOR-ANALYSIS.md`** to replace the "no direct competitor" claim with the verified Hands Off / Nailed / SmartBehavior landscape.
6. **Quarterly re-verification:** competitor pricing/features change; refresh the matrix and the "as of" date every quarter.
7. **Fairness/legal:** keep every competitor claim sourced and balanced; never overstate. The honest tone is what makes these pages cite-worthy to AI and trustworthy to buyers.
