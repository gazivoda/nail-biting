import { lazy, Suspense, useState } from 'react';
import {
  ShieldCheck, Zap, Cpu, BellRing, Trophy,
  ClipboardList, BarChart2, WifiOff,
  ChevronDown, Camera, BookOpen,
  ArrowRight, Loader2,
} from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ContactForm } from '../components/ContactForm';
import { PricingSection } from '../components/PricingSection';
import { BLOG_INDEX } from '../data/blogIndex';
// The figure program (see docs/superpowers/specs/2026-09-16-homepage-figure-program.md).
// All four are hand-authored inline SVG and cost this page zero JavaScript
// beyond their own markup: `recharts` is a dependency, but it is code-split
// into a ~269 KB chunk the landing page never loads, and it must stay that way.
import { PrevalenceMatrix } from '../components/figures/PrevalenceMatrix';
import { HabitLoopFigure } from '../components/figures/HabitLoopFigure';
import { DetectionGeometryFigure } from '../components/figures/DetectionGeometryFigure';
import { PrivacyArchitectureFigure } from '../components/figures/PrivacyArchitectureFigure';

// The live demo pulls in MediaPipe, 125 KB of WebAssembly glue that the landing
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

// The ten hand-picked guides. Labels are the page's own copy, not the post
// titles, because a reading list wants the shortest true description of the
// destination rather than the article's full SEO headline.
const FEATURED_GUIDES: { href: string; label: string }[] = [
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
];

// Section 06 is one reading list, so the two old lists are merged here rather
// than in the markup. Two of the guides above point at articles the blog
// preview also carried (habit-reversal-training-guide and
// nail-biting-health-risks), so the merge is by href: every destination
// survives and each one is printed exactly once, under the guide's own label.
// The kicker is the post's tag wherever the destination is a post and "Guide"
// where it isn't, and the reading time is read from the post data so it can't
// drift. The two destinations that aren't articles simply have none.
type ReadingRow = { href: string; title: string; kicker: string; minutes?: number };

const READING_LIST: ReadingRow[] = (() => {
  const postFor = (href: string) =>
    href.startsWith('/blog/')
      ? BLOG_INDEX.find(p => p.slug === href.slice('/blog/'.length))
      : undefined;

  const rows: ReadingRow[] = FEATURED_GUIDES.map(({ href, label }) => {
    const post = postFor(href);
    return { href, title: label, kicker: post?.tag ?? 'Guide', minutes: post?.readingMinutes };
  });

  for (const post of FEATURED_POSTS) {
    const href = `/blog/${post.slug}`;
    if (rows.some(row => row.href === href)) continue;
    rows.push({ href, title: post.title, kicker: post.tag, minutes: post.readingMinutes });
  }

  return rows;
})();

// The apparatus row under the hero's call to action: what the thing is, in
// five words or fewer each, set as a mono rule of hairline-separated terms.
// The price is a term like any other, and it is here because it used to live
// only in PricingSection at 61% page depth: a visitor deciding whether to give
// this thing their camera should not have to scroll two thirds of the page to
// learn what it costs. It sits last because the end of a rule is its second
// strongest position. The figure MUST match PricingSection and the Offer schema
// server.js injects for /pricing ($2.99/month, $29.00/year).
const HERO_TAGS = ['Web App', 'PWA install', 'MediaPipe AI', '100% private', 'No cloud', '$2.99/month'];

