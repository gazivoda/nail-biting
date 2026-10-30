import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowRight, Camera, ChevronDown, Loader2,
  ShieldCheck,
} from 'lucide-react';
import { ContactForm } from '../components/ContactForm';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';
import { Rings } from '../components/site/Rings';
import { Testimonials } from '../components/site/Testimonials';
import { PricingSection } from '../components/PricingSection';
import { BLOG_INDEX } from '../data/blogIndex';
import { useFlagCopy, useFlagIsOn } from '../features/useFlagCopy';
import { ensureLocaleLoaded } from '../i18n/core';
import { useLocale } from '../i18n/hooks';
import { useT as useChromeT } from '../i18n/scopes/marketing-chrome';
import { useT as useHomeT } from '../i18n/scopes/marketing-home';
import { anySignIn, composeSignInAnswer } from '../i18n/marketing/signin';
import { useSitePaths, useSiteT } from '../i18n/marketing/useSite';
import { HERO_SHOT } from '../../shared/heroShot.js';

// The live demo pulls in MediaPipe, 125 KB of WebAssembly glue that the landing
// page's critical path must never pay for. Lazy so it lands in its own chunk,
// and mounted only from the visitor's click (see `demoStarted` below) so a page
// view fetches nothing detection-related at all.
const HeroDemo = lazy(() =>
  import('../components/demo/HeroDemo').then(m => ({ default: m.HeroDemo })),
);

// The words of this page are in the marketing-home scope (src/i18n/scopes/marketing-home.ts) and the pricing cards,
// the header, the footer and the closing call to action in marketing-chrome. The figures in the offer line and in the
// pricing cards MUST match the Offer schema server.js injects ($2.99/month, $29.00/year, free trial, no card).
// Commas, not middle dots: Overpass draws its middle dot hard against the
// following word, so a dotted line reads as "free ·no card".

// The ten hand-picked guides. The titles are the page's own copy, not the post
// titles, because a reading list wants the shortest true description of the
// destination rather than the article's full SEO headline. The articles are English only, so the titles are the same
// in every language (marketing-home guide.N); this list says where each one goes.
const FEATURED_GUIDES = [
  { href: '/how-it-works', key: 'guide.1' },
  { href: '/blog/habit-reversal-training-guide', key: 'guide.2' },
  { href: '/blog/how-to-stop-nail-biting', key: 'guide.3' },
  { href: '/blog/nail-biting-30-day-plan', key: 'guide.4' },
  { href: '/blog/nail-biting-trigger-mapping', key: 'guide.5' },
  { href: '/blog/best-apps-to-stop-nail-biting', key: 'guide.6' },
  { href: '/blog/best-nail-biting-remedies', key: 'guide.7' },
  { href: '/blog/nail-biting-health-risks', key: 'guide.8' },
  { href: '/blog/nail-biting-in-children', key: 'guide.9' },
  { href: '/compare/bitter-polish-alternative', key: 'guide.10' },
  { href: '/blog/how-ai-can-help-stop-nail-biting', key: 'guide.11' },
] as const;

// Three places to start, each with a line on who it is for. Everything else in
// FEATURED_GUIDES follows as a compact list, so every destination is still linked
// exactly once, but the section reads as a recommendation, not a link dump.
const START_HERE = [
  { href: '/blog/habit-reversal-training-guide', key: 'start.1' },
  { href: '/blog/nail-biting-trigger-mapping', key: 'start.2' },
  { href: '/compare/bitter-polish-alternative', key: 'start.3' },
] as const;

// Mirrors the FAQPage JSON-LD in index.html (English) and in dist/i18n/<locale>.json (the other languages). Google
// requires FAQ structured data to have a visible on-page counterpart, so these must stay in step: the questions are
// the messages faq.N.q / faq.N.a of the marketing-home scope, N = 1..11.
const FAQ_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

// ── The page ────────────────────────────────────────────────────────────────
// The sign system (see the `.sg-*` block in index.css and the surface brief in
// .impeccable/surfaces/): yellow warning for the alarm only, green "mandatory"
// plates for what the visitor does, green "safe condition" plates for privacy.
// Light only, no dashes in copy, no scroll-reveal: every section is visible
// from the first paint, and the warning pictogram is the one thing that moves.

