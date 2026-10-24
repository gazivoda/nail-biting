// Scope "background": Background watching: pause card, meeting mode, schedule settings, reminders, cadence note, mini-window text.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/background.ts (the compiler lists what is missing).
//
// Note: cadence.ts and pauseMachine.ts (the 'end.*', 'day.*' and 'cadence.*' keys) are loaded by useDetection, which the
// home-page demo also loads, so this whole scope reaches the demo chunk. If that weight matters, those few keys are the
// ones to move into the tiny "alarm" scope.
import { createScope } from '../scope';

export const messages = {
  // Weekdays, 0 = Sunday. Short: buttons and summaries. Long: what a screen reader says.
  'day.0.short': 'Sun',
  'day.1.short': 'Mon',
  'day.2.short': 'Tue',
  'day.3.short': 'Wed',
  'day.4.short': 'Thu',
  'day.5.short': 'Fri',
  'day.6.short': 'Sat',
  'day.0.long': 'Sunday',
  'day.1.long': 'Monday',
  'day.2.long': 'Tuesday',
  'day.3.long': 'Wednesday',
  'day.4.long': 'Thursday',
  'day.5.long': 'Friday',
  'day.6.long': 'Saturday',

  // When a pause or meeting ends (pauseMachine.describeEnd): "tomorrow 6:00 AM", "Sat 6:00 AM".
  'end.tomorrow': 'tomorrow {time}',
  'end.weekday': '{day} {time}',

  // The note about a browser that slowed this tab down in the background (cadence.cadenceNote).
  'cadence.slow.once': 'While this tab was in the background, checks ran about once a second instead of {full}.',
  'cadence.slow.some': 'While this tab was in the background, checks ran about {n} a second instead of {full}.',
  'cadence.advice.float': 'The Minimize button floats a small window that keeps the full speed.',
  'cadence.advice.window': 'Keeping Stop Biting in its own window, in view, keeps the full speed.',

  // The words for a pause or a meeting (watchText.watchNote). {end} is "3:45 PM", "tomorrow 6:00 AM" ...
  'watch.paused.title': 'Paused until {end}',
  'watch.paused.detail.released': 'The camera is off and nothing is being checked. Watching starts again by itself.',
  'watch.paused.detail.kept': 'Nothing is being checked. Watching starts again by itself. The camera stays on in this browser so it can.',
  'watch.paused.status': 'Paused',
  'watch.paused.until': 'until {end}',
  'watch.paused.hint.released': 'Camera off. Starts again by itself',
  'watch.paused.hint.kept': 'Nothing is checked. Starts again by itself',
  'watch.meeting.title': 'Meeting mode until {end}',
  'watch.meeting.detail': 'Still watching, silently: the screen flashes, there is no sound or notification, and alarms are still logged.',
  'watch.meeting.short': 'Watching, silent',
  'watch.meeting.status': 'Watching',
  'watch.meeting.until': 'silent until {end}',

  // The pause card on the Watch tab.
  'slot.aria': 'Pause and meeting mode',
  'slot.heading': 'Pause',
  'slot.resume': 'Resume now',
  'slot.endMeeting': 'End meeting mode',
  'slot.pause.intro': 'Stop watching for a while. It starts again by itself.',
  'slot.pause.minutes': '{n, plural, one {# minute} other {# minutes}}',
  'slot.pause.hours': '{n, plural, one {# hour} other {# hours}}',
  'slot.pause.tomorrow': 'Until tomorrow',
  'slot.meeting.intro': 'Meeting mode: keep watching, silently. The screen flashes, no sound, and alarms are still logged.',
  'slot.background': 'While you work in other tabs, detection keeps running. Some browsers slow background tabs down, so checks can be less frequent there.',

  // Settings > Schedule.
  'schedule.title': 'Schedule',
  'schedule.remind.label': 'Remind me to start watching',
  'schedule.remind.description': 'A notification when your watching hours begin, once per day, only if watching is off. It never switches the camera on by itself.',
  'schedule.explain.allow': 'Allow notifications',
  'schedule.explain.body': 'To remind you, Stop Biting needs your browser’s permission to show notifications. It is used for one thing: a “Start watching?” note when your hours begin. Nothing else, and it never shows one outside your hours.',
  'schedule.explain.notNow': 'Not now',
  'schedule.notice.unanswered': 'The browser did not get an answer, so the reminder is still off. Turn it on again when you want to try once more.',
  'schedule.notice.denied': 'Notifications are blocked for this site, so the reminder stays off. To allow them, open the site settings from the icon at the left of the address bar, set Notifications to Allow, then turn this on again.',
  'schedule.notice.unsupported': 'This browser cannot show notifications, so the reminder is not available here.',
  'schedule.notice.blockedLater': 'Notifications were blocked for this site after you turned this on, so no reminder will show. Allow them in the site settings (the icon at the left of the address bar) to get it back.',
  'schedule.days.aria': 'Days',
  'schedule.time.from': 'From',
  'schedule.time.to': 'to',
  'schedule.summary.noDays': 'No days are chosen, so no reminder will show.',
  'schedule.summary': 'Reminders: {summary}.',
  'schedule.overnight': ' A window that starts in the evening runs into the next morning.',
  'schedule.note.open': 'Reminders show while Stop Biting is open in a browser tab or window, and in the desktop app. A closed browser tab cannot show one.',
  'schedule.note.pause': 'Pause and meeting mode are on the Watch tab and in the mini window. “Until tomorrow” ends at the start of these hours when the reminder is on, and at 6:00 AM when it is off.',

  // describeSchedule(): "9:00 AM to 5:00 PM, Mon to Fri".
  'schedule.describe': '{start} to {end}, {days}',
  'schedule.describe.overnight': '{start} to {end} (next morning), {days}',
  'schedule.days.none': 'no days chosen',
  'schedule.days.every': 'every day',
  'schedule.days.weekdays': 'Mon to Fri',

  // The OS notification for a schedule reminder (reminders.ts), built when it is shown.
  'reminder.title': 'Start watching?',
  'reminder.body': 'Your watching hours have started. Open Stop Biting to switch the alarm on.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('background', messages);
