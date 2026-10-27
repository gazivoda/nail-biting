// The Google Analytics tag in index.html's <head>, run for real.
//
// Why this exists: the tag used to create window.gtag inside the `load` handler, while track()
// (src/utils/track.ts) does nothing when window.gtag is missing. Every funnel event fired before
// `load` (React effects, the pricing section's IntersectionObserver, an early click) was dropped,
// and GA4 showed a funnel of a few dozen events. These tests run the real inline script, taken out
// of the file, in a bare `node:vm` context. There is no jsdom in this repo and no new dependency is
// allowed, so the context is a hand-built window: just what the script touches (navigator,
// location, localStorage, document.createElement / head.appendChild, addEventListener).
//
// What the script promises:
//   1. The queue is live at once: window.dataLayer, the gtag stub, `js` and `config` are set up
//      synchronously (an array push, no network). Only the gtag.js download waits for `load`.
//   2. ?internal=1 marks this browser (localStorage sb_internal), ?internal=0 clears it; a marked
//      browser sends traffic_type=internal on `config`, which a GA4 data filter excludes. A normal
//      visitor's `config` call is exactly what it was before.
//   3. In an automated browser (navigator.webdriver === true) nothing is defined and nothing loads.
//   4. Storage may throw (blocked, private window); the tag must still work.

import { describe, it, expect, afterEach, vi } from 'vitest';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { track } from '../src/utils/track.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MEASUREMENT_ID = 'G-WXS5XX6ZV0';
const LOADER_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

/** The one inline <script> of a page that sets up Google Analytics. */
function analyticsScript(html, where) {
  const found = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1])
    .filter(body => body.includes('googletagmanager.com/gtag/js'));
  expect(found.length, `${where}: exactly one inline script sets up Google Analytics`).toBe(1);
  return found[0];
}

const sourceHtml = readFileSync(join(root, 'index.html'), 'utf8');
const snippet = analyticsScript(sourceHtml, 'index.html');

