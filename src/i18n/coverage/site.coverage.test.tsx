// Pseudo-locale coverage for the localized MARKETING pages (WS12b): the shared site chrome (header, footer, closing call
// to action, trial button, language switcher), the pricing cards and /pricing. Each is rendered with the German marketing
// catalog on and every t() result wrapped in the marks; any word left outside the marks was not produced by t().
//
// A second block renders the same pages in English and pins what they have always said, so converting them to the
// catalog changed nothing for an English visitor.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoSiteLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { resetLocaleForTests } from '../core';
import { isLocalizedPage } from '../marketing/routes';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';

const h = vi.hoisted(() => ({
  prices: {} as Record<string, { total: string; currency: string }>,
  marker: null as string | null,
}));

// Regional prices come from Paddle; the localized branch is exercised by handing prices in.
vi.mock('../../billing/prices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../billing/prices')>()),
  useLocalizedPrices: (ids: string[]) => Object.fromEntries(ids.filter(id => h.prices[id]).map(id => [id, h.prices[id]])),
}));
// The language switcher reads the marker the server wrote into the page.
vi.mock('../marketing/localeMarker', async importOriginal => ({
  ...(await importOriginal<typeof import('../marketing/localeMarker')>()),
  readLocaleMarker: () => (h.marker ? h.marker.split(' ') : []),
}));

import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';
import { ClosingCta } from '../../components/site/ClosingCta';
import { TrialButton } from '../../components/site/TrialButton';
import { LanguageSwitcher } from '../../components/site/LanguageSwitcher';
import { PricingSection } from '../../components/PricingSection';
import { PricingPage } from '../../pages/PricingPage';
import { LocalizedSite } from '../../pages/LocalizedSite';
import { PRICE_IDS } from '../../billing/env';

export const COVERS = [
  'src/components/site/SiteHeader.tsx',
  'src/components/site/SiteFooter.tsx',
  'src/components/site/ClosingCta.tsx',
  'src/components/site/TrialButton.tsx',
  'src/components/site/LanguageSwitcher.tsx',
  'src/components/PricingSection.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/LocalizedSite.tsx',
];

// Words a visitor sees that are not language: the site's own address, the service names inside the sign-in list, FAQ.
const ALLOW = ['stopbiting', 'today', 'FAQ', 'Blog', 'DE', 'ES', 'EN', 'PT'];
// Until a page has its translation its address stays the English one (useSitePaths): the expectations follow.
const HOME = isLocalizedPage('home') ? '/de' : '/';

describe('site chrome and pricing, pseudo-locale', () => {
  usePseudoSiteLocale();
  beforeEach(() => { h.prices = {}; h.marker = null; });

  it('the header is translated and links within the language', () => {
    h.marker = 'es de pt-BR';
    const html = renderToStaticMarkup(<SiteHeader page="pricing" />);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toContain(`href="${HOME}#how"`);   // section links go to the home page of the language
    expect(html).toContain(`href="${HOME}"`);       // the logo
  });

  it('the footer is translated, says the blog and legal pages are English, and marks those links as English', () => {
    const html = renderToStaticMarkup(<SiteFooter cta={false} page="pricing" />);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toContain('href="/privacy" hrefLang="en"');
    expect(html).toContain(`href="${HOME}#pricing"`);
  });

  it('the closing call to action and the trial button are translated, with the trial length as a number', () => {
    const html = renderToStaticMarkup(<div><ClosingCta /><TrialButton /></div>);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toMatch(/3 Tage gratis, ohne Karte, danach 2,99[\s ]\$\/Monat/);
  });

  it('the pricing cards show the list prices the way German writes money, in both branches', () => {
    const plain = renderToStaticMarkup(<PricingSection />);
    expectAllTranslated(plain, { allow: ALLOW });
    expectNoMissingParams(plain);
    expect(plain).toMatch(/29,00[\s ]\$/);
    expect(plain).toMatch(/2,99[\s ]\$/);
    // regional prices from Paddle: the localized branch (its own two sentences)
    h.prices = { [PRICE_IDS.monthly]: { total: '€2,79', currency: 'EUR' }, [PRICE_IDS.yearly]: { total: '€27', currency: 'EUR' } };
    if (PRICE_IDS.monthly && PRICE_IDS.yearly) {
      const regional = renderToStaticMarkup(<PricingSection />);
      expectAllTranslated(regional, { allow: [...ALLOW, '€'] });
      expect(regional).toContain('€27');
    }
  });

  it('the whole /pricing page is translated', () => {
    const html = renderToStaticMarkup(<PricingPage />);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toContain('Fragen zu den Preisen');
  });

  it('LocalizedSite draws the page of its address once the catalog is here, and nothing before', () => {
    const html = renderToStaticMarkup(<LocalizedSite locale="de" page="pricing" />);
    expectAllTranslated(html, { allow: ALLOW });
    expect(html).toContain('Fragen zu den Preisen');
    resetLocaleForTests();   // the catalog has not arrived: the crawler copy stays, React draws nothing yet
    expect(renderToStaticMarkup(<LocalizedSite locale="de" page="pricing" />)).toBe('');
  });

  it('the language switcher lists every served language, names each in itself, and links to the same page', () => {
    h.marker = 'es de pt-BR';
    const footer = renderToStaticMarkup(<LanguageSwitcher page="pricing" variant="footer" />);
    expectAllTranslated(footer, { allow: ALLOW });
    expect(footer).toContain('href="/pricing"');       // English
    expect(footer).toContain('href="/es/pricing"');
    expect(footer).toContain('href="/pt-br/pricing"');
    expect(footer).toContain('hrefLang="pt-BR"');
    expect(footer).toMatch(/aria-current="true"[^>]*>Deutsch</);   // the page's own language is shown, not linked
    expect(footer).not.toMatch(/href="\/de\/pricing"/);
    const header = renderToStaticMarkup(<LanguageSwitcher page="pricing" variant="header" />);
    expect(header).toContain('href="/es/pricing"');
  });

  it('draws no switcher without the marker, on a page with no translation, or for a page that is not one of the four', () => {
    h.marker = null;
    expect(renderToStaticMarkup(<LanguageSwitcher page="pricing" variant="footer" />)).toBe('');
    h.marker = 'es';
    expect(renderToStaticMarkup(<LanguageSwitcher variant="footer" />)).toBe('');
    expect(renderToStaticMarkup(<LanguageSwitcher page="how" variant="footer" />)).toBe('');   // not translated yet
  });
});

