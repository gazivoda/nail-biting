# Outreach Templates — Honest Only

Ground rules for everything in this file: you are the founder, you always say so, and
you never pretend to be a user. These are support communities for people with a
body-focused repetitive behavior — many members are in a vulnerable place. The bar is:
would this post/message still feel okay if everyone knew you built the app? If not,
don't send it.

---

## A. Reddit — r/calmhands and r/BFRB

### What the rules actually say (checked August 2026)

**r/calmhands** (~64,200 members, public):
- Has **no formal subreddit rules** — the rules list is empty; only Reddit's site-wide
  rules apply (no spam, no personal info, no harassment).
- The sidebar has informal guidelines: use "trigger warning" on graphic
  descriptions/photos, report trolls, and share your own story. The community frames
  itself as a healing/support space; the sidebar says off-topic or negative posts not
  related to getting better "will not be tolerated."
- Important opening: the sidebar FAQ maintains an "Additional Resources" list (TLC
  Foundation, Heart & Soul Academy, CanadianBFRB.org, PickingMe.org) and explicitly
  says anyone is welcome to **message the mods** to help expand it. That is the
  legitimate front door — use it before ever posting a link.

**r/BFRB** (~4,300 members):
- Also has **no formal subreddit rules** (empty rules list; site-wide rules apply).
- The subreddit is **restricted**: only approved users can create posts. Commenting is
  open to everyone. So the path is: participate in comments, and/or modmail the mods
  to ask about posting.

Conclusion: neither sub bans promotion in writing, but "no written ban" is not an
invitation. Reddit's site-wide spam rules still apply (accounts that mostly post their
own product get banned), and a support community will react badly to a drive-by pitch.
**Default mode: genuine participation. Links only when someone asks, or with mod
blessing.**

### A1. Genuine-participation guide (both subs — do this before any link ever)

1. Subscribe and read for a week. Notice the recurring threads: progress photos,
   "how do I stop", relapse posts, product questions.
2. Comment where you have real experience — you bit your nails for 20+ years; that
   experience is the credential, not the app. Explain what HRT's awareness training
   is, why bitter polish fails for automatic biting, what trigger tracking shows.
   No links needed to be useful.
3. Set your flair/profile honestly (e.g. profile bio: "built stopbiting.today").
   Anyone who checks your profile should instantly see who you are.
4. Disclose whenever the app becomes relevant. Standard disclosure line to append:

   ```
   Full disclosure: I built an app that does this (webcam detection that alarms when
   your hand approaches your mouth), so I'm biased — happy to share the link if
   useful, but the HRT approach above works with or without it.
   ```

5. Only drop the link when (a) someone directly asks "what app?", or (b) a thread is
   explicitly asking for tool recommendations. Even then, one link, once, disclosed.
6. Keep a healthy ratio: the large majority of your Reddit activity should be
   non-promotional. If most of your last 20 comments mention your product, stop.
7. For **r/BFRB** specifically: you cannot post without approval. If you want to post
   (e.g. an AMA-style "I built a detection tool, ask me anything" or a plain-text HRT
   guide), modmail first — see A2.

### A2. Modmail template — r/calmhands resource-list suggestion

Send via "Message the mods" on r/calmhands. Adjust to taste; keep it short.

```
Subject: Suggestion for the Additional Resources list (+ disclosure: I'm the developer)

Hi mods,

Your sidebar FAQ mentions the resources list is open to suggestions, so here's one —
with the disclosure up front that I built it, so please judge accordingly.

I bit my nails for over 20 years. Bitter polish, reminder bands, and willpower all
failed me because the habit is automatic — I never noticed until I was already biting.
I'm a software developer, so I built the thing I needed: a webcam app that detects
the hand-to-mouth motion on-device and sounds an alarm in the moment. It automates
the "awareness training" step of Habit Reversal Training.

Site: https://stopbiting.today

Two honest caveats for your evaluation:
- It's freemium: there's a free 3-day trial (no card), then a paid subscription
  ($2.99/mo). If paid tools don't belong on the list, I completely understand.
- The blog (https://stopbiting.today/blog) is free with no paywall — 100+ articles on
  HRT, triggers, and the science of nail biting. If the app itself isn't a fit,
  perhaps the free guides are.

On privacy (since it's a webcam app aimed at a vulnerable community): all processing
runs on-device in WebAssembly, zero network requests during detection — it works with
the internet disconnected, which anyone can verify in their browser's network panel.

Whatever you decide is fine — I'd also welcome any conditions you'd want (e.g. only
the free guides, a specific flair when I comment, or staying link-free entirely).

Thanks for running the sub. It was communities like this one that kept me trying.

— Igor Gazivoda
```

### A3. Modmail template — r/BFRB posting-approval request

```
Subject: Request to post (disclosure: developer of a nail-biting detection app)

Hi mods,

I noticed posting here is restricted, so I'm asking rather than assuming.

Background: I bit my nails for 20+ years and eventually built a webcam app that
detects the hand-to-mouth motion on-device and alarms in real time — essentially
automating the awareness-training step of Habit Reversal Training
(https://stopbiting.today, subscription app with a free trial; all detection runs
on-device with zero network requests).

I'd like to be able to (a) comment where relevant, always with disclosure, and
(b) occasionally post non-promotional content — e.g. a plain-text explainer of HRT
and competing responses, or an "ask me anything about building detection tech for
BFRBs" thread. If you'd rather I stay comments-only, or not mention the app at all,
just say so — your community, your rules.

Thanks,
Igor Gazivoda
```

