// Scope "watch": The Watch tab: dashboard, camera panel, detection status and camera errors, behavior labels, not-a-bite controls, false-positive settings card.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/watch.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('watch', messages);
