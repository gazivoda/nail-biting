import { useMemo } from 'react';
import { ClosingCta } from './ClosingCta';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Rings } from './Rings';
import { readGatedLinks } from '../../features/gatedLinks';
import { useLocale } from '../../i18n/hooks';
import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
import { useSitePaths } from '../../i18n/marketing/useSite';
import type { SitePage } from '../../i18n/marketing/routes';

// The site footer for every page in the sign system. Must sit inside a `.sg-page`.
// Marketing pages also get the closing call to action above it; the homepage
// renders its own, so it passes cta={false}.
// `page` names which of the four localized pages this is (WS12b), for the language switcher.
export function SiteFooter({ cta = true, ctaSource, page }: { cta?: boolean; ctaSource?: string; page?: SitePage } = {}) {
  const t = useChromeT();
  const paths = useSitePaths();
  const { locale } = useLocale();
  // The blog and the legal pages exist only in English: on a localized page those links say so (hreflang) and a line below says it.
  const english = locale === 'en' ? {} : { hrefLang: 'en' };
  // Pages that exist only while their feature flag is on (/features/..., see src/features/gatedLinks.ts): the server lists the
  // open ones in the page it sent, so there is no link while a page is closed and no request to find out. They are English
  // only, like the blog, so a localized footer does not carry them.
  const gatedLinks = useMemo(() => (locale === 'en' ? readGatedLinks() : []), [locale]);
  return (
    <>
    {cta && <ClosingCta source={ctaSource} />}
    <footer className="sg-dark relative overflow-hidden rounded-t-[3rem] bg-[color:var(--sg-deep)] pb-10 pt-14">
      <Rings className="-bottom-80 -left-40 h-[44rem] w-[44rem]" />
      <div className="sg-container relative">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/logo-dark.svg" alt="" className="h-8 w-8 flex-shrink-0" />
              <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Stop Biting</span>
            </div>
            <p className="sg-small mt-4">
              {t.rich('footer.about', undefined, { link: chunks => <a href={paths.about} className="sg-link">{chunks}</a> })}
            </p>
            <LanguageSwitcher page={page} variant="footer" />
            {locale !== 'en' && <p className="sg-small mt-3">{t('footer.englishOnly')}</p>}
          </div>
          {/* Written out one by one: these eight hrefs are the site's fixed
              legal and navigational surface, and spelling them as real
              attributes keeps them greppable. The links after them are the
              feature pages that are open right now, from the server. */}
          <nav aria-label={t('footer.nav')} className="grid grid-cols-2 gap-x-10 text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)]">
            <a href={paths.home} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.home')}</a>
            <a href="/blog" {...english} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.blog')}</a>
            <a href={`${paths.home}#pricing`} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.pricing')}</a>
            <a href="mailto:hello@stopbiting.today" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.contact')}</a>
            <a href="/editorial-policy" {...english} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.editorial')}</a>
            <a href="/privacy" {...english} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.privacy')}</a>
            <a href="/terms-and-conditions" {...english} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.terms')}</a>
            <a href="/refund-policy" {...english} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{t('footer.refund')}</a>
            {gatedLinks.map(({ href, label }) => (
              <a key={href} href={href} className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">{label}</a>
            ))}
          </nav>
        </div>
        <p aria-hidden="true" className="mt-12 select-none font-display text-[clamp(3.5rem,13vw,11rem)] font-extrabold leading-[0.85] tracking-[-0.06em] text-[color:var(--c-signal)]">{t('footer.tagline')}</p>
        <p className="sg-small mt-10 border-t border-[color:var(--sg-rule)] pt-6">
          {t('footer.copy', { year: new Date().getFullYear() })}{' '}
          <a href="https://stopbiting.today/" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">stopbiting.today</a>{/* i18n-ignore: the site's own address, not copy */}
        </p>
      </div>
    </footer>
    </>
  );
}
