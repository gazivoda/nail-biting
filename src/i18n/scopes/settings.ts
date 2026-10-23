// Scope "settings": The Settings page cards and the section files (detection, behaviors, alerts, appearance, privacy, bite reasons).
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/settings.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
} satisfies Record<string, string>;

export const { t, useT } = createScope('settings', messages);
