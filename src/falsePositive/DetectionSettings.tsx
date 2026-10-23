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

const HAND_LABEL: Record<HandFilter, string> = { both: 'Both', left: 'Left', right: 'Right' };

// useSyncExternalStore compares snapshots with Object.is: a string, never a fresh object.
const snapshot = () => JSON.stringify({ s: readSettings(), n: learnedCount(), c: readCalibration()?.at ?? null });

function dateOf(at: number): string {
  try { return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}

const buttonClass = 'min-h-11 shrink-0 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 disabled:hover:bg-transparent dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill';

export function DetectionSettings() {
  useSyncExternalStore(subscribeStore, snapshot, snapshot);
  const incidents = useAppStore(s => s.incidents);
  const [confirmReset, setConfirmReset] = useState(false);

  const settings = readSettings();
  const learned = learnedCount();
  const calibration = readCalibration();

  return (
    <Section title="Detection" icon={SlidersHorizontal} fullWidth>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Fewer false alarms. These controls only ever make the alarm quieter in the cases below: they never add one. Tap “Not a bite” on an alarm and the app learns from it.
      </p>

      <Row label="Which hand" description="Watch both hands, only your left, or only your right. Left and right are your hands as you see them in the camera preview.">
        <SegmentedControl<HandFilter>
          ariaLabel="Which hand to watch"
          value={settings.handFilter}
          onChange={handFilter => writeSettings({ handFilter })}
          options={(['both', 'left', 'right'] as const).map(v => ({ label: HAND_LABEL[v], value: v }))}
        />
      </Row>

      <Row label="Chin rest" description="Stay quiet when the back of your hand or your palm rests on your chin and no fingertip is near your lips.">
        <Toggle value={settings.chinRest} onChange={chinRest => writeSettings({ chinRest })} label="Stay quiet when my hand rests on my chin" />
      </Row>

      <Row
        label="Learned from “Not a bite”"
        description={learned === 0
          ? 'Nothing yet. Each time you mark an alarm “Not a bite”, the app remembers a few numbers about where your hand was.'
          : `${learned} ${learned === 1 ? 'pose' : 'poses'} remembered. When your hand is in a pose like ones you rejected, the alarm waits a little longer, and after two it wants a fingertip right at your lips.`}
      >
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { resetLearning(); setConfirmReset(false); }} className="min-h-11 rounded-full bg-alert-600 px-5 text-sm font-semibold text-cream-100 transition-colors hover:bg-alert-800">
              Yes, forget them
            </button>
            <button type="button" autoFocus onClick={() => setConfirmReset(false)} className={buttonClass}>Cancel</button>
          </div>
        ) : (
          <button type="button" disabled={learned === 0} onClick={() => setConfirmReset(true)} className={buttonClass}>Forget what it learned</button>
        )}
      </Row>

      <Row
        label="Calibrate"
        description={calibration
          ? `Calibrated on ${dateOf(calibration.at)}. The chin-rest rule uses how you rest your chin and where your fingertip sits.`
          : 'Optional, about a minute: rest your chin on your hand, then bring a fingertip near your lips, and the app tunes itself to you.'}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => openCalibration()} className={buttonClass}>{calibration ? 'Calibrate again' : 'Calibrate'}</button>
          {calibration && <button type="button" onClick={() => clearCalibration()} className={buttonClass}>Delete calibration</button>}
        </div>
      </Row>

      <FalsePositiveRate incidents={incidents} className="!mt-0" />

      <p className="text-sm text-stone-600 dark:text-stone-300">
        What is remembered is a handful of numbers per pose, for example how far a fingertip was from your lips. No picture, no video. They are kept on this device only: they are not part of your history, are not synced and are not uploaded.
      </p>
    </Section>
  );
}
