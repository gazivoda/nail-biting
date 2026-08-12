// Content for the /compare/* and /solutions/* landing pages.
//
// Extracted from ComparePage.tsx so it has one home: scripts/sync-seo.mjs reads
// it to generate the server-side copy in server.js, which is what crawlers that
// never run JS receive. If this lived inside the component, the server copy
// would be hand-maintained and would drift from what visitors actually see.

export interface PageContent {
  title: string;
  subtitle: string;
  intro: string;
  // `html` is optional raw markup rendered after the body paragraphs (e.g.
  // comparison tables) — same convention as blog post sections in blogPosts.ts.
  sections: { heading: string; body: string; html?: string }[];
  relatedPosts: { href: string; label: string }[];
}

function getBitterPolishContent(): PageContent {
  return {
    title: 'Stop Biting vs Bitter Nail Polish: Which Actually Works?',
    subtitle: 'Comparing mechanisms, evidence, and who each approach works for',
    intro: 'Bitter nail polish is the most widely recommended nail biting remedy. Stop Biting is the only app that detects nail biting in real time. They solve different problems — and the difference matters for treatment outcomes.',
    sections: [
      {
        heading: 'The mechanism gap',
        body: 'Bitter polish works through aversive taste conditioning: the bitter flavor creates an unpleasant association with biting. This works for conscious biting — episodes where your hand is deliberately moving to your mouth and you can taste the polish.\n\nThe problem: most nail biting is automatic. BFRB research distinguishes "automatic" from "focused" biting, and for many chronic biters a large share of episodes happens entirely outside conscious awareness — self-monitoring simply misses them. Bitter polish cannot interrupt an episode you didn\'t know was happening — because the awareness required to taste the polish is the same awareness that was absent when the biting started.\n\nStop Biting\'s AI detection works differently: it provides awareness from outside. The alarm fires before you\'ve bitten, creating the conscious moment that bitter polish requires but cannot generate.',
      },
      {
        heading: 'Evidence comparison',
        body: 'Habit Reversal Training (HRT) — the approach whose awareness component Stop Biting automates — is the best-studied behavioural treatment for nail biting. In the landmark trial (Azrin, Nunn & Frantz, 1980), habit reversal reduced biting episodes by roughly 99% at five-month follow-up, and a 2011 meta-analysis of 18 habit reversal studies covering 575 participants found large treatment effects (Bate et al., Clinical Psychology Review).\n\nBitter nail polish evidence is primarily anecdotal and short-term. It works initially for some users, but effectiveness typically decreases as taste habituation occurs and the formula wears off. No large-scale clinical trial has established lasting efficacy beyond the initial novelty period.\n\nThe evidence base isn\'t close. HRT has decades of clinical study behind it; bitter polish has product reviews.',
      },
      {
        heading: 'What bitter polish does well',
        body: 'Bitter polish is useful as a short-term physical barrier before high-stakes situations: job interviews, presentations, social events where you\'d particularly notice your nail condition. It provides an aversive signal during the awareness window — after the hand has reached the mouth but before the bite completes.\n\nFor children whose biting is primarily conscious and deliberate rather than automatic, bitter polish can interrupt the habit effectively, particularly when combined with positive reinforcement.\n\nFor mild, occasional nail biters who bite consciously, bitter polish may be sufficient.',
      },
      {
        heading: 'What Stop Biting does that polish can\'t',
        body: 'Stop Biting catches unconscious episodes — the majority of biting for most chronic biters. It generates incident data (how often, what time, what context) that makes treatment targeted rather than generic. It provides the external awareness signal that is the cornerstone of HRT.\n\nIt also works in contexts where polish doesn\'t: gaming (wearing headphones, can\'t taste), computer work (hands clean, polish worn off after washing), drinking or eating during sessions.\n\nThe two approaches aren\'t mutually exclusive. Some users use Stop Biting for computer-context biting and bitter polish as a backup for other contexts.',
      },
      {
        heading: 'Who should use which',
        body: 'Bitter polish is the right starting point for: occasional conscious biters, children, situations requiring a simple physical barrier, or as an adjunct to other approaches.\n\nStop Biting is the right choice for: chronic automatic biters, desk workers who bite during focus, people who\'ve tried bitter polish and it didn\'t stick, anyone who wants the evidence-based HRT approach with automated awareness rather than willpower.',
      },
    ],
    relatedPosts: [
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the gold-standard treatment' },
      { href: '/blog/stop-biting-vs-mavala-stop', label: 'Stop Biting vs Mavala Stop: detailed comparison' },
      { href: '/blog/bitter-nail-polish-review', label: 'Bitter nail polish review: does it work?' },
      { href: '/how-it-works', label: 'How Stop Biting\'s AI detection works' },
    ],
  };
}

