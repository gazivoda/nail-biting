// Pseudo-locale coverage for scope "coaching": the 4-week program page, the urge timer, the card shown after an alarm,
// the stats line, the Alerts card in Settings and the small texts around them. Each state is rendered with the German
// catalog on and every t() result marked; no word may be left outside the marks.
//
// LESSON TEXT IS INTENTIONALLY ENGLISH. The 28 lessons, the week titles and summaries, and the program's intro,
// pace and disclaimer live in src/data/hrtProgram.json. They are marked NEEDS HUMAN REVIEW and are not translated
// (WS12 scope decision); only the chrome around them is. So the tests below take every one of those strings out of
// the HTML before scanning (`withoutLessonText`). That is stricter than putting the lesson words on the allow list:
// a chrome word that happens to appear in a lesson (Day, Try, Done, Start...) still counts as a leak.
//
// Not reachable in a static render: the clicks themselves. The states a click would reach are rendered through
// the `initial` props of UrgeTimer and Program (a later step of the timer, a picked lesson, the reset question).
// ProgramView's portal and CoachingBridge's effect need a DOM; see the NOT-RENDERED lines.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { messages, t } from '../scopes/coaching';
import { cardMessages } from '../scopes/coachingCard';
import { resetLocaleForTests, setOutputTransformForTests } from '../core';
import { createStoredEvent } from '../../storage/eventModel';
import type { Incident } from '../../types';
import { PROGRAM } from '../../coaching/program';
import { PROGRAM_LESSON_COUNT, localDateKey, resetProgressCache, saveProgress } from '../../coaching/programProgress';
import { DEFAULT_COACHING_SETTINGS, MAX_CUSTOM_RESPONSES, PRESET_RESPONSES, resetCoachingSettingsCache, saveCoachingSettings, selectedResponseText } from '../../coaching/settings';
import { IDLE, offer, type CoachingSession } from '../../coaching/session';
import { cardAnnouncement, cardText, setCardText } from '../../coaching/cardText';
import { CoachingCard } from '../../coaching/CoachingCard';
import { CoachingStatsLine } from '../../coaching/CoachingStatsLine';
import { UrgeTimer, type Ui } from '../../coaching/UrgeTimer';
import { ProgramEntry } from '../../coaching/ProgramEntry';
import { Overlay } from '../../coaching/ProgramView';
import { Program } from '../../pages/Program';
import { CoachingSettings } from '../../pages/settings/CoachingSettings';
import { formatRate } from '../../utils/coachingStats';

// The history the stats line reads. zustand 5 gives a server render (renderToStaticMarkup) the store's INITIAL state, so
// useAppStore.setState() would not show up here; the hook is told to read this list instead.
const history = vi.hoisted(() => ({ incidents: [] as unknown[] }));
vi.mock('../../store/useAppStore', async importOriginal => {
  const real = await importOriginal<typeof import('../../store/useAppStore')>();
  const useAppStore = Object.assign(
    (selector: (s: unknown) => unknown) => selector({ ...real.useAppStore.getState(), incidents: history.incidents }),
    real.useAppStore,
  );
  return { ...real, useAppStore };
});

export const COVERS = [
  'src/pages/Program.tsx',
  'src/pages/settings/CoachingSettings.tsx',
  'src/coaching/UrgeTimer.tsx',
  'src/coaching/CoachingCard.tsx',
  'src/coaching/CoachingSeam.tsx',
  'src/coaching/CoachingStatsLine.tsx',
  'src/coaching/cardText.ts',
  'src/coaching/settings.ts',
  'src/coaching/ProgramEntry.tsx',
  'src/coaching/ProgramView.tsx',
  'src/utils/coachingStats.ts',
];
// NOT-RENDERED src/coaching/CoachingBridge.tsx: renders nothing and its only text-related line is the effect that hands the card the coaching scope's t(); the test below reads the file for that line and renders the card with that translator installed.

// What a person typed (their own competing response) is shown as typed.
const CUSTOM = ['Squeeze a stress ball', 'Wiggle your toes'];
const FIXTURE = [/^(Squeeze|stress|ball|Wiggle|your|toes)$/];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

