# Product Hunt Launch Kit — Stop Biting

Ready-to-paste launch materials. Everything below is drawn from existing site copy
(stopbiting.today landing page, /about, llms.txt) — no invented claims. Competitor facts
were verified against producthunt.com in August 2026.

**You must create the account and submit the launch yourself** (PH requires the maker's
own account). This kit makes each step a copy-paste.

---

## 1. The name collision — read this first

A product called **StopBite** already exists on Product Hunt:

- URL: `https://www.producthunt.com/products/stopbite-stop-nail-biting`
- Name: "StopBite" — tagline "Break the nail biting habit"
- What it is: an **iOS app with manual bite logging**, daily progress photos, and a
  90-day plan (built with React Native / RevenueCat / Supabase). ~128 upvotes as of
  August 2026, launched roughly nine months earlier.
- What it is **not**: it has no camera detection and no AI — users log bites by hand.

**Recommendation: launch as "Stop Biting" (two words, your real product name) with the
domain visible everywhere.**

- Use "Stop Biting" as the product name and make sure `stopbiting.today` appears in the
  tagline area, the first line of the description, and your maker comment. The domain is
  the disambiguator.
- Do NOT rename or contort the product to avoid the collision — the products are
  genuinely different (manual mobile logging vs. automatic desktop/web detection), and
  your first comment should say so plainly if anyone asks.
- If a hunter/commenter confuses the two, reply factually: "Different product —
  StopBite is a manual logging app for iPhone; Stop Biting (stopbiting.today) watches
  your webcam and interrupts biting automatically, entirely on-device."
- Never disparage StopBite. If it comes up: "Manual logging works for some people;
  we built Stop Biting because the habit is automatic and we wanted detection that
  doesn't depend on noticing it yourself."

---

## 2. Product name

```
Stop Biting
```

(If Product Hunt's URL slug generator collides with the existing listing, accept a slug
like `stop-biting-today` — the display name stays "Stop Biting".)

## 3. Tagline options (all ≤60 characters — pick one)

| # | Tagline | Chars |
|---|---------|-------|
| 1 | Your webcam catches nail biting before you notice | 49 |
| 2 | On-device AI that interrupts nail biting in real time | 53 |
| 3 | Private webcam AI that stops nail biting as it happens | 54 |
| 4 | The awareness half of habit reversal training, automated | 56 |

Suggested: **#1** (concrete mechanism, no jargon). #4 is the strongest for people who
already know HRT — good A/B candidate for a relaunch or ship page.

## 4. Description (paste into "Description of the product")

```
Stop Biting (stopbiting.today) uses your webcam and Google's MediaPipe framework —
compiled to WebAssembly, running entirely in your browser — to detect the moment your
hand moves toward your mouth. When it does, an audible alarm fires.

That alarm is the missing piece of Habit Reversal Training: awareness. Nail biting is
automatic — it happens below conscious awareness, which is why bitter polish and
willpower fail. Stop Biting catches the episodes you'd never notice yourself, and logs
each detection with a timestamp so you see your actual biting frequency, not your
estimate.

Privacy is verifiable, not promised: all processing runs on-device in WebAssembly.
Zero network requests during detection — disconnect your internet after the app loads
and it works identically. Incident log stays local. No account needed for core
detection. No analytics.

Works in the browser (PWA, no install) and as desktop apps for macOS 12+ and
Windows 10+ with system-tray background running. 3-day free trial, no credit card.
Then $2.99/month or $29/year.
```

## 5. Topics / categories to select

Pick the closest matches PH offers at submission time (topic names shift occasionally):

