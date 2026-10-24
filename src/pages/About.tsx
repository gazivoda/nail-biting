import { useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { PageHero } from '../components/site/PageHero';
import { TrialButton } from '../components/site/TrialButton';
import { useFlagCopy } from '../features/useFlagCopy';
import { useT as useChromeT } from '../i18n/scopes/marketing-chrome';
import { useT as useAboutT } from '../i18n/scopes/marketing-about';
import { useSitePaths, useSiteT } from '../i18n/marketing/useSite';

// /about (and /es/about, /de/about, /pt-br/about, WS12b). The text is in the marketing-about scope; the server renders the
// same words as the crawler copy (server.js for English, server/marketing/localePages.js for the other languages).
export function About() {
  useTheme('light');
  const copy = useFlagCopy();   // the log sentence changes when sync is on (English); unchanged otherwise
  const t = useSiteT(useAboutT);
  const c = useSiteT(useChromeT);
  const paths = useSitePaths();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      <SiteHeader page="about" />

      <main id="main" className="sg-container max-w-4xl pt-28 pb-20 lg:pt-32">

        <PageHero className="mb-14">
        {/* Breadcrumb */}
        <nav aria-label={c('bc.label')} className="sg-note mb-8 flex items-center gap-2">
          <a href={paths.home} className="hover:text-[color:var(--sg-ink)]">{c('bc.home')}</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">{t('bc.about')}</span>
        </nav>

        <header>
          <h1 className="sg-h1-md">
            {t.rich('hero.title', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}
          </h1>
          <p className="sg-lede sg-measure mt-5">
            {t('hero.lede')}
          </p>
        </header>
        </PageHero>

        {/* Founder story */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">{t('story.heading')}</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>{t('story.p1')}</p>
            <p>{t('story.p2')}</p>
            <p>{t('story.p3')}</p>
            <p>{t('story.p4')}</p>
          </div>
        </section>

        {/* What the app does */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">{t('does.heading')}</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>{t('does.p1')}</p>
            <p>{t('does.p2')}</p>
            <p>{t('does.p3')}</p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">{t('privacy.heading')}</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>{t('privacy.p1')}</p>
            <p>{t('privacy.p2')}</p>
            <p>{copy(t('privacy.p3'))}</p>
          </div>
        </section>

        {/* The technology */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">{t('tech.heading')}</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              {t.rich('tech.p1', undefined, {
                link: chunks => (
                  <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker" target="_blank" rel="noopener noreferrer" className="sg-link">
                    {chunks}
                  </a>
                ),
              })}
            </p>
            <p>{t('tech.p2')}</p>
          </div>
        </section>

        {/* How this site is written — keep in step with the /about SSR copy in server.js */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">{t('site.heading')}</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              {t.rich('site.p1', undefined, {
                link: chunks => (
                  <a href="/editorial-policy" className="sg-link">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </section>

        <div className="mt-16 flex flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">{c('bottom.heading')}</p>
            <p className="sg-small mt-1">{c('bottom.note')}</p>
          </div>
          <TrialButton source="about" />
        </div>
      </main>

      <SiteFooter page="about" />
    </div>
  );
}
