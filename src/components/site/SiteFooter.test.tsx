// The footer's links to the pages that exist only while their feature flag is on. The server writes the list into the
// page it serves (a data block in the head, see src/features/gatedLinks.ts); with nothing there the footer is exactly the
// footer it always was. There is no DOM in this environment, so the page is a stub with the one method the reader calls.
// scripts/featurePages.test.mjs renders this footer from the block a REAL server wrote, in every flag state.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { usePseudoSiteLocale } from '../../i18n/testing/pseudo';
import { GATED_LINKS_ID } from '../../features/gatedLinks';
import { SiteFooter } from './SiteFooter';

const PHONE = ['/features/phone-companion', 'Log nail biting from your phone in two taps'];
const CUTICLE = ['/solutions/cuticle-biting', 'Cuticle and skin biting'];
const LINK_CLASS = 'inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]';

function pageWith(block: string | null) {
  vi.stubGlobal('document', {
    querySelector: () => null,
    getElementById: (id: string) => (id === GATED_LINKS_ID && block !== null ? { textContent: block } : null),
  });
}
const footer = () => renderToStaticMarkup(<SiteFooter cta={false} page="pricing" />);

describe('SiteFooter, links to the open pages (English)', () => {
  beforeEach(() => { useMemoryStorage(); });
  afterEach(() => { vi.unstubAllGlobals(); resetStorage(); });

  it('is the same footer, byte for byte, with no data block, with an empty one and with no page at all', () => {
    const bare = footer();                       // no document: the situation of every render in this test environment
    pageWith(null);
    expect(footer()).toBe(bare);
    pageWith('[]');
    expect(footer()).toBe(bare);
    pageWith('not json');
    expect(footer()).toBe(bare);
    expect(bare).not.toMatch(/\/features\/|\/solutions\//);
  });

  it('adds one real anchor per open page, inside the footer navigation after the legal links, in the style of the others', () => {
    pageWith(JSON.stringify([PHONE, CUTICLE]));
    const html = footer();
    const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(nav).toContain(`<a href="${PHONE[0]}" class="${LINK_CLASS}">${PHONE[1]}</a>`);
    expect(nav).toContain(`<a href="${CUTICLE[0]}" class="${LINK_CLASS}">${CUTICLE[1]}</a>`);
    // the same classes as the Blog link: the 44px target and the hover colour come with them
    expect(nav).toContain(`href="/blog" class="${LINK_CLASS}"`);
    // after the last legal link, so the order of the links that were always there does not move
    expect(nav.indexOf('href="/refund-policy"')).toBeGreaterThan(-1);
    expect(nav.indexOf(PHONE[0])).toBeGreaterThan(nav.indexOf('href="/refund-policy"'));
    expect(nav.indexOf(CUTICLE[0])).toBeGreaterThan(nav.indexOf(PHONE[0]));
    // nothing else changed: the markup minus the two anchors is the markup without them
    pageWith(null);
    const plain = footer();
    const stripped = html.replace(new RegExp(`<a href="${PHONE[0]}"[^>]*>[^<]*</a>`), '').replace(new RegExp(`<a href="${CUTICLE[0]}"[^>]*>[^<]*</a>`), '');
    expect(stripped).toBe(plain);
  });

  it('draws only addresses on this site, however the block came to say otherwise', () => {
    pageWith(JSON.stringify([['https://evil.example/x', 'Elsewhere'], ['//evil.example/x', 'Also elsewhere'], PHONE]));
    const html = footer();
    expect(html).not.toContain('evil.example');
    expect(html).toContain(`href="${PHONE[0]}"`);
  });
});

describe('SiteFooter, links to the open pages (German page)', () => {
  usePseudoSiteLocale();
  afterEach(() => { vi.unstubAllGlobals(); });

  it('draws none: the pages are English only, and a German footer says so instead of linking English labels', () => {
    pageWith(JSON.stringify([PHONE, CUTICLE]));
    const html = footer();
    expect(html).not.toContain(PHONE[0]);
    expect(html).not.toContain(PHONE[1]);
  });
});
