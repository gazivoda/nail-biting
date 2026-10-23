// How fast detection really ran while the tab was in the background (WS7a, flag background_watching), and the one
// sentence that tells the person when it was slow. Chromium keeps the full rate with the tick source in
// hiddenSource.ts; a browser that slows hidden tabs and gives nothing better falls back to what it always did, and
// this is how the app says so instead of leaving a quiet gap. Pure: the numbers come in, a sentence goes out.

import { kv } from '../storage/kv';

/** Checks per second when the tab is in front (one every 200 ms). */
export const FULL_RATE = 5;
/** Below this many checks a second the background rate is called slow. */
export const SLOW_BELOW = 3;
/** A short trip to another tab says nothing; only stretches at least this long are judged. */
export const MIN_HIDDEN_SECONDS = 30;
/** A report older than this is not shown any more. */
export const REPORT_TTL_MS = 12 * 60 * 60 * 1000;

export interface CadenceReport {
  /** When the tab came back to the front (epoch ms). */
  at: number;
  /** How long it had been in the background. */
  seconds: number;
  /** Checks per second over that stretch. */
  stepsPerSecond: number;
}

/** The report for one stretch in the background, or null if it was too short to mean anything. */
export function judgeHidden(steps: number, seconds: number, at: number): CadenceReport | null {
  if (!Number.isFinite(steps) || !Number.isFinite(seconds) || seconds < MIN_HIDDEN_SECONDS) return null;
  return { at, seconds: Math.round(seconds), stepsPerSecond: Math.max(0, Math.round((steps / seconds) * 10) / 10) };
}

export const isSlow = (r: CadenceReport): boolean => r.stepsPerSecond < SLOW_BELOW;

/** "Last time this tab was in the background ..." or null when there is nothing worth saying. */
export function cadenceNote(report: CadenceReport | null, now: number, canFloatWindow: boolean): string | null {
  if (!report || !isSlow(report) || now - report.at > REPORT_TTL_MS || now < report.at) return null;
  const rate = report.stepsPerSecond >= 1.5 ? `about ${Math.round(report.stepsPerSecond)} a second` : 'about once a second';
  const advice = canFloatWindow
    ? 'The Minimize button floats a small window that keeps the full speed.'
    : 'Keeping Stop Biting in its own window, in view, keeps the full speed.';
  return `While this tab was in the background, checks ran ${rate} instead of ${FULL_RATE}. ${advice}`;
}

// ─── storage ─────────────────────────────────────────────────────────────────

const NS = 'background' as const;
const KEY = 'cadence';

export function saveCadence(report: CadenceReport): void {
  kv.set(NS, KEY, report);
}

export function loadCadence(): CadenceReport | null {
  const v = kv.get<unknown>(NS, KEY, null);
  if (typeof v !== 'object' || v === null) return null;
  const { at, seconds, stepsPerSecond } = v as Record<string, unknown>;
  if ([at, seconds, stepsPerSecond].some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
  return { at: at as number, seconds: seconds as number, stepsPerSecond: stepsPerSecond as number };
}

export function subscribeCadence(fn: () => void): () => void {
  return kv.subscribe(NS, KEY, fn);
}
