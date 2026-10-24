// Settings > Detection: the false-alarm controls (WS3, flag false_positive_controls).
// Rendered from sections/DetectionSection.tsx, which the Settings page shows only while the flag is on.
//
//   Which hand        both / left only / right only (as the person sees it in the preview)
//   Chin rest         the chin-rest rule, on by default
//   Learned           how many "Not a bite" poses are remembered, and a button to forget them
//   Calibrate         the optional one-minute calibration; delete it with one click
//   False-alarm rate  last 7 days against the 7 before
//
// Everything here is stored on this device (kv "falsePositive", poseStore.ts). Text and controls only: no
// drawing of a hand or a face anywhere on this card.

import { useState, useSyncExternalStore } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Row, Section, Toggle } from '../pages/settings/ui';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useAppStore } from '../store/useAppStore';
import type { HandFilter } from '../detection/controls';
import { openCalibration } from '../calibration/state';
import { clearCalibration, learnedCount, readCalibration, readSettings, resetLearning, subscribeStore, writeSettings } from './poseStore';
import { FalsePositiveRate } from './FalsePositiveRate';
import { useT, type messages } from '../i18n/scopes/settings';
import { useT as useCommonT } from '../i18n/scopes/common';
import { formatDate } from '../i18n/format';

const HAND_LABEL_KEY = {
  both: 'falsePositive.hand.both',
  left: 'falsePositive.hand.left',
  right: 'falsePositive.hand.right',
} as const satisfies Record<HandFilter, keyof typeof messages>;

// useSyncExternalStore compares snapshots with Object.is: a string, never a fresh object.
const snapshot = () => JSON.stringify({ s: readSettings(), n: learnedCount(), c: readCalibration()?.at ?? null });

function dateOf(at: number): string {
  try { return formatDate(new Date(at), { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}

const buttonClass = 'min-h-11 shrink-0 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 disabled:hover:bg-transparent dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill';

export function DetectionSettings() {
  const t = useT();
  const tc = useCommonT();
  useSyncExternalStore(subscribeStore, snapshot, snapshot);
  const incidents = useAppStore(s => s.incidents);
  const [confirmReset, setConfirmReset] = useState(false);

  const settings = readSettings();
  const learned = learnedCount();
  const calibration = readCalibration();

  return (
    <Section title={t('falsePositive.title')} icon={SlidersHorizontal} fullWidth>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {t('falsePositive.intro')}
      </p>

      <Row label={t('falsePositive.hand.label')} description={t('falsePositive.hand.description')}>
        <SegmentedControl<HandFilter>
          ariaLabel={t('falsePositive.hand.aria')}
          value={settings.handFilter}
          onChange={handFilter => writeSettings({ handFilter })}
          options={(['both', 'left', 'right'] as const).map(v => ({ label: t(HAND_LABEL_KEY[v]), value: v }))}
        />
      </Row>

      <Row label={t('falsePositive.chin.label')} description={t('falsePositive.chin.description')}>
        <Toggle value={settings.chinRest} onChange={chinRest => writeSettings({ chinRest })} label={t('falsePositive.chin.toggle')} />
      </Row>

      <Row
        label={t('falsePositive.learned.label')}
        description={learned === 0
          ? t('falsePositive.learned.none')
          : t('falsePositive.learned.some', { count: learned })}
      >
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { resetLearning(); setConfirmReset(false); }} className="min-h-11 rounded-full bg-alert-600 px-5 text-sm font-semibold text-cream-100 transition-colors hover:bg-alert-800">
              {t('falsePositive.learned.confirm')}
            </button>
            <button type="button" autoFocus onClick={() => setConfirmReset(false)} className={buttonClass}>{tc('cancel')}</button>
          </div>
        ) : (
          <button type="button" disabled={learned === 0} onClick={() => setConfirmReset(true)} className={buttonClass}>{t('falsePositive.learned.forget')}</button>
        )}
      </Row>

      <Row
        label={t('falsePositive.calibrate.label')}
        description={calibration
          ? t('falsePositive.calibrate.done', { date: dateOf(calibration.at) })
          : t('falsePositive.calibrate.none')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => openCalibration()} className={buttonClass}>{calibration ? t('falsePositive.calibrate.again') : t('falsePositive.calibrate.label')}</button>
          {calibration && <button type="button" onClick={() => clearCalibration()} className={buttonClass}>{t('falsePositive.calibrate.delete')}</button>}
        </div>
      </Row>

      <FalsePositiveRate incidents={incidents} />

      <p className="text-sm text-stone-600 dark:text-stone-300">
        {t('falsePositive.footer')}
      </p>
    </Section>
  );
}
