import { useEffect } from 'react';
import { didSiteLocaleLoadFail, setPageLocale } from '../i18n/core';
import { useLocale } from '../i18n/hooks';
import type { SiteLocale, SitePage } from '../i18n/marketing/routes';
import { useTheme } from '../hooks/useTheme';
import { Landing } from './Landing';
import { HowItWorks } from './HowItWorks';
import { About } from './About';
import { PricingPage } from './PricingPage';

// One of the four core marketing pages in another language (WS12b): /es, /es/how-it-works, /es/pricing, /es/about, and
// the same under /de and /pt-br. App.tsx renders this for those addresses; the server serves the address only while
// the locale's flag is on (server/marketing/localePages.js), so by the time this runs the language was decided by the
// address the person opened. It is never taken from the browser's language and never stored.
//
// The page renders after the marketing catalog of its language has arrived, so there is no flash of English: until
// then the server's crawler copy (hidden by the `js` class) is all there is, exactly like a blog post. If the
// catalog cannot be fetched (offline) the page shows in English rather than not at all.
//
// It is rendered bare, outside AuthProvider: a signed-in visitor who opens /es sees the page they asked for, not the
// dashboard (the English home page is the app's own entry; the localized one is only a landing page).
export function LocalizedSite({ locale, page }: { locale: SiteLocale; page: SitePage }) {
  useTheme('light');
  useEffect(() => {
    setPageLocale(locale);
    return () => setPageLocale(null);
  }, [locale]);
  const { locale: showing } = useLocale();
  if (showing !== locale && !didSiteLocaleLoadFail(locale)) return null;
  switch (page) {
    case 'how': return <HowItWorks />;
    case 'pricing': return <PricingPage />;
    case 'about': return <About />;
    default: return <Landing />;
  }
}