---

## B. Newsletter / blog pitch — habit & psychology writers

Targets: writers covering habit formation, behavior change, BFRBs, digital health,
or privacy-preserving AI. Personalize the first line for each recipient — reference a
specific piece they wrote. Never send this as a blast.

```
Subject: A nail-biting app where the interesting part is the constraint (on-device AI)

Hi [Name],

Your piece on [specific article — genuinely read it first] made me think this might
be up your alley.

I'm Igor Gazivoda, a software developer. I bit my nails for over 20 years, and
everything I tried — bitter polish, reminder bands, willpower — failed the same way:
the habit is automatic, and I never noticed until I was already biting. The research
on Habit Reversal Training explains why: awareness is the bottleneck. HRT literally
starts with "awareness training" before anything else.

So I built the awareness step: Stop Biting (stopbiting.today) watches through the
webcam using Google's MediaPipe hand-tracking compiled to WebAssembly, and sounds an
alarm the moment a hand approaches the mouth. It logs every detection, so people see
their actual biting frequency instead of their estimate.

Two angles that might interest your readers:

1. The behavior-science angle: what happens when you automate the awareness component
   of HRT — the part that's hardest to do alone.

2. The privacy-engineering angle: a webcam app whose privacy claim is verifiable
   rather than promised — all processing is on-device, with zero network requests
   during detection. Disconnect the internet and it works identically; anyone can
   check in their browser's network panel.

Happy to give you a free extended trial, a technical walkthrough of the detection
pipeline, or answer anything on the record — including the skeptical questions.
And if it's not a fit, no follow-up from me.

Best,
Igor Gazivoda
stopbiting.today/about
```

Notes:
- Offering a **free trial for evaluation** is normal press practice. Offering payment,
  affiliate cuts, or "sponsored" coverage without the writer disclosing it is not —
  don't.
- Don't claim user numbers, revenue, or effectiveness stats — we don't publish any.
  The verifiable claims are: the mechanism, the privacy design, and the founder story.

---

## C. TLC Foundation (bfrb.org) — resource-listing inquiry

Context (verified August 2026): The TLC Foundation for Body-Focused Repetitive
Behaviors is the major US nonprofit for BFRBs (serving the community since 1991). Its
site has a Health Education Library, research library, blog, a support-group
directory, and provider directories — but **no visible apps/tools section**, and no
public "submit a resource" form was found (the /contact URL we tried returned 404 —
find the current contact form or email in the site's own navigation/footer before
sending). r/calmhands lists TLC as its top community resource, so a relationship here
carries weight far beyond one backlink.

Tone matters most here: they are a research-driven nonprofit; you are a vendor. Lead
by asking how to be useful, not by asking for placement.

```
Subject: Developer of a nail-biting detection tool — how can I be useful to TLC?

Dear TLC Foundation team,

I'm Igor Gazivoda, a software developer, and I bit my nails for over 20 years. After
reading the research on Habit Reversal Training, I built the part of it I could never
do alone: awareness. My app, Stop Biting (https://stopbiting.today), uses on-device
webcam AI to detect the hand-to-mouth motion and sound an alarm in the moment. All
processing runs locally — no camera data ever leaves the device — because I don't
think people managing a BFRB should trade privacy for help.

I'm writing to ask, not to pitch:

1. Does TLC list consumer self-help tools anywhere in its resources, and if so,
   what is your evaluation process? I'd gladly go through any review, provide the
   technical documentation, or make the app available free to your staff or
   clinical advisors for evaluation.

2. If TLC doesn't list commercial tools (entirely understandable), is there another
   way I can support your work — for example, our free evidence-summarizing articles
   on HRT, or donating/sponsoring within whatever guidelines you have?

To be transparent: Stop Biting is a paid app ($2.99/month after a free trial) and I
have an obvious commercial interest. I'd rather be upfront about that and be told
"no" than waste your time.

Thank you for 30+ years of work on behaviors most of the world still dismisses as
"just a bad habit."

Respectfully,
Igor Gazivoda
Founder, Stop Biting — stopbiting.today/about
```

---

## D. The "do NOT do" list

Hard bans, regardless of how slow growth feels:

- **No fake users.** No sockpuppet Reddit accounts, no posing as a satisfied customer,
  no "asking for a friend" posts that tee up your own product.
- **No review swaps** ("I'll 5-star yours if you 5-star mine") on Product Hunt, app
  directories, or anywhere else.
- **No incentivized reviews or testimonials** — no discounts, free months, or payment
  in exchange for a review or an upvote. (Free press/evaluation access for a writer
  who independently decides what to say is fine.)
- **No upvote pods / engagement groups** on Product Hunt or Reddit.
- **No LLM-generated comment spam** — mass-produced "helpful" comments that exist to
  seed brand mentions across Reddit/forums/blog comments. This is the fastest way to
  poison both communities' trust and the brand itself.
- **No DMing vulnerable users** who post about their struggle. Reply publicly with
  disclosure, or not at all.
- **No undisclosed founder content** — every post, comment, or pitch about the
  product carries the "I built this" line. No exceptions, ever.
- **No invented numbers** — no user counts, success rates, or "clinically proven"
  claims. The app automates a component of an evidence-based method; it has not
  itself been clinically tested. Say the first part, never imply the second.
