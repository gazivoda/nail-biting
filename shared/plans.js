// The plan and trial numbers, in ONE place (WS9).
//
// Three audiences import this file, so it is plain ES-module JavaScript with a
// hand-written plans.d.ts beside it:
//   * the server (server.js, server/**), which runs on Node 22 with no
//     TypeScript step in the runtime image;
//   * the browser bundle (src/**), through Vite;
//   * the build scripts (scripts/*.mjs) and vite.config.ts, through Node.
// It must stay free of DOM, React and Node-only imports.
//
// TRIAL LENGTH. DEFAULT_TRIAL_DAYS is 3, the length the site has always
// promised. OWNER DECISION PENDING: the plan proposes 7. Do not change the
// default here; set the environment variable TRIAL_DAYS instead (section
// "Trial length" in docs/agents/ws9-notes.md). The value is read from
// process.env at import time:
//   * on the server it is the length new accounts get (server.js,
//     server/auth/accounts.js) and the length every server-rendered page says;
//   * in a build (vite, scripts/generate-seo-content.mjs) it is the length the
//     client bundle, dist/index.html, dist/seo-content.json and
//     dist/llms-full.txt say. vite.config.ts copies it into the bundle with
//     `define`, so set TRIAL_DAYS for the BUILD as well as the running server
//     (a Docker build arg plus a runtime variable). A shell variable or a
//     Coolify variable, not a line in .env: nothing loads .env before this
//     module is evaluated.
//
// Copy that mentions our trial must be spelled with the ${TRIAL_*} tokens from
// trialCopy() below, never with a number. scripts/trialLength.test.mjs fails
// when a literal length reappears outside the allowlist in that test.

/** The shipped trial length, in days. OWNER DECISION PENDING (the plan proposes 7). */
export const DEFAULT_TRIAL_DAYS = 3;
/** Anything above this is read as a typo and ignored. */
export const MAX_TRIAL_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

// `process` does not exist in a browser. Vite replaces the literal text
// `process.env.TRIAL_DAYS` at build time (vite.config.ts `define`), so this must
// stay a plain member expression and not a computed lookup.
function rawTrialDays() {
  try { return process.env.TRIAL_DAYS; } catch { return undefined; }
}

function processEnv() {
  try { return process.env; } catch { return {}; }
}

/** A whole number from min to max, written as digits only. Anything else gives `fallback`. */
export function parseWholeNumber(raw, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  if (!/^\d{1,9}$/.test(text)) return fallback;
  const n = Number(text);
  return n >= min && n <= max ? n : fallback;
}

/** TRIAL_DAYS as written in the environment: a whole number of days, 1 to MAX_TRIAL_DAYS, else the default. */
export function parseTrialDays(raw, fallback = DEFAULT_TRIAL_DAYS) {
  return parseWholeNumber(raw, fallback, 1, MAX_TRIAL_DAYS);
}

/** Why TRIAL_DAYS was ignored, or null when it is unset or fine. For a boot-time warning. */
export function trialDaysProblem(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  return parseTrialDays(raw, 0) === 0
    ? `TRIAL_DAYS="${raw}" is not a whole number from 1 to ${MAX_TRIAL_DAYS}; using ${DEFAULT_TRIAL_DAYS}`
    : null;
}

/** The trial length this process uses. */
export const TRIAL_DAYS = parseTrialDays(rawTrialDays());
/** The same, in milliseconds. New accounts' trial_end_date is now + TRIAL_MS. */
export const TRIAL_MS = TRIAL_DAYS * DAY_MS;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * Every spelling of the trial length the copy uses. The keys are the names of
 * the tokens: write `${TRIAL_HYPHEN} free trial` in a template literal (or
 * `{{TRIAL_HYPHEN}}` in index.html) and the build fills it in.
 *
 *   TRIAL_DAYS        3
 *   TRIAL_HYPHEN      3-day
 *   TRIAL_DAYS_TEXT   3 days     (1 day when the trial is one day)
 *   TRIAL_WORD_HYPHEN three-day
 *   TRIAL_WORDS       three days
 *   TRIAL_WORDS_CAP   Three days
 */
export function trialCopy(days = TRIAL_DAYS) {
  const n = parseTrialDays(days);
  const word = n <= 12 ? WORDS[n] : String(n);
  const words = n === 1 ? `${word} day` : `${word} days`;
  return {
    TRIAL_DAYS: String(n),
    TRIAL_HYPHEN: `${n}-day`,
    TRIAL_DAYS_TEXT: n === 1 ? '1 day' : `${n} days`,
    TRIAL_WORD_HYPHEN: `${word}-day`,
    TRIAL_WORDS: words,
    TRIAL_WORDS_CAP: words.charAt(0).toUpperCase() + words.slice(1),
  };
}

/** The spellings for this process's trial length. */
export const TRIAL_COPY = trialCopy(TRIAL_DAYS);
export const { TRIAL_HYPHEN, TRIAL_DAYS_TEXT, TRIAL_WORD_HYPHEN, TRIAL_WORDS, TRIAL_WORDS_CAP } = TRIAL_COPY;

