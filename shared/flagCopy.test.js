import { describe, it, expect } from 'vitest';
import {
  COPY_FLAGS, RULES, anyRuleActive, dropEmptySections, fillCopyTokens, fillCopyTokensDeep, flagAware, flagAwareDeep,
  mentionsFlagCopy, resolveMarkers, signInAnswer,
} from './flagCopy.js';
import { FLAG_NAMES } from '../server/features.js';

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
const lifetimeOn = only('lifetime_plan');
const WITHOUT_LIFETIME = COPY_FLAGS.filter(f => f !== 'lifetime_plan');
// What the Lifetime card and the Terms say, word for word (src/i18n/scopes/plans.ts lifetime.band.body).
const CARD_WORDS = 'It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered.';

describe('the Lifetime rules', () => {
  it('cover the pricing questions and the two homepage answers that listed two plans, and nothing else', () => {
    expect(LIFETIME_RULES.map(r => r.id).sort()).toEqual([
      'home-faq-cancel', 'home-faq-cost', 'pricing-faq-difference', 'pricing-faq-difference-q', 'pricing-faq-pick-plan',
    ]);
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

  it('never quote a Lifetime price or a saving, call it the best deal, or promise more than the card does', () => {
    for (const rule of LIFETIME_RULES) {
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
    // server.js runs these rules (copyHtml) BEFORE server/marketing/lifetimeCopy.js looks for its anchors: a rule that
    // reworded an anchor would make the Lifetime section silently vanish.
    const { ANCHORS } = await import('../server/marketing/lifetimeCopy.js');
    for (const [name, anchor] of Object.entries(ANCHORS)) {
      expect(flagAware(anchor, lifetimeOn), `anchor ${name}`).toBe(anchor);
      for (const rule of LIFETIME_RULES) expect(anchor.includes(rule.off) || rule.off.includes(anchor), `${rule.id} vs anchor ${name}`).toBe(false);
    }
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
