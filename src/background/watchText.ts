// The words for a pause or a meeting, in one place so the Watch tab, the mini window and the controls agree.
// Plain text only: no illustration of the habit, no icon that depicts it.

import { describeEnd, type ClockFormatter, type WatchState } from './pauseMachine';

export interface WatchNote {
  kind: 'paused' | 'meeting';
  /** The headline, for example "Paused until 3:45 PM". */
  title: string;
  /** One sentence under it. */
  detail: string;
  /** What fits the 240 px mini window. */
  short: string;
}

/** Null when watching is simply running (or stopped): there is nothing to say. */
export function watchNote(state: WatchState, now: number, clock?: ClockFormatter): WatchNote | null {
  if (state.kind === 'paused') {
    const end = describeEnd(state.until, now, clock);
    return {
      kind: 'paused',
      title: `Paused until ${end}`,
      detail: state.releaseCamera
        ? 'The camera is off and nothing is being checked. Watching starts again by itself.'
        : 'Nothing is being checked. Watching starts again by itself. The camera stays on in this browser so it can.',
      short: `Paused until ${end}`,
    };
  }
  if (state.kind === 'meeting') {
    const end = describeEnd(state.until, now, clock);
    return {
      kind: 'meeting',
      title: `Meeting mode until ${end}`,
      detail: 'Still watching, silently: the screen flashes, there is no sound or notification, and alarms are still logged.',
      short: 'Watching, silent',
    };
  }
  return null;
}
