// Scope "coaching": The 4-week program UI chrome, urge timer, coaching card and coaching settings (NOT the lesson texts in src/data).
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/coaching.ts (the compiler lists what is missing).
//
// The 28 lessons themselves (src/data/hrtProgram.json) are intentionally English: they are marked NEEDS HUMAN
// REVIEW and are not translated (WS12 scope decision). Everything around them is translated.
import { createScope } from '../scope';
import { cardMessages } from './coachingCard';

export const messages = {
  // The card after an alarm (data in ./coachingCard so the demo-safe seam can read it without the locale state)
  ...cardMessages,

  // A length in seconds, used by several screens
  'duration.seconds': '{count, plural, one {# second} other {# seconds}}',

  // Stats line (Program page and the Alerts card)
  'stats.line': '<b>{completed} of {alarms}</b> {alarms, plural, one {alarm was} other {alarms were}} followed by a finished competing response ({rate}).',
  'stats.note': 'Counted from your first prompt. Alarms that did not get a prompt count as not followed.',

  // "I feel an urge" button and its breathing timer
  'urge.start': 'I feel an urge',
  'urge.sheetTitle': 'Breathe it out',
  'urge.sheetBody': 'Follow the breathing for a minute or so, and keep your hands busy with something else. This logs an urge, not a bite, so your streak is not affected.',
  'urge.lengthLabel': 'Length of the timer',
  'urge.begin': 'Start',
  'urge.breatheIn': 'Breathe in',
  'urge.breatheOut': 'Breathe out',
  'urge.secondsLeft': '{count, plural, one {# second left} other {# seconds left}}',
  'urge.stop': 'Stop',
  'urge.announceStarted': 'Breathing timer started, {count, plural, one {# second} other {# seconds}}. Press Stop, or Escape, to end it.',
  'urge.logged': 'Logged as an urge. Your streak is not affected.',
  'urge.loggedDone': 'Timer finished. Logged as an urge. Your streak is not affected.',

  // The suggestions a person can pick for the prompt after an alarm (the ids are what gets stored)
  'preset.fists': 'Clench your fists',
  'preset.palms': 'Palms flat on the desk',
  'preset.thumbs': 'Press thumb to each fingertip',
  'preset.press': 'Press your hands together',
  'preset.hold': 'Hold something in both hands',

  // Settings > Alerts
  'settings.title': 'Alerts',
  'settings.prompt.label': 'Competing-response prompt',
  'settings.prompt.description': 'After an alarm, a short timer suggests something to do with your hands instead. It never replaces or delays the alarm, and you can skip it.',
  'settings.prompt.aria': 'When to show the prompt',
  'settings.mode.off': 'Off',
  'settings.mode.hourly': 'Once an hour',
  'settings.mode.every': 'Every alarm',
  'settings.mode.offHelp': 'No prompt. Alarms work exactly as before.',
  'settings.mode.hourlyHelp': 'The first alarm in any hour gets a prompt. The ones after it do not, until an hour has passed.',
  'settings.mode.everyHelp': 'Every alarm gets a prompt. Alarms that come within 30 seconds of each other count as one.',
  'settings.length.label': 'Length',
  'settings.length.description': 'How long the timer runs, from {min} to {max} seconds.',
  'settings.length.aria': 'Length of the prompt in seconds',
  'settings.length.short': '{seconds} s',
  'settings.what.legend': 'What to do',
  'settings.what.hint': 'Pick one, or write your own.',
  'settings.remove': 'Remove',
  'settings.removeAria': 'Remove “{text}”',
  'settings.write.label': 'Write your own competing response',
  'settings.write.full': 'The list is full. Remove one to add another.',
  'settings.write.placeholder': 'Write your own, for example “Squeeze a stress ball”',
  'settings.add': 'Add',
  'settings.openProgram': 'Open the 4-week program',

  // The 4-week program page (the lesson texts are not in here)
  'program.back': 'Back to the app',
  'program.start': 'Start the program',
  'program.startNote': 'The first lesson opens straight away.',
  'program.progress': '{done} of {total} lessons done',
  'program.finished': 'You have finished all {total} lessons.',
  'program.allLessons': 'All lessons',
  'program.weekHeading': 'Week {week}: {title}',
  'program.day': 'Day {day}',
  'program.notOpen': 'Not open yet',
  'program.confirmReset': 'Start again from lesson 1? Your progress here will be cleared. Nothing else is touched.',
  'program.confirmYes': 'Yes, start again',
  'program.reset': 'Start the program again',
  'program.lessonMeta': 'Day {day} of {total}, {week}',
  'program.tryToday': 'Try today',
  'program.markDone': 'Mark as done',
  'program.doneLast': 'Done. That was the last lesson.',
  'program.doneToday': 'Done. The next lesson opens tomorrow.',
  'program.doneBare': 'Done.',

  // The quiet link on the Watch tab
  'program.entry': '4-week program',
  'program.entryFinished': '4-week program, finished',
  'program.entryProgress': '4-week program, {done} of {total} lessons done',
} satisfies Record<string, string>;

export const { t, useT } = createScope('coaching', messages);
