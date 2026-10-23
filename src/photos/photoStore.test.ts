import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryBlobStore, setBlobStoreForTests, localBlobs, type BlobStore } from '../storage/blobs';
import { setStorageAdapter } from '../storage/adapter';
import { kv } from '../storage/kv';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { MAX_PHOTOS, PHOTO_COLLECTION, parseMeta, serializeMeta, type PhotoMeta } from './diaryMeta';
import { createPhotoStore, FULL_MESSAGE, WRITE_FAILED_MESSAGE, type PhotoStorePorts } from './photoStore';
import { kvMetaPort, readSnoozedUntil, snoozeReminder, type MetaPort } from './metaKv';

const jpeg = (n = 1000) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' });

function harness(over: Partial<PhotoStorePorts> = {}) {
  const blobs = createMemoryBlobStore();
  let records: PhotoMeta[] = [];
  const writes: PhotoMeta[][] = [];
  let failMetaWrite = false;
  const listeners = new Set<() => void>();
  const meta: MetaPort = {
    read: () => parseMeta(serializeMeta(records)),
    write: photos => {
      if (failMetaWrite) return false;
      records = [...photos];
      writes.push([...photos]);
      listeners.forEach(fn => fn());
      return true;
    },
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  let clock = 1_000_000;
  let n = 0;
  const state = { persistent: true };
  const store = createPhotoStore({
    blobs, meta, now: () => clock, newId: () => `id${++n}`, isPersistent: () => state.persistent, ...over,
  });
  return {
    store, blobs, meta, state, writes,
    setClock: (t: number) => { clock = t; },
    failMetaWrites: (v: boolean) => { failMetaWrite = v; },
    records: () => records,
    listeners,
  };
}

describe('photoStore.add', () => {
  it('stores bytes in the photo collection and a record beside them', async () => {
    const h = harness();
    const r = await h.store.add({ blob: jpeg(1234), width: 1280, height: 720 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.photo).toEqual({ id: 'id1', takenAt: 1_000_000, width: 1280, height: 720, bytes: 1234 });
    expect(r.persisted).toBe(true);
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual(['id1']);
    expect(h.store.list()).toEqual([r.photo]);
  });

  it('uses the capture time when one is given', async () => {
    const h = harness();
    const r = await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 42 });
    expect(r.ok && r.photo.takenAt).toBe(42);
  });

  it('lists newest first', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 100 });
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 300 });
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 200 });
    expect(h.store.list().map(p => p.takenAt)).toEqual([300, 200, 100]);
  });

  it('removes the bytes again if the record cannot be written (no orphan)', async () => {
    const h = harness();
    h.failMetaWrites(true);
    const r = await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    expect(r).toEqual({ ok: false, reason: 'write-failed', message: WRITE_FAILED_MESSAGE });
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual([]);
    expect(h.records()).toEqual([]);
  });

  it('reports a refused byte write without leaving a record', async () => {
    const refusing: Pick<BlobStore, 'put' | 'get' | 'delete' | 'keys' | 'clear'> = { ...createMemoryBlobStore(), put: async () => false };
    const h = harness({ blobs: refusing });
    const r = await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    expect(r.ok).toBe(false);
    expect(h.records()).toEqual([]);
  });

  it(`holds ${MAX_PHOTOS} photos and then says so, plainly, without dropping any`, async () => {
    const h = harness();
    for (let i = 0; i < MAX_PHOTOS; i++) {
      const r = await h.store.add({ blob: jpeg(10), width: 4, height: 3, takenAt: i + 1 });
      expect(r.ok).toBe(true);
    }
    const over = await h.store.add({ blob: jpeg(10), width: 4, height: 3 });
    expect(over).toEqual({ ok: false, reason: 'full', message: FULL_MESSAGE });
    expect(h.store.list()).toHaveLength(MAX_PHOTOS);
    expect((await h.blobs.keys(PHOTO_COLLECTION)).length).toBe(MAX_PHOTOS);
    // Room again after one delete.
    await h.store.remove('id1');
    expect((await h.store.add({ blob: jpeg(10), width: 4, height: 3 })).ok).toBe(true);
  });

  it('tells the caller when the bytes only live in memory', async () => {
    const h = harness();
    h.state.persistent = false;
    const r = await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    expect(r.ok && r.persisted).toBe(false);
  });

  it('two quick adds both land, in order (writes are serialised)', async () => {
    const h = harness();
    const [a, b] = await Promise.all([
      h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 1 }),
      h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 2 }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(h.store.list().map(p => p.id).sort()).toEqual(['id1', 'id2']);
  });
});

