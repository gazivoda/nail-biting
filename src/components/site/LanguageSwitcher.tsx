import { Globe } from 'lucide-react';
import { LOCALE_INFO, type Locale } from '../../i18n/core';
import { useLocale } from '../../i18n/hooks';
import { readLocaleMarker } from '../../i18n/marketing/localeMarker';
import { HREFLANG, isLocalizedPage, pagePath, type SitePage } from '../../i18n/marketing/routes';
import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
import { kv } from '../../storage/kv';

// The language switcher of the marketing site (WS12b). It is drawn only while the server says at least one locale is
// being served (src/i18n/marketing/localeMarker.ts) and only on a page that exists in the other languages (home, how it
// works, pricing, about). Each link goes to the SAME page in that language, never to the home page.
//
// It never changes the language by itself: a language is chosen by the person (this click) or by the address they
// opened. Clicking also keeps the pick that Settings > Language reads (kv i18n/locale) in step, so the signed-in app
// follows the choice. It is a plain link: no script is needed for it to work, and a crawler follows it.

function remember(locale: Locale) {
  try { kv.set('i18n', 'locale', locale); } catch { /* storage refused: the link still works */ }
}

type Variant = 'header' | 'footer';

export function LanguageSwitcher({ page, variant }: { page?: SitePage; variant: Variant }) {
  const t = useChromeT();
  const { locale } = useLocale();
  const offered = readLocaleMarker();
  if (!page || !isLocalizedPage(page) || offered.length === 0) return null;

  const all: Locale[] = ['en', ...offered];
  const links = all.map(l => {
    const current = l === locale;
    const name = LOCALE_INFO[l].native;
    return current ? (
      <span key={l} lang={HREFLANG[l]} aria-current="true" className="font-bold text-[color:var(--sg-ink)]">{name}</span>
    ) : (
      <a
        key={l}
        href={pagePath(l, page)}
        hrefLang={HREFLANG[l]}
        lang={HREFLANG[l]}
        onClick={() => remember(l)}
        className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)] hover:underline hover:underline-offset-4"
      >
        {name}
      </a>
    );
  });

  if (variant === 'footer') {
    return (
      <nav aria-label={t('lang.label')} className="sg-small mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="inline-flex items-center gap-2 font-semibold"><Globe size={15} aria-hidden="true" />{t('lang.label')}</span>
        {links}
      </nav>
    );
  }

  const short = HREFLANG[locale].split('-')[0].toUpperCase();
  return (
    <details className="group relative hidden lg:block">
      <summary
        aria-label={t('lang.label')}
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] marker:content-none hover:text-[color:var(--sg-ink)] [&::-webkit-details-marker]:hidden"
      >
        <Globe size={16} aria-hidden="true" />
        {short}
      </summary>
      <div className="absolute right-0 top-full z-[60] mt-1 flex min-w-40 flex-col gap-0.5 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-2 text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] shadow-lg">
        {links}
      </div>
    </details>
  );
}
