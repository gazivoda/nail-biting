// The photo diary's fixed wording. The screens read it from the `photos` i18n scope with t(), so every
// language says the same thing; the constants below are the ENGLISH source of those messages, kept for the
// tests that pin the wording (src/photos/photoViews.test.tsx, scripts/photoGuard.test.mjs). Plain words;
// no health claims; no "100% private" style promises.
// Only what the code does is promised: the photo bytes are written to this browser's own storage
// and no code path in src/photos can send them anywhere (scripts/photoGuard.test.mjs).

import { messages } from '../i18n/scopes/photos';

// The framing guide sentence is pinned here by scripts/photoGuard.test.mjs; screens render t('capture.guide'), and
// src/i18n/coverage/photos.coverage.test.tsx checks the two are the same English.
export const GUIDE_TEXT = 'Place your hands flat in the frame, nails facing the camera'; // i18n-ignore: English source pinned by photoGuard

export const PRIVACY_STATEMENT = messages['diary.privacy.statement'];

export const PRIVACY_DETAIL = messages['diary.privacy.detail'];

export const NOT_SAVED_WARNING = messages['diary.notSaved'];

export const INTRO = messages['diary.intro'];

export const NOT_MEDICAL = messages['diary.notMedical'];
