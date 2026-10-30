import { describe, it, expect } from 'vitest';
import {
  COPY_FLAGS, RULES, anyRuleActive, dropEmptySections, fillCopyTokens, fillCopyTokensDeep, flagAware, flagAwareDeep,
  lifetimeHeadline, mentionsFlagCopy, resolveMarkers, signInAnswer,
} from './flagCopy.js';
import { FLAG_NAMES } from '../server/features.js';
import { TRIAL_HYPHEN } from './plans.js';

const none = () => false;
const only = (...names) => name => names.includes(name);
const all = () => true;

// Every combination of the flags that change copy on pages that exist today.
const COMBOS = (() => {
  const out = [];
  for (let mask = 0; mask < 1 << COPY_FLAGS.length; mask++) {
    out.push(only(...COPY_FLAGS.filter((_, i) => mask & (1 << i))));
  }
  return out;
})();

describe('the rules', () => {
  it('have unique ids and name only flags that exist', () => {
    expect(new Set(RULES.map(r => r.id)).size).toBe(RULES.length);
    for (const rule of RULES) {
      expect(rule.off.length, rule.id).toBeGreaterThan(8);
      expect(rule.where, rule.id).toBeTruthy();
      for (const flag of rule.flags) expect(FLAG_NAMES, `${rule.id}: ${flag}`).toContain(flag);
    }
    for (const flag of COPY_FLAGS) expect(FLAG_NAMES).toContain(flag);
  });

  it('change nothing with every flag off: the same string comes back', () => {
    for (const rule of RULES) {
      expect(rule.on(none), rule.id).toBeNull();
      const text = `before ${rule.off} after`;
      expect(flagAware(text, none) === text, rule.id).toBe(true);
    }
    expect(anyRuleActive(none)).toBe(false);
  });

  it('only react to the flags they name', () => {
    for (const rule of RULES) {
      for (const flag of COPY_FLAGS.filter(f => !rule.flags.includes(f))) {
        expect(rule.on(only(flag)), `${rule.id} with ${flag}`).toBeNull();
      }
      expect(rule.flags.some(f => rule.on(only(f)) !== null), `${rule.id} is reachable`).toBe(true);
    }
  });

  it('are idempotent in every flag state: applying twice is applying once', () => {
    const everything = RULES.map(r => r.off).join('\n');
    for (const isOn of COMBOS) {
      const once = flagAware(everything, isOn);
      expect(flagAware(once, isOn)).toBe(once);
    }
  });

  it('write text that is safe in HTML and JSON, in the site\'s voice, with the approved privacy wording', () => {
    for (const isOn of COMBOS) {
      for (const rule of RULES) {
        const on = rule.on(isOn);
        if (!on) continue;
        expect(on, rule.id).not.toMatch(/["&<>\\]|\{\{/);
        expect(on, rule.id).not.toMatch(/[—–]/);
        expect(on, rule.id).not.toMatch(/100% private|no cloud, no server|zero network requests|nothing leaves your device|treat|cure|clinical/i);
      }
    }
  });

  it('every on-text that mentions sync says it is something you turn on', () => {
    for (const rule of RULES.filter(r => r.flags.includes('event_sync'))) {
      const on = rule.on(only('event_sync'));
      expect(on, rule.id).toMatch(/sync/);
      expect(on, rule.id).toMatch(/turn(ed)? (it )?on|if you turn/);
    }
  });
});

describe('signInAnswer', () => {
  it('names only the methods that are on, and never promises the others', () => {
    for (const isOn of COMBOS) {
      const text = signInAnswer(isOn);
      expect(text.startsWith('No. You can sign in with Google'), text).toBe(true);
      expect(/Apple/.test(text)).toBe(isOn('signin_apple'));
      expect(/Microsoft/.test(text)).toBe(isOn('signin_microsoft'));
      expect(/emailed link/.test(text)).toBe(isOn('signin_magic_link'));
      expect(text).toContain('The live demo on the homepage needs no account at all.');
      expect(text).not.toMatch(/100% private|nothing leaves/i);
    }
  });

  it('reads as plain sentences for all three and for one', () => {
    expect(signInAnswer(all)).toBe(
      'No. You can sign in with Google, Apple, Microsoft or an emailed link, so you do not need a Google account. '
      + 'Signing in with Google gives us your name, email address and profile picture and never your Google password. '
      + 'Signing in with Apple or Microsoft gives us the name and email address on that account (an Apple relay address if you hide yours) and never your password. '
      + 'The emailed link needs only your email address. The live demo on the homepage needs no account at all.',
    );
    expect(signInAnswer(only('signin_magic_link'))).toBe(
      'No. You can sign in with Google or an emailed link, so you do not need a Google account. '
      + 'Signing in with Google gives us your name, email address and profile picture and never your Google password. '
      + 'The emailed link needs only your email address. The live demo on the homepage needs no account at all.',
    );
  });
});

describe('markers', () => {
  it('keep one branch and drop the other', () => {
    const text = 'A {{if event_sync}}on{{else}}off{{end}} B {{if urge_timer}}timer{{end}}.';
    expect(resolveMarkers(text, none)).toBe('A off B .');
    expect(resolveMarkers(text, only('event_sync'))).toBe('A on B .');
    expect(resolveMarkers(text, only('urge_timer'))).toBe('A off B timer.');
  });

  it('leave text without markers as the same string', () => {
    const text = 'nothing to do';
    expect(resolveMarkers(text, all) === text).toBe(true);
    expect(flagAware(text, all) === text).toBe(true);
  });

  it('never leave a marker behind', () => {
    for (const isOn of COMBOS) {
      expect(flagAware('x {{if event_sync}}a{{else}}b{{end}} {{if phone_companion}}c{{end}} y', isOn)).not.toMatch(/\{\{/);
    }
  });
});

describe('flagAwareDeep, dropEmptySections and tokens', () => {
  it('returns the very same object when nothing changed, and a new one when something did', () => {
    const page = { title: 't', sections: [{ heading: 'h', body: 'b' }] };
    expect(flagAwareDeep(page, none) === page).toBe(true);
    const changing = { sections: [{ body: '{{if event_sync}}x{{end}}' }] };
    expect(flagAwareDeep(changing, only('event_sync'))).toEqual({ sections: [{ body: 'x' }] });
    expect(flagAwareDeep(changing, none) === changing).toBe(false);
  });

  it('drops a section a marker emptied, and only that one', () => {
    const page = flagAwareDeep({ sections: [
      { heading: '{{if urge_timer}}Timer{{end}}', body: '{{if urge_timer}}About the timer.{{end}}' },
      { heading: 'Always', body: '' },
      { heading: '', body: 'Body only' },
    ] }, none);
    expect(dropEmptySections(page).sections.map(s => s.heading)).toEqual(['Always', '']);
    const kept = flagAwareDeep({ sections: [{ heading: 'a', body: '' }] }, none);
    expect(dropEmptySections(kept) === kept).toBe(true);
  });

  it('fill {{UPPER}} placeholders from the values given and leave unknown ones alone', () => {
    expect(fillCopyTokens('you both get {{REFERRAL_CREDIT}}.', { REFERRAL_CREDIT: 'one month' })).toBe('you both get one month.');
    expect(fillCopyTokens('{{OTHER}}', { REFERRAL_CREDIT: 'x' })).toBe('{{OTHER}}');
    expect(fillCopyTokens('{{if event_sync}}a{{end}}', { })).toBe('{{if event_sync}}a{{end}}');
    expect(fillCopyTokensDeep({ a: ['{{N}}'], b: { c: '{{N}}' }, d: 3 }, { N: '7' })).toEqual({ a: ['7'], b: { c: '7' }, d: 3 });
  });

  it('mentionsFlagCopy sees a rule text or a marker, and nothing else', () => {
    expect(mentionsFlagCopy(RULES[0].off)).toBe(true);
    expect(mentionsFlagCopy('a {{if x}}b{{end}}')).toBe(true);
    expect(mentionsFlagCopy('ordinary words')).toBe(false);
    expect(mentionsFlagCopy(42)).toBe(false);
  });
});

// ─── The Lifetime plan in the sentences that listed two plans (flag lifetime_plan) ──────────────────────
// `lifetime_plan` is on in production: the pricing section draws three cards. The questions and answers the page,
// the crawler article and the FAQPage data say about the plans follow it, through these rules, in one voice.

const LIFETIME_RULES = RULES.filter(r => r.flags.includes('lifetime_plan'));
const FAQ_IDS = ['home-faq-cancel', 'home-faq-cost', 'pricing-faq-difference', 'pricing-faq-difference-q', 'pricing-faq-pick-plan'];
const FAQ_RULES = LIFETIME_RULES.filter(r => FAQ_IDS.includes(r.id));
// The compare and solutions pages (and two posts) that quote Stop Biting's price: the second group of Lifetime rules.
const PAGE_RULES = LIFETIME_RULES.filter(r => !FAQ_IDS.includes(r.id));
const lifetimeOn = only('lifetime_plan');
const WITHOUT_LIFETIME = COPY_FLAGS.filter(f => f !== 'lifetime_plan');
// What the Lifetime card and the Terms say, word for word (src/i18n/scopes/plans.ts lifetime.band.body).
const CARD_WORDS = 'It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered.';

describe('the Lifetime rules', () => {
  it('cover the pricing questions and the two homepage answers that listed two plans, and the pages that quote our price', () => {
    expect(FAQ_RULES.map(r => r.id).sort()).toEqual(FAQ_IDS);
    // in the order they are applied: the sentences with their own wording first, the two price lists last
    expect(PAGE_RULES.map(r => r.id)).toEqual([
      'compare-hands-off-annual', 'compare-hands-off-cost', 'compare-ai-apps-cost', 'compare-nailed-cost', 'compare-habitaware-plans',
      'compare-pavlok-try', 'compare-nailed-is-subscription', 'compare-nailed-buys', 'compare-nailed-pays', 'compare-nailed-heading',
      'compare-habitcam-pick', 'compare-habitcam-limit', 'compare-nailbitemenu-limit', 'compare-biteless-both', 'how-it-works-pricing-link',
      'compare-cta-price', 'price-list-short', 'price-list',
    ]);
    expect(LIFETIME_RULES).toHaveLength(FAQ_RULES.length + PAGE_RULES.length);
    expect(COPY_FLAGS).toContain('lifetime_plan');
  });

  it('change nothing while the flag is off, whatever else is on, and say something once it is on', () => {
    for (const rule of LIFETIME_RULES) {
      expect(rule.on(none), rule.id).toBeNull();
      expect(rule.on(only(...WITHOUT_LIFETIME)), rule.id).toBeNull();
      expect(rule.on(lifetimeOn), `${rule.id} is reachable`).toBeTruthy();
    }
  });

  it('pin the new wording, sentence by sentence', () => {
    const on = id => LIFETIME_RULES.find(r => r.id === id).on(lifetimeOn);
    expect(on('pricing-faq-pick-plan')).toBe('When the trial ends, pick the monthly, yearly or Lifetime plan to keep going.');
    expect(on('pricing-faq-difference-q')).toBe('What is the difference between Monthly, Yearly and Lifetime?');
    expect(on('pricing-faq-difference')).toBe(
      'Every plan includes the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. '
      + 'Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support. '
      + `Lifetime is paid once instead of every month or year. ${CARD_WORDS}`,
    );
    expect(on('home-faq-cost')).toBe('It costs $2.99 a month, $29 a year or a one-time Lifetime payment after a');
    expect(on('home-faq-cancel')).toBe(
      'After that it is $2.99 a month, $29 a year or a one-time Lifetime payment. '
      + 'A monthly or yearly plan can be cancelled anytime from the app settings, and you keep access until the end of the paid period.',
    );
  });

  it('quote no Lifetime price in the questions and answers, no saving, never the best deal, and promise no more than the card does', () => {
    for (const rule of FAQ_RULES) {
      const on = rule.on(lifetimeOn);
      expect(on, rule.id).not.toMatch(/best deal|best value|cheapest|bargain|forever|unlimited updates/i);
      // the only dollar figures are the two subscription prices the sentence already had
      for (const figure of on.match(/\$[\d.]+/g) ?? []) expect(['$2.99', '$29', '$29.00', '$2.42'], `${rule.id}: ${figure}`).toContain(figure);
      // a sentence that says what Lifetime includes uses the card's own words
      if (/includes everything/.test(on)) expect(on, rule.id).toContain(CARD_WORDS);
    }
  });

  it('never let a subscription-only statement (cancel anytime) apply to the Lifetime plan', () => {
    const cancel = LIFETIME_RULES.find(r => r.id === 'home-faq-cancel').on(lifetimeOn);
    expect(cancel).toContain('A monthly or yearly plan can be cancelled anytime');
    expect(cancel).not.toMatch(/Lifetime[^.]*cancel/i);
    for (const rule of LIFETIME_RULES) expect(rule.on(lifetimeOn), rule.id).not.toMatch(/\bboth plans\b|\btwo plans\b/i);
  });

  it('leave alone the sentences the server\'s Lifetime copy (ANCHORS) has to find afterwards', async () => {
    // server.js runs these rules (copyHtml) BEFORE server/marketing/lifetimeCopy.js looks for its anchors in the crawler
    // articles: a rule that reworded one would make the Lifetime section silently vanish. The title, description, schema
    // description and navigation label (`META_ANCHORS`) are matched on server.js's own literals and never go through the
    // rules; scripts/lifetimeCopy.test.mjs pins what the real server says for them with the plan on.
    const { ANCHORS } = await import('../server/marketing/lifetimeCopy.js');
    const META_ANCHORS = ['title', 'description', 'pageDescription', 'nav'];
    for (const [name, anchor] of Object.entries(ANCHORS).filter(([name]) => !META_ANCHORS.includes(name))) {
      expect(flagAware(anchor, lifetimeOn), `anchor ${name}`).toBe(anchor);
      for (const rule of LIFETIME_RULES) expect(anchor.includes(rule.off) || rule.off.includes(anchor), `${rule.id} vs anchor ${name}`).toBe(false);
    }
    expect(Object.keys(ANCHORS).filter(name => META_ANCHORS.includes(name))).toEqual(META_ANCHORS);
  });

  it('are idempotent: a sentence that already says Lifetime is not changed again', () => {
    const text = LIFETIME_RULES.map(r => r.off).join(' | ');
    const once = flagAware(text, lifetimeOn);
    expect(once).not.toBe(text);
    expect(flagAware(once, lifetimeOn)).toBe(once);
  });

  it('do not touch the translations: the draft languages keep saying what they said', async () => {
    for (const locale of ['es', 'de', 'pt-BR']) {
      const { messages: pricing } = await import(`../src/i18n/locales/${locale}/marketing-pricing.ts`);
      const { messages: home } = await import(`../src/i18n/locales/${locale}/marketing-home.ts`);
      for (const text of [pricing['faq.1.a'], pricing['faq.2.q'], pricing['faq.2.a'], home['faq.1.a'], home['faq.8.a']]) {
        expect(flagAware(text, all) === text, `${locale}: ${text.slice(0, 40)}`).toBe(true);
      }
    }
  });
});

// ─── The Lifetime plan on the pages that quote Stop Biting's price ─────────────────────────────────────
// The compare and solutions pages (and two posts) said "$2.99/month or $29/year" and, in a few sentences, "a subscription".

describe('the Lifetime rules on the pages that quote our price', () => {
  const U = '$99';
  const on = id => PAGE_RULES.find(r => r.id === id).on(lifetimeOn);

  it('pin the new wording, sentence by sentence (the price is the plan\'s own, from shared/plans.js)', () => {
    expect(on('compare-hands-off-annual')).toBe('Stop Biting is $2.99/month, or $29/year (about $2.42/month if you commit, roughly 19% cheaper than paying monthly), or $99 once for the Lifetime plan.');
    expect(on('compare-hands-off-cost')).toBe('Stop Biting: $2.99/month, $29/year (about $2.42/month) or $99 once, with a');
    expect(on('compare-ai-apps-cost')).toBe('Pricing is published: $2.99/month, $29/year (~$2.42/month) or $99 once, with a');
    expect(on('compare-nailed-cost')).toBe('Stop Biting: $2.99/month, $29/year (~$2.42/month) or $99 once for the Lifetime plan.');
    expect(on('compare-habitaware-plans')).toBe('It has published prices: $2.99/month, $29/year (about $2.42/month on the annual plan) or $99 once for the Lifetime plan.');
    expect(on('compare-pavlok-try')).toBe('It costs far less to try: $2.99/month, or $29/year, against the device prices on Pavlok’s home page. Stop Biting also has a one-time Lifetime plan at $99.');
    expect(on('compare-nailed-is-subscription')).toBe('Stop Biting is a subscription, or a one-time Lifetime plan, that adds');
    expect(on('compare-nailed-buys')).toBe('Stop Biting’s paid plans buy you things you may not need');
    expect(on('compare-nailed-pays')).toBe('What a Stop Biting plan pays for is the rest of the system');
    expect(on('compare-nailed-heading')).toBe('Should I buy Nailed or pay for Stop Biting?');
    expect(on('compare-habitcam-pick')).toBe('want to pay once for less than Stop Biting’s $99 Lifetime plan, or have more than one of those behaviours');
    expect(on('compare-habitcam-limit')).toBe('and only in front of your webcam, and it is a subscription unless you choose the one-time Lifetime plan at $99.');
    expect(on('compare-nailbitemenu-limit')).toBe('Stop Biting is a paid subscription or a one-time Lifetime plan after the trial,');
    expect(on('compare-biteless-both')).toBe('Both sell a subscription, and Stop Biting also has a one-time Lifetime plan.');
    expect(on('how-it-works-pricing-link')).toBe('Pricing: $2.99/month, $29/year or $99 once, ');
    expect(on('compare-cta-price')).toBe('then $2.99 a month, $29 a year or $99 once');
    expect(on('price-list-short')).toBe('$2.99/mo, $29/yr or $99 once');
    expect(on('price-list')).toBe('$2.99/month, $29/year or $99 once');
  });

  it('follow LIFETIME_PRICE_USD, so the sentence and the product node\'s offer say the same number', async () => {
    const { vi } = await import('vitest');
    vi.stubEnv('LIFETIME_PRICE_USD', '149');
    try {
      expect(flagAware('Stop Biting costs $2.99/month or $29/year with a', lifetimeOn)).toBe('Stop Biting costs $2.99/month, $29/year or $149 once with a');
      expect(on('compare-habitcam-limit')).toContain('$149');
      expect(lifetimeHeadline()).toEqual({ lead: '$2.99 a month, ', mark: '$29 a year,', tail: ' or $149 once.' });
    } finally {
      vi.unstubAllEnvs();
    }
    expect(lifetimeHeadline().tail).toBe(` or ${U} once.`);
  });

  it('are not pre-empted by an earlier rule and not altered by a later one: each text comes out as its own replacement', () => {
    // The price lists sit last and take what the specific sentences leave; if one moved above them, a sentence such as
    // "(about $2.42/month)" would end up after "$99 once" and read as the Lifetime price.
    for (const rule of PAGE_RULES) expect(flagAware(rule.off, lifetimeOn), rule.id).toBe(rule.on(lifetimeOn));
    expect(flagAware(`Stop Biting: $2.99/month or $29/year (about $2.42/month), with a ${TRIAL_HYPHEN} free trial`, lifetimeOn))
      .toBe(`Stop Biting: $2.99/month, $29/year (about $2.42/month) or $99 once, with a ${TRIAL_HYPHEN} free trial`);
  });

  it('quote no saving, call nothing the best deal, use no dash, and name no price but ours and the two it already listed', () => {
    for (const rule of PAGE_RULES) {
      const text = rule.on(lifetimeOn);
      expect(text, rule.id).not.toMatch(/best deal|best value|cheapest|bargain|forever|unlimited updates|save \$|saving/i);
      expect(text, rule.id).not.toMatch(/[—–]/);
      for (const figure of text.match(/\$\d+(?:\.\d+)?/g) ?? []) expect(['$2.99', '$29', '$2.42', U], `${rule.id}: ${figure}`).toContain(figure);
    }
  });

  it('say the plan is a subscription only together with the one-time Lifetime plan', () => {
    for (const rule of PAGE_RULES.filter(r => /subscription/.test(r.on(lifetimeOn)))) {
      expect(rule.on(lifetimeOn), rule.id).toMatch(/one-time Lifetime plan|Lifetime plan at \$99/);
    }
  });

  it('change nothing in the draft languages: no translated message holds an English sentence of theirs', async () => {
    const catalogs = import.meta.glob('../src/i18n/locales/{es,de,pt-BR}/*.ts', { eager: true });
    expect(Object.keys(catalogs).length).toBeGreaterThan(10);
    for (const [file, module] of Object.entries(catalogs)) {
      for (const [key, text] of Object.entries(module.messages ?? {})) {
        expect(flagAware(text, all) === text, `${file} ${key}`).toBe(true);
      }
    }
  });
});
