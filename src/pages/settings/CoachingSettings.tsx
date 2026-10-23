// Settings > Alerts: the competing-response prompt (WS2, flag hrt_coaching).
// Rendered from sections/AlertsSection.tsx, which the Settings page shows only
// while the flag is on.
//
// The prompt is OFF until the person turns it on here, so switching the flag on
// changes nothing about alarms by itself. Whatever is set here, the alarm sound
// and flash are never delayed or replaced: the prompt appears after the alarm
// and can always be skipped.
//
// Stored locally through the storage module (kv 'hrt'). No network.

import { useId, useState, useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { Row, Section } from './ui';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PROMPT_MODES, type PromptMode } from '../../coaching/promptPolicy';
import {
  MAX_CUSTOM_RESPONSES, MAX_RESPONSE_LENGTH, PRESET_RESPONSES, addCustomResponse, getCoachingSettings,
  removeCustomResponse, saveCoachingSettings, subscribeCoachingSettings, updateCoachingSettings,
} from '../../coaching/settings';
import { MAX_DURATION_SEC, MIN_DURATION_SEC } from '../../coaching/session';
import { CoachingStatsLine } from '../../coaching/CoachingStatsLine';
import { openProgram } from '../../coaching/programViewState';

const MODE_LABEL: Record<PromptMode, string> = {
  off: 'Off',
  hourly: 'Once an hour',
  every: 'Every alarm',
};

const MODE_HELP: Record<PromptMode, string> = {
  off: 'No prompt. Alarms work exactly as before.',
  hourly: 'The first alarm in any hour gets a prompt. The ones after it do not, until an hour has passed.',
  every: 'Every alarm gets a prompt. Alarms that come within 30 seconds of each other count as one.',
};

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return `mine-${(c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8)}`;
}

export function CoachingSettings() {
  const settings = useSyncExternalStore(subscribeCoachingSettings, getCoachingSettings, getCoachingSettings);
  const [draft, setDraft] = useState('');
  const groupName = useId();
  const draftId = useId();
  const lengthId = useId();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const next = addCustomResponse(settings, draft, newId);
    if (next !== settings) saveCoachingSettings(next);
    setDraft('');
  };

  const full = settings.custom.length >= MAX_CUSTOM_RESPONSES;

  return (
    <Section title="Alerts" icon={Bell} fullWidth>
      <Row
        label="Competing-response prompt"
        description="After an alarm, a short timer suggests something to do with your hands instead. It never replaces or delays the alarm, and you can skip it."
      >
        <SegmentedControl<PromptMode>
          ariaLabel="When to show the prompt"
          value={settings.promptMode}
          onChange={promptMode => updateCoachingSettings({ promptMode })}
          options={PROMPT_MODES.map(m => ({ label: MODE_LABEL[m], value: m }))}
        />
      </Row>
      <p className="-mt-3 text-sm text-stone-600 dark:text-stone-300">{MODE_HELP[settings.promptMode]}</p>

      <Row label="Length" description="How long the timer runs, from 15 to 60 seconds.">
        <div className="flex items-center gap-3">
          <input
            id={lengthId}
            type="range"
            min={MIN_DURATION_SEC}
            max={MAX_DURATION_SEC}
            step={5}
            value={settings.durationSec}
            aria-label="Length of the prompt in seconds"
            aria-valuetext={`${settings.durationSec} seconds`}
            onChange={e => updateCoachingSettings({ durationSec: Number(e.target.value) })}
            className="h-11 w-40 accent-[oklch(25%_0.05_162)] dark:accent-[oklch(90%_0.2_124)]"
          />
          <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums text-stone-800 dark:text-stone-100">{settings.durationSec} s</span>
        </div>
      </Row>

      <fieldset>
        <legend className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">What to do</legend>
        <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">Pick one, or write your own.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[...PRESET_RESPONSES, ...settings.custom].map(r => {
            const mine = settings.custom.some(c => c.id === r.id);
            const checked = settings.selectedId === r.id;
            return (
              <li key={r.id} className="flex items-center gap-1">
                <label
                  className={`flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-full border px-4 text-sm transition-colors ${
                    checked
                      ? 'border-deep bg-stone-100 font-semibold text-stone-900 dark:border-lime-300 dark:bg-ink-fill dark:text-stone-100'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill'
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    checked={checked}
                    onChange={() => updateCoachingSettings({ selectedId: r.id })}
                    className="h-4 w-4 accent-[oklch(25%_0.05_162)] dark:accent-[oklch(90%_0.2_124)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{r.text}</span>
                </label>
                {mine && (
                  <button
                    type="button"
                    onClick={() => saveCoachingSettings(removeCustomResponse(settings, r.id))}
                    aria-label={`Remove “${r.text}”`}
                    className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-500 transition-colors hover:text-alert-600 dark:text-stone-400 dark:hover:text-alert-400"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={draftId} className="sr-only">Write your own competing response</label>
          <input
            id={draftId}
            type="text"
            value={draft}
            maxLength={MAX_RESPONSE_LENGTH}
            disabled={full}
            onChange={e => setDraft(e.target.value)}
            placeholder={full ? 'The list is full. Remove one to add another.' : 'Write your own, for example “Squeeze a stress ball”'}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 placeholder:text-stone-500 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100 dark:placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={full || draft.trim() === ''}
            className="min-h-11 rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            Add
          </button>
        </form>
      </fieldset>

      <CoachingStatsLine className="text-sm leading-relaxed text-stone-700 dark:text-stone-200" />

      <div>
        <button
          type="button"
          onClick={openProgram}
          className="inline-flex min-h-11 items-center rounded-full px-1 text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
        >
          Open the 4-week program
        </button>
      </div>
    </Section>
  );
}