const TOKEN = /\$\{(TRIAL_[A-Z_]+)\}|\{\{(TRIAL_[A-Z_]+)\}\}/g;

/**
 * Replaces `${TRIAL_*}` and `{{TRIAL_*}}` placeholders in source text with the
 * copy for `copy`. Unknown names are left as they are. Used by the build (the
 * index.html transform in vite.config.ts) and by scripts/sync-seo.mjs, which
 * reads source files as text and must see exactly what the page will say.
 */
export function fillTrialTokens(text, copy = TRIAL_COPY) {
  return text.replace(TOKEN, (whole, a, b) => copy[a ?? b] ?? whole);
}

// ─── Free tier ────────────────────────────────────────────────────────────────
// OWNER DECISION PENDING. Conservative placeholders so that turning the
// `free_tier` flag on cannot give much away; the owner sets the real numbers
// with FREE_TIER_DETECTION_MINUTES and FREE_TIER_HISTORY_DAYS on the server
// (read at request time, no rebuild). With the flag off none of this is used.

export const FREE_TIER_DEFAULTS = Object.freeze({
  /** Minutes of detection per calendar day (the user's local day). */
  detectionMinutesPerDay: 30,
  /** How many days of history the History screen shows. Older entries stay on the device. */
  historyDays: 7,
});

export function freeTierLimits(env = processEnv()) {
  return {
    detectionMinutesPerDay: parseWholeNumber(env.FREE_TIER_DETECTION_MINUTES, FREE_TIER_DEFAULTS.detectionMinutesPerDay, 1, 24 * 60),
    historyDays: parseWholeNumber(env.FREE_TIER_HISTORY_DAYS, FREE_TIER_DEFAULTS.historyDays, 1, 3650),
  };
}

// ─── Referrals and gifts ──────────────────────────────────────────────────────

/** Days of bonus access each side gets when a referred user's first payment completes. */
export const DEFAULT_REFERRAL_CREDIT_DAYS = 30;
export function referralCreditDays(env = processEnv()) {
  return parseWholeNumber(env.REFERRAL_CREDIT_DAYS, DEFAULT_REFERRAL_CREDIT_DAYS, 1, 365);
}

/**
 * How long a redeemed gift lasts. The price of the Paddle gift product has to
 * match this; with one gift product there is one duration. OWNER DECISION PENDING.
 */
export const DEFAULT_GIFT_DAYS = 365;
export function giftDays(env = processEnv()) {
  return parseWholeNumber(env.GIFT_PLAN_DAYS, DEFAULT_GIFT_DAYS, 1, 3650);
}

// ─── Lifetime plan ────────────────────────────────────────────────────────────

/**
 * The Lifetime plan's list price in US dollars, for the copy only: the visible price on the page is what Paddle
 * reports (src/billing/prices.ts), so the server has no other way to know it. THIS NUMBER MUST EQUAL THE PADDLE
 * PRICE. It is what /pricing, the homepage article, the product node's Offer, llms.txt and llms-full.txt say
 * (server/marketing/lifetimeCopy.js) when the plan is for sale; nothing else reads it, and nothing charges it.
 * If the Paddle price changes, change this (the environment variable LIFETIME_PRICE_USD, no rebuild: a runtime
 * variable) AND the "$99.00" in src/pages/TermsPage.tsx, which is the owner's legal wording and is not read from here.
 * The variable moves only what the SERVER writes. The browser bundle cannot see the environment, so the English compare-page
 * sentences and the pricing headline that it draws itself (shared/flagCopy.js lifetimeUsd, lifetimeHeadline) use this
 * default: to move the price for real, change this default too and rebuild.
 */
export const DEFAULT_LIFETIME_PRICE_USD = 99;

/** The Lifetime list price as written in the environment: a whole number of dollars, 1 to 100000, else the default. */
export function lifetimePriceUsd(env = processEnv()) {
  return parseWholeNumber(env.LIFETIME_PRICE_USD, DEFAULT_LIFETIME_PRICE_USD, 1, 100000);
}

/** The Lifetime list price this process uses (read at import time, like TRIAL_DAYS: a real environment variable). */
export const LIFETIME_PRICE_USD = /* @__PURE__ */ lifetimePriceUsd();

/** A length of time in the words the copy uses: "one year", "3 months", "45 days". */
export function describeDays(days) {
  if (days % 365 === 0) { const y = days / 365; return y === 1 ? 'one year' : `${y} years`; }
  if (days % 30 === 0) { const m = days / 30; return m === 1 ? 'one month' : `${m} months`; }
  return days === 1 ? 'one day' : `${days} days`;
}

/** Days a gift code stays redeemable after it is bought. 0 means it never expires (the default). */
export function giftCodeExpiryDays(env = processEnv()) {
  return parseWholeNumber(env.GIFT_CODE_EXPIRY_DAYS, 0, 0, 3650);
}

/** The kinds of local grant that give access besides a Paddle subscription. */
export const GRANT_KINDS = Object.freeze(['lifetime', 'gift', 'referral_credit']);
