// Scope "billing": Paywall, trial banners, plan labels, free-tier notice, lifetime plate, referral card, redeem page.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/billing.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('billing', messages);
