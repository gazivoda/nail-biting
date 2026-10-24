// Scope "watch": The Watch tab: dashboard, camera panel, detection status and camera errors, behavior labels, not-a-bite controls, false-positive settings card.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/watch.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  // Dashboard heading (the name is the one marked word) and the trial line under it.
  'dashboard.greeting.morning': 'Good morning, <name>{name}</name>.',
  'dashboard.greeting.afternoon': 'Good afternoon, <name>{name}</name>.',
  'dashboard.greeting.evening': 'Good evening, <name>{name}</name>.',
  'dashboard.nameFallback': 'there',
  'dashboard.trial': 'Free trial: {text}.',
  'dashboard.choosePlan': 'Choose a plan',

  // The card that starts and stops detection (CameraToggle).
  'toggle.off.title': 'Start the alarm',
  'toggle.off.body': 'Your browser will ask to use the camera. Keep this tab open while you work; the alarm sounds when a hand reaches your mouth.',
  'toggle.off.start': 'Start detection',
  'toggle.off.privacy': 'No camera data is sent while it runs',
  'toggle.on.title': 'Detection active',
  'toggle.on.problemHint': 'See below for how to fix it',
  'toggle.on.hint': 'Runs on this device',
  'toggle.on.stop': 'Stop',
  'toggle.showFeed': 'Show camera feed',

  // Titles the camera card shows when detection is on but nothing is watching (CameraPanel).
  'panel.cameraNotRunning': 'Camera not running',
  'panel.detectionNotRunning': 'Detection not running',

  // What to tell someone whose camera or models did not start (cameraErrorCopy).
  'camera.error.permissionDenied': "Camera access was blocked. Allow it from the camera icon in your browser's address bar, then try again.",
  'camera.error.noCamera': 'No camera found. The detector needs a webcam to watch for your hands.',
  'camera.error.insecureContext': 'The camera needs a secure (HTTPS) connection. Open this page over https:// and try again.',
  'camera.error.unavailable': "Your camera couldn't start: it may be in use by another app. Close anything else using it and try again.",
  'camera.error.model': "Detection couldn't load. Check your connection and try again.",

  // The badge on the camera frame (DetectionStatus).
  'status.idle': 'Detection off',
  'status.loading': 'Loading detection…',
  'status.watching': 'Watching',
  'status.alert': 'Hands near mouth',
  'status.error': "Detection couldn't load",

  // The mini-window button over the camera frame (CameraView).
  'view.pip.exitTitle': 'Exit Picture-in-Picture',
  'view.pip.floatTitle': 'Float to a mini window. Detection keeps running when you switch apps',
  'view.pip.exit': 'Exit PiP',
  'view.pip.minimize': 'Minimize',

  // The label under the wave (DetectionWave).
  'wave.watching': 'Watching…',
  'wave.detected': 'Detected!',
  'wave.loading': 'Loading models…',
  'wave.error': 'Model error',
  'wave.waiting': 'Waiting…',

  // The mini window strip (PiPWindow).
  'mini.status.idle': 'Waiting',
  'mini.status.loading': 'Starting',
  'mini.status.watching': 'Watching',
  'mini.status.alert': 'Nail biting detected',
  'mini.status.error': 'Not running',
  'mini.status.stopped': 'Stopped',
  'mini.resumeTitle': 'Resume watching',
  'mini.pauseTitle': 'Pause for 15 minutes',
  'mini.resume': 'Resume',
  'mini.pause': 'Pause',
  'mini.stop': 'Stop',
  'mini.start': 'Start',

  // Session timer (SessionGoal).
  'session.title': 'Session',
  'session.goal': '/ {minutes}m goal',
  'session.reached': 'Goal reached!',
  'session.paused': 'Paused. Start detection to carry on.',

  // The streak card (StreakHero).
  'streak.title': 'Current streak',
  'streak.onARoll': 'On a roll',
  'streak.unit.days': 'days',
  'streak.unit.hours': 'hrs',
  'streak.unit.minutes': 'min',
  'streak.since.today': 'Since your last bite, today at {time}.',
  'streak.since.yesterday': 'Since your last bite, yesterday at {time}.',
  'streak.since.date': 'Since your last bite, {date} at {time}.',
  'streak.since.start': "Since you started. A bite resets it; an alarm doesn't.",
  'streak.best': 'Best: <b>{value}</b>',
  'streak.bestNone': 'none yet',

  // Today's counters (TodayStats).
  'today.title': 'Today',
  'today.alarms': 'alarms to review',
  'today.bites': 'bites',

  // "I just bit my nails" (PanicButton).
  'panic.button': 'I just bit my nails',
  'panic.question': 'What triggered it?',
  'panic.logged': 'Logged: {label}. Your streak starts again from now.',

  // The card after an alarm (ReplacementPrompt).
  'followUp.title': 'Alarm: try this instead',
  'followUp.closeLabel': 'Close. The alarm stays in History to review',
  'followUp.question': 'If it was a bite, what set it off?',
  'followUp.notABite': 'Not a bite, just my hand nearby',
  'followUp.unknownTag': 'Bite, not sure why',

  // The false-alarm rate line (falsePositive/stats).
  'rate.alone': '{marked} of {alarms} {alarms, plural, one {alarm} other {alarms}} in the last 7 days marked not a bite ({percent}%).',
  'rate.down': '{marked} of {alarms} {alarms, plural, one {alarm} other {alarms}} in the last 7 days marked not a bite ({percent}%), down from {beforeMarked} of {beforeAlarms} ({beforePercent}%) the 7 days before.',
  'rate.up': '{marked} of {alarms} {alarms, plural, one {alarm} other {alarms}} in the last 7 days marked not a bite ({percent}%), up from {beforeMarked} of {beforeAlarms} ({beforePercent}%) the 7 days before.',
  'rate.same': '{marked} of {alarms} {alarms, plural, one {alarm} other {alarms}} in the last 7 days marked not a bite ({percent}%), about the same as {beforeMarked} of {beforeAlarms} ({beforePercent}%) the 7 days before.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('watch', messages);
