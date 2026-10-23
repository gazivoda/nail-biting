// What the app remembers from "Not a bite" taps (WS3), as pure list operations. src/falsePositive/
// poseStore.ts keeps these lists in the storage module's key-value area (kv) on THIS device.
//
// Bounded, expiring, resettable:
//   - at most CONTROLS_CONFIG.learned.maxSamples poses (40); the oldest go first;
//   - a pose is forgotten after CONTROLS_CONFIG.learned.ttlDays (30);
//   - the person can wipe the lot in Settings > Detection, and undoing "Not a bite" forgets that tap's pose.
//
// What is kept is six rounded numbers per pose (src/detection/pose.ts), a time, and the id of the History
// entry the tap was about (so an undo can find it). Never a picture, never landmarks. It is not part of the
// event record and is not synced: the sync whitelist is the HabitEvent fields (scripts/falsePositiveGuards
// .test.mjs and src/falsePositive/localOnly.test.ts pin that).

import { CONTROLS_CONFIG, DAY_MS, type LearnedSample } from './controls.ts';
import { parsePoseVector, type PoseVector } from './pose.ts';

/** The pose at the moment an alarm started, kept briefly so a later "Not a bite" can learn from it. */
export interface AlarmPose {
  /** When the alarm started (epoch ms): matched to the History entry by time. */
  at: number;
  v: PoseVector;
}

export const ALARM_POSE_LIMITS = { max: 30, ttlDays: 7, matchWindowMs: 5000 } as const;

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Whatever was stored, checked: only well-formed samples survive. Never throws. */
export function parseSamples(raw: unknown): LearnedSample[] {
  if (!Array.isArray(raw)) return [];
  const out: LearnedSample[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.at !== 'number' || !Number.isFinite(item.at)) continue;
    const v = parsePoseVector(item.v);
    if (!v) continue;
    const sample: LearnedSample = { at: item.at, v };
    if (typeof item.eventId === 'string' && item.eventId !== '') sample.eventId = item.eventId;
    out.push(sample);
  }
  return out;
}

export function parseAlarmPoses(raw: unknown): AlarmPose[] {
  if (!Array.isArray(raw)) return [];
  const out: AlarmPose[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.at !== 'number' || !Number.isFinite(item.at)) continue;
    const v = parsePoseVector(item.v);
    if (v) out.push({ at: item.at, v });
  }
  return out;
}

/** Drops samples older than the lifetime and keeps the newest `maxSamples`. Newest first on the way out. */
export function pruneSamples(samples: readonly LearnedSample[], now: number): LearnedSample[] {
  const cutoff = now - CONTROLS_CONFIG.learned.ttlDays * DAY_MS;
  return [...samples]
    .filter(s => s.at >= cutoff && s.at <= now + DAY_MS) // a clock set far into the future would otherwise pin a sample forever
    .sort((a, b) => b.at - a.at)
    .slice(0, CONTROLS_CONFIG.learned.maxSamples);
}

/** Adds one. A second tap about the same History entry replaces the first instead of counting twice. */
export function addSample(samples: readonly LearnedSample[], sample: LearnedSample, now: number): LearnedSample[] {
  const rest = sample.eventId === undefined ? samples : samples.filter(s => s.eventId !== sample.eventId);
  return pruneSamples([sample, ...rest], now);
}

export function removeSampleForEvent(samples: readonly LearnedSample[], eventId: string): LearnedSample[] {
  return samples.filter(s => s.eventId !== eventId);
}

/**
 * Keeps a sample only while the History entry it came from is still marked "Not a bite". `stillFalse`
 * answers for an event id; samples with no event id (calibration) are kept. This is what makes undo, delete,
 * "this was a bite" and a sync from another device all forget the same way.
 */
export function reconcileSamples(samples: readonly LearnedSample[], stillFalse: (eventId: string) => boolean): LearnedSample[] {
  return samples.filter(s => s.eventId === undefined || stillFalse(s.eventId));
}

// ── the short list of alarm poses ────────────────────────────────────────────

export function pushAlarmPose(ring: readonly AlarmPose[], entry: AlarmPose, now: number): AlarmPose[] {
  const cutoff = now - ALARM_POSE_LIMITS.ttlDays * DAY_MS;
  return [entry, ...ring].filter(p => p.at >= cutoff).slice(0, ALARM_POSE_LIMITS.max);
}

/** The pose recorded for the alarm that started closest to `ts`, if one started within a few seconds of it. */
export function poseForAlarm(ring: readonly AlarmPose[], ts: number): PoseVector | null {
  let best: AlarmPose | null = null;
  for (const p of ring) {
    const gap = Math.abs(p.at - ts);
    if (gap <= ALARM_POSE_LIMITS.matchWindowMs && (best === null || gap < Math.abs(best.at - ts))) best = p;
  }
  return best ? best.v : null;
}
