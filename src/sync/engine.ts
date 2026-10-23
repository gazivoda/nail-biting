// The sync engine (WS4): pushes local changes to the server, pulls other
// devices' changes, merges them, and does it quietly in the background.
//
// Pure logic. The engine owns no clock, no network, no storage and no DOM: it is
// handed ports (see types.ts) and runs the same in the browser and in node tests.
//
// How it decides what to send ("the queue"). It remembers, per event id, the
// `updatedAt` the server last acknowledged (the "versions" map, in kv). An event
// is waiting to be sent when its current `updatedAt` differs from that. So the
// queue is derived, not kept: it survives a reload, an offline week or a crash
// by construction, it cannot lose a change to a clock that jumped backwards
// (nothing is compared with "now"), and losing the map only costs one harmless
// re-send, because the server ignores a version it already has.
//
// Convergence. Last write wins by `updatedAt`; a tie is settled by
// `compareEventVersions`, the same rule the server uses. After a push the server
// sends back its own version of anything it kept instead of ours, so the loser
// adopts the winner. Deletes travel as tombstones.
//
// Safety rails.
//  - Nothing runs unless `isEnabled()` says the user opted in (checked before
//    every cycle, so turning sync off takes effect at once).
//  - The payload is built by `toSyncEvent` (payload.ts), a field-by-field whitelist.
//  - One request at a time. Errors back off exponentially; a 4xx that retrying
//    cannot fix (rejected batch, full account) waits for the next local change.
//  - Sign-out or a server-side wipe stops the engine.

import { compareEventVersions, type HabitEventWire } from '../storage/eventModel';
import { toSyncEvent, type SyncEvent } from './payload';
import {
  DEFAULT_SYNC_OPTIONS,
  type SyncKvPort,
  type SyncOptions,
  type SyncOutcome,
  type SyncPhase,
  type SyncReason,
  type SyncResponse,
  type SyncStatus,
  type SyncStorePort,
  type SyncTimers,
  type SyncTransport,
  type TransportResult,
} from './types';

export const STATE_KEY = 'state';
export const VERSIONS_KEY = 'versions';

interface PersistedState {
  v: 1;
  userId: string;
  epoch: string | null;
  cursor: number;
  lastSyncedAt: number | null;
}
interface PersistedVersions {
  v: 1;
  userId: string;
  map: Record<string, number>;
}

export interface SyncEngineDeps {
  userId: string;
  deviceId: string;
  store: SyncStorePort;
  kv: SyncKvPort;
  transport: SyncTransport;
  /** True while the user has opted in and the feature is on. Checked before every cycle. */
  isEnabled(): boolean;
  isOnline(): boolean;
  now(): number;
  timers: SyncTimers;
  random?(): number;
  /** The server reports that synced data was deleted elsewhere (HTTP 409). Sync must be switched off. */
  onServerReset?(): void;
  /** The server no longer accepts the session (HTTP 401). */
  onSignedOut?(): void;
  options?: Partial<SyncOptions>;
}

export interface SyncEngine {
  start(): void;
  stop(): void;
  /** Runs a cycle now, ignoring back-off. Joins a cycle already running. */
  syncNow(): Promise<SyncOutcome>;
  requestSync(reason: SyncReason): void;
  notifyFocus(): void;
  notifyOnline(): void;
  notifyOffline(): void;
  getStatus(): SyncStatus;
  subscribe(fn: () => void): () => void;
  /** Forgets the cursor and the acknowledged versions (sync was turned off for good). */
  forgetState(): void;
  /** Waits for a cycle in flight to finish, then makes no request until `resume()`. */
  pause(): Promise<void>;
  resume(): void;
}

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

