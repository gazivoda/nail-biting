import { describe, it, expect } from 'vitest';
import { computeAccess, computeAccessStatus } from './access';
import type { UserProfile } from '../types/access';

const NOW = Date.UTC(2026, 6, 26);
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const user = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  avatar: null,
  trial_end_date: days(-30),
  subscription_status: 'trial',
  subscription_plan: null,
  subscription_end_date: null,
  paddle_subscription_id: null,
  paddle_customer_id: null,
  ...over,
});

const status = (over: Partial<UserProfile>) => computeAccessStatus(user(over), NOW);

describe('computeAccessStatus', () => {
  it('grants access during the trial', () => {
    expect(status({ trial_end_date: days(2) })).toBe('trial_active');
  });

  it('paywalls once the trial has run out', () => {
    expect(status({ trial_end_date: days(-1) })).toBe('paywall');
  });

  it('paywalls a user with no trial date at all', () => {
    expect(status({ trial_end_date: null })).toBe('paywall');
  });

  it('ignores a trial date once the server has marked it expired or cancelled', () => {
    expect(status({ trial_end_date: days(2), subscription_status: 'expired' })).toBe('paywall');
    expect(status({ trial_end_date: days(2), subscription_status: 'cancelled' })).toBe('paywall');
  });

  it('grants access to an active subscription', () => {
    expect(status({ subscription_status: 'active', subscription_end_date: days(20) }))
      .toBe('subscribed');
  });

  it('keeps a paused subscription in the app until it actually ends', () => {
    expect(status({ subscription_status: 'paused', subscription_end_date: days(5) }))
      .toBe('subscribed');
  });

  it('paywalls after payment failure', () => {
    expect(status({ subscription_status: 'expired', subscription_end_date: days(20) }))
      .toBe('paywall');
  });

  // These two are the regression. Access used to also require
  // subscription_end_date to exist and still be in the future, which locked
  // paying customers out of an app they were still being charged for.
  describe('paying customers are not locked out by subscription_end_date', () => {
    it('when Paddle sent no billing period at all (server stores null)', () => {
      expect(status({ subscription_status: 'active', subscription_end_date: null }))
        .toBe('subscribed');
    });

    it('when a renewal webhook is late, leaving the stored period end in the past', () => {
      expect(status({ subscription_status: 'active', subscription_end_date: days(-1) }))
        .toBe('subscribed');
    });

    it('and the same for a paused subscription', () => {
      expect(status({ subscription_status: 'paused', subscription_end_date: null }))
        .toBe('subscribed');
    });
  });
});

// ── The pinned matrix (WS9) ───────────────────────────────────────────────────
// WS9 extended computeAccessStatus with lifetime, gift, referral credit and the
// free tier. For every account that has none of those (every account that exists
// today, and every account while the flags are off) the answer must be what it
// was. `legacyAccessStatus` is the function exactly as it stood before WS9; the
// table below runs it against the real one over every combination of the fields
// it reads.
const legacyAccessStatus = (u: UserProfile, now: number) => {
  if (u.subscription_status === 'active' || u.subscription_status === 'paused') return 'subscribed';
  if (
    u.trial_end_date &&
    new Date(u.trial_end_date).getTime() > now &&
    u.subscription_status !== 'expired' &&
    u.subscription_status !== 'cancelled'
  ) return 'trial_active';
  return 'paywall';
};

describe('computeAccessStatus is unchanged for every account without a WS9 grant', () => {
  const statuses = ['trial', 'active', 'paused', 'cancelled', 'expired'] as const;
  const trialEnds = [null, days(-30), days(-1), new Date(NOW).toISOString(), new Date(NOW + 1).toISOString(), days(2)];
  const ends = [null, days(-5), days(20)];
  const plans = [null, 'monthly', 'yearly'] as const;

  const cases = statuses.flatMap(subscription_status => trialEnds.flatMap(trial_end_date =>
    ends.flatMap(subscription_end_date => plans.map(subscription_plan => ({ subscription_status, trial_end_date, subscription_end_date, subscription_plan })))));

  it(`matches the old answer in all ${cases.length} combinations`, () => {
    expect(cases).toHaveLength(5 * 6 * 3 * 3);
    for (const c of cases) {
      expect(status(c), JSON.stringify(c)).toBe(legacyAccessStatus(user(c), NOW));
    }
  });

  it('an empty entitlement object changes nothing either', () => {
    for (const c of cases) {
      expect(computeAccessStatus(user({ ...c, entitlement: { grants: [] } }), NOW), JSON.stringify(c)).toBe(legacyAccessStatus(user(c), NOW));
    }
  });

  it('never answers free_tier unless the account carries a free-tier limit', () => {
    for (const c of cases) expect(status(c)).not.toBe('free_tier');
  });
});

