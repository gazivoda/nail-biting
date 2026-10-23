import { describe, it, expect, beforeEach } from 'vitest';
import { parseQuickAction, resetQuickActionForTests, takeQuickAction, withoutAction } from './quickAction';

describe('quick actions (home-screen shortcuts)', () => {
  beforeEach(resetQuickActionForTests);

  it('reads bite and urge, nothing else', () => {
    expect(parseQuickAction('?action=bite')).toBe('bite');
    expect(parseQuickAction('?action=urge')).toBe('urge');
    expect(parseQuickAction('?action=delete')).toBeNull();
    expect(parseQuickAction('?action=')).toBeNull();
    expect(parseQuickAction('')).toBeNull();
    expect(parseQuickAction('?preview=trial')).toBeNull();
  });

  it('removes only `action` from the address', () => {
    expect(withoutAction('/', '?action=bite', '')).toBe('/');
    expect(withoutAction('/', '?utm_source=x&action=urge', '#top')).toBe('/?utm_source=x#top');
  });

  it('acts once per page load and rewrites the address', () => {
    const urls: string[] = [];
    const history = { replaceState: (_d: unknown, _u: string, url: string) => { urls.push(url); } };
    const loc = { pathname: '/', search: '?action=bite', hash: '' };
    expect(takeQuickAction(loc, history)).toBe('bite');
    expect(urls).toEqual(['/']);
    // React StrictMode runs the effect twice in development; a second look must find nothing to do.
    expect(takeQuickAction(loc, history)).toBeNull();
    expect(urls).toEqual(['/']);
  });

  it('still acts once if the address cannot be rewritten', () => {
    const history = { replaceState: () => { throw new Error('blocked'); } };
    const loc = { pathname: '/', search: '?action=urge', hash: '' };
    expect(takeQuickAction(loc, history)).toBe('urge');
    expect(takeQuickAction(loc, history)).toBeNull();
  });

  it('ignores an address with no action and does not use up the one chance', () => {
    const history = { replaceState: () => { throw new Error('must not rewrite'); } };
    expect(takeQuickAction({ pathname: '/', search: '', hash: '' }, history)).toBeNull();
    expect(takeQuickAction({ pathname: '/', search: '?action=bite', hash: '' }, { replaceState: () => {} })).toBe('bite');
  });
});
