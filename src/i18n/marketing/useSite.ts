// How a marketing component reads its text and its addresses (WS12b).
//
//   import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
//   const t = useSiteT(useChromeT);              // t('offer.line'), t.rich('footer.about', {}, { link: ... })
//   const paths = useSitePaths();                // paths.pricing is '/pricing' or '/es/pricing'
//
// useSiteT hands every message the bag of shared values (the trial length, the prices written for the language, whether
// the optional sync and the phone companion are on, the sign-in methods) so a component names only the message. English
// messages ignore the values they do not use; see src/i18n/marketing/bag.ts.
//
// Marketing pages never import the storage module or the store (the demo must never touch them); everything here reads
// the page through ../../features/useFlagCopy (the marker the server wrote) and ../core.

import { useMemo, type ReactNode } from 'react';
import { useLocale } from '../hooks';
import { LOCALE_INFO } from '../core';
import type { Params } from '../message';
import type { RichTags } from '../scope';
import { useFlagIsOn } from '../../features/useFlagCopy';
import { useT as useChromeT } from '../scopes/marketing-chrome';
import { siteBag } from './bag';
import { methodsText, type MethodNames } from './signin';
import { pagePath, type SitePage } from './routes';

export type ScopeFn<K extends string> = {
  (key: K, params?: Params): string;
  rich(key: K, params: Params | undefined, tags: RichTags): ReactNode;
};

/** The values the pages' messages share, for the language on screen and the flags the page was served with. */
export function useSiteBag(): Params {
  const { locale } = useLocale();
  const isOn = useFlagIsOn();
  const chrome = useChromeT();
  const sync = isOn('event_sync');
  const phone = isOn('phone_companion');
  const apple = isOn('signin_apple');
  const microsoft = isOn('signin_microsoft');
  const magic = isOn('signin_magic_link');
  return useMemo(() => {
    const names: MethodNames = {
      google: chrome('signin.google'), apple: chrome('signin.apple'),
      microsoft: chrome('signin.microsoft'), magic: chrome('signin.magic'),
    };
    const on = (flag: string) => ({ signin_apple: apple, signin_microsoft: microsoft, signin_magic_link: magic } as Record<string, boolean>)[flag] ?? false;
    // English keeps "Google" in the message: shared/flagCopy.js (copy()) rewrites English when another method is on.
    const methods = locale === 'en' ? 'Google' : methodsText(LOCALE_INFO[locale].tag, names, on);
    return siteBag({ locale, sync, phone, methods });
  }, [locale, sync, phone, apple, microsoft, magic, chrome]);
}

/** A scope's `t` that fills in the shared bag. Pass the scope's own `useT`. */
export function useSiteT<K extends string>(useScopeT: () => ScopeFn<K>): ScopeFn<K> {
  const t = useScopeT();
  const bag = useSiteBag();
  return useMemo(
    () => Object.assign(
      (key: K, params?: Params) => t(key, { ...bag, ...params }),
      { rich: (key: K, params: Params | undefined, tags: RichTags) => t.rich(key, { ...bag, ...params }, tags) },
    ),
    [t, bag],
  );
}

/** The addresses of the four localized pages in the language on screen. */
export function useSitePaths(): Record<SitePage, string> & { locale: string } {
  const { locale } = useLocale();
  return useMemo(() => ({
    locale,
    home: pagePath(locale, 'home'),
    how: pagePath(locale, 'how'),
    pricing: pagePath(locale, 'pricing'),
    about: pagePath(locale, 'about'),
  }), [locale]);
}
