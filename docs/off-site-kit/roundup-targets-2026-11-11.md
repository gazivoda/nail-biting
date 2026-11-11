# Roundup and mention targets for Stop Biting, read 2026-11-11

READ-ONLY research. Nothing was sent, submitted, or signed up for. Every page below was opened on 2026-11-11 unless it says "not read". The owner acts under his own name.

## Method (one paragraph)

Read the five kit files and `docs/seo/audits/2026-11-09/serp-baseline.md` first. Queries run (WebSearch standard mode, plus one Brave Search page fetched by curl): "nail biting app", "best nail biting apps 2026", "best apps to stop nail biting 2026", "smartwatch for nail biting", "Hands Off alternatives", "HabitAware Keen2 alternatives", BFRB resource and app lists, Zur Institute, BFRB newsletters, PWA directories, Mac webcam nail-biting apps, journalist searches. Page one on Google was NOT re-checked; "ranks for" below means it is named in the 2026-11-09 baseline or was top in the one Brave page. What blocked: DuckDuckGo showed a bot challenge; Bing via curl returned unrelated results; Brave answered once, then HTTP 429; reddit.com is unreadable (redirect), so every Reddit item is "not read"; TrendHunter 403; appshunter.io 403; toolpilot.ai 429; skinpick.com 520 and a timeout; canadianbfrb.org certificate error; the search tool refuses these publishers entirely (cnet, lifehacker, mashable, theverge, wired, zdnet, bbc, everydayhealth, health.com, nytimes, prevention, self, theguardian, verywellmind), so no journalist at those outlets was searched. WebSearch mostly returned store mirrors (mwm.ai, appgoblin, similarweb, marlvel), which are not targets.

**Honest headline: there are almost no independent roundups.** The two roundups on the "nail biting app" SERP are written by competing app makers, and I found no journalist who covered a nail-biting product in 2026. Nine ranked targets below, not 25; padding the list would only add pay-to-play and auto-generated sites.

## Fix first: our own Product Hunt listing is stale and contradicts the product

`https://www.producthunt.com/products/stop-biting` (read today) is a listing by Igor Gazivoda for stopbiting.today: tagline "End Nail Biting, AI Tracks, Predicts, and Stops the Habit", 2 followers, 2 points, 0 reviews, launched in 2026, "Built with Claude". Its page text says on-device webcam detection; the fetch summary also reported a maker comment describing a daily check-in habit coach using GPT with no webcam. That second point came through a page summary and is unconfirmed: open the page and check it before editing anything. `product-hunt-launch.md` assumes no listing exists, and AI engines and aggregators (hunted.space, peerpush, chatgate style sites) copy PH text. Decide whether to edit it or launch properly before pitching anyone who will check PH. Its `/alternatives` tab shows "No alternative products found".

**Verified by the orchestrator, 2026-11-11 (WebFetch of the live page):** the listing is "Maker: Igor Gazivoda", tagline as above, 2 followers, 2 points, 0 reviews, "Built With: Claude". The listing description says on-device webcam detection and "100% private". The maker comment describes an "AI-powered habit coach" with "quick daily check-ins" and says "Backed by habit science + GPT smarts". The privacy overclaim was replaced elsewhere with the approved wording (commit acd0888: no camera data is sent while it runs), so the listing is the one place still using the old line. Owner action: edit the listing (tagline, description, maker comment) to the approved wording and to what the product does today, then use `product-hunt-launch.md`. Do not pitch anyone who will check Product Hunt before it is fixed.

**Also verified:** Calm Nails (modified 2026-11-08) says "On November 8, 2026 we read the App Store and Google Play listings, and the developers' sites, for every nail-biting app in the top 15 US search results for 'stop nail biting' on both stores", so an app in neither store is outside its method; it gives Keen2 as $169 ($135 refurbished). SkinAware lists Hands Off (Mac, Windows desktop, 3 days free) as the camera-based desk detector and Keen2 at $169 one-time; it does not name Stop Biting. nailedapp.io now says "Free · macOS only" and "Runs entirely on your Mac"; our compare page (src/data/comparePages.ts, verified 2026-09-10) still says nailedapp.io advertises $4.99, so re-verify that row before it goes stale in public.

## Skipped because the kit already covers them

