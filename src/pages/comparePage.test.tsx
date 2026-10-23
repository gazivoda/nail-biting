import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparePage } from './ComparePage';
import { GATED_COMPARE_PATHS } from '../data/gatedComparePaths';

describe('ComparePage', () => {
  it('renders an ordinary compare page with its h1', () => {
    const html = renderToStaticMarkup(createElement(ComparePage, { path: '/compare/stop-biting-vs-hands-off' }));
    expect(html).toContain('<h1');
    expect(html).toContain('Stop Biting vs Hands Off');
  });

  it('renders nothing for a flagged page until the flag is known to be on, and never its copy', () => {
    // In a node render the flag hook reports "off" and no request ever completes, which is
    // exactly the state before /api/features has answered (and the state when it says off).
    for (const path of GATED_COMPARE_PATHS) {
      const html = renderToStaticMarkup(createElement(ComparePage, { path }));
      expect(html).toBe('');
    }
  });

  it('still shows the 404 view for a path with no page at all', () => {
    const html = renderToStaticMarkup(createElement(ComparePage, { path: '/compare/does-not-exist' }));
    expect(html).toContain('Page not found');
  });
});
