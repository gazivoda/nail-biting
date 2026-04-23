import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const SUGGESTIONS = [
  'Press thumb to each fingertip',
  'Clench and release fist · 5×',
  'Exhale slowly through your nose',
  'Sip water mindfully',
];

export function ReplacementPrompt() {
  const { incidents } = useAppStore();
  const [dismissed, setDismissed] = useState<number>(0);

  const lastAuto = [...incidents]
    .reverse()
    .find(i => i.tag === 'auto-detected');

  const shouldShow = lastAuto && dismissed < lastAuto.timestamp;

  if (!shouldShow) return null;

  const suggestion = SUGGESTIONS[lastAuto.timestamp % SUGGESTIONS.length];

  return (
    <div className="bg-white dark:bg-ink-50 border border-forest-200 dark:border-forest-800 rounded-[18px] p-7 shadow-card-md dark:shadow-card-md-dark animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-forest-500 dark:text-forest-400">
            Interrupt detected
          </p>
          <p className="text-[15px] font-semibold text-stone-800 dark:text-stone-100 mt-1">
            Try this instead
          </p>
        </div>
        <button
          onClick={() => setDismissed(lastAuto.timestamp)}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-[13px] text-stone-700 dark:text-stone-200 leading-relaxed bg-forest-50 dark:bg-forest-900/20 rounded-xl px-4 py-3 border border-forest-100 dark:border-forest-800/50">
        {suggestion}
      </p>

      <button
        onClick={() => setDismissed(lastAuto.timestamp)}
        className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-medium text-forest-700 dark:text-forest-300 bg-forest-50 dark:bg-forest-900/20 hover:bg-forest-100 dark:hover:bg-forest-900/40 border border-forest-200 dark:border-forest-800 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