// Mirrors the FAQPage JSON-LD in index.html. Google requires FAQ structured data
// to have a visible on-page counterpart, so these two must stay in step.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Why do people bite their nails?',
    a: 'Nail biting (onychophagia) is a body-focused repetitive behaviour affecting up to 30% of adults. Common triggers are stress, anxiety, boredom, and deep focus. The habit usually starts in childhood and becomes automatic, happening without conscious awareness. Genetic predisposition, perfectionism, and OCD-spectrum tendencies are also linked.',
  },
  {
    q: 'What are the best remedies to stop nail biting?',
    a: 'The evidence-based options are habit reversal training (the strongest by some margin), bitter-taste polishes like Mavala Stop, real-time awareness tools such as AI detection, competing response training, and stress reduction. Most people do best combining an awareness method with a competing response rather than relying on any single remedy.',
  },
  {
    q: 'What is habit reversal training for nail biting?',
    a: 'Habit reversal training (HRT) is a cognitive-behavioural method with three parts: awareness training, learning to notice every time you bite; a competing response, an incompatible action like clenching a fist or pressing your palms flat; and social support. In the original Azrin and Nunn clinical trial, participants who practised it consistently achieved a near-complete reduction in biting.',
  },
  {
    q: 'Is nail biting harmful?',
    a: 'Yes. Chronic nail biting causes dental damage including chipped teeth and jaw strain, nail fold infections, transfer of pathogens from fingers to mouth, and permanent nail deformity in severe cases. The visible damage also drives shame and social anxiety, which increases biting: a self-reinforcing cycle.',
  },
  {
    q: 'Does Stop Biting send my camera feed to the internet?',
    a: 'No. Detection uses MediaPipe (Google\'s WebAssembly vision framework) running entirely on your device. Your camera feed is never uploaded, streamed, or stored anywhere outside it. There are zero network requests during detection: you can disconnect from the internet and the app works identically.',
  },
  {
    q: 'How long does it take to stop biting your nails?',
    a: 'Most people notice more biting in week one, because they are finally catching episodes they used to miss. No controlled trial has measured week-by-week biting frequency during self-directed habit reversal training, so treat any schedule, including ours, as an expectation rather than a measured result. The best-evidenced anchor is Lally et al. 2010: among the 39 volunteers whose data fitted the model, the median time for a new daily habit to become automatic was 66 days, with a range of 18 to 254. That is a general habit-formation figure, not one measured for nail biting.',
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
// invisible for ever.
//
// This row is 17px tall, which used to be the whole problem: against the old
// `threshold: 0.12` only 2px of it had to cross the trigger line, so the rule
// drew itself against the bottom edge of the window where nobody was looking,
// and on a fast scroll the observer never delivered at all: five of these
// stayed at opacity 0 for the rest of the visit. useScrollReveal triggers on
// margin rather than on a ratio now, and sweeps synchronously with the scroll,
// so height no longer decides whether a mark animates. Reuse this component for
// every numbered section; do not re-invent it.
function SectionMark({ n, label }: { n: string; label: string }) {
  return (
    <div className="reveal ed-mark text-stone-500">
      <span className="ed-mono flex-shrink-0">{n}</span>
      <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
      <span className="ed-mono flex-shrink-0">{label}</span>
    </div>
  );
}

export function Landing() {
  // The homepage is light only. It is the one page whose whole job is to read as
  // health and wellbeing, and that argument does not survive a dark background.
  //
  // Nothing is done here: AppRouter is the only writer of the `dark` class on
  // this route and pins it to light while it is rendering us (see App.tsx). The
  // visitor's stored preference is never written, so the signed-in app and the
  // other eight pages still honour it.
  useScrollReveal();

  // Stays false until the visitor asks for the demo: the lazy import is only
  // ever triggered by this flag, which is what keeps MediaPipe off a page view.
  const [demoStarted, setDemoStarted] = useState(false);

  return (
    // `ed-page` scopes the editorial focus-visible ring (see index.css). Without
    // it nothing on this page gets a visible focus outline.
    <div className="ed-page min-h-dvh bg-cream-100 text-stone-800">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      {/* Structurally identical to the navs on /blog, /pricing and the legal
          pages: fixed, full-width, hairline bottom rule, same three items and
          the same hrefs. Only the typesetting differs here. */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 backdrop-blur-md border-b border-hairline">
        <a href="/" className="flex items-center gap-3 text-stone-800">
          <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
          <span className="ed-wordmark">Stop Biting Nails</span>
        </a>
        <div className="flex items-center gap-4 sm:gap-6">
          <a href="/blog" className="ed-ui flex items-center gap-2 text-stone-500 transition-colors hover:text-stone-800">
            <BookOpen size={14} aria-hidden="true" />
            <span className="ed-link">Blog</span>
          </a>
          {/* Outlined, not filled. Three solid forest fills used to sit above
              the fold (here, the hero, the demo) and nothing told the visitor
              which one to press; the demo is the page's one unique asset, so it
              keeps the only fill and this drops to a hairline. The label is
              "Start free trial" because "Sign in to app" reads as members-only
              to someone who arrived on a search for how to stop biting nails. */}
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-stone-300 px-3 py-2 ed-ui font-semibold text-forest-600 sm:px-4 transition-colors duration-150 hover:border-forest-600 hover:text-forest-500"
          >
            <Zap size={13} aria-hidden="true" />
            Start free trial
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      {/* Above the fold, so the entrance is a fixed stagger on `animate-fade-up`
          rather than `.reveal`: an IntersectionObserver would fire on every one
          of these at once and there would be no stagger left to see. For the
          same reason nothing in here may use `.ed-rule-draw`: that class parks
          a rule at scaleX(0) until an ancestor `.reveal` is `.revealed`, which
          never happens here, and the rule would simply never appear. */}
      <main>
        <section aria-label="Hero" className="pt-24 pb-16 lg:pt-32 lg:pb-24">
          <div className="ed-container">
            {/* Three grid children, not two. The title block and the argument
                are separate cells in the same 5-column stack so that the demo
                can be ordered between them below `lg`: the figure used to be
                `.ed-aside`, which stacks last on a phone and put the detector
                under the hero's call to action. `order-*` fixes the small-screen
                sequence (title, detector, argument) and every child is placed
                explicitly at `lg`, where `order` is therefore inert. */}
            <div className="ed-grid">

              {/* ── The title (cols 1-5, row 1) ──────────────────────────── */}
              {/* `container-type: inline-size` is what `.ed-display`'s `cqw`
                  sizing reads (see index.css): it has to sit on the h1's own
                  column box, and this block is no longer `.ed-main`, so the
                  containment is declared here instead. */}
              <div className="col-span-full order-1 [container-type:inline-size] lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-1">
                <p
                  className="animate-fade-up ed-mono text-forest-600"
                  style={{ animationDelay: '0ms' }}
                >
                  For everyone who's tried to quit, and couldn't
                </p>

                <h1
                  className="animate-fade-up ed-display mt-6 text-stone-800"
                  style={{ animationDelay: '80ms' }}
                >
                  Stop biting your nails.<br />
                  <em className="not-italic text-forest-600">For good, this time.</em>
                </h1>
              </div>

              {/* ── Figure 1: the detector (cols 6-12, rows 1-2) ─────────── */}
              {/* The wide column, and deliberately so. A live nail biting
                  detector running in the visitor's own browser is the one thing
                  no competitor has, and it used to be a 360x101 button inside a
                  card in the margin. It spans both rows so the argument beside
                  it can keep its own two-cell stack. The gutter hairline that
                  used to be a separate column-8 element is this column's
                  left border: the padding matches `.ed-grid`'s column gap, so
                  the rule still lands dead centre of the gutter. */}
              <figure
                className="animate-fade-up order-2 col-span-full lg:order-none lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-hairline lg:pl-[clamp(1.5rem,3vw,2.5rem)]"
                style={{ animationDelay: '160ms' }}
              >
                <figcaption className="text-stone-500">
                  <span className="ed-mark">
                    <span className="ed-mono">Fig. 1</span>
                    <span className="ed-mark-rule" aria-hidden="true" />
                  </span>
                  <span className="ed-mono mt-3 block">The detector, running on your device</span>
                </figcaption>

                {/* ── LIVE DEMO ───────────────────────────────────────────── */}
                {/* Heading and paragraph render on page view: they are the
                    crawler-visible copy mirrored in server.js and must not be
                    hidden behind the click. Only the detector itself is deferred.
                    The paragraph sits below the plate rather than above it so
                    nothing pushes the detector down the fold; both still render
                    unconditionally, which is all the SSR parity requires. */}
                <section id="live-demo" aria-labelledby="live-demo-heading" className="mt-8">
                  <h2
                    id="live-demo-heading"
                    className="ed-h3 text-stone-800"
                  >
                    Try the detector right now
                  </h2>

                  {/* Square hairline frame, no shadow, no rounded corner and no
                      fill: the page's one sanctioned frame reads as a plate in
                      a journal, mounted on the page's own cream rather than on
                      the white card this used to be. The 16:9 plate inside is
                      the same shape and the same `bg-stone-900` DetectionSurface
                      paints once the demo is running, so the click swaps the
                      contents of the box without moving a pixel of the layout. */}
                  <div className="mt-6 border border-hairline p-4 sm:p-6">
                    {demoStarted ? (
                      <Suspense
                        fallback={
                          <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-stone-900 px-6">
                            <p className="ed-ui flex items-center gap-2 text-center text-cream-100">
                              <Loader2
                                size={14}
                                className="animate-spin text-forest-300 flex-shrink-0"
                                aria-hidden="true"
                              />
                              {DEMO_LOADING_LABEL}
                            </p>
                          </div>
                        }
                      >
                        <HeroDemo autoStart />
                      </Suspense>
                    ) : (
                      // The click gate. `HeroDemo` is behind `lazy()` and is
                      // only ever referenced inside the branch above, so a page
                      // view fetches no chunk, no WebAssembly and no MediaPipe
                      // model. Nothing here may preload, prefetch or auto-start.
                      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-stone-900">
                        <button
                          type="button"
                          onClick={() => setDemoStarted(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-forest-600 px-8 py-3 ed-ui font-semibold text-cream-100 transition-colors duration-150 hover:bg-forest-500"
                        >
                          <Camera size={15} aria-hidden="true" />
                          Try the live demo
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="ed-body mt-6 text-stone-600">
                    Run the real nail biting detector on your own camera for 60 seconds: no
                    account, no signup. The AI models download once (about 20 MB) and then
                    everything runs on your device: open your browser's network panel and you'll
                    see zero requests while it is watching. Nothing is uploaded and nothing is
                    saved.
                  </p>
                </section>

                {/* One key value in the figure margin, and deliberately only
                    one. Figure 2 in section 01 is the canonical statement of the
                    three numbers and carries the citation footnote for them, so
                    setting all three here as well read as a mistake rather than
                    as an echo. The privacy figure is the one that belongs to this
                    figure: it is a reading of the detector directly above it. */}
                <dl aria-label="Key figure" className="mt-8 border-y border-hairline py-4">
                  <div className="flex items-baseline gap-4">
                    <dt className="ed-figure text-forest-600 w-24 flex-shrink-0">
                      0 bytes
                    </dt>
                    <dd className="ed-mono text-stone-500">of camera data sent to servers</dd>
                  </div>
                </dl>
              </figure>

              {/* ── The argument (cols 1-5, row 2) ───────────────────────── */}
              <div className="col-span-full order-3 lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-2">
                <p
                  className="animate-fade-up ed-lede ed-measure text-stone-600"
                  style={{ animationDelay: '240ms' }}
                >
                  Bitter polish, gloves, sheer willpower: none of it stuck, because nail biting was never a
                  willpower problem. It runs on autopilot, and by the time you notice, you're already doing it.{' '}
                  <span className="text-stone-800 font-medium">Stop Biting catches the exact moment your hand reaches your mouth</span>{' '}
                  and interrupts it, which is the active ingredient in habit reversal training, the approach
                  with the strongest clinical evidence behind it. Every frame is processed on your own device.
                </p>

                {/* The on-device guarantee, set as an instrument reading: ruled
                    top and bottom, mono, with the live dot still ticking. */}
                <div
                  className="animate-fade-up mt-8 flex items-center gap-3 border-y border-hairline py-3 text-forest-600"
                  style={{ animationDelay: '240ms' }}
                >
                  <ShieldCheck size={14} className="flex-shrink-0" aria-hidden="true" />
                  <span className="ed-mono">All AI processing on-device: zero network requests during detection</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-500 animate-pulse flex-shrink-0" aria-hidden="true" />
                </div>

                {/* Two text links, no fill. The hero's one filled control is
                    the detector's, in the figure beside this: the visitor who
                    just searched for how to stop biting their nails is worth
                    more inside a 60-second demo than inside a signup form, and
                    the trial is still one outlined click away in the nav and a
                    solid forest button at the foot of the page. */}
                <div
                  className="animate-fade-up mt-8 flex flex-wrap items-center gap-x-8 gap-y-4"
                  style={{ animationDelay: '320ms' }}
                >
                  <a
                    href="/api/auth/google"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-link ed-ui text-stone-600 transition-colors hover:text-stone-800"
                  >
                    Start free trial
                  </a>
                  <a
                    href="/blog"
                    className="ed-link ed-ui text-stone-600 transition-colors hover:text-stone-800"
                  >
                    Read the science
                  </a>
                </div>

                {/* What it is, in apparatus terms: hairline-separated. */}
                <ul
                  className="animate-fade-up mt-8 flex flex-wrap items-center gap-y-2 text-stone-500"
                  style={{ animationDelay: '400ms' }}
                >
                  {HERO_TAGS.map((tag, i) => (
                    <li key={tag} className="flex items-center">
                      <span className="ed-mono">{tag}</span>
                      {i < HERO_TAGS.length - 1 && (
                        <span className="mx-3 h-3 w-px bg-stone-300" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* ── 01 · THE PROBLEM ──────────────────────────────────────────── */}
        {/* Was the `why-bite-heading` card plus the stats strip that used to
            sit four sections lower. Both are here now: the argument in the
            narrative column, the prevalence figures in the margin where a
            journal would set them. No frame, no bullet dots: the triggers are
            a definition list ruled with hairlines, and the strip's long source
            note is now doing its proper job as the figure's <figcaption>.
            Sections open on the previous block's bottom padding, so there is no
            top padding and no top rule here: the section mark is the seam. */}
        <section aria-labelledby="why-bite-heading" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <SectionMark n="01" label="The problem" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="why-bite-heading" className="ed-h2 text-stone-800">
                  Why do people bite their nails?
                </h2>

                <p className="ed-lede ed-measure mt-6 text-stone-600">
                  About 1 in 4 adults bites their nails: not occasionally, but chronically. Most have been doing it since childhood. Most have tried to stop more than once. The reason it's so hard isn't weak willpower. It's that the habit runs on autopilot, below the level of conscious thought.
                </p>

                <h3 className="ed-subhead mt-12 text-stone-800">
                  When it tends to happen
                </h3>

                {/* Short terms, so the definition list can run two-up at sm and
                    above: term in the hanging column, sense beside it. */}
                <dl className="mt-4 border-t border-hairline">
                  {([
                    ['Stress', "Your brain reaches for something familiar when anxiety spikes. Biting gives a brief sense of relief, which teaches your brain to reach for it again next time."],
                    ['Deep focus', "The part of your brain that monitors what your hands are doing goes quiet when you're concentrating hard. This is why you look down and realise you've been biting for the last 20 minutes."],
                    ['Pure habit', 'After years of repetition, the context itself (laptop open, meeting on, desk) is enough to trigger it. No stress required. The hand just... moves.'],
                  ] as const).map(([label, text]) => (
                    <div
                      key={label}
                      className="border-b border-hairline py-4 sm:grid sm:grid-cols-[7.5rem_1fr] sm:gap-6"
                    >
                      <dt className="ed-body font-semibold text-stone-800">{label}</dt>
                      <dd className="ed-body ed-measure mt-1 sm:mt-0 text-stone-600">{text}</dd>
                    </div>
                  ))}
                </dl>

                <p className="ed-body ed-measure mt-8 text-stone-600">
                  Bitter nail polish and physical barriers don't fix this: they fight the symptom. What actually works is catching the moment it starts and building awareness of when and why it happens.
                </p>

                <a
                  href="/blog/why-do-people-bite-their-nails"
                  className="ed-ui group mt-6 inline-flex items-center gap-2 text-forest-600 transition-colors hover:text-forest-500"
                >
                  <span className="ed-link">Read the full article</span>
                  <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>

              {/* Figure 2: the prevalence and outcome figures, finally set as a
                  real figure. `aria-label` keeps the strip's old accessible name
                  ("Key statistics") and matches the visible mono label; the
                  <figcaption> carries the source note verbatim. Like Figure 1 in
                  the hero, the caption rule does not draw: the draw is reserved
                  for section marks, so a figure never mimics a section opener. */}
              {/* No aria-label here on purpose: one would override the
                  <figcaption> as the accessible name, and the caption is where
                  the Halteh and Azrin citations live. */}
              <figure
                className="ed-aside reveal"
                style={{ transitionDelay: '160ms' }}
              >
                <div className="ed-mark text-stone-500">
                  <span className="ed-mono flex-shrink-0">Fig. 2</span>
                  <span className="ed-mark-rule" aria-hidden="true" />
                  <span className="ed-mono flex-shrink-0">Key statistics</span>
                </div>

                {/* The prevalence plate. It leads the figure because the first
                    row of the list below is the number it draws: the list
                    states 20-30%, the plate makes it countable, and the
                    figcaption's Halteh citation covers both. Twenty dots are
                    solid and ten are open because the source reports a range,
                    not a point estimate: filling twenty-five would be drawing
                    a figure nobody measured. */}
                <div className="mt-6">
                  <PrevalenceMatrix />
                </div>

                <dl className="mt-6 border-t border-hairline">
                  {[
                    { number: '20-30%', label: 'of adults bite their nails chronically' },
                    { number: '~99%', label: 'fewer biting episodes in the landmark habit reversal trial' },
                    { number: '0 bytes', label: 'Of camera data sent to servers' },
                  ].map(({ number, label }) => (
                    <div key={label} className="border-b border-hairline py-4">
                      <dt className="ed-figure text-forest-600">{number}</dt>
                      <dd className="ed-mono mt-3 text-stone-500">{label}</dd>
                    </div>
                  ))}
                </dl>

                <figcaption className="ed-caption ed-measure mt-4 text-stone-500">
                  Prevalence: Halteh, Scher &amp; Lipner (2017). Reduction figure: Azrin, Nunn &amp; Frantz (1980), self-recorded episode counts over the trial's five months, not a follow-up after treatment ended. Camera privacy is architectural: there's no server to send data to.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── 02 · THE METHOD ───────────────────────────────────────────── */}
        {/* The `hrt-heading` article and the old "How it works" section, merged:
            the theory in the narrative column, the three steps this app
            implements in the margin beside it. The steps were in the main
            column and the margin was empty, which left 500px of dead cream
            running the full 1,408px of the section. They belong in the margin
            on the argument as well as on the measurement: the main column
            states what Habit Reversal Training is, and the margin annotates it
            with how this particular instrument performs it, which is the same
            relationship 03 and 04 already use their margins for. */}
        <section aria-labelledby="hrt-heading" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <SectionMark n="02" label="The method" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="hrt-heading" className="ed-h2 text-stone-800">
                  The approach that actually works
                </h2>

                <p className="ed-lede ed-measure mt-6 text-stone-600">
                  Habit Reversal Training is the most studied method for stopping nail biting, and the one with the best results. In the landmark clinical trial it cut biting episodes by roughly 99%, and a meta-analysis of 18 studies confirmed large effects. The reason it works when willpower doesn't is that it targets the habit at the automatic level, not the conscious one.
                </p>

                <h3 className="ed-subhead mt-12 text-stone-800">
                  How it works
                </h3>

                {/* HRT's three parts. Titles run long, so these stack rather
                    than running two-up like the triggers in 01. The rounded
                    forest bar that used to flag each one is gone: a 3px forest
                    rule is Task 4's pull-quote device. */}
                <div className="mt-4 border-t border-hairline">
                  {([
                    ['Notice it happening', "Most nail biters catch fewer than half their daily biting episodes. Step one is simply becoming aware every single time, which is harder than it sounds when the habit is fully automatic."],
                    ['Do something else instead', 'The moment you notice it, replace the bite with something your hands can\'t do simultaneously: press your palms flat, clench a fist, grip the desk. Hold it for a minute.'],
                    ['Get an external signal', 'In clinical settings, a therapist would tap your shoulder. The audio alarm in this app does the same thing: it catches the moment you missed.'],
                  ] as const).map(([title, text]) => (
                    <div key={title} className="border-b border-hairline py-4">
                      <p className="ed-body font-semibold text-stone-800">{title}</p>
                      <p className="ed-body ed-measure mt-1 text-stone-600">{text}</p>
                    </div>
                  ))}
                </div>

                <p className="ed-body ed-measure mt-8 text-stone-600">
                  Stop Biting handles the awareness and the signal. What you do with your hands instead is up to you.
                </p>

                <a
                  href="/blog/habit-reversal-training-guide"
                  className="ed-ui group mt-6 inline-flex items-center gap-2 text-forest-600 transition-colors hover:text-forest-500"
                >
                  <span className="ed-link">Read the full HRT guide</span>
                  <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>

              {/* The old "How it works" section, folded in as 02's margin. Its
                  h2 is an h3 now (02's h2 is the HRT heading) and keeps
                  `id="how-heading"`, so the aria-labelledby on this nested
                  section still resolves. The eyebrow that used to sit above it
                  is the label on the divider rule, which keeps the two "How it
                  works" strings on the page in different registers: a sub-head
                  above HRT's parts, apparatus here. `.reveal` is on the <aside>
                  so `.revealed .ed-rule-draw` still reaches the divider. */}
              <aside className="ed-aside reveal" style={{ transitionDelay: '160ms' }}>
                {/* Figure 3 leads the margin because it annotates the theory in
                    the column beside it, and the three steps below annotate the
                    instrument. Set as a vertical cycle rather than a ring: a
                    ring's labels have nowhere to go in a four-column margin.
                    The competing response is the only forest element in the
                    plate, so the eye lands on the one point in the loop that
                    can actually be reached. */}
                <figure>
                  <div className="ed-mark text-stone-500">
                    <span className="ed-mono flex-shrink-0">Fig. 3</span>
                    <span className="ed-mark-rule" aria-hidden="true" />
                    <span className="ed-mono flex-shrink-0">The habit loop</span>
                  </div>

                  <div className="mt-6">
                    <HabitLoopFigure />
                  </div>

                  <figcaption className="ed-caption ed-measure mt-4 text-stone-500">
                    Nail biting closes on itself: the relief is brief, and the brevity is what teaches
                    the loop to run again. Habit reversal training doesn&apos;t fight the bite. It puts a
                    competing response into the one interval where awareness still arrives before the
                    hand does, between the urge and the behaviour. A diagram of the method, not
                    measured data.
                  </figcaption>
                </figure>

                <section aria-labelledby="how-heading" className="mt-16">
                  <div className="ed-mark text-stone-500">
                    <span className="ed-mono flex-shrink-0">How it works</span>
                    <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
                  </div>

                  <h3
                    id="how-heading"
                    className="ed-h3 mt-6 text-stone-800"
                  >
                    Three steps to start stopping nail biting.
                  </h3>

                  {/* A numbered process, not three cards: hairlines do the
                      separating and the badge-and-icon pair each step used to
                      carry is gone, because the numeral already indexes the
                      step. The numeral sits above its step rather than hanging
                      in its own column: a 3.5rem hanging indent inside a
                      four-column margin would leave the prose about 30
                      characters wide. */}
                  <ol className="mt-6 list-none border-t border-hairline">
                    {[
                      {
                        n: '01', heading: 'Allow camera access',
                        body: 'One-time permission prompt. Revoke it any time from System Preferences. The app never asks for microphone, location, or anything else.',
                      },
                      {
                        n: '02', heading: 'AI loads on your device',
                        body: 'MediaPipe hand and face landmark models run in WebAssembly, the same technology powering Google Meet\'s background blur. No internet needed after setup.',
                      },
                      {
                        n: '03', heading: 'Get alerted the moment it happens',
                        body: 'The instant your fingers approach your mouth, an audible alarm fires and the incident is logged locally. Awareness at the exact moment: the core of habit reversal training.',
                      },
                    ].map(({ n, heading, body }) => (
                      <li key={n} className="border-b border-hairline py-4">
                        <span className="ed-mono block text-forest-600">{n}</span>
                        <h4 className="ed-body mt-2 font-semibold text-stone-800">{heading}</h4>
                        <p className="ed-body mt-1 text-stone-600">{body}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </aside>
            </div>
          </div>
        </section>

        {/* ── 03 · THE EVIDENCE ─────────────────────────────────────────── */}
        {/* The old `evidence-heading` block. The featured claim is out of its
            tinted card and set as a pull quote against the page's one thick
            rule (3px forest), with both PubMed citations beneath it as mono
            source lines. The two honesty cards are margin notes now: same
            words, hairline top rule, no frame, no hover lift. */}
        <section aria-labelledby="evidence-heading" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <SectionMark n="03" label="The evidence" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="evidence-heading" className="ed-h2 text-stone-800">
                  Built on real habit science
                </h2>

                {/* The 3px forest rule is reserved for this one block (Task 3's
                    note 9). It spans the quote and its citations, because they
                    are one statement. The old eyebrow is the quote's label. */}
                <div className="mt-8 border-l-[3px] border-forest-600 pl-6 sm:pl-8">
                  <p className="ed-mono text-forest-600">The evidence behind the method</p>

                  <p className="ed-lede ed-measure mt-6 text-stone-800">
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
                        className="block py-4 text-stone-500 transition-colors hover:text-forest-600"
                      >
                        <span className="ed-link ed-mono">Azrin, Nunn &amp; Frantz (1980): Behaviour Research and Therapy</span>
                      </a>
                    </li>
                    <li className="border-b border-hairline">
                      <a
                        href="https://pubmed.ncbi.nlm.nih.gov/21549664/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block py-4 text-stone-500 transition-colors hover:text-forest-600"
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

                <div className="mt-8 border-t border-hairline pt-4">
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
        <section aria-labelledby="privacy-heading" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <SectionMark n="04" label="The instrument" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div className="ed-main reveal" style={{ transitionDelay: '80ms' }}>
                <h2 id="privacy-heading" className="ed-h2 text-stone-800">
                  Your camera never leaves this app.
                </h2>
                <p className="ed-h3 mt-3 text-forest-600">
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
                <p className="ed-mono mt-8 border-y border-hairline py-4 text-forest-600">
                  Disconnect from the internet and the app works exactly the same.
                </p>

                {/* Figure 4, and the strongest plate on the page: the section
                    explains the instrument in one sentence, and this is the
                    geometry that sentence is about. Everything in it is read
                    off src/hooks/biteDetector.ts (21 landmarks, fingertips at
                    4/8/12/16/20, a mouth centre averaged from face landmarks 13
                    and 14, one distance against one threshold), so it is a
                    mechanism diagram and needs no source. Hairline is the raw
                    landmark topology; forest is the small part of it the
                    detector actually computes on. */}
                <figure className="mt-16">
                  <div className="ed-mark text-stone-500">
                    <span className="ed-mono flex-shrink-0">Fig. 4</span>
                    <span className="ed-mark-rule" aria-hidden="true" />
                    <span className="ed-mono flex-shrink-0">Detection geometry</span>
                  </div>

                  <div className="mt-6">
                    <DetectionGeometryFigure />
                  </div>

                  <figcaption className="ed-caption ed-measure mt-4 text-stone-500">
                    MediaPipe reduces a hand to 21 landmarks and a mouth to the midpoint of two lip
                    landmarks. The only quantity this app computes is the distance between the five
                    fingertips and that midpoint, in frame-relative coordinates. The alarm fires when
                    a fingertip crosses the threshold radius and stays inside it for several
                    consecutive frames; the sensitivity setting moves the radius and nothing else.
                    Geometry, not imagery: a diagram of the method, not measured data.
                  </figcaption>
                </figure>
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
                    className="ed-h3 text-stone-800"
                  >
                    Open, honest, verifiable.
                  </h3>
                  <p className="ed-body mt-3 text-stone-600">
                    The privacy claims on this page aren't marketing. You can verify every one of them yourself.
                  </p>

                  <div className="mt-8">
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

                {/* Figure 5 closes the margin, directly under the three ways to
                    verify the claim: the notes tell you how to check it, and
                    this says what you would be checking. The route to a server
                    is drawn as severed rather than idle, because that is the
                    actual architecture: there is no upload path to disable. */}
                <figure className="mt-16">
                  <div className="ed-mark text-stone-500">
                    <span className="ed-mono flex-shrink-0">Fig. 5</span>
                    <span className="ed-mark-rule" aria-hidden="true" />
                    <span className="ed-mono flex-shrink-0">The detection path</span>
                  </div>

                  <div className="mt-6">
                    <PrivacyArchitectureFigure />
                  </div>

                  <figcaption className="ed-caption ed-measure mt-4 text-stone-500">
                    Frames go from the camera to the landmark model, and from the model to the alarm.
                    All three sit inside your device. There is no route out for camera data, which is
                    why the figure on the cut path is zero rather than small. Signing in and paying
                    use the network; detection never does. A diagram of the architecture, not
                    measured data.
                  </figcaption>
                </figure>
              </aside>

              {/* The feature grid, re-set as a specification list: hairline
                  rows, icon and name hanging in the left column, description
                  beside it. Same six names and descriptions, verbatim.
                  It is its own nine-column row rather than the tail of the
                  seven-column argument above, for two reasons: a specification
                  wants to be read as a table, and leaving it in the narrow
                  column left the margin empty for the 500px it ran past the
                  verification notes beside it. */}
              <section
                aria-labelledby="features-heading"
                className="reveal col-span-full lg:col-span-9 lg:col-start-1"
                style={{ transitionDelay: '240ms' }}
              >
                <div className="ed-mark text-stone-500">
                  <span className="ed-mono flex-shrink-0">Specification</span>
                  <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
                </div>

                <h3
                  id="features-heading"
                  className="ed-h3 mt-6 text-stone-800"
                >
                  Everything you need to build the habit.
                </h3>
                <p className="ed-body mt-2 text-stone-500">Nothing you don't.</p>

                <dl className="mt-6 border-t border-hairline">
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
                      <dt className="ed-body flex items-center gap-3 font-semibold text-stone-800">
                        <Icon size={15} aria-hidden="true" className="flex-shrink-0 text-forest-600" />
                        {name}
                      </dt>
                      <dd className="ed-body ed-measure mt-1 sm:mt-0 text-stone-600">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </section>
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
        <section aria-labelledby="why-built-heading" className="pb-24 lg:pb-32">
          <div className="ed-container">
            <SectionMark n="05" label="Why we built this" />

            <div
              className="reveal ed-measure mx-auto mt-6 border-y border-hairline py-8 lg:mt-8 lg:py-12"
              style={{ transitionDelay: '80ms' }}
            >
              <h2 id="why-built-heading" className="ed-h2 text-stone-800">
                Made by people who bite their nails too.
              </h2>

              <div className="mt-6 space-y-6 text-stone-600">
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
              <p className="ed-mono mt-8 text-center text-stone-500">The Stop Biting team</p>
            </div>
          </div>
        </section>

        {/* Pricing keeps the legacy centred wrapper: it is a shared component
            and has to render here exactly as it renders on /pricing. Everything
            that used to sit inside that wrapper beside it is an editorial
            section now, so the wrapper closes again immediately and re-opens
            further down for the contact form. */}
        <div className="max-w-6xl mx-auto px-8 pb-24 lg:pb-32">
          {/* ── PRICING (shared with /pricing: see PricingSection.tsx) ────── */}
          <PricingSection />
        </div>

        {/* ── 06 · FURTHER READING ──────────────────────────────────────── */}
        {/* The ten featured guides and the three blog cards, argued as one
            reading list: mono kicker, title, reading time where the
            destination is an article. No cards, no chevrons, no hover lift,
            just hairlines and the link underline growing on hover.

            Nine columns wide, not seven plus an empty four. An index is the one
            thing on the page that genuinely wants width: kicker, title and
            reading time are three distinct fields and they read as a table when
            the row is wide enough to separate them. The margin here held
            twenty-five characters in a 735px box, which is not marginalia, so
            "From the blog" keeps its heading and its id as a ruled tail under
            the list instead, where it still labels the pointer to the full
            index. From here down the page is back matter and runs at this
            wider measure: 07 does the same. */}
        <section aria-labelledby="featured-guides-heading" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <SectionMark n="06" label="Further reading" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div
                className="reveal col-span-full lg:col-span-9 lg:col-start-1"
                style={{ transitionDelay: '80ms' }}
              >
                <h2 id="featured-guides-heading" className="ed-h2 text-stone-800">
                  Featured Guides
                </h2>

                <ul className="mt-8 list-none border-t border-hairline">
                  {READING_LIST.map(({ href, title, kicker, minutes }) => (
                    <li key={href} className="border-b border-hairline">
                      <a
                        href={href}
                        className="group block py-4 text-stone-800 transition-colors hover:text-forest-600 sm:grid sm:grid-cols-[7.5rem_1fr_auto] sm:items-baseline sm:gap-x-6"
                      >
                        <span className="ed-mono block text-stone-500 transition-colors group-hover:text-forest-600">
                          {kicker}
                        </span>
                        <span className="ed-body mt-2 block font-semibold sm:mt-0">
                          <span className="ed-link">{title}</span>
                        </span>
                        {minutes !== undefined && (
                          <span className="ed-mono mt-2 block text-stone-500 sm:mt-0 sm:text-right">
                            {minutes} min read
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>

                {/* The blog preview's heading, now the list's ruled tail. It is
                    an h3 (06's h2 is the guides heading) and keeps
                    `id="blog-preview-heading"`, so the aria-labelledby on this
                    nested section still resolves. The last row of the list is
                    already ruled beneath, so this one needs no rule of its
                    own: it reads as the note that closes the index. */}
                <section aria-labelledby="blog-preview-heading" className="mt-8">
                  <h3 id="blog-preview-heading" className="ed-mono text-stone-500">From the blog</h3>
                  <a
                    href="/blog"
                    className="ed-ui group mt-3 inline-flex items-center gap-2 text-forest-600 transition-colors hover:text-forest-500"
                  >
                    <span className="ed-link">All articles</span>
                    <ArrowRight size={13} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                  </a>
                </section>
              </div>
            </div>
          </div>
        </section>

        {/* ── 07 · FAQ ──────────────────────────────────────────────────── */}
        {/* The same six questions and answers, still byte-identical to the
            FAQPage JSON-LD in index.html: Google requires the structured data
            to have a visible counterpart, and server.js parses that same block
            for its crawler prose. Any edit here is an edit there. The card
            frames are gone and the disclosure is untouched: <details> and
            <summary> keep this working with no JavaScript at all.

            Nine columns, like 06 and for the same reason. There is nothing in
            this section that could annotate it from a margin, so the two-column
            grid was declaring a column it never filled: 600px of empty cream
            beside six closed disclosures. A wider row also gives the chevron
            somewhere to sit, hard right of its question. The answers keep
            `.ed-measure`, so opening one still sets it at 62 characters. */}
        <section id="faq" aria-labelledby="faq-heading" className="pb-24 lg:pb-32">
          <div className="ed-container">
            <SectionMark n="07" label="FAQ" />

            <div className="ed-grid mt-6 lg:mt-8">
              <div
                className="reveal col-span-full lg:col-span-9 lg:col-start-1"
                style={{ transitionDelay: '80ms' }}
              >
                <h2 id="faq-heading" className="ed-h2 text-stone-800">
                  Questions people ask about nail biting
                </h2>

                <div className="mt-8 border-t border-hairline">
                  {FAQS.map(({ q, a }) => (
                    <details key={q} className="group border-b border-hairline">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 ed-body font-semibold text-stone-800 marker:content-none [&::-webkit-details-marker]:hidden">
                        {q}
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-stone-500 transition-transform duration-200 group-open:rotate-180"
                        />
                      </summary>
                      <p className="ed-body ed-measure pb-4 text-stone-600">{a}</p>
                    </details>
                  ))}
                </div>

                <p className="ed-caption mt-8 text-stone-500">
                  More on all of this in the{' '}
                  <a href="/blog" className="ed-link text-forest-600 transition-colors hover:text-forest-500">nail biting guides</a>: {BLOG_INDEX.length} evidence-based articles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
        {/* The tinted rounded panel is gone: the argument closes between a
            pair of hairlines, the full width of the container, so it reads as
            the end of the page rather than as one more card on it. The
            shimmer is off the button too: it was the last animated ornament
            left in this file. */}
        <section aria-label="Call to action" className="pb-16 lg:pb-24">
          <div className="ed-container">
            <div className="reveal border-y border-hairline py-12 text-center lg:py-16">
              <h2 className="ed-h2 text-stone-800">Ready to stop nail biting?</h2>
              <p className="ed-body ed-measure mx-auto mt-6 text-stone-600">
                Use the web app directly in your browser: sign in with Google and nail biting detection starts in
                under ten seconds. No install needed.
              </p>
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="ed-ui mt-8 inline-flex items-center gap-2 rounded-2xl bg-forest-600 px-8 py-4 font-semibold text-cream-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-500 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
              >
                <Zap size={15} aria-hidden="true" />
                Start free trial (it's free)
              </a>
              <p className="ed-mono mt-6 text-stone-500">3-day free trial · no credit card required</p>
            </div>
          </div>
        </section>

        {/* ── CONTACT ───────────────────────────────────────────────────── */}
        {/* Shared component, unchanged: it keeps the legacy wrapper for the
            same reason PricingSection does. */}
        <div className="max-w-6xl mx-auto px-8 pb-24 lg:pb-32">
          <ContactForm />
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      {/* The colophon of the printed thing: hairline top rule, the wordmark in
          the display serif, and the eight links set as a mono column rather
          than a row of small grey text. All eight hrefs, and the copyright
          line, are the page's own, unchanged. */}
      <footer className="border-t border-hairline bg-cream-200 py-16">
        <div className="ed-container">
          <div className="flex flex-col justify-between gap-12 sm:flex-row sm:gap-16">
            <div>
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
                <span className="ed-wordmark text-stone-800">Stop Biting</span>
              </div>
              <p className="ed-body mt-4 max-w-sm text-stone-500">
                Stop nail biting (onychophagia) using on-device AI. Works in your browser as a Progressive Web App,
                no install required. Built with MediaPipe, React, and WebAssembly.
              </p>
            </div>

            {/* Written out one by one rather than mapped over an array: these
                eight hrefs are the site's whole legal and navigational surface,
                and spelling them as real attributes keeps them greppable. */}
            <nav aria-label="Footer navigation" className="flex flex-col items-start gap-4">
              <a href="/" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Home</span></a>
              <a href="/blog" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Blog</span></a>
              <a href="/#pricing" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Pricing</span></a>
              <a href="mailto:hello@stopbiting.today" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Contact</span></a>
              <a href="/editorial-policy" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Editorial Policy</span></a>
              <a href="/privacy" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Privacy Policy</span></a>
              <a href="/terms-and-conditions" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Terms of Service</span></a>
              <a href="/refund-policy" className="ed-mono text-stone-500 transition-colors hover:text-stone-800"><span className="ed-link">Refund Policy</span></a>
            </nav>
          </div>

          <p className="ed-caption mt-12 border-t border-hairline pt-8 text-stone-500">
            © {new Date().getFullYear()} Stop Biting · AI-powered nail biting detection ·{' '}
            <a href="https://stopbiting.today/" className="ed-link transition-colors hover:text-stone-600">stopbiting.today</a>
          </p>
        </div>
      </footer>

    </div>
  );
}
