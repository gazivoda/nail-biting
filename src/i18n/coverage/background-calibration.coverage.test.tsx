// Pseudo-locale coverage for background watching (pause card, meeting mode, schedule settings, reminders, the slow-tab
// note) and the calibration walk-through. Each screen is rendered in every state with the German catalog on and every
// t() result marked; whatever is left outside the marks was not produced by t() (see src/i18n/testing/pseudo.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { ScheduleSettings, ScheduleNotice, type Notice } from '../../background/ScheduleSettings';
import { BackgroundSlot } from '../../background/BackgroundSlot';
import { PausedOverlay } from '../../background/PausedOverlay';
import { useWatchGate } from '../../background/gate';
import { watchNote } from '../../background/watchText';
import { cadenceNote, saveCadence, FULL_RATE } from '../../background/cadence';
import { REMINDER_TITLE, REMINDER_BODY, showStartWatchingReminder } from '../../background/reminders';
import { DEFAULT_SCHEDULE, describeSchedule, formatClock, weekdayLong, type Schedule } from '../../background/schedule';
import { describeEnd, untilTomorrow, weekdayShort } from '../../background/pauseMachine';
import { saveSchedule } from '../../background/scheduleStore';
import { dispatchWatch, resetWatchForTests } from '../../background/watchStore';
import { CalibrationPanel, type CalibrationPanelProps } from '../../calibration/CalibrationView';
import { START, begin, failureMessage, tick, type CalibrationState } from '../../calibration/steps';
import { CALIBRATION } from '../../detection/calibration';
import { messages } from '../scopes/background';

export const COVERS = [
  'src/background/ScheduleSettings.tsx',
  'src/background/BackgroundSlot.tsx',
  'src/background/PausedOverlay.tsx',
  'src/background/gate.ts',
  'src/background/watchText.ts',
  'src/background/cadence.ts',
  'src/background/reminders.ts',
  'src/background/schedule.ts',
  'src/background/pauseMachine.ts',
  'src/calibration/CalibrationView.tsx',
  'src/calibration/steps.ts',
];
// src/background/BackgroundHost.tsx, BackgroundRunner.tsx, actions.ts, wiring.ts: no text, so they do not import src/i18n.
// src/calibration/runner.ts: no text of its own (its camera errors come from cameraErrorCopy, covered with the camera view).

const g = globalThis as unknown as Record<string, unknown>;
const MIN = 60_000;
const NOW = new Date(2026, 9, 23, 14, 0).getTime(); // a Friday afternoon

beforeEach(() => resetWatchForTests());
afterEach(() => {
  resetWatchForTests();
  delete g.Notification;
  delete g.window;
});

function allTranslated(html: string, allow: Array<string | RegExp> = []) {
  expectAllTranslated(html, { allow });
  expectNoMissingParams(html);
}

const sched = (over: Partial<Schedule> = {}): Schedule => ({ ...DEFAULT_SCHEDULE, enabled: true, ...over });

describe('Settings > Schedule, pseudo-locale', () => {
  usePseudoLocale({ flags: ['background_watching'] });

  it('off: the switch, its explanation and the two notes', () => {
    allTranslated(renderToStaticMarkup(<ScheduleSettings />));
  });

  it('on, with the default hours and days', () => {
    saveSchedule(sched());
    const html = renderToStaticMarkup(<ScheduleSettings />);
    allTranslated(html);
    // the day buttons say the short name and are read out with the long one (weekdayLong/weekdayShort return marked text here)
    expect(html).toContain(`aria-label="${weekdayLong(1)}"`);
    expect(html).toContain(`>${weekdayShort(1)}</button>`);
    expect(html).toContain('Mo bis Fr');
  });

  it('on, with some days, every day, no days and an overnight window', () => {
    for (const s of [
      sched({ days: [2, 4] }),
      sched({ days: [0, 1, 2, 3, 4, 5, 6] }),
      sched({ days: [] }),
      sched({ days: [5], startMinutes: 22 * 60, endMinutes: 6 * 60 }),
      sched({ days: [], startMinutes: 22 * 60, endMinutes: 6 * 60 }),
    ]) {
      saveSchedule(s);
      allTranslated(renderToStaticMarkup(<ScheduleSettings />));
    }
  });

  it('on, after the browser has blocked notifications', () => {
    saveSchedule(sched());
    g.Notification = { permission: 'denied', requestPermission: vi.fn() };
    const html = renderToStaticMarkup(<ScheduleSettings />);
    allTranslated(html);
    expect(html).toContain('blockiert');
  });

  it('every notice the card can show after turning the reminder on', () => {
    for (const notice of ['explain', 'unanswered', 'denied', 'unsupported'] as Notice[]) {
      for (const asking of [false, true]) {
        const html = renderToStaticMarkup(<ScheduleNotice notice={notice} asking={asking} onAllow={() => {}} onNotNow={() => {}} />);
        allTranslated(html);
        expect(html.length).toBeGreaterThan(0);
      }
    }
    expect(renderToStaticMarkup(<ScheduleNotice notice={null} asking={false} onAllow={() => {}} onNotNow={() => {}} />)).toBe('');
  });
});

