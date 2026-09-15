import { lazy, Suspense, useState } from 'react';
import {
  ShieldCheck, Zap, Cpu, BellRing, Trophy,
  ClipboardList, BarChart2, WifiOff,
  ChevronDown, Camera, BookOpen,
  ArrowRight, Loader2,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ThemeToggle } from '../components/ThemeToggle';
import { ContactForm } from '../components/ContactForm';
import { PricingSection } from '../components/PricingSection';
import { BLOG_INDEX } from '../data/blogIndex';

// The live demo pulls in MediaPipe — 125 KB of WebAssembly glue that the landing
// page's critical path must never pay for. Lazy so it lands in its own chunk,
// and mounted only from the visitor's click (see `demoStarted` below) so a page
// view fetches nothing detection-related at all.
const HeroDemo = lazy(() =>
  import('../components/demo/HeroDemo').then(m => ({ default: m.HeroDemo })),
);

// Verbatim copy of HeroDemo's own loading line: the chunk fetch runs straight
// into the model download, and the visitor should see one message, not two.
const DEMO_LOADING_LABEL = 'Downloading AI models (~20 MB, one time)…';

// Pulled from the real post data so titles and reading times can't drift.
const FEATURED_SLUGS = [
  'habit-reversal-training-guide',
  'nail-biting-health-risks',
  'how-ai-can-help-stop-nail-biting',
];
const FEATURED_POSTS = FEATURED_SLUGS
  .map(slug => BLOG_INDEX.find(p => p.slug === slug))
  .filter((p): p is NonNullable<typeof p> => p !== undefined);

// The apparatus row under the hero's call to action — what the thing is, in
// five words or fewer each, set as a mono rule of hairline-separated terms.
const HERO_TAGS = ['Web App', 'PWA install', 'MediaPipe AI', '100% private', 'No cloud'];

// Margin echoes of the stats strip further down the page: the same three
// numbers with the same labels, set beside Figure 1 the way a journal sets its
// key values in the figure margin. The strip itself (and the citation footnote
// that supports these numbers) remains the canonical statement of them — change
// both or neither.
const HERO_FIGURES: { figure: string; label: string }[] = [
  { figure: '20–30%', label: 'of adults bite their nails chronically' },
  { figure: '~99%', label: 'fewer biting episodes in the landmark habit reversal trial' },
  { figure: '0 bytes', label: 'Of camera data sent to servers' },
];

// Mirrors the FAQPage JSON-LD in index.html. Google requires FAQ structured data
// to have a visible on-page counterpart, so these two must stay in step.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Why do people bite their nails?',
    a: 'Nail biting (onychophagia) is a body-focused repetitive behaviour affecting up to 30% of adults. Common triggers are stress, anxiety, boredom, and deep focus. The habit usually starts in childhood and becomes automatic — happening without conscious awareness. Genetic predisposition, perfectionism, and OCD-spectrum tendencies are also linked.',
  },
  {
    q: 'What are the best remedies to stop nail biting?',
    a: 'The evidence-based options are habit reversal training (the strongest by some margin), bitter-taste polishes like Mavala Stop, real-time awareness tools such as AI detection, competing response training, and stress reduction. Most people do best combining an awareness method with a competing response rather than relying on any single remedy.',
  },
  {
    q: 'What is habit reversal training for nail biting?',
    a: 'Habit reversal training (HRT) is a cognitive-behavioural method with three parts: awareness training — learning to notice every time you bite; a competing response — an incompatible action like clenching a fist or pressing your palms flat; and social support. In the original Azrin and Nunn clinical trial, participants who practised it consistently achieved a near-complete reduction in biting.',
  },
  {
    q: 'Is nail biting harmful?',
    a: 'Yes. Chronic nail biting causes dental damage including chipped teeth and jaw strain, nail fold infections, transfer of pathogens from fingers to mouth, and permanent nail deformity in severe cases. The visible damage also drives shame and social anxiety, which increases biting — a self-reinforcing cycle.',
  },
  {
    q: 'Does Stop Biting send my camera feed to the internet?',
    a: 'No. Detection uses MediaPipe — Google\'s WebAssembly vision framework — running entirely on your device. Your camera feed is never uploaded, streamed, or stored anywhere outside it. There are zero network requests during detection: you can disconnect from the internet and the app works identically.',
  },
  {
    q: 'How long does it take to stop biting your nails?',
    a: 'Most people notice more biting in week one, because they are finally catching episodes they used to miss. Frequency typically starts dropping meaningfully between weeks two and four, and the competing response starts feeling natural around weeks six to eight. Habit-formation research suggests a median of roughly two months for a new response to become automatic.',
  },
];

// The redesign's signature device. Every numbered body section opens with a
// full-width hairline carrying its ordinal and its label:
//
//     01 ──────────────────────────────────────────────  THE PROBLEM
//
// `.reveal` lives on this row, not on an ancestor, for a reason: `.ed-rule-draw`
// parks the rule at scaleX(0) and is only released by `.revealed .ed-rule-draw`,
// and useScrollReveal puts `.revealed` on the `.reveal` element itself. Put
// `.reveal` anywhere that never reveals (e.g. the hero) and the rule stays
// invisible for ever. Tasks 4–5: reuse this for sections 03–07, don't re-invent it.
function SectionMark({ n, label }: { n: string; label: string }) {
  return (
    <div className="reveal ed-mark text-stone-500 dark:text-stone-400">
      <span className="ed-mono flex-shrink-0">{n}</span>
      <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
      <span className="ed-mono flex-shrink-0">{label}</span>
    </div>
  );
}

