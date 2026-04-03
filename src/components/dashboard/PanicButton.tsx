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
      <div className="bg-slate-900 border border-red-900 rounded-2xl p-4">
        <p className="text-slate-400 text-sm text-center mb-3">What triggered it?</p>
        <div className="grid grid-cols-2 gap-2">
          {tags.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => handleLog(id)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-3 text-sm text-slate-200 transition-colors"
            >
              <span className="text-lg">{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowTags(false)}
          className="w-full mt-2 text-slate-600 text-xs py-1 hover:text-slate-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowTags(true)}
      className="w-full bg-red-950 hover:bg-red-900 border border-red-800 hover:border-red-700 rounded-2xl py-4 text-red-300 font-medium text-base transition-all active:scale-95"
    >
      😬 I just bit my nails
    </button>
  );
}
