// Pseudo-locale coverage for History (Log) and Insights (charts, milestones, celebration card, share card).
// Everything is rendered with the German catalog on and every t() result marked; whatever English is left
// outside the marks was not produced by t() (see src/i18n/testing/pseudo.ts).
//
// Out of reach of static markup (no jsdom here): the undo bar and the "Clear all history?" confirmation open
// from a click, so they are exported by Log.tsx (UndoBar, ClearAllConfirm) and rendered directly; the recharts
// week chart draws nothing without a browser size, so its words (title, caption, number label, switch) are
// rendered and its tooltip series name is asserted through the catalog; the lazy InsightsView has no text of its
// own (InsightsBody has it).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { usePseudoLocale, setFlags, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import type { Incident } from '../../types';
import { computeInsights, type Trend } from '../../insights/aggregate';
import { evaluateMilestones, MILESTONES } from '../../insights/milestones';
import { alarm, bite, manyEvents, urge } from '../../insights/testEvents';
import type { InsightEvent } from '../../insights/predicate';
import { InsightsBody, type InsightsBodyProps } from '../../insights/ui/InsightsBody';
import { CelebrationCard, type ShareUiState } from '../../insights/ui/CelebrationCard';
import { MilestoneList } from '../../insights/ui/MilestoneList';
import { HistoryInsightsSwitch } from '../../insights/ui/ViewSwitch';
import { coachingSentence, falseAlarmSentence, heatmapSummary, seriesSummary, trendSentence } from '../../insights/copy';
import { WEEKDAY_ROWS, countPhrase, hourLabel, hourSpan, triggerLabel, weekdayLong, weekdayShort } from '../../insights/labels';
import { buildShareCardModel, formatCardDate } from '../../insights/shareCard';
import { useInsightsAvailability } from '../../insights/useInsightsAvailability';
import { formatDate, formatDuration, formatTime } from '../../utils/time';
import { hourRange } from '../../utils/insights';
import { t as ti } from '../scopes/insights';
import { t as th } from '../scopes/history';

export const COVERS = [
  'src/pages/Log.tsx',
  'src/utils/time.ts',
  'src/utils/insights.ts',
  'src/insights/copy.ts',
  'src/insights/labels.ts',
  'src/insights/milestones.ts',
  'src/insights/shareCard.ts',
  'src/insights/useInsightsAvailability.ts',
  'src/insights/ui/InsightsBody.tsx',
  'src/insights/ui/WeekHero.tsx',
  'src/insights/ui/EmptyInsights.tsx',
  'src/insights/ui/HeatmapGrid.tsx',
  'src/insights/ui/TriggerBars.tsx',
  'src/insights/ui/MilestoneList.tsx',
  'src/insights/ui/CelebrationCard.tsx',
  'src/insights/ui/ViewSwitch.tsx',
];
// NOT-RENDERED src/insights/useShareCard.ts: a hook that draws a canvas and calls navigator.share, neither exists in node; its one sentence (share.text) is asserted below through the insights scope, and the card model it shares is built by shareCard.ts, covered here.

// The store is replaced by fixed data (zustand renders its initial state on the server), as in Log.insights.test.tsx.
const fixed = vi.hoisted(() => ({
  state: {
    incidents: [] as Incident[],
    customTags: [{ id: 'custom-1', label: 'Commute', emoji: '🚇' }, { id: 'custom-2', label: 'Phone', emoji: '' }],
    weekChartMetric: 'incidents',
    setWeekChartMetric: () => {}, deleteIncident: () => {}, restoreIncident: () => {}, confirmIncident: () => {}, clearHistory: () => {},
  },
  hidden: 0,
}));
vi.mock('../../store/useAppStore', async importOriginal => ({
  ...(await importOriginal<typeof import('../../store/useAppStore')>()),
  useAppStore: () => fixed.state,
}));
// A free account's hidden-entries count (WS9) is a store of its own; here it is a number.
vi.mock('../../billing/useFreeTier', async importOriginal => ({
  ...(await importOriginal<typeof import('../../billing/useFreeTier')>()),
  useHistoryWindow: (items: Incident[]) => (fixed.hidden ? { visible: items.slice(0, 4), hidden: fixed.hidden } : { visible: items, hidden: 0 }),
}));
// Other areas' components that History mounts: their words are covered by their own coverage tests.
vi.mock('../../photos/PhotoReminder', () => ({ PhotoReminder: () => null }));
vi.mock('../../falsePositive/FalsePositiveRate', () => ({ FalsePositiveRate: () => null }));

import { Log, UndoBar, ClearAllConfirm } from '../../pages/Log';