- Health & Fitness (StopBite's category — you want to appear in the same searches)
- Artificial Intelligence
- Privacy
- Productivity
- Web App / Mac / Windows (whichever platform topics the form offers)

## 6. First comment — maker story

Written from the /about page narrative only. Post it immediately after launch goes live.

```
Hey Product Hunt — Igor here, the developer behind Stop Biting.

I bit my nails for over 20 years. Not occasionally — constantly, automatically,
without noticing until the damage was already done. I tried everything: bitter
polish, reminder bands, sheer willpower. They all failed the same way. The habit
is automatic. By the time I noticed my hand was in my mouth, I'd already been
biting for 30 seconds.

When I read the research on Habit Reversal Training, I understood why everything
else had failed. HRT's core insight is that awareness is the bottleneck — you
can't interrupt a habit you don't know is happening. The gold-standard treatment
literally starts with "awareness training" before anything else.

I had a webcam. I knew how to code. I knew MediaPipe could run hand tracking
on-device. So I built the awareness component — the part of HRT that is hardest
to do alone.

How it works: MediaPipe's Hand Landmarker tracks 21 hand landmarks in real time
at 30fps, compiled to WebAssembly, entirely in your browser. When a hand landmark
stays within threshold of your mouth region, the alarm fires. Each detection is
logged with a timestamp — most people are surprised by the gap between "I bite
occasionally" and what the log actually shows.

The webcam part requires trust, so I designed it to be verifiable rather than
promised: zero network requests during detection. You can disconnect your
internet after the app loads and it works identically — watch your network
traffic while it runs if you want proof. The incident log stays on your device,
no account is needed for core detection, and there are no usage analytics.

It runs in the browser as a PWA (nothing to install) and as desktop apps for
macOS and Windows that sit in the system tray. 3-day free trial, no credit card
— then $2.99/month or $29/year.

Ask me anything — especially the skeptical questions about webcam privacy.
I built this to survive them.
```

## 7. Gallery checklist

What exists in `public/` today vs. what PH needs. PH has historically recommended
1270×760 px gallery images — confirm the exact dimensions shown in the upload dialog
when you submit, and export to whatever it asks for:

| Asset | Status | Notes |
|---|---|---|
| `public/og-image.png` (1200×630) | EXISTS | Usable as a fallback gallery slide but likely the wrong ratio — re-export at PH's stated size |
| `public/app-icon.svg`, `public/icons/icon-512x512.png` | EXISTS | Use the 512px PNG as the PH product logo/thumbnail |
| `public/logo.svg`, `logo-stacked.svg`, `logo-icon.svg` | EXISTS | Brand slides only — not enough alone |
| App screenshot: detection screen with alarm state | **NEEDS CREATING** | The single most important slide — show the moment of detection |
| App screenshot: incident log + trigger tagging (stress/focus/boredom) | **NEEDS CREATING** | Shows the "actual vs estimated frequency" story |
| App screenshot: streak tracking + 7-day bite chart | **NEEDS CREATING** | |
| Slide: "Zero network requests during detection" (devtools network panel while detecting) | **NEEDS CREATING** | Turns the privacy claim into evidence — uniquely credible slide |
| 30–60s screen recording / GIF of a detection firing | **NEEDS CREATING** | PH strongly favors listings with video |

Note: `src/assets/hero.png` exists in the repo — check whether it's a usable product
visual before making new ones.

## 8. Launch-day checklist

Pre-launch (1–2 weeks before):
- [ ] Create/complete your PH maker profile (real name, photo, bio linking stopbiting.today)
- [ ] Polish the GitHub README at `github.com/gazivoda/nail-biting` — as of August 2026
      it is still the default Vite template README, and PH visitors will click through
      from your profile/schema links
- [ ] Prepare all gallery assets (section 7) at 1270×760
- [ ] Set up a "Coming soon" teaser page on PH if you want to collect followers first
- [ ] Decide launch day: Tue–Thu are the most competitive (more traffic, more rivals);
      Sun–Mon are quieter (easier top-5, less traffic). For a first launch with no
      audience, a quieter day is a reasonable choice.
- [ ] Line up 3–5 real acquaintances who genuinely know the product and would comment
      honest questions/feedback — do NOT recruit strangers or upvote pods (see
      outreach-templates.md "do NOT do" list)

Launch day (PH launch days run on US Pacific time — check the scheduler when submitting):
- [ ] Post the maker first comment (section 6) immediately
- [ ] Add the PH badge/link on stopbiting.today for the day (optional)
- [ ] Reply to every single comment personally — response speed matters more than
      upvote count for credibility
- [ ] Share the launch link once on your own channels (personal socials, any newsletter)
      with an honest framing — not "please upvote" (PH discourages upvote solicitation;
      say "we launched today, feedback welcome")
- [ ] Screenshot your listing's stats at end of day for your records

Post-launch:
- [ ] Add the live PH product URL to the sameAs arrays (see sameAs-expansion.md)
- [ ] Add "Featured on Product Hunt" to the site footer only if genuinely featured
- [ ] Answer stray comments for the following week — PH pages keep collecting
      search/AI traffic long after launch day

## 9. Why this matters for AI visibility

Product Hunt pages are crawlable, high-authority, and structured (name + tagline +
description + maker). They routinely surface in ChatGPT/Perplexity answers for
"new apps to stop nail biting"-type queries — the existing StopBite listing currently
occupies that slot for this niche with zero competition from you. A "Stop Biting"
listing puts your correct product description into the corpus AI assistants draw from,
under your real brand name, with your domain attached.
