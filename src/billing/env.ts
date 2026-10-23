// What the client knows about Paddle from the build. All of it is optional: a missing value means the
// surface that needs it stays hidden (lifetime and gift) or falls back to the fixed prices (regional
// pricing). The monthly and yearly ids are the ones PaywallPage has always read.

export const PADDLE_CLIENT_TOKEN = (import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined) || '';
export const PADDLE_ENV = ((import.meta.env.VITE_PADDLE_ENV as string | undefined) || 'production') as 'production' | 'sandbox';

export const PRICE_IDS = {
  monthly: (import.meta.env.VITE_PADDLE_PRICE_ID_MONTHLY as string | undefined) || '',
  yearly: (import.meta.env.VITE_PADDLE_PRICE_ID_YEARLY as string | undefined) || '',
  /** One-time lifetime price (flag lifetime_plan). Empty until the owner creates the product. */
  lifetime: (import.meta.env.VITE_PADDLE_PRICE_ID_LIFETIME as string | undefined) || '',
  /** One-time gift price (flag gift_plan). Empty until the owner creates the product. */
  gift: (import.meta.env.VITE_PADDLE_PRICE_ID_GIFT as string | undefined) || '',
} as const;