const LOOP_CARDS = [
  { n: '01', k: 1, cls: 'bg-lime-300 text-deep', num: 'text-deep/90' },
  { n: '02', k: 2, cls: 'bg-deep text-white', num: 'text-lime-300' },
  { n: '03', k: 3, cls: 'bg-ember text-deep', num: 'text-deep/90' },
] as const;

const REFERENCES = [
  { href: 'https://pubmed.ncbi.nlm.nih.gov/7436976/', key: 'science.ref1' },
  { href: 'https://pubmed.ncbi.nlm.nih.gov/21549664/', key: 'science.ref2' },
] as const;

export function Landing({ authError = null, onDismissAuthError }: { authError?: string | null; onDismissAuthError?: () => void } = {}) {
  // Stays false until the visitor asks for the demo: the lazy import is only
  // ever triggered by this flag, which is what keeps MediaPipe off a page view.
  const [demoStarted, setDemoStarted] = useState(false);
  // Sentences that stop being true when a feature flag is on (sync, other sign-in methods, a phone
  // screen) go through `copy` for English. With every flag off it returns the text it was given, unchanged.
  // The other languages word those sentences themselves (a {sync, select, ...} in the message, or the sign-in answer
  // composed from its pieces).
  const copy = useFlagCopy();
  const isOn = useFlagIsOn();
  const t = useSiteT(useHomeT);
  const c = useSiteT(useChromeT);
  const paths = useSitePaths();
  const { locale } = useLocale();
  // The guides and the comparison pages are English only: on a localized page their links say so.
  const english = locale === 'en' ? {} : { lang: 'en' };

  // Links from blog posts, the calculator and the tracker point at /#live-demo.
  // The page is client-rendered after the session check, so the browser's own
  // hash scroll has nothing to land on when it runs.
  useEffect(() => {
    if (window.location.hash !== '#live-demo') return;
    document.getElementById('live-demo')?.scrollIntoView({ block: 'center' });
  }, []);

  // What a cancelled or failed Google sign-in means, in the visitor's words.
  // access_denied is Google's code for "you pressed Cancel".
  const authErrorMessage = (code: string) => (code === 'access_denied' ? t('authError.cancelled') : t('authError.failed'));

  // The answer to a question, with the sentences that follow the flags. The one about a Google account has a second
  // form in the other languages when another sign-in method is on (English: shared/flagCopy.js).
  const faqAnswer = (n: (typeof FAQ_NUMBERS)[number]): string => {
    if (n === 10 && locale !== 'en' && anySignIn(isOn)) return composeSignInAnswer(t, isOn);
    return copy(t(`faq.${n}.a`));
  };

  const startDemo = () => {
    // The demo draws the detector's own words (camera errors, the alarm) from the app's catalog: fetch it with the click.
    if (locale !== 'en') void ensureLocaleLoaded(locale);
    setDemoStarted(true);
  };

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      <SiteHeader onHome page="home" />

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section aria-label={t('hero.aria')} className="pt-20 pb-16 lg:pt-24 lg:pb-24">
          <div className="sg-container">
          <div className="sg-hero sg-dark bite relative grid items-start gap-12 overflow-hidden p-6 pb-10 sm:p-10 lg:grid-cols-12 lg:gap-10 lg:p-14">
            <Rings className="-bottom-72 -left-72 h-[44rem] w-[44rem]" />
            <div className="relative lg:col-span-6 lg:pt-4">
              {authError && (
                <div role="alert" className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[color:var(--sg-rule)] bg-white/10 px-4 py-3">
                  <p className="sg-small flex-1 text-[color:var(--sg-ink)]">{authErrorMessage(authError)}</p>
                  <a href="/api/auth/google" rel="nofollow" className="sg-link inline-flex min-h-11 items-center">{t('authError.retry')}</a>
                  <button type="button" onClick={onDismissAuthError} className="sg-small inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">
                    {t('authError.dismiss')}
                  </button>
                </div>
              )}
              <h1 className="sg-h1">{t.rich('hero.title', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}</h1>
              <p className="sg-lede sg-measure mt-6">
                {t('hero.lede')}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <TrialButton source="landing_hero" />
                <a href="#how" className="sg-link inline-flex min-h-11 items-center">{t('hero.howLink')}</a>
              </div>
              <p className="sg-note mt-4">{c('offer.line')}</p>
              {/* Said before the button is pressed: the trial clock starts at
                  sign-in, and a phone visitor would spend it finding out. */}
              <p className="sg-note mt-1">{t('hero.note1')}</p>
              {/* The three questions a visitor has before pressing the button, answered
                  beside it rather than in the privacy section and FAQ further down.
                  Mirrored in server.js. */}
              <p className="sg-note mt-1">
                {copy(t('hero.note2'))}
              </p>
            </div>

            {/* The real app, not an illustration: until the visitor asks, the
                Watch screen (captured with example data, see public/shots);
                then the real detector runs in its place. The heading and
                paragraph render on page view: they are the crawler-visible
                copy mirrored in server.js and must not hide behind the click. */}
            <div className="relative flex flex-col items-start lg:col-span-6">
              {demoStarted ? (
                <div className="w-full">
                  <Suspense
                    fallback={
                      <div className="flex aspect-video w-full items-center justify-center rounded-3xl bg-[color:var(--sg-deep-2)] px-6">
                        <p role="status" className="flex items-center gap-2 text-center text-[0.9375rem] text-white">
                          <Loader2 size={15} className="flex-shrink-0 animate-spin" aria-hidden="true" />
                          {t('demo.loading')}
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
                <figure className="relative w-full">
                  <span className="sg-sticker sg-sticker-lime -left-3 -top-4 sm:-left-5">{t('hero.sticker.trial')}</span>
                  <span className="sg-sticker sg-sticker-white bottom-14 -right-2 max-w-[10.5rem] text-center leading-tight max-sm:hidden sm:-right-4">{t('hero.sticker.privacy')}</span>
                  {/* src, srcSet and sizes come from shared/heroShot.js: server.js preloads the same candidates from the HTML. */}
                  <img
                    src={HERO_SHOT.src}
                    srcSet={HERO_SHOT.srcSet}
                    sizes={HERO_SHOT.sizes}
                    width={HERO_SHOT.width}
                    height={HERO_SHOT.height}
                    fetchPriority="high"
                    decoding="async"
                    alt={t('hero.shot.alt')}
                    className="w-full rounded-3xl"
                  />
                  <figcaption className="sg-note mt-3">
                    {t('hero.shot.caption')}
                  </figcaption>
                </figure>
              )}

              {/* The demo trigger sits under the main CTA as the second path,
                  not in the right column, where it stacked under the
                  screenshot and competed with "Start free trial". The demo
                  itself still runs in place of the screenshot. The heading and
                  paragraph are mirrored in server.js. */}
              <section
                id="live-demo"
                aria-labelledby="live-demo-heading"
                className="mt-8 flex w-full flex-col items-start border-t border-[color:var(--sg-rule)] pt-8"
              >
                <h2 id="live-demo-heading" className="sg-h3">{t('demo.heading')}</h2>
                <p className="sg-note mt-2 max-w-md">
                  {t('demo.intro')}
                </p>
                {!demoStarted && (
                  <>
                    <button
                      type="button"
                      onClick={startDemo}
                      className="sg-btn sg-btn-ink mt-5"
                    >
                      <Camera size={18} aria-hidden="true" />
                      {t('demo.start')}
                    </button>
                  </>
                )}
                <p className="sg-small mt-4 max-w-[46ch]">
                  {t('demo.small')}
                </p>
              </section>

            </div>

          </div>
          </div>
        </section>

        {/* ── TAPE ──────────────────────────────────────────────────────── */}
        <div aria-hidden="true" className="relative z-10 -my-2 overflow-hidden py-6">
          <div className="sg-tape">
            <div className="sg-tape__track">
              {[0, 1].map(n => (
                <div key={n} className="sg-tape__item">
                  {(['tape.1', 'tape.2', 'tape.3', 'tape.4'] as const).map(key => (
                    <span key={key} className="inline-flex items-center gap-8">
                      {t(key)}
                      <svg width="34" height="34" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="30" fill="currentColor" /><circle cx="48" cy="48" r="16" fill="var(--c-signal)" /><circle cx="54" cy="42" r="5" fill="currentColor" /></svg>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── THE LOOP ──────────────────────────────────────────────────── */}
        {/* Habit reversal training in three moves, the same three the science
            section below describes: notice, interrupt, replace. */}
        <section aria-labelledby="loop-heading" className="py-16 lg:py-24">
          <div className="sg-container">
            <h2 id="loop-heading" className="sg-h2 max-w-[18ch]">{t.rich('loop.heading', undefined, { mark: chunks => <span className="sg-mark">{chunks}</span> })}</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {LOOP_CARDS.map(({ n, k, cls, num }) => (
                <div key={n} className={`bite flex min-h-[22rem] flex-col justify-between rounded-2xl p-7 sm:p-8 [--bite:44px] ${cls}`}>
                  <span className={`font-display text-[7.5rem] font-extrabold leading-[0.8] tracking-[-0.06em] ${num}`}>{n}</span>
                  <div>
                    <h3 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{t(`loop.${k}.title`)}</h3>
                    <p className="mt-3 text-lg leading-snug opacity-85">{t(`loop.${k}.body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HISTORY ───────────────────────────────────────────────────── */}
        {/* The other half of the product, shown rather than described: the
            real History screen, captured with example data (public/shots;
            provenance embedded in the file). */}
        <section aria-labelledby="app-heading" className="pb-16 lg:pb-24">
          {/* Top-aligned, with the copy sticky: centring it beside the ~600px
              phone shot left a 270px hole under the hero that read as the end
              of the page. */}
          <div className="sg-container grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6 lg:sticky lg:top-28 lg:pt-10">
              <h2 id="app-heading" className="sg-h2 max-w-[18ch]">{t.rich('history.heading', undefined, { mark: chunks => <span className="sg-mark">{chunks}</span> })}</h2>
              <p className="sg-body sg-measure mt-5">
                {t('history.body')}
              </p>
            </div>
            <figure className="relative mx-auto w-full max-w-[16rem] sm:max-w-[20rem] lg:col-span-4 lg:col-start-8">
              <span className="sg-sticker sg-sticker-ember -left-6 top-28 max-sm:hidden sm:-left-14">{t('history.sticker')}</span>
              <img
                src="/shots/app-history-390.webp"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                alt={t('history.alt')}
                className="w-full rounded-2xl border border-[color:var(--sg-rule)]"
              />
              <figcaption className="sg-note mt-3">{t('history.caption')}</figcaption>
            </figure>
          </div>
        </section>

        {/* ── HOW TO START ──────────────────────────────────────────────── */}
        {/* Said, not diagrammed: setting it up is one sentence long, and a
            three-column numbered grid made it look like a SaaS onboarding
            flow. The green "do this" sign appears here once. */}
        <section id="how" aria-labelledby="how-heading" className="py-4 lg:py-8">
          <div className="sg-container">
          <div className="bite grid gap-6 rounded-2xl bg-[color:var(--sg-signal)] p-6 sm:p-10 lg:grid-cols-12 lg:items-start lg:gap-10 lg:rounded-[3rem] lg:p-14">
            <div className="flex items-center gap-4 lg:col-span-4">
              <span className="sg-sign sg-sign-m"><ArrowRight size={26} aria-hidden="true" /></span>
              <h2 id="how-heading" className="sg-h2">{t('how.heading')}</h2>
            </div>
            <div className="lg:col-span-8">
              <p className="sg-lede text-[color:var(--sg-ink)]">
                {copy(t('how.lede'))}
              </p>
              <p className="sg-small mt-3">
                {t('how.small')}
              </p>

              {/* The limits, said plainly. Each line is checked against the
                  code: useDetection (hidden tabs need the Minimize window),
                  biteDetector (fingertip distance, three sensitivity levels),
                  Settings (sound, volume, flash), the store (local history). */}
              <h3 className="sg-h3 mt-8">{t('how.before')}</h3>
              <ul className="sg-body mt-3 list-disc space-y-2 pl-5 marker:text-[color:var(--sg-ink-2)]">
                <li>{t('how.b1')}</li>
                <li>{t('how.b2')}</li>
                <li>{t('how.b3')}</li>
                <li>{t('how.b4')}</li>
                <li>{copy(t('how.b5'))}</li>
              </ul>
            </div>
          </div>
          </div>
        </section>

        {/* ── SCIENCE ───────────────────────────────────────────────────── */}
        <section id="science" aria-labelledby="science-heading" className="py-20 lg:py-28">
          <div className="sg-container grid gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <h2 id="science-heading" className="sg-h2 max-w-[18ch]">
                {t.rich('science.heading', undefined, { mark: chunks => <span className="sg-mark">{chunks}</span> })}
              </h2>

              <div className="sg-measure mt-8 space-y-5">
                <p className="sg-body">
                  {t('science.p1')}
                </p>
                <p className="sg-body">
                  {t('science.p2')}
                </p>
                <p className="sg-body">
                  {t.rich('science.p3', undefined, {
                    link: chunks => <a href="https://www.bfrb.org/" target="_blank" rel="noopener noreferrer" className="sg-link">{chunks}</a>,
                  })}
                </p>
              </div>

              <a href="/blog/habit-reversal-training-guide" {...english} className="sg-link mt-8 inline-flex min-h-11 items-center gap-2">
                {t('science.guideLink')}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>

            <div className="lg:col-span-5">
              <div className="border-t-4 border-[color:var(--sg-deep)] pt-6 lg:mt-3">
                <p className="sg-body">
                  {/* The figures in ink, the device the privacy plate uses for
                      "0 bytes": the proof was the quietest text on the page. */}
                  {t.rich('science.stat1', undefined, { strong: chunks => <strong className="font-extrabold text-[color:var(--sg-ink)]">{chunks}</strong> })}
                </p>
                <p className="sg-body mt-4">
                  {t.rich('science.stat2', undefined, { strong: chunks => <strong className="font-extrabold text-[color:var(--sg-ink)]">{chunks}</strong> })}
                </p>
              </div>

              <ul className="mt-6 space-y-1">
                {REFERENCES.map(({ href, key }) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="sg-note inline-block py-3 text-[color:var(--sg-ink)] underline decoration-[color:var(--sg-rule)] decoration-2 underline-offset-4 hover:decoration-[color:var(--sg-accent)]">
                      {t(key)}{' '}<span className="whitespace-nowrap">{t('science.pubmed')}</span>
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
            <div className="sg-hero sg-dark bite relative overflow-hidden">
              <Rings className="-bottom-80 -right-40 h-[42rem] w-[42rem]" />
              <div className="flex flex-col items-start gap-6 p-6 sm:p-10 lg:p-14">
                <span className="sg-sign sg-sign-e"><ShieldCheck size={28} aria-hidden="true" /></span>
                <h2 id="privacy-heading" className="sg-h2 max-w-[20ch]">{t.rich('privacy.heading', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}</h2>
              </div>
              <div className="grid gap-6 border-t border-[color:var(--sg-rule)] p-6 sm:p-10 lg:grid-cols-2 lg:gap-10 lg:px-14">
                <p className="sg-body text-[color:var(--sg-ink)]">
                  {copy(t('privacy.p1'))}
                </p>
                {/* "The list stays empty" was not true on a first run: starting
                    detection downloads the models. Say what a visitor will see. */}
                <p className="sg-body text-[color:var(--sg-ink)]">
                  <strong className="font-bold">{t('privacy.p2.lead')}</strong>{' '}
                  {copy(t('privacy.p2.rest'))}
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
          <div className="sg-container grid gap-3 lg:grid-cols-12 lg:gap-10">
            <h2 id="maker-heading" className="sg-h3 lg:col-span-4">{t('maker.heading')}</h2>
            <div className="max-w-[60ch] lg:col-span-7 lg:col-start-5">
              {/* Lede size: the most human proof on the page was set like a
                  caption beside a small label. */}
              <p className="sg-lede text-[color:var(--sg-ink)]">
                {t('maker.p')}
              </p>
              <p className="mt-4 font-bold">{t('maker.name')}</p>
              <a href={paths.about} className="sg-link mt-1 inline-flex min-h-11 items-center">{t('maker.more')}</a>
            </div>
          </div>
        </section>

        {/* Real quotes only (written in English, so not shown next to a translation); renders nothing while the data file is empty or social_proof is off. */}
        {locale === 'en' && <Testimonials />}

        {/* ── PRICING (shared with /pricing: see PricingSection.tsx) ────── */}
        <div className="bg-[color:var(--sg-plate)] py-20 lg:py-28">
          <div className="sg-container">
            <PricingSection />
          </div>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {/* The same eleven questions and answers, byte-identical to the FAQPage
            JSON-LD in index.html: Google requires the structured data to have
            a visible counterpart, and server.js parses that same block for its
            crawler prose. Any edit here is an edit there. <details> keeps this
            working with no JavaScript at all. */}
        <section id="faq" aria-labelledby="faq-heading" className="py-20 lg:py-28">
          <div className="sg-container grid gap-10 lg:grid-cols-12">
            {/* Heading across the row, list on the same column line (5) as How
                to start, Why this exists and the contact form: in a 4-column
                slot the heading broke into four lines. */}
            <h2 id="faq-heading" className="sg-h2 max-w-[22ch] lg:col-span-12">{t('faq.heading')}</h2>
            <div className="lg:col-span-8 lg:col-start-5">
              {FAQ_NUMBERS.map((n, i) => (
                // The first answer is the definition ("what is Stop Biting"), so it
                // starts open: a reader and a crawler both meet it without a click.
                <details key={n} open={i === 0} className="group mb-3 rounded-3xl bg-[color:var(--sg-plate)] px-6 open:bg-[color:var(--sg-plate)]">
                  <summary className="flex min-h-11 [text-wrap:balance] cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                    {t(`faq.${n}.q`)}
                    <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-[color:var(--sg-ink-2)] transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="sg-body sg-measure pb-6">{faqAnswer(n)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── GUIDES ────────────────────────────────────────────────────── */}
        {/* Back matter: every guide the page links, printed once. */}
        {/* No top padding: it shares the FAQ's background, and both paddings
            together left ~208px of empty page. */}
        <section aria-labelledby="featured-guides-heading" className="pb-20 lg:pb-24">
          <div className="sg-container">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id="featured-guides-heading" className="sg-h2">{t('guides.heading')}</h2>
              <a href="/blog" {...english} className="sg-link inline-flex min-h-11 items-center gap-2">
                {t('guides.all', { count: BLOG_INDEX.length })} <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            {locale !== 'en' && <p className="sg-small mt-3">{t('guides.note')}</p>}
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {START_HERE.map(({ href, key }) => {
                const guide = FEATURED_GUIDES.find(g => g.href === href);
                return (
                  <li key={href}>
                    <a href={href} {...english} className="group block border-t-2 border-[color:var(--sg-ink)] pt-4">
                      <span className="sg-h3 block group-hover:text-[color:var(--sg-accent)] group-hover:underline group-hover:underline-offset-4">{guide && t(guide.key)}</span>
                      <span className="sg-small mt-2 block">{t(key)}</span>
                    </a>
                  </li>
                );
              })}
            </ol>

            {/* Desktop only: on a phone these rows repeated what "All N articles"
                above already offers, after the three featured guides. */}
            <ul className="mt-10 hidden border-t border-[color:var(--sg-rule)] md:grid md:grid-cols-2 md:gap-x-10">
              {FEATURED_GUIDES.filter(g => !START_HERE.some(p => p.href === g.href)).map(({ href, key }) => (
                <li key={href} className="border-b border-[color:var(--sg-rule)]">
                  <a href={href} {...english} className="flex min-h-12 items-center py-2.5 text-[0.9375rem] font-semibold transition-colors hover:text-[color:var(--sg-accent)] hover:underline hover:underline-offset-4">
                    {t(key)}
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
        {/* ── FINAL CTA: last, so the page ends on the offer rather than on
            back matter (guides and the contact form used to follow it) ─────────────────────────────────────────────────── */}
        {/* The one full green field on the page: a mandatory sign, blown up. */}
        <section aria-label={c('cta.aria')} className="sg-band pb-10 lg:pb-14">
          <div className="sg-container">
          <div className="sg-hero sg-dark bite relative flex flex-col items-start gap-8 overflow-hidden p-8 py-14 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:p-16">
            <Rings className="-left-64 -top-64 h-[40rem] w-[40rem]" />
            <div className="relative">
              {/* Display size, like the hero's h1: the page's one full-bleed field
                  is its closing peak, not one more section heading. */}
              <h2 className="sg-h1 max-w-[12ch]">{c.rich('cta.heading', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}</h2>
              <p className="mt-5 max-w-[48ch] text-lg text-white/80">
                {c('cta.body')}
              </p>
            </div>
            <div className="relative flex flex-col items-start gap-3">
              <TrialButton tone="light" source="landing_final" />
              <p className="sg-note whitespace-nowrap">{c('offer.line')}</p>
            </div>
          </div>
          </div>
        </section>

      </main>

      <SiteFooter cta={false} page="home" />
    </div>
  );
}