function isResponse(x: unknown): x is SyncResponse {
  return isRecord(x)
    && Array.isArray(x.events)
    && typeof x.cursor === 'number' && Number.isFinite(x.cursor) && x.cursor >= 0
    && typeof x.hasMore === 'boolean'
    && typeof x.epoch === 'string' && x.epoch !== '';
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const opt: SyncOptions = { ...DEFAULT_SYNC_OPTIONS, ...deps.options };
  const random = deps.random ?? Math.random;

  let state: PersistedState = freshState();
  let versions = new Map<string, number>();
  let loaded = false;
  let forgotten = false; // forgetState() ran: do not write the state back

  let started = false;
  let stopped = false;
  let unsubscribeStore: (() => void) | null = null;
  let timer: unknown = null;
  let timerDue: number | null = null;
  let inFlight: Promise<SyncOutcome> | null = null;
  let again = false;
  let mergingRemote = false;
  let paused = false;
  let blocked = false;
  let failures = 0;
  let retryAt: number | null = null;
  let lastAttemptAt = -Infinity;

  let status: SyncStatus = {
    phase: 'off', lastSyncedAt: null, pending: 0, retryAt: null, skipped: 0, lastCycle: null,
  };
  const listeners = new Set<() => void>();

  function freshState(): PersistedState {
    return { v: 1, userId: deps.userId, epoch: null, cursor: 0, lastSyncedAt: null };
  }

  // ── status ────────────────────────────────────────────────────────────────

  function setStatus(patch: Partial<SyncStatus>) {
    const next = { ...status, ...patch };
    const same = (Object.keys(next) as (keyof SyncStatus)[]).every(k =>
      k === 'lastCycle'
        ? next.lastCycle?.pushed === status.lastCycle?.pushed && next.lastCycle?.pulled === status.lastCycle?.pulled
        : next[k] === status[k]);
    if (same) return;
    status = next;
    listeners.forEach(fn => { try { fn(); } catch { /* a listener must not stop the engine */ } });
  }

  // ── persistence ───────────────────────────────────────────────────────────

  function load() {
    if (loaded) return;
    loaded = true;
    const s = deps.kv.get<PersistedState | null>(STATE_KEY, null);
    const v = deps.kv.get<PersistedVersions | null>(VERSIONS_KEY, null);
    // Another account's state is not ours: start from nothing.
    if (isRecord(s) && s.v === 1 && s.userId === deps.userId
      && typeof s.cursor === 'number' && Number.isFinite(s.cursor) && s.cursor >= 0
      && (s.epoch === null || typeof s.epoch === 'string')) {
      state = {
        v: 1, userId: deps.userId, epoch: s.epoch, cursor: s.cursor,
        lastSyncedAt: typeof s.lastSyncedAt === 'number' ? s.lastSyncedAt : null,
      };
    }
    versions = new Map();
    if (isRecord(v) && v.v === 1 && v.userId === deps.userId && isRecord(v.map)) {
      for (const [id, t] of Object.entries(v.map)) if (typeof t === 'number') versions.set(id, t);
    }
    setStatus({ lastSyncedAt: state.lastSyncedAt });
  }

  function persist() {
    if (forgotten) return;
    deps.kv.set(STATE_KEY, state satisfies PersistedState);
    deps.kv.set(VERSIONS_KEY, { v: 1, userId: deps.userId, map: Object.fromEntries(versions) } satisfies PersistedVersions);
  }

  /** Keeps the map to ids that still exist on this device. */
  function pruneVersions(all: HabitEventWire[]) {
    if (versions.size <= all.length) return;
    const live = new Set(all.map(e => e.id));
    for (const id of versions.keys()) if (!live.has(id)) versions.delete(id);
  }

  // ── what is waiting ───────────────────────────────────────────────────────

  function computePending(all: HabitEventWire[]): { items: SyncEvent[]; skipped: number } {
    const items: SyncEvent[] = [];
    let skipped = 0;
    for (const e of all) {
      const wire = toSyncEvent(e);
      if (!wire) { skipped++; continue; }
      if (versions.get(wire.id) !== wire.updatedAt) items.push(wire);
    }
    // Oldest change first, so a long first sync makes steady progress.
    items.sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { items, skipped };
  }

  function refreshPending() {
    const { items, skipped } = computePending(deps.store.listAll());
    setStatus({ pending: items.length, skipped });
  }

  // ── scheduling ────────────────────────────────────────────────────────────

  function clearTimer() {
    if (timer !== null) deps.timers.clearTimeout(timer);
    timer = null;
    timerDue = null;
  }

  function scheduleAt(due: number) {
    if (stopped || !started) return;
    if (timer !== null && timerDue !== null && timerDue <= due) return; // an earlier attempt is already planned
    clearTimer();
    timerDue = due;
    timer = deps.timers.setTimeout(onTimer, Math.max(0, due - deps.now()));
  }

  function scheduleInterval() {
    scheduleAt(deps.now() + opt.intervalMs * (0.9 + 0.2 * random()));
  }

  function onTimer() {
    timer = null;
    timerDue = null;
    void run(false).then(out => {
      if (out.kind === 'skipped' && out.why === 'backoff' && retryAt !== null) scheduleAt(retryAt);
      else if (out.kind === 'skipped' && (out.why === 'offline' || out.why === 'blocked')) scheduleInterval();
    });
  }

  // ── one cycle ─────────────────────────────────────────────────────────────

  function run(manual: boolean): Promise<SyncOutcome> {
    if (inFlight) {
      again = true; // whatever changed meanwhile gets its own pass
      return inFlight;
    }
    const p = cycle(manual).finally(() => {
      inFlight = null;
      if (again && !stopped) {
        again = false;
        scheduleAt(Math.max(deps.now(), lastAttemptAt + opt.minGapMs));
      }
    });
    inFlight = p;
    return p;
  }

  async function cycle(manual: boolean): Promise<SyncOutcome> {
    if (stopped || !started) return { kind: 'skipped', why: 'stopped' };
    if (paused) return { kind: 'skipped', why: 'paused' };
    if (!deps.isEnabled()) {
      setStatus({ phase: 'off' });
      return { kind: 'skipped', why: 'disabled' };
    }
    if (!deps.isOnline()) {
      setStatus({ phase: 'offline' });
      return { kind: 'skipped', why: 'offline' };
    }
    if (manual) {
      blocked = false;
    } else {
      if (blocked) return { kind: 'skipped', why: 'blocked' };
      if (retryAt !== null && deps.now() < retryAt) return { kind: 'skipped', why: 'backoff' };
    }

    load();
    lastAttemptAt = deps.now();
    retryAt = null;
    setStatus({ phase: 'syncing', retryAt: null });

    let pushed = 0;
    let pulled = 0;
    let requests = 0;
    try {
      for (;;) {
        const all = deps.store.listAll();
        const { items, skipped } = computePending(all);
        const batch = items.slice(0, opt.batchSize);

        let result: TransportResult;
        try {
          result = await deps.transport.sync({ since: state.cursor, events: batch, deviceId: deps.deviceId, epoch: state.epoch });
        } catch {
          result = { ok: false, status: 0 };
        }
        requests++;
        if (stopped) return { kind: 'skipped', why: 'stopped' }; // signed out or switched off while waiting: drop the answer
        if (!result.ok) return fail(result.status, result.retryAfterMs);
        const body: unknown = result.body;
        if (!isResponse(body)) return fail(502);

        // The server has now seen (and either kept or superseded) everything we sent.
        for (const e of batch) versions.set(e.id, e.updatedAt);
        pushed += batch.length;

        if (body.events.length > 0) {
          mergingRemote = true;
          try { deps.store.merge(body.events); } finally { mergingRemote = false; }
          pulled += body.events.length;
          // Whatever we now hold identically to the server's copy is in step.
          const local = new Map(deps.store.listAll().map(e => [e.id, e]));
          for (const raw of body.events) {
            if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.updatedAt !== 'number') continue;
            const mine = local.get(raw.id);
            if (mine && compareEventVersions(mine, raw as unknown as HabitEventWire) === 0) versions.set(raw.id, raw.updatedAt);
          }
        }

        const advanced = body.cursor > state.cursor;
        state.cursor = Math.max(state.cursor, body.cursor);
        state.epoch = body.epoch;
        failures = 0;

        const more = body.hasMore || items.length > batch.length;
        const progressed = advanced || batch.length > 0;
        if (more && progressed && requests < opt.maxRequestsPerCycle) continue;

        // Leaving the loop: either everything is in step, or the request budget for this cycle is used up
        // (a long first sync carries on in the next cycle), or the server says "more" without moving
        // (treated as done, so a misbehaving server cannot make the client spin).
        const finished = !more || !progressed;
        pruneVersions(deps.store.listAll());
        state.lastSyncedAt = deps.now();
        persist();
        const after = computePending(deps.store.listAll());
        setStatus({
          phase: 'idle', lastSyncedAt: state.lastSyncedAt, pending: after.items.length, skipped,
          retryAt: null, lastCycle: { pushed, pulled },
        });
        if (finished) {
          scheduleInterval();
          return { kind: 'done', pushed, pulled };
        }
        scheduleAt(Math.max(deps.now(), lastAttemptAt + opt.minGapMs));
        return { kind: 'partial', pushed, pulled };
      }
    } finally {
      persist();
    }
  }

  function fail(httpStatus: number, retryAfterMs?: number): SyncOutcome {
    const now = deps.now();
    const phaseOf = (phase: SyncPhase, patch: Partial<SyncStatus> = {}) => setStatus({ phase, ...patch });

    if (httpStatus === 401 || httpStatus === 403) {
      phaseOf('signed_out', { retryAt: null });
      engineStop(false);
      deps.onSignedOut?.();
    } else if (httpStatus === 409) {
      // Synced data was deleted from another device (or the server lost it). Do not upload again by stealth.
      forgetState();
      phaseOf('server_reset', { retryAt: null, pending: 0 });
      engineStop(false);
      deps.onServerReset?.();
    } else if (httpStatus === 404) {
      retryAt = now + opt.backoffMaxMs;
      phaseOf('unavailable', { retryAt });
      scheduleAt(retryAt);
    } else if (httpStatus === 413) {
      blocked = true;
      phaseOf('quota', { retryAt: null });
    } else if (httpStatus === 400 || httpStatus === 422) {
      blocked = true;
      phaseOf('rejected', { retryAt: null });
    } else {
      failures++;
      const exp = Math.min(opt.backoffMaxMs, opt.backoffBaseMs * 2 ** (failures - 1));
      const delay = httpStatus === 429 && retryAfterMs !== undefined
        ? Math.min(opt.backoffMaxMs, Math.max(retryAfterMs, opt.backoffBaseMs))
        : Math.round(exp * (0.75 + 0.5 * random()));
      retryAt = now + delay;
      phaseOf('backoff', { retryAt });
      scheduleAt(retryAt);
    }
    refreshPendingSafe();
    return { kind: 'failed', status: httpStatus };
  }

  function refreshPendingSafe() {
    if (!stopped) refreshPending();
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  function requestSync(reason: SyncReason) {
    if (stopped || !started) return;
    const now = deps.now();
    switch (reason) {
      case 'manual': void run(true); break;
      case 'start': scheduleAt(now); break;
      case 'change': scheduleAt(Math.max(now + opt.changeDebounceMs, lastAttemptAt + opt.minGapMs)); break;
      case 'online': scheduleAt(Math.max(now + opt.onlineDelayMs, lastAttemptAt + opt.onlineDelayMs)); break;
      case 'focus':
      case 'timer': scheduleAt(Math.max(now, lastAttemptAt + opt.minGapMs)); break;
    }
  }

  function onLocalChange() {
    if (mergingRemote || stopped || !started) return;
    refreshPending();
    if (!deps.isEnabled()) return;
    if (status.phase === 'rejected') blocked = false; // the next batch may be different
    scheduleAt(Math.max(deps.now() + opt.changeDebounceMs, lastAttemptAt + opt.minGapMs));
  }

  function engineStop(setOff: boolean) {
    stopped = true;
    clearTimer();
    unsubscribeStore?.();
    unsubscribeStore = null;
    if (setOff) setStatus({ phase: 'off', retryAt: null });
  }

  function forgetState() {
    state = freshState();
    versions = new Map();
    loaded = true;
    forgotten = true;
    deps.kv.remove(STATE_KEY);
    deps.kv.remove(VERSIONS_KEY);
  }

  return {
    start() {
      if (started) return;
      started = true;
      stopped = false;
      load();
      unsubscribeStore = deps.store.subscribe(onLocalChange);
      refreshPending();
      setStatus({ phase: deps.isOnline() ? 'idle' : 'offline' });
      scheduleAt(deps.now());
    },

    stop() {
      engineStop(true);
    },

    syncNow() {
      if (stopped || !started) return Promise.resolve<SyncOutcome>({ kind: 'skipped', why: 'stopped' });
      return run(true);
    },

    requestSync,

    notifyFocus() {
      // Coming back to the tab is a good moment, but never more often than the minimum gap.
      if (stopped || !started || inFlight) return;
      if (deps.now() - lastAttemptAt >= opt.minGapMs) requestSync('focus');
    },

    notifyOnline() {
      if (stopped || !started) return;
      if (status.phase === 'offline') setStatus({ phase: 'idle' });
      requestSync('online');
    },

    notifyOffline() {
      if (stopped || !started) return;
      setStatus({ phase: 'offline' });
    },

    getStatus: () => status,

    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },

    forgetState,

    async pause() {
      paused = true;
      clearTimer();
      if (inFlight) {
        try { await inFlight; } catch { /* the cycle reports its own errors */ }
      }
    },

    resume() {
      if (!paused) return;
      paused = false;
      scheduleAt(deps.now());
    },
  };
}
