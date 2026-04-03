export interface BlogSection {
  heading: string;
  body: string; // plain paragraphs separated by \n\n
  list?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string; // meta description ~155 chars
  tag: string;
  readingMinutes: number;
  datePublished: string; // YYYY-MM-DD
  dateModified: string;
  sections: BlogSection[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-do-people-bite-their-nails',
    title: 'Why Do People Bite Their Nails? The Psychology and Science Behind Onychophagia',
    description: 'Nail biting (onychophagia) affects 20–30% of adults. This article explains the psychological triggers, habit loops, and brain mechanisms that drive the behaviour.',
    tag: 'Psychology',
    readingMinutes: 8,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'What is onychophagia?',
        body: `Onychophagia is the clinical term for chronic nail biting — a body-focused repetitive behaviour (BFRB) classified alongside skin picking (excoriation) and hair pulling (trichotillomania). Unlike occasional casual nail biting, onychophagia is characterised by repetition, difficulty stopping despite wanting to, and often visible physical damage to the nails, cuticles, or surrounding skin.\n\nResearch suggests onychophagia affects between 20% and 30% of the general adult population, with prevalence peaking in adolescence (where estimates reach 45%) before declining — but often not disappearing — in adulthood. It is one of the most common nervous habits worldwide and is frequently underdiagnosed because sufferers tend to minimise the behaviour.`,
      },
      {
        heading: 'What causes nail biting? The three main triggers',
        body: `The triggers for nail biting cluster consistently into three broad categories across the clinical literature, though individual patterns vary significantly.`,
        list: [
          'Stress and anxiety — The most frequently reported trigger. Biting activates the oral motor system and produces a brief calming effect through proprioceptive stimulation. The relief reinforces the behaviour, making the cue–routine–reward loop stronger with each repetition.',
          'Deep focus and boredom — Many people bite during intense cognitive tasks (coding, reading, studying) or when under-stimulated. In these states, the prefrontal cortex is occupied elsewhere, reducing the self-monitoring capacity that would otherwise inhibit the behaviour.',
          'Perfectionism and frustration — A 2015 study published in PLOS ONE found that nail biters were more likely to be perfectionists and to engage in the behaviour as a response to frustration with unmet high standards. The behaviour provides a physical outlet for emotional regulation.',
        ],
      },
      {
        heading: 'Is nail biting a form of OCD?',
        body: `Nail biting is classified in the DSM-5 under "Other Specified Obsessive-Compulsive and Related Disorders" when it reaches clinical severity. However, most nail biters do not meet full OCD diagnostic criteria. The key distinction is that OCD is driven by intrusive obsessions that compulsions are performed to neutralise, whereas BFRB behaviours like nail biting are primarily automatic — triggered by states rather than thoughts.\n\nThat said, there is a meaningful overlap. Studies indicate that approximately 28–33% of OCD patients also exhibit BFRBs, and nail biters show elevated rates of anxiety sensitivity. The neurocircuitry involved — particularly the corticostriatal loops governing habitual behaviour — overlaps substantially between OCD and BFRBs.`,
      },
      {
        heading: 'Why does nail biting become automatic?',
        body: `Habits form through a process of procedural memory consolidation in the basal ganglia. When a behaviour is repeated consistently in the presence of a stable cue (stress, a particular context, a particular emotion), the neural pathway becomes progressively more efficient through a process called long-term potentiation. Eventually, the cue alone is sufficient to trigger the routine — bypassing conscious deliberation entirely.\n\nFor nail biters, this means the hand moves to the mouth and biting begins before there is any conscious awareness that it is happening. This is why willpower alone rarely succeeds: the behaviour has been shifted from deliberate to automatic processing, and willpower only operates on deliberate processing. Effective intervention must work at the level of the automatic habit loop itself.`,
      },
      {
        heading: 'What is the role of awareness in stopping nail biting?',
        body: `The core problem with automatic habits is the absence of awareness at the critical moment. Studies of habit reversal training — the gold-standard treatment for BFRBs — identify awareness training as the primary active ingredient. Participants who become reliably aware of each instance of their nail biting show substantially greater reductions than those who focus only on competing responses or motivation.\n\nThis is why real-time detection tools are therapeutically interesting: they introduce external awareness at precisely the moment when self-awareness is absent. The moment the alarm fires is the moment the automatic chain is broken — creating the neurological opening for a competing response and, over time, for the habit loop itself to weaken through non-reinforcement.`,
      },
    ],
  },

  {
    slug: 'habit-reversal-training-guide',
    title: 'Habit Reversal Training for Nail Biting: A Complete Evidence-Based Guide',
    description: 'Habit Reversal Training (HRT) reduces nail biting frequency by 70–90%. This guide explains the three components, the evidence behind them, and how to apply them.',
    tag: 'Treatment',
    readingMinutes: 9,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'What is Habit Reversal Training?',
        body: `Habit Reversal Training (HRT) is a cognitive-behavioural therapy protocol originally developed by Nathan Azrin and R. Gregory Nunn in 1973 and subsequently validated across hundreds of clinical trials for body-focused repetitive behaviours (BFRBs) including nail biting, hair pulling, and skin picking. It remains the most evidence-supported treatment for onychophagia, with multiple meta-analyses confirming its efficacy.\n\nA 2012 Cochrane review of behavioural interventions for nail biting and other BFRBs found that HRT produced significantly greater reductions in habit frequency than control conditions, with effect sizes ranging from moderate to large. Studies using daily monitoring logs report 70–90% reductions in biting frequency among participants who complete all three HRT components consistently over a 4–8 week period.`,
      },
      {
        heading: 'Component 1: Awareness training',
        body: `Awareness training is the foundational and most impactful component of HRT. Most nail biters report noticing fewer than half of their daily biting episodes — the behaviour has become so automatic that it occurs below the threshold of conscious attention. Awareness training systematically raises this threshold.\n\nThe protocol involves: (1) keeping a detailed habit diary recording every instance of biting, including the time, context, emotional state, and trigger; (2) practising noticing the precursor behaviours — the hand moving upward, the fingers touching the lips — that precede the bite itself; and (3) spending time in front of a mirror observing the habit while it happens, to break the automaticity through conscious observation. This phase alone produces measurable reductions before any competing response is introduced.`,
      },
      {
        heading: 'Component 2: Competing response training',
        body: `A competing response is a behaviour that is physically incompatible with nail biting — it cannot be performed simultaneously. The competing response must be: (a) physically incompatible with the habit, (b) maintainable for at least one minute, (c) socially inconspicuous, and (d) easy to perform in any context.\n\nCommonly used competing responses for nail biting include: pressing fingertips firmly against a flat surface; clenching a fist; gripping a pen or other object; placing both hands palm-down on a table; or pressing the thumb and forefinger of one hand together. The competing response is performed immediately upon awareness of the urge or the beginning of the habit, and maintained for 1–3 minutes or until the urge passes. The specificity of the competing response matters — vague intentions ("I'll just stop") are far less effective than a precise, rehearsed physical substitute.`,
      },
      {
        heading: 'Component 3: Social support and sensory interruption',
        body: `The third component is external feedback — a signal from outside the individual that the habit is occurring. In clinical settings, this is typically a therapist or trained support person who gently flags each instance of the behaviour during sessions. The external signal serves as an awareness bridge during moments when self-monitoring fails.\n\nFor daily life, a sensory interruption such as an audible alarm provides equivalent function without requiring a social partner to be present. The alarm breaks the automatic chain at the moment of occurrence, creating the same neurological opening for the competing response that a therapist's signal would produce. This is the component that technology can most effectively automate — and where real-time AI detection becomes directly therapeutically relevant.`,
      },
      {
        heading: 'How long does HRT take to work?',
        body: `Most clinical HRT protocols span 4–10 weeks of weekly sessions, with daily self-monitoring between sessions. Response tends to follow a characteristic curve: awareness increases rapidly in the first 1–2 weeks, often accompanied by an apparent increase in perceived biting frequency (because more incidents are being noticed, not because more are occurring). Actual biting frequency then decreases significantly between weeks 2 and 6 as the competing response becomes habitual.\n\nLong-term maintenance requires continued practice, particularly in high-stress periods when the original triggers intensify. A 12-month follow-up study by Deckersbach et al. found that 87% of HRT responders maintained their improvements at one year, compared to 26% in a psychoeducation-only control group, suggesting that the competing response becomes self-sustaining once established.`,
      },
    ],
  },

  {
    slug: 'nail-biting-health-risks',
    title: 'The Real Health Risks of Nail Biting: What Onychophagia Actually Does to Your Body',
    description: 'Nail biting causes dental damage, nail infections, pathogen transfer, and social anxiety. This article details the evidence-based health risks of chronic onychophagia.',
    tag: 'Health',
    readingMinutes: 6,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'Is nail biting actually harmful?',
        body: `Nail biting is frequently dismissed as a harmless nervous habit, but chronic onychophagia causes a range of physical health problems that compound over years. The damage occurs across four primary systems: dental, dermatological, infectious, and psychological. Understanding the concrete risks is often more motivating for behaviour change than abstract concern — and the risks are more serious than most nail biters realise.`,
      },
      {
        heading: 'Dental damage from chronic nail biting',
        body: `The teeth are not designed for the repeated shear force of biting hard nail material. Chronic nail biting causes several forms of dental damage. Tooth fractures and chipping are well-documented, particularly in the upper incisors which bear the primary biting load. A 2013 study in the Journal of Esthetic and Restorative Dentistry found that nail biters had significantly higher rates of tooth fractures and craze lines than controls.\n\nTemporomandibular joint (TMJ) dysfunction is a further risk. The repeated parafunctional jaw movement strains the muscles and ligaments of the TMJ, leading to jaw pain, clicking, and in severe cases, restricted movement. Nail biters also show accelerated incisor wear and an increased incidence of malocclusion, where the bite pattern is altered by years of asymmetric pressure.`,
      },
      {
        heading: 'Nail infections: paronychia and beyond',
        body: `Paronychia — infection of the nail fold — is significantly more common in nail biters than in the general population. The repeated trauma of biting creates micro-abrasions in the cuticle and surrounding skin, providing entry points for bacteria (typically Staphylococcus aureus) and fungi (typically Candida species). Acute paronychia presents with redness, swelling, and pain around the nail; chronic paronychia can lead to permanent nail deformity.\n\nIn severe or untreated cases, nail infections can spread to deeper tissue (felon) or, rarely, to bone (osteomyelitis). The risk is elevated in immunocompromised individuals. Beyond paronychia, chronic nail biting can cause permanent changes to nail plate morphology — the nail grows back thinner, ridged, or with irregular edges even after the habit stops.`,
      },
      {
        heading: 'How nail biting spreads pathogens',
        body: `The fingers are among the most heavily contaminated surfaces the body regularly contacts. Studies of hand microbial load consistently find hundreds of species of bacteria and fungi on the fingertips, including enteric pathogens that cause gastrointestinal illness. Nail biting creates a direct pathway from fingertips to oral mucosa — one of the body's most permeable infection entry points.\n\nA 2018 study found that nail biters were 58% more likely to have oral HPV than non-biters. Enterobacteriaceae — including E. coli strains — are routinely recovered from subungual spaces (under the nail), and biting transfers these directly into the mouth. For those who work in environments with high pathogen exposure (healthcare, food service, public transport), the infection transmission risk from nail biting is clinically significant.`,
      },
      {
        heading: 'The psychological costs: shame, social anxiety, and the reinforcement loop',
        body: `The visible damage from chronic nail biting — short, ragged nails, damaged cuticles, scarred periungual skin — causes significant psychological distress in a substantial proportion of nail biters. A 2015 survey found that 48% of chronic nail biters reported avoiding handshakes or hiding their hands in social situations. This shame and social withdrawal are not trivial side effects; they represent a meaningful reduction in quality of life.\n\nParticularly insidious is the feedback loop: the shame of damaged nails increases anxiety, which intensifies the urge to bite, which worsens the visible damage, which increases shame. This self-reinforcing cycle is one reason why motivational approaches alone ("just decide to stop") are rarely successful — the psychological component of the habit has its own momentum independent of conscious intention.`,
      },
    ],
  },

  {
    slug: 'nail-biting-in-children',
    title: 'Nail Biting in Children: Causes, When to Worry, and Effective Strategies for Parents',
    description: 'Nail biting affects up to 45% of children. This guide explains normal vs. concerning levels, age-appropriate interventions, and when to seek professional help.',
    tag: 'Parenting',
    readingMinutes: 7,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'How common is nail biting in children?',
        body: `Nail biting is one of the most common nervous habits in childhood and adolescence. Prevalence studies estimate that approximately 30–45% of children between ages 7 and 10 bite their nails at some point, with rates peaking in early adolescence (11–14 years) before declining through the teenage years. Onset before age 3 is rare; the behaviour most commonly emerges between ages 4 and 6 when children begin school and encounter new sources of stress and social pressure.\n\nFor the majority of children, nail biting is a transient habit that resolves without intervention by mid-adolescence. However, for a meaningful minority — estimates range from 20–30% of childhood nail biters — the behaviour persists into adulthood and becomes more entrenched over time if not addressed.`,
      },
      {
        heading: 'Why do children bite their nails?',
        body: `In children, nail biting serves similar psychological functions to those seen in adults, but the triggering contexts differ. Common triggers in children include: school-related anxiety (tests, social pressures, transitions); boredom, particularly during passive activities like watching television or riding in a car; excitement or anticipation (which can trigger the same oral motor activation as anxiety); and imitation of peers or family members who bite their nails.\n\nYounger children (4–7) are less likely to bite from true anxiety and more likely to bite from boredom or imitation. In older children and adolescents, the anxiety component becomes more prominent. The behaviour should be interpreted in the context of the child's overall emotional regulation — isolated nail biting in an otherwise well-adjusted child is very different from nail biting that accompanies pervasive anxiety, school refusal, or other concerning signs.`,
      },
      {
        heading: 'When should parents be concerned about a child\'s nail biting?',
        body: `Most childhood nail biting does not require professional intervention. The following signs suggest a need for closer attention and potentially professional evaluation:`,
        list: [
          'The biting causes physical damage — significant shortening of nails, bleeding cuticles, infections, or visible pain.',
          'The child is distressed about the habit, expresses shame or embarrassment, or has lost control of it despite wanting to stop.',
          'The nail biting is accompanied by other BFRBs such as hair pulling, skin picking, or cheek chewing.',
          'The habit appears linked to significant anxiety, sleep problems, school refusal, or other concerning behavioural changes.',
          'The child is over 10 and the habit is intensifying rather than naturally fading.',
        ],
      },
      {
        heading: 'What strategies work for children?',
        body: `For younger children (4–8), the most effective approaches are indirect and low-pressure. Drawing direct parental attention to the habit — particularly negative attention such as criticism or scolding — tends to increase anxiety and therefore increase biting. More effective approaches include: keeping fingernails short and smooth (removing the sensory trigger of a rough edge); providing alternative tactile stimulation (fidget tools, textured surfaces); and identifying the contexts where biting occurs and introducing alternative activities in those contexts.\n\nFor older children and adolescents, more direct awareness-based strategies become appropriate. Habit diaries, gentle self-monitoring, and discussion of triggers can be introduced with appropriate framing. Older children can engage with simple competing response training — for example, the child chooses their own competing response, which increases compliance. Bitter-tasting nail products are a useful adjunct and generally well-tolerated from age 7 upward.`,
      },
      {
        heading: 'When is professional help appropriate for childhood nail biting?',
        body: `When nail biting meets clinical thresholds — significant physical damage, marked distress, or co-occurring anxiety disorder — referral to a child psychologist or behavioural therapist trained in BFRBs is appropriate. Habit Reversal Training adapted for children (which emphasises the awareness and competing response components while reducing the social support component) has good evidence for ages 8 and above.\n\nFor children with co-occurring OCD or anxiety disorder, treatment of the primary condition — typically CBT for childhood OCD/anxiety — often produces parallel reductions in nail biting without targeting the habit directly. Parents should avoid the common error of treating the nail biting as an isolated behaviour when it may be a symptom of a broader anxiety pattern that warrants its own assessment.`,
      },
    ],
  },

  {
    slug: 'best-nail-biting-remedies',
    title: 'Best Remedies to Stop Nail Biting: Every Method Ranked by Evidence',
    description: 'From bitter nail polish to AI detection apps — a ranked review of every method to stop nail biting, with the evidence for each and who each approach suits best.',
    tag: 'Treatment',
    readingMinutes: 8,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'Why do most nail biting remedies fail?',
        body: `Most products marketed to stop nail biting target the symptom — the act of biting — rather than the underlying habit loop. Bitter-tasting polishes, physical barriers, and reminder bands all work on a simple aversive conditioning model: make the behaviour unpleasant enough and the person will stop. This works for mild, low-frequency nail biting, but fails for established habits because it doesn't address the automaticity that makes the behaviour resistant to volitional control in the first place.\n\nEffective nail biting remedies share a common mechanism: they introduce awareness at the moment the habit occurs and provide a pathway to a competing behaviour. Methods that do this consistently and in the right contexts produce durable change. Methods that only work when the person is already aware — or that are easy to override — produce temporary suppression that often rebounds.`,
      },
      {
        heading: 'Tier 1: Highest evidence — Habit Reversal Training (HRT)',
        body: `HRT is the evidence-based gold standard, with the strongest clinical research base of any nail biting remedy. Multiple randomised controlled trials and meta-analyses confirm its efficacy, with 70–90% reductions in biting frequency in participants who complete the protocol. HRT works by systematically building awareness and installing a competing response — addressing the habit at the level of the automatic loop rather than simply punishing the output.\n\nThe main limitation is investment: a full HRT protocol requires 4–8 weeks of structured practice, ideally with a trained therapist or at minimum a detailed self-help protocol. For mild habitual nail biters, this may feel disproportionate; for those with significant physical damage or psychological distress, it is the appropriate intervention. Self-administered HRT using workbooks or apps has also shown good results in several studies.`,
      },
      {
        heading: 'Tier 2: Good adjuncts — Bitter nail polishes',
        body: `Bitter-tasting nail preparations (Mavala Stop, Orly No Bite, Control-It, Thum) contain denatonium benzoate — the world's most bitter substance — or similar aversive compounds. Applied to the nails, they produce an immediate, powerful bitter taste whenever the fingers enter the mouth, interrupting the behaviour through aversive conditioning.\n\nThe evidence for standalone use is modest: a Cochrane review noted methodological limitations in most trials, and real-world compliance is imperfect because users often wash their hands and fail to reapply. However, as an adjunct to HRT — particularly in the early stages when the competing response habit is not yet established — bitter polishes provide a useful secondary layer of interruption. They are particularly effective for lower-severity nail biters and for children who are motivated to stop.`,
      },
      {
        heading: 'Tier 3: Promising new approach — AI detection apps',
        body: `Real-time AI detection represents a new category of nail biting remedy that directly addresses the core problem of awareness. Using computer vision running on-device (preventing any privacy concerns), these applications monitor via webcam and sound an alarm the moment the hand approaches the mouth. This provides the sensory interruption component of HRT automatically, in real time, without requiring a therapist or social partner to be present.\n\nThe mechanism is therapeutically sound: the alarm fires at the exact moment the automatic chain can most effectively be broken, and the jarring interruption promotes the development of conscious awareness over time. Early users report significant reductions in biting frequency within 2–4 weeks, consistent with the HRT literature on awareness training timelines. The technology is most effective for those who bite primarily during sedentary, screen-based activities — coding, video calls, reading — where a webcam can observe continuously.`,
      },
      {
        heading: 'Tier 4: Limited evidence — Mindfulness and stress reduction',
        body: `Mindfulness-based approaches — meditation, breathing exercises, body scanning — reduce the anxiety that drives stress-triggered nail biting. Several small studies have found reductions in BFRB frequency following MBSR (Mindfulness-Based Stress Reduction) programmes, likely through reduced reactivity to the emotional triggers that initiate biting.\n\nHowever, mindfulness does not address the automaticity of the habit and provides no mechanism for interrupting biting in the moment. It is best conceptualised as an upstream intervention that reduces trigger frequency, complementary to but not substitutable for direct habit intervention. Those with anxiety-driven nail biting are the most likely to benefit from adding a mindfulness practice to their HRT protocol.`,
      },
    ],
  },

  {
    slug: 'stress-and-nail-biting',
    title: 'The Stress–Nail Biting Connection: Why Anxiety Drives the Habit and How to Break the Loop',
    description: 'Stress is the most cited nail biting trigger. This article explains the neuroscience of anxiety-driven nail biting and evidence-based strategies to interrupt the stress–bite cycle.',
    tag: 'Psychology',
    readingMinutes: 7,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'Why does stress cause nail biting?',
        body: `Stress activates the sympathetic nervous system, increasing physiological arousal and creating an urge to discharge that arousal through motor activity. Nail biting — like other oral motor behaviours (gum chewing, pen chewing, cheek biting) — activates the oral motor system in a way that produces a mild but genuine calming effect through proprioceptive feedback. The jaw muscles and perioral area are richly innervated, and their activation during low-level oral motor behaviour appears to partially counteract the physiological arousal response.\n\nThis is not purely psychological: EEG studies have found that rhythmic oral motor activity reduces cortical arousal markers associated with stress. In other words, nail biting genuinely works — in the very short term — as a stress management tool. This pharmacological-style reinforcement is precisely why it becomes a conditioned response to stress rather than remaining a conscious choice.`,
      },
      {
        heading: 'What is the stress-habit feedback loop?',
        body: `Once nail biting is established as a stress response, it creates its own reinforcing loop. Stress triggers biting; biting briefly reduces arousal; reduced arousal reinforces biting as the go-to stress response; the next time stress occurs, the urge to bite is stronger. Over years, this loop becomes deeply encoded — the association between stress cues and the biting response becomes automatic and nearly immediate.\n\nA secondary feedback loop also operates: the visible damage from chronic biting (short, damaged nails) causes shame and social anxiety, which are themselves forms of stress, which intensifies the original trigger. Many chronic nail biters report that their self-consciousness about their nails generates as much biting-relevant anxiety as the original external stressors that initiated the habit.`,
      },
      {
        heading: 'How can you identify your personal stress triggers?',
        body: `Effective intervention requires identifying the specific stress contexts that trigger your biting. Generic stress is too broad a target; the habit is linked to specific cues. A habit diary kept for one week — recording every biting episode with time, location, emotional state, and what you were doing — will reveal patterns that are rarely visible without systematic tracking.\n\nCommon stress-context patterns in nail biters include: pre-deadline periods (the 24 hours before a deadline shows the highest biting rates for many people); social evaluation situations (video calls, presentations, meetings where performance is observed); decision-making under uncertainty; and interpersonal conflict. Identifying your highest-risk contexts allows you to implement proactive interventions — introducing competing responses or environmental modifications — before the automatic response activates.`,
      },
      {
        heading: 'Does reducing stress actually reduce nail biting?',
        body: `Stress reduction alone produces modest, inconsistent reductions in nail biting frequency. This is because the habit has been encoded as an automatic response — the trigger pathway exists independently of the overall stress level. Lowering baseline stress reduces trigger frequency but does not remove the conditioned response.\n\nThe analogy is a fire alarm connected to a thermostat: reducing the temperature (stress) makes the alarm go off less often, but the alarm itself (the habit response) still fires whenever the threshold is crossed. A complete intervention strategy requires both reducing triggers (stress management) and dismantling the automatic response (HRT, awareness training, competing response). Stress reduction alone is an upstream intervention; habit reversal training is the direct intervention on the response itself.`,
      },
      {
        heading: 'What stress management techniques complement HRT for nail biting?',
        body: `For nail biters with clear stress-driven patterns, combining HRT with targeted stress reduction produces the best outcomes. Evidence-based stress management techniques that complement HRT include: diaphragmatic breathing (shown to reduce salivary cortisol and physiological arousal rapidly, providing a competing physiological state); progressive muscle relaxation (which specifically targets the motor tension component of stress that drives oral motor behaviour); cognitive restructuring (addressing the perfectionism and catastrophising patterns that commonly drive nail biting anxiety); and structured worry time (containing rumination to specific periods rather than allowing it to diffuse throughout the day).`,
        list: [
          'Diaphragmatic breathing — 5 minutes, 3× daily: reduces cortisol and provides an oral motor alternative.',
          'Progressive muscle relaxation — targets the physical tension that drives motor habits.',
          'Cognitive restructuring — addresses perfectionism patterns strongly linked to nail biting.',
          'Structured worry time — reduces diffuse anxiety that raises baseline stress throughout the day.',
        ],
      },
    ],
  },

  {
    slug: 'onychophagia-ocd-connection',
    title: 'Onychophagia and OCD: Understanding the Link Between Nail Biting and Obsessive-Compulsive Disorder',
    description: 'Nail biting sits at the intersection of habit, anxiety, and OCD-spectrum disorders. This article explains the BFRB classification, diagnostic differences, and treatment implications.',
    tag: 'Clinical',
    readingMinutes: 7,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'How is nail biting classified in the DSM-5?',
        body: `The DSM-5 (Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition) classifies pathological nail biting under "Other Specified Obsessive-Compulsive and Related Disorder" when it reaches clinical severity — defined as causing significant distress or functional impairment. This classification places onychophagia within the OCD-spectrum, alongside trichotillomania (hair pulling), excoriation disorder (skin picking), and body dysmorphic disorder.\n\nHowever, DSM classification does not imply that nail biting is OCD, or that nail biters have OCD. The vast majority of nail biters — those who bite habitually but without significant functional impairment — would not meet diagnostic criteria for any disorder. The clinical classification applies only to cases where the behaviour is significantly out of control, causes physical damage, and generates meaningful distress.`,
      },
      {
        heading: 'What are body-focused repetitive behaviours (BFRBs)?',
        body: `Body-focused repetitive behaviours (BFRBs) are a cluster of conditions characterised by repetitive self-grooming behaviours — nail biting, hair pulling, skin picking, cheek biting — that cause physical damage and are performed compulsively despite attempts to stop. BFRBs share a common feature: they are not primarily driven by obsessions (as in OCD proper) but by urges, sensory experiences, and emotional states.\n\nThe TLC Foundation for Body-Focused Repetitive Behaviors (bfrb.org) identifies BFRBs as distinct from OCD despite their classification under the OCD-related disorders umbrella in the DSM-5. This distinction matters clinically: first-line OCD treatments such as ERP (Exposure and Response Prevention) are not as effective for BFRBs as HRT, and medication profiles also differ. Misclassifying a BFRB as OCD and treating it accordingly can delay effective treatment.`,
      },
      {
        heading: 'What is the actual overlap between nail biting and OCD?',
        body: `Research consistently finds elevated rates of co-occurrence between BFRBs and OCD, though the relationship is complex. Approximately 28–33% of individuals with OCD also exhibit at least one BFRB; conversely, BFRB sufferers show higher rates of OCD than the general population. Several family and twin studies suggest shared genetic factors, and neuroimaging studies have found overlapping patterns of corticostriatal dysfunction in both OCD and BFRBs.\n\nHowever, shared neural substrates do not indicate identity of mechanism. The key functional distinction remains: OCD compulsions are performed to reduce obsession-related anxiety and are ego-dystonic (experienced as unwanted, foreign to the self); BFRB behaviours are typically ego-syntonic (experienced as sensory relief or habit, not as foreign to the self) and are driven by urge rather than thought. This distinction guides treatment choice.`,
      },
      {
        heading: 'Does OCD treatment help nail biting?',
        body: `Standard OCD treatment — Exposure and Response Prevention (ERP) and SSRI medication — has mixed results for BFRBs. ERP is significantly less effective for BFRBs than for OCD proper, because the mechanism it targets (reducing anxiety through habituation to feared stimuli) does not map cleanly onto the urge-driven, sensory-reinforced pattern of BFRBs. Some BFRB sufferers find ERP unhelpful or counterproductive.\n\nSSRI medications (fluoxetine, sertraline, fluvoxamine) that produce robust effects in OCD show more modest and inconsistent results in BFRBs across clinical trials. N-acetylcysteine (NAC), a glutamate modulator, has shown promising results in BFRB treatment in several randomised trials, though larger studies are needed. The treatment-of-choice for BFRBs — including clinical-level nail biting — remains Habit Reversal Training, with Comprehensive Behavioral Treatment (ComB) as a more recent evolution of the HRT framework.`,
      },
      {
        heading: 'Should I see a therapist about my nail biting?',
        body: `A mental health evaluation is appropriate when nail biting causes: significant physical damage (infections, tooth damage, permanent nail changes); meaningful distress or shame; functional impairment (avoiding activities because of the habit); or when the habit fails to respond to self-help HRT approaches after 8–12 weeks of consistent effort.\n\nWhen seeking treatment, it is important to find a therapist with specific experience in BFRBs — not simply OCD treatment, as the approaches differ meaningfully. The TLC Foundation for BFRBs maintains a therapist directory at bfrb.org. Telehealth has made BFRB-trained therapists substantially more accessible, and there is good evidence that HRT delivered via videoconference produces outcomes equivalent to in-person treatment.`,
      },
    ],
  },

  {
    slug: 'how-ai-can-help-stop-nail-biting',
    title: 'How AI Can Help You Stop Biting Your Nails: The Technology Behind Real-Time Detection',
    description: 'Real-time AI detection solves the awareness problem at the core of nail biting. This article explains how webcam-based AI works, the HRT mechanism it automates, and what to expect.',
    tag: 'Technology',
    readingMinutes: 7,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'What is the core problem AI solves for nail biting?',
        body: `The central challenge in stopping nail biting is not motivation — most nail biters want to stop — it is the automaticity of the habit. Research on BFRB behaviour consistently finds that nail biters are unaware of the majority of their daily biting episodes. The hand-to-mouth movement is executed below the threshold of conscious attention before any opportunity for deliberate intervention.\n\nHabit Reversal Training's primary active ingredient is awareness training — systematically raising the threshold at which the person notices the habit occurring. But awareness training in its traditional form requires human support: a therapist, a partner, or an extremely disciplined self-monitoring practice. Real-time AI detection provides this awareness trigger automatically, at the exact moment the habit occurs, in any context where a camera is available.`,
      },
      {
        heading: 'How does webcam-based nail biting detection actually work?',
        body: `Modern real-time nail biting detection uses a combination of hand landmark detection and face landmark detection to identify when fingers are near the mouth. The hand model tracks 21 key points on the hand with sub-centimetre precision; the face model tracks 468 facial landmarks including the precise location of the lips and mouth opening. When hand landmarks and mouth landmarks are simultaneously within a defined geometric proximity, the detection fires.\n\nThe underlying AI framework — MediaPipe, developed by Google — runs entirely in WebAssembly, a portable binary instruction format that executes at near-native speed inside browsers and desktop applications. This means the detection runs at 30+ frames per second entirely on the user's local CPU or GPU, with no network connection to any server required. The camera feed never leaves the device — a non-trivial privacy consideration for a tool that operates continuously during work hours.`,
      },
      {
        heading: 'Is AI detection as effective as human awareness training?',
        body: `The therapeutic mechanism is identical to the sensory interruption component of HRT — an external signal that breaks the automatic chain at the moment of occurrence. What AI detection adds over traditional methods is: real-time precision (the alarm fires at the exact moment, not after the bite has occurred); consistency (no lapses, no social awkwardness, no communication errors); and persistence (the system monitors continuously without fatigue or distraction).\n\nEarly user reports suggest a characteristic adaptation curve: weeks 1–2 see frequent alarms as the system captures the full scope of previously-unnoticed biting; weeks 3–4 show decreasing alarm frequency as awareness increases; weeks 5–8 show continued reductions as the competing response becomes habitual. This mirrors the timeline observed in clinical HRT studies — consistent with the hypothesis that the AI is activating the same underlying mechanism as the sensory interruption component of HRT.`,
      },
      {
        heading: 'What are the privacy implications of a webcam monitoring app?',
        body: `Privacy is the central concern for any application that operates a webcam continuously during work hours. The Nail Habit App addresses this through architecture rather than policy: because MediaPipe runs entirely in WebAssembly on the user's device, no camera data — not a single frame — is transmitted over the network. This can be independently verified by monitoring network traffic while the app runs; no camera-related packets will be observed.\n\nThe SQLite database storing incident logs and streaks is also local. Uninstalling the app removes all data. There is no cloud sync, no user analytics, no behavioural data collected. For anyone considering the trade-off of continuous camera monitoring against the therapeutic benefit, the data architecture makes the privacy case straightforwardly: the camera feed is processed and discarded locally, frame by frame, with no persistence and no network transmission.`,
      },
      {
        heading: 'What should I expect in the first month of using AI detection for nail biting?',
        body: `The first week is typically the most disorienting. The alarm fires frequently — often far more frequently than the user expected based on their subjective sense of how often they bit. This is the most therapeutically important period: the gap between perceived and actual biting frequency becomes concretely visible. Some users find this discouraging; reframing it as data collection rather than failure is important.\n\nBy week two, most users report becoming more aware of the urge before the hand moves — the beginning of genuine awareness training. By week three, they begin noticing their hand moving before it reaches the mouth, and can intercept the movement before the alarm fires. This progression from post-hoc alarm to proactive interception is the target outcome of the awareness training component of HRT — and it is the point at which durable habit change becomes possible.`,
      },
    ],
  },

  {
    slug: 'nail-biting-during-focus-and-work',
    title: 'Nail Biting at Work: Why Deep Focus and Concentration Trigger the Habit',
    description: 'Many people bite their nails specifically during focused work — coding, reading, meetings. This article explains the focus-habit loop and how to interrupt it without breaking your flow state.',
    tag: 'Productivity',
    readingMinutes: 6,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'Why does nail biting happen during focused work?',
        body: `Deep cognitive focus — the kind that occurs during coding, writing, reading, or detailed analytical work — involves a specific pattern of prefrontal cortex engagement. When the prefrontal cortex is heavily allocated to a demanding task, its capacity for self-monitoring and inhibitory control is temporarily reduced. This reduced inhibitory control is the neurological opening through which automatic behaviours like nail biting slip through.\n\nIn a resting state, the same prefrontal regions that suppress habitual behaviours are more available. During intense focus, they are recruited elsewhere. The result is that many nail biters bite exclusively — or far more frequently — during focused work, and have little to no problem in non-work contexts. This context-specificity is a key diagnostic clue and suggests that the intervention strategy should target the work context specifically.`,
      },
      {
        heading: 'What is the focus-habit loop?',
        body: `The focus-habit loop is a specific variant of the general habit loop that operates through the following sequence: the cue is the transition into deep focus (opening a code editor, starting a document, joining a meeting); the routine is the hand-to-mouth movement and biting; and the reward is proprioceptive stimulation that provides low-level sensory input without disrupting cognitive flow — the habit keeps the rest of the nervous system occupied while the prefrontal cortex works.\n\nThis reward structure explains why nail biting during focus is so persistent. It does not compete with the primary task; in fact, for many people it feels like it enhances focus by providing peripheral sensory stimulation. Some research on oral motor behaviour and cognitive performance suggests this is not entirely illusory — oral motor activity can reduce cortical arousal in ways that may temporarily support sustained attention. This makes the habit particularly hard to break because it provides real, immediate functional value.`,
      },
      {
        heading: 'How can you interrupt focus-triggered nail biting without breaking flow?',
        body: `The key constraint for work-context interventions is that they must not disrupt the cognitive flow state that is, paradoxically, when the intervention is most needed. Heavy-friction interventions — putting on gloves, applying bitter polish that must be reapplied after hand washing, wearing physical barriers — all impose conscious awareness overhead that interrupts the work.\n\nThe optimal intervention is one that requires minimal deliberate attention: an external signal (audible alarm) that provides awareness without requiring pre-emptive self-monitoring. This is why real-time AI detection is particularly well-suited to work-context nail biting. The camera monitors continuously; the alarm fires when detection occurs; the user applies a competing response (pressing palms flat on the desk, for example) and returns to work within seconds, without having to track or manage the habit consciously during focused periods.`,
      },
      {
        heading: 'What competing responses work during deep focus?',
        body: `The competing response must be physically incompatible with nail biting, maintainable for 1–3 minutes, and low enough in cognitive cost that it does not derail the focus state. The following have the best compatibility with work contexts:`,
        list: [
          'Pressing palms flat on the desk surface — physically incompatible, requires no conscious management, can be held for 1–3 minutes while continuing to think.',
          'Gripping a textured object (stress ball, smooth stone) in the dominant hand — redirects the tactile seeking to a sanctioned target.',
          'Interlacing fingers and pressing them together under the desk — invisible in video calls, low cognitive overhead.',
          'Touch-typing deliberately — occupies both hands in a way that prevents hand-to-mouth movement, compatible with writing tasks.',
        ],
      },
      {
        heading: 'Should I monitor my work sessions for nail biting frequency?',
        body: `Tracking bite frequency across work sessions provides data that is both therapeutically useful and often surprising. Most people who bite primarily during work estimate their daily frequency at 5–15 bites; systematic monitoring typically reveals 30–60+ biting events per session in chronic cases — most of which were entirely unconscious.\n\nThis data is valuable beyond its shock value: it allows identification of specific work types that trigger the most biting (meetings vs. solo coding vs. email vs. reading), time-of-day patterns, and correlation with workload intensity. With this data, targeted interventions can be deployed in the highest-risk contexts rather than attempting constant vigilance across all activities — a strategy that is both more effective and more sustainable over the weeks required for habit change.`,
      },
    ],
  },

  {
    slug: 'breaking-any-habit-science',
    title: 'The Neuroscience of Habit Breaking: How to Apply It Specifically to Nail Biting',
    description: 'Why are habits so hard to break? This article explains the neuroscience of habit formation and extinction, and how those mechanisms apply to stopping nail biting.',
    tag: 'Science',
    readingMinutes: 8,
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    sections: [
      {
        heading: 'How does the brain form habits?',
        body: `Habits are formed through a process called procedural learning — a form of memory consolidation that occurs primarily in the basal ganglia, a set of subcortical structures involved in motor control and reward processing. When a behaviour is repeated consistently in the context of a stable cue and followed by a reward (even a minor one), the neural pathway strengthens through long-term potentiation — the repeated activation of the same synaptic connections increases their efficiency.\n\nThe process is not linear: early repetitions strengthen the pathway rapidly; later repetitions consolidate it against extinction. This is why habits formed over years are substantially more resistant to change than recently acquired ones. Nail biting that has been practiced daily for a decade is encoded at a significantly deeper level than nail biting that began six months ago — requiring proportionally more consistent counter-effort to extinguish.`,
      },
      {
        heading: 'What is the habit loop and how does it apply to nail biting?',
        body: `Charles Duhigg's popular formulation of the habit loop — cue, routine, reward — maps cleanly onto nail biting. The cue is typically an emotional state (stress, boredom, frustration) or a context (sitting at a desk, watching a screen). The routine is the hand-to-mouth movement and biting action. The reward is the proprioceptive stimulation and brief emotional regulation effect that biting produces.\n\nThe key insight from habit neuroscience is that the cue-routine-reward association is stored as a single chunk in basal ganglia memory. When the cue occurs, the entire routine is retrieved and executed as a unit, bypassing cortical deliberation. This chunking is what makes the habit automatic — and it explains why the habit continues even when the person consciously does not want to bite. The conscious "I don't want to do this" runs in the prefrontal cortex; the automatic execution runs in the basal ganglia, faster and with higher motor priority.`,
      },
      {
        heading: 'Can habits be truly erased, or only suppressed?',
        body: `The neuroscience literature suggests that established habits are not erased — they are overridden. The original cue-routine-reward pathway in the basal ganglia remains encoded even after successful habit change; it is suppressed by a competing pathway that has been strengthened through consistent practice. This has a practical implication: nail biters who have successfully stopped often find that the habit resurfaces during high-stress periods or in contexts similar to those where the habit was originally established.\n\nThis "habit relapse" is not a sign of failure or weakness; it is a predictable consequence of the neurological architecture of habit storage. The original pathway, though suppressed, remains available to be reactivated by sufficiently strong cues. Long-term success requires maintaining the competing response habit — not assuming that one period of successful change has permanently eliminated the original pathway.`,
      },
      {
        heading: 'What conditions are necessary for successful habit change?',
        body: `The habit change literature identifies several conditions that predict successful outcome. Consistency of the new response across the full range of triggering contexts is the strongest predictor — partial habit change (stopping during some contexts but not others) tends to maintain the original pathway in the unaddressed contexts and allows it to gradually recolonise. Environmental modification — changing the physical or social context to reduce cue exposure — reduces trigger frequency and extends the window for competing response establishment.\n\nFeedback frequency and immediacy are also strong predictors. Delayed feedback (reviewing a daily log at the end of the day) is far less effective than immediate feedback (an alarm the moment biting occurs). This is consistent with basic reinforcement learning theory: the longer the delay between behaviour and consequence, the weaker the associative link. Immediate feedback creates immediate association — which is why real-time detection systems have a stronger behaviour-change mechanism than retrospective logging apps.`,
      },
      {
        heading: 'How long does it take to break the nail biting habit?',
        body: `The popular claim that habits take 21 days to change derives from a misreading of a 1960 book by plastic surgeon Maxwell Maltz. The actual evidence is more complex. A 2010 study by Phillippa Lally at University College London found that habit formation (the time for a new behaviour to become automatic) ranged from 18 to 254 days, with a median of 66 days — with simple behaviours at the lower end and complex, emotionally-loaded behaviours at the upper end.\n\nFor nail biting specifically, clinical HRT trials show meaningful reductions within 4–8 weeks of consistent practice, with continued improvements over the following 3–6 months as the competing response consolidates. "Breaking" the habit — in the sense of substantially reducing automatic occurrence — is achievable within 2–3 months for motivated individuals using evidence-based approaches. Eliminating the underlying neural pathway entirely, if such a thing is even neurologically possible, is a longer and less certain process. Sustainable success strategies treat habit management as ongoing practice rather than a one-time cure.`,
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(p => p.slug === slug);
}