// Words that are fixture data (the names of two reasons a person made up), not app text, and "Sept", which is how
// Intl writes September next to a day number in German (the scan's own list has the stand-alone forms).
const ALLOW = ['Commute', 'Phone', 'Sept'];

function check(el: ReactElement | string, allow: string[] = []): string {
  const html = typeof el === 'string' ? el : renderToStaticMarkup(el);
  expectAllTranslated(html, { allow: [...ALLOW, ...allow] });
  expectNoMissingParams(html);
  return html;
}
/** Text from a helper wrapped in markup, so the scan sees it like any other text. */
const text = (...strings: string[]) => renderToStaticMarkup(<div>{strings.map((s, i) => <p key={i} title={s}>{s}</p>)}</div>);

const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();
const rec = (id: string, ts: number, tag: string, autoDetected: boolean, extra: Partial<Incident> = {}): Incident => ({
  id, timestamp: ts, tag, autoDetected, ts, source: autoDetected ? 'alarm' : 'manual', behavior: 'nail_biting', updatedAt: ts, ...extra,
});

// Today (23 Oct, the pinned clock), yesterday and older days; every kind of entry the list can show.
const POPULATED: Incident[] = [
  rec('p1', at(23, 11, 50), 'auto-detected', true), // alarm to review
  rec('p2', at(23, 11, 20), 'auto-detected', true, { confirmed: true }), // alarm confirmed as a bite
  rec('p3', at(23, 10, 5), 'stress', false),
  rec('p4', at(23, 9, 5), 'focus', false),
  rec('p5', at(23, 8, 40), 'boredom', false),
  rec('p6', at(23, 8, 10), 'unknown', false),
  rec('p7', at(22, 15, 5), 'custom-1', false), // a reason with an emoji
  rec('p8', at(22, 14, 5), 'custom-2', false), // a reason without one
  rec('p9', at(22, 13, 5), 'urge', false, { competingResponse: { done: true, durationSec: 30 } }),
  rec('p10', at(22, 12, 5), 'urge', false, { competingResponse: { done: false } }),
  rec('p11', at(22, 11, 5), 'auto-detected', true, { falsePositive: true }), // "Not a bite"
  rec('p12', at(19, 9, 0), 'stress', false),
  rec('p13', at(19, 9, 30), 'stress', false),
  rec('p14', at(19, 10, 30), 'stress', false),
  rec('p15', at(21, 10, 30), 'a-reason-from-another-device', false),
  rec('p16', at(17, 20, 0), 'auto-detected', true, { behavior: 'nose_picking' }),
  rec('p17', at(16, 20, 0), 'stress', false, { behavior: 'cuticle_skin_biting' }),
];

function setStore(incidents: Incident[], metric: 'incidents' | 'confirmed' = 'incidents', hidden = 0) {
  fixed.state.incidents = incidents;
  fixed.state.weekChartMetric = metric;
  fixed.hidden = hidden;
}

