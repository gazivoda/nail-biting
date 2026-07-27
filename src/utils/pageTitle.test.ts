import { describe, it, expect } from 'vitest';
import { buildPageTitle } from './pageTitle';

const BRAND = ' | Stop Biting';

describe('buildPageTitle', () => {
  it('keeps the brand suffix when everything fits in 60 chars', () => {
    const out = buildPageTitle('Nail Biting and ADHD');
    expect(out).toBe('Nail Biting and ADHD' + BRAND);
    expect(out.length).toBeLessThanOrEqual(60);
  });

  it('drops the brand rather than cutting the title', () => {
    // 50 chars: fits alone, but not with the 14-char suffix.
    const title = 'Why Habit Tracking Apps Fail People Who Bite Nails';
    expect(title.length).toBeLessThanOrEqual(60);
    expect(buildPageTitle(title)).toBe(title);
  });

  it('never exceeds the budget', () => {
    const titles = [
      'Why Do People Bite Their Nails? The Psychology and Science Behind Onychophagia',
      'Habit Reversal Training for Nail Biting: A Complete Evidence-Based Guide',
      'The Real Health Risks of Nail Biting: What Onychophagia Does to Your Body',
    ];
    for (const t of titles) expect(buildPageTitle(t).length).toBeLessThanOrEqual(60);
  });

  // The regression: titles were cut at a fixed 45 chars, mid-word.
  it('never cuts a word in half', () => {
    const title = 'Why Do People Bite Their Nails? The Psychology and Science Behind Onychophagia';
    const out = buildPageTitle(title);
    const stem = out.slice(0, out.indexOf('…'));
    // The character following the kept text in the original must be a boundary.
    expect(title.charAt(stem.length)).toMatch(/\s|^$/);
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    expect(buildPageTitle('Nail Biting in Children: Causes, When to Worry, and How to Help Them Stop'))
      .not.toMatch(/[\s,;:.\-–—]…$/);
  });

  it('handles empty and whitespace-only input without throwing', () => {
    expect(buildPageTitle('')).toBe(BRAND);
    expect(buildPageTitle('   ')).toBe(BRAND);
  });
});
