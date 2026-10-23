// The React side of the locale state (core.ts has none).

import { useSyncExternalStore } from 'react';
import {
  getLocale, getLocaleVersion, getPreferredLocale, setLocale, subscribeLocale, type Locale,
} from './core.ts';

/** Re-renders the component whenever the language (or the pick) changes. Returns a counter. */
export function useLocaleVersion(): number {
  return useSyncExternalStore(subscribeLocale, getLocaleVersion, getLocaleVersion);
}

export interface UseLocale {
  /** The language the text is in right now. */
  locale: Locale;
  /** What the person picked (may differ while the catalog loads, or when the flag is off). */
  preferred: Locale;
  setLocale: (locale: Locale) => void;
}

/** The active locale, re-rendering on change. Components that only call helper functions which use t() call this too. */
export function useLocale(): UseLocale {
  useLocaleVersion();
  return { locale: getLocale(), preferred: getPreferredLocale(), setLocale };
}
