// Test helpers for the pseudo-locale coverage tests. Test-only: nothing in the app imports this folder.
//
//   describe('Log', () => {
//     usePseudoLocale();                       // German catalog on, every t() result wrapped in ⟦ ⟧, memory storage
//     it('has no English left', () => {
//       const html = renderToStaticMarkup(<Log onGoToWatch={() => {}} />);
//       expectAllTranslated(html, { allow: ['Commute'] });   // allow: words a test put in its own fixtures
//     });
//   });
//
// The German catalog is the real one (src/i18n/locales/de), so a message missing from it shows up as English
// inside the marks: that is for catalogs.test.ts to catch. This catches English that never went through t().

import { beforeEach, afterEach, expect } from 'vitest';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { kv } from '../../storage/kv';
import { resetFlagsForTests } from '../../features/flags';
import { installCatalogForTests, resetLocaleForTests, setAllowedLocales, setLocale, setOutputTransformForTests } from '../core';
import { catalog } from '../locales/de';
import { describeLeaks, findUnmarkedEnglish, mark, type ScanOptions } from './scan';

/** Registers beforeEach/afterEach that put the app in German with marked output, on fresh in-memory storage. */
export function usePseudoLocale(options: { flags?: string[] } = {}): void {
  beforeEach(() => {
    useMemoryStorage();
    setFlags(...(options.flags ?? []));
    resetLocaleForTests();
    installCatalogForTests('de', { reviewed: true, catalog });
    setLocale('de');
    setAllowedLocales(['de']);
    setOutputTransformForTests(mark);
  });
  afterEach(() => {
    setOutputTransformForTests(null);
    resetLocaleForTests();
    resetStorage();
    resetFlagsForTests();
  });
}

/** Turns exactly these feature flags on (as the last answer from the server). */
export function setFlags(...on: string[]): void {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map(n => [n, true])) });
  resetFlagsForTests();
}

/** Asserts every word in the HTML came out of t() (or is on the allow list). */
export function expectAllTranslated(html: string, options: ScanOptions = {}): void {
  const leaks = findUnmarkedEnglish(html, options);
  expect(leaks.length, describeLeaks(leaks)).toBe(0);
  // and the pseudo-locale really was on: something was marked
  expect(html, 'nothing was marked: the pseudo-locale was not active').toContain('⟦');
}

/** Asserts the HTML has no `{placeholder}` left over from a missing parameter. */
export function expectNoMissingParams(html: string): void {
  expect(html.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) ?? [], 'a message was rendered without one of its parameters').toEqual([]);
}
