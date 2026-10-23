// Everything the false-alarm controls keep, in the storage module's key-value area (WS3).
//
//   kv falsePositive / settings      { handFilter, chinRest }          what the person chose
//   kv falsePositive / learned       [{ at, v: 6 numbers, eventId }]   poses they said "Not a bite" to (max 40, 30 days)
//   kv falsePositive / alarm-poses   [{ at, v: 6 numbers }]            the pose at each recent alarm (max 30, 7 days)
//   kv falsePositive / calibration   { distances, up to 12 + 12 poses } from the optional calibration
//   kv falsePositive / calibration-offered   true once the toast has suggested the calibration (it never does twice)
//
// LOCAL ONLY. This is the localStorage of this browser, through src/storage/kv. It is not an event field,
// it is not in the export file, and no code under src/detection, src/calibration or src/falsePositive can
// send anything anywhere (scripts/falsePositiveGuards.test.mjs imports nothing network-capable and
// src/falsePositive/localOnly.test.ts checks the sync whitelist cannot carry it). "Reset" below removes it.
//
// Pure list logic is in src/detection/learning.ts; this file only reads, validates and writes. It imports
// the light kv module, not the storage index, so it carries no store.

import { kv } from '../storage/kv';
import { HAND_FILTERS, type HandFilter, type LearnedSample } from '../detection/controls';
import {
  addSample, parseAlarmPoses, parseSamples, poseForAlarm, pruneSamples, pushAlarmPose,
  reconcileSamples, removeSampleForEvent, type AlarmPose,
} from '../detection/learning';
import { parseProfile, type CalibrationProfile } from '../detection/calibration';
import type { PoseVector } from '../detection/pose';

const NS = 'falsePositive' as const;
const KEY = { settings: 'settings', learned: 'learned', alarmPoses: 'alarm-poses', calibration: 'calibration', offered: 'calibration-offered' } as const;

export interface FalsePositiveSettings {
  handFilter: HandFilter;
  /** The chin-rest rule. On by default once the feature is on. */
  chinRest: boolean;
}

export const DEFAULT_SETTINGS: FalsePositiveSettings = { handFilter: 'both', chinRest: true };

export function readSettings(): FalsePositiveSettings {
  const raw = kv.get<unknown>(NS, KEY.settings, null);
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    handFilter: HAND_FILTERS.includes(r.handFilter as HandFilter) ? (r.handFilter as HandFilter) : DEFAULT_SETTINGS.handFilter,
    chinRest: typeof r.chinRest === 'boolean' ? r.chinRest : DEFAULT_SETTINGS.chinRest,
  };
}

export function writeSettings(patch: Partial<FalsePositiveSettings>): boolean {
  return kv.set(NS, KEY.settings, { ...readSettings(), ...patch });
}

export function readLearned(now: number = Date.now()): LearnedSample[] {
  return pruneSamples(parseSamples(kv.get<unknown>(NS, KEY.learned, [])), now);
}

function writeLearned(list: LearnedSample[]): boolean {
  return list.length === 0 ? (kv.remove(NS, KEY.learned), true) : kv.set(NS, KEY.learned, list);
}

/** Remembers the pose of an alarm the person rejected. */
export function learnFromRejection(eventId: string, v: PoseVector, now: number = Date.now()): void {
  writeLearned(addSample(readLearned(now), { at: now, v, eventId }, now));
}

/** Forgets what a rejection taught (the tap was undone, or the entry is gone). */
export function forgetRejection(eventId: string): void {
  writeLearned(removeSampleForEvent(readLearned(), eventId));
}

/** Drops every sample whose History entry is no longer marked "Not a bite". Returns whether anything changed. */
export function reconcileLearned(stillFalse: (eventId: string) => boolean, now: number = Date.now()): boolean {
  const before = readLearned(now);
  const after = reconcileSamples(before, stillFalse);
  if (after.length === before.length) return false;
  writeLearned(after);
  return true;
}

export function readAlarmPoses(): AlarmPose[] {
  return parseAlarmPoses(kv.get<unknown>(NS, KEY.alarmPoses, []));
}

export function rememberAlarmPose(entry: AlarmPose, now: number = Date.now()): void {
  kv.set(NS, KEY.alarmPoses, pushAlarmPose(readAlarmPoses(), entry, now));
}

/** The pose the alarm at `ts` was started with, if it is still remembered. */
export function alarmPoseAt(ts: number): PoseVector | null {
  return poseForAlarm(readAlarmPoses(), ts);
}

export function readCalibration(): CalibrationProfile | null {
  return parseProfile(kv.get<unknown>(NS, KEY.calibration, null));
}

export function writeCalibration(profile: CalibrationProfile): boolean {
  return kv.set(NS, KEY.calibration, profile);
}

export function clearCalibration(): void {
  kv.remove(NS, KEY.calibration);
}

/** The calibration is offered once, after the first "Not a bite", and never again on its own. */
export function shouldOfferCalibration(): boolean {
  return kv.get<boolean>(NS, KEY.offered, false) !== true && readCalibration() === null;
}

export function markCalibrationOffered(): void {
  kv.set(NS, KEY.offered, true);
}

/** "Forget what it learned": the rejected poses and the alarm poses behind them. Settings and calibration stay. */
export function resetLearning(): void {
  kv.remove(NS, KEY.learned);
  kv.remove(NS, KEY.alarmPoses);
}

/** Everything this feature keeps, gone. (Settings > Data's "Clear all data" does not reach kv; this is the feature's own reset.) */
export function resetEverything(): void {
  for (const k of Object.values(KEY)) kv.remove(NS, k);
}

/** Calls `fn` after any of the four keys changes on this page. Returns an unsubscribe. */
export function subscribeStore(fn: () => void): () => void {
  const offs = Object.values(KEY).map(k => kv.subscribe(NS, k, fn));
  return () => offs.forEach(off => off());
}

/** How many poses are remembered right now (for the Settings card). */
export function learnedCount(): number {
  return readLearned().length;
}
