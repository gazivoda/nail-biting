// Settings > Data > Photo diary: how many photos are stored and how big, where they are,
// and the one button that removes them all. Lazy-loaded by PhotoDiarySettings.tsx only
// while the `photo_diary` flag is on.

import { useState } from 'react';
import { Images } from 'lucide-react';
import { Section } from '../pages/settings/ui';
import { TwoStepDelete } from './TwoStepDelete';
import { formatBytes, totalBytes, type PhotoMeta } from './diaryMeta';
import { PRIVACY_DETAIL, PRIVACY_STATEMENT } from './copy';
import { photoStore } from './photoStore';
import { usePhotoRecords } from './usePhotoRecords';

export function PhotoDiarySettingsView({ photos, status, onDeleteAll }: { photos: readonly PhotoMeta[]; status: string; onDeleteAll: () => void }) {
  return (
    <Section title="Photo diary" icon={Images} fullWidth>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{PRIVACY_STATEMENT} {PRIVACY_DETAIL}</p>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        {photos.length === 0
          ? 'No photos saved.'
          : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} saved, ${formatBytes(totalBytes(photos))} in this browser.`}
      </p>
      {photos.length > 0 && (
        <div className="space-y-2">
          <TwoStepDelete
            label="Delete all photos"
            question={`Delete all ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} from this browser?`}
            confirmLabel="Delete all"
            keepLabel="Keep my photos"
            onConfirm={onDeleteAll}
          />
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Clearing your history, or "Delete everything" in this section, does not remove photos. Use this button for them.
          </p>
        </div>
      )}
      <p role="status" aria-live="polite" className={status === '' ? 'sr-only' : 'text-sm font-semibold text-stone-800 dark:text-stone-100'}>{status}</p>
    </Section>
  );
}

export function PhotoDiarySettingsCard() {
  const { photos } = usePhotoRecords();
  const [status, setStatus] = useState('');
  return (
    <PhotoDiarySettingsView
      photos={photos}
      status={status}
      onDeleteAll={() => { void photoStore.removeAll().then(n => setStatus(n === 0 ? '' : 'All photos deleted.')); }}
    />
  );
}
