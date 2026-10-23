// Types for plans.js. Keep the two files in step: shared/plans.test.js imports
// every name below from plans.js, so a missing export fails there.

export const DEFAULT_TRIAL_DAYS: number;
export const MAX_TRIAL_DAYS: number;

export function parseWholeNumber(raw: unknown, fallback: number, min?: number, max?: number): number;
export function parseTrialDays(raw: unknown, fallback?: number): number;
export function trialDaysProblem(raw: unknown): string | null;

export const TRIAL_DAYS: number;
export const TRIAL_MS: number;

export interface TrialCopy {
  TRIAL_DAYS: string;
  TRIAL_HYPHEN: string;
  TRIAL_DAYS_TEXT: string;
  TRIAL_WORD_HYPHEN: string;
  TRIAL_WORDS: string;
  TRIAL_WORDS_CAP: string;
}
export function trialCopy(days?: number): TrialCopy;
export const TRIAL_COPY: TrialCopy;
export const TRIAL_HYPHEN: string;
export const TRIAL_DAYS_TEXT: string;
export const TRIAL_WORD_HYPHEN: string;
export const TRIAL_WORDS: string;
export const TRIAL_WORDS_CAP: string;
export function fillTrialTokens(text: string, copy?: TrialCopy): string;

export interface FreeTierLimits {
  detectionMinutesPerDay: number;
  historyDays: number;
}
export const FREE_TIER_DEFAULTS: Readonly<FreeTierLimits>;
export function freeTierLimits(env?: Record<string, string | undefined>): FreeTierLimits;

export const DEFAULT_REFERRAL_CREDIT_DAYS: number;
export function referralCreditDays(env?: Record<string, string | undefined>): number;
export const DEFAULT_GIFT_DAYS: number;
export function giftDays(env?: Record<string, string | undefined>): number;
export function describeDays(days: number): string;
export function giftCodeExpiryDays(env?: Record<string, string | undefined>): number;

export type GrantKind = 'lifetime' | 'gift' | 'referral_credit';
export const GRANT_KINDS: readonly GrantKind[];
