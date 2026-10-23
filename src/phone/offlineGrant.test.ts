import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SESSION_MS, clearGrant, grantProfile, resolveFailedSession, saveGrant, serverRefusedSession } from './offlineGrant';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import type { UserProfile } from '../types/access';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const DAY = 86_400_000;

const user = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'google-123', email: 'ada@example.test', name: 'Ada Lovelace', avatar: 'https://x.test/a.png',
  trial_end_date: new Date(NOW + 2 * DAY).toISOString(), subscription_status: 'trial',
  subscription_plan: null, subscription_end_date: null,
  paddle_subscription_id: 'sub_secret', paddle_customer_id: 'ctm_secret', ...over,
});

const flagOn = (on: boolean) => kv.set('flags', 'last-known', { at: NOW, flags: { phone_companion: on } });
const apiError = (status: number) => new Error(`API error ${status}`);
const networkError = () => new TypeError('Failed to fetch');

beforeEach(() => { setStorageAdapter(createMemoryAdapter()); });
afterEach(() => { resetStorage(); });

describe('what is saved', () => {
  it('only what access needs: no email, avatar or payment ids', () => {
    saveGrant(user(), NOW);
    const raw = JSON.stringify(kv.get('phone', 'grant', null));
    expect(raw).toContain('google-123');
    expect(raw).toContain('Ada'); // first name only
    expect(raw).not.toContain('Lovelace');
    expect(raw).not.toContain('ada@example.test');
    expect(raw).not.toContain('a.png');
    expect(raw).not.toContain('sub_secret');
    expect(raw).not.toContain('ctm_secret');
  });
  it('rebuilds a profile that gives the same access decision as the server\'s copy', () => {
    saveGrant(user(), NOW);
    const p = grantProfile(NOW + 1000)!;
    expect(p).toMatchObject({ id: 'google-123', name: 'Ada', subscription_status: 'trial', email: '', avatar: null });
    expect(p.trial_end_date).toBe(user().trial_end_date);
  });
  it('a paid plan is kept as subscribed', () => {
    saveGrant(user({ subscription_status: 'active', subscription_plan: 'yearly', trial_end_date: null }), NOW);
    expect(grantProfile(NOW + DAY)).toMatchObject({ subscription_status: 'active', subscription_plan: 'yearly' });
  });
});

describe('when it can be used', () => {
  it('never after the trial has ended: the clock decides, offline as online', () => {
    saveGrant(user(), NOW);
    expect(grantProfile(NOW + DAY)).not.toBeNull();
    expect(grantProfile(NOW + 3 * DAY)).toBeNull();
  });
  it('never after a cancelled or expired status', () => {
    saveGrant(user({ subscription_status: 'cancelled' }), NOW);
    expect(grantProfile(NOW)).toBeNull();
    saveGrant(user({ subscription_status: 'expired' }), NOW);
    expect(grantProfile(NOW)).toBeNull();
  });
  it('never outlives the 14-day session it was copied from', () => {
    saveGrant(user({ subscription_status: 'active', trial_end_date: null }), NOW);
    expect(grantProfile(NOW + SESSION_MS)).not.toBeNull();
    expect(grantProfile(NOW + SESSION_MS + 1)).toBeNull();
  });
  it('not from the future (a clock set back)', () => {
    saveGrant(user(), NOW);
    expect(grantProfile(NOW - 1)).toBeNull();
  });
  it('nothing saved, damaged data and an unknown version all give nothing', () => {
    expect(grantProfile(NOW)).toBeNull();
    kv.set('phone', 'grant', 'garbage');
    expect(grantProfile(NOW)).toBeNull();
    kv.set('phone', 'grant', { v: 2, userId: 'x', savedAt: NOW, status: 'trial' });
    expect(grantProfile(NOW)).toBeNull();
    kv.set('phone', 'grant', { v: 1, userId: '', savedAt: NOW, status: 'trial' });
    expect(grantProfile(NOW)).toBeNull();
    kv.set('phone', 'grant', { v: 1, userId: 'x', savedAt: NOW, status: 'wat' });
    expect(grantProfile(NOW)).toBeNull();
  });
  it('sign-out deletes it', () => {
    saveGrant(user(), NOW);
    clearGrant();
    expect(grantProfile(NOW)).toBeNull();
  });
});

