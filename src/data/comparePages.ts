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
  sections: { heading: string; body: string }[];
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
        body: 'Bitter polish works through aversive taste conditioning: the bitter flavor creates an unpleasant association with biting. This works for conscious biting — episodes where your hand is deliberately moving to your mouth and you can taste the polish.\n\nThe problem: most nail biting is automatic. Research consistently shows that nail biters catch fewer than half their daily episodes through self-monitoring. The habit runs below conscious awareness. Bitter polish cannot interrupt an episode you didn\'t know was happening — because the awareness required to taste the polish is the same awareness that was absent when the biting started.\n\nStop Biting\'s AI detection works differently: it provides awareness from outside. The alarm fires before you\'ve bitten, creating the conscious moment that bitter polish requires but cannot generate.',
      },
      {
        heading: 'Evidence comparison',
        body: 'Habit Reversal Training (HRT) — the approach Stop Biting automates — has been validated in dozens of clinical trials with effect sizes of 70–90% reduction in biting frequency in consistent practitioners. A 2012 Cochrane review found HRT produced significantly greater reductions than control conditions across multiple body-focused repetitive behaviors.\n\nBitter nail polish evidence is primarily anecdotal and short-term. It works initially for some users, but effectiveness typically decreases as taste habituation occurs and the formula wears off. No large-scale clinical trial has established lasting efficacy beyond the initial novelty period.\n\nThe evidence base isn\'t close. HRT has decades of rigorous clinical validation; bitter polish has product reviews.',
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

export const PAGE_MAP: Record<string, () => PageContent> = {
  '/compare/bitter-polish-alternative': getBitterPolishContent,
  '/compare/habit-tracking-apps': getHabitTrackingContent,
  '/solutions/for-desk-workers': getDeskWorkersContent,
  '/solutions/for-adhd': getAdhdContent,
  '/solutions/for-gamers': getGamersContent,
};
