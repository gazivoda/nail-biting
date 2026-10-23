// Scope "alarm": The alarm itself: OS notification text, tab-title flash, the alert overlay. Kept tiny because useDetection (also loaded by the home-page demo) imports it.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/alarm.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('alarm', messages);
