// Catalog parity for the MARKETING scopes (WS12b), the same checks catalogs.test.ts makes for the app: every locale has
// every key, with the same placeholders, plural forms the language needs, rich tags and edge whitespace; the machine
// drafts say so. One difference: placeholders from the shared bag (src/i18n/marketing/bag.ts) may differ between
// languages on purpose. English spells the trial length with {trialHyphen} and prints "$2.99"; German writes
// {trialDays, plural, ...} and {pMonthly}. Everything else must match.
//
// And the English source is pinned where another file says the same thing: the plan lines the paywall shows, the share
// sheet text, the prices the English copy prints.

import { describe, it, expect } from 'vitest';
import { SITE_SCOPES, META_SCOPES, type SiteScopeName, type MetaScopeName } from '../scopes/site';
import { catalog as esSite } from '../locales/es/site';
import { catalog as deSite } from '../locales/de/site';
import { catalog as ptSite } from '../locales/pt-BR/site';
import { catalog as esMeta } from '../locales/es/meta';
import { catalog as deMeta } from '../locales/de/meta';
import { catalog as ptMeta } from '../locales/pt-BR/meta';
import { reviewed as esReviewed } from '../locales/es/reviewed';
import { reviewed as deReviewed } from '../locales/de/reviewed';
import { reviewed as ptReviewed } from '../locales/pt-BR/reviewed';
import { catalog as esApp } from '../locales/es';
import { catalog as deApp } from '../locales/de';
import { catalog as ptApp } from '../locales/pt-BR';
import { messages as billingEn } from '../scopes/billing';
import { messages as shellEn } from '../scopes/shell';
import { messages as chromeEn } from '../scopes/marketing-chrome';
import { LOCALE_INFO } from '../core';
import { assertParses, inspectMessage, pluralCategoriesOf } from '../message';
import { BAG_NAMES, LIST_PRICES, formatSavePercent, formatUsd } from './bag';
import { PLAN_FEATURES, YEARLY_EXTRA } from '../../components/site/plans';

const LOCALES = [
  { code: 'es', site: esSite, meta: esMeta, app: esApp, reviewed: esReviewed },
  { code: 'de', site: deSite, meta: deMeta, app: deApp, reviewed: deReviewed },
  { code: 'pt-BR', site: ptSite, meta: ptMeta, app: ptApp, reviewed: ptReviewed },
] as const;

type Cat = Record<string, Record<string, string>>;
const english = (group: Record<string, { messages: unknown }>, scope: string) => group[scope].messages as Record<string, string>;
const bag = new Set(BAG_NAMES);
const withoutBag = (placeholders: Record<string, string>) => Object.fromEntries(Object.entries(placeholders).filter(([name]) => !bag.has(name)));
const edgeSpace = (s: string) => [/^\s/.test(s), /\s$/.test(s)];

const groups = [
  { label: 'site', scopes: SITE_SCOPES as unknown as Record<string, { messages: unknown }>, names: Object.keys(SITE_SCOPES) as SiteScopeName[], pick: (l: (typeof LOCALES)[number]) => l.site as unknown as Cat },
  { label: 'meta', scopes: META_SCOPES as unknown as Record<string, { messages: unknown }>, names: Object.keys(META_SCOPES) as MetaScopeName[], pick: (l: (typeof LOCALES)[number]) => l.meta as unknown as Cat },
];