interface Props {}

export function Landing(_props: Props) {
  useTheme();
  useScrollReveal();

  // Stays false until the visitor asks for the demo — the lazy import is only
  // ever triggered by this flag, which is what keeps MediaPipe off a page view.
  const [demoStarted, setDemoStarted] = useState(false);

  return (
    // `ed-page` scopes the editorial focus-visible ring (see index.css). Without
    // it nothing on this page gets a visible focus outline.
    <div className="ed-page min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      {/* Structurally identical to the navs on /blog, /pricing and the legal
          pages — fixed, full-width, hairline bottom rule, same three items and
          the same hrefs. Only the typesetting differs here. */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="flex items-center gap-2.5 text-stone-800 dark:text-stone-100">
          <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
          <span className="font-display text-lg leading-none tracking-[-0.01em]">Stop Biting Nails</span>
        </a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            <span className="ed-link">Blog</span>
          </a>
          <ThemeToggle />
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-forest-600 hover:bg-forest-500 text-cream-100 px-4 py-1.5 rounded-xl transition-colors duration-150"
          >
            <Zap size={13} aria-hidden="true" />
            Sign in to app
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      {/* Above the fold, so the entrance is a fixed stagger on `animate-fade-up`
          rather than `.reveal`: an IntersectionObserver would fire on every one
          of these at once and there would be no stagger left to see. For the
          same reason nothing in here may use `.ed-rule-draw` — that class parks
          a rule at scaleX(0) until an ancestor `.reveal` is `.revealed`, which
          never happens here, and the rule would simply never appear. */}
      <main>
        <section aria-label="Hero" className="pt-28 pb-20 sm:pt-32 lg:pt-36 lg:pb-28">
          <div className="ed-container">
            <div className="ed-grid">

              {/* ── The argument (cols 1–7) ──────────────────────────────── */}
              <div className="ed-main lg:row-start-1">
                <p
                  className="animate-fade-up ed-mono text-forest-600 dark:text-forest-400"
                  style={{ animationDelay: '0ms' }}
                >
                  For everyone who's tried to quit — and couldn't
                </p>

                <h1
                  className="animate-fade-up ed-display mt-6 text-stone-800 dark:text-stone-100"
                  style={{ animationDelay: '80ms' }}
                >
                  Stop biting your nails.<br />
                  <em className="not-italic text-forest-600 dark:text-forest-400">For good, this time.</em>
                </h1>

                <p
                  className="animate-fade-up ed-lede ed-measure mt-7 text-stone-600 dark:text-stone-400"
                  style={{ animationDelay: '160ms' }}
                >
                  Bitter polish, gloves, sheer willpower — none of it stuck, because nail biting was never a
                  willpower problem. It runs on autopilot, and by the time you notice, you're already doing it.{' '}
                  <span className="text-stone-800 dark:text-stone-100 font-medium">Stop Biting catches the exact moment your hand reaches your mouth</span>{' '}
                  and interrupts it — which is the active ingredient in habit reversal training, the approach
                  with the strongest clinical evidence behind it. Every frame is processed on your own device.
                </p>

                {/* The on-device guarantee, set as an instrument reading: ruled
                    top and bottom, mono, with the live dot still ticking. */}
                <div
                  className="animate-fade-up mt-9 flex items-center gap-3 border-y border-stone-200 dark:border-ink-400 py-3 text-forest-600 dark:text-forest-400"
                  style={{ animationDelay: '240ms' }}
                >
                  <ShieldCheck size={14} className="flex-shrink-0" aria-hidden="true" />
                  <span className="ed-mono">All AI processing on-device — zero network requests during detection</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-500 dark:bg-forest-400 animate-pulse flex-shrink-0" aria-hidden="true" />
                </div>

                <div
                  className="animate-fade-up mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"
                  style={{ animationDelay: '320ms' }}
                >
                  <a
                    href="/api/auth/google"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-150"
                  >
                    Start free trial
                    <ArrowRight
                      size={14}
                      className="opacity-70 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </a>
                  <a
                    href="/blog"
                    className="ed-link text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    Read the science
                  </a>
                </div>

                {/* What it is, in apparatus terms — hairline-separated. */}
                <ul
                  className="animate-fade-up mt-10 flex flex-wrap items-center gap-y-2 text-stone-500 dark:text-stone-400"
                  style={{ animationDelay: '400ms' }}
                >
                  {HERO_TAGS.map((tag, i) => (
                    <li key={tag} className="flex items-center">
                      <span className="ed-mono">{tag}</span>
                      {i < HERO_TAGS.length - 1 && (
                        <span className="mx-3 h-3 w-px bg-stone-300 dark:bg-ink-400" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* The gutter rule: one hairline down the middle of column 8,
                  separating argument from apparatus. lg and up only — below
                  that the two columns stack and a vertical rule would be a
                  line through the middle of nothing. */}
              <div
                aria-hidden="true"
                className="animate-fade-in hidden lg:block lg:col-start-8 lg:row-start-1 w-px justify-self-center bg-stone-200 dark:bg-ink-400"
                style={{ animationDelay: '560ms' }}
              />

              {/* ── Figure 1 (cols 9–12) ─────────────────────────────────── */}
              <figure
                className="ed-aside animate-fade-up lg:row-start-1"
                style={{ animationDelay: '480ms' }}
              >
                <figcaption className="text-stone-500 dark:text-stone-400">
                  <span className="ed-mark">
                    <span className="ed-mono">Fig. 1</span>
                    <span className="ed-mark-rule" aria-hidden="true" />
                  </span>
                  <span className="ed-mono mt-3 block">The detector, running on your device</span>
                </figcaption>

                {/* ── LIVE DEMO ───────────────────────────────────────────── */}
                {/* Heading and paragraph render on page view — they are the
                    crawler-visible copy mirrored in server.js and must not be
                    hidden behind the click. Only the detector itself is deferred. */}
                <section id="live-demo" aria-labelledby="live-demo-heading" className="mt-7">
                  <h2
                    id="live-demo-heading"
                    className="font-display text-2xl leading-[1.1] tracking-[-0.01em] text-stone-800 dark:text-stone-100"
                  >
                    Try the detector right now
                  </h2>
                  <p className="ed-body mt-3 text-stone-600 dark:text-stone-400">
                    Run the real nail biting detector on your own camera for 60 seconds — no
                    account, no signup. The AI models download once (about 20 MB) and then
                    everything runs on your device: open your browser's network panel and you'll
                    see zero requests while it is watching. Nothing is uploaded and nothing is
                    saved.
                  </p>

                  {/* Opaque backgrounds on purpose: the `ink`/`cream` scales are raw
                      oklch() strings with no <alpha-value> placeholder, so Tailwind
                      silently drops any `/opacity` variant of them. `bg-white/70`
                      does generate, so a translucent pair here would leave the card
                      white in dark mode. Matches the card style in CameraPanel. */}
                  <div className="mt-6 rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 shadow-card dark:shadow-card-dark p-5">
                    {demoStarted ? (
                      <Suspense
                        fallback={
                          <p className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500 dark:text-stone-400">
                            <Loader2
                              size={14}
                              className="animate-spin text-forest-500 dark:text-forest-400 flex-shrink-0"
                              aria-hidden="true"
                            />
                            {DEMO_LOADING_LABEL}
                          </p>
                        }
                      >
                        <HeroDemo autoStart />
                      </Suspense>
                    ) : (
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          onClick={() => setDemoStarted(true)}
                          className="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-150"
                        >
                          <Camera size={15} aria-hidden="true" />
                          Try the live demo
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Key values in the figure margin. The stats strip lower down
                    is still the canonical statement of these three numbers and
                    carries the citation footnote for them. */}
                <dl aria-label="Key figures" className="mt-10 border-t border-stone-200 dark:border-ink-400">
                  {HERO_FIGURES.map(({ figure, label }) => (
                    <div
                      key={label}
                      className="flex items-baseline gap-4 border-b border-stone-200 dark:border-ink-400 py-3.5"
                    >
                      <dt className="font-display text-2xl leading-none text-forest-600 dark:text-forest-400 w-24 flex-shrink-0">
                        {figure}
                      </dt>
                      <dd className="ed-mono text-stone-500 dark:text-stone-400">{label}</dd>
                    </div>
                  ))}
                </dl>
              </figure>

            </div>
          </div>
        </section>

        {/* ── 01 · THE PROBLEM ──────────────────────────────────────────── */}
        {/* Was the `why-bite-heading` card plus the stats strip that used to
            sit four sections lower. Both are here now: the argument in the
            narrative column, the prevalence figures in the margin where a
            journal would set them. No frame, no bullet dots — the triggers are
            a definition list ruled with hairlines, and the strip's long source
            note is now doing its proper job as the figure's <figcaption>.
            Sections open on the previous block's bottom padding, so there is no
            top padding and no top rule here: the section mark is the seam. */}
        <section aria-labelledby="why-bite-heading" className="pb-20 lg:pb-28">
          <div className="ed-container">
            <SectionMark n="01" label="The problem" />

            <div className="ed-grid mt-10 lg:mt-14">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="why-bite-heading" className="ed-h2 text-stone-800 dark:text-stone-100">
                  Why do people bite their nails?
                </h2>

                <p className="ed-lede ed-measure mt-6 text-stone-600 dark:text-stone-400">
                  About 1 in 4 adults bites their nails — not occasionally, but chronically. Most have been doing it since childhood. Most have tried to stop more than once. The reason it's so hard isn't weak willpower. It's that the habit runs on autopilot, below the level of conscious thought.
                </p>

                <h3 className="mt-11 text-[1.0625rem] font-semibold leading-[1.4] text-stone-800 dark:text-stone-100">
                  When it tends to happen
                </h3>

                {/* Short terms, so the definition list can run two-up at sm and
                    above: term in the hanging column, sense beside it. */}
                <dl className="mt-5 border-t border-stone-200 dark:border-ink-400">
                  {([
                    ['Stress', "Your brain reaches for something familiar when anxiety spikes. Biting gives a brief sense of relief, which teaches your brain to reach for it again next time."],
                    ['Deep focus', "The part of your brain that monitors what your hands are doing goes quiet when you're concentrating hard. This is why you look down and realise you've been biting for the last 20 minutes."],
                    ['Pure habit', 'After years of repetition, the context itself — laptop open, meeting on, desk — is enough to trigger it. No stress required. The hand just... moves.'],
                  ] as const).map(([label, text]) => (
                    <div
                      key={label}
                      className="border-b border-stone-200 dark:border-ink-400 py-4 sm:grid sm:grid-cols-[7.5rem_1fr] sm:gap-6"
                    >
                      <dt className="text-sm font-semibold leading-[1.7] text-stone-800 dark:text-stone-100">{label}</dt>
                      <dd className="ed-body ed-measure mt-1 sm:mt-0 text-stone-600 dark:text-stone-400">{text}</dd>
                    </div>
                  ))}
                </dl>

                <p className="ed-body ed-measure mt-8 text-stone-600 dark:text-stone-400">
                  Bitter nail polish and physical barriers don't fix this — they fight the symptom. What actually works is catching the moment it starts and building awareness of when and why it happens.
                </p>

                <a
                  href="/blog/why-do-people-bite-their-nails"
                  className="group mt-7 inline-flex items-center gap-1.5 text-sm text-forest-600 dark:text-forest-400 hover:text-forest-500 transition-colors"
                >
                  <span className="ed-link">Read the full article</span>
                  <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>

              {/* Figure 2 — the prevalence and outcome figures, finally set as a
                  real figure. `aria-label` keeps the strip's old accessible name
                  ("Key statistics") and matches the visible mono label; the
                  <figcaption> carries the source note verbatim. Like Figure 1 in
                  the hero, the caption rule does not draw — the draw is reserved
                  for section marks, so a figure never mimics a section opener. */}
              <figure
                aria-label="Key statistics"
                className="ed-aside reveal"
                style={{ transitionDelay: '160ms' }}
              >
                <div className="ed-mark text-stone-500 dark:text-stone-400">
                  <span className="ed-mono flex-shrink-0">Fig. 2</span>
                  <span className="ed-mark-rule" aria-hidden="true" />
                  <span className="ed-mono flex-shrink-0">Key statistics</span>
                </div>

                <dl className="mt-7 border-t border-stone-200 dark:border-ink-400">
                  {[
                    { number: '20–30%', label: 'of adults bite their nails chronically' },
                    { number: '~99%', label: 'fewer biting episodes in the landmark habit reversal trial' },
                    { number: '0 bytes', label: 'Of camera data sent to servers' },
                  ].map(({ number, label }) => (
                    <div key={label} className="border-b border-stone-200 dark:border-ink-400 py-5">
                      <dt className="ed-figure text-forest-600 dark:text-forest-400">{number}</dt>
                      <dd className="ed-mono mt-3 text-stone-500 dark:text-stone-400">{label}</dd>
                    </div>
                  ))}
                </dl>

                <figcaption className="ed-caption ed-measure mt-5 text-stone-400 dark:text-stone-500">
                  Prevalence: Halteh, Scher &amp; Lipner (2017). Reduction figure: Azrin, Nunn &amp; Frantz (1980) — self-recorded episode counts over the trial's five months, not a follow-up after treatment ended. Camera privacy is architectural — there's no server to send data to.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── 02 · THE METHOD ───────────────────────────────────────────── */}
        {/* The `hrt-heading` article and the old "How it works" section, merged:
            the theory, then the three steps this app implements. The margin is
            deliberately empty here — there is no data to set in it, and an
            invented marginal note would be decoration. */}
        <section aria-labelledby="hrt-heading" className="pb-20 lg:pb-28">
          <div className="ed-container">
            <SectionMark n="02" label="The method" />

            <div className="ed-grid mt-10 lg:mt-14">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="hrt-heading" className="ed-h2 text-stone-800 dark:text-stone-100">
                  The approach that actually works
                </h2>

                <p className="ed-lede ed-measure mt-6 text-stone-600 dark:text-stone-400">
                  Habit Reversal Training is the most studied method for stopping nail biting — and the one with the best results. In the landmark clinical trial it cut biting episodes by roughly 99%, and a meta-analysis of 18 studies confirmed large effects. The reason it works when willpower doesn't is that it targets the habit at the automatic level, not the conscious one.
                </p>

                <h3 className="mt-11 text-[1.0625rem] font-semibold leading-[1.4] text-stone-800 dark:text-stone-100">
                  How it works
                </h3>

                {/* HRT's three parts. Titles run long, so these stack rather
                    than running two-up like the triggers in 01. The rounded
                    forest bar that used to flag each one is gone — a 3px forest
                    rule is Task 4's pull-quote device. */}
                <div className="mt-5 border-t border-stone-200 dark:border-ink-400">
                  {([
                    ['Notice it happening', "Most nail biters catch fewer than half their daily biting episodes. Step one is simply becoming aware every single time — which is harder than it sounds when the habit is fully automatic."],
                    ['Do something else instead', 'The moment you notice it, replace the bite with something your hands can\'t do simultaneously — press your palms flat, clench a fist, grip the desk. Hold it for a minute.'],
                    ['Get an external signal', 'In clinical settings, a therapist would tap your shoulder. The audio alarm in this app does the same thing: it catches the moment you missed.'],
                  ] as const).map(([title, text]) => (
                    <div key={title} className="border-b border-stone-200 dark:border-ink-400 py-4">
                      <p className="text-sm font-semibold leading-[1.7] text-stone-800 dark:text-stone-100">{title}</p>
                      <p className="ed-body ed-measure mt-1 text-stone-600 dark:text-stone-400">{text}</p>
                    </div>
                  ))}
                </div>

                <p className="ed-body ed-measure mt-8 text-stone-600 dark:text-stone-400">
                  Stop Biting handles the awareness and the signal. What you do with your hands instead is up to you.
                </p>

                <a
                  href="/blog/habit-reversal-training-guide"
                  className="group mt-7 inline-flex items-center gap-1.5 text-sm text-forest-600 dark:text-forest-400 hover:text-forest-500 transition-colors"
                >
                  <span className="ed-link">Read the full HRT guide</span>
                  <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                </a>

                {/* The old "How it works" section, folded in as 02's second
                    half. Its h2 is an h3 now (02's h2 is the HRT heading) and
                    keeps `id="how-heading"`, so the aria-labelledby on this
                    nested section still resolves. The eyebrow that used to sit
                    above it is the label on the divider rule — which keeps the
                    two "How it works" strings on the page in different
                    registers: a sub-head above HRT's parts, apparatus here. */}
                <section aria-labelledby="how-heading" className="reveal mt-16">
                  <div className="ed-mark text-stone-500 dark:text-stone-400">
                    <span className="ed-mono flex-shrink-0">How it works</span>
                    <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
                  </div>

                  <h3
                    id="how-heading"
                    className="mt-6 font-display text-2xl leading-[1.15] tracking-[-0.01em] text-stone-800 dark:text-stone-100"
                  >
                    Three steps to start stopping nail biting.
                  </h3>

                  {/* A numbered process, not three cards: the numerals hang in
                      their own column, hairlines do the separating, and the
                      badge-and-icon pair each step used to carry is gone —
                      the numeral already indexes the step. */}
                  <ol className="mt-7 list-none border-t border-stone-200 dark:border-ink-400">
                    {[
                      {
                        n: '01', heading: 'Allow camera access',
                        body: 'One-time permission prompt. Revoke it any time from System Preferences. The app never asks for microphone, location, or anything else.',
                      },
                      {
                        n: '02', heading: 'AI loads on your device',
                        body: 'MediaPipe hand and face landmark models run in WebAssembly — the same technology powering Google Meet\'s background blur. No internet needed after setup.',
                      },
                      {
                        n: '03', heading: 'Get alerted the moment it happens',
                        body: 'The instant your fingers approach your mouth, an audible alarm fires and the incident is logged locally. Awareness at the exact moment — the core of habit reversal training.',
                      },
                    ].map(({ n, heading, body }) => (
                      <li
                        key={n}
                        className="border-b border-stone-200 dark:border-ink-400 py-5 sm:grid sm:grid-cols-[3.5rem_1fr] sm:gap-6"
                      >
                        <span className="ed-mono block text-forest-600 dark:text-forest-400 sm:pt-1.5">{n}</span>
                        <div className="mt-2 sm:mt-0">
                          <h4 className="text-sm font-semibold leading-[1.7] text-stone-800 dark:text-stone-100">{heading}</h4>
                          <p className="ed-body ed-measure mt-1 text-stone-600 dark:text-stone-400">{body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 · THE EVIDENCE ─────────────────────────────────────────── */}
        {/* The old `evidence-heading` block. The featured claim is out of its
            tinted card and set as a pull quote against the page's one thick
            rule (3px forest), with both PubMed citations beneath it as mono
            source lines. The two honesty cards are margin notes now: same
            words, hairline top rule, no frame, no hover lift. */}
        <section aria-labelledby="evidence-heading" className="pb-20 lg:pb-28">
          <div className="ed-container">
            <SectionMark n="03" label="The evidence" />

            <div className="ed-grid mt-10 lg:mt-14">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="evidence-heading" className="ed-h2 text-stone-800">
                  Built on real habit science
                </h2>

                {/* The 3px forest rule is reserved for this one block (Task 3's
                    note 9). It spans the quote and its citations, because they
                    are one statement. The old eyebrow is the quote's label. */}
                <div className="mt-8 border-l-[3px] border-forest-600 pl-6 sm:pl-8">
                  <p className="ed-mono text-forest-600">The evidence behind the method</p>

                  <p className="ed-lede ed-measure mt-5 text-stone-700">
                    The method inside this app isn't ours: it's Habit Reversal Training, the best-studied behavioural
                    treatment for nail biting. In the landmark clinical trial, participants' own daily episode counts
                    fell by roughly 99% over the study's five months, and a meta-analysis of 18 studies found a large
                    pooled post-treatment effect across habit disorders generally.
                  </p>

                  {/* Sources, set the way a journal sets them: ruled, mono, one
                      per line. Both hrefs are the original PubMed records. */}
                  <ul className="mt-8 list-none border-t border-hairline">
                    <li className="border-b border-hairline">
                      <a
                        href="https://pubmed.ncbi.nlm.nih.gov/7436976/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block py-3.5 text-stone-500 hover:text-forest-600 transition-colors"
                      >
                        <span className="ed-link ed-mono">Azrin, Nunn &amp; Frantz (1980): Behaviour Research and Therapy</span>
                      </a>
                    </li>
                    <li className="border-b border-hairline">
                      <a
                        href="https://pubmed.ncbi.nlm.nih.gov/21549664/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block py-3.5 text-stone-500 hover:text-forest-600 transition-colors"
                      >
                        <span className="ed-link ed-mono">Bate et al. (2011): Clinical Psychology Review meta-analysis</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* The two honesty notes, in the margin where a journal puts its
                  caveats. Each note's own title is the mono label: no invented
                  apparatus, no icons, no card. */}
              <aside className="ed-aside reveal" style={{ transitionDelay: '160ms' }}>
                <div className="border-t border-hairline pt-4">
                  <p className="ed-mono text-stone-500">No fake reviews here</p>
                  <p className="ed-body mt-3 text-stone-600">
                    We don't publish paid or invented testimonials. The free trial exists so the app can prove
                    itself on your own biting data, usually within the first hour.
                  </p>
                </div>

                <div className="mt-9 border-t border-hairline pt-4">
                  <p className="ed-mono text-stone-500">An app is not a clinician</p>
                  <p className="ed-body mt-3 text-stone-600">
                    For severe or distressing BFRBs, see a professional. The{' '}
                    <a href="https://www.bfrb.org/" target="_blank" rel="noopener noreferrer" className="ed-link text-forest-600 hover:text-forest-500 transition-colors">TLC Foundation for Body-Focused Repetitive Behaviors</a>{' '}
                    maintains a directory of BFRB-informed therapists.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ── 04 · THE INSTRUMENT ───────────────────────────────────────── */}
        {/* Three old sections argued as one: what the thing refuses to do with
            your camera (the privacy statement, whose heading is this section's
            h2), what it is made of (the feature grid, now a hairline-separated
            specification list, no cards, no hover lift), and how you check the
            claim for yourself (the privacy deep-dive, in the margin). */}
        <section aria-labelledby="privacy-heading" className="pb-20 lg:pb-28">
          <div className="ed-container">
            <SectionMark n="04" label="The instrument" />

            <div className="ed-grid mt-10 lg:mt-14">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="privacy-heading" className="ed-h2 text-stone-800">
                  Your camera never leaves this app.
                </h2>
                <p className="font-display text-2xl leading-[1.15] tracking-[-0.01em] mt-3 text-forest-600">
                  Not even for a millisecond.
                </p>

                <p className="ed-lede ed-measure mt-6 text-stone-600">
                  A camera pointed at your face all day is a lot to trust an app with. So we built it the only
                  way that felt right: the AI runs entirely on your own device. Every frame is processed locally
                  on your CPU or GPU, and not one byte of camera data is ever sent to a server, because there's
                  no server involved in detection at all.
                </p>

                {/* The line that settles it, set as an instrument reading like
                    the hero's on-device guarantee: ruled top and bottom, mono,
                    nothing else. The rounded lock tile it used to sit under is
                    gone: it was the most card-shaped object on the page. */}
                <p className="ed-mono mt-9 border-y border-hairline py-3.5 text-forest-600">
                  Disconnect from the internet and the app works exactly the same.
                </p>

                {/* The feature grid, re-set as a specification list: hairline
                    rows, icon and name hanging in the left column, description
                    beside it. Same six names and descriptions, verbatim. */}
                <section aria-labelledby="features-heading" className="reveal mt-16">
                  <div className="ed-mark text-stone-500">
                    <span className="ed-mono flex-shrink-0">Specification</span>
                    <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
                  </div>

                  <h3
                    id="features-heading"
                    className="mt-6 font-display text-2xl leading-[1.15] tracking-[-0.01em] text-stone-800"
                  >
                    Everything you need to build the habit.
                  </h3>
                  <p className="ed-body mt-2 text-stone-500">Nothing you don't.</p>

                  <dl className="mt-7 border-t border-hairline">
                    {[
                      { icon: Cpu, name: 'On-Device AI', desc: 'MediaPipe runs in WebAssembly. Your CPU does the work, not a remote server.' },
                      { icon: BellRing, name: 'Real-Time Alerts', desc: 'Persistent audible alarm the moment your hand nears your mouth. Hard to ignore.' },
                      { icon: Trophy, name: 'Streak Tracker', desc: 'Current streak and all-time best. Losing the streak is the point.' },
                      { icon: ClipboardList, name: 'Incident Log', desc: 'Tag each bite by trigger: stress, focus, boredom. Patterns surface fast.' },
                      { icon: BarChart2, name: '7-Day Chart', desc: 'Visual bite frequency history. Colour-coded by severity.' },
                      { icon: WifiOff, name: 'Works Offline', desc: 'No internet required after setup. Detection runs entirely on your hardware.' },
                    ].map(({ icon: Icon, name, desc }) => (
                      <div
                        key={name}
                        className="border-b border-hairline py-4 sm:grid sm:grid-cols-[10.5rem_1fr] sm:gap-6"
                      >
                        <dt className="flex items-center gap-2.5 text-sm font-semibold leading-[1.7] text-stone-800">
                          <Icon size={15} aria-hidden="true" className="flex-shrink-0 text-forest-600" />
                          {name}
                        </dt>
                        <dd className="ed-body ed-measure mt-1 sm:mt-0 text-stone-600">{desc}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              {/* The privacy deep-dive, in the margin: it is literally a set of
                  instructions for checking the claim in the main column, which
                  is what a margin note is for. Its h2 is an h3 now (04's h2 is
                  the privacy heading) and keeps `id="privacy-details-heading"`,
                  so the aria-labelledby on this nested section still resolves. */}
              <aside className="ed-aside reveal" style={{ transitionDelay: '160ms' }}>
                <section aria-labelledby="privacy-details-heading">
                  <h3
                    id="privacy-details-heading"
                    className="font-display text-2xl leading-[1.15] tracking-[-0.01em] text-stone-800"
                  >
                    Open, honest, verifiable.
                  </h3>
                  <p className="ed-body mt-3 text-stone-600">
                    The privacy claims on this page aren't marketing. You can verify every one of them yourself.
                  </p>

                  <div className="mt-9">
                    {[
                      {
                        title: 'No network requests during detection',
                        detail: "Open Activity Monitor and watch network usage while the app runs. You'll see nothing camera-related, because nothing is sent.",
                      },
                      {
                        title: 'Data lives on your device only',
                        detail: 'Your streak and incident log are stored locally. Uninstall the app and it\'s gone: no server backup, no data retained.',
                      },
                      {
                        title: 'Built on open web technologies',
                        detail: 'The app runs on React, WebAssembly, and MediaPipe (all inspectable). Camera frames never leave the canvas element.',
                      },
                    ].map(({ title, detail }) => (
                      <div key={title} className="mt-8 border-t border-hairline pt-4 first:mt-0">
                        <p className="ed-mono text-stone-500">{title}</p>
                        <p className="ed-body mt-3 text-stone-600">{detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>

        {/* ── 05 · WHY WE BUILT THIS ────────────────────────────────────── */}
        {/* The closing note, set as a signed colophon: narrow measure, centred
            as a block on the page, hairline above and below, no frame. The old
            eyebrow ("Why we built this") is the section mark's label, so that
            string keeps its job instead of being repeated. Only the signature
            is centred: the prose stays ragged-right like every other column
            on the page. */}
        <section aria-labelledby="why-built-heading" className="pb-20 lg:pb-28">
          <div className="ed-container">
            <SectionMark n="05" label="Why we built this" />

            <div
              className="reveal ed-measure mx-auto mt-14 border-y border-hairline py-12 lg:mt-20 lg:py-14"
              style={{ transitionDelay: '80ms' }}
            >
              <h2 id="why-built-heading" className="ed-h2 text-stone-800">
                Made by people who bite their nails too.
              </h2>

              <div className="mt-7 space-y-5 text-stone-600">
                <p className="ed-body">
                  Every other tool we tried fought the symptom. Bitter polish makes your nails taste bad. Gloves
                  and fidget toys put something in the way. None of them touched the real problem: by the time
                  you notice you're biting, you've already been at it for minutes. The habit is simply faster
                  than your awareness.
                </p>
                <p className="ed-body">
                  So we built the one thing that closes that gap: something that notices the instant your hand
                  moves and hands the awareness back to you, the way habit reversal therapy does, but without an
                  appointment. And because it's pointed at your face all day, we made it a hard rule that not a
                  single frame of video ever leaves your device.
                </p>
                <p className="ed-body font-medium text-stone-800">
                  No data harvesting. No engagement tricks. Just the one thing that actually helps you stop.
                </p>
              </div>

              {/* The signature. The dash that used to introduce it is gone; a
                  mono line under the colophon reads as a signature without it. */}
              <p className="ed-mono mt-10 text-center text-stone-500">The Stop Biting team</p>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-8 space-y-20 pb-20">

          {/* ── PRICING (shared with /pricing — see PricingSection.tsx) ───── */}
          <PricingSection />

          {/* ── FEATURED GUIDES ───────────────────────────────────────────── */}
          <section aria-labelledby="featured-guides-heading">
            <p className="reveal text-xs uppercase tracking-[0.2em] text-forest-600 dark:text-forest-400 text-center font-semibold">Guides</p>
            <h2 id="featured-guides-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center mt-2 tracking-tight">Featured Guides</h2>
            <div className="reveal mt-6 flex flex-col gap-3 max-w-2xl mx-auto">
              {[
                { href: '/how-it-works', label: 'How the AI nail biting detection works' },
                { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the science behind stopping nail biting' },
                { href: '/blog/how-to-stop-nail-biting', label: 'How to stop nail biting: the complete guide' },
                { href: '/blog/nail-biting-30-day-plan', label: 'The 30-day plan to stop biting your nails' },
                { href: '/blog/nail-biting-trigger-mapping', label: 'Trigger mapping: find out when you actually bite' },
                { href: '/blog/best-apps-to-stop-nail-biting', label: 'Best apps to stop nail biting (2026)' },
                { href: '/blog/best-nail-biting-remedies', label: 'Every nail biting remedy, ranked by evidence' },
                { href: '/blog/nail-biting-health-risks', label: 'The real health risks of nail biting' },
                { href: '/blog/nail-biting-in-children', label: 'Nail biting in children: a guide for parents' },
                { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish: which works?' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-4 py-3 hover:border-forest-300 dark:hover:border-forest-700 hover:-translate-y-0.5 hover:shadow-card transition-all duration-200"
                >
                  <span className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors">{link.label}</span>
                  <ArrowRight size={14} className="text-stone-400 group-hover:text-forest-500 shrink-0 transition-colors" aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>

          {/* ── BLOG PREVIEW ──────────────────────────────────────────────── */}
          <section aria-labelledby="blog-preview-heading">
            <div className="reveal flex items-center justify-between mb-6">
              <h2 id="blog-preview-heading" className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">From the blog</h2>
              <a href="/blog" className="group inline-flex items-center gap-1 text-forest-600 dark:text-forest-400 text-sm hover:text-forest-500 transition-colors">
                All articles{' '}
                <ArrowRight size={14} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {FEATURED_POSTS.map((post, i) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-5 hover:border-forest-300 dark:hover:border-forest-700 hover:-translate-y-1 hover:shadow-card-md transition-all duration-200 group shadow-card"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <span className="text-xs text-forest-600 dark:text-forest-400 font-semibold uppercase tracking-wider">{post.tag}</span>
                  <h3 className="text-stone-800 dark:text-stone-100 font-semibold text-sm mt-2 leading-snug group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors">{post.title}</h3>
                  <p className="text-stone-400 dark:text-stone-500 text-xs mt-3">{post.readingMinutes} min read</p>
                </a>
              ))}
            </div>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────────── */}
          <section id="faq" aria-labelledby="faq-heading">
            <p className="reveal text-xs uppercase tracking-[0.2em] text-forest-600 dark:text-forest-400 text-center font-semibold">FAQ</p>
            <h2 id="faq-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center mt-2 tracking-tight">
              Questions people ask about nail biting
            </h2>

            <div className="reveal mt-8 flex flex-col gap-3 max-w-2xl mx-auto">
              {FAQS.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-5 py-4 shadow-card open:shadow-card-md transition-shadow"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-stone-800 dark:text-stone-100 marker:content-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-stone-400 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed mt-3">{a}</p>
                </details>
              ))}
            </div>

            <p className="reveal text-stone-400 dark:text-stone-500 text-xs text-center mt-6">
              More on all of this in the{' '}
              <a href="/blog" className="text-forest-600 dark:text-forest-400 hover:underline">
                nail biting guides
              </a>{' '}
              — {BLOG_INDEX.length} evidence-based articles.
            </p>
          </section>

          {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
          <section
            aria-label="Call to action"
            className="reveal text-center py-12 rounded-2xl bg-forest-50 dark:bg-forest-900 border border-forest-200 dark:border-forest-800"
          >
            <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Ready to stop nail biting?</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed max-w-sm mx-auto mt-4">
              Use the web app directly in your browser — sign in with Google and nail biting detection starts in under ten seconds. No install needed.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shimmer inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-2xl px-8 py-3.5 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
              >
                <Zap size={15} aria-hidden="true" />
                Start free trial — it's free
              </a>
              <p className="text-stone-400 dark:text-stone-500 text-xs">3-day free trial · no credit card required</p>
            </div>
          </section>

          {/* ── CONTACT ───────────────────────────────────────────────────────── */}
          <ContactForm />

        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 dark:border-ink-400 py-10 px-8 bg-cream-200 dark:bg-ink-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
              <p className="text-stone-700 dark:text-stone-200 text-sm font-semibold">Stop Biting</p>
            </div>
            <p className="text-stone-400 dark:text-stone-500 text-xs mt-1 max-w-xs leading-relaxed">
              Stop nail biting (onychophagia) using on-device AI. Works in your browser as a Progressive Web App — no install required. Built with MediaPipe, React, and WebAssembly.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-col gap-2 text-xs">
            <a href="/" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Home</a>
            <a href="/blog" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Blog</a>
            <a href="/#pricing" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Pricing</a>
            <a href="mailto:hello@stopbiting.today" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Contact</a>
            <a href="/editorial-policy" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Editorial Policy</a>
            <a href="/privacy" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Terms of Service</a>
            <a href="/refund-policy" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Refund Policy</a>
          </nav>
        </div>
        <p className="text-stone-400 dark:text-stone-500 text-xs text-center mt-8">
          © {new Date().getFullYear()} Stop Biting · AI-powered nail biting detection ·{' '}
          <a href="https://stopbiting.today/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">stopbiting.today</a>
        </p>
      </footer>

    </div>
  );
}