// every string of the program's content (intentionally English), longest first so no fragment of a paragraph is left behind
const LESSON_STRINGS = [
  PROGRAM.title, PROGRAM.intro, PROGRAM.pace, PROGRAM.disclaimer,
  ...PROGRAM.weeks.flatMap(w => [w.title, w.summary]),
  ...PROGRAM.lessons.flatMap(l => [l.title, ...l.body, l.tryToday]),
]
  .map(escapeHtml)
  .sort((a, b) => b.length - a.length);

/** The HTML with the (English on purpose) lesson content and the development-only review note taken out. */
function withoutLessonText(html: string): string {
  let out = html.replace(/NEEDS HUMAN REVIEW \(shown in development builds only\):[^<]*/g, '');
  for (const s of LESSON_STRINGS) out = out.split(s).join('');
  return out;
}

/** The HTML without the marks, to read a sentence whose pieces (a rich tag, a number) were marked one by one. */
const plain = (html: string) => html.replace(/[⟦⟧]/g, '');

const check = (html: string, options: { allow?: Array<string | RegExp> } = {}) => {
  expectAllTranslated(html, options);
  expectNoMissingParams(html);
};

const DAY = 86_400_000;
const today = () => localDateKey(new Date());
const daysAgo = (n: number) => localDateKey(new Date(Date.now() - n * DAY));
const allLessons = (on: string) => Object.fromEntries(Array.from({ length: PROGRAM_LESSON_COUNT }, (_, i) => [String(i + 1), on]));

const alarmEvent = (i: number, done: boolean | null): Incident =>
  createStoredEvent({
    tag: 'unknown',
    autoDetected: true,
    now: Date.now() - (10 - i) * 60_000,
    id: `a${i}`,
    ...(done === null ? {} : { extras: { competingResponse: { done, durationSec: 30 } } }),
  });

beforeEach(() => {
  history.incidents = [];
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  resetProgressCache();
  resetCoachingSettingsCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCardText(null);
  resetProgressCache();
  resetCoachingSettingsCache();
});

describe('the card after an alarm, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });
  beforeEach(() => setCardText(t)); // what CoachingBridge does in the app

  const card = (over: Partial<Parameters<typeof CoachingCard>[0]> = {}) =>
    renderToStaticMarkup(
      <CoachingCard variant="main" phase="running" text={PRESET_RESPONSES[0].text} remainingSec={23} progress={0.2} onDone={() => {}} onSkip={() => {}} {...over} />,
    );

  it('the card over the app, running and finished', () => {
    for (const phase of ['running', 'finished'] as const) {
      const html = card({ phase });
      check(html);
      expect(html).toContain(phase === 'running' ? '⟦Probier stattdessen das⟧' : '⟦Mit diesem Alarm gespeichert⟧');
    }
  });

  it('the strip in the minimized window, running and finished', () => {
    for (const phase of ['running', 'finished'] as const) check(card({ variant: 'pip', phase }));
  });

  it('a response the person wrote is shown as typed, the rest of the card is translated', () => {
    check(card({ text: CUSTOM[0] }), { allow: FIXTURE });
    check(card({ text: CUSTOM[0], variant: 'pip' }), { allow: FIXTURE });
  });

  it('what a screen reader hears, for every phase', () => {
    const running = offer(IDLE, { eventId: 'e1', text: CUSTOM[0], durationSec: 30 }, Date.now());
    const finished: CoachingSession = { phase: 'finished', eventId: 'e1', text: CUSTOM[0], durationSec: 30, finishedAt: Date.now() };
    for (const s of [running, finished, IDLE]) {
      const html = renderToStaticMarkup(<p role="status">{cardAnnouncement(s)}</p>);
      if (s.phase === 'idle') expect(html).not.toContain('⟦');
      else check(html, { allow: FIXTURE });
    }
    expect(cardAnnouncement(running)).toContain('30 Sekunden');
  });

  it('CoachingBridge hands the card the coaching scope translator', () => {
    const bridge = readFileSync('src/coaching/CoachingBridge.tsx', 'utf8');
    expect(bridge).toMatch(/setCardText\(t\)/);
    expect(bridge).toMatch(/from '\.\.\/i18n\/scopes\/coaching'/);
  });
});

