// Builders for tests (and nothing else imports this file). Plain objects shaped like the store's records.

import type { InsightEvent } from './predicate';

let counter = 0;
const nextId = () => `e${++counter}`;

export interface EventOpts {
  tag?: string;
  confirmed?: boolean;
  falsePositive?: boolean;
  deleted?: boolean;
  competingResponse?: { done: boolean; durationSec?: number };
}

/** A hand-logged bite. */
export function bite(ts: number, opts: EventOpts = {}): InsightEvent {
  return { id: nextId(), timestamp: ts, ts, source: 'manual', tag: opts.tag ?? 'unknown', autoDetected: false, ...extras(opts) };
}

/** An alarm. Unconfirmed unless `confirmed: true`. */
export function alarm(ts: number, opts: EventOpts = {}): InsightEvent {
  return { id: nextId(), timestamp: ts, ts, source: 'alarm', tag: opts.tag ?? 'auto-detected', autoDetected: true, ...extras(opts) };
}

/** An urge-timer entry: manual, tag `urge`. */
export function urge(ts: number, opts: EventOpts = {}): InsightEvent {
  return { id: nextId(), timestamp: ts, ts, source: 'manual', tag: 'urge', autoDetected: false, ...extras(opts) };
}

function extras(o: EventOpts): Partial<InsightEvent> {
  const out: Partial<InsightEvent> = {};
  if (o.confirmed !== undefined) out.confirmed = o.confirmed;
  if (o.falsePositive !== undefined) out.falsePositive = o.falsePositive;
  if (o.deleted !== undefined) out.deleted = o.deleted;
  if (o.competingResponse !== undefined) out.competingResponse = o.competingResponse;
  return out;
}

/** Small deterministic generator (mulberry32), so a 10,000-event history is the same every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` events spread over the `days` days before `now`, a mix of confirmed alarms, unconfirmed
 * alarms, manual bites, urges, false positives and tagged/untagged entries. Newest first, like the store.
 */
export function manyEvents(count: number, now: number, days = 120, seed = 7): InsightEvent[] {
  const r = rng(seed);
  const tags = ['stress', 'focus', 'boredom', 'unknown', 'custom-1'];
  const out: InsightEvent[] = [];
  for (let i = 0; i < count; i++) {
    const ts = now - Math.floor(r() * days * 86_400_000);
    const k = r();
    const tag = tags[Math.floor(r() * tags.length)];
    if (k < 0.35) out.push(bite(ts, { tag }));
    else if (k < 0.55) out.push(alarm(ts, { confirmed: true, tag }));
    else if (k < 0.8) out.push(alarm(ts, { competingResponse: r() < 0.5 ? { done: r() < 0.6, durationSec: 30 } : undefined }));
    else if (k < 0.88) out.push(urge(ts));
    else if (k < 0.95) out.push(alarm(ts, { falsePositive: true }));
    else out.push(bite(ts, { tag, deleted: true }));
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}
