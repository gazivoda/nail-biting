// The diary's records as React state, without the blob store: enough for a count, a size
// or the weekly reminder. Reads kv only, so no IndexedDB is opened and no photo bytes are
// reachable from this module (PhotoReminder and the Settings card use it).

import { useEffect, useState } from 'react';
import type { PhotoMeta } from './diaryMeta';
import { readPhotoMeta, subscribePhotoMeta } from './metaKv';

/**
 * The records only (no check against the bytes, no blob store opened): enough for
 * a count, a size or the reminder.
 */
export function usePhotoRecords(): { photos: readonly PhotoMeta[]; now: number } {
  const [state, setState] = useState(() => ({ photos: readPhotoMeta() as readonly PhotoMeta[], now: Date.now() }));
  useEffect(() => {
    const off = subscribePhotoMeta(() => setState({ photos: readPhotoMeta(), now: Date.now() }));
    return off;
  }, []);
  return state;
}
