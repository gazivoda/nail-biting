// How Settings > Plan words the new states. Returns null for every account whose access comes from a
// subscription or the trial, which keep the wording they always had; the plan card falls back to it.

import { computeAccess } from '../utils/access';
import { formatDate } from '../i18n/format';
import { t } from '../i18n/scopes/billing';
import { PLAN_FEATURES, YEARLY_EXTRA } from '../components/site/plans';
import type { UserProfile } from '../types/access';

export interface PlanOverride {
  badge: string;
  headline: string;
  detail: string;
  /** Offer "Choose a plan": true when what they have will run out or is limited. */
  upgrade: boolean;
}

const fmt = (iso: string) => formatDate(iso, { year: 'numeric', month: 'short', day: 'numeric' });

export function planOverride(user: UserProfile, now: number = Date.now()): PlanOverride | null {
  const access = computeAccess(user, now);
  switch (access.source) {
    case 'lifetime':
      return { badge: t('plan.lifetime'), headline: t('plan.lifetime'), detail: t('plan.lifetime.detail'), upgrade: false };
    case 'gift':
      return { badge: t('plan.gift'), headline: t('plan.gift'), detail: access.until ? t('plan.gift.until', { date: fmt(access.until) }) : '', upgrade: true };
    case 'referral_credit':
      return { badge: t('plan.referral'), headline: t('plan.referral'), detail: access.until ? t('plan.referral.until', { date: fmt(access.until) }) : '', upgrade: true };
    case 'free_tier': {
      const l = access.limits;
      return {
        badge: t('plan.free.badge'), headline: t('plan.free'),
        detail: l ? t('plan.free.detail', { minutes: l.detection_minutes_per_day, days: l.history_days }) : '',
        upgrade: true,
      };
    }
    default:
      return null;
  }
}

export { describeLength } from './planLength';

// The lines of what a plan includes. The list itself lives in src/components/site/plans.ts (the marketing
// pricing cards read it too); the line at a given position is shown through the catalog, and a line this
// table does not know about is shown as written.
const FEATURE_KEYS = ['feature.detection', 'feature.streak', 'feature.history', 'feature.alert'] as const;

export function planFeature(line: string): string {
  if (line === YEARLY_EXTRA) return t('feature.support');
  const at = PLAN_FEATURES.indexOf(line);
  return at >= 0 && at < FEATURE_KEYS.length ? t(FEATURE_KEYS[at]) : line;
}
