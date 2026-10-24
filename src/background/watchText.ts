// The words for a pause or a meeting, in one place so the Watch tab, the mini window and the controls agree.
// Plain text only: no illustration of the habit, no icon that depicts it.

import { describeEnd, type ClockFormatter, type WatchState } from './pauseMachine';
import { t } from '../i18n/scopes/background';

export interface WatchNote {
  kind: 'paused' | 'meeting';
  /** The headline, for example "Paused until 3:45 PM". */
  title: string;
  /** One sentence under it. */
  detail: string;
  /** What fits the 240 px mini window on one line. */
  short: string;
  /** The mini window's two-line form: a status word and, under it, when it ends ("until 3:45 PM"). */
  strip: { status: string; detail: string };
  /** The line under the headline in the camera card's top band (it must not repeat the headline). */
  hint: string;
}

/** Null when watching is simply running (or stopped): there is nothing to say. The words are built now, in the language shown now. */
export function watchNote(state: WatchState, now: number, clock?: ClockFormatter): WatchNote | null {
  if (state.kind === 'paused') {
    const end = describeEnd(state.until, now, clock);
    return {
      kind: 'paused',
      title: t('watch.paused.title', { end }),
      detail: state.releaseCamera ? t('watch.paused.detail.released') : t('watch.paused.detail.kept'),
      short: t('watch.paused.title', { end }),
      strip: { status: t('watch.paused.status'), detail: t('watch.paused.until', { end }) },
      hint: state.releaseCamera ? t('watch.paused.hint.released') : t('watch.paused.hint.kept'),
    };
  }
  if (state.kind === 'meeting') {
    const end = describeEnd(state.until, now, clock);
    return {
      kind: 'meeting',
      title: t('watch.meeting.title', { end }),
      detail: t('watch.meeting.detail'),
      short: t('watch.meeting.short'),
      strip: { status: t('watch.meeting.status'), detail: t('watch.meeting.until', { end }) },
      hint: t('watch.meeting.short'),
    };
  }
  return null;
}
