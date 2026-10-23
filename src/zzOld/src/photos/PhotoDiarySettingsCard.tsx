// Settings > Data > Photo diary: how many photos are stored and how big, where they are,
// and the one button that removes them all. Lazy-loaded by PhotoDiarySettings.tsx only
// while the `photo_diary` flag is on.

import { useState } from 'react';
import { Images } from 'lucide-react';
import { Section } from '../pages/settings/ui';
import { TwoStepDelete } from './TwoStepDelete';
import { formatBytes, totalBytes, type PhotoMeta } from './diaryMeta';
import { useT } from '../i18n/scopes/photos';
import { photoStore } from './photoStore';
import { usePhotoRecords } from './usePhotoRecords';

export function PhotoDiarySettingsView({ photos, status, onDeleteAll }: { photos: readonly PhotoMeta[]; status: string; onDeleteAll: () => void }) {
  const t = useT();
  return (
    <Section title={t('diary.title')} icon={Images} fullWidth>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{t('diary.privacy.statement')} {t('diary.privacy.detail')}</p>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        {t('settings.saved', { count: photos.length, size: formatBytes(totalBytes(photos)) })}
      </p>
      {photos.length > 0 && (
        <div className="space-y-2">
          <TwoStepDelete
            label={t('diary.deleteAll')}
            question={t('settings.deleteQuestion', { count: photos.length })}
            confirmLabel={t('diary.deleteAll.confirm')}
            keepLabel={t('diary.deleteAll.keep')}
            onConfirm={onDeleteAll}
          />
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {t('settings.note')}
          </p>
        </div>
      )}
      <p role="status" aria-live="polite" className={status === '' ? 'sr-only' : 'text-sm font-semibold text-stone-800 dark:text-stone-100'}>{status}</p>
    </Section>
  );
}

export function PhotoDiarySettingsCard() {
  const t = useT();
  const { photos } = usePhotoRecords();
  const [status, setStatus] = useState('');
  return (
    <PhotoDiarySettingsView
      photos={photos}
      status={status}
      onDeleteAll={() => { void photoStore.removeAll().then(n => setStatus(n === 0 ? '' : t('settings.allDeleted'))); }}
    />
  );
}
