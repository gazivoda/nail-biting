// Scope "insights": The Insights view, milestones, celebration card and share card.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/insights.ts (the compiler lists what is missing).
//
// Numbers in these messages are written `{count}` (not `#`) so a count of 1000 prints "1000" as it always did.
// Two messages hold a figure plus its noun ("12 bites", "count.bites") and are inserted into the sentences
// that need them, so each sentence is still one message.
import { createScope } from '../scope';

export const messages = {
  // A figure with its noun, used inside other messages.
  'count.bites': '{count, plural, one {{count} bite} other {{count} bites}}',
  'count.entries': '{count, plural, one {{count} entry} other {{count} entries}}',

  // Empty state (before there is anything to chart)
  'empty.title': 'Nothing to chart yet',
  'empty.body': 'This page fills in from the alarms on the Watch tab and the bites you log. A week or two of entries is when patterns start to mean something. Here is what you will see:',
  'empty.willTrend': 'Bites per day and per week, and how this week compares with the one before',
  'empty.willWhen': 'The weekdays and hours it happens most',
  'empty.willTriggers': 'What sets it off, from the reasons you pick',
  'empty.goToWatch': 'Go to Watch',

  // The top card: last 7 days against the 7 before
  'weekHero.title': 'Last 7 days',
  'weekHero.bites': '{count, plural, one {bite} other {bites}}',
  'weekHero.entries': '{count, plural, one {entry} other {entries}}',
  'trend.noneBites': 'No bites logged in the last 14 days.',
  'trend.noneEntries': 'No entries logged in the last 14 days.',
  'trend.noPrevious': 'Nothing logged in the 7 days before.',
  'trend.same': 'The same as the 7 days before ({previous}).',
  'trend.fewer': '{n} fewer than the 7 days before ({previous}).',
  'trend.more': '{n} more than the 7 days before ({previous}).',
  'trend.fewerPct': '{n} fewer than the 7 days before ({previous}), down {pct}%.',
  'trend.morePct': '{n} more than the 7 days before ({previous}), up {pct}%.',

  // Notes and switches above the charts
  'body.sparse': 'Only {entries} so far. The charts say more after a week or two of use.',
  'body.hidden': '{count, plural, one {{count} older entry is} other {{count} older entries are}} saved on this device and show again with a plan, so these charts cover the days you can see.',
  'body.chartsCount': 'Charts count',
  'body.seriesBites': 'Bites',
  'body.seriesEntries': 'Alarms and bites',
  'body.noteBites': 'Alarms count once you confirm them or log the bite yourself.',
  'body.noteEntries': 'Includes alarms nobody has reviewed yet.',

  // Each day / each week
  'daily.title': 'Each day',
  'daily.subtitle': 'Last {count} days, today on the right.',
  'daily.emptyBites': 'No bites in the last {count} days.',
  'daily.emptyEntries': 'No entries in the last {count} days.',
  'weekly.title': 'Each week',
  'weekly.subtitle': 'Last {count} weeks, weeks start on Monday.',
  'weekly.emptyBites': 'No bites in the last {count} weeks.',
  'weekly.emptyEntries': 'No entries in the last {count} weeks.',
  'bar.title': '{label}: {count}',
  'bar.weekTitle': 'Week of {date}: {count}',
  'series.noneBites': 'No bites in this period.',
  'series.noneEntries': 'No entries in this period.',
  'series.summaryDay': '{total} in this period. The most in one day was {max}, on {date}.',
  'series.summaryWeek': '{total} in this period. The most in one week was {max}, in the week of {date}.',

  // When it happens (heatmap)
  'when.title': 'When it happens',
  'when.subtitleAll': 'Bites by weekday and hour of the day, all your history.',
  'when.subtitleDays': 'Bites by weekday and hour of the day, last {days} days.',
  'heatmap.summary': '{total} in this range. The busiest slot is {day}, {hours}, with {count}.',
  'heat.cell': '{day} {hour}: {count}',
  'heat.fewer': 'Fewer',
  'heat.more': 'More',
  'range.label': 'Period',
  'range.days30': '30 days',
  'range.days90': '90 days',
  'range.all': 'All',
  'range.noBites': 'No bites in this range.',

  // What sets it off
  'triggers.title': 'What sets it off',
  'triggers.subtitleAll': 'The reasons you picked for bites, all your history.',
  'triggers.subtitleDays': 'The reasons you picked for bites, last {days} days.',
  'triggers.top': 'Most often: {label}, {count} of {total} bites with a reason.',
  'triggers.notEnough': 'Not enough bites with a reason yet to name the most common one.',
  // English keeps today's wording for a single bite too ("1 bites"); the other languages use their own singular.
  'triggers.rest': 'and {count} more, {bites, plural, one {{bites} bites} other {{bites} bites}} in all.',
  'triggers.percent': ', {share} percent',
  'label.noReason': 'No reason picked',
  'label.otherReason': 'Another reason',

  // Rate cards
  'rate.coachingTitle': 'Competing response',
  'rate.coachingEmpty': 'No finished competing responses to count yet. Turn on the prompt under Settings, Alerts, and this shows how often you finish it after an alarm.',
  'coaching.sentence': '{completed} of {alarms, plural, one {{alarms} alarm} other {{alarms} alarms}} followed by a finished competing response.',
  'rate.falseTitle': 'False alarms',
  'rate.falseEmpty': 'No alarms yet. Alarms you mark as not a bite are counted here.',
  'falseAlarms.none': 'No alarms yet.',
  'falseAlarms.sentence': '{falsePositives} of {alarms, plural, one {{alarms} alarm} other {{alarms} alarms}} marked "Not a bite".',

  // Milestones
  'milestones.title': 'Milestones',
  'milestones.subtitle': 'Time is counted from your last logged bite, the same streak the Watch tab shows.',
  'milestones.progressAlarms': '{best} of {target} alarms',
  'milestones.progressUnderMinute': 'Longest so far under a minute, of {target}',
  'milestones.progress': 'Longest so far {best}, of {target}',
  'milestones.viewCard': 'View card',
  'milestones.viewCardFor': ': {title}',
  'milestone.kicker': 'Milestone',
  'milestone.reached': 'Reached {date}',
  'milestone.hour.title': 'First hour without a bite',
  'milestone.hour.figure': '1 hour',
  'milestone.hour.detail': 'An hour has passed since your last logged bite.',
  'milestone.day.title': 'First day without a bite',
  'milestone.day.figure': '1 day',
  'milestone.day.detail': 'A full day has passed since your last logged bite.',
  'milestone.week.title': 'Seven days without a bite',
  'milestone.week.figure': '7 days',
  'milestone.week.detail': 'A week has passed since your last logged bite.',
  'milestone.month.title': 'Thirty days without a bite',
  'milestone.month.figure': '30 days',
  'milestone.month.detail': 'Thirty days have passed since your last logged bite.',
  'milestone.caught100.title': '100 alarms',
  'milestone.caught100.figure': '100 alarms',
  'milestone.caught100.detail': 'The alarm has gone off 100 times. Each one was a moment to notice and stop.',

  // The celebration card and the share card
  'card.reached': 'Reached {date}.',
  'card.share': 'Make a share card',
  'card.note': 'The picture shows only this milestone. It is made on this device, and only goes where you send it.',
  'card.working': 'Making the picture',
  'card.shared': 'Shared.',
  'card.downloaded': 'Saved as a picture to your downloads.',
  'card.failed': 'Could not make the picture on this browser.',
  'share.alt': 'Stop Biting milestone: {title}. {reached}.',
  'share.text': 'Stop Biting: {title}. {reached}.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('insights', messages);
