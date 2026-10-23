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
