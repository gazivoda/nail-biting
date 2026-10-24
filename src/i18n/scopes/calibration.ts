// Scope "calibration": The calibration walk-through.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/calibration.ts (the compiler lists what is missing).
//
// "Cancel", "Close", "Save" and "Try again" come from the common scope.
import { createScope } from '../scope';

export const messages = {
  // The heading of each step.
  'title.rest': 'Step 1 of 2',
  'title.real': 'Step 2 of 2',
  'title.between': 'Step 2 of 2 next',
  'title.default': 'Calibrate',

  // The person's own camera picture and what it says about it.
  'camera.aria': 'Your camera',
  'link.starting': 'Starting the camera…',
  'link.failed': 'The camera could not start.',
  'link.models': "Detection couldn't load. Check your connection and try again.",
  'link.paused': 'The camera is on. Detection is paused while you calibrate.',
  'seen.both': 'The camera sees your face and your hand.',
  'seen.faceOnly': 'The camera sees your face. It does not see your hand yet.',
  'seen.none': 'The camera does not see your face. Sit so your face is in the picture.',

  // Before it starts.
  'intro.lead': 'This is optional and takes about a minute. It helps the app tell resting your chin from the real thing. You will do two short things while the camera looks at you.',
  'instruction.rest': 'Rest your chin on your hand as you normally would.',
  'instruction.real': 'Bring a fingertip near your lips.',
  'intro.privacy': 'Nothing is recorded. Only a few numbers about where your hand was are kept, on this device: no picture. They are not part of your history, are not synced and are not uploaded. You can delete them in Settings, under Detection. Watching is paused while you do this.',
  'start': 'Start',
  'notNow': 'Not now',

  // During the steps. English prints "1 seconds" today; both plural cases say "seconds" so the English stays as it is,
  // and a language with a singular can say it right.
  'hold': 'Hold it there. {left, plural, one {# seconds left} other {# seconds left}}.',
  'progress': '{count} of {needed} needed.',
  'between.lead': 'Take your hand away.',
  'between.next': 'Step 2 starts in {left, plural, one {# seconds} other {# seconds}}: you will bring a fingertip near your lips.',

  // What a screen reader says once when a step starts (the view keeps it in one live region; no clock, no counts).
  'announce.rest': 'Step 1 of 2. Rest your chin on your hand as you normally would. Hold it there.',
  'announce.between': 'Take your hand away. Step 2 starts in a few seconds.',
  'announce.real': 'Step 2 of 2. Bring a fingertip near your lips. Hold it there.',
  'announce.done': 'Done. You can save the result or try again.',
  'announce.failed': 'That did not work. You can try again.',

  // The result.
  'result.done': 'Done.',
  'result.summary': 'The app saw {rest} frames of you resting your chin and {real} with a fingertip near your lips. Saving keeps a few numbers from them, on this device, and the chin-rest rule will use them.',
  'result.failed': 'That did not work.',
  'failure.noRest': 'The camera did not see your hand resting on your chin for long enough. Try again with your hand in view.',
  'failure.noReal': 'The camera did not see a fingertip near your lips for long enough. Try again with your hand in view.',
  'failure.noEither': 'The camera did not see your hand. Check that your face and hand are in the picture and try again.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('calibration', messages);
