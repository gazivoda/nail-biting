import { describe, it, expect, vi, afterEach } from 'vitest';
import { track } from './track';

afterEach(() => vi.unstubAllGlobals());

describe('track', () => {
  it('sends the named event to gtag when it is loaded', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    track('trial_click');
    expect(gtag).toHaveBeenCalledWith('event', 'trial_click');
  });

  it('does nothing when gtag has not loaded', () => {
    vi.stubGlobal('window', {});
    expect(() => track('demo_start')).not.toThrow();
  });

  it('swallows a throwing gtag', () => {
    vi.stubGlobal('window', { gtag: () => { throw new Error('boom'); } });
    expect(() => track('demo_start')).not.toThrow();
  });
});
