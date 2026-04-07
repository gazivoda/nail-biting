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
  const [logged, setLogged] = useState<string | null>(null);
  const [pressing, setPressing] = useState(false);

  const handleLog = (tag: TriggerTag, label: string) => {
    logIncident(tag, false);
    setLogged(label);
    setTimeout(() => {
      setLogged(null);
      setShowTags(false);
    }, 900);
  };

  const handleMainPress = () => {
    setPressing(true);
    setTimeout(() => {
      setPressing(false);
      setShowTags(true);
    }, 120);
  };

  if (logged) {
    return (
      <div className="bg-forest-50 dark:bg-forest-900/30 border border-forest-300 dark:border-forest-700 rounded-2xl py-4 text-center animate-fade-up">
        <p className="text-forest-700 dark:text-forest-300 font-medium text-sm">✓ Logged — {logged}</p>
      </div>
    );
  }

  if (showTags) {
    return (
      <div className="bg-white dark:bg-ink-50 border border-alert-400 dark:border-alert-800 rounded-2xl p-4 shadow-card dark:shadow-card-dark animate-fade-up">
        <p className="text-stone-500 dark:text-stone-400 text-sm text-center mb-3">What triggered it?</p>
        <div className="grid grid-cols-2 gap-2">
          {tags.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => handleLog(id, label)}
              className="flex items-center gap-2 bg-stone-100 dark:bg-ink-300 hover:bg-stone-200 dark:hover:bg-ink-200 active:scale-95 border border-stone-200 dark:border-ink-400 rounded-xl px-3 py-3 text-sm text-stone-700 dark:text-stone-300 transition-all duration-150"
            >
              <span className="text-lg">{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowTags(false)}
          className="w-full mt-2 text-stone-400 dark:text-stone-500 text-xs py-1 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onPointerDown={handleMainPress}
      className={`w-full bg-alert-100 dark:bg-alert-900/30 hover:bg-alert-100/80 dark:hover:bg-alert-900/50 border border-alert-400 dark:border-alert-800 hover:border-alert-600 rounded-2xl py-4 text-alert-600 dark:text-alert-400 font-medium text-base transition-all duration-150 select-none ${
        pressing ? 'scale-95 shadow-inner' : 'active:scale-95'
      }`}
    >
      😬 I just bit my nails
    </button>
  );
}
