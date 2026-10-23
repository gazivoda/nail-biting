import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { hasAll, parsePricePreview, previewPrices } from './prices';
import { forgetReferral, parseRefParam, pendingReferral, REFERRAL_KEEP_MS, rememberReferral } from './referral';
import { cleanGiftCode, forgetGiftCode, GIFT_KEEP_MS, pendingGiftCode, rememberGiftCode, takeGiftCode } from './giftCode';
import { addSeconds, dayKey, limitReached, minutesUsed, secondsLeft, usageToday, visibleHistory } from './freeTier';
import { planOverride } from './planLabel';
import { resetStorage, useMemoryStorage } from '../../test-utils/memoryStorage';
import { resetFlagsForTests } from '../features/flags';
import { PlanExtras } from '../components/billing/PlanExtras';
import { ReferralCard } from '../components/billing/ReferralCard';
import type { UserProfile } from '../types/access';

beforeEach(() => { useMemoryStorage(); resetFlagsForTests(); });
afterEach(() => { resetStorage(); resetFlagsForTests(); vi.useRealTimers(); });

describe('localized prices', () => {
  const answer = (items: Array<[string, string]>, currency = 'GBP') => ({
    data: { currencyCode: currency, details: { lineItems: items.map(([id, total]) => ({ price: { id }, formattedTotals: { total } })) } },
  });

  it('reads Paddle\'s formatted totals by price id', () => {
    expect(parsePricePreview(answer([['pri_m', '£2.49'], ['pri_y', '£24.00']]))).toEqual({
      pri_m: { total: '£2.49', currency: 'GBP' }, pri_y: { total: '£24.00', currency: 'GBP' },
    });
  });

  it.each([null, undefined, 42, 'x', {}, { data: {} }, { data: { currencyCode: 'USD' } }, { data: { currencyCode: 'USD', details: { lineItems: 'no' } } }])(
    'gives an empty map for an answer it does not understand: %j', bad => {
      expect(parsePricePreview(bad)).toEqual({});
    });

  it('skips a line without a usable total', () => {
    expect(parsePricePreview(answer([['pri_m', ''], ['pri_y', '$29.00']]))).toEqual({ pri_y: { total: '$29.00', currency: 'GBP' } });
  });

  it('is complete only when every asked price has an answer', () => {
    const got = parsePricePreview(answer([['pri_m', '£2.49']]));
    expect(hasAll(got, ['pri_m'])).toBe(true);
    expect(hasAll(got, ['pri_m', 'pri_y'])).toBe(false);
    expect(hasAll({}, [])).toBe(false);
  });

  it('asks Paddle for one unit of each price', async () => {
    const PricePreview = vi.fn().mockResolvedValue(answer([['pri_m', '£2.49']]));
    expect(await previewPrices({ PricePreview }, ['pri_m'])).toEqual({ pri_m: { total: '£2.49', currency: 'GBP' } });
    expect(PricePreview).toHaveBeenCalledWith({ items: [{ priceId: 'pri_m', quantity: 1 }] });
  });

  it('falls back to nothing (so the fixed prices show) when Paddle fails', async () => {
    expect(await previewPrices({ PricePreview: () => Promise.reject(new Error('blocked')) }, ['pri_m'])).toEqual({});
    expect(await previewPrices({ PricePreview: () => Promise.resolve({ nonsense: true } as never) }, ['pri_m'])).toEqual({});
    expect(await previewPrices({ PricePreview: vi.fn() }, [])).toEqual({});
  });

  it('falls back when Paddle is too slow', async () => {
    vi.useFakeTimers();
    const slow = previewPrices({ PricePreview: () => new Promise(() => undefined) }, ['pri_m']);
    await vi.advanceTimersByTimeAsync(6100);
    expect(await slow).toEqual({});
  });
});

describe('the referral link on the visitor\'s side', () => {
  it('accepts only a well-formed code', () => {
    expect(parseRefParam('?ref=ab2cd3ef')).toBe('AB2CD3EF');
    for (const bad of ['', '?ref=', '?ref=short', '?ref=ABCDEFGHI', '?ref=0OIL1ABC', '?x=ABCDEFGH']) expect(parseRefParam(bad), bad).toBeNull();
  });

  it('keeps the code for 30 days, then forgets it', () => {
    expect(pendingReferral()).toBeNull();
    expect(rememberReferral('AB2CD3EF', 1000)).toBe(true);
    expect(pendingReferral(1000 + REFERRAL_KEEP_MS - 1)).toBe('AB2CD3EF');
    expect(pendingReferral(1000 + REFERRAL_KEEP_MS + 1)).toBeNull();
    expect(pendingReferral(1000)).toBeNull();   // the stale entry was removed
  });

  it('can be forgotten once used', () => {
    rememberReferral('AB2CD3EF');
    forgetReferral();
    expect(pendingReferral()).toBeNull();
  });
});

