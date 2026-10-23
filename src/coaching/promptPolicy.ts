// When the post-alarm prompt is shown (WS2). Pure and clock-free.
//
//   off     never
//   every   on every alarm event
//   hourly  on the first alarm event in any rolling 60 minutes: when the last
//           prompt that was shown is at least an hour old, or there was none.
//           Rolling, not "per clock hour", so a prompt at 10:55 does not allow
//           another at 11:00. A clock that moved backwards allows a prompt
//           rather than silencing coaching until the old time comes round.
//
// "Alarm event" is what the history records: alarms less than 30 seconds apart
// are already one event (AUTO_EPISODE_MS in the store), so "every alarm" means
// every episode, not every beep.

export type PromptMode = 'off' | 'every' | 'hourly';

export const PROMPT_MODES: readonly PromptMode[] = ['off', 'hourly', 'every'];

export const HOUR_MS = 60 * 60 * 1000;

export function isPromptMode(x: unknown): x is PromptMode {
  return x === 'off' || x === 'every' || x === 'hourly';
}

export function shouldPrompt(mode: PromptMode, lastPromptAt: number | null, now: number): boolean {
  if (mode === 'off') return false;
  if (mode === 'every') return true;
  if (lastPromptAt === null || !Number.isFinite(lastPromptAt)) return true;
  const since = now - lastPromptAt;
  return since < 0 || since >= HOUR_MS;
}
