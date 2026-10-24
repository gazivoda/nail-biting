import { t } from '../i18n/scopes/history';
import { formatDate as formatDateIntl, formatTime as formatTimeIntl } from '../i18n/format';

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return remHours > 0 ? t('time.daysHours', { days, hours: remHours }) : t('time.days', { count: days });
  }
  if (hours > 0) {
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? t('time.hoursMinutes', { hours, minutes: remMinutes }) : t('time.hours', { hours });
  }
  if (minutes > 0) return t('time.minutes', { minutes });
  return t('time.justNow');
}

export function formatTime(timestamp: number): string {
  return formatTimeIntl(timestamp, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return t('date.today');
  if (d.toDateString() === yesterday.toDateString()) return t('date.yesterday');
  return formatDateIntl(d, { weekday: 'short', month: 'short', day: 'numeric' });
}
