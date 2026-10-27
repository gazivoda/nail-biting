// What the page says about the plans when it has no marker (a visitor served the cached app shell): the app's own last answer
// says the flag is on, and the words follow the CARD, which also needs the price id the build was given. A page that has a
// marker needs no such help: the server already judged (flag AND its own price id), and its schema says the same.

import { afterEach, describe, expect, it, vi } from 'vitest';

const TWO = 'When the trial ends, pick the monthly or yearly plan to keep going.';
const THREE = 'When the trial ends, pick the monthly, yearly or Lifetime plan to keep going.';

/** The sentence after `useFlagCopy`, in a fresh module graph, for a build with (or without) the Lifetime price id. */
async function sentence({ buildId, heard, marker }: { buildId: string; heard: Record<string, boolean>; marker?: string }): Promise<string> {
  vi.resetModules();
  vi.stubEnv('VITE_PADDLE_PRICE_ID_LIFETIME', buildId);
  if (marker !== undefined) {
    vi.stubGlobal('document', { querySelector: (s: string) => (s === 'meta[name="sb-copy-flags"]' ? { getAttribute: () => marker } : null) });
  }
  const [{ createElement }, { renderToStaticMarkup }, { kv }, { useFlagCopy }] = await Promise.all([
    import('react'), import('react-dom/server'), import('../storage/kv'), import('./useFlagCopy'),
  ]);
  kv.set('flags', 'last-known', { at: Date.now(), flags: heard });
  function Probe() {
    const copy = useFlagCopy();
    return createElement('p', null, copy(TWO));
  }
  return renderToStaticMarkup(createElement(Probe)).replace(/<\/?p>/g, '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('useFlagCopy and the Lifetime plan', () => {
  it('says two plans with every flag off, and when nothing is known', async () => {
    expect(await sentence({ buildId: 'pri_build', heard: {} })).toBe(TWO);
    expect(await sentence({ buildId: '', heard: {} })).toBe(TWO);
  });

  it('with no marker follows the app\'s answer, but only for a build that has the price id (the card needs it too)', async () => {
    expect(await sentence({ buildId: 'pri_build', heard: { lifetime_plan: true } })).toBe(THREE);
    expect(await sentence({ buildId: '', heard: { lifetime_plan: true } })).toBe(TWO);
  });

  it('with a marker is told by the server alone: listed means Lifetime, unlisted means two plans', async () => {
    expect(await sentence({ buildId: 'pri_build', heard: {}, marker: 'lifetime_plan' })).toBe(THREE);
    expect(await sentence({ buildId: 'pri_build', heard: { lifetime_plan: true }, marker: 'event_sync' })).toBe(TWO);
  });
});
