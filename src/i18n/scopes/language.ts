// Scope "language": the language picker card in Settings. The language names themselves (English, Español,
// Deutsch, Português) are never translated: they live in core.ts (LOCALE_INFO).
import { createScope } from '../scope';

export const messages = {
  'title': 'Language',
  'groupLabel': 'App language',
  'intro': 'Choose the language of the app screens. The website, the blog and emails stay in English.',
  'draftNote': 'This translation is a machine draft and has not been checked by a native speaker yet. Some wording may be off.',
  'loadFailed': 'Could not load that language. Check your connection and try again.',
  'loading': 'Loading…',
} satisfies Record<string, string>;

export const { t, useT } = createScope('language', messages);