describe('the card with no translator installed (the home-page demo, or the flag off)', () => {
  beforeEach(() => { resetLocaleForTests(); setOutputTransformForTests(null); setCardText(null); });
  afterEach(() => resetLocaleForTests());

  it('says exactly what the scope says in English, for every message of the card', () => {
    const params = { text: 'Clench your fists', seconds: 30 };
    for (const key of Object.keys(cardMessages) as Array<keyof typeof cardMessages>) {
      expect(cardText(key, params), key).toBe(t(key, params));
    }
    expect(cardText('card.announceRunning', params)).toBe('Clench your fists. 30 seconds. Press Done when you have finished, or Skip, or Escape, to dismiss.');
  });
});

describe('the urge timer, pseudo-locale', () => {
  usePseudoLocale({ flags: ['urge_timer'] });

  const running = (ageMs: number): Ui => {
    const session = offer(IDLE, { eventId: 'e1', text: 'x', durationSec: 60 }, Date.now() - ageMs);
    if (session.phase !== 'running') throw new Error('expected a running session');
    return { step: 'running', session };
  };
  const phases: Array<[string, Ui | undefined]> = [
    ['idle', undefined],
    ['choosing a length', { step: 'choose' }],
    ['breathing in', running(1_000)],
    ['breathing out', running(6_000)],
    ['logged after stopping', { step: 'logged', eventId: 'e1', done: false }],
    ['logged after the timer finished', { step: 'logged', eventId: 'e1', done: true }],
  ];

  it.each(phases)('%s: every word is translated', (_name, initial) => {
    check(renderToStaticMarkup(<UrgeTimer initial={initial} />));
  });

  it('says what the screen reader needs while it runs and after it is logged', () => {
    expect(renderToStaticMarkup(<UrgeTimer initial={running(1_000)} />)).toContain('Atem-Timer gestartet, 60 Sekunden');
    expect(renderToStaticMarkup(<UrgeTimer initial={{ step: 'logged', eventId: 'e1', done: true }} />)).toContain('Timer beendet. Als Drang erfasst.');
    expect(renderToStaticMarkup(<UrgeTimer initial={{ step: 'choose' }} />)).toContain('60 Sekunden');
  });
});

describe('the stats line, pseudo-locale', () => {
  usePseudoLocale({ flags: ['hrt_coaching'] });

  it('says nothing when there is nothing to say', () => {
    expect(renderToStaticMarkup(<CoachingStatsLine />)).toBe('');
    history.incidents = [alarmEvent(1, null), alarmEvent(2, null)];
    expect(renderToStaticMarkup(<CoachingStatsLine />)).toBe('');
  });

  it('one alarm', () => {
    history.incidents = [alarmEvent(1, true)];
    const html = renderToStaticMarkup(<CoachingStatsLine />);
    check(html);
    expect(plain(html)).toContain('1 von 1</span> Alarm wurde');
  });

  it('many alarms', () => {
    history.incidents = [alarmEvent(1, true), alarmEvent(2, false), alarmEvent(3, true), alarmEvent(4, true)];
    const html = renderToStaticMarkup(<CoachingStatsLine className="mt-6" />);
    check(html);
    expect(plain(html)).toContain('3 von 4</span> Alarme wurden');
    expect(plain(html)).toMatch(/75\s%/); // the German way of writing a percentage
    expect(html).toContain('class="font-semibold tabular-nums"'); // the bold span of the rich message
  });

  it('formatRate follows the language', () => {
    expect(formatRate(null)).toBeNull();
    expect(formatRate(0.75)).toMatch(/^75\s%$/);
    expect(formatRate(1 / 3)).toMatch(/^33\s%$/);
  });
});

