// "No photo data appears in any network request", checked the direct way: every network
// API the page has is replaced by a spy that throws, and the whole diary lifecycle is run
// through the real code (capture, save, list, view, compare, delete, delete all). No spy
// may be touched. (A guard test in scripts/photoGuard.test.mjs checks the source too, and
// the real-browser run recorded every request Chrome made; see docs/agents/ws5-notes.md.)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryBlobStore, setBlobStoreForTests, localBlobs } from '../storage/blobs';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { createCaptureController } from './captureController';
import { createPhotoStore } from './photoStore';
import { kvMetaPort } from './metaKv';
import { defaultComparePair, type PhotoMeta } from './diaryMeta';
import { PhotoDiaryView } from './PhotoDiaryView';
import { CapturePanelView } from './CapturePanelView';
import { PhotoReminderView } from './PhotoReminder';
import { PhotoDiarySettingsView } from './PhotoDiarySettingsCard';

const calls: string[] = [];
const spy = (name: string) => () => {
  calls.push(name);
  throw new Error(`network API used: ${name}`);
};
class SpyClass {
  constructor(public readonly kind: string) {
    calls.push(kind);
    throw new Error(`network API used: ${kind}`);
  }
}

const restore: (() => void)[] = [];
function installSpies() {
  vi.stubGlobal('fetch', spy('fetch'));
  vi.stubGlobal('XMLHttpRequest', class { constructor() { new SpyClass('XMLHttpRequest'); } });
  vi.stubGlobal('WebSocket', class { constructor() { new SpyClass('WebSocket'); } });
  vi.stubGlobal('EventSource', class { constructor() { new SpyClass('EventSource'); } });
  vi.stubGlobal('Image', class { constructor() { new SpyClass('Image'); } });
  vi.stubGlobal('Request', class { constructor() { new SpyClass('Request'); } });
  const nav = (globalThis as { navigator?: object }).navigator;
  if (nav) {
    const had = Object.getOwnPropertyDescriptor(nav, 'sendBeacon');
    Object.defineProperty(nav, 'sendBeacon', { value: spy('sendBeacon'), configurable: true, writable: true });
    restore.push(() => {
      if (had) Object.defineProperty(nav, 'sendBeacon', had);
      else delete (nav as { sendBeacon?: unknown }).sendBeacon;
    });
  }
}

beforeEach(() => {
  calls.length = 0;
  setStorageAdapter(createMemoryAdapter());
  setBlobStoreForTests(createMemoryBlobStore());
  installSpies();
});
afterEach(() => {
  vi.unstubAllGlobals();
  while (restore.length) restore.pop()!();
  setBlobStoreForTests(null);
  resetStorage();
});

const jpegBytes = (seed: number) => new Blob([new Uint8Array(64).fill(seed), 'JFIF-fake-photo-bytes'], { type: 'image/jpeg' });

describe('the spies are live (so a silent pass means something)', () => {
  it('fetch, XHR, beacon, sockets and Image all trip', () => {
    expect(() => (globalThis.fetch as unknown as () => void)()).toThrow();
    expect(() => new (globalThis as unknown as { XMLHttpRequest: new () => void }).XMLHttpRequest()).toThrow();
    expect(() => new (globalThis as unknown as { WebSocket: new () => void }).WebSocket()).toThrow();
    expect(() => new (globalThis as unknown as { EventSource: new () => void }).EventSource()).toThrow();
    expect(() => new (globalThis as unknown as { Image: new () => void }).Image()).toThrow();
    const nav = (globalThis as { navigator?: { sendBeacon?: () => void } }).navigator;
    if (nav?.sendBeacon) expect(() => nav.sendBeacon!()).toThrow();
    expect(calls.length).toBeGreaterThanOrEqual(5);
    calls.length = 0;
  });
});

describe('the diary lifecycle touches no network API', () => {
  it('capture -> save -> list -> view -> compare -> delete one -> delete all', async () => {
    const store = createPhotoStore({
      blobs: localBlobs, meta: kvMetaPort, now: () => Date.now(), newId: (() => { let n = 0; return () => `p${++n}`; })(), isPersistent: () => true,
    });
    let seed = 0;
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];

    // Capture, twice, through the real controller with a fake camera and encoder.
    for (let i = 0; i < 2; i++) {
      const controller = createCaptureController<{ getTracks(): { stop(): void }[] }, string>({
        openCamera: async () => ({ getTracks: () => tracks }),
        encode: async () => ({ blob: jpegBytes(++seed), width: 640, height: 480 }),
        save: frame => store.add({ blob: frame.blob, width: frame.width, height: frame.height, takenAt: Date.now() - (2 - i) * 8 * 86_400_000 }),
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: h => clearTimeout(h as ReturnType<typeof setTimeout>),
        isWatching: () => false,
      });
      await controller.start();
      await controller.takeNow('video');
      await controller.save();
      expect(controller.getState().phase).toBe('saved');
      controller.dispose();
    }
    expect(tracks.every(t => t.stop.mock.calls.length >= 2)).toBe(true);

    // List and view: read the bytes back the way PhotoCanvas does (the decode itself is the browser's).
    const photos = await store.load();
    expect(photos).toHaveLength(2);
    for (const p of photos) {
      const blob = await store.getBlob(p.id);
      expect(blob).not.toBeNull();
      expect((await blob!.arrayBuffer()).byteLength).toBeGreaterThan(64);
    }

    // Compare: the pair, and both sides' bytes.
    const pair = defaultComparePair(photos)!;
    expect(await store.getBlob(pair.beforeId)).not.toBeNull();
    expect(await store.getBlob(pair.afterId)).not.toBeNull();

    // Every screen renders with them.
    const noop = () => undefined;
    const view = (list: PhotoMeta[]) => renderToStaticMarkup(
      <PhotoDiaryView photos={list} persistent now={Date.now()} status="" capture={null} loadBlob={id => store.getBlob(id)}
        onStartCapture={noop} onDeleteOne={noop} onDeleteAll={noop} />,
    );
    expect(view(photos)).toContain('Before and after');
    expect(renderToStaticMarkup(<PhotoReminderView lastPhotoAge="9 days ago" onOpen={noop} onSnooze={noop} />)).toContain('9 days ago');
    expect(renderToStaticMarkup(<PhotoDiarySettingsView photos={photos} status="" onDeleteAll={noop} />)).toContain('2 photos saved');
    expect(renderToStaticMarkup(
      <CapturePanelView state={{ phase: 'idle' }} onStart={noop} onTakeNow={noop} onTakeInSeconds={noop} onCancelCountdown={noop}
        onRetake={noop} onSave={noop} onClose={noop} onStopWatchingAndRetry={noop} />,
    )).toContain('Start the camera');

    // Delete.
    expect(await store.remove(photos[0].id)).toBe(true);
    expect(store.list()).toHaveLength(1);
    expect(await store.removeAll()).toBe(1);
    expect(await localBlobs.keys('photo-diary')).toEqual([]);

    expect(calls).toEqual([]);
  });

  it('loading the remaining diary modules (the ones not imported above) touches no network API either', async () => {
    const mods = await Promise.all([
      import('./photoStore'), import('./captureController'), import('./diaryMeta'), import('./metaKv'),
      import('./cameraProblem'), import('./PhotoDiary'), import('./PhotoReminder'), import('./PhotoDiarySettings'),
    ]);
    expect(mods.length).toBe(8);
    expect(calls).toEqual([]);
  });
});
