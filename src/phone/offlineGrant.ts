// Opening the installed phone app with no connection (WS6).
//
// Today the app asks the server who you are on every start, and an answer that
// never comes is treated as "signed out": offline, a signed-in person gets the
// landing page. That is wrong for a phone app people open in a lift or on a
// train, and it would make "works offline" untrue for the one screen built for
// logging on the move.
//
// So, while `phone_companion` is on, the app keeps a small copy of the access
// facts it last learned online, and uses it ONLY when the server could not be
// reached (no network, or the server is down). The rules, each tested:
//
//   - it is the same decision as online: computeAccessStatus() on the saved
//     facts, at the current time. A trial that ended while offline is a paywall
//     again; the clock is the only input.
//   - an answer FROM the server wins: a 401 or 403 deletes the copy and signs
//     out, exactly as before. Any other failure (no network, a 5xx, a 429)
//     means "could not find out", and only then does the copy get used.
//   - it never outlives the 14-day session it was copied from (SESSION_MS).
//   - sign-out deletes it.
//   - it is written only while the flag is on and used only while the last-known
//     flag is on, so with the flag off nothing is stored and nothing changes.
//   - it holds no email, avatar or payment ids: the id (sync is opted in per
//     account), the first name, and the plan and date facts access depends on.
//
// Light on purpose (kv and one small util): AuthContext imports it, and
// AuthContext is in the bundle every visitor downloads.

import { kv } from '../storage/kv';
import { computeAccessStatus } from '../utils/access';
import type { UserProfile } from '../types/access';

const NS = 'phone' as const;
const KEY = 'grant';

/** The server session cookie lasts 14 days (signToken in server.js). */
export const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

interface Grant {
  v: 1;
  userId: string;
  firstName: string;
  trialEnd: string | null;
  status: UserProfile['subscription_status'];
  plan: UserProfile['subscription_plan'];
  endDate: string | null;
  savedAt: number;
}

const STATUSES: ReadonlyArray<string> = ['trial', 'active', 'paused', 'cancelled', 'expired'];

function readGrant(): Grant | null {
  const g = kv.get<Grant | null>(NS, KEY, null);
  if (!g || typeof g !== 'object' || g.v !== 1) return null;
  if (typeof g.userId !== 'string' || g.userId === '') return null;
  if (typeof g.savedAt !== 'number' || !Number.isFinite(g.savedAt)) return null;
  if (!STATUSES.includes(g.status)) return null;
  return g;
}

export function saveGrant(user: UserProfile, now: number = Date.now()): void {
  const grant: Grant = {
    v: 1,
    userId: user.id,
    firstName: (user.name ?? '').trim().split(/\s+/)[0] ?? '',
    trialEnd: user.trial_end_date ?? null,
    status: user.subscription_status,
    plan: user.subscription_plan ?? null,
    endDate: user.subscription_end_date ?? null,
    savedAt: now,
  };
  kv.set(NS, KEY, grant);
}

export function clearGrant(): void {
  kv.remove(NS, KEY);
}

/** The saved facts as a profile, or null when there are none, they are too old, or they no longer grant access. */
export function grantProfile(now: number = Date.now()): UserProfile | null {
  const g = readGrant();
  if (!g) return null;
  if (now < g.savedAt || now - g.savedAt > SESSION_MS) return null;
  const profile: UserProfile = {
    id: g.userId,
    email: '',
    name: g.firstName,
    avatar: null,
    trial_end_date: g.trialEnd,
    subscription_status: g.status,
    subscription_plan: g.plan,
    subscription_end_date: g.endDate,
    paddle_subscription_id: null,
    paddle_customer_id: null,
  };
  const access = computeAccessStatus(profile, now);
  return access === 'trial_active' || access === 'subscribed' ? profile : null;
}

/** The flags answer last cached by src/features/flags.ts, read without importing it. */
function phoneFlagWasOn(): boolean {
  const cached = kv.get<{ flags?: Record<string, unknown> } | null>('flags', 'last-known', null);
  return cached?.flags?.phone_companion === true;
}

/** HTTP status out of apiFetch's `API error 401` message, or null for a failure that never got an answer. */
function statusOf(err: unknown): number | null {
  const m = /^API error (\d{3})$/.exec(err instanceof Error ? err.message : '');
  return m ? Number(m[1]) : null;
}

/**
 * The server ANSWERED and said this session is not valid (401 or 403). Every
 * other failure (no network, DNS, timeout, a 5xx, a 429 from a busy shared
 * address, a captive portal's HTML where JSON should be) means "could not find
 * out", which is not the same as "signed out".
 */
export function serverRefusedSession(err: unknown): boolean {
  const status = statusOf(err);
  return status === 401 || status === 403;
}

/**
 * Called when asking the server who is signed in failed. Returns the profile to
 * continue with, or null: the person is signed out, as it always was.
 */
export function resolveFailedSession(err: unknown, now: number = Date.now()): UserProfile | null {
  if (serverRefusedSession(err)) {
    clearGrant();
    return null;
  }
  if (!phoneFlagWasOn()) return null;
  return grantProfile(now);
}
