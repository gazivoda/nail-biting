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
import { About } from '../../pages/About';
import { HowItWorks } from '../../pages/HowItWorks';
import { LocalizedSite } from '../../pages/LocalizedSite';
import { PRICE_IDS } from '../../billing/env';
import { TRIAL_DAYS_TEXT, TRIAL_HYPHEN, TRIAL_WORDS_CAP } from '../../../shared/plans.js';

export const COVERS = [
  'src/components/site/SiteHeader.tsx',
  'src/components/site/SiteFooter.tsx',
  'src/components/site/ClosingCta.tsx',
  'src/components/site/TrialButton.tsx',
  'src/components/site/LanguageSwitcher.tsx',
  'src/components/PricingSection.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/About.tsx',
  'src/pages/HowItWorks.tsx',
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
    expect(html).toMatch(/3 Tage gratis, ohne Karte, danach 2,99[\s\u00a0]\$\/Monat/);
  });

  it('the pricing cards show the list prices the way German writes money, in both branches', () => {
    const plain = renderToStaticMarkup(<PricingSection />);
    expectAllTranslated(plain, { allow: ALLOW });
    expectNoMissingParams(plain);
    expect(plain).toMatch(/29,00[\s\u00a0]\$/);
    expect(plain).toMatch(/2,99[\s\u00a0]\$/);
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

  it('the whole /about page is translated, in both states of the log sentence', () => {
    const html = renderToStaticMarkup(<About />);
    expectAllTranslated(html, { allow: [...ALLOW, 'MediaPipe', 'WebAssembly', 'HRT', 'Analytics', 'Hand', 'Landmarker'] });
    expectNoMissingParams(html);
    expect(html).toContain('Die Geschichte des Gründers');
    expect(html).toContain('Dein Alarm- und Bissprotokoll wird in deinem Browser gespeichert.');   // sync off
  });

  it('the whole /how-it-works page is translated; the article titles stay English and are marked as English', () => {
    const html = renderToStaticMarkup(<HowItWorks />);
    // the four article titles are the same in every language (the articles are English only)
    const english = ['Habit Reversal Training: the clinical method behind the app', 'Stop Biting app review: what to expect in the first two weeks', 'How we verified on-device processing', 'Stop Biting vs bitter nail polish: which works?'];
    expectAllTranslated(html, { allow: [...ALLOW, 'MediaPipe', 'WebAssembly', 'WASM', 'Hand', 'Landmarker', 'Chrome', 'Edge', 'Firefox', 'Mac', 'Linux', 'Chromebook', 'HRT', ...english.flatMap(s => s.split(/\W+/).filter(Boolean))] });
    expectNoMissingParams(html);
    expect(html).toContain('So funktioniert es');
    expect(html).toContain('Diese Artikel sind auf Englisch.');
    expect(html.match(/lang="en"/g)).toHaveLength(5);   // the HRT link in the text and the four titles
    for (const title of english) expect(html).toContain(title);
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

  it('draws no switcher without the marker, or for a page that is not one of the four', () => {
    h.marker = null;
    expect(renderToStaticMarkup(<LanguageSwitcher page="pricing" variant="footer" />)).toBe('');
    h.marker = 'es';
    expect(renderToStaticMarkup(<LanguageSwitcher variant="footer" />)).toBe('');
  });
});

describe('site chrome and pricing, English', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); h.prices = {}; h.marker = null; });
  afterEach(() => { resetLocaleForTests(); resetStorage(); });

  it('the pricing cards say what they always said', () => {
    const html = renderToStaticMarkup(<PricingSection />);
    for (const s of [
      '$2.99 a month, or <span class="sg-mark">$29 a year.</span>',
      `${TRIAL_WORDS_CAP} free first, and no card to start. You pick a plan when the trial ends.`,
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
      `How does the ${TRIAL_HYPHEN} free trial work?`,
      `Every account starts with a ${TRIAL_HYPHEN} free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.`,
      'What is the difference between Monthly and Yearly?',
      'Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
      'How do payments work?', 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
      'Can I cancel anytime?', 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the <a href="/refund-policy" class="sg-link">refund policy</a> for details.',
      `Try it free for ${TRIAL_DAYS_TEXT}.`, 'No card to start. Curious first? Read <a href="/how-it-works" class="sg-link">how the detection works</a>, or <a href="/tools/nail-biting-cost-calculator" class="sg-link">work out what biting costs you</a>.',
      '<a href="/" class="hover:text-[color:var(--sg-ink)]">Home</a>',
    ]) expect(html, s).toContain(s);
  });

  it('the how it works page says what it always said', () => {
    const html = renderToStaticMarkup(<HowItWorks />);
    for (const s of [
      'How AI nail biting <span class="sg-hl">detection</span> works',
      'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, entirely on your device. The MediaPipe Hand Landmarker tracks 21 hand landmarks, and the alarm fires about 0.6 seconds after it sees your hand approaching your mouth. Setup takes under two minutes.',
      'alt="Stop Biting Watch screen with a large streak counter, alarms and bites today, and detection running."',
      'The Watch screen, shown with example data.',
      'Why awareness is the bottleneck', '<a href="/blog/habit-reversal-training-guide" class="sg-link">Habit Reversal Training</a> (the gold-standard treatment)',
      'Getting started', 'Open the app', 'Grant camera access', 'Position your camera', 'Work, game, or study normally', 'Respond to the alarm',
      'It needs three consecutive frames before it acts, so an alarm fires about six tenths of a second after your hand starts moving to your mouth.',
      'Technical specifications', 'Detection model', 'Google MediaPipe Hand Landmarker (21 landmarks)', 'WebAssembly: sandboxed, runs on your device',
      'Alarm latency', 'Incident logging', 'Timestamped log stored locally, never transmitted',
      'Common questions', 'What happens to my camera data?', 'Signing in and paying use the network, and you can check this yourself by watching your network traffic while the app runs.',
      'Will it false-alarm when I&#x27;m eating or touching my face?', 'Does it work in the dark?', 'Learn more',
      `Try it free for ${TRIAL_DAYS_TEXT}.`, 'No card to start. Then $2.99 a month or $29 a year, cancel anytime.',
    ]) expect(html, s).toContain(s);
    expect(html).not.toContain('These articles are in English');   // the note is only for the other languages
    expect(html).not.toContain(' lang="en"');
  });

  it('the about page says what it always said', () => {
    const html = renderToStaticMarkup(<About />);
    for (const s of [
      'About Stop <span class="sg-hl">Biting</span>', 'Built by a nail biter, for nail biters. Here&#x27;s why this app exists.',
      'The founder&#x27;s story', 'I&#x27;m Igor Gazivoda, a software developer. I bit my nails for over 20 years. Not occasionally: constantly, automatically, without noticing until the damage was already done.',
      'The gold-standard treatment literally starts with &quot;awareness training&quot; before anything else.',
      'What Stop Biting does', 'Privacy: the non-negotiable', 'Your alarm and bite log is stored in your browser. The site counts page visits with Google Analytics; that never includes anything from your camera.',
      'The technology', '<a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker" target="_blank" rel="noopener noreferrer" class="sg-link">Google MediaPipe&#x27;s Hand Landmarker</a>',
      'How this site is written', '<a href="/editorial-policy" class="sg-link">editorial policy and corrections page</a>',
      `Try it free for ${TRIAL_DAYS_TEXT}.`, 'No card to start. Then $2.99 a month or $29 a year, cancel anytime.',
      '<span class="text-[color:var(--sg-ink)]">About</span>',
    ]) expect(html, s).toContain(s);
  });

  it('the header, footer and closing call to action say what they always said', () => {
    const header = renderToStaticMarkup(<SiteHeader />);
    for (const s of ['aria-label="Site navigation"', 'Skip to content', 'href="/#how"', 'How to start', 'Science', 'Privacy', 'Pricing', 'FAQ', 'Blog', 'Sign in', 'Start free trial']) expect(header, s).toContain(s);
    const footer = renderToStaticMarkup(<SiteFooter />);
    for (const s of [
      'Catch your next <span class="sg-hl">bite.</span>',
      'Leave it running through your next workday, then open History and see when you bite.',
      `${TRIAL_DAYS_TEXT} free, no card, then $2.99/month`,
      'An awareness alarm for nail biting (onychophagia), made by <a href="/about" class="sg-link">Igor Gazivoda</a>. Detection runs in your browser. No camera data is sent while it runs.',
      'aria-label="Footer navigation"', 'Editorial Policy', 'Privacy Policy', 'Terms of Service', 'Refund Policy', 'href="/#pricing"', 'Stop biting.',
    ]) expect(footer, s).toContain(s);
    expect(footer).not.toContain('English');       // no switcher, no "only in English" note
    expect(footer).not.toContain('hrefLang');
  });
});
