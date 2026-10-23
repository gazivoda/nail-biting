// Scope "background": Background watching: pause card, meeting mode, schedule settings, reminders, cadence note, mini-window text.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/background.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('background', messages);
