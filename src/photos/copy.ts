// The photo diary's fixed wording, in one place so every screen says the same thing and a test
// can check it. Plain words; no health claims; no "100% private" style promises.
// Only what the code does is promised: the photo bytes are written to this browser's own storage
// and no code path in src/photos can send them anywhere (scripts/photoGuard.test.mjs).

export const GUIDE_TEXT = 'Place your hands flat in the frame, nails facing the camera';

export const PRIVACY_STATEMENT =
  'Photos stay on this device. They are saved in this browser only and are never uploaded, synced, exported or emailed.';

export const PRIVACY_DETAIL =
  'They are not part of Export, sync or the weekly email. Clearing site data, switching browser or closing a private window removes them.';

export const NOT_SAVED_WARNING =
  'This browser is not keeping photos on disk right now, so they will be gone when you close this tab.';

export const INTRO =
  'Once a week, take a photo of your hands. Over time you can put two photos side by side and see for yourself how your nails look now compared with before.';

export const NOT_MEDICAL = 'A photo diary is a way to look back, not a diagnosis or a treatment.';
