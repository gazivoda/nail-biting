import { Brain, CircleHelp, Hourglass, Wind, Zap, type LucideIcon } from 'lucide-react';
import type { TriggerTag } from '../../types';
import { t } from '../../i18n/scopes/common';

// The preset triggers, shared by the "I just bit my nails" sheet and the
// post-alarm prompt so both ask the same question with the same words.
// Presets draw a line icon in the app's own stroke; only the tags a user
// adds carry an emoji, because they chose it.
//
// `label` is a getter: it is read when a screen renders, in the language showing then (src/i18n).
// The ids are what gets stored and never change.
export const PRESET_TAGS: { id: TriggerTag; label: string; icon: LucideIcon }[] = [
  { id: 'stress', get label() { return t('tag.stress'); }, icon: Zap },
  { id: 'focus', get label() { return t('tag.focus'); }, icon: Brain },
  { id: 'boredom', get label() { return t('tag.boredom'); }, icon: Hourglass },
  { id: 'unknown', get label() { return t('tag.unknown'); }, icon: CircleHelp },
];

export type TagOption = { id: string; label: string; icon?: LucideIcon; emoji?: string };

// The tag the urge timer (WS2) logs. Deliberately NOT in PRESET_TAGS: those are
// answers to "what set the bite off?", and an urge is not a bite (isBite and
// isUrge in src/storage/eventModel.ts keep it out of every count and streak).
// History reads the label from here.
export const URGE_TAG: TagOption = { id: 'urge', get label() { return t('tag.urge'); }, icon: Wind };