describe('site chrome and pricing, English', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); h.prices = {}; h.marker = null; });
  afterEach(() => { resetLocaleForTests(); resetStorage(); });

  it('the pricing cards say what they always said', () => {
    const html = renderToStaticMarkup(<PricingSection />);
    for (const s of [
      '$2.99 a month, or <span class="sg-mark">$29 a year.</span>',
      'Three days free first, and no card to start. You pick a plan when the trial ends.',
      'Best value: save 19%',
      '$29.00', '/ year', '$2.42/month, billed yearly', 'Priority support',
      '$2.99', '/ month', 'Billed monthly', 'Everything in Yearly except priority support.',
      'Detection for as long as you run it', 'Current and best streak', 'Full history with trigger tags', 'Sound, flash, or both',
      'Payments go through Paddle. Cancel anytime in Settings. You can ask for a full refund within 14 days of your first payment: see the <a href="/refund-policy" class="sg-link">refund policy</a>.',
    ]) expect(html, s).toContain(s);
    expect(html.match(/Start free trial/g)).toHaveLength(2);
  });

  it('the pricing page says what it always said', () => {
    const html = renderToStaticMarkup(<PricingPage />);
    for (const s of [
      'What every plan includes', 'Detection runs on your device; no camera data leaves it', 'Pricing questions',
      'How does the 3-day free trial work?',
      'Every account starts with a 3-day free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.',
      'What is the difference between Monthly and Yearly?',
      'Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
      'How do payments work?', 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
      'Can I cancel anytime?', 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the <a href="/refund-policy" class="sg-link">refund policy</a> for details.',
      'Try it free for 3 days.', 'No card to start. Curious first? Read <a href="/how-it-works" class="sg-link">how the detection works</a>, or <a href="/tools/nail-biting-cost-calculator" class="sg-link">work out what biting costs you</a>.',
      '<a href="/" class="hover:text-[color:var(--sg-ink)]">Home</a>',
    ]) expect(html, s).toContain(s);
  });

  it('the header, footer and closing call to action say what they always said', () => {
    const header = renderToStaticMarkup(<SiteHeader />);
    for (const s of ['aria-label="Site navigation"', 'Skip to content', 'href="/#how"', 'How to start', 'Science', 'Privacy', 'Pricing', 'FAQ', 'Blog', 'Sign in', 'Start free trial']) expect(header, s).toContain(s);
    const footer = renderToStaticMarkup(<SiteFooter />);
    for (const s of [
      'Catch your next <span class="sg-hl">bite.</span>',
      'Leave it running through your next workday, then open History and see when you bite.',
      '3 days free, no card, then $2.99/month',
      'An awareness alarm for nail biting (onychophagia), made by <a href="/about" class="sg-link">Igor Gazivoda</a>. Detection runs in your browser. No camera data is sent while it runs.',
      'aria-label="Footer navigation"', 'Editorial Policy', 'Privacy Policy', 'Terms of Service', 'Refund Policy', 'href="/#pricing"', 'Stop biting.',
    ]) expect(footer, s).toContain(s);
    expect(footer).not.toContain('English');       // no switcher, no "only in English" note
    expect(footer).not.toContain('hrefLang');
  });
});