describe('the Watch tab pause card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['background_watching'] });

  it('watching: the three pauses, the three meeting lengths and the background note', () => {
    const html = renderToStaticMarkup(<BackgroundSlot />);
    allTranslated(html);
    for (const unit of ['⟦15 Minuten⟧', '⟦1 Stunde⟧', '⟦30 Minuten⟧', '⟦2 Stunden⟧']) expect(html).toContain(unit);
  });

  it('paused for a quarter of an hour, with the camera released and kept', () => {
    for (const releaseCamera of [true, false]) {
      resetWatchForTests();
      dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15, releaseCamera });
      allTranslated(renderToStaticMarkup(<BackgroundSlot />));
      allTranslated(renderToStaticMarkup(<PausedOverlay />));
    }
  });

  it('paused until tomorrow', () => {
    const now = Date.now();
    dispatchWatch({ type: 'pauseUntil', now, until: untilTomorrow(new Date(now)), releaseCamera: true });
    const html = renderToStaticMarkup(<BackgroundSlot />);
    allTranslated(html);
    allTranslated(renderToStaticMarkup(<PausedOverlay />));
  });

  it('in meeting mode', () => {
    dispatchWatch({ type: 'meeting', now: Date.now(), minutes: 60 });
    allTranslated(renderToStaticMarkup(<BackgroundSlot />));
    expect(renderToStaticMarkup(<PausedOverlay />)).toBe('');
  });

  it('with the note about a browser that slowed this tab down, both variants of the speed and of the advice', () => {
    for (const stepsPerSecond of [0.8, 2]) {
      for (const floats of [false, true]) {
        saveCadence({ at: Date.now(), seconds: 120, stepsPerSecond });
        if (floats) g.window = { documentPictureInPicture: {} };
        const html = renderToStaticMarkup(<BackgroundSlot />);
        delete g.window;
        allTranslated(html);
        expect(html).toMatch(floats ? /Minimieren/ : /eigenen Fenster/);
        expect(html).toContain(stepsPerSecond < 1.5 ? 'einmal pro Sekunde' : `${stepsPerSecond}-mal pro Sekunde`);
      }
    }
  });

  it('the gate hands out the same words the card shows', () => {
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15, releaseCamera: true });
    function Probe() {
      const gate = useWatchGate();
      return <p>{gate.note?.title}|{gate.note?.hint}|{gate.note?.short}|{gate.note?.strip.status}|{gate.note?.strip.detail}</p>;
    }
    allTranslated(renderToStaticMarkup(<Probe />));
  });
});

describe('the pause card with the flag off', () => {
  usePseudoLocale({ flags: [] });
  it('renders nothing', () => {
    expect(renderToStaticMarkup(<BackgroundSlot />)).toBe('');
    expect(renderToStaticMarkup(<PausedOverlay />)).toBe('');
  });
});

