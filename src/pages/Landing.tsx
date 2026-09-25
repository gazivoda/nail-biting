import { lazy, Suspense, useState } from 'react';
import {
  ArrowRight, BookOpen, Camera, ChevronDown, Loader2,
  ShieldCheck,
} from 'lucide-react';
import { ContactForm } from '../components/ContactForm';
import { PricingSection } from '../components/PricingSection';
import { AlarmSign } from '../components/sign/AlarmSign';
import { BLOG_INDEX } from '../data/blogIndex';

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

// The offer, stated beside every trial button. The figures MUST match
// PricingSection and the Offer schema server.js injects for /pricing
// ($2.99/month, $29.00/year, 3-day trial, no card).
// Commas, not middle dots: Overpass draws its middle dot hard against the
// following word, so a dotted line reads as "free ·no card".
const OFFER_LINE = '3 days free, no card, then $2.99/month';

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

// Mirrors the FAQPage JSON-LD in index.html. Google requires FAQ structured data
// to have a visible on-page counterpart, so these two must stay in step.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Why do people bite their nails?',
    a: 'Nail biting (onychophagia) is a body-focused repetitive behaviour affecting up to 30% of adults (Lee and Lipner, 2022). Common triggers are stress, anxiety, boredom, and deep focus. The habit usually starts in childhood and becomes automatic, happening without conscious awareness. Genetic predisposition, perfectionism, and OCD-spectrum tendencies are also linked.',
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

// ── The page ────────────────────────────────────────────────────────────────
// The sign system (see the `.sg-*` block in index.css and the surface brief in
// .impeccable/surfaces/): yellow warning for the alarm only, blue "mandatory"
// plates for what the visitor does, green "safe condition" plates for privacy.
// Light only, no dashes in copy, no scroll-reveal: every section is visible
// from the first paint, and the warning pictogram is the one thing that moves.

