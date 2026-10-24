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
import { useT, type messages } from '../../i18n/scopes/coaching';

// Typed keys of the texts, looked up by the stored mode id (the ids are what gets saved and never change).
const MODE_LABEL = {
  off: 'settings.mode.off',
  hourly: 'settings.mode.hourly',
  every: 'settings.mode.every',
} as const satisfies Record<PromptMode, keyof typeof messages>;

const MODE_HELP = {
  off: 'settings.mode.offHelp',
  hourly: 'settings.mode.hourlyHelp',
  every: 'settings.mode.everyHelp',
} as const satisfies Record<PromptMode, keyof typeof messages>;

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return `mine-${(c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8)}`;
}

export function CoachingSettings() {
  const t = useT();
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
    <Section title={t('settings.title')} icon={Bell} fullWidth>
      <Row
        label={t('settings.prompt.label')}
        description={t('settings.prompt.description')}
      >
        <SegmentedControl<PromptMode>
          ariaLabel={t('settings.prompt.aria')}
          value={settings.promptMode}
          onChange={promptMode => updateCoachingSettings({ promptMode })}
          options={PROMPT_MODES.map(m => ({ label: t(MODE_LABEL[m]), value: m }))}
        />
      </Row>
      <p className="-mt-3 text-sm text-stone-600 dark:text-stone-300">{t(MODE_HELP[settings.promptMode])}</p>

      <Row label={t('settings.length.label')} description={t('settings.length.description', { min: MIN_DURATION_SEC, max: MAX_DURATION_SEC })}>
        <div className="flex items-center gap-3">
          <input
            id={lengthId}
            type="range"
            min={MIN_DURATION_SEC}
            max={MAX_DURATION_SEC}
            step={5}
            value={settings.durationSec}
            aria-label={t('settings.length.aria')}
            aria-valuetext={t('duration.seconds', { count: settings.durationSec })}
            onChange={e => updateCoachingSettings({ durationSec: Number(e.target.value) })}
            className="h-11 w-40 accent-[oklch(25%_0.05_162)] dark:accent-[oklch(90%_0.2_124)]"
          />
          <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums text-stone-800 dark:text-stone-100">{t('settings.length.short', { seconds: settings.durationSec })}</span>
        </div>
      </Row>

      <fieldset>
        <legend className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('settings.what.legend')}</legend>
        <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{t('settings.what.hint')}</p>
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
                    aria-label={t('settings.removeAria', { text: r.text })}
                    className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-500 transition-colors hover:text-alert-600 dark:text-stone-400 dark:hover:text-alert-400"
                  >
                    {t('settings.remove')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={draftId} className="sr-only">{t('settings.write.label')}</label>
          <input
            id={draftId}
            type="text"
            value={draft}
            maxLength={MAX_RESPONSE_LENGTH}
            disabled={full}
            onChange={e => setDraft(e.target.value)}
            placeholder={full ? t('settings.write.full') : t('settings.write.placeholder')}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 placeholder:text-stone-500 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100 dark:placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={full || draft.trim() === ''}
            className="min-h-11 rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            {t('settings.add')}
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
          {t('settings.openProgram')}
        </button>
      </div>
    </Section>
  );
}