describe('History, pseudo-locale', () => {
  usePseudoLocale();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    setStore([]);
  });

  it('the first-visit card, with and without the way to Watch', () => {
    setStore([]);
    const html = check(<Log onGoToWatch={() => {}} />);
    expect(html).toContain('⟦Noch kein Verlauf⟧');
    check(<Log />);
  });

  it.each([
    ['no flags', []],
    ['not-a-bite controls', ['false_positive_controls']],
    ['behavior filter', ['detection_behaviors']],
    ['insights switch', ['insights']],
    ['photo diary switch', ['photo_diary']],
    ['everything on', ['false_positive_controls', 'detection_behaviors', 'insights', 'photo_diary']],
  ])('the populated list, %s', (_name, flags) => {
    setFlags(...flags);
    for (const metric of ['incidents', 'confirmed'] as const) {
      setStore(POPULATED, metric);
      check(<Log onGoToWatch={() => {}} />);
    }
  });

  it('shows the words of every kind of entry', () => {
    setFlags('false_positive_controls', 'detection_behaviors', 'insights');
    setStore(POPULATED);
    const html = check(<Log />);
    for (const word of ['Heute', 'Gestern', 'Biss, ', 'Alarm', 'Kein Biss', 'Zusammenfassung', 'Letzte 7 Tage', 'Alles löschen']) expect(html).toContain(word);
    expect(html).toContain('als „Kein Biss“ markiert');
    expect(html).toContain('Biss, 🚇 Commute');
    expect(html).toContain('Biss, Phone');
    expect(html).toContain(', Timer beendet⟧'); // an urge whose timer finished: "Drang, Timer beendet"
    expect(html).toContain('Verhalten anzeigen'); // the behavior filter
  });

  it('the week chart counts entries and bites, with the busiest day in words', () => {
    setStore(POPULATED, 'incidents');
    expect(check(<Log />)).toContain('Alarme und Bisse pro Tag. Die meisten am ');
    setStore(POPULATED, 'confirmed');
    expect(check(<Log />)).toContain('Bisse pro Tag. Die meisten am ');
    setStore([rec('old', at(1, 9, 0), 'stress', false)], 'confirmed');
    expect(check(<Log />)).toContain('Keine Bisse in den letzten 7 Tagen.');
    setStore([rec('old', at(1, 9, 0), 'stress', false)], 'incidents');
    expect(check(<Log />)).toContain('Keine Einträge in den letzten 7 Tagen.');
    expect(th('week.seriesBites')).toBe('⟦Bisse⟧');
    expect(th('week.seriesEntries')).toBe('⟦Einträge⟧');
  });

  it.each([1, 5])('a free account with %i older entries hidden', hidden => {
    setStore(POPULATED, 'incidents', hidden);
    const html = check(<Log />);
    expect(html).toContain(hidden === 1 ? 'älterer Eintrag ist' : 'ältere Einträge sind');
  });

  it('one entry, and only a marked one, use the singular and the marked-count wording', () => {
    setStore([POPULATED[2]]);
    expect(check(<Log />)).toContain('1 Eintrag');
    setFlags('false_positive_controls');
    setStore([POPULATED[10]]);
    expect(check(<Log />)).toContain('als „Kein Biss“ markiert');
  });

  it('the undo bar and the clear-history confirmation', () => {
    check(<div role="status"><UndoBar time={formatTime(at(23, 9, 5))} onUndo={() => {}} /></div>);
    const html = check(<ClearAllConfirm onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('Gesamten Verlauf löschen?');
  });

  it('the time and day words of the shared helpers', () => {
    const now = Date.now();
    check(text(formatDate(now), formatDate(now - 86_400_000), formatDate(at(9, 9, 0)), formatTime(now)));
    const ms = [0, 30_000, 60_000, 3_600_000, 3_660_000, 86_400_000, 90_000_000, 2 * 86_400_000, 2 * 86_400_000 + 3_600_000];
    check(text(...ms.map(formatDuration)));
    check(text(...Array.from({ length: 24 }, (_, h) => hourRange(h))));
  });

  it('the History | Insights switch names the second view in the person\'s language', () => {
    function Probe() {
      const tab = useInsightsAvailability();
      return tab ? <HistoryInsightsSwitch view="history" onChange={() => {}} insightsLabel={tab.label} /> : <p>none</p>;
    }
    setFlags('insights');
    expect(check(<Probe />)).toContain('⟦Einblicke⟧');
    setFlags('photo_diary');
    expect(check(<Probe />)).toContain('⟦Fotos⟧');
    setFlags();
    expect(renderToStaticMarkup(<Probe />)).toContain('none');
  });
});