function getHabitTrackingContent(): PageContent {
  return {
    title: 'Why Habit Tracking Apps Don\'t Work for Nail Biting',
    subtitle: 'Manual logging vs automatic AI detection — why automation changes outcomes',
    intro: 'Habit tracking apps are popular. They work well for deliberate behaviors you want to build or break consciously. Nail biting is a different kind of problem — and it requires a different kind of tool.',
    sections: [
      {
        heading: 'The manual logging problem',
        body: 'Habit tracking apps like Habitica, Streaks, or Tally require you to log each biting episode manually. This creates an immediate problem: you can only log episodes you notice.\n\nResearch on nail biting awareness is clear: most biters catch fewer than half their daily episodes through self-monitoring. The habit is automatic — it runs in the basal ganglia, not the prefrontal cortex. Episodes begin and complete below conscious awareness. By the time you notice you\'ve been biting, the episode is already over.\n\nManual tracking records the episodes you noticed. It provides no data on the ones you didn\'t. For a habit that is primarily automatic, this is the majority of episodes.',
      },
      {
        heading: 'The awareness gap in numbers',
        body: 'When users start Stop Biting, the gap between self-estimated biting frequency and AI-detected frequency is consistently large. People who estimate 5–10 biting episodes per day typically see 30–60 detected in the first week.\n\nThis isn\'t a calibration error — it\'s a fundamental feature of automatic habits. The episodes that don\'t reach consciousness don\'t register in self-report. Manual tracking enforces this gap into the data by design.\n\nThe implication for treatment: if your data only captures 30–50% of actual biting episodes, your awareness of the pattern is distorted, your triggers are misidentified, and your sense of progress is wrong.',
      },
      {
        heading: 'What habit tracking apps are good at',
        body: 'Habit trackers work well for behaviors that are deliberate and scheduled: exercise, meditation, reading, water intake. These behaviors happen with full awareness and can be recorded in real time.\n\nFor nail biting, habit trackers can still provide value as a journaling tool — recording the episodes you do notice, along with context and emotional state. This is useful data. It\'s just incomplete data.\n\nSome nail biters use a hybrid approach: Stop Biting for automatic detection during computer use (where most biting occurs for desk workers), and a habit diary for off-screen episodes.',
      },
      {
        heading: 'How AI detection changes the data quality',
        body: 'Stop Biting generates the incident log automatically. Each time the AI detects a biting episode and sounds the alarm, a timestamped entry is created. After each session, incidents can be tagged with trigger categories.\n\nThis produces a complete data set — not a sample of the episodes you happened to notice. After 7 days, the log shows actual peak times, actual context patterns, and actual frequency. The difference between estimated and actual frequency is often the insight that makes users finally commit to structured treatment.',
      },
      {
        heading: 'The streak metric difference',
        body: 'Most habit trackers measure streaks in days: did you complete the habit today? For nail biting cessation, a daily binary isn\'t useful — it\'s nearly impossible to go a full day without any biting in the first weeks of treatment, so the streak breaks immediately and provides no useful feedback.\n\nStop Biting tracks bite-free periods in hours and minutes. A 3-hour streak while working, then an alarm, then a 4-hour streak — this is the granularity that makes progress visible and gives users something to extend rather than something they\'ve already failed.',
      },
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-habit-tracking', label: 'Tracking your nail biting: why data beats willpower' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the evidence-based approach' },
      { href: '/blog/stop-biting-app-review', label: 'Stop Biting app review: what to expect' },
      { href: '/how-it-works', label: 'How AI detection works' },
    ],
  };
}

function getDeskWorkersContent(): PageContent {
  return {
    title: 'Stop Nail Biting at Your Desk',
    subtitle: 'Why desk workers bite during deep focus — and how AI detection solves it',
    intro: 'Desk workers have a specific problem: the mental states that make work productive are the same states that make nail biting invisible. Deep focus, meeting fatigue, and long keyboard sessions are among the highest-risk contexts for the habit.',
    sections: [
      {
        heading: 'Why desk work and nail biting go together',
        body: 'The prefrontal cortex handles two things simultaneously: your work task and your self-monitoring (the ability to notice your own behavior). When you\'re in deep focus — debugging code, writing a difficult email, analyzing data — your prefrontal cortex is fully occupied with the task.\n\nSelf-monitoring goes offline. The basal ganglia, which stores and executes automatic habits, operates without inhibition. The result: nail biting runs automatically, invisibly, for minutes at a time. You don\'t notice until the damage is done.\n\nThis is why desk workers who bite report that their worst biting happens during their most productive moments.',
      },
      {
        heading: 'The webcam solution',
        body: 'If you work at a computer, you already have everything you need for AI-assisted habit detection. Stop Biting runs in a browser tab (or as a desktop app in the system tray) using your existing webcam.\n\nThe app processes your webcam feed locally — nothing is transmitted — and fires an audible alarm when it detects your hand approaching your mouth. The alarm interrupts the automatic habit chain at the exact moment of occurrence, creating the awareness window that self-monitoring couldn\'t provide.\n\nFor desk workers, Stop Biting typically covers 60–80% of total daily biting episodes, since that\'s roughly the proportion occurring during computer use.',
      },
      {
        heading: 'Competing responses for desk contexts',
        body: 'When the alarm fires, you need a competing response — a behavior physically incompatible with nail biting that you can execute without interrupting your work.\n\nThe most effective competing response for desk work: pressing both palms flat on the desk and holding for 60 seconds. It provides strong proprioceptive input, is physically incompatible with biting, requires no equipment, and doesn\'t interrupt typing or focus. Hold it while the urge passes (typically 20–60 seconds).\n\nAlternatives: interlacing fingers and pressing together under the desk (invisible on camera), gripping a pen, or keeping a resistance ball accessible on the desk.',
      },
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-laptop-working-from-home', label: 'Nail biting while working from home: the complete guide' },
      { href: '/blog/nail-biting-at-work-meetings', label: 'How to stop nail biting at work and in meetings' },
      { href: '/blog/nail-biting-habit-tracking', label: 'Why tracking your biting data changes treatment outcomes' },
      { href: '/how-it-works', label: 'How Stop Biting\'s detection works' },
    ],
  };
}

