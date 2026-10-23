// Scope "coaching": The 4-week program UI chrome, urge timer, coaching card and coaching settings (NOT the lesson texts in src/data).
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/coaching.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('coaching', messages);
