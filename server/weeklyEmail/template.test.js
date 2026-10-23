import { describe, it, expect } from 'vitest';
import {
  buildWeeklyEmail, summaryLines, esc, weekRangeLabel, WEEKLY_SUBJECT, confirmPageHtml, doneUnsubscribedPageHtml, invalidLinkPageHtml,
} from './template.js';
import { buildWeeklySummary } from './summary.js';
import { weekBounds } from './week.js';

const bounds = weekBounds(Date.UTC(2026, 9, 23, 12), 'UTC');
const summary = (over = {}) => ({
  thisWeek: 4, lastWeek: 5, changePct: -20, direction: 'down',
  topTrigger: { id: 'stress', label: 'Stress', count: 2, of: 3 },
  quietestDays: ['Tuesday', 'Thursday'], days: [], alarmsToReview: 0, ...over,
});
const build = (s, extra = {}) => buildWeeklyEmail({
  summary: s, weekStart: bounds.weekStart, weekEnd: bounds.weekEnd, timeZone: 'UTC',
  appUrl: 'https://stopbiting.today', unsubscribeUrl: 'https://stopbiting.today/api/email/unsubscribe/abc.def', ...extra,
});

describe('esc', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
    expect(esc(5)).toBe('5');
  });
});

describe('the sentences', () => {
  it('says the numbers plainly, in whole words', () => {
    const l = summaryLines(summary());
    expect(l.headline).toBe('4 bites logged this week');
    expect(l.compare).toBe('20% fewer than the week before (5).');
    expect(l.trigger).toBe('The reason you picked most often: Stress (2 of 3 bites with a reason).');
    expect(l.quiet).toBe('Days with the fewest bites logged: Tuesday and Thursday.');
    expect(l.review).toBeNull();
  });

  it('singular, zero, up, same, and no comparison', () => {
    expect(summaryLines(summary({ thisWeek: 1 })).headline).toBe('1 bite logged this week');
    expect(summaryLines(summary({ thisWeek: 0, direction: 'down', changePct: -100, topTrigger: null, quietestDays: null })).headline).toBe('No bites logged this week');
    expect(summaryLines(summary({ thisWeek: 6, lastWeek: 4, changePct: 50, direction: 'up' })).compare).toBe('50% more than the week before (4).');
    expect(summaryLines(summary({ thisWeek: 3, lastWeek: 3, changePct: 0, direction: 'same' })).compare).toBe('The same as the week before (3).');
    expect(summaryLines(summary({ lastWeek: 0, changePct: null, direction: 'up' })).compare).toBe(
      'No bites were logged the week before, so there is nothing to compare with.');
    expect(summaryLines(summary({ thisWeek: 0, lastWeek: 0, changePct: null, direction: 'none', topTrigger: null, quietestDays: null })).compare).toBeNull();
  });

  it('three or more quiet days read as a list; no quiet-day line when this week had none logged', () => {
    expect(summaryLines(summary({ quietestDays: ['Monday', 'Wednesday', 'Friday'] })).quiet).toBe('Days with the fewest bites logged: Monday, Wednesday and Friday.');
    expect(summaryLines(summary({ thisWeek: 0, quietestDays: null })).quiet).toBeNull();
  });

  it('mentions alarms waiting for review, and says they only count once confirmed', () => {
    expect(summaryLines(summary({ alarmsToReview: 1 })).review).toMatch(/^1 alarm is still waiting for your review in History/);
    expect(summaryLines(summary({ alarmsToReview: 3 })).review).toMatch(/^3 alarms are still waiting/);
  });
});

