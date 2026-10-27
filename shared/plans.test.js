import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as plans from './plans.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// A fresh Node process with its own environment: the constant is read at import time.
function inChild(env, code) {
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, ...env },
  });
  expect(res.status, res.stderr).toBe(0);
  return JSON.parse(res.stdout);
}

describe('trial length', () => {
  it('defaults to 3 days: the owner has not decided on 7', () => {
    expect(plans.DEFAULT_TRIAL_DAYS).toBe(3);
    const out = inChild({}, `import * as p from './shared/plans.js'; console.log(JSON.stringify([p.TRIAL_DAYS, p.TRIAL_MS]))`);
    expect(out).toEqual([3, 3 * 86_400_000]);
  });

  it('is overridden by the environment variable TRIAL_DAYS', () => {
    const out = inChild({ TRIAL_DAYS: '7' }, `import * as p from './shared/plans.js'; console.log(JSON.stringify([p.TRIAL_DAYS, p.TRIAL_MS, p.TRIAL_HYPHEN, p.TRIAL_DAYS_TEXT]))`);
    expect(out).toEqual([7, 7 * 86_400_000, '7-day', '7 days']);
  });

  it.each(['', '0', '-3', '3.5', 'three', '91', '1e3', ' '])('ignores the unusable value %j and keeps the default', raw => {
    expect(plans.parseTrialDays(raw)).toBe(3);
  });

  it('accepts whole numbers from 1 to the maximum', () => {
    expect(plans.parseTrialDays('1')).toBe(1);
    expect(plans.parseTrialDays(' 14 ')).toBe(14);
    expect(plans.parseTrialDays(String(plans.MAX_TRIAL_DAYS))).toBe(plans.MAX_TRIAL_DAYS);
  });

  it('explains an unusable value for the boot log, and says nothing when it is fine or unset', () => {
    expect(plans.trialDaysProblem(undefined)).toBeNull();
    expect(plans.trialDaysProblem('')).toBeNull();
    expect(plans.trialDaysProblem('7')).toBeNull();
    expect(plans.trialDaysProblem('seven')).toMatch(/not a whole number from 1 to 90; using 3/);
  });
});

describe('trial copy', () => {
  it('spells 3 the way the copy has always spelled it', () => {
    expect(plans.trialCopy(3)).toEqual({
      TRIAL_DAYS: '3', TRIAL_HYPHEN: '3-day', TRIAL_DAYS_TEXT: '3 days',
      TRIAL_WORD_HYPHEN: 'three-day', TRIAL_WORDS: 'three days', TRIAL_WORDS_CAP: 'Three days',
    });
  });

  it('spells 7', () => {
    expect(plans.trialCopy(7)).toEqual({
      TRIAL_DAYS: '7', TRIAL_HYPHEN: '7-day', TRIAL_DAYS_TEXT: '7 days',
      TRIAL_WORD_HYPHEN: 'seven-day', TRIAL_WORDS: 'seven days', TRIAL_WORDS_CAP: 'Seven days',
    });
  });

  it('uses the singular for one day and digits above twelve', () => {
    expect(plans.trialCopy(1)).toMatchObject({ TRIAL_DAYS_TEXT: '1 day', TRIAL_WORDS: 'one day', TRIAL_WORDS_CAP: 'One day', TRIAL_HYPHEN: '1-day' });
    expect(plans.trialCopy(14)).toMatchObject({ TRIAL_WORDS: '14 days', TRIAL_WORD_HYPHEN: '14-day' });
  });

  it('the exported spellings are the ones for this process', () => {
    expect(plans.TRIAL_COPY).toEqual(plans.trialCopy(plans.TRIAL_DAYS));
    expect(plans.TRIAL_HYPHEN).toBe(plans.TRIAL_COPY.TRIAL_HYPHEN);
    expect(plans.TRIAL_WORDS_CAP).toBe(plans.TRIAL_COPY.TRIAL_WORDS_CAP);
  });

  it('fills both placeholder styles and leaves unknown names alone', () => {
    const copy = plans.trialCopy(7);
    expect(plans.fillTrialTokens('a ${TRIAL_HYPHEN} trial, {{TRIAL_DAYS_TEXT}} free, ${TRIAL_NOPE}, {{TRIAL_DAYS}}', copy))
      .toBe('a 7-day trial, 7 days free, ${TRIAL_NOPE}, 7');
    expect(plans.fillTrialTokens('no placeholders here, 3-day stays', copy)).toBe('no placeholders here, 3-day stays');
  });
});

