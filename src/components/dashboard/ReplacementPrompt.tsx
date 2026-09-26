import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PRESET_TAGS, type TagOption } from './triggerTags';
import { TagMark } from './TagMark';
import type { TriggerTag } from '../../types';

const SUGGESTIONS = [
  'Press thumb to each fingertip',
  'Clench and release fist · 5×',
  'Exhale slowly through your nose',
  'Sip water mindfully',
];

const RECENT_MS = 10 * 60 * 1000;

// Shown after every auto-detection. Two jobs, in the order the moment needs
// them: a competing response to do with your hands right now, then one tap to
// say whether it was a bite and what set it off. Tagging used to be possible
// only later, from a hover button in History, which is where it never happened.
export function ReplacementPrompt() {
  const { incidents, customTags, confirmIncident } = useAppStore();
  const [dismissed, setDismissed] = useState<number>(0);
  // Only ask about detections from this sitting: after a reload, a catch from
  // yesterday is not "the moment" any more. Anchored at mount so render stays pure.
  const [askAfter] = useState(() => Date.now() - RECENT_MS);

  // `autoDetected`, not the tag: confirming with a trigger replaces the
  // 'auto-detected' tag, and the dismissed timestamp is what hides this card.
  const lastAuto = incidents.find(i => i.autoDetected);

  const shouldShow =
    lastAuto && !lastAuto.confirmed && lastAuto.timestamp > askAfter && dismissed < lastAuto.timestamp;

  if (!shouldShow) return null;

  const suggestion = SUGGESTIONS[lastAuto.timestamp % SUGGESTIONS.length];
  const tags: TagOption[] = [...PRESET_TAGS, ...customTags];

  const answer = (tag?: TriggerTag) => {
    if (tag) confirmIncident(lastAuto.id, tag);
    setDismissed(lastAuto.timestamp);
  };

  return (
    <div className="bg-white dark:bg-ink-50 border border-forest-200 dark:border-forest-800 rounded-[18px] p-7 shadow-card-md dark:shadow-card-md-dark animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-800 dark:text-stone-100">
            Alarm: try this instead
          </h2>
        </div>
        <button
          onClick={() => answer()}
          aria-label="Dismiss, not a bite"
          className="p-2.5 -m-1.5 rounded-lg text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-[13px] text-stone-700 dark:text-stone-200 leading-relaxed bg-forest-50 dark:bg-forest-900/20 rounded-xl px-4 py-3 border border-forest-100 dark:border-forest-800/50">
        {suggestion}
      </p>

      <p className="mt-5 text-[13px] font-semibold text-stone-800 dark:text-stone-100">
        Was it a bite? What set it off?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => answer(tag.id)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 dark:border-ink-400 bg-stone-100 dark:bg-ink-300 px-3 text-[13px] text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-200 dark:hover:bg-ink-200"
          >
            <TagMark tag={tag} />
            <span>{tag.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => answer()}
        className="mt-2 min-h-11 w-full rounded-xl text-[13px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
      >
        No, just my hand nearby
      </button>
    </div>
  );
}
