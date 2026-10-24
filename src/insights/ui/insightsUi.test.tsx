import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeInsights } from '../aggregate';
import { evaluateMilestones } from '../milestones';
import { alarm, bite, manyEvents, urge } from '../testEvents';
import { InsightsBody, type InsightsBodyProps } from './InsightsBody';
import { CelebrationCard } from './CelebrationCard';
import { HistoryInsightsSwitch } from './ViewSwitch';
import { MilestoneList } from './MilestoneList';
import type { InsightEvent } from '../predicate';

const NOW = new Date(2026, 9, 23, 15).getTime();
const START = NOW - 200 * 86_400_000;

function props(events: InsightEvent[], over: Partial<InsightsBodyProps> = {}): InsightsBodyProps {
  return {
    insights: computeInsights(events, { now: NOW, rangeDays: 90 }),
    milestones: evaluateMilestones({ events, startedAt: START, now: NOW }),
    customTags: [{ id: 'custom-1', label: 'Commute', emoji: '🚇' }],
    series: 'bites',
    onSeries: () => {},
    rangeDays: 90,
    onRangeDays: () => {},
    charts: true,
    coachingOn: false,
    falseAlarmsOn: false,
    onOpenMilestone: () => {},
    ...over,
  };
}
const render = (p: InsightsBodyProps) => renderToStaticMarkup(<InsightsBody {...p} />);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('Insights page with 0 events', () => {
  const html = render(props([], { onGoToWatch: () => {} }));

  it('is a designed empty state, not a blank page', () => {
    expect(html).toContain('Nothing to chart yet');
    expect(html).toContain('Go to Watch');
    expect(html).toMatch(/Bites per day and per week/);
    expect(html.length).toBeGreaterThan(2000);
  });

  it('draws no chart and no rate, and does not pretend to have numbers', () => {
    expect(count(html, 'role="img"')).toBe(0);
    expect(html).not.toContain('Last 7 days');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('still shows the milestones, which have real progress from the first minute', () => {
    expect(html).toContain('Milestones');
    expect(html).toContain('First hour without a bite');
    expect(html).toContain('0 of 100 alarms');
  });

  it('has no Go to Watch button when the page was not given a way to go there', () => {
    expect(render(props([]))).not.toContain('Go to Watch');
  });
});

describe('Insights page with 1 event', () => {
  const html = render(props([bite(NOW - 3_600_000, { tag: 'stress' })]));

  it('draws all the charts', () => {
    // daily, weekly and the heatmap are each one labelled figure
    expect(count(html, 'role="img"')).toBe(3);
    // a <figure> does not accept role="img" (axe: aria-allowed-role); the charts are plain elements with that role
    expect(html).not.toMatch(/<figure[^>]*role="img"/);
    expect(html).toContain('Each day');
    expect(html).toContain('Each week');
    expect(html).toContain('When it happens');
    expect(html).toContain('What sets it off');
  });

  it('says it is early days, and does not name a top trigger from one bite', () => {
    expect(html).toContain('Only 1 entry so far');
    expect(html).toContain('Not enough bites with a reason yet');
  });

  it('shows the week figure and a comparison that does not invent a percentage', () => {
    expect(html).toMatch(/tabular-nums">1<\/span>/);
    expect(html).toContain('Nothing logged in the 7 days before.');
    expect(html).not.toContain('%</span>'); // no rate card without data
  });

  it('puts the bite in the right heatmap cell', () => {
    expect(html).toMatch(/title="Fri 2 pm: 1 bite"/);
  });
});

describe('Insights page with 10,000 events', () => {
  const events = manyEvents(10_000, NOW);

  it('renders every chart, quickly', () => {
    const t0 = performance.now();
    const p = props(events);
    const html = render(p);
    const took = performance.now() - t0;
    expect(took).toBeLessThan(500);
    expect(count(html, 'role="img"')).toBe(3);
    expect(count(html, 'title="Mon 12 am:')).toBe(1);
    // 7 x 24 heatmap cells plus 5 legend swatches
    expect(count(html, 'rounded-[3px]')).toBeGreaterThanOrEqual(168);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('shows the top trigger by name once there is enough to say, with custom reasons by their own label', () => {
    const html = render(props(events));
    expect(html).toMatch(/Most often: [A-Za-z ]+, \d+ of \d+ bites with a reason\./);
    const onlyCustom = render(props(Array.from({ length: 5 }, (_, i) => bite(NOW - i * 3_600_000, { tag: 'custom-1' }))));
    expect(onlyCustom).toContain('Commute');
  });

  it('the "Alarms and bites" view counts the unreviewed alarms too', () => {
    const bites = computeInsights(events, { now: NOW });
    const html = render(props(events, { series: 'entries' }));
    expect(html).toContain('Includes alarms nobody has reviewed yet.');
    expect(bites.trend.current).toBeLessThan(bites.entryTrend.current);
  });
});

describe('Insights page: rates, photos and what each flag shows', () => {
  const withCoaching = [
    alarm(NOW - 5000, { competingResponse: { done: true, durationSec: 30 } }),
    alarm(NOW - 4000, { competingResponse: { done: false } }),
    alarm(NOW - 3000, { falsePositive: true }),
    bite(NOW - 2000),
  ];

  it('shows the competing-response rate when there is data, and the false-alarm rate once one is marked', () => {
    const html = render(props(withCoaching));
    expect(html).toContain('Competing response');
    expect(html).toContain('1 of 2 alarm');
    expect(html).toContain('False alarms');
    expect(html).toContain('1 of 3 alarms marked &quot;Not a bite&quot;');
  });

  it('hides both rate cards when there is no data and their features are off', () => {
    const html = render(props([bite(NOW - 2000)]));
    expect(html).not.toContain('Competing response');
    expect(html).not.toContain('False alarms');
  });

  it('shows them with a plain explanation when their features are on but nothing has happened yet', () => {
    const html = render(props([bite(NOW - 2000)], { coachingOn: true, falseAlarmsOn: true }));
    expect(html).toContain('Competing response');
    expect(html).toContain('Turn on the prompt under Settings, Alerts');
    expect(html).toContain('No alarms yet.');
  });

  it('with only the photo diary on there are no charts and no milestones, just the diary', () => {
    const html = render(props([bite(NOW - 2000)], { charts: false, photoDiary: <p>the diary</p> }));
    expect(html).toContain('the diary');
    expect(count(html, 'role="img"')).toBe(0);
    expect(html).not.toContain('Milestones');
  });

  it('urges, false positives and deleted entries never show up in the figures', () => {
    const html = render(props([urge(NOW - 1000), bite(NOW - 2000, { falsePositive: true }), bite(NOW - 3000, { deleted: true })]));
    expect(html).toContain('Nothing to chart yet');
  });
});

describe('wording and accessibility', () => {
  const html = render(props(manyEvents(300, NOW)));

  it('makes no medical claim, no privacy overclaim and no verdict', () => {
    expect(html).not.toMatch(/cure|treat(s|ed|ment)|heal|clinical|proven|therap|100% private|nothing leaves|well done|great job|failed/i);
  });

  it('names every chart in words for assistive technology', () => {
    const labels = [...html.matchAll(/role="img" aria-label="([^"]+)"/g)].map(m => m[1]);
    expect(labels).toHaveLength(3);
    for (const l of labels) expect(l.length).toBeGreaterThan(20);
  });

  it('every control is a real button at least 44px tall', () => {
    for (const m of html.matchAll(/<button[^>]*>/g)) expect(m[0]).toMatch(/min-h-1[12]/);
  });
});

describe('the switch, the list and the card', () => {
  it('the switch names the second view and marks the current one', () => {
    const html = renderToStaticMarkup(<HistoryInsightsSwitch view="history" onChange={() => {}} insightsLabel="Insights" />);
    expect(html).toContain('aria-label="History view"');
    expect(html).toMatch(/aria-checked="true"[^>]*>History</);
    expect(html).toContain('Insights');
  });

  it('the milestone list offers a card for the ones reached and progress for the rest', () => {
    const statuses = evaluateMilestones({ events: [], startedAt: NOW - 3 * 86_400_000, now: NOW });
    const html = renderToStaticMarkup(<MilestoneList statuses={statuses} onOpen={() => {}} />);
    expect(count(html, 'View card')).toBe(2); // an hour and a day
    expect(html).toContain('Longest so far');
    expect(html).toContain('0 of 100 alarms');
  });

  it('the celebration card is a labelled dialog with a way out and no illustration', () => {
    const status = evaluateMilestones({ events: [], startedAt: NOW - 8 * 86_400_000, now: NOW }).find(s => s.def.id === 'week')!;
    const html = renderToStaticMarkup(<CelebrationCard status={status} onClose={() => {}} onShare={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toContain('7 days');
    expect(html).toContain('Continue');
    expect(html).toContain('Make a share card');
    expect(html).toContain('motion-safe:animate-fade-up'); // animation only when motion is welcome
    expect(html).not.toMatch(/<img|<video|<canvas/);
    expect(html).toContain('only this milestone');
  });

  it('without a share handler there is no share button and no promise about a picture', () => {
    const status = evaluateMilestones({ events: [], startedAt: NOW - 8 * 86_400_000, now: NOW })[0];
    const html = renderToStaticMarkup(<CelebrationCard status={status} onClose={() => {}} />);
    expect(html).not.toContain('Make a share card');
    expect(html).not.toContain('only this milestone');
  });
});
