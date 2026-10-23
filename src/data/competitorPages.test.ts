import { describe, it, expect } from 'vitest';
import { PAGE_MAP, type PageContent } from './comparePages';
import { GATED_PAGE_MAP } from './competitorPages';
import { GATED_COMPARE_FLAG, GATED_COMPARE_PATHS, isGatedComparePath } from './gatedComparePaths';
import { BLOG_POSTS } from './blogPosts';
import { FEATURE_NAMES } from '../features/registry';

const VENDOR_HOSTS: Record<string, string[]> = {
  '/compare/hands-off': ['handsoffapp.com'],
  '/compare/habitaware-keen': ['habitaware.com'],
};

const pages = Object.entries(GATED_PAGE_MAP).map(([path, get]) => [path, get()] as const);
const allText = (p: PageContent) => [p.title, p.subtitle, p.intro, ...p.sections.flatMap(s => [s.heading, s.body, s.html ?? ''])].join('\n');

describe('the flagged competitor pages', () => {
  it('are exactly the paths gatedComparePaths.ts lists, and none of them is a published page', () => {
    expect(Object.keys(GATED_PAGE_MAP).sort()).toEqual([...GATED_COMPARE_PATHS].sort());
    for (const path of GATED_COMPARE_PATHS) {
      expect(isGatedComparePath(path)).toBe(true);
      expect(PAGE_MAP[path]).toBeUndefined();
    }
  });

  it('never gate a page that is already published', () => {
    for (const path of Object.keys(PAGE_MAP)) expect(isGatedComparePath(path)).toBe(false);
  });

  it('use a flag that exists in the registry', () => {
    expect(FEATURE_NAMES).toContain(GATED_COMPARE_FLAG);
  });

  it.each(pages)('%s is marked NEEDS HUMAN VERIFICATION until someone flips needsVerification', (_path, page) => {
    expect(page.needsVerification).toBe(true);
  });

  it.each(pages)('%s links the vendor\'s own pages, and every fact row names its source', (path, page) => {
    const hosts = VENDOR_HOSTS[path];
    const html = page.sections.map(s => s.html ?? '').join('');

    // The facts table: every body row ends in a link to one of the vendor's own pages.
    const rows = [...html.matchAll(/<tr><td>[^<]+<\/td><td>[\s\S]*?<\/td><td>(<a [^>]*>[^<]+<\/a>)<\/td><\/tr>/g)];
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const [, cell] of rows) {
      const href = cell.match(/href="([^"]+)"/)?.[1] ?? '';
      expect(href).toMatch(/^https:\/\//);
      expect(hosts.some(h => new URL(href).hostname.endsWith(h))).toBe(true);
    }

    // Dated verification section with links.
    const verification = page.sections.find(s => s.heading === 'How we verified this page');
    expect(verification?.body).toMatch(/23 October 2026/);
    expect(verification?.html).toMatch(/href="https:\/\//);
  });

  it.each(pages)('%s carries no competitor logo or image, and no star ratings', (_path, page) => {
    const text = allText(page);
    expect(text).not.toMatch(/<img|logo|trademark|★|aggregateRating/i);
  });

  it.each(pages)('%s uses none of the retired privacy phrases, and the approved wording wherever it speaks of camera data', (_path, page) => {
    const text = allText(page);
    // A wrist-sensor page has no camera to talk about; a webcam-app page must use the approved line.
    if (/webcam/i.test(page.intro) && /camera data/i.test(text)) {
      expect(text).toMatch(/no camera data is sent while it runs/);
    }
    for (const retired of [/100% private/i, /no cloud, no server/i, /zero network/i, /nothing leaves/i, /everything stays on your device/i, /100% on-device/i]) {
      expect(text).not.toMatch(retired);
    }
  });

  it.each(pages)('%s says honestly where the other product is the better fit, and links its published sibling', (_path, page) => {
    const headings = page.sections.map(s => s.heading).join('\n');
    expect(headings).toMatch(/better fit/i);
    expect(page.relatedPosts.some(r => /^\/compare\/stop-biting-vs-/.test(r.href))).toBe(true);
    // Every related link is a published page or the flagged sibling, never a dead end.
    for (const { href } of page.relatedPosts) {
      const known = href in PAGE_MAP || isGatedComparePath(href) || href === '/how-it-works' || href.startsWith('/solutions/');
      expect(known).toBe(true);
    }
  });

  it.each(pages)('%s ends with the medical disclaimer and has a question-shaped FAQ', (_path, page) => {
    expect(page.sections.at(-1)?.heading).toBe('A note on medical advice');
    const faq = page.sections.find(s => s.heading === 'Frequently asked questions');
    expect(faq?.html?.match(/<h3 /g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('do not repeat the uncited vendor marketing figures', () => {
    const text = pages.map(([, p]) => allText(p)).join('\n');
    // Hands Off's "70-90%" appears only inside the sentence that declines to repeat it.
    for (const m of text.matchAll(/70-90%/g)) {
      const around = text.slice(Math.max(0, m.index - 160), m.index + 260);
      expect(around).toMatch(/we do not repeat|cannot check/i);
    }
    expect(text).not.toMatch(/50,000|2,500|100% of participants|90% show improvement/);
  });
});

describe('privacy wording across the published article and comparison copy', () => {
  // Stop Biting's OWN claims only. A competitor's words, quoted and attributed, stay as they
  // wrote them (comparePages.ts quotes NailBiteMenu's "No accounts, no cloud, 100% local
  // processing"); none of these phrases appear in those quotations.
  const RETIRED = [
    /100% private/i,
    /no cloud, no server/i,
    /zero network requests/i,
    /zero camera-related network requests/i,
    /nothing leaves your device/i,
    /everything stays on your device/i,
    /100% on-device/i,
    /nothing is transmitted/i,
    /nothing transmitted/i,
    /no server endpoint/i,
    /no cloud dependency/i,
    /works? fully offline/i,
    /runs offline thereafter/i,
    /watching never does/i,
  ];

  it('no blog post, comparison or solutions page uses a retired phrase', () => {
    const corpus: [string, string][] = [
      ...BLOG_POSTS.map(p => [`blog/${p.slug}`, [p.title, p.description, ...p.sections.flatMap(s => [s.heading, s.body, ...(s.list ?? []), s.html ?? ''])].join('\n')] as [string, string]),
      ...Object.entries(PAGE_MAP).map(([path, get]) => [path, allText(get())] as [string, string]),
    ];
    const hits: string[] = [];
    for (const [where, text] of corpus) {
      for (const re of RETIRED) if (re.test(text)) hits.push(`${where}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
