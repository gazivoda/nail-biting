// The coaching settings (WS2): which competing response to suggest, for how
// long, and when to prompt. Pure model plus a kv-backed store, so the model is
// tested in node and nothing here touches localStorage directly.
//
// Stored under kv('hrt', 'settings'). DEFAULT: prompt OFF, so turning the
// hrt_coaching flag on changes nothing about alarms until the person opts in.
// Only text is stored. The responses are instructions in words; there is no
// imagery anywhere in this feature (PRODUCT/DESIGN: never depict the habit).

import { kv } from '../storage/kv';
import { t } from '../i18n/scopes/coaching';
import { clampDuration, DEFAULT_DURATION_SEC } from './session';
import { isPromptMode, type PromptMode } from './promptPolicy';

export interface ResponseOption {
  id: string;
  text: string;
}

/**
 * Neutral instructions, as text. The first two are the plan's examples; the third is the existing suggestion the post-alarm card already uses.
 * `text` is read when it is shown, in the language showing then (src/i18n); the ids are what gets stored and never change.
 * What a person typed themselves is shown as typed (see `custom`).
 */
export const PRESET_RESPONSES: readonly ResponseOption[] = [
  { id: 'fists', get text() { return t('preset.fists'); } },
  { id: 'palms', get text() { return t('preset.palms'); } },
  { id: 'thumbs', get text() { return t('preset.thumbs'); } },
  { id: 'press', get text() { return t('preset.press'); } },
  { id: 'hold', get text() { return t('preset.hold'); } },
];

export const MAX_CUSTOM_RESPONSES = 8;
export const MAX_RESPONSE_LENGTH = 60;

export interface CoachingSettings {
  promptMode: PromptMode;
  durationSec: number;
  /** A preset id or the id of one of `custom`. */
  selectedId: string;
  custom: ResponseOption[];
}

export const DEFAULT_COACHING_SETTINGS: CoachingSettings = {
  promptMode: 'off',
  durationSec: DEFAULT_DURATION_SEC,
  selectedId: PRESET_RESPONSES[0].id,
  custom: [],
};

/** Plain text, no control characters, trimmed, bounded. Empty when nothing usable is left. */
export function cleanResponseText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_RESPONSE_LENGTH);
}

export function allResponses(s: CoachingSettings): ResponseOption[] {
  return [...PRESET_RESPONSES, ...s.custom];
}

/** The text to show for the selected response; falls back to the first preset if the selection is gone. */
export function selectedResponseText(s: CoachingSettings): string {
  return (allResponses(s).find(r => r.id === s.selectedId) ?? PRESET_RESPONSES[0]).text;
}

/** Anything read from storage becomes a valid settings object. Never throws. */
export function sanitizeSettings(raw: unknown): CoachingSettings {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const custom: ResponseOption[] = [];
  if (Array.isArray(o.custom)) {
    for (const c of o.custom) {
      if (c === null || typeof c !== 'object') continue;
      const id = (c as Record<string, unknown>).id;
      const text = cleanResponseText((c as Record<string, unknown>).text);
      if (typeof id !== 'string' || id === '' || text === '') continue;
      if (PRESET_RESPONSES.some(p => p.id === id) || custom.some(x => x.id === id)) continue;
      custom.push({ id, text });
      if (custom.length >= MAX_CUSTOM_RESPONSES) break;
    }
  }
  const next: CoachingSettings = {
    promptMode: isPromptMode(o.promptMode) ? o.promptMode : DEFAULT_COACHING_SETTINGS.promptMode,
    durationSec: clampDuration(o.durationSec ?? DEFAULT_DURATION_SEC),
    selectedId: typeof o.selectedId === 'string' ? o.selectedId : DEFAULT_COACHING_SETTINGS.selectedId,
    custom,
  };
  if (!allResponses(next).some(r => r.id === next.selectedId)) next.selectedId = DEFAULT_COACHING_SETTINGS.selectedId;
  return next;
}

/** Adds the person's own response and selects it. No-op for empty text or a full list; a duplicate just selects the existing one. */
export function addCustomResponse(s: CoachingSettings, rawText: string, makeId: () => string): CoachingSettings {
  const text = cleanResponseText(rawText);
  if (text === '') return s;
  const existing = allResponses(s).find(r => r.text.toLowerCase() === text.toLowerCase());
  if (existing) return { ...s, selectedId: existing.id };
  if (s.custom.length >= MAX_CUSTOM_RESPONSES) return s;
  const id = makeId();
  return { ...s, custom: [...s.custom, { id, text }], selectedId: id };
}

/** Removes one of the person's own responses; the selection falls back to the first preset if it was that one. */
export function removeCustomResponse(s: CoachingSettings, id: string): CoachingSettings {
  const custom = s.custom.filter(c => c.id !== id);
  if (custom.length === s.custom.length) return s;
  return { ...s, custom, selectedId: s.selectedId === id ? DEFAULT_COACHING_SETTINGS.selectedId : s.selectedId };
}

// ── kv-backed store ──────────────────────────────────────────────────────────

const NS = 'hrt' as const;
const KEY = 'settings';
const LAST_PROMPT_KEY = 'last-prompt-at';

let cached: CoachingSettings | null = null;
const listeners = new Set<() => void>();
let unsubscribeKv: (() => void) | null = null;

function ensureKvSubscription() {
  if (unsubscribeKv) return;
  unsubscribeKv = kv.subscribe(NS, KEY, () => {
    cached = null;
    listeners.forEach(fn => fn());
  });
}

/** The current settings. The same object until they change (safe for useSyncExternalStore). */
export function getCoachingSettings(): CoachingSettings {
  if (cached === null) cached = sanitizeSettings(kv.get<unknown>(NS, KEY, null));
  return cached;
}

export function subscribeCoachingSettings(fn: () => void): () => void {
  ensureKvSubscription();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function saveCoachingSettings(next: CoachingSettings): void {
  ensureKvSubscription();
  kv.set(NS, KEY, sanitizeSettings(next)); // notifies the subscription above, which clears the cache
}

export function updateCoachingSettings(patch: Partial<CoachingSettings>): void {
  saveCoachingSettings({ ...getCoachingSettings(), ...patch });
}

/** For tests: forget the in-memory copy (storage was swapped). */
export function resetCoachingSettingsCache(): void {
  cached = null;
  unsubscribeKv?.();
  unsubscribeKv = null;
}

export function getLastPromptAt(): number | null {
  const v = kv.get<unknown>(NS, LAST_PROMPT_KEY, null);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function setLastPromptAt(ts: number): void {
  kv.set(NS, LAST_PROMPT_KEY, ts);
}