// Every trial button. A new tab on purpose (92360d2): the landing tab, and any
// demo running in it, stays open.
function TrialButton({ tone = 'blue', size = 'md' }: { tone?: 'blue' | 'light'; size?: 'md' | 'sm' }) {
  return (
    <a
      href="/api/auth/google"
      target="_blank"
      rel="noopener noreferrer"
      className={`sg-btn group ${tone === 'light' ? 'sg-btn-light' : ''} ${size === 'sm' ? 'sg-btn-sm' : ''}`}
    >
      Start free trial
      <ArrowRight size={size === 'sm' ? 15 : 18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );
}

// A section heading with its sign beside it: the glyph says which kind of
// statement follows (do this / this is safe) before the words do.
function SignHeading({ id, sign, children }: {
  id: string;
  sign: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 sm:gap-5">
      <div className="pt-1">{sign}</div>
      <h2 id={id} className="sg-h2">{children}</h2>
    </div>
  );
}

export function Landing() {
  // Stays false until the visitor asks for the demo: the lazy import is only
  // ever triggered by this flag, which is what keeps MediaPipe off a page view.
  const [demoStarted, setDemoStarted] = useState(false);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        aria-label="Site navigation"
        className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--sg-rule)] bg-[color:var(--sg-ground)]/90 backdrop-blur-md"
      >
        <div className="sg-container flex h-16 items-center justify-between gap-4">
          <a href="/" className="flex min-h-11 items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" />
            <span className="text-lg font-extrabold tracking-tight">Stop Biting</span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            {([['#how', 'How to start'], ['#science', 'Science'], ['#privacy', 'Privacy'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] as const).map(([href, label]) => (
              <a key={href} href={href} className="text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)]">
                {label}
              </a>
            ))}
            <a href="/blog" className="text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)]">
              Blog
            </a>
          </div>
          <TrialButton size="sm" />
        </div>
      </nav>

      <main>
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section aria-label="Hero" className="pt-28 pb-16 lg:pt-36 lg:pb-24">
          <div className="sg-container grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-6">
              <h1 className="sg-h1">Stop biting your nails.</h1>
              <p className="sg-lede sg-measure mt-6">
                Your webcam watches your hands while you work. The moment a fingertip reaches your lips,
                an alarm sounds, so you catch the bites you would otherwise never notice.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <TrialButton />
                <a href="#how" className="sg-link inline-flex min-h-11 items-center">How to start</a>
              </div>
              <p className="sg-note mt-4">{OFFER_LINE}</p>

            </div>

            {/* The warning sign is the plate: no card around it. Until the
                visitor asks, it is the pictogram; then the real detector runs
                in its place. The heading and paragraph render on page view:
                they are the crawler-visible copy mirrored in server.js and must
                not hide behind the click. */}
            <section
              id="live-demo"
              aria-labelledby="live-demo-heading"
              className="flex flex-col items-center text-center lg:col-span-6"
            >
              {demoStarted ? (
                <div className="w-full">
                  <Suspense
                    fallback={
                      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-[color:var(--sg-ink)] px-6">
                        <p className="flex items-center gap-2 text-center text-[0.9375rem] text-white">
                          <Loader2 size={15} className="flex-shrink-0 animate-spin" aria-hidden="true" />
                          {DEMO_LOADING_LABEL}
                        </p>
                      </div>
                    }
                  >
                    <HeroDemo autoStart />
                  </Suspense>
                </div>
              ) : (
                // The click gate. `HeroDemo` is behind `lazy()` and is only
                // ever referenced above, so a page view fetches no chunk, no
                // WebAssembly and no MediaPipe model.
                <AlarmSign className="w-full max-w-[26rem]" />
              )}

              <h2 id="live-demo-heading" className="sg-h3 mt-6">Try the detector right now</h2>
              <p className="sg-note mt-2 max-w-sm">
                When a fingertip crosses the ring around your mouth, the alarm goes off.
              </p>
              {!demoStarted && (
                <>
                  <button
                    type="button"
                    onClick={() => setDemoStarted(true)}
                    className="sg-btn sg-btn-ink mt-5"
                  >
                    <Camera size={18} aria-hidden="true" />
                    Try the live demo
                  </button>
                  <p className="sg-note mt-3">60 seconds, camera prompt, sound on</p>
                </>
              )}
              <p className="sg-small mt-6 max-w-[46ch] text-left">
                Run the real nail biting detector on your own camera for 60 seconds: no account, no
                signup. The AI models download once (about 20 MB) and then everything runs on your
                device: open your browser's network panel and you'll see zero requests while it is
                watching. Nothing is uploaded and nothing is saved.
              </p>
            </section>

          </div>
        </section>

        {/* ── THE APP ───────────────────────────────────────────────────── */}
        {/* The product itself, not a drawing of it. Real screens from the app,
            captured with a week of example data and labelled as such (see
            public/shots; provenance is embedded in each file). Wider than the
            rest of the page on purpose: this is the one section that wants
            the room. */}
        <section aria-labelledby="app-heading" className="pb-16 lg:pb-24">
          <div className="mx-auto w-full max-w-[88rem] px-[clamp(1.25rem,4vw,2.5rem)]">
            <h2 id="app-heading" className="sg-h2 max-w-[20ch]">What it looks like while you work</h2>

            <div className="mt-10 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
              <figure className="lg:col-span-8">
                <img
                  src="/shots/app-watch-1280.webp"
                  srcSet="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w"
                  sizes="(min-width: 1024px) 58rem, 100vw"
                  width={1280}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  alt="The Watch screen: detection is running with the camera feed hidden, the streak has just reset to zero after a catch, best streak 19 hours, and a card suggests pressing your thumb to each fingertip instead."
                  className="w-full rounded-lg border border-[color:var(--sg-rule)]"
                />
                <figcaption className="sg-small mt-3 max-w-[60ch]">
                  <strong className="font-bold text-[color:var(--sg-ink)]">Watch.</strong> Right after a
                  catch: the streak goes back to zero and it suggests something else to do with your hands.
                </figcaption>
              </figure>

              <figure className="mx-auto w-full max-w-[20rem] lg:col-span-4 lg:mx-0">
                <img
                  src="/shots/app-history-390.webp"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  alt="The History screen on a phone: bites per day for the last seven days, then each entry with its time and trigger, such as Focus or Stress."
                  className="w-full rounded-lg border border-[color:var(--sg-rule)]"
                />
                <figcaption className="sg-small mt-3">
                  <strong className="font-bold text-[color:var(--sg-ink)]">History.</strong> Every alarm and
                  every bite you log, with the time and what set it off.
                </figcaption>
              </figure>
            </div>

            <p className="sg-note mt-8">Real screens from the app, shown with example data.</p>
          </div>
        </section>

        {/* ── HOW TO START ──────────────────────────────────────────────── */}
        {/* Said, not diagrammed: setting it up is one sentence long, and a
            three-column numbered grid made it look like a SaaS onboarding
            flow. The blue "do this" sign appears here once. */}
        <section id="how" aria-labelledby="how-heading" className="border-y border-[color:var(--sg-rule)] bg-[color:var(--sg-plate)] py-14 lg:py-16">
          <div className="sg-container grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="flex items-center gap-4 lg:col-span-4">
              <span className="sg-sign sg-sign-m"><ArrowRight size={24} aria-hidden="true" /></span>
              <h2 id="how-heading" className="sg-h2">How to start</h2>
            </div>
            <div className="lg:col-span-8">
              <p className="sg-lede text-[color:var(--sg-ink)]">
                Sign in with Google (it opens in a new tab), allow the camera, and get on with your
                work. When your hand reaches your mouth, it goes off. That's the whole setup.
              </p>
              <p className="sg-small mt-3">
                It runs in your desktop browser, so there's nothing to download. You can install it
                like an app later if you want it one click away.
              </p>

              {/* The limits, said plainly. Each line is checked against the
                  code: useDetection (hidden tabs need the Minimize window),
                  biteDetector (fingertip distance, three sensitivity levels),
                  Settings (sound, volume, flash), the store (local history). */}
              <h3 className="sg-h3 mt-8">Before you start</h3>
              <ul className="sg-body mt-3 list-disc space-y-2 pl-5 marker:text-[color:var(--sg-ink-2)]">
                <li>You need a webcam and a laptop or desktop browser. It's made for the hours you spend at a screen.</li>
                <li>Keep the app open while you work. If you switch to another tab, press Minimize so a small window keeps watching.</li>
                <li>It reacts to a hand near your mouth, not only to biting, so resting your chin on your fingers can set it off. Sensitivity has three levels.</li>
                <li>It makes a noise. Pick a quieter sound, turn it down, or use a screen flash instead.</li>
                <li>Your history is stored in this browser, so it doesn't follow you to another computer.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── SCIENCE ───────────────────────────────────────────────────── */}
        <section id="science" aria-labelledby="science-heading" className="py-20 lg:py-28">
          <div className="sg-container grid gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <SignHeading
                id="science-heading"
                sign={<span className="sg-sign sg-sign-m"><BookOpen size={22} aria-hidden="true" /></span>}
              >
                Why an alarm works when willpower doesn't
              </SignHeading>

              <div className="sg-measure mt-8 space-y-5">
                <p className="sg-body">
                  Nail biting runs on autopilot: by the time you notice, you're already doing it. That is
                  why bitter polish and willpower rarely stick. The method with the strongest evidence,
                  habit reversal training, starts with one hard step: noticing every time.
                </p>
                <p className="sg-body">
                  In a clinic, a therapist would tap your shoulder. The alarm is that tap, available all
                  day while you work. What you do next (press your palms flat, clench a fist) is the
                  other half of the method, and it's yours.
                </p>
                <p className="sg-body">
                  An app is not a clinician. For severe or distressing biting, the{' '}
                  <a href="https://www.bfrb.org/" target="_blank" rel="noopener noreferrer" className="sg-link">TLC Foundation for Body-Focused Repetitive Behaviors</a>{' '}
                  lists BFRB-informed therapists.
                </p>
              </div>

              <a href="/blog/habit-reversal-training-guide" className="sg-link mt-8 inline-flex min-h-11 items-center gap-2">
                Read the habit reversal training guide
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>

            <div className="lg:col-span-5">
              <div className="border-t-2 border-[color:var(--sg-ink)] pt-6 lg:mt-3">
                <p className="sg-body text-[color:var(--sg-ink)]">
                  <strong className="font-extrabold">20-30% of adults</strong> bite their nails
                  chronically (Halteh, Scher &amp; Lipner, 2017).
                </p>
                <p className="sg-body mt-4 text-[color:var(--sg-ink)]">
                  In the landmark habit reversal trial, participants' own daily counts fell by{' '}
                  <strong className="font-extrabold">about 99%</strong> over five months (Azrin, Nunn
                  &amp; Frantz, 1980).
                </p>
              </div>

              <ul className="mt-6 space-y-1">
                {[
                  ['https://pubmed.ncbi.nlm.nih.gov/7436976/', 'Azrin, Nunn & Frantz (1980), Behaviour Research and Therapy'],
                  ['https://pubmed.ncbi.nlm.nih.gov/21549664/', 'Bate et al. (2011), Clinical Psychology Review meta-analysis'],
                ].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="sg-note inline-flex min-h-11 items-center gap-2 text-[color:var(--sg-ink)] underline decoration-[color:var(--sg-rule)] decoration-2 underline-offset-4 hover:decoration-[color:var(--sg-blue)]">
                      {label} (PubMed)
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── PRIVACY ───────────────────────────────────────────────────── */}
        <section id="privacy" aria-labelledby="privacy-heading" className="pb-20 lg:pb-28">
          <div className="sg-container">
            <div className="overflow-hidden rounded-lg bg-[color:var(--sg-green-tint)] shadow-[inset_0_0_0_2px_var(--sg-green)]">
              <div className="flex items-start gap-4 bg-[color:var(--sg-green)] p-6 text-white sm:gap-5 sm:p-10">
                <span className="sg-sign sg-sign-e shadow-[inset_0_0_0_2px_#fff]"><ShieldCheck size={26} aria-hidden="true" /></span>
                <h2 id="privacy-heading" className="sg-h2">Your camera never leaves your device.</h2>
              </div>
              <div className="p-6 sm:p-10">
                <p className="sg-body sg-measure text-[color:var(--sg-ink)]">
                  A camera pointed at you all day is a lot to trust an app with, so detection runs
                  entirely in your browser, on your own computer: <strong className="font-extrabold">0 bytes</strong> of
                  camera data go to any server. Signing in and paying use the network; watching never does.
                </p>
              <p className="sg-body sg-measure mt-6 border-t border-[color:oklch(46%_0.13_148/0.2)] pt-6">
                <strong className="font-bold text-[color:var(--sg-ink)]">Check it yourself:</strong> open
                your browser's developer tools, go to the Network tab and start detection. The list stays
                empty. It keeps working with the Wi-Fi off, and your history lives in this browser:
                clear the site's data and it's gone.
              </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO MADE THIS ─────────────────────────────────────────────── */}
        {/* A person, in his own words, before the price. Every fact here is
            from the founder's story on /about; nothing is added. Deliberately
            plain: no sign, no plate, a narrow measure. */}
        <section aria-labelledby="maker-heading" className="pb-16 lg:pb-20">
          <div className="sg-container">
            <div className="max-w-[52ch]">
              <h2 id="maker-heading" className="sg-h3">Why this exists</h2>
              <p className="sg-body mt-3 text-[color:var(--sg-ink)]">
                I bit my nails for over twenty years. Bitter polish, reminder bands, willpower: none of
                it lasted, because I never noticed I was doing it until the damage was done. I write
                software and I had a webcam, so I built the thing that notices for me.
              </p>
              <p className="mt-4 font-bold">Igor Gazivoda</p>
              <a href="/about" className="sg-link mt-1 inline-flex min-h-11 items-center">The longer story</a>
            </div>
          </div>
        </section>

        {/* ── PRICING (shared with /pricing: see PricingSection.tsx) ────── */}
        <div className="border-t border-[color:var(--sg-rule)] bg-[color:var(--sg-plate)] py-20 lg:py-28">
          <div className="sg-container">
            <PricingSection />
          </div>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {/* The same six questions and answers, byte-identical to the FAQPage
            JSON-LD in index.html: Google requires the structured data to have
            a visible counterpart, and server.js parses that same block for its
            crawler prose. Any edit here is an edit there. <details> keeps this
            working with no JavaScript at all. */}
        <section id="faq" aria-labelledby="faq-heading" className="py-20 lg:py-28">
          <div className="sg-container grid gap-10 lg:grid-cols-12">
            <h2 id="faq-heading" className="sg-h2 lg:col-span-4">Questions people ask about nail biting</h2>
            <div className="border-t border-[color:var(--sg-rule)] lg:col-span-8">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group border-b border-[color:var(--sg-rule)]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-[color:var(--sg-ink-2)] transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="sg-body sg-measure pb-6">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
        {/* The one full blue field on the page: a mandatory sign, blown up. */}
        <section aria-label="Call to action" className="sg-band bg-[color:var(--sg-blue)] py-20 text-white lg:py-24">
          <div className="sg-container flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="sg-h2">Catch your next bite.</h2>
              <p className="mt-4 text-lg text-white/85">
                Leave it running through your next workday, then open History and see when you bite.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3">
              <TrialButton tone="light" />
              <p className="sg-note whitespace-nowrap text-white/90">{OFFER_LINE}</p>
            </div>
          </div>
        </section>

        {/* ── GUIDES ────────────────────────────────────────────────────── */}
        {/* Back matter: every guide the page links, printed once. */}
        <section aria-labelledby="featured-guides-heading" className="py-20 lg:py-24">
          <div className="sg-container">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id="featured-guides-heading" className="sg-h2">Featured guides</h2>
              <a href="/blog" className="sg-link inline-flex min-h-11 items-center gap-2">
                All {BLOG_INDEX.length} articles <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <ul className="mt-8 grid border-t border-[color:var(--sg-rule)] md:grid-cols-2 md:gap-x-10">
              {READING_LIST.map(({ href, title }) => (
                <li key={href} className="border-b border-[color:var(--sg-rule)]">
                  <a href={href} className="group flex min-h-14 items-center justify-between gap-4 py-3.5 font-semibold transition-colors hover:text-[color:var(--sg-blue)]">
                    <span className="group-hover:underline group-hover:underline-offset-4">{title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CONTACT (shared component) ───────────────────────────────── */}
        <div className="sg-container pb-20 lg:pb-24">
          <ContactForm />
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--sg-rule)] bg-[color:var(--sg-plate)] py-14">
        <div className="sg-container">
          <div className="flex flex-col justify-between gap-10 sm:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" />
                <span className="text-lg font-extrabold tracking-tight">Stop Biting</span>
              </div>
              <p className="sg-small mt-4">
                An awareness alarm for nail biting (onychophagia), made by{' '}
                <a href="/about" className="sg-link">Igor Gazivoda</a>. Detection runs in your browser
                and nothing is uploaded.
              </p>
            </div>
            {/* Written out one by one: these eight hrefs are the site's whole
                legal and navigational surface, and spelling them as real
                attributes keeps them greppable. */}
            <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-10 text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)]">
              <a href="/" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Home</a>
              <a href="/blog" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Blog</a>
              <a href="/#pricing" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Pricing</a>
              <a href="mailto:hello@stopbiting.today" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Contact</a>
              <a href="/editorial-policy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Editorial Policy</a>
              <a href="/privacy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Privacy Policy</a>
              <a href="/terms-and-conditions" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Terms of Service</a>
              <a href="/refund-policy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Refund Policy</a>
            </nav>
          </div>
          <p className="sg-small mt-10 border-t border-[color:var(--sg-rule)] pt-6">
            © {new Date().getFullYear()} Stop Biting.{' '}
            <a href="https://stopbiting.today/" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">stopbiting.today</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
