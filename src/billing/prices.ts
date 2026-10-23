// Localized prices from Paddle.js (flag regional_pricing).
//
// With the flag on, the pricing section asks Paddle what each plan costs for this visitor and shows
// those figures. Nothing about another currency is written into the site: when the flag is off, when
// Paddle is not configured, when the SDK is blocked, when the request is slow or fails, or when the answer
// is not what was asked for, the caller gets an empty map and shows the fixed $2.99 and $29 as it always did.
//
// NOT VERIFIED AGAINST A LIVE PADDLE ACCOUNT: the call omits `address`, so Paddle.js is relied on to price
// for the visitor's location (its documented behaviour for PricePreview without an address). Check it in
// the sandbox, from a few countries, before turning the flag on (docs/agents/ws9-notes.md).

import { useEffect, useState } from 'react';
import type { Paddle, PricePreviewResponse } from '@paddle/paddle-js';
import { useFeature } from '../features/useFeature';
import { loadPaddle } from './paddleClient';

export interface LocalizedPrice {
  /** What Paddle will charge, already formatted for the visitor ("£2.49", "2,99 €"). */
  total: string;
  currency: string;
}
export type LocalizedPrices = Record<string, LocalizedPrice>;

/** Reads a PricePreview answer. Anything unexpected gives an empty map, never a throw. */
export function parsePricePreview(response: unknown): LocalizedPrices {
  const out: LocalizedPrices = {};
  try {
    const r = response as PricePreviewResponse | null | undefined;
    const currency = r?.data?.currencyCode;
    const lines = r?.data?.details?.lineItems;
    if (typeof currency !== 'string' || !Array.isArray(lines)) return out;
    for (const line of lines) {
      const id = line?.price?.id;
      const total = line?.formattedTotals?.total;
      if (typeof id === 'string' && typeof total === 'string' && total.trim() !== '') out[id] = { total: total.trim(), currency };
    }
  } catch { /* fall through to the fixed prices */ }
  return out;
}

/** True only when every price id asked for has an answer. A half-localized pricing table would mislead. */
export function hasAll(prices: LocalizedPrices, ids: string[]): boolean {
  return ids.length > 0 && ids.every(id => prices[id] !== undefined);
}

const TIMEOUT_MS = 6000;

export async function previewPrices(paddle: Pick<Paddle, 'PricePreview'>, ids: string[]): Promise<LocalizedPrices> {
  if (ids.length === 0) return {};
  try {
    const answer = await Promise.race([
      paddle.PricePreview({ items: ids.map(priceId => ({ priceId, quantity: 1 })) }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('price preview timed out')), TIMEOUT_MS)),
    ]);
    return parsePricePreview(answer);
  } catch {
    return {};
  }
}

/**
 * Localized prices for `ids`, or {} while loading and whenever anything fails.
 *   * Gated by the regional_pricing flag, unless `always` is set (the lifetime and gift prices have no fixed
 *     fallback to localize, so they are always asked for what Paddle will charge).
 *   * Pass `paddle` when the page already has an instance (the in-app paywall does; null while it starts):
 *     that instance is used and no second one is ever created. Leave it out and one is loaded here.
 */
export function useLocalizedPrices(
  ids: string[], opts: { paddle?: Paddle | null; always?: boolean } = {},
): LocalizedPrices {
  const flag = useFeature('regional_pricing');
  const enabled = opts.always === true || flag;
  const [prices, setPrices] = useState<LocalizedPrices>({});
  const key = ids.filter(Boolean).join(',');
  const provided = 'paddle' in opts;
  const paddle = opts.paddle ?? null;

  useEffect(() => {
    if (!enabled || key === '') return;
    let live = true;
    void (async () => {
      const sdk = provided ? paddle : await loadPaddle();
      if (!sdk || !live) return;
      const got = await previewPrices(sdk, key.split(','));
      if (live) setPrices(got);
    })();
    return () => { live = false; };
  }, [enabled, key, provided, paddle]);

  return enabled ? prices : {};
}
