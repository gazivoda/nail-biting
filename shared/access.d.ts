import type { GrantKind } from './plans.js';

export type { GrantKind };

/** One local grant that is (or was) running. `ends_at` null means it never ends (lifetime). */
export interface Grant {
  kind: GrantKind;
  ends_at: string | null;
}

export interface FreeTierEntitlement {
  detection_minutes_per_day: number;
  history_days: number;
}

/**
 * What /api/user/me adds when an account has something besides a subscription or a trial.
 * Absent for every account without a running grant while the free_tier flag is off.
 */
export interface Entitlement {
  /** Grants running now (lifetime, gift, referral credit). */
  grants?: Grant[];
  /** Gift or credit days that are saved and start when nothing else gives access. */
  banked_days?: number;
  /** Present only while the free_tier flag is on. */
  free_tier?: FreeTierEntitlement;
}

export interface AccessInput {
  trial_end_date: string | null;
  subscription_status: 'trial' | 'active' | 'paused' | 'cancelled' | 'expired';
  subscription_plan?: string | null;
  subscription_end_date?: string | null;
  entitlement?: Entitlement | null;
}

export type AccessState = 'trial_active' | 'subscribed' | 'free_tier' | 'paywall';
export type AccessSource =
  | 'monthly' | 'yearly' | 'subscription'
  | 'lifetime' | 'gift' | 'referral_credit'
  | 'trial' | 'free_tier' | 'expired';

export interface Access {
  status: AccessState;
  source: AccessSource;
  until: string | null;
  limits?: FreeTierEntitlement;
}

export function grantIsRunning(grant: Grant | null | undefined, now?: number): boolean;
export function bestGrant(entitlement: Entitlement | null | undefined, now?: number): Grant | null;
export function evaluateAccess(user: AccessInput, now?: number): Access;
