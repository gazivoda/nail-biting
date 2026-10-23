// Reading the pieces of a Paddle transaction / adjustment payload that billing needs.
//
// NOT VALIDATED AGAINST A LIVE PADDLE ACCOUNT. The field names below follow Paddle Billing's
// published webhook payloads (transaction.completed, adjustment.created / adjustment.updated) as the
// author knows them; the fixtures in server/billing/*.test.js are written from the same
// understanding. Run one sandbox purchase of each product and compare with these readers before
// turning a flag on (docs/agents/ws9-notes.md, "Before you turn it on").

import { createHash } from 'node:crypto';

/** Every price id a transaction carries, from the places Paddle puts it. */
export function priceIdsOf(data) {
  const ids = new Set();
  for (const item of Array.isArray(data?.items) ? data.items : []) {
    if (typeof item?.price?.id === 'string') ids.add(item.price.id);
    if (typeof item?.price_id === 'string') ids.add(item.price_id);
  }
  for (const line of Array.isArray(data?.details?.line_items) ? data.details.line_items : []) {
    if (typeof line?.price_id === 'string') ids.add(line.price_id);
  }
  return [...ids];
}

/**
 * A hash of the card used: type, last four digits and expiry (Paddle's `payments[].method_details.card`).
 * Null for anything else (PayPal, Apple Pay and so on carry no card), so the check simply has nothing
 * to compare. The limits of this signal are written up in docs/agents/ws9-notes.md: two cards with the
 * same type, last four and expiry look identical (a rare false positive that only costs a reward),
 * and a second card defeats it completely.
 */
export function paymentFingerprint(data) {
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const captured = payments.find(p => p?.status === 'captured') ?? payments[0];
  const card = captured?.method_details?.card;
  if (!card || !card.last4) return null;
  const text = ['card', card.type ?? '', card.last4, card.expiry_month ?? '', card.expiry_year ?? ''].join('|').toLowerCase();
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/** The amount charged in minor units, or null when the payload does not say. */
export function chargedMinorUnits(data) {
  const totals = data?.details?.totals;
  const raw = totals?.grand_total ?? totals?.total;
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Renewals are not first payments. */
export function isRecurring(data) {
  return data?.origin === 'subscription_recurring';
}

/** The user id the checkout carried in customData (set by our client; trusted exactly as far as the existing webhook trusts it). */
export function customUserId(data) {
  const id = data?.custom_data?.userId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}
