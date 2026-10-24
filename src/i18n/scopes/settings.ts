// Scope "settings": The Settings page cards and the section files (detection, behaviors, alerts, appearance, privacy, bite reasons).
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/settings.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  'page.title': 'Settings',

  // Plan card
  'plan.title': 'Plan',
  'plan.status.trial': 'Free trial',
  'plan.status.active': 'Active',
  'plan.status.paused': 'Paused',
  'plan.status.cancelled': 'Cancelled',
  'plan.status.expired': 'Expired',
  'plan.trialEnded': 'Trial ended',
  'plan.yearly': 'Yearly',
  'plan.monthly': 'Monthly',
  'plan.detail.trial': 'In your free trial, ends {date}',
  'plan.detail.trialEnded': 'Your free trial has ended',
  'plan.detail.renews': 'Renews {date}',
  'plan.detail.accessUntil': 'Access until {date}',
  'plan.choose': 'Choose a plan',
  'plan.manage': 'Manage subscription',
  'plan.opening': 'Opening…',

  // Detection and alarm card
  'detection.title': 'Detection and alarm',
  'sensitivity.label': 'Sensitivity',
  'sensitivity.description': 'How close your hand must get before the alarm sounds',
  'sensitivity.low': 'Low',
  'sensitivity.medium': 'Med',
  'sensitivity.high': 'High',
  'alarmType.label': 'Alarm type',
  'alarmType.sound': 'Sound',
  'alarmType.flash': 'Flash',
  'alarmType.both': 'Both',

  // Periodic reminders card
  'reminders.title': 'Periodic reminders',
  'reminders.enable': 'Enable reminders',
  'reminders.enable.description': 'A check-in on your hands while detection is off',
  'reminders.blocked': "Notifications are blocked. Allow them in your browser's site settings, then turn this on again.",
  'reminders.interval': 'Interval',
  'reminders.interval.aria': 'Reminder interval',
  'reminders.interval.option': '{minutes}m',

  // Alarm sound card
  'sound.title': 'Alarm sound',
  'sound.intro': 'The sound the alarm makes when your hand reaches your mouth. Press Preview to hear each one.',
  'sound.alarm.label': 'Beeps',
  'sound.alarm.description': 'Rapid alternating beeps',
  'sound.chime.label': 'Chime',
  'sound.chime.description': 'Soft decaying bell',
  'sound.buzz.label': 'Buzz',
  'sound.buzz.description': 'Low harsh rumble',
  'sound.chirp.label': 'Chirp',
  'sound.chirp.description': 'Ascending sweep tone',
  'sound.whistle.label': 'Whistle',
  'sound.whistle.description': 'Descending pure tone',
  'sound.preview': 'Preview',
  'sound.playing': 'Playing',
  'sound.previewAria': 'Preview {name}',
  'volume.label': 'Volume',
  'volume.description': 'How loud the alarm plays',
  'volume.aria': 'Alarm volume',

  // Bite reasons card
  'reasons.title': 'Bite reasons',
  'reasons.intro': 'Add your own reasons to choose from when logging a bite, alongside the built-in options (stress, focus, boredom, not sure).',
  'reasons.removeAria': 'Remove {label}',
  'reasons.removed': 'Removed “{label}”.',
  'reasons.emojiAria': 'Emoji',
  'reasons.labelAria': 'Reason label',
  'reasons.labelPlaceholder': 'e.g. Tiredness',
  'reasons.add': 'Add',

  // Appearance card
  'appearance.title': 'Appearance',
  'theme.label': 'Theme',
  'theme.description': 'Light, dark, or follow your system',
  'theme.light': 'Light',
  'theme.system': 'System',
  'theme.dark': 'Dark',

  // Privacy card
  'privacy.title': 'Privacy',
  'privacy.heading': 'Detection runs on your computer',
  'privacy.body': 'Your camera is processed in this browser. No camera data is sent while it runs; your alarm and bite log stays in this browser too.',
  // The sync-on wording, for languages other than English (English shows 'privacy.body' rewritten by shared/flagCopy.js).
  'privacy.bodySync': 'Your camera is processed in this browser. No camera data is sent while it runs. Your alarm and bite log stays in this browser too, unless you turn on sync.',

  // Data card
  'data.title': 'Data',
  'data.clearWarning': "This erases your history, streak, bite reasons and every setting on this device. It can't be undone.",
  'data.clearConfirm': 'Yes, clear everything',
  'data.clearAll': 'Clear all data',

  // Behaviors card (flag detection_behaviors)
  'behaviors.title': 'Behaviors',
  'behaviors.intro': 'Choose what the camera watches for. Each alarm is logged under the behavior that set it off.',
  'behaviors.atLeastOne': 'At least one stays on.',
  'behaviors.experimental.title': 'Experimental',
  'behaviors.experimental.note': 'These have not been tried on real footage yet. Expect false alarms and missed ones.',
  'behaviors.watchFor.nail_biting': 'Watch for nail biting',
  'behaviors.watchFor.cuticle_skin_biting': 'Watch for cuticle and skin biting',
  'behaviors.watchFor.nose_picking': 'Watch for nose picking',
  'behaviors.watchFor.eye_area_pulling': 'Watch for eyelash and eyebrow pulling',
  'behaviors.watchFor.face_skin_picking': 'Watch for face skin picking',
  'behaviors.watchFor.hair_pulling': 'Watch for hair pulling',

  // Detection card of the false-alarm controls (flag false_positive_controls)
  'falsePositive.title': 'Detection',
  'falsePositive.intro': 'Fewer false alarms. These controls only ever make the alarm quieter in the cases below: they never add one. Tap “Not a bite” on an alarm and the app learns from it.',
  'falsePositive.hand.label': 'Which hand',
  'falsePositive.hand.description': 'Watch both hands, only your left, or only your right. Left and right are your hands as you see them in the camera preview.',
  'falsePositive.hand.aria': 'Which hand to watch',
  'falsePositive.hand.both': 'Both',
  'falsePositive.hand.left': 'Left',
  'falsePositive.hand.right': 'Right',
  'falsePositive.chin.label': 'Chin rest',
  'falsePositive.chin.description': 'Stay quiet when the back of your hand or your palm rests on your chin and no fingertip is near your lips.',
  'falsePositive.chin.toggle': 'Stay quiet when my hand rests on my chin',
  'falsePositive.learned.label': 'Learned from “Not a bite”',
  'falsePositive.learned.none': 'Nothing yet. Each time you mark an alarm “Not a bite”, the app remembers a few numbers about where your hand was.',
  'falsePositive.learned.some': '{count, plural, one {{count} pose remembered.} other {{count} poses remembered.}} When your hand is in a pose like ones you rejected, the alarm waits a little longer, and after two it wants a fingertip right at your lips.',
  'falsePositive.learned.confirm': 'Yes, forget them',
  'falsePositive.learned.forget': 'Forget what it learned',
  'falsePositive.calibrate.label': 'Calibrate',
  'falsePositive.calibrate.done': 'Calibrated on {date}. The chin-rest rule uses how you rest your chin and where your fingertip sits.',
  'falsePositive.calibrate.none': 'Optional, about a minute: rest your chin on your hand, then bring a fingertip near your lips, and the app tunes itself to you.',
  'falsePositive.calibrate.again': 'Calibrate again',
  'falsePositive.calibrate.delete': 'Delete calibration',
  'falsePositive.footer': 'What is remembered is a handful of numbers per pose, for example how far a fingertip was from your lips. No picture, no video. They are kept on this device only: they are not part of your history, are not synced and are not uploaded.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('settings', messages);