describe('Insights, pseudo-locale', () => {
  usePseudoLocale();

  const NOW = new Date(2026, 9, 23, 15).getTime();
  const START = NOW - 200 * 86_400_000;
  const DAY = 86_400_000;

  function props(events: InsightEvent[], over: Partial<InsightsBodyProps> = {}): InsightsBodyProps {
    const rangeDays = over.rangeDays === undefined ? 90 : over.rangeDays;
    return {
      insights: computeInsights(events, { now: NOW, rangeDays }),
      milestones: evaluateMilestones({ events, startedAt: START, now: NOW }),
      customTags: [{ id: 'custom-1', label: 'Commute', emoji: '🚇' }],
      series: 'bites', onSeries: () => {}, rangeDays, onRangeDays: () => {},
      charts: true, coachingOn: false, falseAlarmsOn: false, onOpenMilestone: () => {},
      ...over,
    };
  }

  const coaching = [
    alarm(NOW - 5000, { competingResponse: { done: true, durationSec: 30 } }),
    alarm(NOW - 4000, { competingResponse: { done: false } }),
    alarm(NOW - 3000, { falsePositive: true }),
    bite(NOW - 2000),
  ];
  // Ten different reasons, so the trigger bars keep eight rows and say "and 2 more".
  const tenReasons = Array.from({ length: 12 }, (_, i) => bite(NOW - (i + 1) * 3_600_000, { tag: i < 3 ? 'stress' : `reason-${i}` }));
  const STATES: Record<string, InsightEvent[]> = {
    empty: [],
    'one bite': [bite(NOW - 3_600_000, { tag: 'stress' })],
    'five custom': Array.from({ length: 5 }, (_, i) => bite(NOW - i * 3_600_000, { tag: 'custom-1' })),
    'ten reasons': tenReasons,
    'many events': manyEvents(300, NOW),
    'thousands': manyEvents(3000, NOW),
    'rates': coaching,
    'urges only': [urge(NOW - 1000), bite(NOW - 2000, { falsePositive: true })],
    'more than before': [...Array.from({ length: 6 }, (_, i) => bite(NOW - i * 3_600_000)), bite(NOW - 8 * DAY), bite(NOW - 9 * DAY)],
    'fewer than before': [bite(NOW - 3_600_000), ...Array.from({ length: 6 }, (_, i) => bite(NOW - 8 * DAY - i * 3_600_000))],
    'same as before': [bite(NOW - 3_600_000), bite(NOW - 8 * DAY)],
    'nothing recent': [bite(NOW - 40 * DAY)],
  };

  it.each(Object.keys(STATES))('the page with: %s', name => {
    for (const series of ['bites', 'entries'] as const) {
      for (const rangeDays of [30, 90, null] as const) {
        for (const on of [false, true]) {
          check(<InsightsBody {...props(STATES[name], { series, rangeDays, coachingOn: on, falseAlarmsOn: on, hiddenCount: on ? 3 : 0, onGoToWatch: on ? () => {} : undefined })} />);
        }
      }
    }
  });

  it('the empty page, the early-days note and the hidden-entries note read in German', () => {
    expect(check(<InsightsBody {...props([], { onGoToWatch: () => {} })} />)).toContain('⟦Noch nichts für Diagramme⟧');
    expect(check(<InsightsBody {...props(STATES['one bite'])} />)).toContain('Bisher nur ⟦1 Eintrag⟧');
    expect(check(<InsightsBody {...props(STATES['one bite'], { hiddenCount: 1 })} />)).toContain('älterer Eintrag ist');
    expect(check(<InsightsBody {...props(STATES['ten reasons'])} />)).toContain('weitere');
  });

  it('with only the photo diary on there are no charts', () => {
    check(<InsightsBody {...props([bite(NOW - 2000)], { charts: false, photoDiary: <span>{ti('empty.goToWatch')}</span> })} />);
  });

  it('the rate cards and their sentences', () => {
    const html = check(<InsightsBody {...props(coaching)} />);
    expect(html).toContain('Ersatzhandlung');
    expect(html).toContain('Fehlalarme');
    check(<InsightsBody {...props([bite(NOW - 2000)], { coachingOn: true, falseAlarmsOn: true })} />);
    const insights = computeInsights(coaching, { now: NOW });
    const none = computeInsights([], { now: NOW });
    check(text(
      coachingSentence(insights.coaching) ?? '',
      falseAlarmSentence(insights.falseAlarms),
      falseAlarmSentence(none.falseAlarms),
      heatmapSummary(insights.heatmap),
      heatmapSummary(none.heatmap),
    ));
  });

  it('every trend sentence', () => {
    const trends: Trend[] = [
      { current: 0, previous: 0, change: 0, pct: null },
      { current: 3, previous: 0, change: 3, pct: null },
      { current: 4, previous: 4, change: 0, pct: 0 },
      { current: 2, previous: 5, change: -3, pct: -60 },
      { current: 7, previous: 5, change: 2, pct: 40 },
    ];
    for (const series of ['bites', 'entries'] as const) check(text(...trends.map(tr => trendSentence(tr, series))));
    // the figures without a percentage (a trend whose previous count is known but pct was not computed)
    check(text(trendSentence({ current: 2, previous: 5, change: -3, pct: null }, 'bites'), trendSentence({ current: 7, previous: 5, change: 2, pct: null }, 'bites')));
  });

  it('the series summaries, the weekday and hour words and the counted nouns', () => {
    for (const series of ['bites', 'entries'] as const) {
      check(text(
        seriesSummary([0, 0, 0], series, 'day', ['a', 'b', 'c']),
        seriesSummary([1, 4, 2], series, 'day', ['Mo., 19. Okt.', 'Di., 20. Okt.', 'Mi., 21. Okt.']),
        seriesSummary([1, 4, 2], series, 'week', ['19. Okt.', '26. Okt.', '2. Nov.']),
        countPhrase(series, 0), countPhrase(series, 1), countPhrase(series, 5),
      ));
    }
    check(text(...WEEKDAY_ROWS.map(weekdayShort), ...WEEKDAY_ROWS.map(weekdayLong), ...Array.from({ length: 24 }, (_, h) => hourLabel(h)), ...Array.from({ length: 24 }, (_, h) => hourSpan(h))));
    check(text(...['stress', 'focus', 'boredom', 'unknown', 'auto-detected', 'custom-1', 'gone'].map(tag => triggerLabel(tag, [{ id: 'custom-1', label: 'Commute', emoji: '🚇' }]))));
  });

  it('the milestone list at several moments, and every milestone card', () => {
    const scenarios: Array<[string, number, InsightEvent[]]> = [
      ['just started', NOW - 30_000, []],
      ['few days', NOW - 4 * DAY, []],
      ['eight days', NOW - 8 * DAY, []],
      ['forty days', NOW - 40 * DAY, []],
      ['hundred alarms', START, Array.from({ length: 100 }, (_, i) => alarm(NOW - 50 * DAY + i * 1000))],
      ['some alarms', START, Array.from({ length: 37 }, (_, i) => alarm(NOW - 50 * DAY + i * 1000))],
    ];
    const states: Array<ShareUiState | 'no-share'> = ['idle', 'working', 'shared', 'downloaded', 'cancelled', 'failed', 'no-share'];
    for (const [, startedAt, events] of scenarios) {
      const statuses = evaluateMilestones({ events, startedAt, now: NOW });
      const html = check(<MilestoneList statuses={statuses} onOpen={() => {}} />);
      expect(html).toContain('⟦Meilensteine⟧');
      for (const s of statuses) {
        for (const state of states) {
          const el = state === 'no-share'
            ? <CelebrationCard status={s} onClose={() => {}} />
            : <CelebrationCard status={s} shareState={state} onShare={() => {}} onClose={() => {}} />;
          check(el);
        }
      }
    }
  });

  it('the celebration card says what happened in German', () => {
    const week = evaluateMilestones({ events: [], startedAt: NOW - 8 * DAY, now: NOW }).find(s => s.def.id === 'week')!;
    const html = check(<CelebrationCard status={week} shareState="downloaded" onShare={() => {}} onClose={() => {}} />);
    for (const phrase of ['⟦Meilenstein⟧', '⟦7 Tage⟧', '⟦Sieben Tage ohne Biss⟧', '⟦Weiter⟧', '⟦Karte zum Teilen erstellen⟧', '⟦Als Bild in deinen Downloads gespeichert.⟧']) {
      expect(html).toContain(phrase);
    }
  });

  it('the milestone definitions and the share card model are German, and the card date follows the language', () => {
    check(text(...MILESTONES.flatMap(m => [m.title, m.figure, m.detail])));
    for (const status of evaluateMilestones({ events: Array.from({ length: 100 }, (_, i) => alarm(START + i * 1000)), startedAt: START, now: START + 40 * DAY })) {
      const m = buildShareCardModel(status);
      // brand and address are the product's own names; everything else must come from the catalog
      check(text(m.kicker, m.figure, m.title, m.detail, m.reached, m.alt), ['stopbiting', 'today']);
      expect(m.brand).toBe('Stop Biting');
    }
    expect(formatCardDate(Date.UTC(2026, 9, 23, 12))).toBe('23. Oktober 2026');
    expect(ti('share.text', { title: 'T', reached: 'R' })).toBe('⟦Stop Biting: T. R.⟧');
  });
});

describe('English stays English', () => {
  // No pseudo-locale here: nothing was picked, so the old wording and formats come out unchanged.
  it('keeps the words, the 12-hour clock and the en-GB card date', () => {
    expect(hourRange(15)).toBe('3 to 4 pm');
    expect(hourRange(11)).toBe('11 am to 12 pm');
    expect(hourLabel(0)).toBe('12 am');
    expect(weekdayShort(0)).toBe('Mon');
    expect(weekdayLong(6)).toBe('Sunday');
    expect(formatDuration(3_660_000)).toBe('1h 1m');
    expect(formatDuration(90_000_000)).toBe('1d 1h');
    expect(formatDuration(86_400_000)).toBe('1 day');
    expect(formatDuration(0)).toBe('just now');
    expect(formatCardDate(Date.UTC(2026, 9, 23, 12))).toBe('23 October 2026');
    expect(ti('triggers.rest', { count: 3, bites: 1 })).toBe('and 3 more, 1 bites in all.');
    expect(ti('triggers.rest', { count: 3, bites: 12 })).toBe('and 3 more, 12 bites in all.');
    expect(ti('count.bites', { count: 1000 })).toBe('1000 bites');
    expect(th('list.count', { count: 1000 })).toBe('1000 entries');
  });
});
