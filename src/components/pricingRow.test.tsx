// The plan row on the pricing section: Yearly, Monthly and (flag lifetime_plan) Lifetime as three plates of one grid, the
// last marked as the best deal. With the flag off the markup is exactly what it was: two plates, no badge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resetLocaleForTests } from '../i18n/core';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';

const h = vi.hoisted(() => ({ flags: new Set<string>() }));

vi.mock('../features/useFeature', () => ({
  useFeature: (name: string) => h.flags.has(name),
  useFeatures: () => Object.fromEntries([...h.flags].map(name => [name, true])),
}));
vi.mock('../billing/prices', async importOriginal => ({
  ...(await importOriginal<typeof import('../billing/prices')>()),
  useLocalizedPrices: () => ({}),
}));
vi.mock('../auth/useSignInProviders', async importOriginal => ({
  ...(await importOriginal<typeof import('../auth/useSignInProviders')>()),
  useSignInHref: () => '/api/auth/google',
}));

import { PricingSection } from './PricingSection';
import { PRICE_IDS } from '../billing/env';

const html = () => renderToStaticMarkup(<PricingSection />);
const plates = (markup: string) => (markup.match(/class="sg-plate/g) ?? []).length;

describe('pricing row', () => {
  // PRICE_IDS is `as const` (read-only in the types) but a plain object at run time: the build sets it from the environment.
  const setLifetime = (id: string) => { (PRICE_IDS as { lifetime: string }).lifetime = id; };
  const saved = PRICE_IDS.lifetime;
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); h.flags.clear(); });
  afterEach(() => { setLifetime(saved); resetStorage(); });

  it('shows two plates and no best-deal badge while the flag is off, even when the price id is in the build', () => {
    setLifetime('pri_life');
    const markup = html();
    expect(plates(markup)).toBe(2);
    expect(markup).not.toContain('Best deal');
    expect(markup).not.toContain('Lifetime');
    expect(markup).toContain('md:grid-cols-2"');
    expect(markup).not.toContain('lg:grid-cols-3');
  });

  it('shows two plates when the flag is on but the build has no lifetime price id', () => {
    h.flags.add('lifetime_plan');
    setLifetime('');
    const markup = html();
    expect(plates(markup)).toBe(2);
    expect(markup).not.toContain('Best deal');
  });

  it('puts Yearly, Monthly and Lifetime in one three-column grid, in that order, with the badge on Lifetime only', () => {
    h.flags.add('lifetime_plan');
    setLifetime('pri_life');
    const markup = html();
    expect(plates(markup)).toBe(3);
    expect(markup).toContain('lg:grid-cols-3');
    // one grid: the three plates are siblings inside the same container
    const grid = markup.slice(markup.indexOf('lg:grid-cols-3'));
    expect(grid.indexOf('Yearly')).toBeGreaterThan(-1);
    expect(grid.indexOf('Yearly')).toBeLessThan(grid.indexOf('Monthly'));
    expect(grid.indexOf('Monthly')).toBeLessThan(grid.indexOf('Lifetime'));
    // the badge appears once, inside the Lifetime plate (after the Monthly plate)
    expect(markup.split('Best deal').length - 1).toBe(1);
    expect(markup.indexOf('Best deal')).toBeGreaterThan(markup.indexOf('Monthly'));
    // the lifetime plate is the one that spans both columns on a tablet
    expect(markup).toContain('md:col-span-2 lg:col-span-1');
  });

  it('keeps the existing yearly badge', () => {
    h.flags.add('lifetime_plan');
    setLifetime('pri_life');
    expect(html()).toContain('Best value');
  });

  // The headline is the page's h1 on /pricing (and the section's h2 on the homepage): it names the third plan while its card is
  // shown, in the words the crawler article uses (shared/flagCopy.js lifetimeHeadline, server/marketing/lifetimeCopy.js).
  const heading = (markup: string) => markup.match(/<h2 id="pricing-heading"[^>]*>(.*?)<\/h2>/)?.[1];

  it('says two prices in the headline while the Lifetime card is not shown', () => {
    expect(heading(html())).toBe('$2.99 a month, or <span class="sg-mark">$29 a year.</span>');
    h.flags.add('lifetime_plan');
    setLifetime('');
    expect(heading(html())).toBe('$2.99 a month, or <span class="sg-mark">$29 a year.</span>');
  });

  it('says the third price in the headline when the card is shown, with the yearly plan still marked', () => {
    h.flags.add('lifetime_plan');
    setLifetime('pri_life');
    expect(heading(html())).toBe('$2.99 a month, <span class="sg-mark">$29 a year,</span> or $99 once.');
    expect(renderToStaticMarkup(<PricingSection headingAs="h1" />)).toContain('<h1 id="pricing-heading" class="sg-h2">$2.99 a month, <span class="sg-mark">$29 a year,</span> or $99 once.</h1>');
  });
});
