import { describe, it, expect } from 'vitest';
import {
  MAX_MEETING_MINUTES,
  MAX_PAUSE_MINUTES,
  cameraStreamEnabled,
  desktopPauseDetail,
  describeEnd,
  effectiveAlertType,
  endsAt,
  inferenceEnabled,
  isSilent,
  minutesLeft,
  reduceWatch,
  restoreWatch,
  serializeWatch,
  shouldReleaseCamera,
  untilTomorrow,
  type WatchEvent,
  type WatchState,
} from './pauseMachine';

const T0 = new Date(2026, 9, 23, 14, 0, 0).getTime(); // Fri 23 Oct 2026 14:00 local
const MIN = 60_000;
const run: WatchState = { kind: 'running' };
const stopped: WatchState = { kind: 'stopped' };

const apply = (s: WatchState, ...events: WatchEvent[]) => events.reduce(reduceWatch, s);

describe('pause', () => {
  it('pauses a running watch for the given minutes and remembers when it ends', () => {
    expect(reduceWatch(run, { type: 'pause', now: T0, minutes: 15 })).toEqual({ kind: 'paused', until: T0 + 15 * MIN, releaseCamera: true });
    expect(reduceWatch(run, { type: 'pause', now: T0, minutes: 60 })).toEqual({ kind: 'paused', until: T0 + 60 * MIN, releaseCamera: true });
  });

  it('can keep the camera open (browsers that would ask again)', () => {
    const s = reduceWatch(run, { type: 'pause', now: T0, minutes: 15, releaseCamera: false });
    expect(s).toEqual({ kind: 'paused', until: T0 + 15 * MIN, releaseCamera: false });
    expect(cameraStreamEnabled(true, s)).toBe(true);
    expect(inferenceEnabled(true, s)).toBe(false);
  });

  it('a new pause replaces the old one instead of adding to it', () => {
    const s = apply(run, { type: 'pause', now: T0, minutes: 60 }, { type: 'pause', now: T0 + 10 * MIN, minutes: 15 });
    expect(s).toEqual({ kind: 'paused', until: T0 + 25 * MIN, releaseCamera: true });
  });

  it('ignores a pause with a length that is not a number, too short or too long', () => {
    for (const minutes of [0, -5, 0.5, NaN, Infinity, MAX_PAUSE_MINUTES + 1]) {
      expect(reduceWatch(run, { type: 'pause', now: T0, minutes })).toBe(run);
    }
    expect(reduceWatch(run, { type: 'pause', now: NaN, minutes: 15 })).toBe(run);
    expect(reduceWatch(run, { type: 'pause', now: T0, minutes: MAX_PAUSE_MINUTES }).kind).toBe('paused');
  });

  it('pauseUntil needs an end that is ahead, and not more than the maximum away', () => {
    expect(reduceWatch(run, { type: 'pauseUntil', now: T0, until: T0 + 90 * MIN })).toEqual({ kind: 'paused', until: T0 + 90 * MIN, releaseCamera: true });
    expect(reduceWatch(run, { type: 'pauseUntil', now: T0, until: T0 })).toBe(run);
    expect(reduceWatch(run, { type: 'pauseUntil', now: T0, until: T0 - 1 })).toBe(run);
    expect(reduceWatch(run, { type: 'pauseUntil', now: T0, until: T0 + (MAX_PAUSE_MINUTES + 1) * MIN })).toBe(run);
  });

  it('cannot pause what is not running', () => {
    expect(reduceWatch(stopped, { type: 'pause', now: T0, minutes: 15 })).toBe(stopped);
    expect(reduceWatch(stopped, { type: 'pauseUntil', now: T0, until: T0 + MIN })).toBe(stopped);
  });
});

