// Scope "alarm": The alarm itself: OS notification text, tab-title flash, the alert overlay. Kept tiny because useDetection (also loaded by the home-page demo) imports it.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/alarm.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  // The full-screen flash when the alarm fires (AlertOverlay).
  'overlay.title': 'Hands down',
  'overlay.hint': 'Press your thumb to each fingertip.',

  // Tab title and OS notification when the alarm fires (useDetection).
  'alert.tabTitle': '⚠️ Stop biting! – Stop Biting',
  'alert.notification.title': 'Stop biting!',
  'alert.notification.body': 'Nail biting detected — take your hands away.',

  // Competing responses (something to do with your hands instead of biting), shared by the post-alarm card and the check-in reminder.
  'suggestion.thumbs': 'Press thumb to each fingertip',
  'suggestion.fist': 'Clench and release fist · 5×',
  'suggestion.exhale': 'Exhale slowly through your nose',
  'suggestion.water': 'Sip water mindfully',

  // The periodic check-in notification (useNotifications): one whole sentence per suggestion, so no language has to lowercase or glue pieces.
  'reminder.title': 'Hands check',
  'reminder.body.thumbs': "Where are your hands? If they're near your face, try: press thumb to each fingertip.",
  'reminder.body.fist': "Where are your hands? If they're near your face, try: clench and release fist · 5×.",
  'reminder.body.exhale': "Where are your hands? If they're near your face, try: exhale slowly through your nose.",
  'reminder.body.water': "Where are your hands? If they're near your face, try: sip water mindfully.",

  // "Not a bite" after an alarm (NotABiteSeam: the toast in the app and the button in the mini window). It lives here because AlertOverlay mounts it.
  'notABite.announce.offered': 'Alarm. If it was a false alarm, press Not a bite.',
  'notABite.announce.marked': 'Marked as not a bite. It is not counted. Press Undo to take it back.',
  'notABite.toast.alarm': 'Alarm.',
  'notABite.toast.question': 'Only resting your hand?',
  'notABite.toast.marked': 'Marked as not a bite. It is not counted.',
  'notABite.toast.calibrateOffer': 'Want to teach it how you rest your chin? It takes a minute.',
  'notABite.calibrate': 'Calibrate',
  'notABite.button': 'Not a bite',
  'notABite.undo': 'Undo',
  'notABite.close': 'Close',
} satisfies Record<string, string>;

export const { t, useT } = createScope('alarm', messages);
