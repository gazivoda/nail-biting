import type { TriggerTag } from '../../types';

// The preset triggers, shared by the "I just bit my nails" sheet and the
// post-alarm prompt so both ask the same question with the same words.
export const PRESET_TAGS: { id: TriggerTag; label: string; emoji: string }[] = [
  { id: 'stress', label: 'Stress', emoji: '😰' },
  { id: 'focus', label: 'Deep focus', emoji: '🧠' },
  { id: 'boredom', label: 'Boredom', emoji: '😐' },
  { id: 'unknown', label: 'Not sure', emoji: '🤷' },
];
