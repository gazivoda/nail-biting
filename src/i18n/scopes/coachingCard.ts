// The words of the competing-response card shown after an alarm: part of scope "coaching" (spread into
// src/i18n/scopes/coaching.ts), kept in a file of its own because it is data only.
//
// Why a separate file: the card is rendered by the alarm overlay, which the home-page demo also loads, and
// scripts/coachingGuards.test.mjs keeps that chunk free of the storage module. createScope() reaches it (the
// locale state lives in storage), plain data does not. src/coaching/cardText.ts reads these English texts as
// the default, and the app (CoachingBridge) hands the card the real t() of the coaching scope.
export const cardMessages = {
  'card.tryInstead': 'Try this instead',
  'card.logged': 'Logged with this alarm',
  'card.done': 'Done',
  'card.close': 'Close',
  'card.skip': 'Skip',
  'card.announceRunning': '{text}. {seconds, plural, one {# second} other {# seconds}}. Press Done when you have finished, or Skip, or Escape, to dismiss.',
  'card.announceDone': 'Done. Saved with this alarm.',
} satisfies Record<string, string>;
