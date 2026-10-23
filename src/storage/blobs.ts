// LOCAL-ONLY binary storage (IndexedDB), for things that must never leave the
// device. The first user is the WS5 nail-photo diary. Nothing in src/ uploads
// from this store, and nothing should: there is deliberately no export, sync or
// "get a URL to upload" helper here. If a feature needs bytes to go over the
// network, it does not belong in this module.
//
// Never throws. When IndexedDB is missing or refuses to open (private windows,
// blocked site data, node tests) it falls back to memory for this page load and
// `blobStorageStatus().persistent` is false, so a UI can say "not saved".

export interface BlobStore {
  put(collection: string, key: string, blob: Blob): Promise<boolean>;
  get(collection: string, key: string): Promise<Blob | null>;
  delete(collection: string, key: string): Promise<void>;
  keys(collection: string): Promise<string[]>;
  clear(collection: string): Promise<void>;
}

export function createMemoryBlobStore(): BlobStore {
  const map = new Map<string, Blob>();
  const id = (c: string, k: string) => `${c}/${k}`;
  return {
    async put(c, k, blob) { map.set(id(c, k), blob); return true; },
    async get(c, k) { return map.get(id(c, k)) ?? null; },
    async delete(c, k) { map.delete(id(c, k)); },
    async keys(c) {
      const p = `${c}/`;
      return [...map.keys()].filter(x => x.startsWith(p)).map(x => x.slice(p.length));
    },
    async clear(c) {
      const p = `${c}/`;
      for (const x of [...map.keys()]) if (x.startsWith(p)) map.delete(x);
    },
  };
}

const DB_NAME = 'stop-biting-local-blobs';
const STORE = 'blobs';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** IndexedDB-backed store. Keys are `<collection>/<key>`; values are the Blob itself. */
export function createIdbBlobStore(factory: IDBFactory, dbName = DB_NAME): BlobStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(dbName, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('indexedDB open blocked')); };
  }));
  const id = (c: string, k: string) => `${c}/${k}`;
  const range = (c: string) => IDBKeyRange.bound(`${c}/`, `${c}/￿`);

  return {
    async put(c, k, blob) {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id(c, k));
      await done(tx);
      return true;
    },
    async get(c, k) {
      const db = await open();
      const v = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(id(c, k)));
      return v instanceof Blob ? v : null;
    },
    async delete(c, k) {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id(c, k));
      await done(tx);
    },
    async keys(c) {
      const db = await open();
      const all = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys(range(c)));
      const p = `${c}/`;
      return all.map(String).map(x => x.slice(p.length));
    },
    async clear(c) {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(range(c));
      await done(tx);
    },
  };
}

// ── The store the app uses ───────────────────────────────────────────────────

let persistent = false;
let backing: BlobStore | null = null;
let memory: BlobStore | null = null;

function memoryStore(): BlobStore {
  return (memory ??= createMemoryBlobStore());
}

function pick(): BlobStore {
  if (backing) return backing;
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (factory) {
    try {
      backing = createIdbBlobStore(factory);
      persistent = true;
      return backing;
    } catch { /* fall through to memory */ }
  }
  backing = memoryStore();
  persistent = false;
  return backing;
}

/** Runs against IndexedDB; if it fails once, switches to memory for the rest of the page load. */
async function guarded<T>(op: (s: BlobStore) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await op(pick());
  } catch {
    if (persistent) {
      persistent = false;
      backing = memoryStore();
      try { return await op(backing); } catch { return fallback; }
    }
    return fallback;
  }
}

/** Local-only blob storage. See the header: nothing here is ever uploaded. */
export const localBlobs: BlobStore = {
  put: (c, k, b) => guarded(s => s.put(c, k, b), false),
  get: (c, k) => guarded(s => s.get(c, k), null),
  delete: (c, k) => guarded(s => s.delete(c, k), undefined),
  keys: c => guarded(s => s.keys(c), []),
  clear: c => guarded(s => s.clear(c), undefined),
};

export function blobStorageStatus(): { persistent: boolean } {
  pick();
  return { persistent };
}

/** Tests only: replace the backing store (or pass null to re-detect). */
export function setBlobStoreForTests(store: BlobStore | null): void {
  backing = store;
  persistent = false;
}
