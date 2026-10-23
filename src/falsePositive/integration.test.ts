// "Not a bite" end to end in node (WS3): the real store, the real storage module (in memory), the real
// coaching controller and the real detection registry. What the buttons call (actions), what the bridge
// wires up (startBridge), and what is kept (poseStore).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { events } from '../storage';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';
import { alarmCoaching } from '../coaching/controller';
import { getDetectionControls, requestSilence, setDetectionControls, takeSilenceRequest } from '../detection/controlsRegistry';
import type { PoseVector } from '../detection/pose';
import { markNotABite, undoNotABite } from './actions';
import { notABite } from './controller';
import { startFalsePositiveBridge } from './startBridge';
import {
  alarmPoseAt, clearCalibration, learnedCount, readAlarmPoses, readCalibration, readLearned, readSettings,
  rememberAlarmPose, resetEverything, resetLearning, writeCalibration, writeSettings,
} from './poseStore';
import { buildControls } from './controls';
import { closeCalibration, isCalibrationOpen, resetCalibrationForTests } from '../calibration/state';

const T0 = 1_800_000_000_000;
const POSE: PoseVector = [2, 0.24, 0.05, 6, 0.65, 0.3];
const store = () => useAppStore.getState();

function logAlarm(): string {
  store().logIncident('auto-detected', true);
  return store().incidents[0].id;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  useMemoryStorage();
  store().clearAllData();
  setDetectionControls(null);
  notABite.disarm();
  resetCalibrationForTests();
  alarmCoaching.disarm();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  setDetectionControls(null);
  notABite.disarm();
  alarmCoaching.disarm();
});

describe('marking an alarm Not a bite', () => {
  it('marks the event, and the streak and counts follow', () => {
    vi.setSystemTime(T0 + 60_000);
    const id = logAlarm();
    store().confirmIncident(id);
    expect(store().lastBiteTime).not.toBeNull();
    expect(markNotABite(id)).toBe(true);
    expect(events.get(id)?.falsePositive).toBe(true);
    expect(store().lastBiteTime).toBeNull();
  });

  it('answers false for an entry that is not there', () => {
    expect(markNotABite('nope')).toBe(false);
    expect(undoNotABite('nope')).toBe(false);
  });

  it('undo takes the mark off and puts the streak back', () => {
    vi.setSystemTime(T0 + 60_000);
    const id = logAlarm();
    store().confirmIncident(id);
    markNotABite(id);
    expect(undoNotABite(id)).toBe(true);
    expect(events.get(id)?.falsePositive).toBe(false);
    expect(store().lastBiteTime).toBe(T0 + 60_000);
  });

  it('asks the engine to silence the alarm that is sounding (only while controls are registered)', () => {
    setDetectionControls(buildControls());
    const id = logAlarm();
    markNotABite(id);
    expect(takeSilenceRequest()).toBe(true);
    setDetectionControls(null);
    const id2 = (vi.setSystemTime(T0 + 120_000), logAlarm());
    markNotABite(id2);
    expect(takeSilenceRequest()).toBe(false); // nothing registered: nothing to silence, nothing queued
  });

  describe('while a coaching prompt is open for this alarm', () => {
    function openPrompt(eventId: string) {
      const saved: Array<[string, boolean]> = [];
      // As CoachingBridge does: the result lands on the alarm's own event.
      alarmCoaching.setResultHandler(r => { saved.push([r.eventId, r.patch.done]); events.update(r.eventId, { competingResponse: r.patch }); });
      alarmCoaching.arm();
      alarmCoaching.attach();
      expect(alarmCoaching.offer({ eventId, text: 'Clench your fists', durationSec: 30 })).toBe(true);
      return saved;
    }

    it('the prompt is closed, once, and the mark is made', () => {
      const id = logAlarm();
      const saved = openPrompt(id);
      markNotABite(id);
      expect(alarmCoaching.getState().session.phase).toBe('idle');
      expect(saved).toEqual([[id, false]]);                    // ended with Skip: one result, "not done"
      expect(events.get(id)?.falsePositive).toBe(true);
      expect(events.get(id)?.competingResponse).toMatchObject({ done: false });
      vi.advanceTimersByTime(60_000);                          // the old timer must not fire a second result
      expect(saved).toHaveLength(1);
    });

    it('a prompt for a DIFFERENT alarm is left alone', () => {
      const first = logAlarm();
      const saved = openPrompt(first);
      vi.setSystemTime(T0 + 120_000);
      const second = logAlarm();
      markNotABite(second);
      expect(alarmCoaching.getState().session.phase).toBe('running');
      expect(saved).toEqual([]);
    });

    it('no prompt open: marking works and nothing else happens', () => {
      const id = logAlarm();
      expect(() => markNotABite(id)).not.toThrow();
      expect(alarmCoaching.getState().session.phase).toBe('idle');
    });

    it('the coaching stat leaves the marked alarm out', async () => {
      const { coachingStats } = await import('../utils/coachingStats');
      const id = logAlarm();
      openPrompt(id);
      markNotABite(id);
      expect(coachingStats(events.list()).alarms).toBe(0);
    });
  });
});

