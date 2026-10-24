// Pseudo-locale coverage for the HOME page (WS12b): the page, its contact form and the live demo's own words. The home page
// is rendered with the German marketing catalog and every t() result wrapped in the marks; any word outside the marks was
// not produced by t(). A second block pins what the English page says, against the FAQPage the server publishes for it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { usePseudoSiteLocale, expectAllTranslated, expectNoMissingParams, setFlags } from '../testing/pseudo';
import { installCatalogForTests, resetLocaleForTests } from '../core';
import { catalog as deApp } from '../locales/de';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { fillTrialTokens } from '../../../shared/plans.js';
import { messages as homeEn } from '../scopes/marketing-home';
import { t as demoT } from '../scopes/marketing-demo';
import { t as homeT } from '../scopes/marketing-home';

const h = vi.hoisted(() => ({
  status: 'idle' as string,
  providers: { apple: false, microsoft: false, magic_link: false },
}));

vi.mock('../../billing/prices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../billing/prices')>()),
  useLocalizedPrices: () => ({}),
}));
vi.mock('../../hooks/useCamera', () => ({ useCamera: () => ({ videoRef: { current: null }, error: null }) }));
vi.mock('../../hooks/useDetection', () => ({ useDetection: () => ({ status: h.status }) }));
vi.mock('../../auth/useSignInProviders', () => ({
  useSignInProviders: () => ({ providers: h.providers, ready: true }),
  useSignInHref: () => (h.providers.apple || h.providers.microsoft || h.providers.magic_link ? '/signin' : '/api/auth/google'),
}));

import { Landing } from '../../pages/Landing';
import { ContactForm } from '../../components/ContactForm';
import { HeroDemo } from '../../components/demo/HeroDemo';
import { TRIAL_DAYS_TEXT, TRIAL_HYPHEN } from '../../../shared/plans.js';

export const COVERS = [
  'src/pages/Landing.tsx',
  'src/components/ContactForm.tsx',
  'src/components/demo/HeroDemo.tsx',
];

const ALLOW = ['stopbiting', 'today', 'FAQ', 'Blog', 'DE', 'ES', 'EN', 'PT'];