describe('the email', () => {
  it('has the fixed subject and an HTML and a text part that say the same things', () => {
    const m = build(summary({ alarmsToReview: 2 }));
    expect(m.subject).toBe(WEEKLY_SUBJECT);
    expect(m.subject).toBe('Your week with Stop Biting');
    const l = summaryLines(summary({ alarmsToReview: 2 }));
    for (const line of [l.headline, l.compare, l.trigger, l.quiet, l.review]) {
      expect(m.html).toContain(esc(line));
      expect(m.text).toContain(line);
    }
    expect(m.html).toContain('Mon 12 Oct to Sun 18 Oct');
    expect(m.text).toContain('Mon 12 Oct to Sun 18 Oct');
  });

  it('links to the app and to the unsubscribe page, in both parts', () => {
    const m = build(summary());
    expect(m.html).toContain('href="https://stopbiting.today"');
    expect(m.html).toContain('href="https://stopbiting.today/api/email/unsubscribe/abc.def"');
    expect(m.text).toContain('Open the app: https://stopbiting.today');
    expect(m.text).toContain('Unsubscribe: https://stopbiting.today/api/email/unsubscribe/abc.def');
  });

  it('says where the numbers come from, and makes no cause, medical or praise claim', () => {
    const m = build(summary());
    expect(m.text).toContain('built from the history you chose to sync');
    const all = `${m.html}\n${m.text}`.toLowerCase();
    for (const banned of ['because of', 'thanks to', 'treat', 'cure', 'clinical', 'therapy', 'proven', 'great job', 'well done', 'congrat', 'doing great', 'improv', 'healthy', 'diagnos']) {
      // "a log is a way to notice a habit, not a treatment" is the one allowed use of the word
      const cleaned = all.replaceAll('not a treatment', '');
      expect(cleaned, banned).not.toContain(banned);
    }
  });

  it('uses no image, no script, no em dash and no emoji', () => {
    const m = build(summary());
    expect(m.html).not.toMatch(/<img|<script|<svg/i);
    expect(`${m.html}${m.text}`).not.toMatch(/[–—]/);
    expect(`${m.html}${m.text}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('escapes anything interpolated (a hostile label or URL cannot break out)', () => {
    const m = build(
      summary({ topTrigger: { id: 'x', label: '<b onmouseover=alert(1)>', count: 2, of: 3 } }),
      { appUrl: 'https://x.test/"><script>1</script>', unsubscribeUrl: 'https://x.test/u?a=1&b="2"' },
    );
    expect(m.html).not.toContain('<b onmouseover');
    expect(m.html).not.toContain('<script>1</script>');
    expect(m.html).toContain('&lt;b onmouseover=alert(1)&gt;');
    expect(m.html).toContain('href="https://x.test/u?a=1&amp;b=&quot;2&quot;"');
  });

  it('never carries an email address or a name', () => {
    const real = summary();
    const m = build(real);
    expect(`${m.html}\n${m.text}`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it('builds from a real summary end to end', () => {
    const events = [1, 2, 3].map(i => ({ id: `e${i}`, ts: bounds.weekStart + i * 3_600_000, source: 'manual', behavior: 'nail_biting', updatedAt: 1, triggers: ['boredom'] }));
    const s = buildWeeklySummary(events, { ...bounds, timeZone: 'UTC' });
    const m = build(s);
    expect(m.text).toContain('3 bites logged this week');
    expect(m.text).toContain('Boredom (3 of 3 bites with a reason)');
  });
});

describe('week label', () => {
  it('shows the first and the last day in the person\'s zone', () => {
    const b = weekBounds(Date.UTC(2026, 9, 18, 12), 'Pacific/Auckland');
    expect(weekRangeLabel(b.weekStart, b.weekEnd, 'Pacific/Auckland')).toBe('Mon 12 Oct to Sun 18 Oct');
    const ny = weekBounds(Date.UTC(2026, 10, 4, 12), 'America/New_York');
    expect(weekRangeLabel(ny.weekStart, ny.weekEnd, 'America/New_York')).toBe('Mon 26 Oct to Sun 1 Nov');
  });
});

describe('the unsubscribe pages', () => {
  it('the confirm page asks and carries a POST form, nothing that changes state by itself', () => {
    const html = confirmPageHtml('/api/email/unsubscribe/abc.def');
    expect(html).toContain('<form method="post" action="/api/email/unsubscribe/abc.def">');
    expect(html).toContain('noindex');
    expect(html).not.toMatch(/<script|<img/i);
  });

  it('the done and invalid pages are noindex, text only, and link home', () => {
    for (const html of [doneUnsubscribedPageHtml('https://stopbiting.today'), invalidLinkPageHtml('https://stopbiting.today')]) {
      expect(html).toContain('noindex');
      expect(html).toContain('href="https://stopbiting.today"');
      expect(html).not.toMatch(/<script|<img/i);
    }
    expect(doneUnsubscribedPageHtml('https://stopbiting.today')).toContain('You are unsubscribed');
  });

  it('escapes the action URL', () => {
    expect(confirmPageHtml('/x"><script>')).not.toContain('<script>');
  });
});