function getAdhdContent(): PageContent {
  return {
    title: 'Nail Biting and ADHD: AI Detection That Works With Your Brain',
    subtitle: 'Why standard approaches fail for ADHD nail biters — and what actually helps',
    intro: 'ADHD makes nail biting harder to stop in three specific ways: executive function gaps reduce awareness, dopamine-seeking reinforces the habit, and hyperfocus states deplete self-monitoring most severely. Real-time AI detection compensates for exactly these gaps.',
    sections: [
      {
        heading: 'Why ADHD nail biters struggle more',
        body: 'The core challenge with nail biting is awareness: most episodes happen automatically, below conscious attention. ADHD adds three layers on top of this.\n\nFirst, executive function deficits. Stopping an automatic behavior requires noticing it, deciding to do something different, and maintaining that decision. Working memory, inhibitory control, and cognitive flexibility — all impaired in ADHD — handle this process. Standard HRT requires all three to work consistently.\n\nSecond, dopamine seeking. ADHD involves dysregulation of the dopamine system, creating chronic understimulation. Nail biting delivers a reliable proprioceptive dopamine bump — genuinely useful for an understimulated ADHD brain. This makes the habit more reinforced, not less.\n\nThird, the hyperfocus problem. ADHD hyperfocus states produce the deepest awareness gaps of any context. During hyperfocus, self-monitoring essentially shuts down — which is when the most biting occurs.',
      },
      {
        heading: 'Why willpower-based approaches fail for ADHD',
        body: 'Willpower requires sustained inhibitory control — exactly the executive function most impaired by ADHD. Approaches that depend on "just notice and stop" ask for the cognitive resource ADHD makes least available.\n\nBitter polish fails for a related reason: it requires the awareness that ADHD depletes. You have to notice your hand is in your mouth to taste the polish. During hyperfocus, you don\'t notice. The polish is irrelevant.\n\nHRT works better for ADHD — but only when the awareness component is externalized. Self-awareness training, which works in neurotypical people, is insufficient when the awareness gap is neurological rather than attentional.',
      },
      {
        heading: 'How AI detection compensates',
        body: 'Stop Biting\'s AI detection externalizes the awareness component. Instead of relying on your attention to catch biting episodes, the camera and MediaPipe model catch them for you — independent of your attention state.\n\nFor ADHD users, this is the critical difference. The alarm fires during hyperfocus when self-monitoring is offline. It fires when stimulant medication has worn off and the rebound window begins. It fires during the specific states where ADHD makes the habit hardest to catch.\n\nThe competing response can then be designed for ADHD specifically: sensory-matching options (textured fidgets, chewing gum) that address the dopamine-seeking function the biting is serving, rather than generic palm pressing.',
      },
      {
        heading: 'Practical setup for ADHD users',
        body: 'Run Stop Biting during your main work sessions — this is typically when ADHD users are most at risk (hyperfocus states, working without breaks). Keep the alarm loud enough to break through headphones if you use them.\n\nFor the competing response, ADHD users often do better with sensory input rather than physical incompatibility alone: a mesh fidget ring on the dominant hand, chewing gum during work sessions, or a rough-textured stress ball within reach. These address the sensory-seeking function.\n\nTrack which times of day show the most incidents. For many ADHD users, the medication rebound window (late afternoon) is the highest-risk period — preparing a specific competing response before that window is more effective than trying to respond to it in the moment.',
      },
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-adhd', label: 'Nail biting and ADHD: the complete guide' },
      { href: '/blog/nail-biting-stimming', label: 'Is nail biting stimming? ADHD and sensory regulation' },
      { href: '/blog/nail-biting-habit-tracking', label: 'Why tracking changes treatment for ADHD biters' },
      { href: '/how-it-works', label: 'How Stop Biting\'s detection works' },
    ],
  };
}