describe('home page, pseudo-locale', () => {
  usePseudoSiteLocale();
  beforeEach(() => { h.status = 'idle'; h.providers = { apple: false, microsoft: false, magic_link: false }; });

  it('the whole page is translated, with the trial length as a number and the prices written the German way', () => {
    const html = renderToStaticMarkup(<Landing />);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toContain('Hör auf, an deinen Nägeln zu');
    expect(html).toMatch(/3 Tage gratis, ohne Karte, danach 2,99[\s\u00a0]\$\/Monat/);
    expect(html).toContain('Fragen, die Menschen zu Nägelkauen stellen');
  });

  it('links stay within the language where a page exists, and the guides are marked as English', () => {
    const html = renderToStaticMarkup(<Landing />);
    expect(html).toContain('href="/de/about"');
    expect(html).toContain('href="/de#pricing"');
    expect(html).toContain('<a href="/blog/habit-reversal-training-guide" lang="en"');
    expect(html).toContain('Die Ratgeber sind auf Englisch.');
    expect(html).toContain('Alle ');   // "Alle 188 Artikel"
    expect(html).toMatch(/Alle \d+ Artikel/);
    expect(html).toContain('<img src="/shots/app-watch-1280.webp"');   // the same real screenshot
  });

  it('the answer about a Google account is the long one only when another method is on', () => {
    const plain = renderToStaticMarkup(<Landing />);
    expect(plain).toContain('Konten werden über die Anmeldung mit Google erstellt');
    h.providers = { apple: true, microsoft: false, magic_link: true };
    const more = renderToStaticMarkup(<Landing />);
    expectAllTranslated(more, { allow: ALLOW });
    const bare = more.replace(/[⟦⟧]/g, '');   // (the marks of the pseudo-locale also wrap each method's name)
    expect(bare).toContain('Nein. Du kannst dich mit Google, Apple oder einem Link per E-Mail anmelden');
    expect(bare).toContain('Bei der Anmeldung mit Apple erhalten wir den Namen');
    expect(bare).toContain('Für den Link per E-Mail brauchen wir nur deine E-Mail-Adresse.');
    expect(bare).toContain('Melde dich mit Google, Apple oder einem Link per E-Mail an');   // "How to start" names the methods too
    expect(bare).not.toContain('Konten werden über die Anmeldung mit Google erstellt');
  });

  it('with the optional sync and the phone companion on, the sentences about where the history lives change', () => {
    setFlags('event_sync', 'phone_companion');
    const html = renderToStaticMarkup(<Landing />);
    expectAllTranslated(html, { allow: ALLOW });
    expect(html).toContain('schalte die Synchronisierung in den Einstellungen ein');
    expect(html).toContain('Anmelden, Bezahlen und, falls du es einschaltest, Synchronisieren nutzen das Netzwerk.');
    expect(html).toContain('nur dann in dein Konto kopiert');
    expect(html).toContain('Auf dem Handy kannst du dich anmelden');
    expect(html).not.toContain('Dein Verlauf wird in diesem Browser gespeichert, er folgt dir also nicht');
  });

  it('the contact form is translated', () => {
    const html = renderToStaticMarkup(<ContactForm />);
    expectAllTranslated(html, { allow: ALLOW });
    expectNoMissingParams(html);
    expect(html).toContain('placeholder="⟦Dein Name⟧"');
    expect(html).toContain('⟦Nachricht senden⟧');
  });

  describe('the live demo (the app catalog arrives with the click)', () => {
    beforeEach(() => { installCatalogForTests('de', { reviewed: true, catalog: deApp }); });

    it('the idle plate and the loading line are translated', () => {
      const idle = renderToStaticMarkup(<HeroDemo />);
      expectAllTranslated(idle, { allow: ALLOW });
      expect(idle).toContain('Live-Demo ausprobieren');
      h.status = 'loading';
      const loading = renderToStaticMarkup(<HeroDemo autoStart />);
      expectAllTranslated(loading, { allow: ALLOW });
      expect(loading).toContain('KI-Modelle werden geladen');
    });

    it('while watching it tells a person how to see it work', () => {
      h.status = 'watching';
      const html = renderToStaticMarkup(<HeroDemo autoStart />);
      expectAllTranslated(html, { allow: ALLOW });
      expect(html).toContain('Führe eine Fingerspitze an die Lippen, um den Alarm zu hören');
      expect(html).toMatch(/role="timer"/);
    });

    it('every result and catch line, and the failure line, read in German with the plural of the language', () => {
      const lines = [0, 1, 2, 7].map(count => demoT('result', { count }));
      expect(lines[0]).toContain('⟦In 60 Sekunden nichts erkannt');
      expect(lines[1]).toContain('einmal in 60 Sekunden');
      expect(lines[3]).toContain('Dich 7 Mal in 60 Sekunden erwischt');
      expect(demoT('catch', { count: 1 })).toContain('einmal');
      expect(demoT('catch', { count: 3 })).toContain('3 Mal');
      const failure = demoT.rich('failure', { offer: demoT('offer', { trialDays: 3 }) }, { trial: c => <a href="/x">{c}</a>, how: c => <a href="/y">{c}</a> });
      const html = renderToStaticMarkup(<p>{failure}</p>);
      expectAllTranslated(html, { allow: ALLOW });
      expectNoMissingParams(html);
    });
  });
});

