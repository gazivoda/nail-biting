// Paddle.js for the pages that are not the in-app paywall: the pricing page's localized prices and the
// gift checkout. (PaywallPage starts its own instance, as it always did, and does not use this file.)
//
// One lazy instance per page load. The SDK is imported on demand, so a visitor who never opens a gift or a
// price preview never downloads it (it is the `paddle` chunk in vite.config.ts). Everything resolves to
// `null` instead of throwing: an ad blocker or a bad connection must leave the page working with the
// fixed prices and no gift button, not with an error.

import type { CheckoutEventsData, Paddle, PaddleEventData } from '@paddle/paddle-js';
import { PADDLE_CLIENT_TOKEN, PADDLE_ENV } from './env';

export type PaddleEvent = PaddleEventData;
type Listener = (event: PaddleEvent) => void;

const listeners = new Set<Listener>();
let instance: Promise<Paddle | null> | null = null;

/** Receives every Paddle.js event (checkout.completed, ...). Returns the unsubscribe. */
export function onPaddleEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function paddleAvailable(): boolean {
  return PADDLE_CLIENT_TOKEN !== '';
}

export function loadPaddle(): Promise<Paddle | null> {
  if (!paddleAvailable()) return Promise.resolve(null);
  instance ??= import('@paddle/paddle-js')
    .then(({ initializePaddle }) => initializePaddle({
      token: PADDLE_CLIENT_TOKEN,
      environment: PADDLE_ENV,
      eventCallback: event => listeners.forEach(fn => { try { fn(event); } catch { /* a listener must not break the SDK */ } }),
    }))
    .then(p => p ?? null)
    .catch(() => null);
  return instance;
}

/** The transaction id of a finished checkout, or null. */
export function completedTransactionId(event: PaddleEvent): string | null {
  if (event.name !== 'checkout.completed') return null;
  return (event.data as CheckoutEventsData | undefined)?.transaction_id ?? null;
}

/**
 * Opens the overlay checkout for the gift. No account is needed to BUY a gift; if the buyer is signed in
 * their id rides along in customData (the server treats it as a hint only).
 * @returns false when Paddle could not be loaded
 */
export async function openGiftCheckout(priceId: string, opts: { email?: string; userId?: string } = {}): Promise<boolean> {
  const paddle = await loadPaddle();
  if (!paddle) return false;
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: opts.email ? { email: opts.email } : undefined,
    customData: opts.userId ? { userId: opts.userId } : undefined,
  });
  return true;
}