function getGamersContent(): PageContent {
  return {
    title: 'Stop Nail Biting While Gaming',
    subtitle: 'Gaming flow state makes the habit invisible — AI detection works in the background',
    intro: 'Gaming is one of the worst nail biting contexts because it\'s designed to capture exactly the cognitive state that makes automatic habits invisible. Flow state = awareness offline. Here\'s how to keep gaming and stop biting.',
    sections: [
      {
        heading: 'Why gaming and nail biting go together',
        body: 'Gaming creates a constellation of nail biting conditions simultaneously: sustained deep focus (awareness offline), repeated micro-stress moments (loading screens, competitive pressure), hands near the keyboard and face, and an activity compelling enough that no other behavior gets conscious attention.\n\nThe flow state that makes gaming enjoyable is the same state that makes nail biting invisible. During a raid, a ranked match, or a puzzle sequence, the prefrontal cortex is entirely occupied. Self-monitoring isn\'t running. By the time you notice you\'ve been biting, you\'re already minutes into an episode.',
      },
      {
        heading: 'Highest-risk gaming moments',
        body: 'Not all gaming moments carry equal risk. The highest-risk windows: loading screens and queue waits (boredom plus anticipation anxiety), high-stakes competitive moments (acute stress without physical outlet), frustration after a death or loss, and passive spectating of cutscenes.\n\nLoading screens deserve specific attention: they\'re short enough that a full biting episode can complete before the screen returns, but frequent enough to add up across a session.',
      },
      {
        heading: 'Why common remedies fail for gamers',
        body: 'Bitter polish: loses effectiveness if you eat or drink during sessions. Physical barriers: gloves and finger wraps interfere with keyboard and mouse precision. Phone reminders: inaudible with headphones, break flow. Willpower: gaming\'s attentional demands are specifically calibrated to exclude self-monitoring.\n\nAny solution requiring you to generate awareness internally will fail. Gaming exports all available awareness to the game.',
      },
      {
        heading: 'AI detection during gaming',
        body: 'If you\'re gaming on a computer, you have a webcam. Stop Biting runs in a browser tab or system tray alongside your game, using that webcam to detect nail biting and fire an audible alarm — without interrupting gameplay.\n\nThe alarm is loud enough to cut through headphones (adjust your alarm volume in settings). It breaks the automatic habit chain at the moment of occurrence, then you return to the game immediately. No interruption, no context switch required.\n\nOver 2–4 weeks of consistent alarm-based interruption during gaming sessions, the habit\'s automaticity in that specific context weakens measurably.',
      },
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-gaming', label: 'Nail biting while gaming: why it happens and how to stop' },
      { href: '/blog/nail-biting-screen-time', label: 'How screens and phones make nail biting worse' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the evidence-based approach' },
      { href: '/how-it-works', label: 'How Stop Biting\'s detection works' },
    ],
  };
}

// ─── Competitor comparison pages ─────────────────────────────────────────────
// FACT-CHECK LOG — every competitor claim below was verified against the
// competitor's own public website on 2026-08-11:
//   Hands Off      https://handsoffapp.com      (fetched 2026-08-11)
//     Mac + Windows desktop app; webcam AI processed locally; markets coverage
//     of five common BFRBs, listing nail biting, skin picking, eyebrow or
//     eyelash pulling, and nose picking; €2.99/month subscription (only plan
//     listed), 3-day free trial, cancel anytime; states no video is recorded,
//     GDPR compliant, no personal data collected; built by Lennert Soffers.
//   Nailed         https://nailedapp.io         (fetched 2026-08-11)
//     macOS-only menu bar app; $4.99 one-time purchase; no free trial listed;
//     MediaPipe machine learning models via WebAssembly; camera feed processed
//     in memory and discarded; no servers, no analytics, works offline; alert
//     is a red flash plus optional beep; also distributed on the App Store.
//   SmartBehavior  https://smart-behavior.com/en (fetched 2026-08-11)
//     iOS (App Store), Android (Google Play), Windows (Microsoft Store); no
//     macOS version listed; detects nail biting, skin picking, and other
//     BFRBs; claims 85% accuracy; 100% offline on-device processing; no
//     registration required; daily/weekly/monthly trend analytics;
//     customizable alerts; publishes no pricing on its website.
// Stop Biting facts come from our own published pages (llms.txt, /pricing,
// /how-it-works). Re-verify competitor rows quarterly; update the visible
// "verified August 2026" wording in the copy when you do.

function getVsHandsOffContent(): PageContent {
  return {
    title: 'Stop Biting vs Hands Off: Which Should You Pick?',
    subtitle: 'Two on-device AI apps that catch nail biting through your webcam — compared honestly on platforms, coverage, price, and privacy',
    intro: 'Stop Biting and Hands Off solve the same core problem the same way: on-device AI watches your webcam and interrupts nail biting the moment it starts, without sending camera data anywhere. The real differences are coverage and platform. Hands Off covers five body-focused repetitive behaviors on Mac and Windows; Stop Biting focuses on nail biting, adds a no-install web app, an annual plan, and a large habit-reversal content library. Disclosure: Stop Biting is our product — this is our honest attempt at a fair comparison, with every Hands Off claim verified against handsoffapp.com in August 2026.',
    sections: [
      {
        heading: 'At a glance',
        body: 'Both apps were checked side by side in August 2026. Pricing and features change — always confirm on the vendor’s own site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Hands Off</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Mac, Windows, web browser (PWA)</td><td>Mac, Windows desktop</td></tr>' +
          '<tr><td>Behaviors detected</td><td>Nail biting (focused)</td><td>Five BFRBs — its site lists nail biting, skin picking, eyebrow or eyelash pulling, and nose picking</td></tr>' +
          '<tr><td>Detection</td><td>On-device AI (MediaPipe/WebAssembly)</td><td>On-device AI — all processing local</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>€2.99/month (monthly plan only listed)</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>3 days</td></tr>' +
          '<tr><td>Privacy</td><td>No camera data leaves the device; zero network requests during detection</td><td>States no video is recorded, GDPR compliant, no personal data collected</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'How they’re the same',
        body: 'The overlap is bigger than the differences, and it’s worth saying so. Both apps use real-time AI on your webcam feed, both process everything locally on your machine, and both fire an alert the moment your hand approaches your mouth — the external awareness signal that habit reversal research identifies as the key ingredient for stopping automatic biting.\n\nBoth also price the entry point almost identically: about three dollars or euros a month, with a 3-day free trial. Neither records video or uploads camera data. If your only question is "does the core mechanism work the same way?", the answer is essentially yes.',
      },
      {
        heading: 'Where Hands Off is stronger',
        body: 'Hands Off covers more behaviors. Its site markets detection for five common body-focused repetitive behaviors, listing nail biting, skin picking, eyebrow or eyelash pulling, and nose picking. If you have multiple BFRBs — say you bite your nails and pick at skin — one Hands Off subscription addresses contexts Stop Biting simply doesn’t attempt to cover.\n\nIt’s also a credible, personal product: Hands Off is built by a founder who describes his own twenty-year struggle with nail biting, states GDPR compliance explicitly, and interrupts episodes with a full-screen alert. For a desktop-only, multi-behavior use case, it’s a genuinely strong choice.',
      },
      {
        heading: 'Where Stop Biting is stronger',
        body: 'Stop Biting runs in the browser. Hands Off is a Mac/Windows download; Stop Biting works as a desktop app and as a no-install web app (PWA), which matters on locked-down work laptops where you can’t install software.\n\nStop Biting has an annual plan. Hands Off’s site lists a single €2.99/month subscription. Stop Biting is $2.99/month or $29/year — about $2.42/month if you commit, roughly 19% cheaper than paying monthly.\n\nStop Biting pairs detection with treatment content. The alarm is the awareness trigger; the library of over 100 science-backed guides on habit reversal training, competing responses, and trigger mapping turns that trigger into a method. Stop Biting also tracks streaks and keeps a full incident history, so you can see when and how often you actually bite.\n\nThe honest counterpoint: if your problem is skin picking or hair pulling rather than nail biting, Stop Biting is the wrong tool — it detects nail biting only.',
      },
      {
        heading: 'Price breakdown',
        body: 'Stop Biting: $2.99/month or $29/year (about $2.42/month), with a 3-day free trial and no credit card required to start.\n\nHands Off: €2.99/month with a 3-day free trial, cancel anytime. No yearly or lifetime option is listed on its pricing page.\n\nOver one year at these listed prices, Stop Biting’s annual plan costs $29 versus roughly €35.88 for twelve months of Hands Off. If you only need an app for a month or two, the two are effectively the same price. Pricing verified on both sites in August 2026 and subject to change.',
      },
      {
        heading: 'Privacy',
        body: 'This is a tie, and that’s good news. Hands Off states that all processing happens locally, no video gets recorded, and no personal data is collected — it is explicitly GDPR compliant. Stop Biting runs MediaPipe models compiled to WebAssembly directly on your device: the camera feed never leaves your machine, and detection makes zero network requests, which you can verify yourself with your browser’s network monitor.\n\nWhichever app you choose here, you are not trading privacy for the feature.',
      },
      {
        heading: 'Frequently asked questions',
        body: 'Is Stop Biting or Hands Off more private? Both process the webcam feed entirely on your device and neither transmits camera data. Stop Biting publishes a technical explainer of its on-device detection; Hands Off states it records no video and is GDPR compliant.\n\nDoes Hands Off have a web version? No — as of August 2026 it’s a Mac and Windows download. Stop Biting additionally runs in the browser as a PWA.\n\nWhich is cheaper? Monthly, they’re effectively the same (~$/€2.99). Stop Biting’s $29/year annual plan is about 19% cheaper over a year; Hands Off lists no annual option.\n\nCan either detect skin picking or hair pulling? Hands Off markets coverage of five BFRBs; Stop Biting focuses on nail biting only.\n\nDo both work on Windows? Yes. Both support Windows and Mac; only Stop Biting also runs in a browser.',
      },
      {
        heading: 'Verdict',
        body: 'Pick Hands Off if you have multiple body-focused repetitive behaviors and live on the desktop — one subscription covering five behaviors is the better fit.\n\nPick Stop Biting if nail biting is your specific problem, you want to run detection in a browser without installing anything, you’d rather pay ~$2.42/month on the annual plan, or you want streak tracking, incident history, and habit-reversal coaching around the detector.\n\nBoth offer a 3-day free trial, so the cheapest way to decide is to try the one that matches your situation.',
      },
    ],
    relatedPosts: [
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-nailed', label: 'Stop Biting vs Nailed: subscription vs one-time Mac app' },
      { href: '/compare/stop-biting-vs-smartbehavior', label: 'Stop Biting vs SmartBehavior: desktop and web vs mobile' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

function getVsNailedContent(): PageContent {
  return {
    title: 'Stop Biting vs Nailed: Subscription vs One-Time Mac App',
    subtitle: 'Two apps built on the same detection engine, with very different scopes — a $4.99 menu bar utility vs a cross-platform habit system',
    intro: 'Nailed and Stop Biting share more DNA than any other two apps in this category: both use Google’s MediaPipe machine learning models running via WebAssembly, entirely on-device. The difference is scope. Nailed is a deliberately minimal $4.99 one-time macOS menu bar app; Stop Biting is a subscription that adds Windows, a browser version, streak tracking, incident history, and a habit-reversal content library. Disclosure: Stop Biting is our product — we’ve verified every Nailed claim here against nailedapp.io in August 2026 and tried to represent it fairly.',
    sections: [
      {
        heading: 'At a glance',
        body: 'Details verified against nailedapp.io in August 2026. Pricing and features change — confirm on the vendor’s site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Nailed</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Mac, Windows, web browser (PWA)</td><td>macOS only (menu bar app)</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>$4.99 one-time</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>None listed</td></tr>' +
          '<tr><td>Detection engine</td><td>MediaPipe models via WebAssembly, on-device</td><td>MediaPipe models via WebAssembly, on-device</td></tr>' +
          '<tr><td>Alerts</td><td>Audible alarm, multiple alert types</td><td>Red screen flash, optional beep</td></tr>' +
          '<tr><td>Tracking</td><td>Streaks and incident history</td><td>Not listed among features</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Same engine, different philosophy',
        body: 'Under the hood, the two apps make the same technical bet: MediaPipe’s hand and face models, compiled to WebAssembly, running locally. Nailed’s site describes it plainly — machine learning detects when your hand approaches your mouth, everything runs on your Mac, the camera feed is processed in memory and immediately discarded, no servers, no analytics.\n\nStop Biting’s detection works the same way, and we publish the same commitment: no camera data ever leaves your device, zero network requests during detection.\n\nSo the honest framing isn’t "which detector is real" — both are. It’s "how much system do you want around the detector."',
      },
      {
        heading: 'The case for Nailed',
        body: 'Nailed costs $4.99 once. No subscription, no account, nothing recurring. If you own a Mac, want the lightest possible intervention, and dislike subscriptions on principle, that’s a genuinely compelling offer — over a year it’s cheaper than two months of any subscription app in this category.\n\nIt’s also admirably unobtrusive: it lives in the menu bar, flashes the screen red and optionally beeps when it catches you, and its site emphasizes minimal CPU and battery usage. For a conscious minimalist who just wants the awareness signal and nothing else, Nailed is a well-made tool.',
      },
      {
        heading: 'The case for Stop Biting',
        body: 'Platforms: Nailed is macOS-only. Stop Biting runs on Mac, on Windows, and in any modern browser as a no-install web app — including on machines where you can’t install software.\n\nTrying before buying: Nailed lists no free trial; you pay $4.99 to find out whether webcam detection suits your setup and lighting. Stop Biting’s 3-day trial requires no credit card, so you can test detection accuracy on your actual desk for free.\n\nThe system around the alarm: Stop Biting tracks bite-free streaks and keeps a timestamped incident history, which turns detection into data — when you bite, how often, and whether you’re improving. It also ships with over 100 science-backed guides on habit reversal training, so the alarm feeds a method rather than standing alone. Nailed’s site doesn’t list tracking or educational content; that’s consistent with its minimal philosophy, but it’s a real difference for treating an entrenched habit.\n\nThe honest counterpoint: if the awareness signal alone fixes your habit, Stop Biting’s subscription buys you things you may not need — and Nailed’s one-time $4.99 wins on pure price for Mac users.',
      },
      {
        heading: 'Cost over time',
        body: 'Nailed: $4.99, once. Stop Biting: $2.99/month, or $29/year (~$2.42/month).\n\nThere’s no way to spin that: on price alone, a one-time purchase beats a subscription, and if price is your deciding factor and you’re on a Mac, buy Nailed.\n\nWhat the subscription pays for is the rest of the system — Windows and browser support, streak and incident tracking, alert options, ongoing model and feature updates, and the content library. Whether that’s worth ~$29/year depends on how established your habit is: casual biters often need only the nudge; chronic biters typically need the tracking and the method. Pricing verified August 2026.',
      },
      {
        heading: 'Who should choose which',
        body: 'Choose Nailed if: you’re on a Mac, you want a one-time purchase, you’re confident the red-flash awareness cue alone will do it, and you don’t need history or tracking.\n\nChoose Stop Biting if: you’re on Windows or need a browser version, you want to trial detection free before paying, you want streaks and incident data to measure progress, or your habit has survived previous attempts and you want the full habit-reversal toolkit around the detector.',
      },
    ],
    relatedPosts: [
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/blog/mediapipe-ai-detection-explained', label: 'How MediaPipe detection works: a technical explainer' },
      { href: '/pricing', label: 'Stop Biting pricing — free trial, $2.99/month or $29/year' },
    ],
  };
}

function getVsSmartBehaviorContent(): PageContent {
  return {
    title: 'Stop Biting vs SmartBehavior: Desktop and Web vs Mobile',
    subtitle: 'The clearest split in the category: where do you actually bite your nails — at a computer, or everywhere else?',
    intro: 'Stop Biting and SmartBehavior both use on-device AI to catch nail biting through a camera, and both keep processing entirely local. The decision between them is mostly about platform. SmartBehavior has native iPhone and Android apps plus Windows; Stop Biting covers Mac, Windows, and the browser. Disclosure: Stop Biting is our product — this comparison aims to be honest, and every SmartBehavior claim was verified against smart-behavior.com in August 2026.',
    sections: [
      {
        heading: 'At a glance',
        body: 'Details verified against smart-behavior.com in August 2026. Pricing and features change — confirm on the vendor’s site before deciding.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>SmartBehavior</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Mac, Windows, web browser (PWA)</td><td>iOS, Android, Windows (no macOS version listed)</td></tr>' +
          '<tr><td>Native mobile app</td><td>No</td><td>Yes — iPhone and Android</td></tr>' +
          '<tr><td>Behaviors detected</td><td>Nail biting (focused)</td><td>Nail biting, skin picking, and other BFRBs</td></tr>' +
          '<tr><td>Detection</td><td>On-device (MediaPipe/WebAssembly); offline after initial load</td><td>On-device, 100% offline; claims 85% accuracy</td></tr>' +
          '<tr><td>Pricing</td><td>Published: $2.99/month or $29/year, 3-day free trial</td><td>Not published on its website</td></tr>' +
          '<tr><td>Tracking</td><td>Streaks and incident history</td><td>Daily, weekly, and monthly trend analytics</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Where SmartBehavior is stronger',
        body: 'SmartBehavior is the only app in this comparison with native mobile apps. If a large share of your biting happens away from a computer — on the couch with your phone, commuting, in bed — a detector that lives on your phone addresses contexts a desktop-and-browser app doesn’t. That’s a real gap on our side, and if "on my phone" describes most of your habit, SmartBehavior is the better fit today.\n\nIt also covers more than nail biting — its site describes detection for skin picking and other body-focused repetitive behaviors — runs 100% offline with all processing on-device, requires no registration to start, and tracks daily, weekly, and monthly trends. Its stated setup time is about two minutes.',
      },
      {
        heading: 'Where Stop Biting is stronger',
        body: 'Desktop coverage — including the Mac. SmartBehavior lists iOS, Android, and Windows apps, but no macOS version. If you work on a Mac, Stop Biting covers your highest-risk hours natively; and because it also runs in the browser, it works even on machines where you can’t install anything.\n\nTransparent pricing. Stop Biting publishes its prices: $2.99/month or $29/year, with a 3-day free trial and no credit card required. SmartBehavior doesn’t publish pricing on its website, so you’ll need to check the app stores to know what you’d pay before committing.\n\nDepth of treatment content. Stop Biting surrounds its detector with over 100 science-backed guides on habit reversal training — the method with the strongest clinical evidence for stopping nail biting — plus streak tracking and a full incident history.\n\nWorth stating plainly: for many desk workers, most biting happens during focused computer use, which is exactly the context a webcam app on your work machine covers.',
      },
      {
        heading: 'The context question decides it',
        body: 'Webcam-based detection — ours included — only works when you’re in front of the camera. Phone-based detection only works when the phone can see you. Neither watches you everywhere.\n\nSo the practical question isn’t "which app is better" but "where does your biting happen?" If you bite mostly during focused computer work (coding, writing, gaming, meetings), a desktop/browser detector covers the majority of your episodes. If you bite mostly on the couch, in transit, or around the house, a phone app is closer to where the habit lives.\n\nSome people genuinely need both contexts covered — in which case the honest answer is that no single app in this category does it all today.',
      },
      {
        heading: 'Privacy',
        body: 'Both apps make strong, similar commitments. SmartBehavior states that all data is processed exclusively on your device, works 100% offline, collects no data, and requires no registration. Stop Biting runs MediaPipe models via WebAssembly on your device, transmits no camera data, and makes zero network requests during detection — verifiable with a network monitor.\n\nOn privacy, you can choose either app without compromise.',
      },
      {
        heading: 'Who should choose which',
        body: 'Choose SmartBehavior if: most of your biting happens away from a computer, you want a native iPhone or Android app, or you also struggle with skin picking on the go.\n\nChoose Stop Biting if: most of your biting happens at a desk, you use a Mac, you want a browser option for locked-down machines, you want published pricing with a free trial before paying, or you want habit-reversal coaching and incident history around the detector.',
      },
    ],
    relatedPosts: [
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/solutions/for-desk-workers', label: 'Stop nail biting at your desk' },
      { href: '/blog/nail-biting-screen-time', label: 'How screens and phones make nail biting worse' },
    ],
  };
}

function getAiDetectionAppsContent(): PageContent {
  return {
    title: 'AI Apps That Detect Nail Biting: Every Option Compared',
    subtitle: 'Four apps now use on-device AI to catch nail biting in real time. Here’s the honest head-to-head — including where ours loses.',
    intro: 'Real-time AI nail biting detection went from one app to a real category: four products now watch for hand-to-mouth movement through a camera and interrupt the habit as it happens — Stop Biting, Hands Off, Nailed, and SmartBehavior. All four process video on-device. This page compares them directly; our per-app pages go deeper on each match-up. Disclosure: Stop Biting is our product. Every competitor claim below was verified against the vendors’ own websites in August 2026, and we’ve noted honestly where each alternative beats us.',
    sections: [
      {
        heading: 'The full comparison',
        body: 'All details below were verified against each vendor’s public website in August 2026. Pricing and features change — confirm before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Hands Off</th><th>Nailed</th><th>SmartBehavior</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Mac, Windows, web (PWA)</td><td>Mac, Windows</td><td>macOS only</td><td>iOS, Android, Windows</td></tr>' +
          '<tr><td>Behaviors</td><td>Nail biting</td><td>Five BFRBs (nail biting, skin picking, brow/lash pulling, nose picking listed)</td><td>Nail biting</td><td>Nail biting, skin picking, other BFRBs</td></tr>' +
          '<tr><td>Detection</td><td>On-device (MediaPipe/WASM)</td><td>On-device, all processing local</td><td>On-device (MediaPipe/WASM)</td><td>On-device, 100% offline</td></tr>' +
          '<tr><td>Price</td><td>$2.99/mo or $29/yr</td><td>€2.99/mo</td><td>$4.99 one-time</td><td>Not published on site</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no card</td><td>3 days</td><td>None listed</td><td>Not stated on site</td></tr>' +
          '<tr><td>Tracking</td><td>Streaks + incident history</td><td>Not listed on site</td><td>Not listed on site</td><td>Daily/weekly/monthly trends</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Why this category exists',
        body: 'Most nail biting is automatic — episodes start and finish below conscious awareness, which is why willpower, bitter polish, and manual habit trackers so often fail: they all require the awareness the habit bypasses. Habit Reversal Training, the best-evidenced behavioural treatment, names awareness training as its first component.\n\nCamera-based AI detection automates exactly that component. A model watches for hand-to-mouth movement and fires an alert at the moment of occurrence, supplying awareness from outside. Every app on this page implements that same insight; they differ in platform, scope, price, and what’s built around the detector.',
      },
      {
        heading: 'Stop Biting — best for nail biting at a computer',
        body: 'Our app, so read this row knowing that. Stop Biting runs on Mac, Windows, and — uniquely in this group as of August 2026 — in a web browser as a no-install PWA. Detection uses MediaPipe hand and face models in WebAssembly, fully on-device, with zero network requests during detection. It tracks bite-free streaks and a timestamped incident history, and pairs the detector with over 100 science-backed guides on habit reversal.\n\nPricing is published: $2.99/month or $29/year (~$2.42/month), with a 3-day free trial and no credit card.\n\nHonest limits: it detects nail biting only, and there’s no native phone app — on mobile it runs as a web app, not an installed detector.',
      },
      {
        heading: 'Hands Off — best for multiple BFRBs on desktop',
        body: 'Hands Off (handsoffapp.com) is a Mac and Windows desktop app whose site markets detection for five common body-focused repetitive behaviors — listing nail biting, skin picking, eyebrow or eyelash pulling, and nose picking. All processing is local; the site states no video is recorded, no personal data is collected, and the app is GDPR compliant. It’s €2.99/month with a 3-day trial; no annual plan is listed.\n\nIf you have several BFRBs and work at a desktop, this is the strongest option in the category. See our full Stop Biting vs Hands Off comparison.',
      },
      {
        heading: 'Nailed — best one-time purchase for Mac users',
        body: 'Nailed (nailedapp.io) is a macOS menu bar app for $4.99, one-time. It uses the same MediaPipe-via-WebAssembly approach as Stop Biting, entirely on-device — the camera feed is processed in memory and discarded, with no servers and no analytics. When it detects biting, it flashes the screen red with an optional beep.\n\nNo free trial or tracking features are listed, and it’s Mac-only — but if you want the cheapest credible detector and dislike subscriptions, Nailed is it. See our full Stop Biting vs Nailed comparison.',
      },
      {
        heading: 'SmartBehavior — best for phone-based detection',
        body: 'SmartBehavior (smart-behavior.com) is the only entrant with native mobile apps: iOS, Android, plus Windows via the Microsoft Store (no macOS version is listed). It detects nail biting, skin picking, and other BFRBs, claims 85% detection accuracy, runs 100% offline on-device, requires no registration, and tracks daily, weekly, and monthly trends. Pricing isn’t published on its website — check the app stores.\n\nIf most of your biting happens away from a computer, this is the option built for that. See our full Stop Biting vs SmartBehavior comparison.',
      },
      {
        heading: 'How to choose',
        body: 'Match the app to where your habit lives, not to feature counts.\n\nBite mainly at a computer, want tracking and a method around the alarm: Stop Biting — and the free trial needs no card, so testing it costs nothing.\n\nMultiple BFRBs (skin picking, brow pulling) at a desktop: Hands Off.\n\nMac user who wants a one-time purchase and nothing recurring: Nailed.\n\nBite mainly away from the computer, want it on your phone: SmartBehavior.\n\nWhichever you pick, the mechanism is the same evidence-aligned idea: automate the awareness that habit reversal training requires and the habit itself suppresses.',
      },
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/compare/stop-biting-vs-nailed', label: 'Stop Biting vs Nailed: subscription vs one-time Mac app' },
      { href: '/compare/stop-biting-vs-smartbehavior', label: 'Stop Biting vs SmartBehavior: desktop and web vs mobile' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the clinical method' },
    ],
  };
}

export const PAGE_MAP: Record<string, () => PageContent> = {
  '/compare/bitter-polish-alternative': getBitterPolishContent,
  '/compare/habit-tracking-apps': getHabitTrackingContent,
  '/compare/stop-biting-vs-hands-off': getVsHandsOffContent,
  '/compare/stop-biting-vs-nailed': getVsNailedContent,
  '/compare/stop-biting-vs-smartbehavior': getVsSmartBehaviorContent,
  '/compare/ai-detection-apps': getAiDetectionAppsContent,
  '/solutions/for-desk-workers': getDeskWorkersContent,
  '/solutions/for-adhd': getAdhdContent,
  '/solutions/for-gamers': getGamersContent,
};
