// Scope "shell": The frame around the app: tab bar, headers, install prompt and guide, onboarding tour, desktop camera notice, app loading.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/shell.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('shell', messages);