describe('other configurable numbers', () => {
  it('free tier limits are conservative placeholders, overridable', () => {
    expect(plans.freeTierLimits({})).toEqual({ detectionMinutesPerDay: 30, historyDays: 7 });
    expect(plans.freeTierLimits({ FREE_TIER_DETECTION_MINUTES: '45', FREE_TIER_HISTORY_DAYS: '14' }))
      .toEqual({ detectionMinutesPerDay: 45, historyDays: 14 });
    expect(plans.freeTierLimits({ FREE_TIER_DETECTION_MINUTES: '0', FREE_TIER_HISTORY_DAYS: 'x' }))
      .toEqual({ detectionMinutesPerDay: 30, historyDays: 7 });
  });

  it('referral credit defaults to 30 days', () => {
    expect(plans.referralCreditDays({})).toBe(30);
    expect(plans.referralCreditDays({ REFERRAL_CREDIT_DAYS: '14' })).toBe(14);
    expect(plans.referralCreditDays({ REFERRAL_CREDIT_DAYS: '-1' })).toBe(30);
  });

  it('a gift lasts a year by default and never expires unredeemed unless asked', () => {
    expect(plans.giftDays({})).toBe(365);
    expect(plans.giftDays({ GIFT_PLAN_DAYS: '90' })).toBe(90);
    expect(plans.giftCodeExpiryDays({})).toBe(0);
    expect(plans.giftCodeExpiryDays({ GIFT_CODE_EXPIRY_DAYS: '180' })).toBe(180);
  });

  it('the Dockerfile copies shared/ into the build stage and into the runtime image', async () => {
    const { readFileSync } = await import('node:fs');
    const docker = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
    expect(docker.match(/^COPY shared \.\/shared$/gm)).toHaveLength(2);
    expect(docker).toMatch(/^ARG TRIAL_DAYS$/m);
    expect(docker).toMatch(/^ENV TRIAL_DAYS=\$TRIAL_DAYS$/m);
  });

  it('the type declaration file names every export', async () => {
    const { readFileSync } = await import('node:fs');
    const dts = readFileSync(join(ROOT, 'shared/plans.d.ts'), 'utf8');
    for (const name of Object.keys(plans)) expect(dts, name).toMatch(new RegExp(`\\b${name}\\b`));
  });
});

describe('the Lifetime list price (what the server-rendered copy says)', () => {
  it('is 99 US dollars by default, the price of the Paddle product', () => {
    expect(plans.DEFAULT_LIFETIME_PRICE_USD).toBe(99);
    expect(plans.lifetimePriceUsd({})).toBe(99);
    const out = inChild({ LIFETIME_PRICE_USD: '' }, `import * as p from './shared/plans.js'; console.log(JSON.stringify(p.LIFETIME_PRICE_USD))`);
    expect(out).toBe(99);
  });

  it('is overridden by the environment variable LIFETIME_PRICE_USD, read at import time', () => {
    const out = inChild({ LIFETIME_PRICE_USD: '149' }, `import * as p from './shared/plans.js'; console.log(JSON.stringify(p.LIFETIME_PRICE_USD))`);
    expect(out).toBe(149);
    expect(plans.lifetimePriceUsd({ LIFETIME_PRICE_USD: ' 79 ' })).toBe(79);
  });

  it.each(['', '0', '-5', '9.99', 'ninety', '1e3', '100001', ' '])('ignores the unusable value %j and keeps 99', raw => {
    expect(plans.lifetimePriceUsd({ LIFETIME_PRICE_USD: raw })).toBe(99);
  });
});