describe('photoStore.remove and removeAll', () => {
  it('removes the record and the bytes of one photo, and says false for an unknown id', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 1 });
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 2 });
    expect(await h.store.remove('id1')).toBe(true);
    expect(await h.store.remove('id1')).toBe(false);
    expect(h.store.list().map(p => p.id)).toEqual(['id2']);
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual(['id2']);
    expect(await h.store.getBlob('id1')).toBeNull();
  });

  it('removeAll empties both and returns how many there were', async () => {
    const h = harness();
    for (let i = 0; i < 3; i++) await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: i });
    expect(await h.store.removeAll()).toBe(3);
    expect(h.store.list()).toEqual([]);
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual([]);
    expect(await h.store.removeAll()).toBe(0);
  });

  it('only ever touches its own collection', async () => {
    const h = harness();
    await h.blobs.put('somebody-else', 'keep', jpeg());
    await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    await h.store.removeAll();
    expect(await h.blobs.keys('somebody-else')).toEqual(['keep']);
  });

  it('notifies subscribers when the list changes', async () => {
    const h = harness();
    let calls = 0;
    const off = h.store.subscribe(() => { calls++; });
    await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    await h.store.remove('id1');
    off();
    await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    expect(calls).toBe(2);
  });
});

describe('photoStore.load: records and bytes stay consistent', () => {
  it('drops a record whose bytes are gone', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 1 });
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 2 });
    await h.blobs.delete(PHOTO_COLLECTION, 'id1');
    const list = await h.store.load();
    expect(list.map(p => p.id)).toEqual(['id2']);
    expect(h.records().map(p => p.id)).toEqual(['id2']); // the record was cleaned up too
  });

  it('deletes bytes that have no record', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    await h.blobs.put(PHOTO_COLLECTION, 'stray', jpeg());
    expect((await h.store.load()).map(p => p.id)).toEqual(['id1']);
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual(['id1']);
  });

  it('writes nothing when everything already agrees', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3 });
    const before = h.writes.length;
    await h.store.load();
    await h.store.load();
    expect(h.writes.length).toBe(before);
  });

  it('while the blob store is only memory (IndexedDB failed), it hides records without bytes but does not erase them', async () => {
    const h = harness();
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 1 });
    await h.store.add({ blob: jpeg(), width: 4, height: 3, takenAt: 2 });
    // IndexedDB "failed": the store fell back to an empty memory store.
    await h.blobs.clear(PHOTO_COLLECTION);
    await h.blobs.put(PHOTO_COLLECTION, 'only-in-memory', jpeg());
    h.state.persistent = false;
    expect(await h.store.load()).toEqual([]);
    expect(h.records().map(p => p.id).sort()).toEqual(['id1', 'id2']); // still there for when IndexedDB works again
    expect(await h.blobs.keys(PHOTO_COLLECTION)).toEqual(['only-in-memory']); // and no stray deleted either
  });
});

describe('the real wiring: kv for records, the local blob store for bytes', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
    setBlobStoreForTests(createMemoryBlobStore());
  });
  afterEach(() => {
    resetStorage();
    setBlobStoreForTests(null);
  });

  it('records go to kv(insights, photo-diary); bytes go to localBlobs; nothing else is written', async () => {
    const store = createPhotoStore({
      blobs: localBlobs, meta: kvMetaPort, now: () => 5000, newId: () => 'real1', isPersistent: () => true,
    });
    const r = await store.add({ blob: jpeg(321), width: 640, height: 480 });
    expect(r.ok).toBe(true);
    expect(await localBlobs.keys(PHOTO_COLLECTION)).toEqual(['real1']);
    const stored = kv.get<{ v: number; photos: PhotoMeta[] }>('insights', 'photo-diary', { v: 0, photos: [] });
    expect(stored).toEqual({ v: 1, photos: [{ id: 'real1', takenAt: 5000, width: 640, height: 480, bytes: 321 }] });
    expect(kv.keys('insights')).toEqual(['photo-diary']);
    // The record holds no image data of any kind.
    expect(JSON.stringify(stored)).not.toMatch(/data:|base64|blob:/);
  });

  it('the reminder snooze is a number in kv', () => {
    expect(readSnoozedUntil()).toBeNull();
    snoozeReminder(1000);
    expect(readSnoozedUntil()).toBe(1000 + 24 * 60 * 60 * 1000);
    kv.set('insights', 'photo-reminder-snooze', 'junk');
    expect(readSnoozedUntil()).toBeNull();
  });
});
