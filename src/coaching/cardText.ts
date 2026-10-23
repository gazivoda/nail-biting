// The words of the competing-response card (WS2, WS12a), for code that must stay light.
//
// CoachingCard and CoachingSeam are mounted by AlertOverlay, which the landing-page demo also renders, so they
// may import nothing that reaches the storage module (scripts/coachingGuards.test.mjs). The translation
// machinery does (the locale lives in storage). So they ask for their words here:
//
//  - by default these are the English texts, formatted with the pure message formatter;
//  - CoachingBridge (the signed-in app only, mounted while the flag is on) hands over the real t() of the
//    coaching scope, and from then on the words follow the language. In the demo, or with the flag off, the card
//    never shows anyway (the controller is not armed), so English is all it could ever need.
//
// Call cardText() while rendering, not at module level.

import { cardMessages } from '../i18n/scopes/coachingCard';
import { formatMessage, type Params } from '../i18n/message';
import type { CoachingSession } from './session';

export type CardTextKey = keyof typeof cardMessages;
export type CardText = (key: CardTextKey, params?: Params) => string;

const english: CardText = (key, params) => formatMessage(cardMessages[key], params, 'en');

let source: CardText = english;

/** The text of one message of the card, in the language the app handed over (English until then). */
export function cardText(key: CardTextKey, params?: Params): string {
  return source(key, params);
}

/** What a screen reader hears for the card in this phase ('' when there is no card). */
export function cardAnnouncement(s: CoachingSession): string {
  if (s.phase === 'running') return cardText('card.announceRunning', { text: s.text, seconds: s.durationSec });
  if (s.phase === 'finished') return cardText('card.announceDone');
  return '';
}

/** Hands the card its translator; `null` goes back to English. */
export function setCardText(fn: CardText | null): void {
  source = fn ?? english;
}