describe('resolveFailedSession: only "could not find out" falls back, and only with the flag on', () => {
  beforeEach(() => { saveGrant(user(), NOW); flagOn(true); });

  it('no network: continue from the saved facts', () => {
    expect(resolveFailedSession(networkError(), NOW + 1000)?.id).toBe('google-123');
  });
  it('a broken server, a busy shared address, or a captive portal\'s HTML: continue as well', () => {
    expect(resolveFailedSession(apiError(502), NOW + 1000)).not.toBeNull();
    expect(resolveFailedSession(apiError(503), NOW + 1000)).not.toBeNull();
    expect(resolveFailedSession(apiError(429), NOW + 1000)).not.toBeNull();
    expect(resolveFailedSession(new SyntaxError('Unexpected token <'), NOW + 1000)).not.toBeNull();
  });
  it('the server said no (401, 403): signed out, and the saved copy is deleted', () => {
    expect(resolveFailedSession(apiError(401), NOW + 1000)).toBeNull();
    expect(grantProfile(NOW + 1000)).toBeNull();
    saveGrant(user(), NOW);
    expect(resolveFailedSession(apiError(403), NOW + 1000)).toBeNull();
    expect(grantProfile(NOW + 1000)).toBeNull();
  });
  it('with the flag off (or never fetched) it is the old behaviour: signed out', () => {
    flagOn(false);
    expect(resolveFailedSession(networkError(), NOW + 1000)).toBeNull();
    kv.remove('flags', 'last-known');
    expect(resolveFailedSession(networkError(), NOW + 1000)).toBeNull();
  });
  it('with no saved copy it is the old behaviour: signed out', () => {
    clearGrant();
    expect(resolveFailedSession(networkError(), NOW + 1000)).toBeNull();
  });
  it('an expired trial is a paywall (null here), not a way around it', () => {
    expect(resolveFailedSession(networkError(), NOW + 5 * DAY)).toBeNull();
  });
});

describe('the rest of the WS9 access model, offline as online', () => {
  const expiredTrial = { subscription_status: 'expired' as const, trial_end_date: new Date(NOW - DAY).toISOString() };

  it('a lifetime, gift or referral grant that is running keeps a phone open offline; one that ended does not', () => {
    saveGrant(user({ ...expiredTrial, entitlement: { grants: [{ kind: 'gift', ends_at: new Date(NOW + 10 * DAY).toISOString() }] } }), NOW);
    expect(grantProfile(NOW + DAY)).not.toBeNull();
    expect(grantProfile(NOW + 11 * DAY)).toBeNull(); // its own end, before even the 14-day session limit
    saveGrant(user({ ...expiredTrial, entitlement: { grants: [{ kind: 'lifetime', ends_at: null }] } }), NOW);
    expect(grantProfile(NOW + 13 * DAY)).not.toBeNull();
    expect(grantProfile(NOW + 15 * DAY)).toBeNull(); // lifetime is honoured, but a stale copy is not trusted past the session
  });
  it('the free tier opens the app offline with its limits, exactly like online', () => {
    const free = { detection_minutes_per_day: 30, history_days: 7 };
    saveGrant(user({ ...expiredTrial, entitlement: { free_tier: free } }), NOW);
    const p = grantProfile(NOW + DAY);
    expect(p?.entitlement?.free_tier).toEqual(free);
  });
  it('an expired account with nothing else stays a paywall: offline is no way around it', () => {
    saveGrant(user(expiredTrial), NOW);
    expect(grantProfile(NOW + DAY)).toBeNull();
  });
  it('saves only the parts of the entitlement the decision reads, never banked days', () => {
    saveGrant(user({ entitlement: { grants: [{ kind: 'referral_credit', ends_at: null }], banked_days: 90 } }), NOW);
    const raw = JSON.stringify(kv.get('phone', 'grant', null));
    expect(raw).toContain('referral_credit');
    expect(raw).not.toContain('banked');
  });
});

describe('serverRefusedSession', () => {
  it('is true only for the answers that mean "no"', () => {
    expect(serverRefusedSession(apiError(401))).toBe(true);
    expect(serverRefusedSession(apiError(403))).toBe(true);
    for (const s of [400, 404, 429, 500, 502, 503]) expect(serverRefusedSession(apiError(s)), String(s)).toBe(false);
    expect(serverRefusedSession(networkError())).toBe(false);
    expect(serverRefusedSession('API error 401')).toBe(false);
    expect(serverRefusedSession(null)).toBe(false);
  });
});
