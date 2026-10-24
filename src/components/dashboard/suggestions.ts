import { t, type messages } from '../../i18n/scopes/alarm';

// Competing responses: something to do with your hands instead of biting.
// Shared by the post-alarm card and the check-in reminder so both coach with
// the same words.
//
// Read at the moment they are shown, in the language showing then (src/i18n):
// never keep the result in a module-level constant. This file uses the small
// `alarm` scope, not `watch`, because the reminder hook is part of the main bundle.
type Key = keyof typeof messages;
const SUGGESTION_KEYS = ['suggestion.thumbs', 'suggestion.fist', 'suggestion.exhale', 'suggestion.water'] as const satisfies readonly Key[];
// The same four as a whole reminder sentence each, so no language has to lowercase or glue a fragment.
const REMINDER_KEYS = ['reminder.body.thumbs', 'reminder.body.fist', 'reminder.body.exhale', 'reminder.body.water'] as const satisfies readonly Key[];

export const SUGGESTION_COUNT = SUGGESTION_KEYS.length;

/** The n-th suggestion (wraps around), e.g. "Sip water mindfully". */
export function suggestion(n: number): string {
  return t(SUGGESTION_KEYS[n % SUGGESTION_KEYS.length]);
}

/** The body of the "Hands check" notification for the n-th suggestion (wraps around). */
export function reminderBody(n: number): string {
  return t(REMINDER_KEYS[n % REMINDER_KEYS.length]);
}
