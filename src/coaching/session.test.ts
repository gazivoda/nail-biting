import { describe, it, expect } from 'vitest';
import {
  IDLE, CONFIRMATION_MS, clampDuration, complete, elapsedMs, offer, progress, remainingMs, remainingSec, skip, tick,
  type CoachingOffer, type CoachingSession,
} from './session';

const T0 = 1_700_000_000_000;
const o: CoachingOffer = { eventId: 'e1', text: 'Clench your fists', durationSec: 30 };
const running = (now = T0): CoachingSession => offer(IDLE, o, now);

describe('clampDuration', () => {
  it('keeps 15 to 60 whole seconds and falls back to 30 for junk', () => {
    expect(clampDuration(15)).toBe(15);
    expect(clampDuration(60)).toBe(60);
    expect(clampDuration(5)).toBe(15);
    expect(clampDuration(600)).toBe(60);
    expect(clampDuration(22.6)).toBe(23);
    expect(clampDuration(NaN)).toBe(30);
    expect(clampDuration('40')).toBe(30);
    expect(clampDuration(undefined)).toBe(30);
  });
});

describe('offer', () => {
  it('starts a running session at `now`', () => {
    expect(running(T0)).toEqual({ phase: 'running', eventId: 'e1', text: 'Clench your fists', durationSec: 30, startedAt: T0 });
  });

  it('is ignored while a session is running (no stacking, no restarts)', () => {
    const s = running(T0);
    expect(offer(s, { ...o, eventId: 'e2' }, T0 + 5000)).toBe(s);
  });

  it('replaces the Done card', () => {
    const done = complete(running(T0), T0 + 1000).session;
    expect(done.phase).toBe('finished');
    const next = offer(done, { ...o, eventId: 'e2' }, T0 + 2000);
    expect(next).toMatchObject({ phase: 'running', eventId: 'e2', startedAt: T0 + 2000 });
  });
});

describe('the countdown', () => {
  it('counts down and reports progress', () => {
    const s = running(T0);
    expect(remainingMs(s, T0)).toBe(30_000);
    expect(remainingSec(s, T0)).toBe(30);
    expect(remainingSec(s, T0 + 1)).toBe(30);
    expect(remainingSec(s, T0 + 1000)).toBe(29);
    expect(remainingSec(s, T0 + 29_999)).toBe(1); // never shows 0 while running
    expect(progress(s, T0)).toBe(0);
    expect(progress(s, T0 + 15_000)).toBe(0.5);
    expect(progress(s, T0 + 99_000)).toBe(1);
  });

  it('is clamped when the clock jumps backwards', () => {
    const s = running(T0);
    expect(elapsedMs(s, T0 - 60_000)).toBe(0);
    expect(remainingMs(s, T0 - 60_000)).toBe(30_000);
  });

  it('time up: the whole duration counts, and the result is produced once', () => {
    const s = running(T0);
    expect(tick(s, T0 + 29_999).result).toBeUndefined();
    const t = tick(s, T0 + 30_000);
    expect(t.session).toMatchObject({ phase: 'finished', eventId: 'e1' });
    expect(t.result).toEqual({ eventId: 'e1', patch: { done: true, durationSec: 30 } });
    // a late timer or another surface ticking afterwards produces nothing more
    expect(tick(t.session, T0 + 30_100).result).toBeUndefined();
  });

  it('the Done card closes itself after the confirmation time', () => {
    const fin = tick(running(T0), T0 + 31_000);
    const at = (ms: number) => tick(fin.session, T0 + 31_000 + ms);
    expect(at(CONFIRMATION_MS - 1).session).toBe(fin.session);
    expect(at(CONFIRMATION_MS).session).toBe(IDLE);
  });

  it('a Done card that looks like it is from the future is dismissed rather than stuck', () => {
    const fin = tick(running(T0), T0 + 31_000).session;
    expect(tick(fin, T0 - 3_600_000).session).toBe(IDLE);
  });
});

describe('Done', () => {
  it('saves done with the seconds actually spent', () => {
    const t = complete(running(T0), T0 + 11_400);
    expect(t.session.phase).toBe('finished');
    expect(t.result).toEqual({ eventId: 'e1', patch: { done: true, durationSec: 11 } });
  });

  it('cannot be saved twice or from the wrong state', () => {
    const t = complete(running(T0), T0 + 5000);
    expect(complete(t.session, T0 + 6000).result).toBeUndefined();
    expect(complete(IDLE, T0).result).toBeUndefined();
  });
});

describe('Skip and Escape: the dismissal that can never be refused', () => {
  it('from running: saves "not done" with the seconds spent and goes straight to idle', () => {
    const t = skip(running(T0), T0 + 7_200);
    expect(t.session).toBe(IDLE);
    expect(t.result).toEqual({ eventId: 'e1', patch: { done: false, durationSec: 7 } });
  });

  it('an immediate Skip saves done:false with 0 seconds', () => {
    expect(skip(running(T0), T0).result).toEqual({ eventId: 'e1', patch: { done: false, durationSec: 0 } });
  });

  it('works from the Done card (just closes it, saves nothing more)', () => {
    const fin = complete(running(T0), T0 + 1000).session;
    const t = skip(fin, T0 + 1500);
    expect(t.session).toBe(IDLE);
    expect(t.result).toBeUndefined();
  });

  it('works from idle and changes nothing', () => {
    const t = skip(IDLE, T0);
    expect(t.session).toBe(IDLE);
    expect(t.result).toBeUndefined();
  });

  it('every state can be left with one Skip', () => {
    const states: CoachingSession[] = [IDLE, running(T0), complete(running(T0), T0 + 1).session];
    for (const s of states) expect(skip(s, T0 + 2).session).toBe(IDLE);
  });

  it('after a Skip nothing can resurrect the session (a late tick, Done or Skip)', () => {
    const s = skip(running(T0), T0 + 1000).session;
    expect(tick(s, T0 + 60_000).session).toBe(IDLE);
    expect(complete(s, T0 + 2000).result).toBeUndefined();
    expect(skip(s, T0 + 3000).result).toBeUndefined();
  });
});
