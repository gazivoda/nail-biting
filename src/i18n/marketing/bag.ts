// The values every marketing message may refer to (WS12b). Pure TypeScript: the browser, the build script that
// writes dist/i18n/<locale>.json and the tests all build the bag with the same function, so a page, its
// server-rendered copy and its structured data say the same numbers.
//
//   {trialDays, plural, one {# día} other {# días}}   the trial length, as a number (TRIAL_DAYS in shared/plans.js)
//   {trialHyphen} {trialDaysText} {trialWordsCap}      the English spellings (shared/plans.js): only the English
//                                                      messages use them, so English output is what it always was
//   {pMonthly} {pYearly} {pYearlyShort} {pMonthlyEq}   the USD prices written the way the language writes money
//   {pSave}                                            the yearly saving as a percentage
//   {sync, select, on {..} other {..}}                 whether the optional history sync (event_sync) is on
//   {phone, select, on {..} other {..}}                whether the phone companion (phone_companion) is on
//   {methods}                                          "Google" or "Google, Apple or an emailed link", in the language
//   {homeUrl}                                          the address of the home page in this language
//
// The list prices are the ones the English copy has always printed ($2.99 a month, $29.00 a year, about $2.42 a
// month, a saving of 19 percent). They are not computed from Paddle: the localized price of regional_pricing is
// drawn by PricingSection itself. A test pins that these figures, formatted for English, are the strings the
// English pages contain.

import { TRIAL_COPY, TRIAL_DAYS } from '../../../shared/plans.js';
import { LOCALE_INFO, type Locale } from '../core.ts';
import { pageUrl } from './routes.ts';

export const LIST_PRICES = { monthly: 2.99, yearly: 29, yearlyPerMonth: 2.42, savePercent: 19 } as const;

/** The placeholder names that belong to the bag. Catalog parity ignores them (a locale may spell the trial length differently). */
export const BAG_NAMES: readonly string[] = [
  'trialDays', 'trialHyphen', 'trialDaysText', 'trialWordsCap',
  'pMonthly', 'pYearly', 'pYearlyShort', 'pMonthlyEq', 'pSave',
  'sync', 'phone', 'methods', 'homeUrl',
];

export interface BagInput {
  locale: Locale;
  /** The optional history sync is on (flag event_sync). */
  sync?: boolean;
  /** The phone companion is on (flag phone_companion). */
  phone?: boolean;
  /** The sign-in methods written out, in the language of the page. Defaults to "Google". */
  methods?: string;
  trialDays?: number;
}

const money = new Map<string, Intl.NumberFormat>();
function usd(tag: string, digits: 0 | 2): Intl.NumberFormat {
  const key = `${tag}|${digits}`;
  let f = money.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });
    money.set(key, f);
  }
  return f;
}

/** USD in a language's own style: "$2.99" (en), "2,99 US$" (es), "2,99 $" (de), "US$ 2,99" (pt-BR). */
export function formatUsd(tag: string, amount: number, digits: 0 | 2 = 2): string {
  return usd(tag, digits).format(amount);
}

export function formatSavePercent(tag: string, percent: number = LIST_PRICES.savePercent): string {
  return new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100);
}

export function siteBag({ locale, sync = false, phone = false, methods = 'Google', trialDays = TRIAL_DAYS }: BagInput): Record<string, string | number> {
  const tag = LOCALE_INFO[locale].tag;
  return {
    trialDays,
    trialHyphen: TRIAL_COPY.TRIAL_HYPHEN,
    trialDaysText: TRIAL_COPY.TRIAL_DAYS_TEXT,
    trialWordsCap: TRIAL_COPY.TRIAL_WORDS_CAP,
    pMonthly: formatUsd(tag, LIST_PRICES.monthly),
    pYearly: formatUsd(tag, LIST_PRICES.yearly),
    pYearlyShort: formatUsd(tag, LIST_PRICES.yearly, 0),
    pMonthlyEq: formatUsd(tag, LIST_PRICES.yearlyPerMonth),
    pSave: formatSavePercent(tag),
    sync: sync ? 'on' : 'off',
    phone: phone ? 'on' : 'off',
    methods,
    homeUrl: pageUrl(locale, 'home'),
  };
}
