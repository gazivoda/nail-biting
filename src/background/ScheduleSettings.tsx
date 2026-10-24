// Settings > Schedule (WS7a, flag background_watching): the hours the person wants to be watched, and the
// "Start watching?" reminder for them. The pause and meeting controls live on the Watch tab and in the mini window;
// this card says so.
//
// The browser's notification prompt is shown only when the person turns the reminder ON, after the card has said
// what it is for (reminders.planTurnOn). A refusal is explained, not worked around, and leaves the reminder off.

import { useEffect, useRef, useState, type Ref } from 'react';
import { CalendarClock } from 'lucide-react';
import { Section, Row, Toggle } from '../pages/settings/ui';
import {
  describeSchedule, formatClock, isOvernight, parseClock, weekdayLong, type NotificationPermissionState, type Schedule,
} from './schedule';
import { weekdayShort } from './pauseMachine';
import { loadSchedule, saveSchedule, subscribeSchedule } from './scheduleStore';
import { askNotificationPermission, notificationPermission, planTurnOn } from './reminders';
import { useT } from '../i18n/scopes/background';

export type Notice = null | 'explain' | 'denied' | 'unsupported' | 'unanswered';

// Monday first, Sunday last (0 = Sunday). The names come from the catalog when the buttons are drawn.
const DAYS: number[] = [1, 2, 3, 4, 5, 6, 0];

const BUTTON =
  'inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500';
const PRIMARY = `${BUTTON} bg-deep text-white hover:bg-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200`;
const QUIET = `${BUTTON} border border-stone-300 text-stone-800 hover:border-stone-500 dark:border-ink-400 dark:text-stone-100 dark:hover:border-stone-300`;
const TIME_INPUT =
  'min-h-11 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 dark:border-ink-400 dark:bg-ink-100 dark:text-stone-100';

/** What the card says after the person turned the reminder on: why we ask, or why it stayed off. Nothing when `notice` is null. */
export function ScheduleNotice({ notice, asking, onAllow, onNotNow, allowRef }: {
  notice: Notice;
  asking: boolean;
  onAllow: () => void;
  onNotNow: () => void;
  /** The "Allow notifications" button, so the card can move focus to it when the explanation opens (keyboard and screen reader). */
  allowRef?: Ref<HTMLButtonElement>;
}) {
  const t = useT();
  return (
    <>
      {notice === 'explain' && (
        <div role="region" aria-label={t('schedule.explain.allow')} className="rounded-xl border border-stone-200 p-4 dark:border-ink-400">
          <p className="text-sm text-stone-800 dark:text-stone-200">
            {t('schedule.explain.body')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button ref={allowRef} type="button" disabled={asking} onClick={onAllow} className={PRIMARY}>{t('schedule.explain.allow')}</button>
            <button type="button" onClick={onNotNow} className={QUIET}>{t('schedule.explain.notNow')}</button>
          </div>
        </div>
      )}
      {notice === 'unanswered' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          {t('schedule.notice.unanswered')}
        </p>
      )}
      {notice === 'denied' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          {t('schedule.notice.denied')}
        </p>
      )}
      {notice === 'unsupported' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          {t('schedule.notice.unsupported')}
        </p>
      )}
    </>
  );
}

export function ScheduleSettings() {
  const t = useT();
  const [schedule, setSchedule] = useState<Schedule>(loadSchedule);
  const [notice, setNotice] = useState<Notice>(null);
  const [asking, setAsking] = useState(false);
  const allowButton = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeSchedule(() => setSchedule(loadSchedule())), []);

  // Turning the switch on only opens the explanation below it; the switch itself stays "off" until the person allows
  // notifications. So the explanation takes focus (it is the next thing to do, and a screen reader says what it is).
  useEffect(() => {
    if (notice === 'explain') allowButton.current?.focus();
  }, [notice]);

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

  // "Not now" removes the buttons: put focus back on the switch that opened them.
  const notNow = () => {
    setNotice(null);
    const label = t('schedule.remind.label');
    window.setTimeout(() => [...document.querySelectorAll<HTMLElement>('button[role="switch"]')].find((b) => b.getAttribute('aria-label') === label)?.focus(), 0);
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
    <Section title={t('schedule.title')} icon={CalendarClock} fullWidth>
      <Row
        label={t('schedule.remind.label')}
        description={t('schedule.remind.description')}
      >
        <Toggle
          label={t('schedule.remind.label')}
          value={schedule.enabled}
          onChange={(on) => { if (on) turnOn(); else { setNotice(null); update({ enabled: false }); } }}
        />
      </Row>

      <ScheduleNotice notice={notice} asking={asking} onAllow={allow} onNotNow={notNow} allowRef={allowButton} />

      {schedule.enabled && notificationPermission() === 'denied' && (
        <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
          {t('schedule.notice.blockedLater')}
        </p>
      )}

      {schedule.enabled && (
        <>
          <div role="group" aria-label={t('schedule.days.aria')} className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const on = schedule.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={weekdayLong(day)}
                  onClick={() => toggleDay(day)}
                  className={`${BUTTON} ${on
                    ? 'bg-deep text-white dark:bg-lime-300 dark:text-deep'
                    : 'border border-stone-300 text-stone-700 hover:border-stone-500 dark:border-ink-400 dark:text-stone-300 dark:hover:border-stone-300'}`}
                >
                  {weekdayShort(day)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              {t('schedule.time.from')}
              <input type="time" className={TIME_INPUT} value={formatClock(schedule.startMinutes)} onChange={(e) => setTime('startMinutes', e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              {t('schedule.time.to')}
              <input type="time" className={TIME_INPUT} value={formatClock(schedule.endMinutes)} onChange={(e) => setTime('endMinutes', e.target.value)} />
            </label>
          </div>

          <p className="text-sm text-stone-600 dark:text-stone-300">
            {schedule.days.length === 0
              ? t('schedule.summary.noDays')
              : t('schedule.summary', { summary: describeSchedule(schedule) })}
            {isOvernight(schedule) && schedule.days.length > 0 && t('schedule.overnight')}
          </p>
        </>
      )}

      <p className="text-sm text-stone-600 dark:text-stone-300">
        {t('schedule.note.open')}
      </p>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {t('schedule.note.pause')}
      </p>
    </Section>
  );
}
