// The compare and solutions pages in the browser: they name the Lifetime plan where they quote Stop Biting's price while the page
// was served with it on (the marker the server writes), and say exactly what they said before while it is off. The crawler copy
// of the same pages (scripts/lifetimePages.test.mjs) and their structured data say the same: shared/flagCopy.js.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparePage } from './ComparePage';
import { PAGE_MAP } from '../data/comparePages';

const PRICE_PAGES = [
  '/compare/stop-biting-vs-hands-off', '/compare/stop-biting-vs-nailed', '/compare/stop-biting-vs-smartbehavior',
  '/compare/stop-biting-vs-habitaware', '/compare/stop-biting-vs-nailkeeper', '/compare/stop-biting-vs-biteless',
  '/compare/stop-biting-vs-habitcam', '/compare/stop-biting-vs-nailbitemenu', '/compare/stop-biting-vs-pavlok',
  '/compare/ai-detection-apps', '/solutions/for-students', '/solutions/for-remote-workers', '/solutions/for-mac',
  '/solutions/for-windows',
];

/** The page as the browser draws it when the server's marker lists `marker` (nothing: no marker, every flag off). */
function render(path: string, marker?: string): string {
  vi.unstubAllGlobals();
  if (marker !== undefined) {
    vi.stubGlobal('document', { querySelector: (s: string) => (s === 'meta[name="sb-copy-flags"]' ? { getAttribute: () => marker } : null) });
  }
  return renderToStaticMarkup(createElement(ComparePage, { path }));
}

/** The visible words: tags gone, entities decoded. */
const words = (markup: string) => markup
  .replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

afterEach(() => vi.unstubAllGlobals());

describe('compare and solutions pages, the Lifetime plan on or off', () => {
  it('say two prices with no marker, on every page that quotes them, and in the offer at the foot', () => {
    for (const path of PRICE_PAGES) {
      const text = words(render(path));
      expect(text, path).toMatch(/\$2\.99\/mo(nth)? or \$29\/y(ea)?r/);
      expect(text, path).toContain('then $2.99 a month or $29 a year. Read how it works');
      expect(text, `${path} names our Lifetime plan with the flag off`).not.toMatch(/\$99 once|one-time Lifetime plan|Lifetime plan at/);
    }
  });

  it('say the third price, and no two-price list, once the marker lists lifetime_plan', () => {
    for (const path of PRICE_PAGES) {
      const text = words(render(path, 'lifetime_plan'));
      expect(text, path).not.toMatch(/\$2\.99\/mo(nth)? or \$29\/y(ea)?r/);
      expect(text, path).toContain('then $2.99 a month, $29 a year or $99 once. Read how it works');
      expect(text, path).toContain('$99 once');
    }
  });

  it('do not name the plan for a marker that lists another flag', () => {
    expect(words(render('/compare/stop-biting-vs-nailed', 'event_sync'))).toBe(words(render('/compare/stop-biting-vs-nailed')));
  });

  it('stop calling Stop Biting a subscription on its own once the plan is for sale, and keep what they said about the others', () => {
    const off = words(render('/compare/stop-biting-vs-nailed'));
    const on = words(render('/compare/stop-biting-vs-nailed', 'lifetime_plan'));
    expect(off).toContain('Stop Biting is a subscription that adds Windows');
    expect(off).toContain('Stop Biting\'s subscription buys you things you may not need'.replace('\'', '’'));
    expect(on).toContain('Stop Biting is a subscription, or a one-time Lifetime plan, that adds Windows');
    expect(on).toContain('Stop Biting’s paid plans buy you things you may not need');
    expect(on).toContain('What a Stop Biting plan pays for is the rest of the system');
    expect(on).toContain('Should I buy Nailed or pay for Stop Biting?');
    // Nailed's own facts and prices, and the conclusion, are as they were
    for (const kept of ['nailedapp.io advertises $4.99 one-time', 'Either way there is no subscription', 'on price Nailed wins outright for Mac users on Apple Silicon']) {
      expect(on, kept).toContain(kept);
    }

    const habitcamOn = words(render('/compare/stop-biting-vs-habitcam', 'lifetime_plan'));
    expect(habitcamOn).toContain('it is a subscription unless you choose the one-time Lifetime plan at $99.');
    for (const kept of ['Lifetime license: $19.99 launch special, regularly $39.99; one device; no subscription', 'Is HabitCam a subscription?']) {
      expect(habitcamOn, kept).toContain(kept);
    }
  });

  it('every price the pages quote for a competitor is the same on and off (only Stop Biting\'s own price list moved)', () => {
    for (const path of PRICE_PAGES) {
      const money = (text: string) => (text.match(/[€$£]\d+(?:[.,]\d+)*/g) ?? []).filter(m => m !== '$99');
      const off = money(words(render(path)));
      const on = money(words(render(path, 'lifetime_plan')));
      // the Lifetime price is the one figure that may appear (once per list) and nothing else may change
      expect(on.filter(m => m !== '$2.99' && m !== '$29' && m !== '$2.42'), path).toEqual(off.filter(m => m !== '$2.99' && m !== '$29' && m !== '$2.42'));
    }
  });

  it('every other page of the bundle changes in one place only: the offer at its foot, which every compare and solutions page carries', () => {
    const others = Object.keys(PAGE_MAP).filter(p => !PRICE_PAGES.includes(p));
    expect(others.length).toBeGreaterThan(3);
    const foot = (text: string) => text.replace('then $2.99 a month, $29 a year or $99 once', 'THEN').replace('then $2.99 a month or $29 a year', 'THEN');
    for (const path of others) {
      const off = words(render(path));
      expect(foot(words(render(path, 'lifetime_plan'))), path).toBe(foot(off));
      expect(off, path).toContain('then $2.99 a month or $29 a year');
    }
  });
});
