// The photo diary's storage layer (WS5). Bytes go ONLY to the local blob store
// (IndexedDB, src/storage/blobs.ts: it has no upload, export or URL helper); the
// small metadata record goes to kv. Nothing here touches the network, and
// scripts/photoGuard.test.mjs keeps it that way.
//
// Everything is injected (blob store, metadata port, clock, id source, "is storage
// really persistent"), so node tests run the whole thing with no DOM.
//
// Consistency rules
//  - add: bytes first, then metadata; if the metadata write fails the bytes are removed again.
//  - remove / removeAll: metadata first (the UI updates at once), then the bytes.
//  - load: a record whose bytes are gone is dropped, and bytes with no record are deleted. That
//    clean-up only happens while the blob store is really IndexedDB. If IndexedDB failed and the
//    store fell back to memory, `keys()` is empty for the wrong reason, and "fixing" the records
//    then would erase photos that are still on disk; the list is just filtered for this page load.
//  - All writes run one after another, so two quick taps cannot interleave.

import type { BlobStore } from '../storage/blobs';
import { blobStorageStatus, localBlobs } from '../storage/blobs';
import { MAX_PHOTOS, PHOTO_COLLECTION, type PhotoMeta } from './diaryMeta';
import { kvMetaPort, type MetaPort } from './metaKv';

export interface PhotoStorePorts {
  blobs: Pick<BlobStore, 'put' | 'get' | 'delete' | 'keys' | 'clear'>;
  meta: MetaPort;
  now: () => number;
  newId: () => string;
  /** True while the blob store really is IndexedDB (read AFTER a blob call: a failure flips it). */
  isPersistent: () => boolean;
}

export type AddFailure = 'full' | 'write-failed';
export type AddResult =
  | { ok: true; photo: PhotoMeta; /** false when the bytes only live in memory for this tab */ persisted: boolean }
  | { ok: false; reason: AddFailure; message: string };

export interface NewPhoto {
  blob: Blob;
  width: number;
  height: number;
  takenAt?: number;
}

export const FULL_MESSAGE = `The diary holds ${MAX_PHOTOS} photos. Delete some older ones to add more.`;
export const WRITE_FAILED_MESSAGE = 'This browser would not save the photo. Free up space or try again.';

export function createPhotoStore(ports: PhotoStorePorts) {
  let chain: Promise<unknown> = Promise.resolve();
  /** Runs `fn` after every earlier write has finished, whether it worked or not. */
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };

  return {
    /** The records as stored, newest first. Synchronous; not checked against the bytes (see load). */
    list(): PhotoMeta[] {
      return ports.meta.read();
    },

    /** The records whose bytes exist, newest first, after the clean-up described above. */
    load(): Promise<PhotoMeta[]> {
      return serial(async () => {
        const records = ports.meta.read();
        const keys = new Set(await ports.blobs.keys(PHOTO_COLLECTION));
        const persistent = ports.isPersistent();
        const present = records.filter(r => keys.has(r.id));
        if (!persistent) return present;
        if (present.length !== records.length) ports.meta.write(present);
        const known = new Set(records.map(r => r.id));
        for (const key of keys) if (!known.has(key)) await ports.blobs.delete(PHOTO_COLLECTION, key);
        return present;
      });
    },

    add(photo: NewPhoto): Promise<AddResult> {
      return serial(async () => {
        const records = ports.meta.read();
        if (records.length >= MAX_PHOTOS) return { ok: false, reason: 'full', message: FULL_MESSAGE } as const;
        const id = ports.newId();
        const stored = await ports.blobs.put(PHOTO_COLLECTION, id, photo.blob);
        if (!stored) return { ok: false, reason: 'write-failed', message: WRITE_FAILED_MESSAGE } as const;
        const meta: PhotoMeta = {
          id,
          takenAt: photo.takenAt ?? ports.now(),
          width: photo.width,
          height: photo.height,
          bytes: photo.blob.size,
        };
        if (!ports.meta.write([meta, ...records])) {
          await ports.blobs.delete(PHOTO_COLLECTION, id);
          return { ok: false, reason: 'write-failed', message: WRITE_FAILED_MESSAGE } as const;
        }
        return { ok: true, photo: meta, persisted: ports.isPersistent() } as const;
      });
    },

    /** The photo's bytes, or null. For drawing; there is deliberately no URL helper. */
    getBlob(id: string): Promise<Blob | null> {
      return ports.blobs.get(PHOTO_COLLECTION, id);
    },

    /** Deletes one photo (record, then bytes). False when there was no such photo. */
    remove(id: string): Promise<boolean> {
      return serial(async () => {
        const records = ports.meta.read();
        if (!records.some(r => r.id === id)) return false;
        ports.meta.write(records.filter(r => r.id !== id));
        await ports.blobs.delete(PHOTO_COLLECTION, id);
        return true;
      });
    },

    /** Deletes every photo and returns how many records there were. */
    removeAll(): Promise<number> {
      return serial(async () => {
        const count = ports.meta.read().length;
        ports.meta.write([]);
        await ports.blobs.clear(PHOTO_COLLECTION);
        return count;
      });
    },

    subscribe(fn: () => void): () => void {
      return ports.meta.subscribe(fn);
    },

    /** Whether photos are written to disk (IndexedDB) or only held in memory for this tab. */
    persistent(): boolean {
      return ports.isPersistent();
    },
  };
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** The store the app uses: real blob store, real kv, real clock. */
export const photoStore: PhotoStore = createPhotoStore({
  blobs: localBlobs,
  meta: kvMetaPort,
  now: () => Date.now(),
  newId: randomId,
  isPersistent: () => blobStorageStatus().persistent,
});
