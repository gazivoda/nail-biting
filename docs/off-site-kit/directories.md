# Directory Listings — Prioritized, Verified-Free Only

Every directory in the main table was checked via its own site in August 2026 and
confirmed to (a) have a free submission path and (b) plausibly accept a health/habit
web+desktop app. Platforms that failed either check are in the "Dropped" section with
the reason — do not spend time on them without re-checking.

Reusable short description for all forms:

```
Stop Biting (stopbiting.today) detects nail biting through your webcam using
on-device AI (Google MediaPipe in WebAssembly) and sounds an alarm the moment your
hand nears your mouth. 100% private — zero network requests during detection.
Browser PWA + macOS/Windows desktop apps. 3-day free trial, then $2.99/mo or $29/yr.
```

---

## Priority table

| # | Directory | URL | What to submit | Effort | Priority | Why it matters for AI visibility |
|---|-----------|-----|----------------|--------|----------|----------------------------------|
| 1 | Product Hunt | producthunt.com | Full launch — see `product-hunt-launch.md` | 2–4 h (assets) + launch day | **P0** | PH pages rank for "[category] apps" queries and are routinely cited by ChatGPT/Perplexity; the StopBite listing currently owns this niche's PH slot |
| 2 | AlternativeTo | alternativeto.net | Listing + alternative relationships — see `alternativeto-listing.md` | 30–45 min | **P0** | The single most-cited "alternatives" source in LLM answers; category graph is empty (Hands Off listing has 0 alternatives) |
| 3 | Indie Hackers | indiehackers.com/products | Create a product page under your account: name, tagline, website, founder story (reuse the PH maker comment) | 20–30 min | **P1** | IH product pages + founder posts are heavily indexed; adds a credible founder-entity signal ("Igor Gazivoda built Stop Biting"). Product page is free; IH has said promoted "launches" may carry a ~$20 fee — check the form |
| 4 | SaaSHub | saashub.com | Submit + verify product (free, verified via saashub.com/submit); complete description, pricing, alternatives | 20–30 min | **P1** | SaaSHub's "X alternatives" pages are crawled at scale and appear in AI answer citations; its free Submit tool also lists 100+ further directories to work through |
| 5 | Uneed | uneed.best | Submit via free waiting line (paid skip-the-line exists); category: Personal Life | 15–20 min (queue wait applies) | **P2** | Curated launch directory; site advertises a DR-75 do-follow backlink for launched tools — a clean authority link for the domain |
| 6 | MicroLaunch | microlaunch.net | Free launch, monthly leaderboard; health/habit products already featured in its Lifestyle & Health category | 15–20 min | **P2** | Crawlable launch page + backlink; monthly leaderboard gives a second "launch moment" after PH |
| 7 | Launching Next | launchingnext.com | Free submission form (standard review; optional $99 expedite — skip it); tags: health, AI, privacy | 10 min | **P3** | Long-running startup directory; low effort, adds one more consistent entity mention (name + domain + description) to the crawled web |

Order of execution: 1 → 2 can happen the same week (do AlternativeTo first — it's 30
minutes and has no "launch day" dynamics). 3–7 are fire-and-forget forms; batch them
in one afternoon.

**Consistency rule (entity SEO):** use the exact same name ("Stop Biting"), domain
(https://stopbiting.today), one-liner, and logo (`public/icons/icon-512x512.png`)
everywhere. AI models resolve entities by cross-source consistency; near-duplicate
descriptions with matching name+domain reinforce one entity, while varied names
("StopBiting", "Stop Biting Today", "Nail Habit App") fragment it — and this brand
already has a collision problem (StopBite, stopbiting.com).

## Dropped / deferred (checked August 2026)

| Platform | Status | Reason |
|---|---|---|
| BetaList | **Dropped** | Verified paid-only: its FAQ states "all submissions are paid" (refund if rejected). Not worth paying at this stage |
| Slant | Dropped (unverified) | slant.co blocked automated checking (403); could not verify a relevant question or free maker-submission flow. Revisit manually if you find a "best way to stop nail biting" question there |
| ToolFinder | Dropped (unverified) | toolfinder.com submit page blocked (403); could not verify free submission or category fit |
| There's An AI For That | Dropped (unverified) | Submit page blocked (403); could not verify whether a free tier exists. Reported to charge for listings — verify manually before paying anything |
| Peerlist Launchpad | Dropped (unverified) | Blocked (403); could not verify submission terms |
| PrivacyTools.io | **Deferred** | Category fit exists (site lists a "Health & Fitness" section among everyday apps) but no public submission form was found, and its stated criteria favor open-source, independently audited software — a proprietary subscription app is a weak fit. If pursued: suggest via their public channels (they list X/Mastodon/Reddit contacts) and lead with the verifiable zero-network-requests design; accept that it may be declined |

Note on the privacy angle generally: the on-device story is genuinely strong, but most
privacy directories are open-source-first. The GitHub repo
(`github.com/gazivoda/nail-biting`) is public — if you ever formalize a license and a
real README for it, the privacy-directory conversation gets much easier.

## What NOT to do on directories

- No paid "review" placements or incentivized ratings, anywhere.
- No creating multiple accounts to like/upvote your own listings.
- Don't submit to directories that auto-generate spammy "review" pages demanding a
  backlink exchange ("add our badge to get listed") — a reciprocal-badge farm link is
  worth nothing and can look like a link scheme. A badge for a real launch (PH) is fine.