describe('the words for a pause or a meeting, pseudo-locale', () => {
  usePseudoLocale();

  const wrap = (...lines: Array<string | null | undefined>) => renderToStaticMarkup(<div>{lines.map((l, i) => <p key={i}>{l}</p>)}</div>);
  const clock = (ts: number) => `${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;

  it('watchNote: a pause (camera released and kept), "until tomorrow", a pause over a weekend, and a meeting', () => {
    const states = [
      { kind: 'paused', until: NOW + 15 * MIN, releaseCamera: true },
      { kind: 'paused', until: NOW + 15 * MIN, releaseCamera: false },
      { kind: 'paused', until: new Date(2026, 9, 24, 6, 0).getTime(), releaseCamera: true },
      { kind: 'paused', until: new Date(2026, 9, 26, 6, 0).getTime(), releaseCamera: true },
      { kind: 'meeting', until: NOW + 60 * MIN },
    ] as const;
    for (const state of states) {
      for (const c of [undefined, clock]) {
        const n = watchNote(state, NOW, c)!;
        allTranslated(wrap(n.title, n.detail, n.short, n.strip.status, n.strip.detail, n.hint));
      }
    }
    expect(watchNote({ kind: 'running' }, NOW)).toBeNull();
    expect(watchNote({ kind: 'stopped' }, NOW)).toBeNull();
  });

  it('describeEnd: today, tomorrow and every weekday', () => {
    const lines = [describeEnd(NOW + 15 * MIN, NOW), describeEnd(new Date(2026, 9, 24, 6, 0).getTime(), NOW, clock)];
    for (let d = 2; d < 9; d += 1) lines.push(describeEnd(new Date(2026, 9, 23 + d, 6, 0).getTime(), NOW, clock));
    allTranslated(wrap(...lines));
    expect(lines.join('|')).toContain('morgen');
  });

  it('the weekday names, short and long', () => {
    const names: string[] = [];
    for (let d = 0; d < 7; d += 1) names.push(weekdayShort(d), weekdayLong(d));
    allTranslated(wrap(...names));
    expect(new Set(names).size).toBe(14);
  });

  it('describeSchedule: weekdays, every day, no days, a few days, overnight', () => {
    const lines = [
      sched(), sched({ days: [0, 1, 2, 3, 4, 5, 6] }), sched({ days: [] }), sched({ days: [2, 4] }), sched({ days: [6, 0] }),
      sched({ startMinutes: 22 * 60, endMinutes: 6 * 60 }),
    ].flatMap(s => [describeSchedule(s), describeSchedule(s, formatClock)]);
    allTranslated(wrap(...lines));
  });

  it('cadenceNote: nothing when it is not slow or too old, else a sentence for each speed and advice', () => {
    const slow = { at: 10_000, seconds: 120, stepsPerSecond: 0.8 };
    expect(cadenceNote(null, 20_000, true)).toBeNull();
    expect(cadenceNote({ ...slow, stepsPerSecond: FULL_RATE }, 20_000, true)).toBeNull();
    const lines = [0.8, 1.5, 2, 2.9].flatMap(stepsPerSecond => [true, false].map(floats => cadenceNote({ ...slow, stepsPerSecond }, 20_000, floats)));
    expect(lines.every(l => l !== null)).toBe(true);
    allTranslated(wrap(...lines));
  });
});

describe('the schedule reminder notification, pseudo-locale', () => {
  usePseudoLocale();

  function shown(): { title: string; body: string } {
    const created: Array<{ title: string; options: { body: string } }> = [];
    class Fake {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, options: { body: string }) { created.push({ title, options }); }
      close() {}
    }
    g.Notification = Fake;
    g.window = { focus: () => {} };
    expect(showStartWatchingReminder()).toBe(true);
    return { title: created[0].title, body: created[0].options.body };
  }

  it('is built when it is shown, in the language of the app then', () => {
    const { title, body } = shown();
    allTranslated(renderToStaticMarkup(<div><p>{title}</p><p>{body}</p></div>));
  });

  it('the desktop notification goes through the same words', () => {
    const notify = vi.fn();
    g.window = { desktop: { notify } };
    expect(showStartWatchingReminder()).toBe(true);
    const sent = notify.mock.calls[0][0] as { title: string; body: string };
    allTranslated(renderToStaticMarkup(<div><p>{sent.title}</p><p>{sent.body}</p></div>));
  });

  it('keeps the English wording as constants, from the catalog source', () => {
    expect(REMINDER_TITLE).toBe(messages['reminder.title']);
    expect(REMINDER_BODY).toBe(messages['reminder.body']);
    expect(REMINDER_TITLE).toBe('Start watching?');
  });
});

// ─── calibration ─────────────────────────────────────────────────────────────

const pose = (over = {}) => ({ part: 'knuckle' as const, tipDist: 0.25, chinDist: 0.06, orient: 6, curl: 0.65, below: 0.3, ...over });
const fingertip = () => pose({ part: 'fingertip', tipDist: 0.04, chinDist: 0.3, orient: 0, curl: 0.55, below: 0.55 });
const T0 = 1_800_000_000_000;

function resultState(restN: number, realN: number): CalibrationState {
  const rest = Array.from({ length: restN }, () => pose());
  const real = Array.from({ length: realN }, () => fingertip());
  // walk the machine to its end so the outcome is the real one
  let s = begin(START, T0);
  s = { ...s, rest } as CalibrationState;
  s = tick(s, T0 + CALIBRATION.stepSeconds * 1000);
  s = tick(s, T0 + CALIBRATION.stepSeconds * 1000 + 5000);
  if (s.phase !== 'real') throw new Error('expected step 2');
  s = { ...s, real };
  return tick(s, T0 + CALIBRATION.stepSeconds * 2000 + 5000);
}

describe('calibration, pseudo-locale', () => {
  usePseudoLocale();

  const base = (over: Partial<CalibrationPanelProps>): CalibrationPanelProps => ({
    state: START, now: T0, link: 'ready', problem: null, seen: { hand: false, face: false }, onBegin: () => {}, ...over,
  });
  const render = (over: Partial<CalibrationPanelProps>) => renderToStaticMarkup(<CalibrationPanel {...base(over)} />);

  it('the intro, with the camera starting, ready and failed', () => {
    for (const link of ['starting', 'ready', 'error'] as const) allTranslated(render({ link }));
    expect(render({ link: 'starting' })).toContain('disabled=""');
    expect(render({ link: 'ready' })).not.toContain('disabled=""');
  });

  it('step 1 and step 2, with the camera seeing nothing, the face, and both', () => {
    const rest = begin(START, T0);
    const real = tick(tick(rest, T0 + CALIBRATION.stepSeconds * 1000), T0 + CALIBRATION.stepSeconds * 1000 + 5000);
    for (const state of [rest, real]) {
      for (const seen of [{ hand: false, face: false }, { hand: false, face: true }, { hand: true, face: true }]) {
        for (const now of [T0 + 1_000, T0 + (CALIBRATION.stepSeconds - 1) * 1000 + 500, T0 + CALIBRATION.stepSeconds * 1000 - 1]) {
          allTranslated(render({ state, seen, now }));
        }
      }
    }
  });

  it('the break between the steps, and the heading that goes with it', () => {
    const between = tick(begin(START, T0), T0 + CALIBRATION.stepSeconds * 1000);
    expect(between.phase).toBe('between');
    for (const now of [T0 + CALIBRATION.stepSeconds * 1000 + 1, T0 + CALIBRATION.stepSeconds * 1000 + 4000]) {
      allTranslated(render({ state: between, now }));
    }
  });

  it('the result when it worked: the numbers, Save and Try again', () => {
    const state = resultState(CALIBRATION.minFrames + 5, CALIBRATION.minFrames + 7);
    expect(state.phase === 'result' && state.outcome.ok).toBe(true);
    const html = render({ state });
    allTranslated(html);
    expect(html).toContain(String(CALIBRATION.minFrames + 5));
  });

  it('the result when it did not: each reason is said in words', () => {
    for (const [restN, realN] of [[0, CALIBRATION.minFrames + 5], [CALIBRATION.minFrames + 5, 0], [0, 0]]) {
      const state = resultState(restN, realN);
      expect(state.phase === 'result' && state.outcome.ok).toBe(false);
      allTranslated(render({ state }));
    }
    for (const reason of ['no-rest', 'no-real', 'no-either'] as const) {
      allTranslated(renderToStaticMarkup(<p>{failureMessage(reason)}</p>));
    }
  });

  it('an error from the camera is shown as it was given (the camera error texts are another area\'s); without one, the camera start message is', () => {
    const html = render({ link: 'error', problem: 'Fixture camera problem' });
    allTranslated(html, ['Fixture', 'camera', 'problem']);
    expect(html).toContain('Fixture camera problem');
    allTranslated(render({ link: 'error', problem: null }));
  });
});

describe('calibration, English (no language picked)', () => {
  const html = (state: CalibrationState, now = T0, link: CalibrationPanelProps['link'] = 'ready') =>
    renderToStaticMarkup(<CalibrationPanel state={state} now={now} link={link} problem={null} seen={{ hand: true, face: true }} onBegin={() => {}} />);

  it('says what it said before, word for word', () => {
    const intro = html(START);
    for (const s of [
      'Calibrate', 'Cancel', 'Your camera', 'The camera is on. Detection is paused while you calibrate.', 'Start', 'Not now',
      'This is optional and takes about a minute. It helps the app tell resting your chin from the real thing. You will do two short things while the camera looks at you.',
      'Rest your chin on your hand as you normally would.', 'Bring a fingertip near your lips.',
      'Nothing is recorded. Only a few numbers about where your hand was are kept, on this device: no picture. They are not part of your history, are not synced and are not uploaded. You can delete them in Settings, under Detection. Watching is paused while you do this.',
    ]) expect(intro, s).toContain(s);
    expect(html(START, T0, 'starting')).toContain('Starting the camera…');
    expect(html(START, T0, 'error')).toContain('The camera could not start.');

    const rest = begin(START, T0);
    const at = (seconds: number) => T0 + (CALIBRATION.stepSeconds - seconds) * 1000;
    const step1 = html(rest, at(12));
    expect(step1).toContain('Step 1 of 2');
    expect(step1).toContain('Hold it there. 12 seconds left.');
    expect(step1).toContain(`0 of ${CALIBRATION.minFrames} needed.`);
    expect(step1).toContain('The camera sees your face and your hand.');
    // English has always said "1 seconds"; the plural cases of the message keep that as it is
    expect(html(rest, at(1))).toContain('Hold it there. 1 seconds left.');

    const between = tick(rest, T0 + CALIBRATION.stepSeconds * 1000);
    expect(html(between, T0 + CALIBRATION.stepSeconds * 1000 + 1000)).toContain('Step 2 of 2 next');
    expect(html(between, T0 + CALIBRATION.stepSeconds * 1000 + 1000)).toContain('Take your hand away.');
    expect(html(between, T0 + CALIBRATION.stepSeconds * 1000 + 1000)).toContain('Step 2 starts in 4 seconds: you will bring a fingertip near your lips.');

    const done = resultState(CALIBRATION.minFrames + 5, CALIBRATION.minFrames + 7);
    const result = html(done);
    expect(result).toContain('Done.');
    expect(result).toContain('The app saw 15 frames of you resting your chin and 17 with a fingertip near your lips. Saving keeps a few numbers from them, on this device, and the chin-rest rule will use them.');
    expect(result).toContain('Close');
    expect(result).toContain('Save');
    expect(result).toContain('Try again');

    const failed = html(resultState(0, 0));
    expect(failed).toContain('That did not work.');
    expect(failed).toContain('The camera did not see your hand. Check that your face and hand are in the picture and try again.');
  });
});

describe('background texts, English (no language picked)', () => {
  it('keeps the exact words, including the weekday and the time words', () => {
    const clock = (ts: number) => `${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;
    expect(describeEnd(new Date(2026, 9, 24, 6, 0).getTime(), NOW, clock)).toBe('tomorrow 6:00');
    expect(describeEnd(new Date(2026, 9, 26, 6, 0).getTime(), NOW, clock)).toBe('Mon 6:00');
    expect(describeSchedule(sched({ days: [] }), formatClock)).toBe('09:00 to 17:00, no days chosen');
    expect(describeSchedule(sched({ days: [0, 6], startMinutes: 22 * 60, endMinutes: 6 * 60 }), formatClock)).toBe('22:00 to 06:00 (next morning), Sun, Sat');
    expect(watchNote({ kind: 'meeting', until: NOW + 60 * MIN }, NOW, clock)!.strip).toEqual({ status: 'Watching', detail: 'silent until 15:00' });
    expect(weekdayLong(3)).toBe('Wednesday');
    expect(cadenceNote({ at: 0, seconds: 90, stepsPerSecond: 2.4 }, 1000, true)).toBe(
      'While this tab was in the background, checks ran about 2 a second instead of 5. The Minimize button floats a small window that keeps the full speed.',
    );
  });
});