describe('the Alerts card in Settings (flag on), pseudo-locale', () => {
  usePseudoLocale({ flags: ['hrt_coaching'] });

  it('the defaults', () => {
    const html = renderToStaticMarkup(<CoachingSettings />);
    check(html);
    for (const text of ['Alarme', 'Hinweis zur Ersatzhandlung', 'Aus', 'Einmal pro Stunde', 'Bei jedem Alarm', 'Balle die Fäuste']) expect(html).toContain(text);
  });

  it.each(['off', 'hourly', 'every'] as const)('prompt mode %s, with a saved length', promptMode => {
    saveCoachingSettings({ ...DEFAULT_COACHING_SETTINGS, promptMode, durationSec: 45 });
    const html = renderToStaticMarkup(<CoachingSettings />);
    check(html);
    expect(html).toContain('aria-valuetext="⟦45 Sekunden⟧"');
    expect(html).toContain('⟦45 s⟧');
  });

  it('a response the person wrote: shown as typed, with a Remove button that names it', () => {
    saveCoachingSettings({ ...DEFAULT_COACHING_SETTINGS, custom: [{ id: 'mine-1', text: CUSTOM[0] }], selectedId: 'mine-1' });
    const html = renderToStaticMarkup(<CoachingSettings />);
    check(html, { allow: FIXTURE });
    expect(html).toContain(CUSTOM[0]);
    expect(html).toContain('aria-label="⟦„Squeeze a stress ball“ entfernen⟧"');
  });

  it('the list is full', () => {
    const custom = Array.from({ length: MAX_CUSTOM_RESPONSES }, (_, i) => ({ id: `mine-${i}`, text: i % 2 ? CUSTOM[0] : CUSTOM[1] }));
    saveCoachingSettings({ ...DEFAULT_COACHING_SETTINGS, custom });
    const html = renderToStaticMarkup(<CoachingSettings />);
    check(html, { allow: FIXTURE });
    expect(html).toContain('⟦Die Liste ist voll. Entferne einen Eintrag, um einen neuen hinzuzufügen.⟧');
  });

  it('with some alarms behind it, the stats line sits in the card', () => {
    history.incidents = [alarmEvent(1, true), alarmEvent(2, false)];
    const html = renderToStaticMarkup(<CoachingSettings />);
    check(html);
    expect(plain(html)).toContain('1 von 2</span>');
  });

  it('the suggestions are translated by id; a typed one is not', () => {
    for (const p of PRESET_RESPONSES) {
      saveCoachingSettings({ ...DEFAULT_COACHING_SETTINGS, selectedId: p.id });
      check(renderToStaticMarkup(<p>{selectedResponseText({ ...DEFAULT_COACHING_SETTINGS, selectedId: p.id })}</p>));
    }
    const typed = { ...DEFAULT_COACHING_SETTINGS, custom: [{ id: 'mine-1', text: CUSTOM[0] }], selectedId: 'mine-1' };
    expect(selectedResponseText(typed)).toBe(CUSTOM[0]);
  });
});

