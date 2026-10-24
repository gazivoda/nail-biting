// Mounted once in the signed-in app (App.tsx), on the sign-in page and on the gift page.
// Renders nothing. It is the only place that connects the language to the feature flags
// (core.ts deliberately does not read them):
//
//   * nothing picked (the usual case): returns null at once. No flag is read, no request is made,
//     no catalog is fetched, the page is exactly what it was before WS12a;
//   * a language picked: reads the flags (the app asks the server for them anyway) and tells the core
//     which languages are allowed. A language whose flag is off is never used, even if it was picked
//     when the flag was on.
//
// Marketing pages never mount it, so they stay English with an English <html lang>.

import { useEffect } from 'react';
import { useFeatures } from '../features/useFeature';
import './persist';
import { LOCALES, LOCALE_INFO, setAllowedLocales, type Locale } from './core';
import { useLocale } from './hooks';

function AllowedByFlags() {
  const flags = useFeatures();
  useEffect(() => {
    const allowed: Locale[] = LOCALES.filter(l => {
      const flag = LOCALE_INFO[l].flag;
      return flag === null || flags[flag] === true;
    });
    setAllowedLocales(allowed);
  }, [flags]);
  // Back to English when the app section goes away (sign-out) or the person picked English.
  useEffect(() => () => setAllowedLocales([]), []);
  return null;
}

export function LocaleHost() {
  const { preferred } = useLocale();
  if (preferred === 'en') return null;
  return <AllowedByFlags />;
}
