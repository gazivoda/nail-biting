// Pseudo-locale coverage for the core of Settings (scope "settings"): the Plan card, Detection and alarm, Periodic
// reminders, Alarm sound, Bite reasons, Appearance, Privacy and Data cards of src/pages/Settings.tsx, the Behaviors
// card and the false-alarm controls card. Each state is rendered with the German catalog on and every t() result
// marked; no word may be left outside the marks.
//
// Not reachable in a static render (they need a click first, and there is no DOM here): the "Notifications are
// blocked" note, the clear-all confirmation, the "Removed ... Undo" line and the "Playing" label of a preview.
// Their text is one t() call each (eslint local-i18n/no-hardcoded-text guards the JSX), and the last test below
// checks every message of the scope is used by the four files, so none of them can be left behind.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, setFlags, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { kv } from '../../storage/kv';
import { writeCalibration, writeSettings } from '../../falsePositive/poseStore';
import { writeStoredBehaviors } from '../../detection/selection';
import { messages } from '../scopes/settings';
import { SETTINGS_SECTIONS } from '../../pages/settings/meta';

const auth = vi.hoisted(() => ({ ctx: { user: null as unknown, accessStatus: 'no_auth' } }));
vi.mock('../../contexts/AuthContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../../contexts/AuthContext')>()),
  useAuth: () => ({
    ...auth.ctx, signingIn: false, signInWithGoogle: () => {}, signOut: async () => {}, refreshProfile: async () => {},
    authError: null, clearAuthError: () => {},
  }),
}));

// A server render reads the store's initial state, so a state a test wants (reminders on, custom reasons) is laid over
// the real store's state here, the way src/falsePositive/ui.test.tsx does for History.
const store = vi.hoisted(() => ({ over: {} as Record<string, unknown> }));
vi.mock('../../store/useAppStore', async importOriginal => {
  const real = await importOriginal<typeof import('../../store/useAppStore')>();
  const useAppStore = ((selector?: (s: unknown) => unknown) => {
    const state = { ...real.useAppStore.getState(), ...store.over };
    return selector ? selector(state) : state;
  }) as typeof real.useAppStore;
  return { ...real, useAppStore };
});

import { Settings } from '../../pages/Settings';
import { DetectionSettings } from '../../falsePositive/DetectionSettings';
import { BehaviorsSection } from '../../pages/settings/sections/BehaviorsSection';

export const COVERS = [
  'src/pages/Settings.tsx',
  'src/pages/settings/meta.ts',
  'src/pages/settings/sections/BehaviorsSection.tsx',
  'src/falsePositive/DetectionSettings.tsx',
];

// What a person typed (a custom bite reason) is shown as typed. The trial countdown ("5 days left") comes from
// utils/trial.ts and the lifetime/gift/free wording from billing/planLabel.ts, both owned by the billing group.
const FIXTURE = ['Tiredness', 'Commute', /^(days?|hours?|left|Less|than|an)$/];

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const user = (over: Record<string, unknown>) => ({
  id: 'u1', email: 'a@b.c', name: 'A', avatar: null, trial_end_date: null, subscription_status: 'expired', subscription_plan: null,
  subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, ...over,
});

beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} }); });
afterEach(() => {
  vi.unstubAllGlobals();
  store.over = {};
  auth.ctx = { user: null, accessStatus: 'no_auth' };
});

const page = () => renderToStaticMarkup(<Settings onUpgrade={() => {}} />);
// A message that takes another message as a parameter ("Preview {name}" with the sound's own name) comes out marked
// twice, ⟦⟦Beeps⟧ preview⟧. Only the outer marks matter to the scan, so the inner ones are dropped first.
function flattenMarks(html: string): string {
  let depth = 0;
  let out = '';
  for (const ch of html) {
    if (ch === '⟦') { depth += 1; if (depth === 1) out += ch; continue; }
    if (ch === '⟧') { if (depth === 1) out += ch; depth = Math.max(0, depth - 1); continue; }
    out += ch;
  }
  return out;
}
const check = (html: string) => {
  expectAllTranslated(flattenMarks(html), { allow: FIXTURE });
  expectNoMissingParams(html);
};

