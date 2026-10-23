import { Brain, CircleHelp, Hourglass, Wind, Zap, type LucideIcon } from 'lucide-react';
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

// The tag the urge timer (WS2) logs. Deliberately NOT in PRESET_TAGS: those are
// answers to "what set the bite off?", and an urge is not a bite (isBite and
// isUrge in src/storage/eventModel.ts keep it out of every count and streak).
// History reads the label from here.
export const URGE_TAG: TagOption = { id: 'urge', label: 'Urge', icon: Wind };
