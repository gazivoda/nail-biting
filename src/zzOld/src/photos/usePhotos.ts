// React glue: the diary's photo list as state. Reads the metadata from kv, checks it
// against the stored bytes once (photoStore.load), and updates when any screen (the
// diary, the Settings card, the reminder) changes the list.

import { useEffect, useState } from 'react';
import type { PhotoMeta } from './diaryMeta';
import { subscribePhotoMeta } from './metaKv';
import { photoStore } from './photoStore';

export interface PhotosState {
  /** null until the first read finishes. */
  photos: readonly PhotoMeta[] | null;
  persistent: boolean;
  /** The time of the last read; "9 days ago" labels are worked out from it. */
  now: number;
}

/** The checked list (records whose bytes exist). Opens the local blob store. */
export function usePhotos(): PhotosState {
  const [state, setState] = useState<PhotosState>(() => ({ photos: null, persistent: true, now: Date.now() }));

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void photoStore.load().then(photos => {
        if (alive) setState({ photos, persistent: photoStore.persistent(), now: Date.now() });
      });
    };
    refresh();
    const off = subscribePhotoMeta(refresh);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return state;
}