describe('auto-resume (tick)', () => {
  const paused = reduceWatch(run, { type: 'pause', now: T0, minutes: 15 });

  it('stays paused until the end time and resumes at it', () => {
    expect(reduceWatch(paused, { type: 'tick', now: T0 + 15 * MIN - 1 })).toBe(paused);
    expect(reduceWatch(paused, { type: 'tick', now: T0 + 15 * MIN })).toEqual(run);
  });

  it('resumes even if the tick is very late (a tab that slept, a laptop that was closed)', () => {
    expect(reduceWatch(paused, { type: 'tick', now: T0 + 9 * 60 * 60_000 })).toEqual(run);
  });

  it('a tick with a broken clock changes nothing', () => {
    expect(reduceWatch(paused, { type: 'tick', now: NaN })).toBe(paused);
  });

  it('ticks do nothing to running or stopped', () => {
    expect(reduceWatch(run, { type: 'tick', now: T0 })).toBe(run);
    expect(reduceWatch(stopped, { type: 'tick', now: T0 })).toBe(stopped);
  });
});

describe('resume, start, stop', () => {
  const paused = reduceWatch(run, { type: 'pause', now: T0, minutes: 60 });

  it('resume ends a pause at once', () => {
    expect(reduceWatch(paused, { type: 'resume' })).toEqual(run);
  });

  it('resume with nothing to resume changes nothing', () => {
    expect(reduceWatch(run, { type: 'resume' })).toBe(run);
    expect(reduceWatch(stopped, { type: 'resume' })).toBe(stopped);
  });

  it('start from a pause means resume; start while stopped runs', () => {
    expect(reduceWatch(paused, { type: 'start' })).toEqual(run);
    expect(reduceWatch(stopped, { type: 'start' })).toEqual(run);
    expect(reduceWatch(run, { type: 'start' })).toBe(run);
  });

  it('stop clears any pause or meeting', () => {
    expect(reduceWatch(paused, { type: 'stop' })).toEqual(stopped);
    expect(reduceWatch({ kind: 'meeting', until: T0 + MIN }, { type: 'stop' })).toEqual(stopped);
    expect(reduceWatch(stopped, { type: 'stop' })).toBe(stopped);
  });

  it('a stop and a start in a row cannot bring an old pause back', () => {
    expect(apply(paused, { type: 'stop' }, { type: 'start' })).toEqual(run);
  });
});

describe('meeting mode', () => {
  it('starts from running, is silent, and ends by itself', () => {
    const m = reduceWatch(run, { type: 'meeting', now: T0, minutes: 60 });
    expect(m).toEqual({ kind: 'meeting', until: T0 + 60 * MIN });
    expect(isSilent(m)).toBe(true);
    expect(reduceWatch(m, { type: 'tick', now: T0 + 60 * MIN - 1 })).toBe(m);
    expect(reduceWatch(m, { type: 'tick', now: T0 + 60 * MIN })).toEqual(run);
  });

  it('keeps watching (inference and camera stay on) but turns sound into a flash', () => {
    const m: WatchState = { kind: 'meeting', until: T0 + MIN };
    expect(inferenceEnabled(true, m)).toBe(true);
    expect(cameraStreamEnabled(true, m)).toBe(true);
    expect(effectiveAlertType('sound', m)).toBe('flash');
    expect(effectiveAlertType('both', m)).toBe('flash');
    expect(effectiveAlertType('flash', m)).toBe('flash');
    for (const type of ['sound', 'flash', 'both'] as const) expect(effectiveAlertType(type, run)).toBe(type);
    expect(effectiveAlertType('sound', { kind: 'paused', until: T0 + MIN, releaseCamera: true })).toBe('sound');
  });

  it('resume ends it; a pause supersedes it; a second meeting restarts the clock', () => {
    const m = reduceWatch(run, { type: 'meeting', now: T0, minutes: 30 });
    expect(reduceWatch(m, { type: 'resume' })).toEqual(run);
    expect(reduceWatch(m, { type: 'pause', now: T0, minutes: 15 }).kind).toBe('paused');
    expect(reduceWatch(m, { type: 'meeting', now: T0 + 10 * MIN, minutes: 30 })).toEqual({ kind: 'meeting', until: T0 + 40 * MIN });
  });

  it('a pause can switch to a meeting (back to watching, silently)', () => {
    const paused = reduceWatch(run, { type: 'pause', now: T0, minutes: 60 });
    expect(reduceWatch(paused, { type: 'meeting', now: T0, minutes: 30 }).kind).toBe('meeting');
  });

  it('is limited, and not available while stopped', () => {
    expect(reduceWatch(run, { type: 'meeting', now: T0, minutes: MAX_MEETING_MINUTES + 1 })).toBe(run);
    expect(reduceWatch(run, { type: 'meeting', now: T0, minutes: 0 })).toBe(run);
    expect(reduceWatch(stopped, { type: 'meeting', now: T0, minutes: 30 })).toBe(stopped);
  });
});

