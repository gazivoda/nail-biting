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

/**
 * Verbatim copy of MEDICAL_DISCLAIMER_SECTION in src/data/blogPosts.ts.
 *
 * These pages make the same class of health claim the blog posts do (BFRBs,
 * ADHD and stimulant medication, infection risk), so they carry the same
 * wording rather than a second, subtly different one. It is duplicated rather
 * than imported because scripts/generate-seo-content.mjs loads this module on
 * its own; keep the two strings in step if either is edited.
 */
const MEDICAL_DISCLAIMER_SECTION = {
  heading: 'A note on medical advice',
  body: `This article is for general information only and is not medical advice. Nail biting and related body-focused repetitive behaviours (BFRBs) can have medical and psychological dimensions that deserve individual attention. For diagnosis or treatment — of BFRBs, infections, or any condition discussed here — consult a qualified professional: a GP or dermatologist for physical symptoms, or a therapist experienced with BFRBs for the habit itself. The TLC Foundation for Body-Focused Repetitive Behaviors (bfrb.org) maintains a directory of BFRB-informed clinicians.`,
};

function getBitterPolishContent(): PageContent {
  return {
    title: 'Stop Biting vs Bitter Nail Polish: Which Actually Works?',
    subtitle: 'Comparing mechanisms, evidence, and who each approach works for',
    intro: 'Bitter nail polish works on conscious biting and fails on automatic biting: tasting it takes the awareness that was already missing when the episode began. It is still the most widely recommended nail biting remedy, and its trial record is real if thin: two small controlled comparisons — 21 students in 1992, 45 chronic biters in 1996 — that disagree with each other. Habit reversal, the method Stop Biting automates, has far more behind it: a 1980 trial in which self-recorded biting fell by roughly 99% over five months, and a 2011 meta-analysis of 18 studies and 575 participants across habit disorders. Stop Biting is one of several apps that detect nail biting in real time, firing an alarm as the hand approaches the mouth. They solve different problems — and the difference matters for treatment outcomes.',
    sections: [
      {
        heading: 'Why doesn\'t bitter nail polish stop unconscious nail biting?',
        body: 'Because tasting it requires the awareness the habit bypasses: the polish can only act once your finger has reached your mouth, and most chronic biting starts and finishes below conscious attention.\n\nBitter polish works through aversive taste conditioning: the bitter flavor creates an unpleasant association with biting. This works for conscious biting — episodes where your hand is deliberately moving to your mouth and you can taste the polish.\n\nThe problem: most nail biting is automatic. BFRB research distinguishes "automatic" from "focused" biting, and for many chronic biters a large share of episodes happens entirely outside conscious awareness — self-monitoring simply misses them. Bitter polish cannot interrupt an episode you didn\'t know was happening — because the awareness required to taste the polish is the same awareness that was absent when the biting started.\n\nStop Biting\'s AI detection works differently: it provides awareness from outside. The alarm fires before you\'ve bitten, creating the conscious moment that bitter polish requires but cannot generate.',
      },
      {
        heading: 'Which has better evidence: habit reversal training or bitter polish?',
        body: 'Habit reversal training, on the weight of the evidence — but the gap is narrower than the usual framing suggests, and bitter polish has been tested in controlled trials.\n\nHabit Reversal Training (HRT) — the approach whose awareness component Stop Biting automates — is the best-studied behavioural treatment for nail biting. In the landmark trial (Azrin, Nunn & Frantz, 1980), the self-recorded biting episodes of participants fell by roughly 99% over five months — five months being the study duration, not a follow-up after treatment ended — and a 2011 meta-analysis of 18 habit reversal studies covering 575 participants found a large pooled effect from pre-treatment to final post-treatment assessment, across habit disorders generally rather than nail biting alone (Bate et al., Clinical Psychology Review). The Azrin paper has no abstract in PubMed and is paywalled, so those numbers are quoted here from Table 1 of the 2022 review by Lee and Lipner, which is openly readable. All three are linked below.\n\nBitter polish has a real if thin trial record, and it cuts both ways. In a 1992 three-arm comparison of 21 students, mild aversion (bitter polish) and a competing response both improved nail length over self-monitoring alone, with the competing response coming out ahead on skin damage and on how much control participants felt they had. A 1996 replication with 45 non-student chronic biters and an 8-week follow-up found the reverse ordering on nail length: mild aversion reached significance and the competing response just failed to. Anyone who tells you the evidence clearly favours one over the other has read only one of those two papers.\n\nWhat is fair to say: habit reversal has far more studies behind it and is the only approach with a placebo-controlled trial and a genuine post-treatment follow-up, while bitter polish depends on consistent reapplication and is explicitly discouraged in younger children by the standard clinical review. HRT has never been tested head-to-head against physical barriers at all. Bitter polish product details in the table were verified against mavala.com on 10 September 2026.',
        html: '<table><thead><tr><th></th><th>Bitter nail polish</th><th>Stop Biting</th></tr></thead><tbody>' +
          '<tr><td>Mechanism</td><td>Aversive taste — Mavala describes Mavala Stop as a “bitter-tasting, colourless formula that discourages putting fingers in your mouth”</td><td>Real-time on-device AI detection: an alarm fires as the hand approaches the mouth, automating the awareness-training component of habit reversal</td></tr>' +
          '<tr><td>Point in the episode it can act</td><td>Once the finger reaches the mouth and the taste registers</td><td>As the hand approaches, before contact</td></tr>' +
          '<tr><td>Clinical trial evidence</td><td>Two small controlled comparisons: Silber &amp; Haynes 1992 (n=21) favoured a competing response on nail length; Allen 1996 (n=45, 8-week follow-up) found mild aversion significant and the competing response not. No trial has tested durability beyond those</td><td>For habit reversal, the method it automates: Azrin, Nunn &amp; Frantz 1980 (Behav Res Ther 18(4):281–285) and Bate et al. 2011 — 18 studies, 575 participants, large pooled effect (d = 0.80)</td></tr>' +
          '<tr><td>Data it produces</td><td>None</td><td>Timestamped incident log — time of day, frequency, and context of each detected episode</td></tr>' +
          '<tr><td>Main limitation</td><td>Effectiveness typically decreases as taste habituation occurs and the formula wears off</td><td>Only covers the time you spend in front of the camera</td></tr>' +
          '</tbody></table>' +
          '<p><strong>Sources:</strong></p><ul>' +
          '<li>Azrin NH, Nunn RG, Frantz SE. Habit reversal vs. negative practice treatment of nailbiting. <a href="https://pubmed.ncbi.nlm.nih.gov/7436976/" target="_blank" rel="noopener noreferrer">Behav Res Ther. 1980;18(4):281–285</a>. PubMed holds no abstract for this record and the full text is paywalled, so the 99% and 60% figures quoted on this page are taken from Table 1 of <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8953487/" target="_blank" rel="noopener noreferrer">Lee DK, Lipner SR. Int J Environ Res Public Health. 2022;19(6):3392</a>, which is open access.</li>' +
          '<li><a href="https://pubmed.ncbi.nlm.nih.gov/21549664/" target="_blank" rel="noopener noreferrer">Bate KS, Malouff JM, Thorsteinsson ET, Bhullar N. The efficacy of habit reversal therapy for tics, habit disorders, and stuttering: a meta-analytic review. Clin Psychol Rev. 2011;31(5):865–871.</a></li>' +
          '<li><a href="https://pubmed.ncbi.nlm.nih.gov/1540108/" target="_blank" rel="noopener noreferrer">Silber KP, Haynes CE. Treating nailbiting: a comparative analysis of mild aversion and competing response therapies. Behav Res Ther. 1992;30(1):15–22.</a></li>' +
          '<li><a href="https://pubmed.ncbi.nlm.nih.gov/8881096/" target="_blank" rel="noopener noreferrer">Allen KW. Chronic nailbiting: a controlled comparison of competing response and mild aversion treatments. Behav Res Ther. 1996;34(3):269–272.</a></li>' +
          '<li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8953487/" target="_blank" rel="noopener noreferrer">Lee DK, Lipner SR. Update on Diagnosis and Management of Onychophagia and Onychotillomania. Int J Environ Res Public Health. 2022;19(6):3392.</a></li>' +
          '</ul>',
      },
      {
        heading: 'When is bitter nail polish worth using?',
        body: 'When the biting is conscious and the timeframe is short: before a high-stakes event, for children who bite deliberately, or for mild, occasional biters.\n\nBitter polish is useful as a short-term physical barrier before high-stakes situations: job interviews, presentations, social events where you\'d particularly notice your nail condition. It provides an aversive signal during the awareness window — after the hand has reached the mouth but before the bite completes.\n\nFor children whose biting is primarily conscious and deliberate rather than automatic, bitter polish can interrupt the habit effectively, particularly when combined with positive reinforcement.\n\nFor mild, occasional nail biters who bite consciously, bitter polish may be sufficient.',
      },
      {
        heading: 'What can AI detection do that bitter polish can\'t?',
        body: 'Stop Biting catches unconscious episodes — the majority of biting for most chronic biters. It generates incident data (how often, what time, what context) that makes treatment targeted rather than generic. It provides the external awareness signal that is the cornerstone of HRT.\n\nIt also works in contexts where polish doesn\'t: gaming (wearing headphones, can\'t taste), computer work (hands clean, polish worn off after washing), drinking or eating during sessions.\n\nThe two approaches aren\'t mutually exclusive. Some users use Stop Biting for computer-context biting and bitter polish as a backup for other contexts.',
      },
      {
        heading: 'Should I use bitter polish or an AI detection app?',
        body: 'Bitter polish if your biting is occasional and conscious; AI detection if it is chronic and automatic.\n\nBitter polish is the right starting point for: occasional conscious biters, children, situations requiring a simple physical barrier, or as an adjunct to other approaches.\n\nStop Biting is the right choice for: chronic automatic biters, desk workers who bite during focus, people who\'ve tried bitter polish and it didn\'t stick, anyone who wants the evidence-based HRT approach with automated awareness rather than willpower.',
      },
      faqSection(
        'Short answers to the questions this comparison is most often asked. Each one restates what the sections above argue in full.',
        [
          ['Does bitter nail polish actually stop nail biting?', 'It stops conscious biting while the taste lasts. It cannot interrupt an episode you didn’t know was happening, and effectiveness typically decreases as taste habituation occurs and the formula wears off.'],
          ['Why does bitter polish stop working after a while?', 'Taste habituation, plus the formula wearing off. No large-scale clinical trial has established lasting efficacy beyond the initial novelty period.'],
          ['Is bitter nail polish a good option for children?', 'It can be. For children whose biting is primarily conscious and deliberate rather than automatic, bitter polish can interrupt the habit effectively, particularly when combined with positive reinforcement.'],
          ['Can you use bitter polish and an AI detection app together?', 'Yes — the two approaches aren’t mutually exclusive. Some users run Stop Biting for computer-context biting and keep bitter polish as a backup for other contexts.'],
        ],
      ),
      verificationSection('Product details on this page were verified against Mavala\'s own product page (mavala.com) on 10 September 2026 — the description quoted in the table is Mavala\'s own wording. The habit reversal figures come from the two peer-reviewed papers linked in full in the evidence comparison above; we re-check competitor details quarterly and date them here so you can see how fresh they are. Formulations and packaging change — confirm on the vendor\'s own site before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
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
    intro: 'Habit tracking apps don’t work well for nail biting because you can only log the episodes you notice, and most biters catch fewer than half their daily episodes through self-monitoring — so a manual log records a sample, not the habit. They are popular, and they work well for deliberate behaviors you want to build or break consciously. Automatic detection writes the entry instead: after 7 days the log shows actual peak times, actual context patterns and actual frequency, measured in bite-free hours and minutes rather than the whole days a daily streak counts.',
    sections: [
      {
        heading: 'Why can’t a habit tracker log nail biting accurately?',
        body: 'Because logging requires noticing first, and self-monitoring misses most episodes: most biters catch fewer than half their daily episodes.\n\nHabit tracking apps like Habitica and Streaks require you to log each biting episode manually. Habitica’s own App Store listing describes the loop plainly: “When you do something in real life, check it off in the app.” This creates an immediate problem: you can only log episodes you notice.\n\nResearch on nail biting awareness is clear: most biters catch fewer than half their daily episodes through self-monitoring. The habit is automatic — it runs in the basal ganglia, not the prefrontal cortex. Episodes begin and complete below conscious awareness. By the time you notice you\'ve been biting, the episode is already over.\n\nManual tracking records the episodes you noticed. It provides no data on the ones you didn\'t. For a habit that is primarily automatic, this is the majority of episodes.\n\nStreaks details in the table were verified against streaksapp.com on 10 September 2026.',
        html: '<table><thead><tr><th></th><th>Manual habit trackers</th><th>Stop Biting</th></tr></thead><tbody>' +
          '<tr><td>How an episode gets recorded</td><td>You notice it, then log it yourself</td><td>Detected automatically by on-device AI and written to a timestamped log</td></tr>' +
          '<tr><td>Episodes it can capture</td><td>Only the ones that reached your conscious attention</td><td>Episodes that happen in front of the camera, whether or not you noticed them</td></tr>' +
          '<tr><td>Automatic tracking</td><td>Limited to what a phone or watch already measures — Streaks lists Apple Health goals such as steps, heart rate and blood pressure</td><td>The target behaviour itself is what gets detected</td></tr>' +
          '<tr><td>Streak unit</td><td>Whole days — Streaks states “Don’t break the chain, or your streak will reset to zero days”</td><td>Bite-free hours and minutes</td></tr>' +
          '<tr><td>Best suited to</td><td>Deliberate, scheduled behaviours: exercise, meditation, reading, water intake</td><td>Automatic behaviours that begin and finish below conscious awareness</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Why is my real nail biting frequency higher than I think?',
        body: 'Because episodes that never reach consciousness never reach self-report. When users start Stop Biting, detected frequency is typically much higher than they expected before they measured it.\n\nThis isn\'t a calibration error — it\'s a fundamental feature of automatic habits. The episodes that don\'t reach consciousness don\'t register in self-report. Manual tracking enforces this gap into the data by design.\n\nThe implication for treatment: if your data captures only a fraction of your actual biting episodes, your awareness of the pattern is distorted, your triggers are misidentified, and your sense of progress is wrong.',
      },
      {
        heading: 'What are habit tracking apps actually good for?',
        body: 'Habit trackers work well for behaviors that are deliberate and scheduled: exercise, meditation, reading, water intake. These behaviors happen with full awareness and can be recorded in real time.\n\nFor nail biting, habit trackers can still provide value as a journaling tool — recording the episodes you do notice, along with context and emotional state. This is useful data. It\'s just incomplete data.\n\nSome nail biters use a hybrid approach: Stop Biting for automatic detection during computer use (where most biting occurs for desk workers), and a habit diary for off-screen episodes.',
      },
      {
        heading: 'How does automatic detection change the data you get?',
        body: 'It replaces a sample with a complete record. Stop Biting generates the incident log automatically. Each time the AI detects a biting episode and sounds the alarm, a timestamped entry is created. After each session, incidents can be tagged with trigger categories.\n\nThis produces a complete data set — not a sample of the episodes you happened to notice. After 7 days, the log shows actual peak times, actual context patterns, and actual frequency. The difference between estimated and actual frequency is often the insight that makes users finally commit to structured treatment.',
      },
      {
        heading: 'Why don’t daily streaks work for nail biting?',
        body: 'Because a daily yes-or-no streak breaks immediately — it’s nearly impossible to go a full day without any biting in the first weeks of treatment — so it gives you no useful feedback.\n\nMost habit trackers measure streaks in days: did you complete the habit today? For nail biting cessation, a daily binary isn\'t useful — it\'s nearly impossible to go a full day without any biting in the first weeks of treatment, so the streak breaks immediately and provides no useful feedback.\n\nStop Biting tracks bite-free periods in hours and minutes. A 3-hour streak while working, then an alarm, then a 4-hour streak — this is the granularity that makes progress visible and gives users something to extend rather than something they\'ve already failed.',
      },
      faqSection(
        'Short answers to the questions this page is most often asked, drawn from the sections above and from the same 10 September 2026 vendor check.',
        [
          ['Can I use a habit tracker to quit nail biting?', 'You can, as a journaling tool: it records the episodes you do notice, along with context and emotional state. That is useful data — it is just incomplete data for a habit that mostly runs below awareness.'],
          ['What’s the difference between manual logging and AI detection?', 'Manual logging captures only the episodes that reached your conscious attention. On-device AI detection writes a timestamped entry whenever it sees the behaviour in front of the camera, whether or not you noticed it.'],
          ['Do Habitica or Streaks track nail biting automatically?', 'Their automatic tracking covers what a phone or watch already measures — Streaks lists Apple Health goals such as steps, heart rate and blood pressure. Habitica’s own App Store listing describes the loop as checking a task off yourself.'],
          ['Can I use a habit tracker and a detection app together?', 'Yes. Some nail biters run Stop Biting for automatic detection during computer use and keep a habit diary for off-screen episodes.'],
        ],
      ),
      verificationSection('Streaks details on this page were verified against streaksapp.com on 10 September 2026, and both quotations are Streaks’ own wording. The Habitica quotation comes from Habitica’s App Store listing rather than habitica.com, because habitica.com serves almost no text to anything that doesn’t run JavaScript — we would rather name the source we could actually read than imply a check we couldn’t perform. We re-check these details quarterly and date them here. Features change — confirm on the vendor’s own site before deciding.'),
      MEDICAL_DISCLAIMER_SECTION,
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
    // "solves it" outran the body, which says detection covers "the hours where
    // a large share of the habit lives" — the time in front of the camera, not
    // the whole habit. The verb the body actually uses is "interrupts".
    subtitle: 'Why desk workers bite during deep focus — and how webcam detection interrupts it',
    intro: 'To stop nail biting at your desk, let your webcam do the noticing: Stop Biting fires an alarm as your hand approaches your mouth, and you answer it by pressing both palms flat on the desk for 60 seconds — long enough for the urge to pass, which typically takes 20–60 seconds. Desk workers have a specific problem: the mental states that make work productive are the same states that make nail biting invisible. Deep focus, meeting fatigue, and long keyboard sessions are among the highest-risk contexts for the habit.',
    sections: [
      {
        heading: 'Why do I bite my nails while working at a computer?',
        body: 'Because deep focus occupies the prefrontal cortex, self-monitoring goes offline, and the habit runs automatically and invisibly — for minutes at a time — during your most productive moments.\n\nThe prefrontal cortex handles two things simultaneously: your work task and your self-monitoring (the ability to notice your own behavior). When you\'re in deep focus — debugging code, writing a difficult email, analyzing data — your prefrontal cortex is fully occupied with the task.\n\nSelf-monitoring goes offline. The basal ganglia, which stores and executes automatic habits, operates without inhibition. The result: nail biting runs automatically, invisibly, for minutes at a time. You don\'t notice until the damage is done.\n\nThis is why desk workers who bite report that their worst biting happens during their most productive moments.',
      },
      {
        heading: 'How does a webcam app stop nail biting at your desk?',
        body: 'It supplies the awareness self-monitoring couldn\'t: the app watches your existing webcam locally and fires an audible alarm the moment it detects your hand approaching your mouth.\n\nIf you work at a computer, you already have everything you need for AI-assisted habit detection. Stop Biting runs in a browser tab using your existing webcam.\n\nThe app processes your webcam feed locally — nothing is transmitted — and fires an audible alarm when it detects your hand approaching your mouth. The alarm interrupts the automatic habit chain at the exact moment of occurrence, creating the awareness window that self-monitoring couldn\'t provide.\n\nFor desk workers, Stop Biting covers the hours where a large share of the habit lives — the time spent in front of a computer.',
      },
      {
        heading: 'What should you do when the alarm fires at your desk?',
        body: 'Press both palms flat on the desk and hold for 60 seconds — physically incompatible with biting, no equipment needed, and it doesn\'t interrupt typing.\n\nWhen the alarm fires, you need a competing response — a behavior physically incompatible with nail biting that you can execute without interrupting your work.\n\nThe most effective competing response for desk work: pressing both palms flat on the desk and holding for 60 seconds. It provides strong proprioceptive input, is physically incompatible with biting, requires no equipment, and doesn\'t interrupt typing or focus. Hold it while the urge passes (typically 20–60 seconds).\n\nAlternatives: interlacing fingers and pressing together under the desk (invisible on camera), gripping a pen, or keeping a resistance ball accessible on the desk.',
        html: '<table><thead><tr><th>Competing response</th><th>Why it fits desk work</th><th>Equipment</th></tr></thead><tbody>' +
          '<tr><td>Both palms flat on the desk, held for 60 seconds</td><td>Strong proprioceptive input, physically incompatible with biting, and doesn’t interrupt typing or focus</td><td>None</td></tr>' +
          '<tr><td>Fingers interlaced and pressed together under the desk</td><td>Same physical incompatibility, and invisible on camera during video calls</td><td>None</td></tr>' +
          '<tr><td>Gripping a pen, or a resistance ball kept within reach</td><td>Occupies the hand at the desk while the urge passes</td><td>A pen or resistance ball</td></tr>' +
          '</tbody></table>',
      },
      faqSection(
        'Short answers to the questions desk workers ask most, each one restating what the sections above explain in full.',
        [
          ['Where does most desk-worker nail biting happen?', 'During deep focus — debugging code, writing a difficult email, analyzing data — when the prefrontal cortex is fully occupied by the task and self-monitoring is offline.'],
          ['Does Stop Biting work on a work laptop?', 'It runs in a browser tab, with no install, using the webcam already on the machine.'],
          ['Is my webcam footage sent anywhere?', 'No. The app processes your webcam feed locally — nothing is transmitted.'],
          ['How do I stop biting during video calls?', 'Interlace your fingers and press them together under the desk: the same physical incompatibility as the palm press, and invisible on camera. Hold it while the urge passes, typically 20–60 seconds.'],
        ],
      ),
      verificationSection('This page was last reviewed on 10 September 2026. It names no competitor product and quotes no vendor, so there is nothing here to check against a vendor site: the competing responses described are standard habit reversal techniques, not proprietary features. Where we do compare Stop Biting to named products — on our comparison pages — every competitor detail is re-verified against that vendor’s own site quarterly and dated on the page.'),
      MEDICAL_DISCLAIMER_SECTION,
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
    intro: 'ADHD makes nail biting harder to stop in three specific ways: executive function gaps reduce awareness, dopamine-seeking reinforces the habit, and hyperfocus states deplete self-monitoring most severely. Real-time AI detection compensates for exactly these gaps: the camera catches episodes independently of your attention state, so the only step left is running the competing response — which for ADHD often works better as sensory input, a textured fidget or chewing gum, than as physical incompatibility alone.',
    sections: [
      {
        heading: 'Why is nail biting harder to stop with ADHD?',
        body: 'The core challenge with nail biting is awareness: most episodes happen automatically, below conscious attention. ADHD adds three layers on top of this.\n\nFirst, executive function deficits. Stopping an automatic behavior requires noticing it, deciding to do something different, and maintaining that decision. Working memory, inhibitory control, and cognitive flexibility — all impaired in ADHD — handle this process. Standard HRT requires all three to work consistently.\n\nSecond, dopamine seeking. ADHD involves dysregulation of the dopamine system, creating chronic understimulation. Nail biting delivers a reliable proprioceptive dopamine bump — genuinely useful for an understimulated ADHD brain. This makes the habit more reinforced, not less.\n\nThird, the hyperfocus problem. ADHD hyperfocus states produce the deepest awareness gaps of any context. During hyperfocus, self-monitoring essentially shuts down — which is when the most biting occurs.',
      },
      {
        heading: 'Why doesn\'t willpower work for ADHD nail biting?',
        body: 'Willpower requires sustained inhibitory control — exactly the executive function most impaired by ADHD. Approaches that depend on "just notice and stop" ask for the cognitive resource ADHD makes least available.\n\nBitter polish fails for a related reason: it requires the awareness that ADHD depletes. You have to notice your hand is in your mouth to taste the polish. During hyperfocus, you don\'t notice. The polish is irrelevant.\n\nHRT works better for ADHD — but only when the awareness component is externalized. Self-awareness training, which works in neurotypical people, is insufficient when the awareness gap is neurological rather than attentional.',
        html: '<table><thead><tr><th>ADHD factor</th><th>Why willpower and bitter polish fall short</th><th>What externalised detection changes</th></tr></thead><tbody>' +
          '<tr><td>Executive function — working memory, inhibitory control, cognitive flexibility</td><td>“Just notice and stop” asks for all three at once, and these are the resources ADHD makes least available</td><td>The alarm supplies the noticing, so the only step left is running the competing response</td></tr>' +
          '<tr><td>Dopamine seeking</td><td>Stopping the behaviour removes the proprioceptive stimulation it was providing, with nothing in its place</td><td>The competing response can be sensory-matched — a textured fidget, chewing gum — rather than generic palm pressing</td></tr>' +
          '<tr><td>Hyperfocus</td><td>Self-monitoring goes offline, so the polish is never tasted and the episode is never noticed</td><td>The camera catches episodes independently of your attention state</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'How does AI detection help ADHD nail biters?',
        body: 'Stop Biting\'s AI detection externalizes the awareness component. Instead of relying on your attention to catch biting episodes, the camera and MediaPipe model catch them for you — independent of your attention state.\n\nFor ADHD users, this is the critical difference. The alarm fires during hyperfocus when self-monitoring is offline. It fires later in the day, in the window many people taking stimulant medication describe as their hardest. It fires during the specific states where ADHD makes the habit hardest to catch.\n\nThe competing response can then be designed for ADHD specifically: sensory-matching options (textured fidgets, chewing gum) that address the dopamine-seeking function the biting is serving, rather than generic palm pressing.',
      },
      {
        heading: 'How should ADHD users set up nail biting detection?',
        body: 'Run Stop Biting during your main work sessions — this is typically when ADHD users are most at risk (hyperfocus states, working without breaks). Keep the alarm loud enough to break through headphones if you use them.\n\nFor the competing response, ADHD users often do better with sensory input rather than physical incompatibility alone: a mesh fidget ring on the dominant hand, chewing gum during work sessions, or a rough-textured stress ball within reach. These address the sensory-seeking function.\n\nTrack which times of day show the most incidents. Many ADHD users report the late afternoon as their hardest window, particularly if they take stimulant medication earlier in the day — but treat that as a common pattern to check against your own log, not a rule. Preparing a specific competing response before your own peak period works better than trying to improvise one in the moment.',
      },
      faqSection(
        'Short answers to the questions ADHD nail biters ask most. Each restates what the sections above set out in full, and none of it is medical advice.',
        [
          ['Why is nail biting worse during hyperfocus?', 'ADHD hyperfocus states produce the deepest awareness gaps of any context: self-monitoring essentially shuts down, which is when the most biting occurs.'],
          ['Does bitter nail polish work if you have ADHD?', 'It requires the awareness ADHD depletes — you have to notice your hand is in your mouth to taste it. During hyperfocus you don’t notice, so the polish is irrelevant.'],
          ['Does habit reversal training work for ADHD?', 'It works better for ADHD, but only when the awareness component is externalised. Self-awareness training that works in neurotypical people is insufficient when the awareness gap is neurological rather than attentional.'],
          ['What competing response works best for ADHD?', 'Sensory input rather than physical incompatibility alone: a mesh fidget ring on the dominant hand, chewing gum during work sessions, or a rough-textured stress ball within reach.'],
        ],
      ),
      verificationSection('This page was last reviewed on 10 September 2026. It refers to bitter polish as a general category rather than to any named product, so it carries no vendor pricing or feature claims to verify. The medication-rebound timing described above is presented as a pattern ADHD users commonly report and something to check against your own incident log — not as a pharmacological finding, and not as a substitute for advice from the clinician who prescribes your medication.'),
      MEDICAL_DISCLAIMER_SECTION,
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
    intro: 'Gaming is one of the worst nail biting contexts because it\'s designed to capture exactly the cognitive state that makes automatic habits invisible: in flow, self-monitoring goes offline, and the highest-risk windows are loading screens and queue waits, high-stakes competitive moments, and the frustration after a death or loss. Bitter polish, gloves and phone reminders each need something gaming takes away — taste, finger precision, audibility, or spare attention. Stop Biting runs in a browser tab beside the game, on the webcam you already have, with the alarm volume set loud enough to cut through headphones.',
    sections: [
      {
        heading: 'Why do I bite my nails while gaming?',
        body: 'Gaming creates a constellation of nail biting conditions simultaneously: sustained deep focus (awareness offline), repeated micro-stress moments (loading screens, competitive pressure), hands near the keyboard and face, and an activity compelling enough that no other behavior gets conscious attention.\n\nThe flow state that makes gaming enjoyable is the same state that makes nail biting invisible. During a raid, a ranked match, or a puzzle sequence, the prefrontal cortex is entirely occupied. Self-monitoring isn\'t running. By the time you notice you\'ve been biting, you\'re already minutes into an episode.',
      },
      {
        heading: 'When is nail biting most likely during a gaming session?',
        body: 'The highest-risk windows are loading screens and queue waits (boredom plus anticipation anxiety), high-stakes competitive moments (acute stress without physical outlet), frustration after a death or loss, and passive spectating of cutscenes. Not all gaming moments carry equal risk.\n\nLoading screens deserve specific attention: they\'re short enough that a full biting episode can complete before the screen returns, but frequent enough to add up across a session.',
      },
      {
        heading: 'Why don\'t bitter polish, gloves or phone reminders work while gaming?',
        body: 'Each one needs something gaming takes away — taste, finger precision, audibility, or spare attention.\n\nBitter polish: loses effectiveness if you eat or drink during sessions. Physical barriers: gloves and finger wraps interfere with keyboard and mouse precision. Phone reminders: inaudible with headphones, break flow. Willpower: gaming\'s attentional demands are specifically calibrated to exclude self-monitoring.\n\nAny solution requiring you to generate awareness internally will fail. Gaming exports all available awareness to the game.',
        html: '<table><thead><tr><th>Approach</th><th>How it behaves during a gaming session</th></tr></thead><tbody>' +
          '<tr><td>Bitter nail polish</td><td>Loses effectiveness if you eat or drink during the session</td></tr>' +
          '<tr><td>Gloves or finger wraps</td><td>Interfere with keyboard and mouse precision</td></tr>' +
          '<tr><td>Phone reminders</td><td>Inaudible under headphones, and they break flow</td></tr>' +
          '<tr><td>Willpower and self-monitoring</td><td>Gaming’s attentional demands are calibrated to exclude self-monitoring</td></tr>' +
          '<tr><td>Stop Biting (webcam AI detection)</td><td>Runs in a browser tab beside the game; alarm volume is adjustable so it cuts through headphones, and you return to play immediately</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Can an app detect nail biting while you play?',
        body: 'Yes — if you\'re gaming on a computer, you already have the webcam it needs. Stop Biting runs in a browser tab alongside your game, using that webcam to detect nail biting and fire an audible alarm — without interrupting gameplay.\n\nThe alarm is loud enough to cut through headphones (adjust your alarm volume in settings). It breaks the automatic habit chain at the moment of occurrence, then you return to the game immediately. No interruption, no context switch required.\n\nOver several weeks of consistent alarm-based interruption during gaming sessions, the habit\'s automaticity in that specific context weakens.',
      },
      faqSection(
        'Short answers to the questions gamers ask most, each one restating what the sections above explain in full.',
        [
          ['Will the alarm interrupt my game?', 'It breaks the automatic habit chain at the moment of occurrence, then you return to the game immediately — no interruption and no context switch. The app runs in a browser tab beside the game.'],
          ['Can I hear the alarm through headphones?', 'Yes. The alarm is loud enough to cut through headphones, and you set the volume in settings.'],
          ['Do I have to stop gaming to stop biting my nails?', 'No. Over several weeks of consistent alarm-based interruption during gaming sessions, the habit’s automaticity in that specific context weakens.'],
        ],
      ),
      verificationSection('This page was last reviewed on 10 September 2026. The remedies compared above — bitter polish, gloves and finger wraps, phone reminders — are general categories rather than named competitor products, so this page carries no vendor pricing or feature claims to check. Where we do name a competitor, on our comparison pages, every detail is re-verified against that vendor’s own site quarterly and dated on the page.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-gaming', label: 'Nail biting while gaming: why it happens and how to stop' },
      { href: '/blog/nail-biting-screen-time', label: 'How screens and phones make nail biting worse' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the evidence-based approach' },
      { href: '/how-it-works', label: 'How Stop Biting\'s detection works' },
    ],
  };
}

function getStudentsContent(): PageContent {
  return {
    title: 'Stop Nail Biting as a Student: Exams, Laptops and Late Nights',
    subtitle: 'Studying is long, screen-heavy and stressful, which is when automatic biting runs unnoticed: how webcam detection fits a student’s week',
    intro: 'Students bite most where studying puts them: alone, at a laptop, working through hard problems for hours. In one study of 40 undergraduate biters, participants bit most when left alone and while working on maths problems, which are better-evidenced triggers than stress alone. Bitter polish wears off between study sessions and a phone reminder needs attention you are spending on the exam, so the useful fix is an interruption that does not depend on remembering. Stop Biting uses your laptop webcam and on-device AI to sound an alarm the moment your hand reaches your mouth, with a 3-day free trial and no card, then $2.99/month or $29/year.',
    sections: [
      {
        heading: 'Why do I bite my nails while studying?',
        body: 'Studying stacks the conditions that run an automatic habit: you are alone, your attention is fully on the page, and your hands are idle near your face. Biting needs no decision, so it carries on while your awareness is on the material. Our exam-season guide covers the evidence in detail, including the 40-undergraduate study above.\n\nThat is also why willpower fails during revision: self-monitoring is the thing the work is using up.',
      },
      {
        heading: 'Where do students bite the most?',
        body: 'The highest-risk moments are the long solo stretches: a revision block at your desk, a problem set that is not working, reading a dense chapter, and the hour before a deadline. Lecture halls and libraries matter less than your own room, because being alone raised biting in the study above.',
      },
      {
        heading: 'Why don’t bitter polish and reminders work for students?',
        body: 'Each one needs something a student cannot spare during exam weeks: reapplication, a working taste barrier, or spare attention.',
        html: '<table><thead><tr><th>Approach</th><th>How it behaves in a student week</th></tr></thead><tbody>' +
          '<tr><td>Bitter nail polish</td><td>Needs reapplying, and stops working once you eat or drink during a session</td></tr>' +
          '<tr><td>Phone reminders</td><td>Rely on you noticing them, and phones are a distraction during revision</td></tr>' +
          '<tr><td>Willpower and self-monitoring</td><td>Compete with the focus the exam work needs</td></tr>' +
          '<tr><td>Stop Biting (webcam AI detection)</td><td>Runs in a browser tab on your laptop and interrupts the moment your hand nears your mouth, so you do not have to remember</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Can an app detect nail biting while I revise?',
        body: 'Yes, if you study on a laptop or desktop with a webcam. Stop Biting runs in a browser tab or as a Mac or Windows app, uses the webcam to detect nail biting, and fires an audible alarm. Detection runs on your device, and no camera data is sent anywhere while it runs, which you can check in your browser’s network monitor.\n\nThe honest limit: it only works where a webcam can see your hand. In a quiet library, turn the alarm volume down or keep detection for your own room, and it will not see biting on your phone or in lectures.',
      },
      faqSection(
        'Short answers to what students ask most, each restating what the sections above explain.',
        [
          ['Will it work on a shared or quiet study space?', 'The alarm volume is adjustable, but it is audible by design. Many students keep detection for their own room and desk, where most solo studying happens.'],
          ['Does it send my webcam video anywhere?', 'No. Detection runs on your device and no camera data is sent while it runs.'],
          ['What does it cost?', 'A 3-day free trial with no credit card, then $2.99/month or $29/year.'],
          ['Will it catch biting during lectures or on my phone?', 'No. It only sees what your laptop webcam can see.'],
        ],
      ),
      verificationSection('This page was last reviewed on 5 October 2026. The remedies compared above, bitter polish and phone reminders, are general categories rather than named competitor products, so this page carries no vendor pricing or feature claims to check. The undergraduate study is described in our exam-season guide, which lists its source.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-during-exams', label: 'Nail biting during exams: why stress season makes it worse' },
      { href: '/blog/nail-biting-college-students', label: 'Nail biting in college students' },
      { href: '/solutions/for-desk-workers', label: 'Stop nail biting at your desk' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the evidence-based approach' },
      { href: '/how-it-works', label: 'How Stop Biting’s detection works' },
    ],
  };
}

function getRemoteWorkersContent(): PageContent {
  return {
    title: 'Stop Nail Biting Working From Home: Laptops, Calls and Home Offices',
    subtitle: 'Working from home removes the audience that used to stop you biting: how webcam detection fits a remote workday',
    intro: 'Remote work puts the three biggest nail biting conditions in one place: long stretches of focused screen work, idle hands near your face and nobody around to notice. Bitter polish is washed off by lunch and a phone reminder asks for attention you are spending on the work, so the fix that holds up is an interruption that does not depend on remembering. Stop Biting uses the webcam you already have and on-device AI to sound an alarm the moment your hand reaches your mouth, with a 3-day free trial and no card, then $2.99/month or $29/year. One honest limit up front: whether detection can run while a video call is using your camera depends on your operating system and call software, so test that before you rely on it.',
    sections: [
      {
        heading: 'Why do I bite my nails more when I work from home?',
        body: 'At home the conditions line up: hours of deep focus, hands resting by the keyboard and a mouth within reach, with no colleagues in view. Biting is automatic, so it continues while your attention is on the task. Our working-from-home and screen-time guides cover the pattern in more detail.\n\nIn an office, being seen is a quiet brake on the habit. A home office has no such brake, and willpower is the thing the work is already using up.',
      },
      {
        heading: 'Which parts of a remote workday are the riskiest?',
        body: 'The common high-risk stretches are solo deep-work blocks, reading long documents or email, waiting on a build, a download or a slow page, and the lull between meetings. Video calls and meetings are their own case, which our meetings guide covers separately.',
      },
      {
        heading: 'Why don’t bitter polish and reminders work for remote workers?',
        body: 'Each one needs something a working day takes away: a taste barrier that survives meals and handwashing, or attention you can spare.',
        html: '<table><thead><tr><th>Approach</th><th>How it behaves across a remote workday</th></tr></thead><tbody>' +
          '<tr><td>Bitter nail polish</td><td>Wears off with eating, drinking and handwashing, and needs reapplying</td></tr>' +
          '<tr><td>Phone reminders</td><td>Rely on you noticing them, and a phone on the desk is a distraction</td></tr>' +
          '<tr><td>Willpower and self-monitoring</td><td>Compete with the focus the work needs</td></tr>' +
          '<tr><td>Stop Biting (webcam AI detection)</td><td>Runs in a browser tab or as a Mac or Windows app on the laptop you already work on, and interrupts the moment your hand nears your mouth</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Can an app detect nail biting while I work?',
        body: 'Yes, on a laptop or desktop with a webcam. Stop Biting runs in a browser tab or as a Mac or Windows app, uses the webcam to detect nail biting and fires an audible alarm. Detection runs on your device and no camera data is sent anywhere while it runs, which you can check in your browser’s network monitor.\n\nThe limits: it only sees what your webcam sees, so it will not catch biting on your phone or away from the desk. During a video call, whether another app can use the camera at the same time varies by operating system and call software, so check that on your own setup before counting on it.',
      },
      faqSection(
        'Short answers to what remote workers ask most, each restating what the sections above explain.',
        [
          ['Does it work during video calls?', 'It depends on your operating system and call software, because both want the camera. Test it on your own setup first. It does not depend on the call itself: it works alongside your normal screen work.'],
          ['Does it send my webcam video anywhere?', 'No. Detection runs on your device and no camera data is sent while it runs.'],
          ['What does it cost?', 'A 3-day free trial with no credit card, then $2.99/month or $29/year.'],
          ['Will it catch biting away from my desk?', 'No. It only sees what your laptop webcam can see.'],
        ],
      ),
      verificationSection('This page was last reviewed on 5 October 2026. The remedies compared above, bitter polish and phone reminders, are general categories rather than named competitor products, so this page carries no vendor pricing or feature claims to check. We have not made a claim about running detection and a video call at the same time, because that depends on the user’s own setup.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-laptop-working-from-home', label: 'Nail biting on your laptop while working from home' },
      { href: '/blog/nail-biting-at-work-meetings', label: 'Nail biting during meetings and video calls' },
      { href: '/blog/nail-biting-screen-time', label: 'How screens and phones make nail biting worse' },
      { href: '/solutions/for-desk-workers', label: 'Stop nail biting at your desk' },
      { href: '/how-it-works', label: 'How Stop Biting’s detection works' },
    ],
  };
}

function getMacContent(): PageContent {
  return {
    title: 'Stop Nail Biting on a Mac: Webcam Detection in Your Browser',
    subtitle: 'Your Mac already has the sensor this needs: how on-device webcam detection works in a browser tab, and where it stops',
    intro: 'Stop Biting runs on a Mac in a browser tab, with no install: you allow the camera, keep the tab open while you work, and an alarm sounds the moment your hand reaches your mouth. Most Macs have a built-in camera; a Mac mini or Mac Studio needs an external webcam. Detection runs on your device and no camera data is sent anywhere while it runs, which you can check in your browser’s network monitor. There is a 3-day free trial with no credit card, then $2.99/month or $29/year.',
    sections: [
      {
        heading: 'Can I use Stop Biting on a Mac?',
        body: 'Yes. Open stopbiting.today in a modern browser on your Mac, sign in with Google, allow camera access and start detection. It works as a web app (PWA), so there is nothing to download or install, and you can add it to your Dock or home screen from the browser if you want it one click away.\n\nKeep the tab open while you work. Detection only runs while the page is open and the camera is on.',
      },
      {
        heading: 'What does a Mac need to run it?',
        body: 'A modern browser, a camera that can see your hands and your face, and a few minutes for the AI models to download the first time (about 20 MB, once). A MacBook or iMac has a built-in camera. A Mac mini or Mac Studio has none, so you would plug in an external webcam.\n\nPlace the camera so your hands are in view when they rise towards your mouth. A camera that only sees your face will miss the hand.',
      },
      {
        heading: 'How is a webcam app different from a Mac menu bar app?',
        body: 'Both watch for the same moment. The difference is where they live and what else they do. A menu bar app sits in the system bar; Stop Biting is a web app that also runs on Windows and in any browser, keeps bite-free streaks and a timestamped incident history, and pairs the alarm with habit reversal guides.\n\nWe compare the Mac-specific options honestly on their own pages, with every competitor detail checked against the vendor’s site.',
        html: '<p>See <a href="/compare/stop-biting-vs-nailed">Stop Biting vs Nailed</a> (a Mac menu bar app) and <a href="/compare/stop-biting-vs-hands-off">Stop Biting vs Hands Off</a>.</p>',
      },
      {
        heading: 'Where does webcam detection stop working?',
        body: 'It only sees what the camera sees. It will not catch biting on your phone, in a lecture hall or away from the Mac. If a video call is using your camera, whether the two can share it depends on your browser and call software, so test it before relying on it.',
      },
      faqSection(
        'Short answers to what Mac users ask most, each restating what the sections above explain.',
        [
          ['Do I need to install anything on my Mac?', 'No. It runs in a browser tab as a web app. You can add it to your Dock from the browser if you like.'],
          ['Does it send my webcam video anywhere?', 'No. Detection runs on your device and no camera data is sent while it runs.'],
          ['Does my Mac need a camera?', 'Yes. MacBooks and iMacs have one built in; a Mac mini or Mac Studio needs an external webcam.'],
          ['What does it cost?', 'A 3-day free trial with no credit card, then $2.99/month or $29/year.'],
        ],
      ),
      verificationSection('This page was last reviewed on 6 October 2026. It describes the browser version only. It names two competitors only to link to the pages where their details are checked against their own sites, and makes no claim about either here.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/solutions/for-windows', label: 'Stop nail biting on Windows' },
      { href: '/compare/stop-biting-vs-nailed', label: 'Stop Biting vs Nailed: subscription vs a Mac menu bar app' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/solutions/for-remote-workers', label: 'Stop nail biting working from home' },
      { href: '/how-it-works', label: 'How Stop Biting’s detection works' },
    ],
  };
}

function getWindowsContent(): PageContent {
  return {
    title: 'Stop Nail Biting on Windows: Webcam Detection in Your Browser',
    subtitle: 'A Windows laptop or desktop with a webcam is all this needs: how on-device detection works in a browser tab, and where it stops',
    intro: 'Stop Biting runs on Windows in a browser tab, with no install: you allow the camera, keep the tab open while you work, and an alarm sounds the moment your hand reaches your mouth. Most Windows laptops have a built-in webcam; a desktop PC usually needs an external one. Detection runs on your device and no camera data is sent anywhere while it runs, which you can check in your browser’s network monitor. There is a 3-day free trial with no credit card, then $2.99/month or $29/year.',
    sections: [
      {
        heading: 'Can I use Stop Biting on Windows?',
        body: 'Yes. Open stopbiting.today in a modern browser on your Windows PC, sign in with Google, allow camera access and start detection. It works as a web app (PWA), so there is nothing to download or install, and you can pin it from the browser if you want it one click away.\n\nKeep the tab open while you work. Detection only runs while the page is open and the camera is on.',
      },
      {
        heading: 'What does a Windows PC need to run it?',
        body: 'A modern browser, a camera that can see your hands and your face, and a few minutes for the AI models to download the first time (about 20 MB, once). Most laptops have a built-in webcam. A desktop PC usually does not, so you would plug in an external webcam.\n\nPlace the camera so your hands are in view when they rise towards your mouth. A camera that only sees your face will miss the hand.',
      },
      {
        heading: 'How is a browser app different from installed Windows software?',
        body: 'Both watch for the same moment. The difference is setup: a web app needs no installer and no admin rights, which matters on a locked-down work laptop, and it runs the same way on a Mac. Stop Biting also keeps bite-free streaks and a timestamped incident history, and pairs the alarm with habit reversal guides.\n\nWe compare the desktop-app alternatives honestly on their own pages, with every competitor detail checked against the vendor’s site.',
        html: '<p>See <a href="/compare/stop-biting-vs-hands-off">Stop Biting vs Hands Off</a> and <a href="/compare/ai-detection-apps">every AI nail biting detection app compared</a>.</p>',
      },
      {
        heading: 'Where does webcam detection stop working?',
        body: 'It only sees what the camera sees. It will not catch biting on your phone, in a meeting room without your PC or away from the desk. If a video call is using your camera, whether the two can share it depends on your browser and call software, so test it before relying on it.',
      },
      faqSection(
        'Short answers to what Windows users ask most, each restating what the sections above explain.',
        [
          ['Do I need to install anything on Windows?', 'No. It runs in a browser tab as a web app, with no installer.'],
          ['Does it send my webcam video anywhere?', 'No. Detection runs on your device and no camera data is sent while it runs.'],
          ['Does my PC need a webcam?', 'Yes. Most laptops have one built in; a desktop PC usually needs an external webcam.'],
          ['What does it cost?', 'A 3-day free trial with no credit card, then $2.99/month or $29/year.'],
        ],
      ),
      verificationSection('This page was last reviewed on 6 October 2026. It describes the browser version only. It names competitors only to link to the pages where their details are checked against their own sites, and makes no claim about them here.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/solutions/for-mac', label: 'Stop nail biting on a Mac' },
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/solutions/for-remote-workers', label: 'Stop nail biting working from home' },
      { href: '/how-it-works', label: 'How Stop Biting’s detection works' },
    ],
  };
}

// ─── Competitor comparison pages ─────────────────────────────────────────────
// FACT-CHECK LOG — every competitor claim below is verified against the
// competitor's own public website and, where a vendor's site and the store
// listing it links to disagree, against that store listing too.
//
// Re-verify quarterly. When you do, update BOTH the dates in the visible copy
// and the "How we verified this page" section that closes each page — this
// comment is invisible to readers and to crawlers, so it earns the site
// nothing on its own. Never write a visible date on which a check did not run.
//
// AND UPDATE THE META DESCRIPTION. Each page's SERP/og:/twitter: copy is a
// hand-written string in COMPARE_META in server.js. It is not derived from
// anything in this file, it never appears on the page, and llms.txt quotes the
// `subtitle` below instead — so nothing fails when it contradicts the body it
// summarises. Four corrections in a row have landed in a body while that copy
// kept the retracted claim, which is the version most people read: the
// $4.99-one-time price on /compare/stop-biting-vs-nailed outlived the body's
// refusal to name a price at all. A correction here is not finished until the
// matching COMPARE_META entry has been re-read in the same edit.
//
// Last full re-verification: 2026-09-10. Previous pass: 2026-08-11.
//
//   Hands Off     https://handsoffapp.com  (HTTP 200, re-fetched 2026-09-10)
//     CONFIRMED: "Download for Mac" and "Download for Windows", no web version;
//       "All processing happens locally on your device, no webcam data ever
//       leaves your computer"; "No video gets recorded"; "Fully GDPR
//       compliant"; "No personal data is collected, stored, or shared with
//       third parties"; interrupts "with a full-screen alert"; "3 days free,
//       then €2.99 monthly", still the only plan listed and still no annual or
//       lifetime option (pricing lives at the #pricing anchor on the home page;
//       /pricing itself returns 404); built by Lennert Soffers, who writes "I've
//       been struggling with nail biting for over 20 years".
//     CORRECTED 2026-09-10 — fifth behaviour: the site names all five BFRBs it
//       covers, "nail biting, skin picking, eyebrow/eyelash pulling, ear
//       picking, and nose picking". Our pages listed four and omitted ear
//       picking, understating its coverage.
//     CORRECTED 2026-09-10 — tracking: Hands Off now ships progress tracking.
//       "It also includes a statistics tracker to show your progress over
//       time." Our comparison table previously said "Not listed on site", and
//       our copy implied tracking was a Stop Biting exclusive. Both fixed.
//     NOT REPEATED: its FAQ asserts "70-90% reduction in episodes within the
//       first week for most users". Uncited vendor marketing — we do not cite
//       it for or against them.
//
//   Nailed        https://nailedapp.io     (HTTP 200, re-fetched 2026-09-10)
//     CONFIRMED: "A tiny macOS menu bar app", macOS only; "MediaPipe machine
//       learning models that run entirely in-browser via WebAssembly"; "Your
//       camera feed is processed in memory and immediately discarded"; "We have
//       no servers, no analytics, no tracking"; "No internet required"; the
//       alert is "A quick red flash and optional beep"; no free trial named
//       anywhere on the site or the store listing.
//     CORRECTED 2026-09-10 — price: nailedapp.io still advertises "$4.99 ·
//       macOS only", but the Mac App Store listing that is its only download
//       button — apps.apple.com/us/app/nailed-stop-biting-nails/id6761733224
//       (HTTP 200) — now shows the app as "Free" with the action "Get",
//       schema.org offers.price 0 USD and hasInAppPurchases false. The two
//       vendor-controlled sources disagree, so we no longer assert $4.99 as the
//       price a buyer pays; both figures are reported with their source. Do not
//       collapse this back to one number without re-checking the store listing.
//     CORRECTED 2026-09-10 — tracking: the same listing subtitles the app
//       "Offline nail-biting tracking" and states "Nailed helps you track your
//       nail biting habit". Our pages said tracking was not listed. Fixed.
//     ADDED 2026-09-10: "Requires macOS 12.0 or later and a Mac with Apple M1
//       chip or later" — a real hardware limit we had never stated.
//
//   SmartBehavior https://smart-behavior.com/en (HTTP 200, re-fetched 2026-09-10)
//     CONFIRMED: App Store, Google Play and Microsoft Store links all present;
//       treats "nail biting, skin picking, and body-focused repetitive
//       behaviors (BFRBs)", naming onychophagia, dermatillomania and
//       trichotillomania; "85% Accuracy"; "Works 100% Offline"; "All data is
//       processed exclusively on your device"; "No registration required";
//       "daily, weekly, and monthly trends"; "Installation takes only 2
//       minutes". Its website still publishes no pricing — the footer "Pricing"
//       link is href="#" and no price string appears anywhere on the page.
//     CORRECTED 2026-09-10 — macOS: its App Store listing
//       apps.apple.com/us/app/smartbehavior/id6752805381 (HTTP 200) lists
//       compatibility "Mac — Requires macOS 13.5 or later and a Mac with Apple
//       M1 chip or later", i.e. the iPad app runs on Apple Silicon Macs. We had
//       used a flat "no macOS version" as a Stop Biting differentiator, which
//       understated them; corrected to say the website lists no dedicated Mac
//       app while the iPad app runs on Apple Silicon.
//     ADDED 2026-09-10 — price: that same US listing shows "$0.99". Reported
//       explicitly as a US App Store price, because storefront prices vary and
//       the vendor's own site still publishes none.
//
//   Pavlok        https://pavlok.com and https://pavlok.com/pages/habit-nail-biting
//     (both fetched 2026-10-08)
//     CONFIRMED (home): "World's #1 Habit Breaking Wearable"; it "uses aversion
//       technology"; feedback is an electric shock, vibration or a chime; "Quit
//       Nail Biting" is listed as a use case; a dedicated app syncs with the
//       device; shown prices: Shock Clock 3 $134.99, Pavlok Ring $99.99, and a
//       $19/month subscription option for the Shock Clock 3.
//     CONFIRMED (nail-biting page): the user triggers the shock themselves:
//       "Shock yourself via tapping the wristband or using the remote in the app
//       while performing the behavior" and "Every time that you catch yourself
//       biting or picking at your nails, shock yourself".
//     NOT FOUND on the pages fetched: automatic detection of nail biting, a
//       refund or guarantee, a price for the Pavlok 3. The page states what
//       Pavlok describes and never says what a product lacks. Search snippets
//       about study results or success rates were NOT used.
//
//   NailKeeper    https://nailkeeper.app and its App Store listing
//     apps.apple.com/us/app/nailkeeper-stop-biting-nails/id1579004361 (both
//     fetched 2026-10-06)
//     CONFIRMED verbatim (site): "Take photos to track how your nails grow and
//       change over time."; "Monitor how much time has passed since you quit.
//       Restart the timer if you relapse."; "Set up notifications to take photos
//       and log your progress."; App Store and Google Play download buttons;
//       price shown as "Free".
//     CONFIRMED (App Store): "Free" with in-app purchases listed as NailKeeper
//       Pro $19.99, Unlimited Access $4.99, NailKeeper Pro Annual $9.99;
//       compatibility iPhone, iPad and Mac (Mac needs macOS 12.0+ and an Apple
//       M1 chip or later). Prices are the US storefront's at the check date.
//     NOT FOUND on either page: any mention of real-time detection or of using a
//       camera to detect biting, and any trial length. The page therefore says
//       what they describe and never says what the app lacks.
//
//   Mavala Stop   https://www.mavala.com/products/mavala-stop (200, 2026-09-10)
//     CONFIRMED verbatim: "MAVALA Stop helps you regain healthy nails with its
//       bitter-tasting, colourless formula that discourages putting fingers in
//       your mouth."
//
//   Streaks       https://streaksapp.com   (HTTP 200, re-fetched 2026-09-10)
//     CONFIRMED verbatim: "Don't break the chain, or your streak will reset to
//       zero days"; "With the iOS Health app, Streaks can automatically track
//       certain goals", listing steps, heart rate and blood pressure.
//
//   Habitica      https://habitica.com     (HTTP 200 but NOT RE-VERIFIABLE)
//     Could not be re-verified from the vendor's own site on 2026-09-10:
//       habitica.com returns a JS-only shell with five words of extractable
//       text ("Habitica - Gamify Your Life"). The manual-logging claim was
//       instead confirmed from Habitica's own App Store listing (id994882113,
//       HTTP 200): "When you do something in real life, check it off in the
//       app". The visible copy now attributes it that way rather than to the
//       site. If the site becomes crawlable again, move the attribution back.
//
//   "Tally"       REMOVED 2026-09-10 — the name was ambiguous (several habit
//     trackers ship under it), no specific vendor page could be identified, and
//     so the claim could not be re-verified. The name is no longer used.
//
// Stop Biting facts come from our own published pages (llms.txt, /pricing,
// /how-it-works).

/**
 * Visible, dated provenance line that closes every compare/solutions page.
 *
 * The FACT-CHECK LOG above is exactly the kind of work that earns trust — and
 * as a code comment it earned none, because neither readers nor crawlers ever
 * saw it. This surfaces the same fact in the page body using the file's native
 * `sections` shape, so it survives into the server-side copy that non-JS
 * crawlers receive without any change to PageContent or its consumers.
 *
 * Keep each note honest about scope: state only the vendors actually checked,
 * and only on a date the check actually ran.
 */
function verificationSection(body: string): { heading: string; body: string } {
  return { heading: 'How we verified this page', body };
}

/**
 * The FAQ block every compare/solutions page closes its argument with.
 *
 * A question-shaped heading with a short answer directly under it is the unit
 * AI answer engines extract — a heading that states a topic ("Price breakdown")
 * gives them nothing to match a query against. The heading string is fixed here
 * rather than repeated at nine call sites so the shape stays identical across
 * pages: one <h3> question, one <p> answer, nothing nested.
 *
 * `.blog-html-block` in src/index.css has no h3 rule and Tailwind's preflight
 * resets headings to body size, so the weight and spacing are inline; drop them
 * if a shared h3 rule is ever added there.
 *
 * Every answer must restate something the page already argues above. These
 * blocks are a second, more extractable presentation of the page's own copy —
 * never a place to introduce a claim the body does not make and the fact-check
 * log above has not verified.
 */
function faqSection(body: string, pairs: [string, string][]): { heading: string; body: string; html: string } {
  return {
    heading: 'Frequently asked questions',
    body,
    html: pairs.map(([q, a]) => `<h3 style="font-weight:600;margin-top:1rem">${q}</h3><p>${a}</p>`).join(''),
  };
}

function getVsHandsOffContent(): PageContent {
  return {
    title: 'Stop Biting vs Hands Off: Which Should You Pick?',
    subtitle: 'Two on-device AI apps that catch nail biting through your webcam — compared honestly on platforms, coverage, price, and privacy',
    intro: 'Pick Hands Off if you have several body-focused repetitive behaviours and live on the desktop; pick Stop Biting if nail biting is your specific problem, or you want a browser version or an annual plan. Monthly they cost the same — $2.99 for Stop Biting, €2.99 for Hands Off, each with a 3-day free trial — but Hands Off’s site lists no annual option, while Stop Biting’s is $29/year, about $2.42/month. Stop Biting and Hands Off solve the same core problem the same way: on-device AI watches your webcam and interrupts nail biting the moment it starts, without sending camera data anywhere. The real differences are coverage and platform. Hands Off covers five body-focused repetitive behaviors on Mac and Windows; Stop Biting focuses on nail biting, adds a no-install web app and a large habit-reversal content library. Disclosure: Stop Biting is our product — this is our honest attempt at a fair comparison, with every Hands Off claim re-verified against handsoffapp.com on 10 September 2026.',
    sections: [
      {
        heading: 'Stop Biting vs Hands Off: what’s the difference?',
        body: 'Both are on-device webcam detectors. Hands Off covers five behaviours on Mac and Windows; Stop Biting focuses on nail biting and adds a no-install web app and an annual plan.\n\nBoth apps were checked side by side on 10 September 2026. Pricing and features change — always confirm on the vendor’s own site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Hands Off</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Web app (PWA) in a browser on Mac or Windows</td><td>Mac, Windows desktop</td></tr>' +
          '<tr><td>Behaviors detected</td><td>Nail biting (focused)</td><td>Five BFRBs — its site lists nail biting, skin picking, eyebrow or eyelash pulling, ear picking, and nose picking</td></tr>' +
          '<tr><td>Detection</td><td>On-device AI (MediaPipe/WebAssembly)</td><td>On-device AI — all processing local</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>€2.99/month (monthly plan only listed)</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>3 days</td></tr>' +
          '<tr><td>Progress tracking</td><td>Bite-free streaks and a timestamped incident history</td><td>Yes — its site says it “includes a statistics tracker to show your progress over time”</td></tr>' +
          '<tr><td>Privacy</td><td>No camera data leaves the device, and nothing is sent while detection runs</td><td>States no video is recorded, GDPR compliant, no personal data collected</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'What do Stop Biting and Hands Off have in common?',
        body: 'The overlap is bigger than the differences, and it’s worth saying so. Both apps use real-time AI on your webcam feed, both process everything locally on your machine, and both fire an alert the moment your hand approaches your mouth — the external awareness signal that habit reversal research identifies as the key ingredient for stopping automatic biting.\n\nBoth also price the entry point almost identically: about three dollars or euros a month, with a 3-day free trial. Neither records video or uploads camera data. If your only question is "does the core mechanism work the same way?", the answer is essentially yes.',
      },
      {
        heading: 'What does Hands Off do better than Stop Biting?',
        body: 'Hands Off covers more behaviors. Its site markets detection for five common body-focused repetitive behaviors, listing nail biting, skin picking, eyebrow or eyelash pulling, ear picking, and nose picking. If you have multiple BFRBs — say you bite your nails and pick at skin — one Hands Off subscription addresses contexts Stop Biting simply doesn’t attempt to cover.\n\nIt also tracks progress. Its site states that Hands Off “includes a statistics tracker to show your progress over time”, so measurement is not a reason to choose us over them — an earlier version of this page implied it was, and that was wrong.\n\nIt’s also a credible, personal product: Hands Off is built by a founder who describes his own twenty-year struggle with nail biting, states GDPR compliance explicitly, and interrupts episodes with a full-screen alert. For a desktop-only, multi-behavior use case, it’s a genuinely strong choice.',
      },
      {
        heading: 'What does Stop Biting do better than Hands Off?',
        body: 'Stop Biting runs in the browser. Hands Off is a Mac/Windows download; Stop Biting works as a no-install web app (PWA), which matters on locked-down work laptops where you can’t install software.\n\nStop Biting has an annual plan. Hands Off’s site lists a single €2.99/month subscription. Stop Biting is $2.99/month or $29/year — about $2.42/month if you commit, roughly 19% cheaper than paying monthly.\n\nStop Biting pairs detection with treatment content. The alarm is the awareness trigger; the library of over 100 science-backed guides on habit reversal training, competing responses, and trigger mapping turns that trigger into a method. Stop Biting also tracks bite-free streaks and keeps a timestamped incident history — but Hands Off ships a statistics tracker of its own, so treat this as a difference in what gets measured, not as a feature they lack.\n\nThe honest counterpoint: if your problem is skin picking or hair pulling rather than nail biting, Stop Biting is the wrong tool — it detects nail biting only.',
      },
      {
        heading: 'How much do Stop Biting and Hands Off cost?',
        body: 'Stop Biting: $2.99/month or $29/year (about $2.42/month), with a 3-day free trial and no credit card required to start.\n\nHands Off: €2.99/month with a 3-day free trial, cancel anytime. No yearly or lifetime option is listed on its pricing page.\n\nOver one year at these listed prices, Stop Biting’s annual plan costs $29 versus roughly €35.88 for twelve months of Hands Off. If you only need an app for a month or two, the two are effectively the same price. Pricing verified on both sites on 10 September 2026 and subject to change.',
      },
      {
        heading: 'How does each app handle your camera data?',
        body: 'Neither sends it anywhere — both process the webcam feed entirely on your device. This is a tie, and that’s good news. Hands Off states that all processing happens locally, no video gets recorded, and no personal data is collected — it is explicitly GDPR compliant. Stop Biting runs MediaPipe models compiled to WebAssembly directly on your device: the camera feed never leaves your machine, and no camera data is sent during detection, which you can verify yourself with your browser’s network monitor.\n\nWhichever app you choose here, you are not trading privacy for the feature.',
      },
      faqSection(
        'Every answer below uses the same 10 September 2026 verification against handsoffapp.com as the rest of this page.',
        [
          ['Is Stop Biting or Hands Off more private?', 'Both process the webcam feed entirely on your device and neither transmits camera data. Stop Biting publishes a technical explainer of its on-device detection; Hands Off states it records no video and is GDPR compliant.'],
          ['Does Hands Off have a web version?', 'No — as of 10 September 2026 it’s a Mac and Windows download. Stop Biting additionally runs in the browser as a PWA.'],
          ['Which is cheaper?', 'Monthly, they’re effectively the same (~$/€2.99). Stop Biting’s $29/year annual plan is about 19% cheaper over a year; Hands Off lists no annual option.'],
          ['Does Hands Off track your progress?', 'Yes. Its site states the app includes a statistics tracker that shows your progress over time. Stop Biting tracks bite-free streaks and a timestamped incident history. Both measure progress, so decide on what you want measured rather than on whether measurement exists at all.'],
          ['Can either detect skin picking or hair pulling?', 'Hands Off markets coverage of five BFRBs — nail biting, skin picking, eyebrow or eyelash pulling, ear picking and nose picking. Stop Biting focuses on nail biting only.'],
          ['Do both work on Windows?', 'Yes. Both support Windows and Mac; only Stop Biting also runs in a browser.'],
        ],
      ),
      {
        heading: 'Which should you pick: Stop Biting or Hands Off?',
        body: 'Pick Hands Off if you have multiple body-focused repetitive behaviors and live on the desktop — one subscription covering five behaviors is the better fit.\n\nPick Stop Biting if nail biting is your specific problem, you want to run detection in a browser without installing anything, you’d rather pay ~$2.42/month on the annual plan, or you want bite-free streaks, a timestamped incident history and habit-reversal coaching around the detector.\n\nBoth offer a 3-day free trial, so the cheapest way to decide is to try the one that matches your situation.',
      },
      verificationSection('Every Hands Off detail on this page — platforms, the five behaviours it lists, price, trial length, privacy statements and its statistics tracker — was re-verified against handsoffapp.com on 10 September 2026, and each quotation is Hands Off’s own wording. That check corrected two things in our favour that were not true: Hands Off lists a fifth behaviour, ear picking, that we had omitted, and it ships a statistics tracker that an earlier version of this page treated as something only we offered. We re-verify competitor details quarterly and date them here rather than leaving you to guess how old they are. Prices and features change — confirm on handsoffapp.com before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/solutions/for-windows', label: 'Stop nail biting on Windows: webcam detection in your browser' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-nailed', label: 'Stop Biting vs Nailed: subscription vs a Mac menu bar app' },
      { href: '/compare/stop-biting-vs-smartbehavior', label: 'Stop Biting vs SmartBehavior: which fits where you bite' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

function getVsNailedContent(): PageContent {
  return {
    // Not "One-Time Mac App": the body below refuses to name a single price,
    // because nailedapp.io advertises $4.99 while the Mac App Store listing
    // that is its only download button shows the app as Free. A heading must
    // not assert the one thing the page it heads says cannot be asserted.
    title: 'Stop Biting vs Nailed: Subscription vs Mac Menu Bar App',
    subtitle: 'Two apps built on the same detection engine, with very different scopes — a minimal Mac menu bar utility vs a cross-platform habit system',
    intro: 'Choose Nailed if you’re on an Apple Silicon Mac — its store listing requires macOS 12 or later and an Apple M1 chip or later — and want nothing recurring; choose Stop Biting, at $2.99/month or $29/year, if you need Windows, an Intel Mac or a browser version, or you want streaks, incident history and habit-reversal content around the detector. Nailed and Stop Biting share more DNA than any other two apps in this category: both use Google’s MediaPipe machine learning models running via WebAssembly, entirely on-device. The difference is scope. Nailed is a deliberately minimal macOS menu bar app; Stop Biting is a subscription that adds Windows, a browser version, streak tracking, incident history, and a habit-reversal content library. One caveat before any of the comparisons below: nailedapp.io advertises $4.99, but the Mac App Store listing that is its only download link currently shows the app as a free download with no in-app purchases. Check the store page before you assume a price. Disclosure: Stop Biting is our product — we re-verified every Nailed claim here against nailedapp.io and its App Store listing on 10 September 2026 and tried to represent it fairly.',
    sections: [
      {
        heading: 'Stop Biting vs Nailed: what’s the difference?',
        body: 'Same detection engine, different scope: Nailed is a macOS-only menu bar app; Stop Biting adds Windows and the browser, streak tracking, incident history and a habit-reversal content library.\n\nDetails re-verified against nailedapp.io and Nailed’s Mac App Store listing on 10 September 2026. Pricing and features change — confirm on the vendor’s site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Nailed</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Web app (PWA) in a browser on Mac or Windows</td><td>macOS only (menu bar app); its store listing requires macOS 12 or later and an Apple M1 chip or later</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>nailedapp.io advertises $4.99 one-time; its Mac App Store listing currently shows “Free”, with no in-app purchases</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>None listed</td></tr>' +
          '<tr><td>Detection engine</td><td>MediaPipe models via WebAssembly, on-device</td><td>MediaPipe models via WebAssembly, on-device</td></tr>' +
          '<tr><td>Alerts</td><td>Audible alarm, multiple alert types</td><td>Red screen flash, optional beep</td></tr>' +
          '<tr><td>Tracking</td><td>Bite-free streaks and a timestamped incident history</td><td>Its App Store listing is subtitled “Offline nail-biting tracking” and says it helps you track the habit; no streaks or incident history are described</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Do Stop Biting and Nailed use the same detection technology?',
        body: 'Yes — both run MediaPipe’s hand and face models, compiled to WebAssembly, locally on your own machine.\n\nUnder the hood, the two apps make the same technical bet: MediaPipe’s hand and face models, compiled to WebAssembly, running locally. Nailed’s site describes it plainly — machine learning detects when your hand approaches your mouth, everything runs on your Mac, the camera feed is processed in memory and immediately discarded, no servers, no analytics.\n\nStop Biting’s detection works the same way, and we publish the same commitment: no camera data ever leaves your device, and nothing is sent while detection runs.\n\nSo the honest framing isn’t "which detector is real" — both are. It’s "how much system do you want around the detector."',
      },
      {
        heading: 'Why choose Nailed over Stop Biting?',
        body: 'Nailed asks for nothing recurring. Its site advertises $4.99 as a single purchase, and when we checked its Mac App Store listing on 10 September 2026 the app was listed as a free download with no in-app purchases at all. Either way there is no subscription — and if the free listing is current, Nailed is simply the cheapest credible detector in this category, which is worth saying plainly on a page published by one of its competitors.\n\nIt’s also admirably unobtrusive: it lives in the menu bar, flashes the screen red and optionally beeps when it catches you, and its site emphasizes minimal CPU and battery usage. For a conscious minimalist who just wants the awareness signal and nothing else, Nailed is a well-made tool.',
      },
      {
        heading: 'Why choose Stop Biting over Nailed?',
        body: 'Platforms: Nailed is macOS-only, and its store listing requires macOS 12 or later on a Mac with an Apple M1 chip or later — so an older Intel Mac rules it out entirely. Stop Biting runs as a no-install web app in any modern browser on Mac or Windows, including on machines where you can’t install software.\n\nTrying before buying: Nailed lists no free trial. Stop Biting’s 3-day trial requires no credit card, so you can test detection accuracy on your actual desk before paying. This is a smaller advantage than it looks right now — if Nailed’s store listing is free, trying it costs nothing either.\n\nThe system around the alarm: Stop Biting tracks bite-free streaks and keeps a timestamped incident history, and ships with over 100 science-backed guides on habit reversal training, so the alarm feeds a method rather than standing alone. Nailed does track: its App Store listing is subtitled “Offline nail-biting tracking” and says the app helps you track the habit. What it doesn’t describe is streaks, an incident history you can review, or any treatment content — so the difference is depth of measurement, not its absence.\n\nThe honest counterpoint: if the awareness signal alone fixes your habit, Stop Biting’s subscription buys you things you may not need — and on price Nailed wins outright for Mac users on Apple Silicon.',
      },
      {
        heading: 'Which is cheaper, Stop Biting or Nailed?',
        body: 'Nailed: advertised at $4.99 once on nailedapp.io, and listed as a free download on its Mac App Store page when we checked. Stop Biting: $2.99/month, or $29/year (~$2.42/month).\n\nThere’s no way to spin that: on price alone Nailed wins, and it wins by more if the free store listing is the current one. If price is your deciding factor and you’re on an Apple Silicon Mac, get Nailed.\n\nWhat the subscription pays for is the rest of the system — Windows and browser support, streaks and a reviewable incident history, alert options, ongoing model and feature updates, and the content library. Whether that’s worth ~$29/year depends on how established your habit is: casual biters often need only the nudge; chronic biters typically need the tracking and the method. Prices re-verified on 10 September 2026 against both nailedapp.io and its App Store listing, which did not agree — treat the store page as the one that decides what you actually pay.',
      },
      {
        heading: 'Should I buy Nailed or subscribe to Stop Biting?',
        body: 'Choose Nailed if: you’re on an Apple Silicon Mac, you want nothing recurring, you’re confident the red-flash awareness cue alone will do it, and you don’t need streaks or a reviewable incident history.\n\nChoose Stop Biting if: you’re on Windows, an Intel Mac, or need a browser version; you want streaks and incident data to measure progress; or your habit has survived previous attempts and you want the full habit-reversal toolkit around the detector.',
      },
      faqSection(
        'Every answer below rests on the same 10 September 2026 check of nailedapp.io and the Mac App Store listing that site links to.',
        [
          ['Does Nailed work on Windows?', 'No — it’s a macOS menu bar app, and its store listing requires macOS 12 or later on a Mac with an Apple M1 chip or later. Stop Biting runs as a web app in any modern browser on Mac or Windows.'],
          ['How much does Nailed cost?', 'Its site advertises $4.99 as a one-time purchase, while the Mac App Store listing it links to currently shows the app as a free download with no in-app purchases. Check the store page before assuming a price.'],
          ['Does Nailed track your progress?', 'Yes. Its App Store listing is subtitled “Offline nail-biting tracking” and says the app helps you track the habit. What it doesn’t describe is streaks or a reviewable incident history.'],
          ['Does Nailed have a free trial?', 'No free trial is listed. Its App Store listing showed the app as a free download when we checked, so trying it may cost nothing anyway; Stop Biting’s 3-day trial needs no credit card.'],
        ],
      ),
      verificationSection('Every Nailed detail on this page was re-verified on 10 September 2026 against nailedapp.io and the Mac App Store listing that site links to as its only download button. Two things changed in Nailed’s favour and are corrected above: its store listing now shows the app as a free download with no in-app purchases, so we no longer present $4.99 as the price you pay, and that listing describes nail-biting tracking, which an earlier version of this page said was absent. Where a vendor’s own two sources disagree — as they do here on price — we show both and name each rather than picking the one that flatters us. Confirm on the App Store page before downloading.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/solutions/for-mac', label: 'Stop nail biting on a Mac: webcam detection in your browser' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/blog/mediapipe-ai-detection-explained', label: 'How MediaPipe detection works: a technical explainer' },
      { href: '/pricing', label: 'Stop Biting pricing — free trial, $2.99/month or $29/year' },
    ],
  };
}

function getVsSmartBehaviorContent(): PageContent {
  return {
    // Not "Desktop and Web vs Mobile": SmartBehavior ships a Windows app and
    // its iPad app runs on Apple Silicon Macs, so a desktop/mobile split puts
    // back the flat "no macOS version" differentiator the body already dropped.
    // The title now states the decision the page actually makes, which no
    // platform correction can falsify.
    title: 'Stop Biting vs SmartBehavior: Which Fits Where You Bite?',
    subtitle: 'The clearest split in the category: where do you actually bite your nails — at a computer, or everywhere else?',
    intro: 'Choose SmartBehavior if most of your biting happens away from a computer — it’s the only app here with native iPhone and Android apps, and though its own website publishes no price, its US App Store listing showed $0.99. Choose Stop Biting, at $2.99/month or $29/year with a 3-day free trial, if you bite at a desk, on Mac, Windows or in a browser. Both use on-device AI to catch nail biting through a camera, and both keep processing entirely local — SmartBehavior claims 85% accuracy and runs 100% offline. The decision between them is mostly about platform. SmartBehavior has native iPhone and Android apps plus Windows; Stop Biting covers Mac, Windows, and the browser. Disclosure: Stop Biting is our product — this comparison aims to be honest, and every SmartBehavior claim was re-verified against smart-behavior.com and its App Store listing on 10 September 2026.',
    sections: [
      {
        heading: 'Stop Biting vs SmartBehavior: what’s the difference?',
        body: 'Platform, mostly. SmartBehavior has native iOS and Android apps plus Windows; Stop Biting covers Mac, Windows and the browser, and publishes its pricing.\n\nDetails re-verified against smart-behavior.com and SmartBehavior’s App Store listing on 10 September 2026. Pricing and features change — confirm on the vendor’s site before deciding.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>SmartBehavior</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Web app (PWA) in a browser on Mac or Windows</td><td>iOS, Android, Windows. No dedicated Mac app, but its App Store listing says the iPad app runs on a Mac with an Apple M1 chip or later</td></tr>' +
          '<tr><td>Native mobile app</td><td>No</td><td>Yes — iPhone and Android</td></tr>' +
          '<tr><td>Behaviors detected</td><td>Nail biting (focused)</td><td>Nail biting, skin picking, hair pulling, and other BFRBs</td></tr>' +
          '<tr><td>Detection</td><td>On-device (MediaPipe/WebAssembly); offline after initial load</td><td>On-device, 100% offline; claims 85% accuracy</td></tr>' +
          '<tr><td>Pricing</td><td>Published: $2.99/month or $29/year, 3-day free trial</td><td>Not published on its website; its US App Store listing showed $0.99</td></tr>' +
          '<tr><td>Tracking</td><td>Streaks and incident history</td><td>Daily, weekly, and monthly trend analytics</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'What does SmartBehavior do better than Stop Biting?',
        body: 'SmartBehavior is the only app in this comparison with native mobile apps. If a large share of your biting happens away from a computer — on the couch with your phone, commuting, in bed — a detector that lives on your phone addresses contexts a desktop-and-browser app doesn’t. That’s a real gap on our side, and if "on my phone" describes most of your habit, SmartBehavior is the better fit today.\n\nIt also covers more than nail biting — its site names onychophagia, dermatillomania (skin picking) and trichotillomania (hair pulling) — runs 100% offline with all processing on-device, requires no registration to start, and tracks daily, weekly, and monthly trends. Its stated setup time is about two minutes.',
      },
      {
        heading: 'What does Stop Biting do better than SmartBehavior?',
        body: 'Desktop coverage. SmartBehavior lists iOS, Android, and Windows apps and no dedicated macOS app — but to be fair to them, its App Store listing states the iPad app runs on a Mac with an Apple M1 chip or later, so Apple Silicon Mac users are not shut out. They get the iPad app rather than something built for a desktop. Stop Biting is built for desktop use on both Mac and Windows, including older Intel Macs, and because it also runs in the browser it works even on machines where you can’t install anything.\n\nPublished pricing. Stop Biting publishes its prices: $2.99/month or $29/year, with a 3-day free trial and no credit card required. SmartBehavior publishes none on its own website — the footer’s “Pricing” link doesn’t go anywhere — so you have to open an app store to find out what you’d pay. Its US App Store listing showed $0.99 when we checked, and storefront prices vary, so check your own.\n\nDepth of treatment content. Stop Biting surrounds its detector with over 100 science-backed guides on habit reversal training — the method with the strongest clinical evidence for stopping nail biting — plus streak tracking and a full incident history.\n\nWorth stating plainly: for many desk workers, most biting happens during focused computer use, which is exactly the context a webcam app on your work machine covers.',
      },
      {
        heading: 'Should I use a phone app or a webcam app to stop nail biting?',
        body: 'Webcam-based detection — ours included — only works when you’re in front of the camera. Phone-based detection only works when the phone can see you. Neither watches you everywhere.\n\nSo the practical question isn’t "which app is better" but "where does your biting happen?" If you bite mostly during focused computer work (coding, writing, gaming, meetings), a desktop/browser detector covers the majority of your episodes. If you bite mostly on the couch, in transit, or around the house, a phone app is closer to where the habit lives.\n\nSome people genuinely need both contexts covered — in which case the honest answer is that no single app in this category does it all today.',
      },
      {
        heading: 'How do Stop Biting and SmartBehavior handle your data?',
        body: 'Neither sends your camera data off the device. Both apps make strong, similar commitments. SmartBehavior states that all data is processed exclusively on your device, works 100% offline, collects no data, and requires no registration. Stop Biting runs MediaPipe models via WebAssembly on your device, and transmits no camera data while detection runs — verifiable with a network monitor.\n\nOn privacy, you can choose either app without compromise.',
      },
      {
        heading: 'Should I choose Stop Biting or SmartBehavior?',
        body: 'Choose SmartBehavior if: most of your biting happens away from a computer, you want a native iPhone or Android app, or you also struggle with skin picking or hair pulling on the go.\n\nChoose Stop Biting if: most of your biting happens at a desk, you want a browser app on a Mac rather than an iPad app running on one, you want a browser option for locked-down machines, you want published pricing with a free trial before paying, or you want habit-reversal coaching and incident history around the detector.',
      },
      faqSection(
        'Every answer below rests on the same 10 September 2026 check of smart-behavior.com and its App Store listing.',
        [
          ['Does SmartBehavior work on a Mac?', 'Its website lists no dedicated macOS app, but its App Store listing states the iPad app runs on a Mac with an Apple M1 chip or later — so Apple Silicon Mac users get the iPad app rather than something built for a desktop.'],
          ['How much does SmartBehavior cost?', 'Its website publishes no pricing — the footer’s “Pricing” link doesn’t go anywhere. Its US App Store listing showed $0.99 when we checked, and storefront prices vary, so check your own.'],
          ['Does Stop Biting have a mobile app?', 'Not a native one: on a phone it runs as a web app. SmartBehavior is the option built for native iPhone and Android detection.'],
          ['Which app detects more behaviours?', 'SmartBehavior — its site names onychophagia, dermatillomania (skin picking) and trichotillomania (hair pulling). Stop Biting focuses on nail biting.'],
        ],
      ),
      verificationSection('Every SmartBehavior detail on this page was re-verified on 10 September 2026 against smart-behavior.com and its App Store listing. That check corrected a claim that had favoured us: we previously said flatly that SmartBehavior has no macOS version and used it as a reason to pick Stop Biting, but its App Store listing states the iPad app runs on Apple Silicon Macs, so Mac users do have a route to it. We also added the $0.99 price its US App Store listing shows, since its own website still publishes none. Storefront prices vary and features change — check your own app store before deciding.'),
      MEDICAL_DISCLAIMER_SECTION,
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
    intro: 'Real-time AI nail biting detection went from one app to a real category: four products now watch for hand-to-mouth movement through a camera and interrupt the habit as it happens — Stop Biting ($2.99/month or $29/year), Hands Off (€2.99/month), Nailed ($4.99 on its own site, but shown as a free download on the Mac App Store listing that site links to) and SmartBehavior (no price on its website; $0.99 on its US App Store listing). All four process video on-device. This page compares them directly; our per-app pages go deeper on each match-up. Disclosure: Stop Biting is our product. Every competitor claim below was re-verified against the vendors’ own websites and app store listings on 10 September 2026, and we’ve noted honestly where each alternative beats us.',
    sections: [
      {
        heading: 'Which apps detect nail biting in real time?',
        body: 'Four, as of 10 September 2026: Stop Biting, Hands Off, Nailed and SmartBehavior. All four process video on-device.\n\nAll details below were re-verified against each vendor’s public website, and their app store listings where those exist, on 10 September 2026. Pricing and features change — confirm before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Hands Off</th><th>Nailed</th><th>SmartBehavior</th></tr></thead><tbody>' +
          '<tr><td>Platforms</td><td>Web app (PWA) in a browser on Mac or Windows</td><td>Mac, Windows</td><td>macOS only; needs macOS 12+ and Apple M1 or later</td><td>iOS, Android, Windows; iPad app also runs on Apple Silicon Macs</td></tr>' +
          '<tr><td>Behaviors</td><td>Nail biting</td><td>Five BFRBs (nail biting, skin picking, brow/lash pulling, ear picking, nose picking listed)</td><td>Nail biting</td><td>Nail biting, skin picking, hair pulling, other BFRBs</td></tr>' +
          '<tr><td>Detection</td><td>On-device (MediaPipe/WASM)</td><td>On-device, all processing local</td><td>On-device (MediaPipe/WASM)</td><td>On-device, 100% offline</td></tr>' +
          '<tr><td>Price</td><td>$2.99/mo or $29/yr</td><td>€2.99/mo</td><td>$4.99 one-time on its site; its App Store listing shows “Free”</td><td>Not published on site; US App Store listing showed $0.99</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no card</td><td>3 days</td><td>None listed</td><td>Not stated on site</td></tr>' +
          '<tr><td>Tracking</td><td>Streaks + incident history</td><td>Statistics tracker showing progress over time</td><td>Store listing describes offline nail-biting tracking</td><td>Daily/weekly/monthly trends</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'Why do AI detectors work when willpower and bitter polish don’t?',
        body: 'Most nail biting is automatic — episodes start and finish below conscious awareness, which is why willpower, bitter polish, and manual habit trackers so often fail: they all require the awareness the habit bypasses. Habit Reversal Training, the best-evidenced behavioural treatment, names awareness training as its first component.\n\nCamera-based AI detection automates exactly that component. A model watches for hand-to-mouth movement and fires an alert at the moment of occurrence, supplying awareness from outside. Every app on this page implements that same insight; they differ in platform, scope, price, and what’s built around the detector.',
      },
      {
        heading: 'Which app is best for nail biting at a computer?',
        body: 'Stop Biting — our app, so read this row knowing that. It runs — uniquely in this group as of 10 September 2026 — as a no-install PWA in a web browser, on Mac or Windows. Detection uses MediaPipe hand and face models in WebAssembly, fully on-device, with no camera data sent during detection. It tracks bite-free streaks and a timestamped incident history, and pairs the detector with over 100 science-backed guides on habit reversal.\n\nPricing is published: $2.99/month or $29/year (~$2.42/month), with a 3-day free trial and no credit card.\n\nHonest limits: it detects nail biting only, and there’s no native phone app — on mobile it runs as a web app, not an installed detector.',
      },
      {
        heading: 'Which app is best for multiple BFRBs on desktop?',
        body: 'Hands Off (handsoffapp.com) is a Mac and Windows desktop app whose site markets detection for five common body-focused repetitive behaviors — listing nail biting, skin picking, eyebrow or eyelash pulling, ear picking, and nose picking. All processing is local; the site states no video is recorded, no personal data is collected, and the app is GDPR compliant. It also includes a statistics tracker that shows progress over time, so it measures as well as interrupts. It’s €2.99/month with a 3-day trial; no annual plan is listed.\n\nIf you have several BFRBs and work at a desktop, this is the strongest option in the category. See our full Stop Biting vs Hands Off comparison.',
      },
      {
        heading: 'Which app is best for Mac users who don’t want a subscription?',
        body: 'Nailed (nailedapp.io) is a macOS menu bar app. Its site advertises $4.99 as a one-time purchase, while the Mac App Store listing it links to currently shows the app as a free download with no in-app purchases — so check the store page for the price that applies to you. It uses the same MediaPipe-via-WebAssembly approach as Stop Biting, entirely on-device: the camera feed is processed in memory and discarded, with no servers and no analytics. When it detects biting, it flashes the screen red with an optional beep. Its store listing also describes offline nail-biting tracking.\n\nNo free trial is listed, it needs macOS 12 or later on an Apple M1 Mac or newer, and it’s Mac-only — but if you want the cheapest credible detector and dislike subscriptions, Nailed is it. See our full Stop Biting vs Nailed comparison.',
      },
      {
        heading: 'Which app is best for phone-based detection?',
        body: 'SmartBehavior (smart-behavior.com) is the only entrant with native mobile apps: iOS, Android, plus Windows via the Microsoft Store. No dedicated macOS app is listed, though its App Store listing states the iPad app runs on a Mac with an Apple M1 chip or later. It detects nail biting, skin picking, hair pulling and other BFRBs, claims 85% detection accuracy, runs 100% offline on-device, requires no registration, and tracks daily, weekly, and monthly trends. Pricing isn’t published on its website — its US App Store listing showed $0.99, and storefront prices vary, so check yours.\n\nIf most of your biting happens away from a computer, this is the option built for that. See our full Stop Biting vs SmartBehavior comparison.',
      },
      {
        heading: 'How do I choose between these nail biting apps?',
        body: 'Match the app to where your habit lives, not to feature counts.\n\nBite mainly at a computer, want tracking and a method around the alarm: Stop Biting — and the free trial needs no card, so testing it costs nothing.\n\nMultiple BFRBs (skin picking, brow pulling, ear picking) at a desktop: Hands Off.\n\nApple Silicon Mac user who wants nothing recurring: Nailed — and check its App Store page, which listed it free when we last looked.\n\nBite mainly away from the computer, want it on your phone: SmartBehavior.\n\nWhichever you pick, the mechanism is the same evidence-aligned idea: automate the awareness that habit reversal training requires and the habit itself suppresses.',
      },
      faqSection(
        'Every answer below rests on the same 10 September 2026 check of the four vendors’ own websites and app store listings.',
        [
          ['Are there any free nail biting detection apps?', 'Nailed’s Mac App Store listing showed the app as a free download with no in-app purchases when we checked, though its own site advertises $4.99. Stop Biting has a 3-day free trial that needs no credit card.'],
          ['Do these apps upload your camera feed?', 'No. All four process video on-device: Stop Biting and Nailed run MediaPipe models in WebAssembly, Hands Off states all processing is local, and SmartBehavior states it works 100% offline.'],
          ['Which of them detect more than nail biting?', 'Hands Off lists five BFRBs — nail biting, skin picking, brow or lash pulling, ear picking and nose picking — and SmartBehavior covers nail biting, skin picking, hair pulling and other BFRBs. Stop Biting and Nailed detect nail biting.'],
          ['Is there a nail biting detection app for iPhone or Android?', 'SmartBehavior has native iOS and Android apps. Stop Biting runs on a phone as a web app rather than an installed detector.'],
        ],
      ),
      verificationSection('Every competitor claim in the table above was re-verified on 10 September 2026 against handsoffapp.com, nailedapp.io, smart-behavior.com and the App Store listings those sites link to. Three of the corrections that pass produced went against us, and they are worth naming: Hands Off ships a statistics tracker and lists a fifth behaviour, ear picking, that we had left out; Nailed’s App Store listing now shows the app as a free download and describes nail-biting tracking, both of which this page previously denied it; and SmartBehavior’s iPad app runs on Apple Silicon Macs, which we had presented as a gap. We re-check quarterly rather than writing a comparison once and leaving it to rot, and we date it here so you can judge how current it is. Prices and features change — confirm on the vendor’s own site before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/compare/stop-biting-vs-nailed', label: 'Stop Biting vs Nailed: subscription vs a Mac menu bar app' },
      { href: '/compare/stop-biting-vs-smartbehavior', label: 'Stop Biting vs SmartBehavior: which fits where you bite' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the clinical method' },
    ],
  };
}

function getVsPavlokContent(): PageContent {
  return {
    title: 'Stop Biting vs Pavlok: An Alert or a Shock?',
    subtitle: 'A wearable that, by its own description, uses an electric shock you trigger yourself, versus a webcam app that sounds an alarm: compared honestly',
    intro: 'They are built on opposite ideas. Pavlok describes itself as a habit-breaking wearable that uses aversion technology, with an electric shock, vibration or a chime, and its nail biting page describes you triggering the shock yourself when you catch yourself biting. Stop Biting uses your laptop webcam and on-device AI to sound an alarm the moment your hand reaches your mouth, with no shock, on Mac or Windows in a browser. Pick Pavlok if you want a wearable that works anywhere and are comfortable with aversive feedback; pick Stop Biting if you bite at a computer and want an alert that catches the moment for you. Stop Biting costs $2.99/month or $29/year with a 3-day free trial and no card. Disclosure: Stop Biting is our product, and every Pavlok detail here was checked against pavlok.com on 8 October 2026.',
    sections: [
      {
        heading: 'Stop Biting vs Pavlok: what’s the difference?',
        body: 'The core difference is the kind of feedback and who triggers it. Pavlok’s site describes a wearable with shock, vibration and chime feedback; its nail biting page describes the user delivering the shock when they notice themselves biting. Stop Biting detects the movement itself and sounds an alarm.\n\nBoth were checked on 8 October 2026. Prices and features change, so confirm on the vendor’s own site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>Pavlok</th></tr></thead><tbody>' +
          '<tr><td>What it is</td><td>Software: a web app (PWA) in a browser on Mac or Windows; needs a webcam</td><td>A wearable device with a companion app</td></tr>' +
          '<tr><td>Feedback</td><td>An alarm (sound, flash or both); no shock</td><td>Electric shock, vibration or a chime, as its site describes</td></tr>' +
          '<tr><td>Who triggers it</td><td>The app, when it detects your hand nearing your mouth</td><td>On its nail biting page, you: by tapping the wristband or using the app remote when you catch yourself</td></tr>' +
          '<tr><td>Automatic nail biting detection</td><td>Yes, on-device AI through your webcam</td><td>Not described on the pages we checked</td></tr>' +
          '<tr><td>Where it works</td><td>Only in front of your computer webcam</td><td>Wherever you wear it</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>Its home page shows a Shock Clock 3 at $134.99, a Pavlok Ring at $99.99, and a $19/month subscription option</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>Not stated on the pages we checked</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'What do Stop Biting and Pavlok have in common?',
        body: 'Both put an external signal between you and an automatic habit. Most nail biting happens without a decision, so a cue that makes you notice is the ingredient habit reversal training calls awareness. Both also come with a phone or web interface to follow what you are doing.',
      },
      {
        heading: 'What does Pavlok do better than Stop Biting?',
        body: 'It works away from your desk. A wearable goes with you to the commute, the sofa and the meeting room, while Stop Biting can only act where a webcam can see your hand.\n\nIt covers more habits. Its home page lists many, from waking up late to social media use, alongside nail biting. Stop Biting detects nail biting only.\n\nIt is a stronger deterrent for people who want one. If an aversive shock is what you are looking for, that is what Pavlok describes; Stop Biting deliberately does not use one.',
      },
      {
        heading: 'What does Stop Biting do better than Pavlok?',
        body: 'It catches the moment for you. On the nail biting page we read, Pavlok needs you to notice the biting and trigger the feedback yourself, which is the part that is hard when biting is automatic. Stop Biting detects the movement and alerts you without you having to catch it first. We found no automatic nail biting detection described on Pavlok’s pages, but we make no claim about every Pavlok model.\n\nIt needs no hardware and no shock. It runs in a browser tab, the 3-day trial needs no card, and the alarm is a sound or a flash.\n\nIt costs far less to try: $2.99/month or $29/year, against the device prices on Pavlok’s home page.\n\nThe honest limit: it only sees biting that happens in front of your computer webcam.',
      },
      {
        heading: 'How much do Stop Biting and Pavlok cost?',
        body: 'Stop Biting: $2.99/month or $29/year, with a 3-day free trial and no credit card required to start.\n\nPavlok: its home page on 8 October 2026 showed a Shock Clock 3 at $134.99, a Pavlok Ring at $99.99 and a $19/month subscription option for the Shock Clock 3. It did not state a price for the Pavlok 3 or a refund or guarantee. Check pavlok.com for current prices.',
      },
      faqSection(
        'Every answer below uses the same 8 October 2026 check of pavlok.com as the rest of this page.',
        [
          ['Does Pavlok use an electric shock?', 'Its home page describes feedback as an electric shock, vibration or a chime. Stop Biting uses none of these: it sounds an alarm, flashes the screen, or both.'],
          ['Does Pavlok detect nail biting automatically?', 'The nail biting page we read describes the user triggering the shock when they catch themselves biting. We found no automatic nail biting detection described there, and we make no claim about every Pavlok model. Stop Biting’s detection is automatic.'],
          ['Which works away from a computer?', 'Pavlok, because it is a wearable. Stop Biting only works in front of a webcam.'],
          ['Which is cheaper to try?', 'Stop Biting: a 3-day free trial with no card, then $2.99/month or $29/year. Pavlok’s home page shows $99.99 for the ring and $134.99 for the Shock Clock 3.'],
        ],
      ),
      {
        heading: 'Which should you pick: Stop Biting or Pavlok?',
        body: 'Pick Pavlok if you want a wearable that works anywhere, you have several habits to change, and aversive feedback appeals to you.\n\nPick Stop Biting if you bite while you work at a computer, want the alert to come from the app rather than from you, and prefer not to use a shock.\n\nNeither is a medical treatment, and if your biting is severe or distressing, speak to a clinician.',
      },
      verificationSection('Every Pavlok detail on this page (what it describes itself as, the feedback types, the nail biting use, the app, and the prices) was checked against pavlok.com and pavlok.com/pages/habit-nail-biting on 8 October 2026, and quoted phrases are Pavlok’s own. We looked for automatic nail biting detection, a refund or guarantee, and a Pavlok 3 price, did not find them on those pages, and state none. We did not use claims about studies or success rates found in search results. We re-verify competitor details quarterly and date them here. Prices and features change: confirm on pavlok.com before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-habitaware', label: 'Stop Biting vs HabitAware (Keen): wrist sensor or webcam?' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/blog/nail-biting-wearable-technology', label: 'Wearable technology for nail biting' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

function getVsNailKeeperContent(): PageContent {
  return {
    title: 'Stop Biting vs NailKeeper: Real-Time Detection or Photo Tracking?',
    subtitle: 'A webcam app that interrupts nail biting as it happens versus a phone app built around photos, a quit timer and reminders: compared honestly',
    intro: 'They solve different halves of the problem. NailKeeper, by its own description, tracks your nails with photos, a quit timer and reminder notifications on iPhone and Android. Stop Biting uses your laptop webcam and on-device AI to sound an alarm the moment your hand reaches your mouth, on Mac, Windows and in a browser. One records progress; the other tries to interrupt the habit while it is happening, and some people reasonably use both. Stop Biting costs $2.99/month or $29/year with a 3-day free trial and no card. Disclosure: Stop Biting is our product, and every NailKeeper detail here was checked against nailkeeper.app and its App Store listing on 6 October 2026.',
    sections: [
      {
        heading: 'Stop Biting vs NailKeeper: what’s the difference?',
        body: 'NailKeeper describes photo tracking, a timer and reminders. Stop Biting describes real-time detection through a webcam. The two are built around different moments: one around checking in afterwards, the other around the moment of biting.\n\nBoth were checked on 6 October 2026. Prices and features change, so confirm on the vendor’s own pages before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>NailKeeper</th></tr></thead><tbody>' +
          '<tr><td>What it centres on</td><td>Real-time alarm when your hand nears your mouth</td><td>Photo tracking of nail growth, a time-since-quitting timer, and reminders to take photos</td></tr>' +
          '<tr><td>Platforms</td><td>Web app (PWA) in a browser on Mac or Windows; needs a webcam</td><td>iOS and Android; its App Store listing also shows iPad and Mac (Apple M1 or later)</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>Free to download; its App Store listing shows in-app purchases of $4.99, $9.99 and $19.99</td></tr>' +
          '<tr><td>Free trial</td><td>3 days, no credit card</td><td>Not stated on the pages we checked</td></tr>' +
          '<tr><td>Real-time detection</td><td>Yes, on-device AI through your webcam</td><td>Not mentioned on its site or App Store listing</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'What do Stop Biting and NailKeeper have in common?',
        body: 'Both aim to help you stop biting and to make progress visible. Both give you a way to see how long you have gone, and both are aimed at people who want an app rather than a polish or a wearable. Stop Biting is not a medical treatment.',
      },
      {
        heading: 'What does NailKeeper do better than Stop Biting?',
        body: 'It lives on your phone. Its site and store listings describe an iPhone and Android app, so it goes where you go, while Stop Biting only works at a computer with a webcam.\n\nIt shows your nails recovering. The before-and-after photos and growth tracking it describes give you something visible to hold on to, which Stop Biting does not offer; we track bite-free streaks and logged incidents instead.\n\nIt has a free tier. Its listing shows the app as free to download, with purchases inside. Stop Biting starts with a 3-day trial and then charges.',
      },
      {
        heading: 'What does Stop Biting do better than NailKeeper?',
        body: 'It acts at the moment of biting. The alarm fires when your hand nears your mouth, which is the awareness step habit reversal training depends on. We found no mention of real-time detection on NailKeeper’s pages, so we make no claim about it beyond what they describe.\n\nIt runs on a laptop or desktop and in a browser, with nothing to install. It also pairs detection with a library of habit reversal guides and a timestamped incident history.\n\nThe honest limit: it only sees biting that happens in front of your computer webcam.',
      },
      {
        heading: 'How much do Stop Biting and NailKeeper cost?',
        body: 'Stop Biting: $2.99/month or $29/year, with a 3-day free trial and no credit card required to start.\n\nNailKeeper: free to download. Its US App Store listing on 6 October 2026 shows in-app purchases named NailKeeper Pro at $19.99, Unlimited Access at $4.99 and NailKeeper Pro Annual at $9.99. App Store prices vary by storefront and change, so check the listing.',
      },
      faqSection(
        'Every answer below uses the same 6 October 2026 check of nailkeeper.app and its App Store listing as the rest of this page.',
        [
          ['Is NailKeeper free?', 'It is free to download, and its US App Store listing on 6 October 2026 shows in-app purchases of $4.99, $9.99 and $19.99. Stop Biting has a 3-day free trial, then $2.99/month or $29/year.'],
          ['Does NailKeeper detect nail biting in real time?', 'Its site and App Store listing, as we read them, describe photo tracking, a timer and reminders. They do not mention real-time detection, so we do not say whether it has it. Stop Biting’s whole approach is real-time detection through your webcam.'],
          ['Which works on a phone?', 'NailKeeper has iPhone and Android apps. Stop Biting needs a laptop or desktop webcam.'],
          ['Can I use both?', 'Yes. They cover different moments: NailKeeper describes tracking your progress with photos and a timer, while Stop Biting interrupts biting at your computer.'],
        ],
      ),
      {
        heading: 'Which should you pick: Stop Biting or NailKeeper?',
        body: 'Pick NailKeeper if you want a phone app that tracks your nails and your time since quitting, and you bite away from a computer.\n\nPick Stop Biting if you bite while you work and want an alarm at the moment it happens.\n\nIf you want both, nothing stops you using a photo tracker alongside the alarm.',
      },
      verificationSection('Every NailKeeper detail on this page (what it describes, its platforms, and its prices) was checked against nailkeeper.app and its US App Store listing on 6 October 2026, and quoted phrases are theirs. We looked for any mention of real-time detection, a camera used to detect biting, and a trial length, and did not find them, so we state none and make no claim about what the app lacks. We re-verify competitor details quarterly and date them here. Prices and features change: confirm on nailkeeper.app before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-pavlok', label: 'Stop Biting vs Pavlok: an alert or a shock?' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-habitaware', label: 'Stop Biting vs HabitAware (Keen): wrist sensor or webcam?' },
      { href: '/compare/habit-tracking-apps', label: 'Why habit tracking apps do not work for nail biting' },
      { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best tools to stop nail biting, ranked by evidence' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

function getVsHabitAwareContent(): PageContent {
  return {
    title: 'Stop Biting vs HabitAware (Keen): Wrist Sensor or Webcam?',
    subtitle: 'A vibrating bracelet that senses hand movement versus an on-device webcam app that watches your hand reach your mouth: compared honestly',
    intro: 'Pick HabitAware’s Keen bracelet if you want something worn on your wrist that works away from a screen, or if you also pull hair or pick skin; pick Stop Biting if nail biting is your problem and you spend the hours you bite at a computer. Both interrupt the behavior at the moment it starts, which is the awareness step habit reversal training depends on. Stop Biting costs $2.99/month or $29/year with a 3-day free trial and no card; HabitAware’s own pages we checked do not state a bracelet price, so this page does not quote one. Disclosure: Stop Biting is our product, and every HabitAware detail here was checked against habitaware.com on 5 October 2026.',
    sections: [
      {
        heading: 'Stop Biting vs HabitAware: what’s the difference?',
        body: 'HabitAware sells a smart bracelet; Stop Biting is software that uses your webcam. One is worn, the other is only active while a screen is in front of you.\n\nBoth were checked on 5 October 2026. Prices and features change, so confirm on the vendor’s own site before buying.',
        html: '<table><thead><tr><th></th><th>Stop Biting</th><th>HabitAware (Keen2)</th></tr></thead><tbody>' +
          '<tr><td>What it is</td><td>Software: a web app (PWA) in a browser on Mac or Windows</td><td>A smart bracelet; its site also lists a separate “KeenLite: Apple Watch App”</td></tr>' +
          '<tr><td>Behaviors</td><td>Nail biting (focused)</td><td>Hair pulling, skin picking and nail biting, as its site names them</td></tr>' +
          '<tr><td>How it alerts</td><td>On-screen and sound alert when your hand nears your mouth</td><td>The device vibrates on the wrist, “like a ‘hug’”, when it detects the behavior</td></tr>' +
          '<tr><td>Where it works</td><td>Only while you are in front of your computer webcam</td><td>Wherever you wear it</td></tr>' +
          '<tr><td>Price</td><td>$2.99/month or $29/year</td><td>Not stated on the pages we checked</td></tr>' +
          '<tr><td>Trial or guarantee</td><td>3 days, no credit card</td><td>A “90-Day Guarantee”</td></tr>' +
          '</tbody></table>',
      },
      {
        heading: 'What do Stop Biting and HabitAware have in common?',
        body: 'Both aim at the same moment: the second your hand starts toward your mouth, before the nail is in your teeth. Most nail biting is automatic, so an external signal that makes you notice is the ingredient habit reversal training identifies as the hard part. Neither product relies on willpower or on a taste deterrent.\n\nHabitAware’s own site says behavior change takes about 66 days, which is why it offers 90 days. The same timescale applies to any tool you pick, ours included.',
      },
      {
        heading: 'What does HabitAware do better than Stop Biting?',
        body: 'It works away from your desk. A bracelet goes with you to the commute, the sofa and the meeting room, while Stop Biting can only act where a webcam can see your hand. If you bite mostly away from a computer, a wearable is the better fit and we would say so plainly.\n\nIt covers more behaviors. Its site names hair pulling (trichotillomania), skin picking (dermatillomania) and nail biting (onychophagia). Stop Biting detects nail biting only.\n\nIt offers a longer money-back window. HabitAware advertises a 90-day guarantee; our trial is 3 days.',
      },
      {
        heading: 'What does Stop Biting do better than HabitAware?',
        body: 'It needs no hardware. There is nothing to buy, charge or wear: it runs on a Mac, a Windows PC or in a browser tab, and the 3-day trial needs no credit card.\n\nIt is a subscription with a published price: $2.99/month or $29/year, about $2.42/month on the annual plan.\n\nIt pairs detection with treatment content: a library of over 100 guides on habit reversal training, competing responses and trigger mapping, plus bite-free streaks and a timestamped incident history.\n\nThe honest limit: if you bite on the train, in bed or on the phone, a webcam app will not see it.',
      },
      {
        heading: 'How much do Stop Biting and HabitAware cost?',
        body: 'Stop Biting: $2.99/month or $29/year, with a 3-day free trial and no credit card required to start.\n\nHabitAware: the homepage and shop pages we checked on 5 October 2026 did not state a bracelet price, bundle price or subscription cost, so we are not guessing one. Check habitaware.com for the current price. Hardware is normally a larger one-off cost than a $2.99 subscription, but compare the real figures before deciding.',
      },
      faqSection(
        'Every answer below uses the same 5 October 2026 check of habitaware.com as the rest of this page.',
        [
          ['Is HabitAware an app or a bracelet?', 'Its main product is the Keen2 smart bracelet, which vibrates on your wrist. Its site also lists a separate KeenLite Apple Watch app. Stop Biting is software only.'],
          ['Does HabitAware work for nail biting?', 'Yes. Its site names nail biting (onychophagia) alongside hair pulling and skin picking.'],
          ['Does Stop Biting work away from my computer?', 'No. It watches your hand through a webcam, so it only works while you are in front of one.'],
          ['Which is cheaper?', 'Stop Biting’s price is published: $2.99/month or $29/year. We could not find a HabitAware bracelet price on the pages we checked, so we make no price claim for it.'],
          ['Do both interrupt the habit as it happens?', 'Yes. HabitAware vibrates on your wrist; Stop Biting alerts you on screen the moment your hand approaches your mouth.'],
        ],
      ),
      {
        heading: 'Which should you pick: Stop Biting or HabitAware?',
        body: 'Pick HabitAware if you bite away from screens, or if hair pulling or skin picking is part of the picture. A wearable is the right shape for that.\n\nPick Stop Biting if you bite while you work or browse, want to start in minutes without buying hardware, and want the habit-reversal coaching around the alert.\n\nSome people reasonably use a wearable for the day and Stop Biting for the desk; the two do not conflict.',
      },
      verificationSection('Every HabitAware detail on this page (the behaviors it names, the wrist vibration, the KeenLite Apple Watch app and the 90-day guarantee wording) was checked against habitaware.com on 5 October 2026, and quoted phrases are its own. We looked for a bracelet price, battery life, platform support and subscription cost and did not find them on the pages we fetched, so we state none. We re-verify competitor details quarterly and date them here. Prices and features change: confirm on habitaware.com before buying.'),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-pavlok', label: 'Stop Biting vs Pavlok: an alert or a shock?' },
      { href: '/compare/stop-biting-vs-nailkeeper', label: 'Stop Biting vs NailKeeper: real-time detection or photo tracking?' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: which should you pick?' },
      { href: '/compare/habit-tracking-apps', label: 'Why habit tracking apps do not work for nail biting' },
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the clinical method' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

export const PAGE_MAP: Record<string, () => PageContent> = {
  '/compare/bitter-polish-alternative': getBitterPolishContent,
  '/compare/habit-tracking-apps': getHabitTrackingContent,
  '/compare/stop-biting-vs-hands-off': getVsHandsOffContent,
  '/compare/stop-biting-vs-nailed': getVsNailedContent,
  '/compare/stop-biting-vs-smartbehavior': getVsSmartBehaviorContent,
  '/compare/stop-biting-vs-habitaware': getVsHabitAwareContent,
  '/compare/stop-biting-vs-nailkeeper': getVsNailKeeperContent,
  '/compare/stop-biting-vs-pavlok': getVsPavlokContent,
  '/compare/ai-detection-apps': getAiDetectionAppsContent,
  '/solutions/for-desk-workers': getDeskWorkersContent,
  '/solutions/for-adhd': getAdhdContent,
  '/solutions/for-gamers': getGamersContent,
  '/solutions/for-students': getStudentsContent,
  '/solutions/for-remote-workers': getRemoteWorkersContent,
  '/solutions/for-mac': getMacContent,
  '/solutions/for-windows': getWindowsContent,
};
