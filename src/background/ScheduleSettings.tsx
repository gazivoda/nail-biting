// Settings > Schedule (WS7a, flag background_watching): the hours the person wants to be watched, and the
// "Start watching?" reminder for them. The pause and meeting controls live on the Watch tab and in the mini window;
// this card says so.
//
// The browser's notification prompt is shown only when the person turns the reminder ON, after the card has said
// what it is for (reminders.planTurnOn). A refusal is explained, not worked around, and leaves the reminder off.

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Section, Row, Toggle } from '../pages/settings/ui';
import {
  describeSchedule, formatClock, isOvernight, parseClock, type NotificationPermissionState, type Schedule,
} from './schedule';
import { loadSchedule, saveSchedule, subscribeSchedule } from './scheduleStore';
import { askNotificationPermission, notificationPermission, planTurnOn } from './reminders';

type Notice = null | 'explain' | 'denied' | 'unsupported' | 'unanswered';

const DAYS: { day: number; label: string; name: string }[] = [
  { day: 1, label: 'Mon', name: 'Monday' },
  { day: 2, label: 'Tue', name: 'Tuesday' },
  { day: 3, label: 'Wed', name: 'Wednesday' },
  { day: 4, label: 'Thu', name: 'Thursday' },
  { day: 5, label: 'Fri', name: 'Friday' },
  { day: 6, label: 'Sat', name: 'Saturday' },
  { day: 0, label: 'Sun', name: 'Sunday' },
];

const BUTTON =
  'inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500';
const PRIMARY = `${BUTTON} bg-deep text-white hover:bg-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200`;
const QUIET = `${BUTTON} border border-stone-300 text-stone-800 hover:border-stone-500 dark:border-ink-400 dark:text-stone-100 dark:hover:border-stone-300`;
const TIME_INPUT =
  'min-h-11 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 dark:border-ink-400 dark:bg-ink-100 dark:text-stone-100';

export function ScheduleSettings() {
  const [schedule, setSchedule] = useState<Schedule>(loadSchedule);
  const [notice, setNotice] = useState<Notice>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => subscribeSchedule(() => setSchedule(loadSchedule())), []);

  const update = (patch: Partial<Schedule>) => {
    const next = { ...schedule, ...patch };
    setSchedule(next);
    saveSchedule(next);
  };

  const turnOn = () => {
    const plan = planTurnOn(notificationPermission());
    if (plan === 'enable') { setNotice(null); update({ enabled: true }); return; }
    setNotice(plan);
  };

  const allow = async () => {
    setAsking(true);
    try {
      const result: NotificationPermissionState = await askNotificationPermission();
      if (result === 'granted') { setNotice(null); update({ enabled: true }); }
      else if (result === 'denied') setNotice('denied');
      else if (result === 'unsupported') setNotice('unsupported');
      else setNotice('unanswered');
    } finally {
      setAsking(false);
    }
  };

  const setTime = (field: 'startMinutes' | 'endMinutes', text: string) => {
    const minutes = parseClock(text);
    if (minutes === null) return;
    const other = field === 'startMinutes' ? schedule.endMinutes : schedule.startMinutes;
    if (minutes === other) return; // a window of no length: ignored (the message below explains)
    update({ [field]: minutes });
  };

  const toggleDay = (day: number) => {
    const days = schedule.days.includes(day) ? schedule.days.filter((d) => d !== day) : [...schedule.days, day].sort((a, b) => a - b);
    update({ days });
  };

  return (
    <Section title="Schedule" icon={CalendarClock} fullWidth>
      <Row
        label="Remind me to start watching"
        description="A notification when your watching hours begin, once per day, only if watching is off. It never switches the camera on by itself."
      >
        <Toggle
          label="Remind me to start watching"
          value={schedule.enabled}
          onChange={(on) => { if (on) turnOn(); else { setNotice(null); update({ enabled: false }); } }}
        />
      </Row>

      {notice === 'explain' && (
        <div role="region" aria-label="Allow notifications" className="rounded-xl border border-stone-200 p-4 dark:border-ink-400">
          <p className="text-sm text-stone-800 dark:text-stone-200">
            To remind you, Stop Biting needs your browser&rsquo;s permission to show notifications. It is used for one thing: a
            &ldquo;Start watching?&rdquo; note when your hours begin. Nothing else, and it never shows one outside your hours.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={asking} onClick={allow} className={PRIMARY}>Allow notifications</button>
            <button type="button" onClick={() => setNotice(null)} className={QUIET}>Not now</button>
          </div>
        </div>
      )}
      {notice === 'unanswered' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          The browser did not get an answer, so the reminder is still off. Turn it on again when you want to try once more.
        </p>
      )}
      {notice === 'denied' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          Notifications are blocked for this site, so the reminder stays off. To allow them, open the site settings from the
          icon at the left of the address bar, set Notifications to Allow, then turn this on again.
        </p>
      )}
      {notice === 'unsupported' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          This browser cannot show notifications, so the reminder is not available here.
        </p>
      )}

      {schedule.enabled && notificationPermission() === 'denied' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          Notifications were blocked for this site after you turned this on, so no reminder will show. Allow them in the
          site settings (the icon at the left of the address bar) to get it back.
        </p>
      )}

      {schedule.enabled && (
        <>
          <div role="group" aria-label="Days" className="flex flex-wrap gap-2">
            {DAYS.map(({ day, label, name }) => {
              const on = schedule.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={name}
                  onClick={() => toggleDay(day)}
                  className={`${BUTTON} ${on
                    ? 'bg-deep text-white dark:bg-lime-300 dark:text-deep'
                    : 'border border-stone-300 text-stone-700 hover:border-stone-500 dark:border-ink-400 dark:text-stone-300 dark:hover:border-stone-300'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              From
              <input type="time" className={TIME_INPUT} value={formatClock(schedule.startMinutes)} onChange={(e) => setTime('startMinutes', e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              to
              <input type="time" className={TIME_INPUT} value={formatClock(schedule.endMinutes)} onChange={(e) => setTime('endMinutes', e.target.value)} />
            </label>
          </div>

          <p className="text-sm text-stone-600 dark:text-stone-300">
            {schedule.days.length === 0
              ? 'No days are chosen, so no reminder will show.'
              : `Reminders: ${describeSchedule(schedule)}.`}
            {isOvernight(schedule) && schedule.days.length > 0 && ' A window that starts in the evening runs into the next morning.'}
          </p>
        </>
      )}

      <p className="text-sm text-stone-600 dark:text-stone-300">
        Reminders show while Stop Biting is open in a browser tab or window, and in the desktop app. A closed browser tab
        cannot show one.
      </p>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Pause and meeting mode are on the Watch tab and in the mini window. &ldquo;Until tomorrow&rdquo; ends at the start of
        these hours when the reminder is on, and at 6:00 AM when it is off.
      </p>
    </Section>
  );
}