describe('what is learned from a mark', () => {
  it('the pose of the alarm is remembered with the entry it came from, and forgotten on undo', () => {
    const id = logAlarm();
    rememberAlarmPose({ at: store().incidents[0].timestamp, v: POSE }, T0);
    markNotABite(id);
    expect(readLearned()).toEqual([{ at: T0, v: POSE, eventId: id }]);
    undoNotABite(id);
    expect(readLearned()).toEqual([]);
  });

  it('with no pose remembered (an old alarm, or one from before the flag), the mark still works', () => {
    const id = logAlarm();
    expect(markNotABite(id)).toBe(true);
    expect(readLearned()).toEqual([]);
  });

  it('two marks of the same entry do not count twice', () => {
    const id = logAlarm();
    rememberAlarmPose({ at: store().incidents[0].timestamp, v: POSE }, T0);
    markNotABite(id);
    markNotABite(id);
    expect(learnedCount()).toBe(1);
  });

  it('the pose belongs to the alarm that started nearest the entry, not to another one', () => {
    const id = logAlarm();
    const ts = store().incidents[0].timestamp;
    rememberAlarmPose({ at: ts - 600_000, v: [0, 0.01, 0.01, 0, 0, 0] }, T0);
    expect(alarmPoseAt(ts)).toBeNull();
    rememberAlarmPose({ at: ts + 200, v: POSE }, T0);
    expect(alarmPoseAt(ts)).toEqual(POSE);
    markNotABite(id);
    expect(readLearned()[0].v).toEqual(POSE);
  });
});

describe('the bridge (flag on)', () => {
  it('registers the controls from what is stored, and removes them when it stops (the flag off)', () => {
    writeSettings({ handFilter: 'left', chinRest: false });
    const stop = startFalsePositiveBridge();
    expect(getDetectionControls()).toMatchObject({ handFilter: 'left', chinRest: { enabled: false } });
    stop();
    expect(getDetectionControls()).toBeNull();
    expect(notABite.getState().armed).toBe(false);
  });

  it('re-registers when a setting changes', () => {
    const stop = startFalsePositiveBridge();
    expect(getDetectionControls()?.handFilter).toBe('both');
    writeSettings({ handFilter: 'right' });
    expect(getDetectionControls()?.handFilter).toBe('right');
    stop();
  });

  it('a calibration changes the rule\'s distances and adds its poses', () => {
    writeCalibration({ at: T0, chinRegionFw: 0.31, tipGuardFw: 0.11, rest: [POSE], real: [[0, 0.04, 0.3, 0, 0.55, 0.55]], restFrames: 30, realFrames: 30 });
    const stop = startFalsePositiveBridge();
    const c = getDetectionControls()!;
    expect(c.chinRest).toMatchObject({ chinRegionFw: 0.31, tipGuardFw: 0.11 });
    expect(c.rest).toEqual([POSE]);
    expect(c.safe).toHaveLength(1);
    stop();
  });

  it('offers the toast for a new alarm, but not for one that was already in the history', () => {
    vi.setSystemTime(T0 + 1000);
    const old = logAlarm();
    const stop = startFalsePositiveBridge();
    expect(notABite.getState().offer).toBeNull();
    vi.setSystemTime(T0 + 40_000);
    const fresh = logAlarm();
    return Promise.resolve().then(() => {
      expect(notABite.getState().offer).toEqual({ eventId: fresh, phase: 'offered' });
      expect(fresh).not.toBe(old);
      stop();
    });
  });

  it('the toast\'s button marks the entry, and its Undo takes it back', async () => {
    const stop = startFalsePositiveBridge();
    const id = logAlarm();
    await Promise.resolve();
    notABite.mark();
    expect(events.get(id)?.falsePositive).toBe(true);
    notABite.undo();
    expect(events.get(id)?.falsePositive).toBe(false);
    stop();
  });

  it('suggests the calibration once, after the very first mark, and never again', async () => {
    const stop = startFalsePositiveBridge();
    const a = logAlarm();
    await Promise.resolve();
    notABite.mark();
    expect(notABite.getState().offer?.suggestCalibration).toBe(true);
    notABite.dismiss();
    vi.setSystemTime(T0 + 90_000);
    const b = logAlarm();
    await Promise.resolve();
    expect(a).not.toBe(b);
    notABite.mark();
    expect(notABite.getState().offer?.suggestCalibration).toBeUndefined();
    stop();
  });

  it('does not suggest it to someone who has already calibrated', async () => {
    writeCalibration({ at: T0, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [], real: [], restFrames: 30, realFrames: 30 });
    const stop = startFalsePositiveBridge();
    logAlarm();
    await Promise.resolve();
    notABite.mark();
    expect(notABite.getState().offer?.suggestCalibration).toBeUndefined();
    stop();
  });

  it('the toast\'s Calibrate opens the calibration view', async () => {
    const stop = startFalsePositiveBridge();
    logAlarm();
    await Promise.resolve();
    notABite.mark();
    notABite.calibrate();
    expect(isCalibrationOpen()).toBe(true);
    closeCalibration();
    stop();
  });

  it('forgets a learned pose when its entry stops being marked: undo, "this was a bite", delete', async () => {
    const stop = startFalsePositiveBridge();
    const mark = (n: number) => {
      vi.setSystemTime(T0 + n * 60_000);
      const id = logAlarm();
      rememberAlarmPose({ at: store().incidents[0].timestamp, v: POSE }, Date.now());
      markNotABite(id);
      return id;
    };
    const a = mark(1); const b = mark(2); const c = mark(3);
    expect(learnedCount()).toBe(3);
    store().confirmIncident(a, 'stress');       // "this was a bite" takes the mark off
    expect(readLearned().map(s => s.eventId).sort()).toEqual([b, c].sort());
    store().deleteIncident(b);                  // deleting the entry
    expect(readLearned().map(s => s.eventId)).toEqual([c]);
    events.update(c, { falsePositive: false });  // the same as an undo, from anywhere (a sync, History)
    expect(readLearned()).toEqual([]);
    stop();
  });

  it('a throwing store listener cannot break logIncident (the alarm path)', () => {
    const stop = startFalsePositiveBridge();
    vi.spyOn(notABite, 'offer').mockImplementation(() => { throw new Error('toast broke'); });
    expect(() => logAlarm()).not.toThrow();
    vi.restoreAllMocks();
    stop();
  });
});

