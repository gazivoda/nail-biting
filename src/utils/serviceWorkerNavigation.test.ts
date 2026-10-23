import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NavigationRoute } from 'workbox-routing/NavigationRoute.js';

vi.mock('vite-plugin-pwa', async importOriginal => {
  const actual = await importOriginal<typeof import('vite-plugin-pwa')>();
  return { ...actual, VitePWA: vi.fn(actual.VitePWA) };
});

let navigation: NavigationRoute;

beforeAll(async () => {
  // Workbox runs in a worker; provide its global in this Node test.
  vi.stubGlobal('self', globalThis);
  vi.stubGlobal('__WB_DISABLE_DEV_LOGS', true);
  vi.stubEnv('VITE_BUILD_TARGET', 'web');

  // Observe the real plugin call so this exercises the options actually wired
  // into the web build, then use Workbox's real request matcher.
  const pwa = await import('vite-plugin-pwa');
  const pluginCall = vi.mocked(pwa.VitePWA);
  await import('../../vite.config');
  const workbox = pluginCall.mock.calls[0]?.[0]?.workbox;
  if (!workbox?.navigateFallback) throw new Error('Web build has no offline app shell');

  const { NavigationRoute } = await import('workbox-routing/NavigationRoute.js');
  navigation = new NavigationRoute(async () => new Response('offline app shell'), {
    allowlist: workbox.navigateFallbackAllowlist,
    denylist: workbox.navigateFallbackDenylist,
  });
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function matches(path: string, mode: RequestMode = 'navigate') {
  const url = new URL(path, 'https://stopbiting.today');
  const request = new Request(url);
  // Browsers set navigate; the Request constructor deliberately disallows it.
  Object.defineProperty(request, 'mode', { value: mode });
  return navigation.match({ url, request, sameOrigin: true, event: {} as Parameters<NavigationRoute['match']>[0]['event'] });
}

describe('web service-worker app shell navigation', () => {
  it.each(['/', '/?utm_source=newsletter', '/?next=%2Fblog#pricing'])(
    'keeps the root app entry available offline at %s',
    path => expect(matches(path)).toBe(true),
  );

  it.each([
    '/blog', '/blog?page=2', '/blog/how-to-stop-nail-biting',
    '/blog/arbitrary-future-article?utm_source=search',
    '/compare/ai-detection-apps', '/compare/arbitrary-future-comparison',
    '/solutions/for-desk-workers', '/pricing', '/about', '/editorial-policy',
    '/tools/nail-growth-timeline-calculator', '/not-a-real-page',
    '/api/auth/google', '/api/auth/callback?code=example', '/api',
    '/downloads/app.dmg', '/downloads', '/posts/article.json', '/posts',
    '/files/nail-biting-30-day-tracker.pdf',
  ])('leaves %s to its route-specific network response', path => {
    expect(matches(path)).toBe(false);
  });

  it('does not serve the HTML shell for a root data request', () => {
    expect(matches('/', 'cors')).toBe(false);
  });
});
