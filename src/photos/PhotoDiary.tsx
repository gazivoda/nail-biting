// The photo diary section of the Insights view (flag `photo_diary`; the Insights view
// decides whether to show it). Weekly photos of the person's HANDS, kept only in this
// browser's local storage, with a before/after slider. See PhotoDiaryView for the
// screen and photoStore.ts for where the bytes go.

import { useEffect, useRef, useState } from 'react';
import { CapturePanel, type SavedPhoto } from './CapturePanel';
import { PhotoDiaryView, TAKE_BUTTON_ID } from './PhotoDiaryView';
import { canDecodePhotos } from './drawBlob';
import { photoStore } from './photoStore';
import { usePhotos } from './usePhotos';
import { useT } from '../i18n/scopes/photos';

const loadBlob = (id: string) => photoStore.getBlob(id);

function focusTakeButton() {
  window.setTimeout(() => document.getElementById(TAKE_BUTTON_ID)?.focus(), 0);
}

export function PhotoDiary() {
  const t = useT();
  const { photos, persistent, now } = usePhotos();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [status, setStatus] = useState('');
  // The first photo turns the page from "no photos yet" into "your photos": the Take button that has focus is replaced
  // when the new list arrives, a moment after the save, and focus would fall to the top of the page. Focus it again then.
  const refocusWhenPhotosArrive = useRef(false);
  useEffect(() => {
    if (refocusWhenPhotosArrive.current && photos !== null && photos.length > 0) {
      refocusWhenPhotosArrive.current = false;
      document.getElementById(TAKE_BUTTON_ID)?.focus();
    }
  }, [photos]);

  const closeCapture = () => {
    setCaptureOpen(false);
    focusTakeButton();
  };

  const saved = ({ persisted }: SavedPhoto) => {
    setCaptureOpen(false);
    setStatus(persisted ? t('status.saved') : t('status.savedTabOnly'));
    if (!photos || photos.length === 0) refocusWhenPhotosArrive.current = true;
    focusTakeButton();
  };

  return (
    <PhotoDiaryView
      photos={photos}
      persistent={persistent}
      canDecode={canDecodePhotos()}
      now={now}
      status={status}
      loadBlob={loadBlob}
      capture={captureOpen ? <CapturePanel onClose={closeCapture} onSaved={saved} /> : null}
      onStartCapture={() => { setStatus(''); setCaptureOpen(true); }}
      onDeleteOne={id => { void photoStore.remove(id).then(ok => setStatus(ok ? t('status.deleted') : '')); }}
      onDeleteAll={() => { void photoStore.removeAll().then(n => setStatus(n === 1 ? t('status.deleted') : t('status.deletedAll', { count: n }))); }}
    />
  );
}