describe('the 4-week program page, pseudo-locale', () => {
  usePseudoLocale({ flags: ['hrt_coaching'] });
  const page = (initial?: Parameters<typeof Program>[0]['initial']) => withoutLessonText(renderToStaticMarkup(<Program onClose={() => {}} initial={initial} />));

  it('not started: the Start button and its note', () => {
    const html = page();
    check(html);
    for (const text of ['Zurück zur App', 'Programm starten', 'Die erste Lektion öffnet sich sofort.']) expect(html, text).toContain(text);
  });

  it('just started: the first lesson, the progress line, the lesson list with locked days', () => {
    saveProgress({ version: 1, startedOn: today(), completed: {} });
    const html = page();
    check(html);
    for (const text of ['0 von 28 Lektionen erledigt', 'Alle Lektionen', 'Tag 1', 'Noch nicht geöffnet', 'Als erledigt markieren', 'Heute ausprobieren', 'Programm erneut starten']) {
      expect(html, text).toContain(text);
    }
    expect(html).toMatch(/Tag 1 von 28, /);
  });

  it('the first lesson done today: the next one opens tomorrow', () => {
    saveProgress({ version: 1, startedOn: today(), completed: { '1': today() } });
    const html = page();
    check(html);
    expect(html).toContain('Fertig. Die nächste Lektion öffnet sich morgen.');
    expect(html).toContain('1 von 28 Lektionen erledigt');
  });

  it('days done earlier: the badges, and the next lesson open', () => {
    saveProgress({ version: 1, startedOn: daysAgo(5), completed: { '1': daysAgo(3), '2': daysAgo(2), '3': daysAgo(1) } });
    const html = page();
    check(html);
    expect(html).toContain('⟦Fertig⟧');
    expect(html).toContain('Als erledigt markieren');
  });

  it('a lesson picked from the list that was done on an earlier day', () => {
    saveProgress({ version: 1, startedOn: daysAgo(5), completed: { '1': daysAgo(3), '2': daysAgo(2) } });
    const html = page({ picked: 1 });
    check(html);
    expect(html).toContain('⟦Fertig.⟧');
    expect(html).not.toContain('Als erledigt markieren');
  });

  it('a lesson picked that is not open yet has no Mark as done', () => {
    saveProgress({ version: 1, startedOn: today(), completed: {} });
    const html = page({ picked: 5 });
    check(html);
    expect(html).not.toContain('Als erledigt markieren');
  });

  it('all 28 done: the last lesson', () => {
    saveProgress({ version: 1, startedOn: daysAgo(40), completed: allLessons(daysAgo(1)) });
    const html = page();
    check(html);
    expect(html).toContain('Du hast alle 28 Lektionen abgeschlossen.');
    expect(html).toContain('Fertig. Das war die letzte Lektion.');
  });

  it('the question before starting again', () => {
    saveProgress({ version: 1, startedOn: today(), completed: { '1': today() } });
    const html = page({ confirmReset: true });
    check(html);
    expect(html).toContain('Noch einmal bei Lektion 1 beginnen?');
    expect(html).toContain('Ja, neu beginnen');
    expect(html).toContain('Abbrechen');
  });

  it('with alarms behind it, the stats line is on the page', () => {
    saveProgress({ version: 1, startedOn: today(), completed: {} });
    history.incidents = [alarmEvent(1, true)];
    const html = page();
    check(html);
    expect(plain(html)).toContain('1 von 1</span> Alarm wurde');
  });

  it('the lesson text really is English on purpose: the page shows it unchanged', () => {
    saveProgress({ version: 1, startedOn: today(), completed: {} });
    const html = renderToStaticMarkup(<Program onClose={() => {}} />);
    expect(html).toContain(escapeHtml(PROGRAM.lessons[0].title));
    expect(html).toContain(escapeHtml(PROGRAM.intro));
  });
});

describe('the quiet link on the Watch tab, pseudo-locale', () => {
  usePseudoLocale({ flags: ['hrt_coaching'] });

  it('not started, in progress, finished', () => {
    const states = [
      [{ version: 1, startedOn: null, completed: {} }, '⟦4-Wochen-Programm⟧'],
      [{ version: 1, startedOn: today(), completed: { '1': daysAgo(1), '2': daysAgo(1) } }, '⟦4-Wochen-Programm, 2 von 28 Lektionen erledigt⟧'],
      [{ version: 1, startedOn: daysAgo(40), completed: allLessons(daysAgo(1)) }, '⟦4-Wochen-Programm, abgeschlossen⟧'],
    ] as const;
    for (const [progress, expected] of states) {
      resetProgressCache();
      saveProgress(progress);
      const html = renderToStaticMarkup(<ProgramEntry />);
      check(html);
      expect(html).toContain(expected);
    }
  });
});

describe('the loading text of the program view, pseudo-locale', () => {
  usePseudoLocale({ flags: ['hrt_coaching'] });

  it('is the shared word, translated', () => {
    const html = renderToStaticMarkup(<Overlay />);
    check(withoutLessonText(html));
  });
});

describe('the scope', () => {
  it('every message is used by a file of the group (none can be left behind)', () => {
    const source = [
      'src/pages/Program.tsx', 'src/pages/settings/CoachingSettings.tsx', 'src/coaching/UrgeTimer.tsx', 'src/coaching/CoachingStatsLine.tsx',
      'src/coaching/settings.ts', 'src/coaching/ProgramEntry.tsx', 'src/coaching/CoachingCard.tsx', 'src/coaching/cardText.ts',
    ].map(f => readFileSync(f, 'utf8')).join('\n');
    const unused = Object.keys(messages).filter(key => !source.includes(`'${key}'`));
    expect(unused, `messages nobody uses: ${unused.join(', ')}`).toEqual([]);
  });
});