// ── The new states ────────────────────────────────────────────────────────────
const FREE = { detection_minutes_per_day: 30, history_days: 7 };
const lifetime = { kind: 'lifetime', ends_at: null } as const;
const gift = (ends: number) => ({ kind: 'gift', ends_at: days(ends) }) as const;
const credit = (ends: number) => ({ kind: 'referral_credit', ends_at: days(ends) }) as const;
const access = (over: Partial<UserProfile>) => computeAccess(user(over), NOW);

describe('every state the product has, with its source', () => {
  it('trial', () => {
    expect(access({ trial_end_date: days(2) })).toMatchObject({ status: 'trial_active', source: 'trial', until: days(2) });
  });
  it('monthly and yearly', () => {
    expect(access({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: days(9) }))
      .toMatchObject({ status: 'subscribed', source: 'monthly', until: days(9) });
    expect(access({ subscription_status: 'active', subscription_plan: 'yearly' }))
      .toMatchObject({ status: 'subscribed', source: 'yearly', until: null });
    expect(access({ subscription_status: 'paused' })).toMatchObject({ status: 'subscribed', source: 'subscription' });
  });
  it('lifetime: never ends, whatever the trial or subscription say', () => {
    for (const subscription_status of ['trial', 'cancelled', 'expired'] as const) {
      expect(access({ subscription_status, trial_end_date: days(-30), entitlement: { grants: [lifetime] } }))
        .toMatchObject({ status: 'subscribed', source: 'lifetime', until: null });
    }
  });
  it('gift: runs until its end, then the account is back where it was', () => {
    const running: Partial<UserProfile> = { subscription_status: 'expired', entitlement: { grants: [gift(40)] } };
    expect(access(running)).toMatchObject({ status: 'subscribed', source: 'gift', until: days(40) });
    expect(computeAccessStatus(user(running), NOW + 41 * 86_400_000)).toBe('paywall');
  });
  it('referral credit: same, and a finished one grants nothing', () => {
    expect(access({ subscription_status: 'expired', entitlement: { grants: [credit(10)] } }))
      .toMatchObject({ status: 'subscribed', source: 'referral_credit', until: days(10) });
    expect(access({ subscription_status: 'expired', entitlement: { grants: [credit(-1)] } }).status).toBe('paywall');
  });
  it('free tier: only for an account with no other access, and only when the server sent the limits', () => {
    const base: Partial<UserProfile> = { subscription_status: 'expired', entitlement: { free_tier: FREE } };
    expect(access(base)).toMatchObject({ status: 'free_tier', source: 'free_tier', limits: FREE });
    expect(access({ ...base, subscription_status: 'cancelled' }).status).toBe('free_tier');
    expect(access({ ...base, subscription_status: 'trial', trial_end_date: days(2) }).status).toBe('trial_active');
    expect(access({ ...base, subscription_status: 'active' }).status).toBe('subscribed');
    expect(access({ ...base, entitlement: { free_tier: FREE, grants: [lifetime] } })).toMatchObject({ status: 'subscribed', source: 'lifetime' });
  });
  it('expired: nothing grants access', () => {
    expect(access({})).toMatchObject({ status: 'paywall', source: 'expired' });
    expect(access({ subscription_status: 'cancelled', trial_end_date: days(2) })).toMatchObject({ status: 'paywall', source: 'expired' });
  });
});

describe('which grant counts when several are running', () => {
  it('a paid subscription is named first, then lifetime, gift, referral credit', () => {
    const grants = [credit(30), gift(20), lifetime];
    expect(access({ subscription_status: 'active', subscription_plan: 'yearly', entitlement: { grants } }).source).toBe('yearly');
    expect(access({ entitlement: { grants } }).source).toBe('lifetime');
    expect(access({ entitlement: { grants: [credit(30), gift(20)] } }).source).toBe('gift');
    expect(access({ entitlement: { grants: [credit(30), credit(60)] } }).until).toBe(days(60));
  });
  it('a running grant is "subscribed", not "trial_active", even inside the trial', () => {
    expect(access({ trial_end_date: days(2), entitlement: { grants: [lifetime] } }).status).toBe('subscribed');
  });
  it('banked days alone grant nothing: they start when the server activates them', () => {
    expect(access({ entitlement: { banked_days: 30 } }).status).toBe('paywall');
  });
  it('ignores a grant of a kind it does not know', () => {
    expect(access({ entitlement: { grants: [{ kind: 'vip', ends_at: null } as never] } }).status).toBe('paywall');
  });
});