- Product Hunt: `product-hunt-launch.md` (but see the stale listing above).
- AlternativeTo: `alternativeto-listing.md`.
- Indie Hackers, SaaSHub, Uneed, MicroLaunch, Launching Next: `directories.md` rows 3 to 7.
- BetaList, Slant, ToolFinder, There's An AI For That, Peerlist, PrivacyTools: `directories.md` dropped list.
- TLC Foundation: `outreach-templates.md` section C. Extra read today: its Jul 2025 post "10 Best Nail Biting Deterrents" names no brands or apps, lists only generic apps for habit tracking, has a contact form (stated 3 to 7 business days) and a comment section full of unrelated spam. Do not comment there.
- r/calmhands, r/BFRB, r/BFRBs, r/nailbiting, r/ADHD, r/SideProject, Show HN: `outreach-templates.md` A and `reddit-and-community-drafts.md`.
- Crunchbase, LinkedIn: `sameAs-expansion.md`.
- Journalist and newsletter pitch template and press one-pager: `outreach-templates.md` B, `docs/press/one-pager.md` (reuse for any target below that asks for facts).

## Ranked targets (best first)

| # | Target and URL | Read | Route actually on the page | Effort | Risk |
|---|---|---|---|---|---|
| 1 | SkinAware, "Best Apps to Stop Nail Biting (2026 Comparison)" `https://www.skinawareapp.com/blog/nail-biting-app` plus sibling "Best BFRB Apps for Picking, Pulling and Biting (2026)" `https://www.skinawareapp.com/blog/bfrb-app` | 11-11 | Support page lists `[address on SkinAware's Support page]`. No form, no "suggest an app" link. | 10 min | Competitor-owned; no form; likely low odds of reply |
| 2 | Calm Nails, "Best Apps to Stop Biting Nails (2026): 6 Compared" `https://www.calmnails.com/best/apps-to-stop-biting-nails` | 11-11 | "Contact Us" mailto `[the author's address on the page]` (author's address on the page). No form. | 10 min | Competitor-owned; its stated method excludes store-less apps |
| 3 | Scoutforge, StopNailBiting listing `https://scoutforge.net/apps/stopnailbiting-app`; submit at `https://scoutforge.net/app-register`; `info@scoutforge.net` | 11-11 | "Submit Your App" (/app-register); free "claim" link on listings; email in footer | 10 min | Scores are AI-written; a new listing may show a low score; submission rules not visible |
| 4 | Luke R. Allen, PhD, self-help page `https://lukeallenphd.squarespace.com/selfhelp` | 11-11 | `[address on his contact page]` and /contact-me on the page | 10 min | Clinician; no date on page; may decline an unstudied paid tool; BFRB focus is picking and pulling |
| 5 | PWAStore directory `https://pwastore.io/submit` | 11-11 | One field, "PWA URL", then an automated installability check | 3 min | Small directory (page showed 897 PWAs); fee terms and Health category not visible |
| 6 | PeerPush `https://peerpush.com/submit` | 11-11 | Submit flow: "a free or paid listing, or a sponsored slot" | 10 min | Prices not shown; same class as Uneed/MicroLaunch; a "submit to 100 directories" upsell is promoted |
| 7 | nailedapp.io blog, "StopBite Alternative" `https://nailedapp.io/blog/stopbite-alternative/` | 11-11 | `support@nailedapp.io` in footer | 10 min | Direct competitor (webcam Mac app) that ranks for our queries; unlikely to list us |
| 8 | LavX News, TrackHands article `https://news.lavx.hu/article/trackhands-app-uses-on-device-ai-to-break-face-touching-habits` | 11-11 | Only the parent company's general contact form (`https://lavx.hu/contact`); no tips route | 10 min | Editorial process unknown; its only stated source was a GitHub repo; likely rewrites open-source items |
| 9 | Reddit threads that appear in search (titles only; not read), see note 9 | not read | Reddit comments, under existing kit rules | 20 min to read | Cannot verify open or archived, or rules |

### Notes per target

**1. SkinAware (two pages).** Page read: visible date Aug 22, 2026 (its JSON-LD says datePublished 2026-07-20; prices are labelled "a July 2026 snapshot"). Discloses it makes the blog and SkinAware is one of the apps compared. Lists, with its stated prices: HabitAware Keen2 $169 one-time; KeenLite (Apple Watch) free download, 1-week trial, in-app $4.99 to $79.99; Hands Off (Mac, Windows) three days free then EUR 2.99/month; SmartBehavior $4.99 (iOS); Quit Nail Biting (Android) 7-day trial then $9.99/month or $49 lifetime; SkinAware Premium $39.99/year or $7.99/month; NailKeeper $4.99 unlock, $9.99/year, $19.99 Pro; Unbite $2.99/week or $17.99/year; CalmNails $3.99/month or $9.99 to $19.99 lifetime. On camera tools the page says they "only protect you where the camera is pointing" and that this "works well at a desk and not at all away from one". It also flags Hands Off's own 70 to 90 percent claim as a vendor number with no study behind it, so it rewards plain limits and punishes efficacy numbers. Fit: a browser-based webcam tool sits in the slot Hands Off already holds; Stop Biting needs no phone and no download, but is the same desk-only class. The sibling page (Aug 21, 2026) also names Hands Off (EUR 2.99/month after 3 days) and SmartBehavior, plus web-based StopPicking/StopPulling at $29.95/month. Context: the blog index shows 95 posts from Apr 27 to Nov 6, 2026, about one a day in Aug to Oct; I could not tell how they are produced. The domain `skinaware.app` is a parked page; the real site is `skinawareapp.com`. The baseline names a "SkinAware roundup (2026)" on page one for "nail biting app"; I did not confirm that it is this exact URL, but it is the one in the one SERP page I got.

**2. Calm Nails.** Page: published and modified 2026-11-08, author Phil Starkovich, founder of Calm Nails, who states he makes one of the apps compared. Lists, with its stated US prices as of Nov 8: NailKeeper (in-app $4.99, $9.99/year, $19.99); Calm Nails ($9.99 once or $3.99/month, 14-day trial); Steady (core free; Plus $6.99/month, $29.99/year, $49.99 once); Nailit ($4.99/month, $39.99 or $49.99/year, $79.99 once, 7-day trial); Quitzilla (from $5.99/week to $89.99 once on iPhone); HabitAware Keen2 $169 ($135 refurbished) and Keen3 $199 preorder, due about Jan 2027. Also mentions BiteFree, Anxora, Unbitten, NoBite, Nonyxa. No webcam, desktop or browser tool appears. Its stated method: every nail-biting app in the top 15 US store search results for "stop nail biting", updated in 2026, plus two apps added because ChatGPT recommended them. A browser app in no store is excluded by that method, not by judgment; do not argue the method. The "you bite without noticing" slot currently goes to Keen. The page says plainly that none of the apps has a published trial. Page one for "nail biting app" per the baseline ("17 hours old" then).

**3. Scoutforge.** Describes itself as reviews of new web and mobile apps; the summary text says scores are "Written by AI from measured evidence". It already lists a webcam Mac app (StopNailBiting, macOS only, Scout score 0 with "Nobody has tested this one yet", AI summary mentions local computer vision and a one-time purchase). The page says "Nobody paid to appear here or to be left out." Listings have a free "claim" link. The /app-register page showed no rules in the text I got (may be script-rendered). Fit: it reviews web apps, so a PWA is in scope; the output is an AI-written score, not an editorial endorsement.

**4. Luke R. Allen, PhD.** Self-help page lists apps without prices: HabitKit, Way of Life, Habitica, DrinkControl, Less, Simple Alcohol Unit Tracker, Smoke Free, and Face Touch Aware ("pairs with an apple watch"), plus books, a BFRB monitoring Google Sheet and PickingMe tips. Page text mentions skin picking and hair pulling; nail biting is not named. Licensed in OR, NV, CA per the page. A copy also exists at `lukeallen.pages.dev/selfhelp` (seen in search only); the canonical domain is unverified. Fit: a webcam alarm for biting at a desk is a plausible line on a general app list, but the clinical reader will want evidence and there is none; ask for information-only inclusion, never an endorsement.

**5. PWAStore.** Page showed catalogue stats and a "(c) 2026" footer; /submit says "We'll check that it can be installed before you add it to PWAStore" and verifies each submission with an automated browser (allow user agent PWAStoreBot/2.0 if bot protection blocks it). It does not state fees, accounts or dofollow. Stop Biting is an installable PWA, so the check is the only gate. Directory value is small.

**6. PeerPush.** Hands Off's page there: categories AI and Health & Wellness, platform Desktop, published Nov 1, 2025, "#1 Product of the Week" Nov 3, 2025, 33 upvotes, no reviews. Free vs paid tiers not priced in what I read. Treat like the kit's Uneed and MicroLaunch: only if the free tier needs no badge or payment.

**7. nailedapp.io blog.** Dated Mar 9, 2026, no author shown. Compares StopBite (price "Varies"), Nailed ("Free", also "Free on the Mac App Store"), HabitAware Keen2 ($149+), bitter polish ($5 to $10 a bottle), therapy and habit trackers. Does not name Stop Biting or any other webcam app. Baseline: it holds the top spot for "swallow a fingernail" and page one for "grow nails after biting".

**8. LavX News.** Article dated Jan 26, 2026, byline Elena Varga, about TrackHands, a free open-source desktop app (MediaPipe, Tauri/Rust), source cited: its GitHub repo. This is the only 2026 write-up of a hand-to-mouth camera tool I found. Their /about page is the parent firm's (LavX Managed Systems, Budapest) and says nothing about how news is produced. TrendHunter also covers TrackHands, but the page returned 403 and was not read.

**9. Reddit threads seen in one Brave result page (titles only, not read):** r/nailbiting "promote your quitting/habit tracking app here!" (`reddit.com/r/nailbiting/comments/1e9rqus/`), r/nailbiting "nail biting app while you work" (`/comments/1r3k4y0/`), r/nailbiting "free nail biting detector app that runs in the browser" (`/comments/1qkkhgq/`), r/nailbiting "i made a desktop app to stop nail biting, worked..." (`/comments/1q4gw2o/`), r/SideProject "i built an app to stop nail-biting because i've struggled..." (`/comments/1p0m9no/`). The subs are in the kit, the threads are new to it. I cannot tell whether comments are still open (Reddit usually locks old threads) or what the rules say. If one is open and asks for a tool, the kit's rule applies: one link, once, with the maker disclosure.

### Checked, no fit (one line each)

- IOCDF `https://www.iocdf.org/bfrb/`: its "Resource Directory Listings (Add or Update)" route is for therapists, clinics and organisations; free only for support-group leaders; others need memberships. No product tier.
- PickingMe `https://pickingme.org`: skin-picking nonprofit; Resources page has a support group, a log and books; no apps; no submit route (`[address on the PickingMe page]` for contact).
- Trichotillomania Support UK `https://trichotillomania.co.uk/tools/`: no nail biting, no apps, phone and post only.
- Psychology Tools BFRB page: no apps, no route. UMaryland self-care apps list (updated Mar 19, 2024): no BFRB apps, no suggestion route.
- bfrbcoping.com: one person's tips site, no apps, no contact route. onepageforward.com: a printable-PDF shop, no nail biting page visible.
- Zur Institute: nothing on BFRBs or apps found; canadianbfrb.org could not be read.

## Drafts for the top five

Each is 4 sentences, under 90 words, disclosed as the owner's own paid product, limit stated, no numbers about users or revenue. "[owner: confirm]" marks anything the owner must decide before sending. Subject lines and greetings are separate. Send from the owner's own address, one at a time.

**1. SkinAware** (to `[address on SkinAware's Support page]`; subject: "Browser-based webcam tool for your nail biting comparison")

Hello, I make Stop Biting (stopbiting.today), a paid browser app, so I am biased. Your nail biting comparison says camera detectors only protect you where the camera points, and ours is in that group: webcam detection on Mac or Windows, no camera data sent while it runs, 3-day free trial, then $2.99/month. It does nothing away from a computer, is not a medical treatment, and has no published trial. A trial code is possible [owner: confirm]. Igor Gazivoda

**2. Calm Nails** (to `[the author's address on the page]`; subject: "A webcam tool, in case it fits your 'bite without noticing' section")

Hello Phil, I make Stop Biting (stopbiting.today), a paid app, so I am biased. Your Nov 8 roundup draws on store results and mine is in no store, so it falls outside your method. In case a camera tool is ever worth a line: browser-based, Mac or Windows webcam, sounds an alarm when a hand reaches the mouth, does nothing away from a computer, is not a medical treatment, $2.99/month after a 3-day trial. A trial code is possible [owner: confirm]. Igor Gazivoda

**3. Scoutforge** (form at /app-register, or `info@scoutforge.net`; subject: "Submission: Stop Biting, a web app")

Hello, I develop Stop Biting (stopbiting.today), a paid web app and installable PWA, and would like to submit it. It watches through a laptop or desktop webcam and sounds an alarm when a hand reaches the mouth, with no camera data sent while it runs. It does nothing away from a computer, is not a medical treatment, and has no published trial results. Pricing is a 3-day free trial, then $2.99/month, $29/year or $99 once; a reviewer code is possible [owner: confirm]. Igor Gazivoda

**4. Luke R. Allen, PhD** (to `[address on his contact page]`; subject: "Information for your self-help apps list")

Hello Dr. Allen, I make Stop Biting (stopbiting.today), a paid browser app, so please treat this as vendor information. Your page lists apps such as Face Touch Aware; mine is a Mac or Windows webcam tool that sounds an alarm when a hand reaches the mouth, and it does nothing away from a desk. It is not a medical treatment, has no published trial, and costs $2.99/month after a 3-day trial. I am not asking for an endorsement, only whether it could sit on your list. Igor Gazivoda

**5. PWAStore** (the form has only a URL field; use this text only if a description box appears after the installability check)

Stop Biting is a paid installable web app for Mac or Windows computers with a webcam. It sounds an alarm when a hand reaches the mouth, and no camera data is sent while it runs. It does nothing away from a computer and is not a medical treatment. There is a 3-day free trial, then $2.99/month, $29/year or $99 once.

## Facts on our own comparison pages worth re-checking (found while reading)

- HabitAware Keen2: SkinAware and Calm Nails both state $169 (Calm Nails adds $135 refurbished, Keen3 preorder $199, due about Jan 2027); nailedapp.io says $149+; the baseline saw $159 in Google Shopping. Verify at habitaware.com before quoting.
- Nailed: nailedapp.io (Mar 2026) calls it "Free" and "Free on the Mac App Store"; the kit and compare pages say $4.99 one-time. Re-check on the App Store listing.
- Hands Off: SkinAware states EUR 2.99/month after 3 days free; a search summary reported a $2.99 MacUpdate price (the MacUpdate page itself showed no price in my read); the kit says about $3/month.
- Other webcam tools now visible: HabitCam (Windows and Linux, 7-day trial then a one-time $69 per a search listing), Hands Down, NailGuardPro (Product Hunt), TrackHands (free, open source), FaceFence, a browser extension called Leave Your Face Alone. Facts from search snippets only, not opened.

## Do not bother

- **Fazier** `fazier.com/submit`: free Basic tier requires a backlink to Fazier on your site (conflicts with the reciprocal-badge rule in `directories.md`); paid tiers listed at $29, $49 and $99 or $139.
- **AI-tool directories:** completeaitraining.com (no visible submit route; alternatives "compiled by Our AI"), thejoai.com (has "Submit Ai Tool", terms unstated; its own note says content is partly user-submitted or AI-generated with little human review), chatgate.ai (auto-generated look, no submit route), toolpilot.ai (429, not read). Same class as the pay-to-play directories already dropped.
- **MacUpdate** `macupdate.com/content/submit`: downloadable Mac software only; no web-app category visible.
- **SourceForge** Hands Off page: templated listing text, no submission path visible.
- **hunted.space, feedbagel.com:** Product Hunt trackers and feed aggregators, derived from PH; "submit" there is for PH launches or RSS feeds.
- **appshunter.io** topic page: 403, not read; URL path suggests an iOS-only scraper.
- **freeappsforme.com** "5 Best Nail Biting Apps": shows both "July 17, 2026" and "June 16, 2022", five store-link apps (NailKeeper, hypnosis app, StopBite, Raylex, NoMoreNailBitting), no contact or suggestion route, no affiliate or ownership disclosure.
- **Tiptend** best-apps guide (Jun 23, 2026): names only its own iOS app. **elevenapril.com** nail journal apps: nail-art journals, wrong topic. **Roboflow** 2023 trichotillomania webcam post: old, no submission route.
- **Polish and product listicles** (Allure, Zoe Report, Marie Claire UK, StyleCraze, Bustle): seen as search titles only, not opened; polish-focused and likely affiliate.
- **Psychology Today** Apr 2025 post on nail biting by a clinician: names no tools, no direct contact route.