describe('Settings page, flags off, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('signed out: every card is translated', () => {
    const html = page();
    check(html);
    for (const heading of ['Einstellungen', 'Erkennung und Alarm', 'Regelmäßige Erinnerungen', 'Alarmton', 'Gründe für Bisse', 'Darstellung', 'Datenschutz', 'Daten']) {
      expect(html, heading).toContain(heading);
    }
    expect(html).not.toContain('Verhaltensweisen'); // the Behaviors card stays hidden while its flag is off
  });

  const plans: Array<[string, Record<string, unknown>, string]> = [
    ['free trial, days left', user({ subscription_status: 'trial', trial_end_date: iso(5) }), 'trial_active'],
    ['free trial, last day', user({ subscription_status: 'trial', trial_end_date: new Date(Date.now() + 3 * 3_600_000).toISOString() }), 'trial_active'],
    ['trial ended', user({ subscription_status: 'trial', trial_end_date: iso(-5) }), 'paywall'],
    ['yearly', user({ subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: '2027-03-04T00:00:00Z' }), 'subscribed'],
    ['monthly', user({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: '2027-03-04T00:00:00Z' }), 'subscribed'],
    ['active, plan unknown', user({ subscription_status: 'active' }), 'subscribed'],
    ['paused', user({ subscription_status: 'paused', subscription_plan: 'monthly', subscription_end_date: '2027-03-04T00:00:00Z' }), 'subscribed'],
    ['cancelled', user({ subscription_status: 'cancelled', subscription_end_date: '2027-03-04T00:00:00Z' }), 'subscribed'],
    ['expired', user({ subscription_status: 'expired' }), 'paywall'],
  ];
  for (const [name, u, status] of plans) {
    it(`Plan card: ${name}`, () => {
      auth.ctx = { user: u, accessStatus: status };
      const html = page();
      check(html);
      expect(html).toContain('Tarif'); // the card title
    });
  }

  it('Plan card: the subscription actions', () => {
    auth.ctx = { user: user({ subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: '2027-03-04T00:00:00Z' }), accessStatus: 'subscribed' };
    expect(page()).toContain('Abo verwalten');
    auth.ctx = { user: user({ subscription_status: 'trial', trial_end_date: iso(5) }), accessStatus: 'trial_active' };
    expect(page()).toContain('Tarif wählen');
  });

  it('reminders on shows the interval row; the volume at zero and other sounds and settings are translated too', () => {
    store.over = { remindersEnabled: true, alertVolume: 0, alertSound: 'whistle', alertType: 'both', detectionSensitivity: 'high', theme: 'dark', reminderIntervalMinutes: 30 };
    const html = page();
    check(html);
    expect(html).toContain('Intervall');
    expect(html).toContain('30m');
  });

  it('reminders off hides the interval row', () => {
    store.over = { remindersEnabled: false };
    const html = page();
    check(html);
    expect(html).not.toContain('Intervall');
  });

  it('custom bite reasons are listed as typed, with a translated remove button', () => {
    store.over = { customTags: [{ id: 'c1', label: 'Tiredness', emoji: '😴' }, { id: 'c2', label: 'Commute', emoji: '🚌' }] };
    const html = page();
    check(html);
    expect(html).toContain('Tiredness');
    expect(html).toContain('aria-label="⟦Tiredness entfernen⟧"');
  });
});

describe('Settings page, own flags on, pseudo-locale', () => {
  usePseudoLocale({ flags: ['detection_behaviors', 'false_positive_controls'] });

  it('the Behaviors and Detection cards appear inside the page and are translated', () => {
    auth.ctx = { user: user({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: '2027-03-04T00:00:00Z' }), accessStatus: 'subscribed' };
    const html = page();
    check(html);
    expect(html).toContain('Verhaltensweisen');
    expect(html).toContain('Welche Hand');
  });
});

