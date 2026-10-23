import { describe, it, expect } from 'vitest';
import { buildShareCardModel, drawShareCard, shareOrDownload, wrapLines, type CardContext } from './shareCard';
import { evaluateMilestones, MILESTONES } from './milestones';
import { alarm } from './testEvents';

const START = Date.UTC(2026, 9, 1, 8);
const D = 86_400_000;

function reached(id: string) {
  const all = evaluateMilestones({ events: Array.from({ length: 100 }, (_, i) => alarm(START + i * 1000)), startedAt: START, now: START + 40 * D });
  return all.find(s => s.def.id === id)!;
}

/** A recording stand-in for a 2D context. */
function recorder() {
  const texts: string[] = [];
  const calls: string[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: 'alphabetic', globalAlpha: 1,
    fillRect: () => { calls.push('fillRect'); },
    beginPath: () => { calls.push('beginPath'); },
    arc: () => { calls.push('arc'); },
    stroke: () => { calls.push('stroke'); },
    fill: () => { calls.push('fill'); },
    setLineDash: () => { calls.push('setLineDash'); },
    fillText: (t: string) => { texts.push(t); calls.push('fillText'); },
    measureText: (t: string) => ({ width: t.length * 20 }),
  } as unknown as CardContext;
  return { ctx, texts, calls };
}

describe('share card model', () => {
  it('carries the milestone figure, its meaning and the date it was reached, and nothing else', () => {
    const m = buildShareCardModel(reached('week'), 'en-GB');
    expect(m.figure).toBe('7 days');
    expect(m.title).toBe('Seven days without a bite');
    expect(m.detail).toMatch(/since your last logged bite/);
    expect(m.reached).toMatch(/^Reached \d{1,2} (October|November) 2026$/);
    expect(m.site).toBe('stopbiting.today');
    expect(Object.keys(m).sort()).toEqual(['alt', 'brand', 'detail', 'figure', 'height', 'kicker', 'reached', 'site', 'title', 'width']);
  });

  it('cannot be made for a milestone that has not been reached', () => {
    const notYet = evaluateMilestones({ events: [], startedAt: START, now: START }).find(s => s.def.id === 'month')!;
    expect(() => buildShareCardModel(notYet)).toThrow(/reached/);
  });

  it('all the wording is plain: no medical claim, no made-up number, no privacy overclaim, no habit', () => {
    for (const def of MILESTONES) {
      const status = { ...reached(def.id), reachedAt: START + D, def };
      const m = buildShareCardModel(status);
      const text = [m.kicker, m.figure, m.title, m.detail, m.reached, m.brand, m.site, m.alt].join(' ');
      expect(text).not.toMatch(/cure|treat|heal|recover|clinical|proven|study|therap|%|percent|\bbest\b|record|rank/i);
      expect(text).not.toMatch(/100% private|nothing leaves|zero network/i);
      expect(text).not.toMatch(/nail|finger|hand|mouth|chew/i);
    }
  });
});

describe('drawing the card', () => {
  it('draws rectangles, circles and text only (no image is ever drawn) and writes the model\'s words', () => {
    const { ctx, texts, calls } = recorder();
    const m = buildShareCardModel(reached('day'));
    drawShareCard(ctx, m);
    expect(new Set(calls)).toEqual(new Set(['fillRect', 'beginPath', 'arc', 'stroke', 'fill', 'setLineDash', 'fillText']));
    expect(texts).toContain('1 day');
    expect(texts).toContain('Stop Biting');
    expect(texts).toContain('stopbiting.today');
    expect(texts.join(' ')).toContain('Reached');
    // Nothing on the card but the model's text and the brand name.
    const allowed = [m.brand, m.kicker.toUpperCase(), m.figure, m.reached, m.site];
    const wrapped = [...m.title.split(' '), ...m.detail.split(' ')];
    for (const t of texts) {
      expect(allowed.includes(t) || t.split(' ').every(w => wrapped.includes(w))).toBe(true);
    }
  });

  it('shrinks a long figure to fit one line', () => {
    const { ctx } = recorder();
    const fonts: string[] = [];
    Object.defineProperty(ctx, 'font', { get: () => fonts[fonts.length - 1] ?? '', set: (v: string) => { fonts.push(v); } });
    drawShareCard(ctx, { ...buildShareCardModel(reached('day')), figure: '1,000,000 alarms and counting' });
    const sizes = fonts.map(f => Number(/800 (\d+)px/.exec(f)?.[1])).filter(Boolean);
    expect(Math.min(...sizes)).toBeLessThan(220);
  });
});

describe('wrapLines', () => {
  const measure = (s: string) => s.length;
  it('wraps greedily at the width', () => {
    expect(wrapLines('one two three four', 9, measure)).toEqual(['one two', 'three', 'four']);
  });
  it('keeps a word that is wider than the line on its own', () => {
    expect(wrapLines('a incomprehensibilities b', 5, measure)).toEqual(['a', 'incomprehensibilities', 'b']);
  });
  it('gives nothing for empty text', () => {
    expect(wrapLines('   ', 10, measure)).toEqual([]);
  });
});

describe('sharing', () => {
  const png = new Blob(['x'], { type: 'image/png' });

  it('uses the share sheet when the browser can share files', async () => {
    const shared: unknown[] = [];
    const downloads: string[] = [];
    const r = await shareOrDownload(png, 'card.png', 'text', {
      canShare: () => true,
      share: async data => { shared.push(data); },
    }, (_b, name) => downloads.push(name));
    expect(r).toBe('shared');
    expect(shared).toHaveLength(1);
    expect(downloads).toEqual([]);
  });

  it('downloads when the browser cannot share files', async () => {
    const downloads: string[] = [];
    expect(await shareOrDownload(png, 'card.png', 't', {}, (_b, n) => downloads.push(n))).toBe('downloaded');
    expect(await shareOrDownload(png, 'card.png', 't', { share: async () => {}, canShare: () => false }, (_b, n) => downloads.push(n))).toBe('downloaded');
    expect(downloads).toEqual(['card.png', 'card.png']);
  });

  it('treats closing the share sheet as a cancel, not a failure, and does not download', async () => {
    const downloads: string[] = [];
    const r = await shareOrDownload(png, 'c.png', 't', {
      canShare: () => true,
      share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); },
    }, (_b, n) => downloads.push(n));
    expect(r).toBe('cancelled');
    expect(downloads).toEqual([]);
  });

  it('falls back to a download when sharing fails for another reason, and never throws', async () => {
    const downloads: string[] = [];
    const r = await shareOrDownload(png, 'c.png', 't', {
      canShare: () => true,
      share: async () => { throw new Error('boom'); },
    }, (_b, n) => downloads.push(n));
    expect(r).toBe('downloaded');
    expect(downloads).toEqual(['c.png']);
    const failed = await shareOrDownload(png, 'c.png', 't', {}, () => { throw new Error('no download'); });
    expect(failed).toBe('failed');
  });
});
