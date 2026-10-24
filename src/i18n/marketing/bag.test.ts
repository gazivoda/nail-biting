import { describe, it, expect } from 'vitest';
import { BAG_NAMES, siteBag } from './bag';
import { TRIAL_COPY, TRIAL_DAYS } from '../../../shared/plans.js';

const nbsp = (s: unknown) => String(s).replace(/ /g, ' ');

describe('the shared values of the marketing messages', () => {
  it('has every name the catalog tests treat as shared', () => {
    expect(Object.keys(siteBag({ locale: 'en' })).sort()).toEqual([...BAG_NAMES].sort());
  });

  it('English prints the figures the English pages have always printed', () => {
    const b = siteBag({ locale: 'en' });
    expect([b.pMonthly, b.pYearly, b.pYearlyShort, b.pMonthlyEq, b.pSave]).toEqual(['$2.99', '$29.00', '$29', '$2.42', '19%']);
    expect(b.trialHyphen).toBe(TRIAL_COPY.TRIAL_HYPHEN);
    expect(b.trialDaysText).toBe(TRIAL_COPY.TRIAL_DAYS_TEXT);
    expect(b.trialWordsCap).toBe(TRIAL_COPY.TRIAL_WORDS_CAP);
    expect(b.trialDays).toBe(TRIAL_DAYS);
  });

  it('other languages keep USD and write it the way the language does', () => {
    expect(nbsp(siteBag({ locale: 'de' }).pMonthly)).toBe('2,99 $');
    expect(nbsp(siteBag({ locale: 'de' }).pYearly)).toBe('29,00 $');
    expect(nbsp(siteBag({ locale: 'es' }).pMonthly)).toBe('2,99 US$');
    expect(nbsp(siteBag({ locale: 'pt-BR' }).pMonthly)).toBe('US$ 2,99');
    expect(nbsp(siteBag({ locale: 'pt-BR' }).pYearlyShort)).toBe('US$ 29');
    expect(nbsp(siteBag({ locale: 'de' }).pSave)).toBe('19 %');
    expect(nbsp(siteBag({ locale: 'pt-BR' }).pSave)).toBe('19%');
  });

  it('carries the optional features and the sign-in methods as the page was served', () => {
    expect(siteBag({ locale: 'es' })).toMatchObject({ sync: 'off', phone: 'off', methods: 'Google' });
    expect(siteBag({ locale: 'es', sync: true, phone: true, methods: 'Google o Apple' })).toMatchObject({ sync: 'on', phone: 'on', methods: 'Google o Apple' });
  });

  it('the home page address follows the language', () => {
    expect(siteBag({ locale: 'en' }).homeUrl).toBe('https://stopbiting.today/');
    expect(siteBag({ locale: 'pt-BR' }).homeUrl).toBe('https://stopbiting.today/pt-br');
  });

  it('the trial length is the number a language turns into words', () => {
    expect(siteBag({ locale: 'de', trialDays: 7 }).trialDays).toBe(7);
  });
});