/** Run the snippet in a fresh fake browser. */
function boot({ search = '', stored, webdriver = false, storageThrows = false } = {}) {
  const store = new Map(stored === undefined ? [] : Object.entries(stored));
  const storageWrites = [];
  const appended = [];
  const listeners = {};
  const blocked = () => { throw new Error('SecurityError: storage is blocked'); };
  const localStorage = storageThrows
    ? { getItem: blocked, setItem: blocked, removeItem: blocked }
    : {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => { storageWrites.push(['set', key, value]); store.set(key, String(value)); },
        removeItem: key => { storageWrites.push(['remove', key]); store.delete(key); },
      };
  const win = {
    navigator: { webdriver },
    location: { search },
    localStorage,
    URLSearchParams,
    document: {
      head: { appendChild: el => { appended.push(el); } },
      createElement: () => ({}),
    },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  };
  win.window = win;   // so a bare `dataLayer` inside the stub resolves, as it does in a browser
  vm.createContext(win);
  vm.runInContext(snippet, win);
  return {
    win,
    store,
    storageWrites,
    appended,
    listeners,
    /** Everything pushed on the queue so far, as plain arrays. */
    queue: () => (win.dataLayer ? win.dataLayer.map(entry => Array.from(entry)) : undefined),
    fireLoad: () => (listeners.load ?? []).forEach(fn => fn()),
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('the analytics tag: events fired before the page has loaded', () => {
  it('queues a track() call made before `load` instead of dropping it', () => {
    const page = boot();
    vi.stubGlobal('window', page.win);
    track('pricing_view', 'landing');   // what the pricing section does at mount, long before `load`
    expect(page.queue().at(-1)).toEqual(['event', 'pricing_view', { source: 'landing' }]);
    expect(page.appended).toEqual([]);   // and gtag.js has still not been requested
  });

  it('sets up the queue synchronously: js, then config, with no network', () => {
    const page = boot();
    expect(typeof page.win.gtag).toBe('function');
    const queue = page.queue();
    expect(queue.map(entry => entry[0])).toEqual(['js', 'config']);
    expect(Object.prototype.toString.call(queue[0][1])).toBe('[object Date]');   // another realm's Date, so no instanceof
    expect(queue[1][1]).toBe(MEASUREMENT_ID);
    expect(page.appended).toEqual([]);
  });

  it('pushes `arguments` objects, which is the only form gtag.js executes', () => {
    const page = boot();
    page.win.gtag('event', 'x');
    for (const entry of page.win.dataLayer) expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
  });

  it('downloads gtag.js only once the page has loaded, and only once', () => {
    const page = boot();
    expect(page.listeners.load).toHaveLength(1);
    page.fireLoad();
    expect(page.appended).toHaveLength(1);
    expect(page.appended[0].src).toBe(LOADER_SRC);
    expect(page.appended[0].async).toBe(true);
  });

  it('keeps an event tracked before `load` ahead of the loader, in order', () => {
    const page = boot();
    vi.stubGlobal('window', page.win);
    track('trial_click', 'landing_hero');
    page.fireLoad();
    track('demo_start');
    const events = page.queue().filter(entry => entry[0] === 'event').map(entry => entry[1]);
    expect(events).toEqual(['trial_click', 'demo_start']);
  });
});

describe('the analytics tag: normal visitors', () => {
  it('send config exactly as before: the id and nothing else', () => {
    const page = boot();
    const config = page.queue().find(entry => entry[0] === 'config');
    expect(config).toHaveLength(2);
    expect(page.storageWrites).toEqual([]);   // reading is fine, but nothing is ever written for a visitor
  });

  it('are not changed by an unrelated query string, or an unknown value for internal', () => {
    for (const search of ['?utm_source=x&ref=y', '?internal=yes', '?internal=', '?internal=2']) {
      const page = boot({ search });
      expect(page.queue().find(entry => entry[0] === 'config'), search).toHaveLength(2);
      expect(page.storageWrites, search).toEqual([]);
    }
  });
});

describe('the analytics tag: ?internal=1 and ?internal=0', () => {
  it('?internal=1 stores the flag and sends traffic_type=internal on config', () => {
    const page = boot({ search: '?internal=1' });
    expect(page.store.get('sb_internal')).toBe('1');
    expect(page.queue().find(entry => entry[0] === 'config')).toEqual(['config', MEASUREMENT_ID, { traffic_type: 'internal' }]);
  });

  it('keeps the browser marked on later visits, with no query string', () => {
    const page = boot({ stored: { sb_internal: '1' } });
    expect(page.queue().find(entry => entry[0] === 'config')).toEqual(['config', MEASUREMENT_ID, { traffic_type: 'internal' }]);
    expect(page.storageWrites).toEqual([]);
  });

  it('?internal=0 removes the flag and sends the plain config', () => {
    const page = boot({ search: '?internal=0', stored: { sb_internal: '1' } });
    expect(page.store.has('sb_internal')).toBe(false);
    expect(page.queue().find(entry => entry[0] === 'config')).toHaveLength(2);
  });

  it('finds the parameter among others', () => {
    const page = boot({ search: '?utm_source=x&internal=1&ref=y' });
    expect(page.store.get('sb_internal')).toBe('1');
  });

  it('does not tag the events themselves: the mark rides on config only', () => {
    const page = boot({ search: '?internal=1' });
    vi.stubGlobal('window', page.win);
    track('demo_complete', 'caught');
    expect(page.queue().at(-1)).toEqual(['event', 'demo_complete', { source: 'caught' }]);
  });
});

describe('the analytics tag: storage that throws', () => {
  it('still sets everything up, as a normal visitor', () => {
    const page = boot({ storageThrows: true });
    expect(typeof page.win.gtag).toBe('function');
    expect(page.queue().find(entry => entry[0] === 'config')).toHaveLength(2);
    page.fireLoad();
    expect(page.appended).toHaveLength(1);
  });

  it('?internal=1 still marks this visit even though the flag cannot be saved', () => {
    const page = boot({ search: '?internal=1', storageThrows: true });
    expect(page.queue().find(entry => entry[0] === 'config')).toEqual(['config', MEASUREMENT_ID, { traffic_type: 'internal' }]);
  });
});

describe('the analytics tag: automated browsers', () => {
  it('defines nothing, loads nothing and listens for nothing when navigator.webdriver is true', () => {
    const page = boot({ webdriver: true, search: '?internal=1' });
    expect(page.win.gtag).toBeUndefined();
    expect(page.win.dataLayer).toBeUndefined();
    expect(page.listeners).toEqual({});
    expect(page.appended).toEqual([]);
    expect(page.storageWrites).toEqual([]);
  });

  it('leaves track() a harmless no-op there', () => {
    const page = boot({ webdriver: true });
    vi.stubGlobal('window', page.win);
    expect(() => track('pricing_view', 'landing')).not.toThrow();
    expect(page.win.dataLayer).toBeUndefined();
  });

  it('treats only a literal true as automation', () => {
    for (const webdriver of [false, undefined]) {
      expect(typeof boot({ webdriver }).win.gtag, String(webdriver)).toBe('function');
    }
  });
});

// The build copies the inline script through untouched; a minifier that rewrote it would be news.
// Skipped when there is no build: `npm run build:web` first, and read the skipped count.
describe.skipIf(!existsSync(join(root, 'dist', 'index.html')))('the built shell', () => {
  it('carries the same analytics script as index.html', () => {
    const built = analyticsScript(readFileSync(join(root, 'dist', 'index.html'), 'utf8'), 'dist/index.html');
    expect(built.replace(/\s+/g, ' ').trim()).toBe(snippet.replace(/\s+/g, ' ').trim());
  });
});

// The demo funnel. Landing mounts `<HeroDemo autoStart />` from the visitor's click, so the first session of
// a visit begins in the reducer's initial state and never calls HeroDemo's `start`. `demo_start` used to be
// tracked inside `start`, so it fired only for "Run it again" and "Try again" (GA4 showed 1 start for
// the whole period). A component render is out of reach here (no DOM), so these read the source; the
// phase rule itself is specified in src/components/demo/demoSession.test.ts.
describe('the demo funnel: demo_start counts every session, including the autoStart one', () => {
  const strip = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const demo = strip(readFileSync(join(root, 'src/components/demo/HeroDemo.tsx'), 'utf8'));

  it('the landing page really does start the demo without going through start()', () => {
    expect(strip(readFileSync(join(root, 'src/pages/Landing.tsx'), 'utf8'))).toMatch(/<HeroDemo autoStart\s*\/>/);
  });

  it('start() does not count the session', () => {
    const body = demo.match(/const start = useCallback\(([\s\S]*?)\n {2}\}, \[\]\);/);
    expect(body, 'found the start callback').not.toBeNull();
    expect(body[1]).not.toMatch(/track\(/);
  });

  it('the session is counted when the phase becomes running', () => {
    expect(demo).toMatch(/useEffect\(\(\) => \{\s*if \(state\.phase === 'running'\) track\('demo_start'\);\s*\}, \[state\.phase\]\);/);
    expect(demo.match(/track\('demo_start'/g)).toHaveLength(1);
  });
});