describe('Behaviors card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['detection_behaviors'] });

  it('default selection: one behavior on, the note that one stays on, no experimental list', () => {
    const html = renderToStaticMarkup(<BehaviorsSection />);
    check(html);
    expect(html).toContain('Mindestens eines bleibt aktiv.');
    expect(html).not.toContain('Experimentell');
    expect(html).toContain('aria-label="⟦Auf Nägelkauen achten⟧"');
  });

  it('two selected: the note goes away', () => {
    setFlags('detection_behaviors', 'experimental'); // nose picking is offered only with the experimental flag
    writeStoredBehaviors(['nail_biting', 'nose_picking']);
    const html = renderToStaticMarkup(<BehaviorsSection />);
    check(html);
    expect(html).not.toContain('Mindestens eines bleibt aktiv.');
  });

  it('experimental flag: the experimental list has its heading, note and a sentence per toggle', () => {
    setFlags('detection_behaviors', 'experimental');
    const html = renderToStaticMarkup(<BehaviorsSection />);
    check(html);
    expect(html).toContain('Experimentell');
    for (const sentence of [
      'Auf Nasebohren achten', 'Auf Wimpern- und Augenbrauenzupfen achten', 'Auf Hautzupfen im Gesicht achten', 'Auf Haareausreißen achten',
      'Auf Nagelhaut- und Hautkauen achten',
    ]) expect(html, sentence).toContain(sentence);
  });
});

describe('Detection card (false-alarm controls), pseudo-locale', () => {
  usePseudoLocale({ flags: ['false_positive_controls'] });

  const learn = (n: number) => kv.set('falsePositive', 'learned', Array.from({ length: n }, (_, i) => ({
    at: Date.now() - 1000 - i, v: [2, 0.24, 0.05, 6, 0.65, 0.3], eventId: `e${i}`,
  })));

  it('defaults: both hands, chin rest on, nothing learned, no calibration', () => {
    const html = renderToStaticMarkup(<DetectionSettings />);
    check(html);
    expect(html).toContain('Noch nichts.');
    expect(html).toContain('Optional, etwa eine Minute');
  });

  it('left hand, chin rest off', () => {
    writeSettings({ handFilter: 'left', chinRest: false });
    check(renderToStaticMarkup(<DetectionSettings />));
  });

  it('right hand', () => {
    writeSettings({ handFilter: 'right' });
    check(renderToStaticMarkup(<DetectionSettings />));
  });

  for (const n of [1, 2, 40]) {
    it(`${n} learned pose(s): singular and plural, with the forget button enabled`, () => {
      learn(n);
      const html = renderToStaticMarkup(<DetectionSettings />);
      check(html);
      expect(html).toContain(n === 1 ? '1 Haltung gemerkt.' : `${n} Haltungen gemerkt.`);
    });
  }

  it('calibrated: the date, the re-calibrate and delete buttons', () => {
    writeCalibration({ at: new Date(2026, 9, 20, 12).getTime(), chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [], real: [], restFrames: 30, realFrames: 30 });
    const html = renderToStaticMarkup(<DetectionSettings />);
    check(html);
    expect(html).toContain('Erneut kalibrieren');
    expect(html).toContain('Kalibrierung löschen');
    expect(html).toContain('Kalibriert am 20. Okt. 2026');
  });
});

describe('the registry titles are internal, never rendered', () => {
  it('SETTINGS_SECTIONS keeps its English words (settings.test.tsx pins them)', () => {
    expect(SETTINGS_SECTIONS.map(s => s.title)).toEqual(['Detection', 'Alerts', 'Behaviors', 'Schedule', 'Account & Sync', 'Data', 'Sharing']);
  });
});

describe('the settings scope', () => {
  it('has no message that none of the four files uses (a dead translation)', () => {
    const source = COVERS.map(f => readFileSync(f, 'utf8')).join('\n');
    const unused = Object.keys(messages).filter(key => !source.includes(`'${key}'`));
    expect(unused).toEqual([]);
  });
});