describe('the gift code on the recipient\'s side', () => {
  it('accepts a code with or without hyphens and spaces, in any case', () => {
    expect(cleanGiftCode('abcde-fghjk mnpqr-stvwx')).toBe('ABCDEFGHJKMNPQRSTVWX');
    for (const bad of ['', 'short', 'ABCDE-FGHJK-MNPQR-STVW!', 42, null]) expect(cleanGiftCode(bad)).toBeNull();
  });

  it('takes the code the page put in window.__sbGiftCode, stores it, and removes it from the page', () => {
    const w = globalThis as unknown as { window?: { __sbGiftCode?: string } };
    w.window = { __sbGiftCode: 'ABCDE-FGHJK-MNPQR-STVWX' };
    try {
      expect(takeGiftCode(5)).toBe('ABCDEFGHJKMNPQRSTVWX');
      expect(w.window.__sbGiftCode).toBeUndefined();
      expect(pendingGiftCode(6)).toBe('ABCDEFGHJKMNPQRSTVWX');
    } finally { delete w.window; }
  });

  it('keeps it for 7 days and not longer; a bad value in the page is dropped', () => {
    rememberGiftCode('ABCDEFGHJKMNPQRSTVWX', 10);
    expect(pendingGiftCode(10 + GIFT_KEEP_MS - 1)).toBe('ABCDEFGHJKMNPQRSTVWX');
    expect(pendingGiftCode(10 + GIFT_KEEP_MS + 1)).toBeNull();
    const w = globalThis as unknown as { window?: { __sbGiftCode?: string } };
    w.window = { __sbGiftCode: 'nonsense' };
    try { expect(takeGiftCode()).toBeNull(); } finally { delete w.window; }
  });

  it('is forgotten once redeemed', () => {
    rememberGiftCode('ABCDEFGHJKMNPQRSTVWX');
    forgetGiftCode();
    expect(pendingGiftCode()).toBeNull();
  });
});

describe('free tier limits', () => {
  const at = (iso: string) => new Date(iso);

  it('counts per local day and starts again the next day', () => {
    const monday = at('2026-10-26T09:00:00');
    expect(dayKey(monday)).toBe('2026-10-26');
    const used = addSeconds(addSeconds(null, 60, monday), 30, monday);
    expect(used).toEqual({ day: '2026-10-26', seconds: 90 });
    expect(minutesUsed(used)).toBe(1);
    expect(usageToday(used, at('2026-10-27T00:00:01'))).toEqual({ day: '2026-10-27', seconds: 0 });
    expect(addSeconds(used, 5, at('2026-10-27T08:00:00'))).toEqual({ day: '2026-10-27', seconds: 5 });
  });

  it('ignores a corrupt stored value', () => {
    expect(usageToday({ day: '2026-10-26', seconds: -4 }, at('2026-10-26T10:00:00')).seconds).toBe(0);
    expect(usageToday({ day: '2026-10-26', seconds: NaN }, at('2026-10-26T10:00:00')).seconds).toBe(0);
  });

  it('stops at the limit', () => {
    expect(limitReached(30, { day: 'd', seconds: 1799 })).toBe(false);
    expect(limitReached(30, { day: 'd', seconds: 1800 })).toBe(true);
    expect(secondsLeft(30, { day: 'd', seconds: 1700 })).toBe(100);
    expect(secondsLeft(30, { day: 'd', seconds: 9999 })).toBe(0);
  });

  it('shows the last N days of history, counts the rest, and returns the same array when nothing is hidden', () => {
    const now = Date.parse('2026-10-23T12:00:00Z');
    const day = 86_400_000;
    const entries = [0, 1, 6, 8, 30].map(d => ({ timestamp: now - d * day, d }));
    const { visible, hidden } = visibleHistory(entries, 7, now);
    expect(visible.map(e => e.d)).toEqual([0, 1, 6]);
    expect(hidden).toBe(2);
    const recent = entries.slice(0, 3);
    expect(visibleHistory(recent, 7, now).visible).toBe(recent);
    expect(visibleHistory(entries, null, now)).toEqual({ visible: entries, hidden: 0 });
  });
});

describe('Settings > Plan wording for the new states', () => {
  const base: UserProfile = {
    id: 'u', email: 'a@b.c', name: 'A', avatar: null, trial_end_date: '2020-01-01T00:00:00Z',
    subscription_status: 'expired', subscription_plan: null, subscription_end_date: null,
    paddle_subscription_id: null, paddle_customer_id: null,
  };
  const NOW = Date.parse('2026-10-23T12:00:00Z');

  it('is null for every account whose access is a subscription, the trial or nothing', () => {
    expect(planOverride(base, NOW)).toBeNull();
    expect(planOverride({ ...base, subscription_status: 'active', subscription_plan: 'yearly' }, NOW)).toBeNull();
    expect(planOverride({ ...base, subscription_status: 'trial', trial_end_date: '2027-01-01T00:00:00Z' }, NOW)).toBeNull();
  });

  it('words lifetime, gift, referral credit and the free plan', () => {
    expect(planOverride({ ...base, entitlement: { grants: [{ kind: 'lifetime', ends_at: null }] } }, NOW))
      .toMatchObject({ badge: 'Lifetime', headline: 'Lifetime', upgrade: false });
    expect(planOverride({ ...base, entitlement: { grants: [{ kind: 'gift', ends_at: '2027-10-23T12:00:00Z' }] } }, NOW))
      .toMatchObject({ badge: 'Gift', upgrade: true, detail: expect.stringContaining('Access until') });
    expect(planOverride({ ...base, entitlement: { grants: [{ kind: 'referral_credit', ends_at: '2026-11-22T12:00:00Z' }] } }, NOW))
      .toMatchObject({ badge: 'Referral credit', upgrade: true });
    expect(planOverride({ ...base, entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: 7 } } }, NOW))
      .toMatchObject({ badge: 'Free plan', detail: '30 minutes of detection a day and the last 7 days of history.', upgrade: true });
  });
});

describe('with every flag off the new surfaces draw nothing', () => {
  it('PlanExtras (lifetime and gift on /pricing)', () => {
    expect(renderToStaticMarkup(createElement(PlanExtras))).toBe('');
  });
  it('ReferralCard (Settings), and it needs no signed-in session to say so', () => {
    expect(renderToStaticMarkup(createElement(ReferralCard))).toBe('');
  });
});