describe('what a pause means for detection and the camera', () => {
  const paused: WatchState = { kind: 'paused', until: T0 + MIN, releaseCamera: true };

  it('paused: no inference, camera released', () => {
    expect(inferenceEnabled(true, paused)).toBe(false);
    expect(cameraStreamEnabled(true, paused)).toBe(false);
  });

  it('running and meeting: both on; the camera switch off means both off, whatever the state', () => {
    expect(inferenceEnabled(true, run)).toBe(true);
    expect(cameraStreamEnabled(true, run)).toBe(true);
    for (const s of [run, paused, stopped, { kind: 'meeting', until: T0 + MIN } as WatchState]) {
      expect(inferenceEnabled(false, s)).toBe(false);
      expect(cameraStreamEnabled(false, s)).toBe(false);
    }
  });

  it('releases the camera only where permission is remembered', () => {
    expect(shouldReleaseCamera('granted')).toBe(true);
    for (const p of ['prompt', 'denied', null, undefined, '']) expect(shouldReleaseCamera(p)).toBe(false);
  });

  it('reports to the tray only a real pause', () => {
    expect(desktopPauseDetail(paused)).toEqual({ paused: true, pausedUntil: T0 + MIN });
    expect(desktopPauseDetail(run)).toEqual({ paused: false, pausedUntil: null });
    expect(desktopPauseDetail({ kind: 'meeting', until: T0 + MIN })).toEqual({ paused: false, pausedUntil: null });
    expect(desktopPauseDetail(stopped)).toEqual({ paused: false, pausedUntil: null });
    expect(endsAt(paused)).toBe(T0 + MIN);
    expect(endsAt(run)).toBeNull();
  });
});

describe('persistence and reload', () => {
  const paused = reduceWatch(run, { type: 'pause', now: T0, minutes: 60 });
  const meeting = reduceWatch(run, { type: 'meeting', now: T0, minutes: 60 });

  it('a pause survives a reload while it is still running', () => {
    expect(restoreWatch(serializeWatch(paused), T0 + 30 * MIN)).toEqual({ kind: 'paused', until: T0 + 60 * MIN, releaseCamera: true });
  });

  it('an expired pause clears on load', () => {
    expect(restoreWatch(serializeWatch(paused), T0 + 60 * MIN)).toEqual(run);
    expect(restoreWatch(serializeWatch(paused), T0 + 5 * 24 * 60 * MIN)).toEqual(run);
  });

  it('meeting mode also survives a reload, and expires', () => {
    expect(restoreWatch(serializeWatch(meeting), T0 + 10 * MIN)).toEqual({ kind: 'meeting', until: T0 + 60 * MIN });
    expect(restoreWatch(serializeWatch(meeting), T0 + 61 * MIN)).toEqual(run);
  });

  it('cannot get stuck: an end time far in the future (a wrong clock when it was saved) is dropped', () => {
    expect(restoreWatch({ v: 1, pausedUntil: T0 + 400 * 24 * 60 * MIN, meetingUntil: null }, T0)).toEqual(run);
    expect(restoreWatch({ v: 1, pausedUntil: null, meetingUntil: T0 + (MAX_MEETING_MINUTES + 1) * MIN }, T0)).toEqual(run);
  });

  it('garbage in the store starts running', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { pausedUntil: 'soon' }, { pausedUntil: NaN }, { pausedUntil: -1 }, { meetingUntil: Infinity }]) {
      expect(restoreWatch(bad, T0)).toEqual(run);
    }
  });

  it('stopped is never saved, so a reload cannot start out stopped', () => {
    expect(serializeWatch(stopped)).toEqual({ v: 1, pausedUntil: null, meetingUntil: null });
    expect(restoreWatch(serializeWatch(stopped), T0)).toEqual(run);
  });

  it('a pause with both fields set wins over a meeting', () => {
    expect(restoreWatch({ pausedUntil: T0 + MIN, meetingUntil: T0 + 2 * MIN }, T0).kind).toBe('paused');
  });
});

