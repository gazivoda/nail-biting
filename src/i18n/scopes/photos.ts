// Scope "photos": The local nail photo diary.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/photos.ts (the compiler lists what is missing).
//
// The diary promises one thing: photos stay on this device. The wording in 'diary.privacy.*' says exactly what the
// code does (written to this browser's own storage, never uploaded, synced, exported or emailed) and nothing more.
// Translations must keep that exact promise: no "100% private", no "nothing leaves your device".
import { createScope } from '../scope';

export const messages = {
  // ── The diary screen ────────────────────────────────────────────────────────
  'diary.title': 'Photo diary',
  'diary.intro': 'Once a week, take a photo of your hands. Over time you can put two photos side by side and see for yourself how your nails look now compared with before.',
  'diary.privacy.statement': 'Photos stay on this device. They are saved in this browser only and are never uploaded, synced, exported or emailed.',
  'diary.privacy.detail': 'They are not part of Export, sync or the weekly email. Clearing site data, switching browser or closing a private window removes them.',
  'diary.notSaved': 'This browser is not keeping photos on disk right now, so they will be gone when you close this tab.',
  'diary.notMedical': 'A photo diary is a way to look back, not a diagnosis or a treatment.',
  'diary.takeFirst': 'Take your first photo',
  'diary.takeThisWeek': "Take this week's photo",
  'diary.due': 'Your last photo was {age}. A new one is due.',
  'diary.cannotDecode': 'This browser cannot show saved photos. Update it, or open the diary in a recent Chrome, Edge, Firefox or Safari.',
  'diary.loading': 'Reading your photos from this device',
  'diary.count': 'Your photos ({count})',
  'diary.size': '{size} on this device',
  'diary.photoLabel': 'Photo from {date}',
  'diary.keep': 'Keep',
  'diary.deleteOne.aria': 'Delete the photo from {date}',
  'diary.deleteOne.question': 'Delete this photo?',
  'diary.compareHeading': 'Before and after',
  'diary.deleteNote': 'Deleting removes a photo from this browser for good.',
  'diary.deleteAll': 'Delete all photos',
  // English has no singular here today ("Delete all 1 photos?"), so both forms read the same; other languages get a natural one.
  'diary.deleteAll.question': '{count, plural, one {Delete all # photos?} other {Delete all # photos?}}',
  'diary.deleteAll.confirm': 'Delete all',
  'diary.deleteAll.keep': 'Keep my photos',

  // What the screen announces after an action.
  'status.saved': 'Photo saved on this device.',
  'status.savedTabOnly': 'Photo kept for this tab only. This browser is not saving it to disk.',
  'status.deleted': 'Photo deleted.',
  'status.deletedAll': 'All {count} photos deleted.',

  // ── Before / after ──────────────────────────────────────────────────────────
  'compare.needTwo': "You need two photos to compare. Take another one next week and this is where you can lay it over today's.",
  'compare.before': 'Before',
  'compare.after': 'After',
  'compare.same': 'Both sides show the same photo. Pick two different dates to see a difference.',
  'compare.photoBefore': 'Photo from {date} (before)',
  'compare.photoAfter': 'Photo from {date} (after)',
  'compare.badgeBefore': 'Before, {date}',
  'compare.badgeAfter': 'After, {date}',
  'compare.sliderLabel': 'Reveal the earlier photo',
  'compare.sliderValue': 'The earlier photo is shown across {percent} percent of the picture',
  'compare.hint': 'Drag the picture or the slider to move between the two.',

  // ── Taking a photo ──────────────────────────────────────────────────────────
  'capture.title': 'Take a photo of your hands',
  'capture.idle': 'The camera opens only while this screen is open, and turns off as soon as the photo is taken.',
  'capture.start': 'Start the camera',
  'capture.opening': 'Opening the camera. Your browser may ask you to allow it.',
  'capture.photoLabel': 'The photo you just took',
  'capture.reviewNote': 'The camera is off. Save this photo to your diary on this device, or take it again.',
  'capture.saving': 'Saving',
  'capture.save': 'Save photo',
  'capture.retake': 'Retake',
  'capture.discard': 'Discard',
  'capture.saved': 'Saved to your diary.',
  'capture.stopWatching': 'Stop watching and try again',
  'capture.previewLabel': 'Live camera preview',
  // The framing guide sentence. Neutral on purpose: it describes where the hands go and nothing else.
  // scripts/photoGuard.test.mjs pins the English in src/photos/copy.ts; src/i18n/coverage/photos.coverage.test.tsx checks the two match.
  'capture.guide': 'Place your hands flat in the frame, nails facing the camera',
  'capture.mirrorNote': 'Keep your face out of the picture. The preview is a mirror, and the photo is saved the way you see it.',
  'capture.countdown': 'Taking the photo in {n}',
  'capture.waiting': 'Waiting for the camera picture',
  'capture.cancelTimer': 'Cancel the timer',
  'capture.takeIn': 'Take photo in {seconds} seconds',
  'capture.takeNow': 'Take it now',
  'capture.notReady': 'The camera has not shown a picture yet. Wait for the preview to appear, then try again.',
  'capture.saveFailed': 'The photo could not be saved. Try again.',
  'capture.hiddenNotice': 'The camera was turned off because you left this page. Start it again when you are ready.',

  // ── Why the camera did not open ─────────────────────────────────────────────
  'problem.blocked.title': 'The camera is blocked',
  'problem.blocked.detail': 'Your browser did not allow camera access. Allow it for this site in the address bar or in your browser settings, then try again.',
  'problem.noCamera.title': 'No camera found',
  'problem.noCamera.detail': 'Connect a webcam, or check that it is switched on and not blocked by a privacy switch, then try again.',
  'problem.watching.title': 'Watching is using the camera',
  'problem.watching.detail': 'Your camera would not open a second time while watching is on. Stop watching, take the photo, then start watching again from the Watch tab.',
  'problem.busy.title': 'The camera is busy',
  'problem.busy.detail': 'Another app or browser tab is using the camera. Close it, then try again.',
  'problem.insecure.title': 'The camera needs a secure page',
  'problem.insecure.detail': 'Cameras only work on https pages (or localhost). Open Stop Biting at its https address and try again.',
  'problem.unknown.title': 'The camera did not start',
  'problem.unknown.detail': 'Something went wrong while opening the camera. Try again, or reload the page.',
  'problem.frame.title': 'The photo could not be taken',

  // ── Storage limits ──────────────────────────────────────────────────────────
  'store.full': 'The diary holds {max} photos. Delete some older ones to add more.',
  'store.writeFailed': 'This browser would not save the photo. Free up space or try again.',

  // ── The weekly reminder strip (inside the app only) ─────────────────────────
  'reminder.aria': 'Photo diary reminder',
  'reminder.text': "<b>Time for this week's hand photo.</b> Your last one was {age}.",
  'reminder.open': 'Open the photo diary',
  'reminder.snooze': 'Not now',

  // ── Settings > Data > Photo diary ───────────────────────────────────────────
  'settings.saved': '{count, plural, =0 {No photos saved.} one {# photo saved, {size} in this browser.} other {# photos saved, {size} in this browser.}}',
  'settings.deleteQuestion': 'Delete all {count, plural, one {# photo} other {# photos}} from this browser?',
  'settings.note': 'Clearing your history, or "Delete everything" in this section, does not remove photos. Use this button for them.',
  'settings.allDeleted': 'All photos deleted.',

  // ── Small helpers ───────────────────────────────────────────────────────────
  // How long ago a photo was taken. "{count}" is written as is (no thousands separator), as the app always has.
  'age.ago': '{count, plural, =0 {today} one {{count} day ago} other {{count} days ago}}',
} satisfies Record<string, string>;

export const { t, useT } = createScope('photos', messages);
