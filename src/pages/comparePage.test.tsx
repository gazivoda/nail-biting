import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparePage, ComparePageView } from './ComparePage';
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

  it('renders nothing for a path that is not in this bundle until the server has said what it is', () => {
    // WS11b: such a path may be a feature page that exists only while its flag is on, so the page asks the
    // server (or reads what the server embedded). Until that answers there is neither the 404 view (which
    // would flash on a page that exists) nor any copy.
    for (const path of ['/compare/does-not-exist', '/features/habit-reversal-coaching', '/solutions/cuticle-biting']) {
      expect(renderToStaticMarkup(createElement(ComparePage, { path }))).toBe('');
    }
  });

  it('shows the 404 view when the server says there is no page', () => {
    const html = renderToStaticMarkup(createElement(ComparePageView, { path: '/compare/does-not-exist', content: undefined }));
    expect(html).toContain('Page not found');
  });

  it('draws a feature page with no hub in its breadcrumb', () => {
    const content = { title: 'A feature', subtitle: 's', intro: 'i', sections: [{ heading: 'H', body: 'b' }], relatedPosts: [] };
    const features = renderToStaticMarkup(createElement(ComparePageView, { path: '/features/x', content }));
    expect(features).toContain('Home');
    expect(features).not.toContain('Solutions');
    expect(features).not.toContain('Compare');
    const solutions = renderToStaticMarkup(createElement(ComparePageView, { path: '/solutions/x', content }));
    expect(solutions).toContain('Solutions');
  });
});