describe('English marketing source', () => {
  for (const g of groups) {
    it.each(g.names)(`${g.label} scope %s: no empty message, every message parses`, scope => {
      for (const [key, text] of Object.entries(english(g.scopes, scope))) {
        expect(text.trim().length, `${scope}.${key} is empty`).toBeGreaterThan(0);
        expect(() => assertParses(text), `${scope}.${key}`).not.toThrow();
      }
    });
  }

  it('a message depends on at most one optional feature (sync or phone)', () => {
    for (const g of groups) {
      for (const scope of g.names) {
        for (const [key, text] of Object.entries(english(g.scopes, scope))) {
          const used = inspectMessage(text).placeholders;
          expect(['sync', 'phone'].filter(n => n in used).length, `${scope}.${key}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('the four plan lines are exactly the ones the in-app paywall uses (site/plans.ts)', () => {
    expect([chromeEn['plan.f1'], chromeEn['plan.f2'], chromeEn['plan.f3'], chromeEn['plan.f4']]).toEqual(PLAN_FEATURES);
    expect(chromeEn['plan.extra']).toBe(YEARLY_EXTRA);
  });

  it('the share sheet text is the one the phone link has always used', () => {
    expect(chromeEn['trial.mailSubject']).toBe(shellEn['share.title']);
    expect(chromeEn['trial.shareText']).toBe(shellEn['share.text']);
  });

  it('the list prices formatted for English are the figures the English pages print', () => {
    expect(formatUsd('en', LIST_PRICES.monthly)).toBe('$2.99');
    expect(formatUsd('en', LIST_PRICES.yearly)).toBe('$29.00');
    expect(formatUsd('en', LIST_PRICES.yearly, 0)).toBe('$29');
    expect(formatUsd('en', LIST_PRICES.yearlyPerMonth)).toBe('$2.42');
    expect(formatSavePercent('en')).toBe('19%');
    // and the English messages that print them literally agree
    expect(chromeEn['pricing.heading']).toContain('$2.99 a month, or <mark>$29 a year.</mark>');
    expect(chromeEn['pricing.yearly.eq']).toContain('$2.42/month');
    expect(billingEn['paywall.badge.save']).toContain('19%');
  });
});

describe.each(LOCALES)('locale $code, marketing', ({ code, reviewed, app, ...rest }) => {
  const tag = LOCALE_INFO[code].tag;
  const valid = new Set(pluralCategoriesOf(tag));
  const required = [...valid].filter(c => c !== 'many' && c !== 'other');
  const locale = { code, reviewed, app, ...rest } as (typeof LOCALES)[number];

  for (const g of groups) {
    const cat = g.pick(locale);

    it(`${g.label}: has every scope`, () => {
      expect(Object.keys(cat).sort()).toEqual([...g.names].sort());
    });

    it.each(g.names)(`${g.label} scope %s: same keys as English, none empty`, scope => {
      const en = english(g.scopes, scope);
      const tr = cat[scope] ?? {};
      expect(Object.keys(tr).sort(), `keys of ${code}/${scope}`).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(tr)) {
        expect(text.trim().length, `${scope}.${key} is empty`).toBeGreaterThan(0);
      }
    });

    it.each(g.names)(`${g.label} scope %s: placeholders, plural forms, tags and edges match English`, scope => {
      const en = english(g.scopes, scope);
      const tr = cat[scope] ?? {};
      for (const [key, enText] of Object.entries(en)) {
        const trText = tr[key];
        if (trText === undefined) continue;
        const where = `${code}/${scope}.${key}`;
        expect(() => assertParses(trText), `${where} does not parse: ${trText}`).not.toThrow();
        const a = inspectMessage(enText);
        const b = inspectMessage(trText);
        expect(withoutBag(b.placeholders), `${where} placeholders`).toEqual(withoutBag(a.placeholders));
        expect(b.tags, `${where} tags`).toEqual(a.tags);
        if (a.pluralKeys.length > 0 || b.pluralKeys.length > 0) {
          expect(b.pluralKeys, `${where} plural forms`).toContain('other');
          for (const k of b.pluralKeys) {
            expect(valid.has(k as never) || /^=\d+$/.test(k), `${where}: "${k}" is not a plural category of ${code}`).toBe(true);
          }
          for (const c of required) expect(b.pluralKeys, `${where}: ${code} needs a "${c}" form`).toContain(c);
        }
        // a message that chooses by sync/phone must choose the same way in every language
        for (const feature of ['sync', 'phone']) {
          if (feature in a.placeholders) expect(b.placeholders[feature], `${where} ${feature}`).toBe(a.placeholders[feature]);
        }
        expect(edgeSpace(trText), `${where} leading/trailing space`).toEqual(edgeSpace(enText));
      }
    });
  }

  it('is mostly translated (not copied from English)', () => {
    let same = 0;
    let total = 0;
    const samples: string[] = [];
    for (const g of groups) {
      const cat = g.pick(locale);
      for (const scope of g.names) {
        if (scope === 'plans') continue;   // the app's own file, checked by catalogs.test.ts
        for (const [key, text] of Object.entries(english(g.scopes, scope))) {
          total += 1;
          if (cat[scope]?.[key] === text && /[A-Za-z]{4,}/.test(text)) { same += 1; if (samples.length < 8) samples.push(`${scope}.${key}`); }
        }
      }
    }
    expect(same / total, `identical to English: ${samples.join(', ')}`).toBeLessThan(0.1);
  });

  it('uses the terms the app uses (plan lines are the paywall\'s, word for word)', () => {
    const appBilling = (app as unknown as Cat).billing;
    const chrome = (locale.site as unknown as Cat)['marketing-chrome'];
    expect(chrome['plan.f1']).toBe(appBilling['feature.detection']);
    expect(chrome['plan.f2']).toBe(appBilling['feature.streak']);
    expect(chrome['plan.f3']).toBe(appBilling['feature.history']);
    expect(chrome['plan.f4']).toBe(appBilling['feature.alert']);
    expect(chrome['plan.extra']).toBe(appBilling['feature.support']);
    expect(chrome['pricing.yearly']).toBe(appBilling['paywall.yearly']);
    expect(chrome['pricing.monthly']).toBe(appBilling['paywall.monthly']);
    expect(chrome['pricing.perYear']).toBe(appBilling['paywall.perYear']);
    expect(chrome['pricing.perMonth']).toBe(appBilling['paywall.perMonth']);
    expect(chrome['pricing.yearly.billed']).toBe(appBilling['paywall.billedYearly']);
    expect(chrome['pricing.monthly.billed']).toBe(appBilling['paywall.billedMonthly']);
    expect(chrome['pricing.badge.localized']).toBe(appBilling['paywall.badge.localized']);
    const appShell = (app as unknown as Cat).shell;
    expect(chrome['trial.mailSubject']).toBe(appShell['share.title']);
    expect(chrome['trial.shareText']).toBe(appShell['share.text']);
  });

  it('is marked as a machine draft until a native speaker has reviewed it (one marker for the app and the marketing pages)', () => {
    expect(typeof reviewed).toBe('boolean');
    expect(reviewed, `${code}: only flip reviewed to true after a native review of src/i18n/locales/${code}/*.ts`).toBe(false);
  });
});

describe('the marketing locale files carry the review header', () => {
  const raw = import.meta.glob('../locales/*/{marketing-*,site,meta,reviewed}.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('every marketing locale file starts with NEEDS NATIVE REVIEW', () => {
    const files = Object.keys(raw);
    expect(files.length).toBeGreaterThanOrEqual(3 * 5);
    for (const file of files) expect(raw[file].split('\n')[0], file).toMatch(/NEEDS NATIVE REVIEW/);
  });

  it('reviewed.ts of each locale exports reviewed = false', () => {
    for (const code of ['es', 'de', 'pt-BR']) {
      expect(raw[`../locales/${code}/reviewed.ts`], code).toMatch(/export const reviewed = false;/);
    }
  });
});
