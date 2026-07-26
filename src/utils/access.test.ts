import { describe, it, expect } from 'vitest';
import { computeAccessStatus } from './access';
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
