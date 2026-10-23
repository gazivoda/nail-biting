// Scope "common": words used all over the app. Add a key here only when two or more scopes need the same word;
// everything else belongs in the scope of the screen that shows it.
import { createScope } from '../scope.ts';

export const messages = {
  'cancel': 'Cancel',
  'close': 'Close',
  'back': 'Back',
  'save': 'Save',
  'delete': 'Delete',
  'undo': 'Undo',
  'done': 'Done',
  'continue': 'Continue',
  'loading': 'Loading…',
  'tryAgain': 'Try again',

  // Trigger tags (the reasons a person picks). The stored ids stay English; only the label is translated.

  // Behaviors the app can watch for: label (settings list), short (History filter), description.
} satisfies Record<string, string>;

export const { t, useT } = createScope('common', messages);
