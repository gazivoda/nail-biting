import { Brain, CircleHelp, Hourglass, Zap, type LucideIcon } from 'lucide-react';
import type { TriggerTag } from '../../types';

// The preset triggers, shared by the "I just bit my nails" sheet and the
// post-alarm prompt so both ask the same question with the same words.
// Presets draw a line icon in the app's own stroke; only the tags a user
// adds carry an emoji, because they chose it.
export const PRESET_TAGS: { id: TriggerTag; label: string; icon: LucideIcon }[] = [
  { id: 'stress', label: 'Stress', icon: Zap },
  { id: 'focus', label: 'Deep focus', icon: Brain },
  { id: 'boredom', label: 'Boredom', icon: Hourglass },
  { id: 'unknown', label: 'Not sure', icon: CircleHelp },
];

export type TagOption = { id: string; label: string; icon?: LucideIcon; emoji?: string };
