import { useEffect } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { PageHero } from '../components/site/PageHero';
import { TrialButton } from '../components/site/TrialButton';
import { useFlagCopy } from '../features/useFlagCopy';
import { useLocale } from '../i18n/hooks';
import { useT as useChromeT } from '../i18n/scopes/marketing-chrome';
import { useT as useHowT } from '../i18n/scopes/marketing-how';
import { useSitePaths, useSiteT } from '../i18n/marketing/useSite';

// /how-it-works (and /es/how-it-works, /de/how-it-works, /pt-br/how-it-works, WS12b), in the homepage's sign system (tokens
// in `.sg-page`, see DESIGN.md). The text is in the marketing-how scope. The h1, the standfirst, "Why awareness is the
// bottleneck", the steps and the five questions are mirrored as crawler prose and HowTo/FAQPage schema (server.js for
// English, server/marketing/localePages.js for the other languages): they are made from these same messages.

const STEPS = [1, 2, 3, 4, 5] as const;
const SPECS = [1, 2, 3, 4] as const;
const FAQS = [1, 2, 3, 4, 5] as const;

// Where the "Learn more" links go (English articles; their titles are the same in every language).
const LINKS = [
  { href: '/blog/habit-reversal-training-guide', key: 'link.1' },
  { href: '/blog/stop-biting-app-review', key: 'link.2' },
  { href: '/blog/webcam-privacy-nail-biting-app', key: 'link.3' },
  { href: '/compare/bitter-polish-alternative', key: 'link.4' },
] as const;

export function HowItWorks() {
  useTheme('light');
  const copy = useFlagCopy();   // the log row and one answer change when sync is on (English); unchanged otherwise
  const t = useSiteT(useHowT);
  const c = useSiteT(useChromeT);
  const paths = useSitePaths();
  const { locale } = useLocale();
  // The articles are English only: on a localized page the links say so.
  const english = locale === 'en' ? {} : { lang: 'en' };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader page="how" />

      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <PageHero className="mb-14">
        <nav aria-label={c('bc.label')} className="sg-note mb-8 flex items-center gap-2">
          <a href={paths.home} className="hover:text-[color:var(--sg-ink)]">{c('bc.home')}</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">{t('bc.how')}</span>
        </nav>

        <header className="max-w-3xl">
          <h1 className="sg-h1-md">{t.rich('hero.title', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}</h1>
          <p className="sg-lede sg-measure mt-5">
            {t('hero.lede')}
          </p>
        </header>
        </PageHero>

        {/* A real capture of the app (public/shots), the same one and the same
            alt/caption as the landing page; mirrored in server.js. */}
        <figure className="mt-10 max-w-3xl">
          <img
            src="/shots/app-watch-1280.webp"
            srcSet="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w"
            sizes="(min-width: 1024px) 48rem, 100vw"
            width={1280}
            height={792}
            loading="lazy"
            decoding="async"
            alt={t('figure.alt')}
            className="w-full h-auto rounded-lg border border-[color:var(--sg-rule)]"
          />
          <figcaption className="sg-note mt-2">
            {t('figure.caption')}
          </figcaption>
        </figure>

        <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="awareness-heading" className="lg:col-span-4">
            <h2 id="awareness-heading" className="sg-h3">{t('why.heading')}</h2>
            <p className="sg-body mt-3">
              {t.rich('why.body', undefined, {
                link: chunks => <a href="/blog/habit-reversal-training-guide" {...english} className="sg-link">{chunks}</a>,
              })}
            </p>
          </section>

          <section aria-labelledby="steps-heading" className="lg:col-span-7 lg:col-start-6">
            <h2 id="steps-heading" className="sg-h3">{t('steps.heading')}</h2>
            <ol className="mt-4 list-decimal space-y-5 border-t border-[color:var(--sg-rule)] pt-5 pl-5 marker:font-extrabold marker:text-[color:var(--sg-ink)]">
              {STEPS.map(n => (
                <li key={n} className="pl-2">
                  <p className="font-bold">{t(`step.${n}.title`)}</p>
                  <p className="sg-body mt-1">{t(`step.${n}.body`)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section aria-labelledby="specs-heading" className="mt-20">
          <h2 id="specs-heading" className="sg-h3">{t('specs.heading')}</h2>
          <dl className="mt-4 border-t border-[color:var(--sg-rule)]">
            {SPECS.map(n => (
              <div key={n} className="grid gap-1 border-b border-[color:var(--sg-rule)] py-4 sm:grid-cols-12 sm:gap-10">
                <dt className="font-bold sm:col-span-4">{t(`spec.${n}.label`)}</dt>
                <dd className="sg-body sm:col-span-8">{copy(t(`spec.${n}.value`))}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-20 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="hiw-faq-heading" className="lg:col-span-7">
            <h2 id="hiw-faq-heading" className="sg-h3">{t('faq.heading')}</h2>
            <div className="mt-4 border-t border-[color:var(--sg-rule)]">
              {FAQS.map(n => (
                <details key={n} className="group border-b border-[color:var(--sg-rule)]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                    {t(`faq.${n}.q`)}
                    <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-[color:var(--sg-ink-2)] transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="sg-body pb-5">{copy(t(`faq.${n}.a`))}</p>
                </details>
              ))}
            </div>
          </section>

          <section aria-labelledby="learn-heading" className="lg:col-span-4 lg:col-start-9">
            <h2 id="learn-heading" className="sg-h3">{t('learn.heading')}</h2>
            {locale !== 'en' && <p className="sg-small mt-2">{t('learn.note')}</p>}
            <ul className="mt-4 border-t border-[color:var(--sg-rule)]">
              {LINKS.map(link => (
                <li key={link.href} className="border-b border-[color:var(--sg-rule)]">
                  <a href={link.href} {...english} className="group flex min-h-12 items-center justify-between gap-4 py-3 font-semibold hover:text-[color:var(--sg-accent)]">
                    <span className="group-hover:underline group-hover:underline-offset-4">{t(link.key)}</span>
                    <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-20 flex flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">{c('bottom.heading')}</p>
            <p className="sg-small mt-1">{c('bottom.note')}</p>
          </div>
          <TrialButton source="how_it_works" />
        </div>
      </main>

      <SiteFooter page="how" />
    </div>
  );
}
