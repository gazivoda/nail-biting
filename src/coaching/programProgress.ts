// Progress through the 4-week program (WS2). Pure functions plus a kv-backed
// store; the lesson text itself lives in src/data/hrtProgram.json.
//
// The rule, and why it does not punish a gap:
//   Lesson 1 is open from the moment the person starts.
//   Lesson N+1 opens on the first LOCAL calendar day after lesson N was marked
//   done. So at most one new lesson opens per day, and a missed day (or a
//   missed month) changes nothing: the next lesson is simply there when the
//   person comes back, nothing is lost, nothing is "behind", and there is no
//   streak, counter or deadline to break.
//
// Dates are local calendar days as 'YYYY-MM-DD' strings, never UTC and never
// "24 hours later", so a late-evening lesson opens the next lesson at midnight
// local time and daylight-saving changes cannot skip or repeat a day.

import { kv } from '../storage/kv';

export const PROGRAM_LESSON_COUNT = 28;

export interface ProgramProgress {
  version: 1;
  /** Local date the person pressed Start, or null if they have not. */
  startedOn: string | null;
  /** lesson number (1-based, as a string key) -> local date it was marked done. */
  completed: Record<string, string>;
}

export const EMPTY_PROGRESS: ProgramProgress = { version: 1, startedOn: null, completed: {} };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The local calendar day of `d` as YYYY-MM-DD. */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sanitizeProgress(raw: unknown): ProgramProgress {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const completed: Record<string, string> = {};
  if (o.completed !== null && typeof o.completed === 'object') {
    for (const [k, v] of Object.entries(o.completed as Record<string, unknown>)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= PROGRAM_LESSON_COUNT && typeof v === 'string' && DATE_RE.test(v)) completed[String(n)] = v;
    }
  }
  return {
    version: 1,
    startedOn: typeof o.startedOn === 'string' && DATE_RE.test(o.startedOn) ? o.startedOn : null,
    completed,
  };
}

export function isCompleted(p: ProgramProgress, lesson: number): boolean {
  return p.completed[String(lesson)] !== undefined;
}

/**
 * How many lessons are open on `today`. 0 before the program is started.
 * Lesson N+1 needs lessons 1..N done and lesson N done on a different (earlier)
 * day; a completion date "in the future" (the clock was set back) does not keep
 * the next lesson locked.
 */
export function unlockedCount(p: ProgramProgress, today: string, total: number = PROGRAM_LESSON_COUNT): number {
  if (p.startedOn === null) return 0;
  let open = 1;
  for (let n = 1; n < total; n++) {
    const doneOn = p.completed[String(n)];
    if (doneOn === undefined || doneOn === today) break;
    open = n + 1;
  }
  return open;
}

export function isUnlocked(p: ProgramProgress, lesson: number, today: string, total: number = PROGRAM_LESSON_COUNT): boolean {
  return lesson >= 1 && lesson <= unlockedCount(p, today, total);
}

/** The lesson to show first: the earliest open lesson not yet done, or null when everything open is done (or not started). */
export function currentLesson(p: ProgramProgress, today: string, total: number = PROGRAM_LESSON_COUNT): number | null {
  const open = unlockedCount(p, today, total);
  for (let n = 1; n <= open; n++) if (!isCompleted(p, n)) return n;
  return null;
}

export function completedCount(p: ProgramProgress): number {
  return Object.keys(p.completed).length;
}

export function start(p: ProgramProgress, today: string): ProgramProgress {
  return p.startedOn === null ? { ...p, startedOn: today } : p;
}

/** Marks a lesson done today. Only an open lesson can be marked; marking twice keeps the first date. */
export function markDone(p: ProgramProgress, lesson: number, today: string, total: number = PROGRAM_LESSON_COUNT): ProgramProgress {
  if (!isUnlocked(p, lesson, today, total) || isCompleted(p, lesson)) return p;
  return { ...p, completed: { ...p.completed, [String(lesson)]: today } };
}

// ── kv-backed store ──────────────────────────────────────────────────────────

const NS = 'hrt' as const;
const KEY = 'program';

let cached: ProgramProgress | null = null;
const listeners = new Set<() => void>();
let unsubscribeKv: (() => void) | null = null;

function ensureKvSubscription() {
  if (unsubscribeKv) return;
  unsubscribeKv = kv.subscribe(NS, KEY, () => {
    cached = null;
    listeners.forEach(fn => fn());
  });
}

export function getProgress(): ProgramProgress {
  if (cached === null) cached = sanitizeProgress(kv.get<unknown>(NS, KEY, null));
  return cached;
}

export function subscribeProgress(fn: () => void): () => void {
  ensureKvSubscription();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function saveProgress(next: ProgramProgress): void {
  ensureKvSubscription();
  kv.set(NS, KEY, sanitizeProgress(next));
}

/** Forgets all progress (the person chose "Start over"). */
export function resetProgress(): void {
  ensureKvSubscription();
  kv.remove(NS, KEY);
}

/** For tests: forget the in-memory copy (storage was swapped). */
export function resetProgressCache(): void {
  cached = null;
  unsubscribeKv?.();
  unsubscribeKv = null;
}
