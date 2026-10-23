// Decides whether a sync engine exists at all, and ties it to the page.
//
// The rule in one line: an engine runs only while ALL of these are true: someone
// is signed in, the `event_sync` feature is on, and that same person opted in.
// If any one stops being true the engine is stopped and dropped, its timers
// cleared and its page listeners removed. With sync off there is no engine, so
// there is nothing that could make a request: that is the whole "sync off means
// zero event network calls" guarantee, and src/sync/lifecycle.test.ts checks it
// by running a full page lifecycle against a spy.
//
// Pure TypeScript. The page (focus, visibility, online) comes in as an
// `environment`; React comes in from outside (SyncRunner).

import type { SyncEngine } from './engine';

export interface SyncEnvironment {
  isOnline(): boolean;
  /** The tab became visible or the window got focus. */
  onFocus(cb: () => void): () => void;
  onOnline(cb: () => void): () => void;
  onOffline(cb: () => void): () => void;
}

export interface SyncControllerInput {
  /** The signed-in account, or null. */
  userId: string | null;
  /** Whether the `event_sync` feature is on. */
  flagOn: boolean;
  /** The account that opted in on this browser, or null. */
  optInUserId: string | null;
}

export interface SyncControllerDeps {
  createEngine(userId: string): SyncEngine;
  env: SyncEnvironment;
  /** Told whenever the running engine changes (including to null). */
  onActiveChange?(engine: SyncEngine | null): void;
}

export interface SyncController {
  /** Idempotent: call it whenever the user, the flag or the opt-in may have changed. */
  update(input: SyncControllerInput): void;
  active(): SyncEngine | null;
  dispose(): void;
}

export function shouldRun(input: SyncControllerInput): input is SyncControllerInput & { userId: string } {
  return input.userId !== null && input.flagOn && input.optInUserId === input.userId;
}

export function createSyncController(deps: SyncControllerDeps): SyncController {
  let engine: SyncEngine | null = null;
  let engineUser: string | null = null;
  let unhook: Array<() => void> = [];

  function teardown() {
    for (const off of unhook) off();
    unhook = [];
    engine?.stop();
    engine = null;
    engineUser = null;
    deps.onActiveChange?.(null);
  }

  return {
    update(input) {
      if (!shouldRun(input)) {
        if (engine) teardown();
        return;
      }
      if (engine && engineUser === input.userId) return;
      if (engine) teardown();

      const e = deps.createEngine(input.userId);
      engine = e;
      engineUser = input.userId;
      unhook = [
        deps.env.onFocus(() => e.notifyFocus()),
        deps.env.onOnline(() => e.notifyOnline()),
        deps.env.onOffline(() => e.notifyOffline()),
      ];
      e.start();
      deps.onActiveChange?.(e);
    },

    active: () => engine,

    dispose() {
      if (engine) teardown();
    },
  };
}
