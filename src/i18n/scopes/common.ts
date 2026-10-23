// Scope "common": words used all over the app. Add a key here only when two or more scopes need the same word;
// everything else belongs in the scope of the screen that shows it.
import { createScope } from '../scope';

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
} satisfies Record<string, string>;

export const { t, useT } = createScope('common', messages);
