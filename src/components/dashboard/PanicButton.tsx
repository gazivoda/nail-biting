import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TriggerTag } from '../../types';

const tags: { id: TriggerTag; label: string; emoji: string }[] = [
  { id: 'stress', label: 'Stress', emoji: '😰' },
  { id: 'focus', label: 'Deep focus', emoji: '🧠' },
  { id: 'boredom', label: 'Boredom', emoji: '😐' },
  { id: 'unknown', label: 'Not sure', emoji: '🤷' },
];

export function PanicButton() {
  const { logIncident } = useAppStore();
  const [showTags, setShowTags] = useState(false);

  const handleLog = (tag: TriggerTag) => {
    logIncident(tag, false);
    setShowTags(false);
  };

  if (showTags) {
    return (
      <div className="bg-white border border-alert-400 rounded-2xl p-4 shadow-sm">
        <p className="text-stone-500 text-sm text-center mb-3">What triggered it?</p>
        <div className="grid grid-cols-2 gap-2">
          {tags.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => handleLog(id)}
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl px-3 py-3 text-sm text-stone-700 transition-colors"
            >
              <span className="text-lg">{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowTags(false)}
          className="w-full mt-2 text-stone-400 text-xs py-1 hover:text-stone-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowTags(true)}
      className="w-full bg-alert-100 hover:bg-alert-100 border border-alert-400 hover:border-alert-600 rounded-2xl py-4 text-alert-600 font-medium text-base transition-all active:scale-95"
    >
      😬 I just bit my nails
    </button>
  );
}
