// How Settings > Plan words the new states. Returns null for every account whose access comes from a
// subscription or the trial, which keep the wording they always had; the plan card falls back to it.

import { computeAccess } from '../utils/access';
import type { UserProfile } from '../types/access';

export interface PlanOverride {
  badge: string;
  headline: string;
  detail: string;
  /** Offer "Choose a plan": true when what they have will run out or is limited. */
  upgrade: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function planOverride(user: UserProfile, now: number = Date.now()): PlanOverride | null {
  const access = computeAccess(user, now);
  switch (access.source) {
    case 'lifetime':
      return { badge: 'Lifetime', headline: 'Lifetime', detail: 'One payment, no renewals.', upgrade: false };
    case 'gift':
      return { badge: 'Gift', headline: 'Gift', detail: access.until ? `Access until ${fmt(access.until)}` : '', upgrade: true };
    case 'referral_credit':
      return { badge: 'Referral credit', headline: 'Referral credit', detail: access.until ? `Bonus access until ${fmt(access.until)}` : '', upgrade: true };
    case 'free_tier': {
      const l = access.limits;
      return {
        badge: 'Free plan', headline: 'Free',
        detail: l ? `${l.detection_minutes_per_day} minutes of detection a day and the last ${l.history_days} days of history.` : '',
        upgrade: true,
      };
    }
    default:
      return null;
  }
}