describe('what is kept, and how to get rid of it', () => {
  it('settings default to both hands and the chin-rest rule, and survive a damaged value', () => {
    expect(readSettings()).toEqual({ handFilter: 'both', chinRest: true });
    writeSettings({ handFilter: 'right' });
    expect(readSettings()).toEqual({ handFilter: 'right', chinRest: true });
  });

  it('the pose ring is bounded', () => {
    for (let i = 0; i < 50; i++) rememberAlarmPose({ at: T0 + i, v: POSE }, T0 + i);
    expect(readAlarmPoses()).toHaveLength(30);
  });

  it('"Forget what it learned" removes the learned poses and the alarm poses, and keeps the settings and the calibration', () => {
    writeSettings({ handFilter: 'left' });
    writeCalibration({ at: T0, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [POSE], real: [], restFrames: 30, realFrames: 30 });
    const id = logAlarm();
    rememberAlarmPose({ at: store().incidents[0].timestamp, v: POSE }, T0);
    markNotABite(id);
    expect(learnedCount()).toBe(1);
    resetLearning();
    expect(learnedCount()).toBe(0);
    expect(readAlarmPoses()).toEqual([]);
    expect(readSettings().handFilter).toBe('left');
    expect(readCalibration()).not.toBeNull();
  });

  it('"Delete calibration" is one call and leaves the rest', () => {
    writeCalibration({ at: T0, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [POSE], real: [], restFrames: 30, realFrames: 30 });
    writeSettings({ chinRest: false });
    clearCalibration();
    expect(readCalibration()).toBeNull();
    expect(readSettings().chinRest).toBe(false);
  });

  it('resetEverything leaves nothing under the feature\'s namespace', () => {
    writeSettings({ handFilter: 'left' });
    writeCalibration({ at: T0, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [POSE], real: [], restFrames: 30, realFrames: 30 });
    rememberAlarmPose({ at: T0, v: POSE }, T0);
    resetEverything();
    expect(readSettings()).toEqual({ handFilter: 'both', chinRest: true });
    expect(readCalibration()).toBeNull();
    expect(readAlarmPoses()).toEqual([]);
    expect(readLearned()).toEqual([]);
  });

  it('a request for silence is dropped when nothing is registered', () => {
    requestSilence();
    expect(takeSilenceRequest()).toBe(false);
  });
});