describe('until tomorrow', () => {
  const at = (h: number, m = 0, day = 23, month = 9) => new Date(2026, month, day, h, m, 0, 0);

  it('defaults to 06:00 tomorrow when called in the evening', () => {
    expect(new Date(untilTomorrow(at(22)))).toEqual(at(6, 0, 24));
  });

  it('is the same morning when 06:00 is still two or more hours away', () => {
    expect(new Date(untilTomorrow(at(2)))).toEqual(at(6, 0, 23));
  });

  it('is never less than two hours away (05:00 is not "tomorrow in an hour")', () => {
    expect(new Date(untilTomorrow(at(5)))).toEqual(at(6, 0, 24));
    expect(new Date(untilTomorrow(at(4, 0)))).toEqual(at(6, 0, 23)); // exactly two hours: allowed
    expect(new Date(untilTomorrow(at(4, 1)))).toEqual(at(6, 0, 24));
  });

  it('uses the start of the scheduled hours when there is a schedule', () => {
    expect(new Date(untilTomorrow(at(18), 9 * 60 + 30))).toEqual(at(9, 30, 24));
  });

  it('falls back to 06:00 for a start that is not a time of day', () => {
    for (const bad of [-1, 1440, NaN]) expect(new Date(untilTomorrow(at(22), bad))).toEqual(at(6, 0, 24));
  });

  it('crosses month and year ends', () => {
    expect(new Date(untilTomorrow(new Date(2026, 9, 31, 23, 0)))).toEqual(new Date(2026, 10, 1, 6, 0));
    expect(new Date(untilTomorrow(new Date(2026, 11, 31, 23, 30)))).toEqual(new Date(2027, 0, 1, 6, 0));
  });

  it('is always between 2 and 26 hours away, so the pause maximum always holds', () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 15, 45]) {
        const now = at(h, m);
        const away = (untilTomorrow(now) - now.getTime()) / (60 * MIN);
        expect(away).toBeGreaterThanOrEqual(2);
        expect(away).toBeLessThanOrEqual(26);
      }
    }
  });
});

describe('words', () => {
  const clock = (ts: number) => `${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;

  it('says when it ends in the plainest way', () => {
    const now = new Date(2026, 9, 23, 14, 0).getTime(); // Friday
    expect(describeEnd(now + 15 * MIN, now, clock)).toBe('14:15');
    expect(describeEnd(new Date(2026, 9, 24, 6, 0).getTime(), now, clock)).toBe('tomorrow 6:00');
    expect(describeEnd(new Date(2026, 9, 26, 6, 0).getTime(), now, clock)).toBe('Mon 6:00');
  });

  it('counts minutes left, rounded up', () => {
    expect(minutesLeft(T0 + 90_000, T0)).toBe(2);
    expect(minutesLeft(T0 + 1, T0)).toBe(1);
    expect(minutesLeft(T0 - 5, T0)).toBe(0);
  });
});