describe('home page, English', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); h.status = 'idle'; h.providers = { apple: false, microsoft: false, magic_link: false }; });
  afterEach(() => { resetLocaleForTests(); resetStorage(); });

  it('the visible questions and answers are the FAQPage the server publishes for the English home page, word for word', () => {
    const shell = fillTrialTokens(readFileSync(new URL('../../../index.html', import.meta.url), 'utf8'));
    const block = shell.match(/<!-- Structured Data: FAQPage -->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
    const published = (JSON.parse(block) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }).mainEntity;
    expect(published).toHaveLength(11);
    const html = renderToStaticMarkup(<Landing />);
    const decode = (s: string) => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const page = decode(html);
    published.forEach((q, i) => {
      const n = i + 1;
      expect(homeT(`faq.${n}.q` as keyof typeof homeEn, { trialHyphen: TRIAL_HYPHEN }), `question ${n}`).toBe(q.name);
      expect(page, `question ${n} is on the page`).toContain(q.name);
      expect(page, `answer ${n} is on the page`).toContain(q.acceptedAnswer.text);
    });
  });

  it('says what it always said', () => {
    const html = renderToStaticMarkup(<Landing />);
    for (const s of [
      'Stop <span class="sg-hl">biting</span> your nails.',
      'Your webcam watches your hands while you work. The moment a fingertip reaches your lips, an alarm sounds, so you catch the bites you would otherwise never notice.',
      'Made for a laptop or desktop with a webcam.',
      'Detection runs on your device and sends no camera data while it runs. Sign in with Google (it opens in a new tab). Cancel anytime.',
      `${TRIAL_DAYS_TEXT} free, no card`, 'No camera data is sent while it runs',
      'Try the detector right now', 'The same detector the app uses, on your own camera, before you sign up for anything.', 'Try the live demo',
      'A habit loop, <span class="sg-mark">broken</span> in three moves', 'Notice', 'Interrupt', 'Replace',
      'Every catch ends up in <span class="sg-mark">History</span>',
      'Sign in with Google (it opens in a new tab), allow the camera, and get on with your work. When your hand reaches your mouth, it goes off. That&#x27;s the whole setup.',
      'Before you start', 'Your history is stored in this browser, so it doesn&#x27;t follow you to another computer.',
      'Why an alarm works when <span class="sg-mark">willpower</span> doesn&#x27;t',
      'Somewhere <strong class="font-extrabold text-[color:var(--sg-ink)]">between 20 and 30% of adults</strong> bite their nails chronically (Halteh, Scher &amp; Lipner, 2017).',
      '<span class="whitespace-nowrap">(PubMed)</span>', 'Azrin, Nunn &amp; Frantz (1980), Behaviour Research and Therapy',
      'Your camera never leaves <span class="sg-hl">your device.</span>',
      '<strong class="font-bold">Check it yourself:</strong> open your browser&#x27;s developer tools',
      'Why this exists', 'The longer story', 'Questions people ask about nail biting', 'Featured guides',
      'How the AI nail biting detection works', 'Can an app help? The camera approach, in depth',
      'Start here if you&#x27;ve tried polish and given up.', 'Get in touch', 'Catch your next <span class="sg-hl">bite.</span>',
    ]) expect(html, s).toContain(s);
    expect(html).not.toContain('The guides are in English.');   // only shown on a localized page
    expect(html).not.toContain(' lang="en"');
  });

  it('the demo says what it always said', () => {
    const idle = renderToStaticMarkup(<HeroDemo />);
    expect(idle).toContain('Try the live demo');
    expect([0, 1, 5].map(count => demoT('result', { count }))).toEqual([
      'Nothing caught in 60 seconds. Run it again and touch your lips to hear the alarm.',
      'Caught you once in 60 seconds. The app does this all day, while you work.',
      'Caught you 5 times in 60 seconds. The app does this all day, while you work.',
    ]);
    expect([1, 4].map(count => demoT('catch', { count }))).toEqual(["That's the alarm. Caught once so far.", "That's the alarm. Caught 4 times so far."]);
    expect(demoT('offer', { trialDaysText: TRIAL_DAYS_TEXT })).toBe(`${TRIAL_DAYS_TEXT} free, no card`);
    expect(demoT('loading')).toBe(homeT('demo.loading'));   // the Suspense fallback on the home page and the demo's own line
  });

  it('the contact form says what it always said', () => {
    const html = renderToStaticMarkup(<ContactForm />);
    for (const s of ['Get in touch', 'Questions, bugs, a false alarm that annoyed you: this goes straight to my inbox.', '>Name<', 'placeholder="Your name"', '>Email<', 'placeholder="you@example.com"', '>Message<', 'placeholder="What happened?"', 'Send message']) {
      expect(html, s).toContain(s);
    }
  });
});
