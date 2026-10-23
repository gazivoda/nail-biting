// Scope "history": The History tab (Log): filters, entries, undo bars, week chart labels, bite insights.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/history.ts (the compiler lists what is missing).
//
// Numbers in these messages are written `{count}` (not `#`) so a count of 1000 prints "1000" as it always did.
// Also holds the few words of src/utils/time.ts ("Today", "2h 5m") and src/utils/insights.ts (hour ranges),
// which History, the Watch tab and the phone link share.
import { createScope } from '../scope';

export const messages = {
  'title': 'History',

  // The History | Insights switch under the title
  'switch.label': 'History view',
  'switch.history': 'History',
  'switch.insights': 'Insights',
  'switch.photos': 'Photos',

  // First visit
  'empty.title': 'No history yet',
  'empty.body': 'Alarms from the Watch tab and bites you log with “I just bit my nails” appear here, day by day. Tag them and this page shows what sets you off.',
  'empty.goToWatch': 'Go to Watch',

  // The bar after a deletion, and the behavior filter
  'undo.deleted': 'Entry from {time} deleted.',
  'filter.label': 'Show behavior',
  'filter.all': 'All',

  // The list
  'list.count': '{count, plural, one {{count} entry} other {{count} entries}}',
  'list.countMarked': '{counted, plural, one {{counted} entry} other {{counted} entries}}, {marked} marked not a bite',
  'list.hidden': '{count, plural, one {{count} older entry is} other {{count} older entries are}} saved on this device and show again with a plan.',
  'clear.button': 'Clear all',
  'clear.confirm': "Clear all history? This can't be undone.",
  'clear.yes': 'Yes, clear',

  // One entry: the pill and the buttons
  'tag.bite': 'Bite',
  'tag.biteWith': 'Bite, {reason}',
  'tag.alarm': 'Alarm',
  'tag.notABite': 'Not a bite',
  'tag.urgeFinished': '{label}, timer finished',
  'row.confirmAria': 'Confirm alarm at {time} as a bite',
  'row.confirmTitle': 'This was an actual bite',
  'row.undoAria': 'Undo: count the alarm at {time} again',
  'row.undoTitle': 'Count this alarm again',
  'row.notABiteAria': 'Mark the alarm at {time} as not a bite',
  'row.notABiteTitle': 'My hand was only resting there',
  'row.deleteAria': 'Delete entry from {time}',

  // Summary card
  'summary.title': 'Summary',
  'summary.bites': 'Bites',
  'summary.alarms': 'Alarms to review',
  'summary.topTrigger': 'Top trigger',
  'summary.tagged': '({count} of {total} tagged)',
  'summary.mostBites': 'Most bites',

  // The last-7-days chart
  'week.title': 'Last 7 days',
  'week.bitesThisWeek': '{count, plural, one {bite this week} other {bites this week}}',
  'week.entriesThisWeek': '{count, plural, one {entry this week} other {entries this week}}',
  'week.captionBites': 'Bites per day. Most on {day} ({count}).',
  'week.captionAll': 'Alarms and bites per day. Most on {day} ({count}).',
  'week.captionBitesNone': 'Bites per day. No bites in the last 7 days.',
  'week.captionAllNone': 'Alarms and bites per day. No entries in the last 7 days.',
  'week.chartShows': 'Chart shows',
  'week.filterAll': 'All',
  'week.filterBites': 'Bites',
  'week.seriesBites': 'bites',
  'week.seriesEntries': 'entries',

  // utils/time.ts: how long, and which day
  'time.daysHours': '{days}d {hours}h',
  'time.days': '{count, plural, one {{count} day} other {{count} days}}',
  'time.hoursMinutes': '{hours}h {minutes}m',
  'time.hours': '{hours}h',
  'time.minutes': '{minutes}m',
  'time.justNow': 'just now',
  'date.today': 'Today',
  'date.yesterday': 'Yesterday',

  // utils/insights.ts: "3 to 4 pm" (English), "15:00 to 16:00"
  'hourRange': '{from} to {to}',
} satisfies Record<string, string>;

export const { t, useT } = createScope('history', messages);
