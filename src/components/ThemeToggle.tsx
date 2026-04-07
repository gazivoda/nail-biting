import { Sun, Moon, Monitor } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Theme } from '../types';

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

interface Props {
  /** When true, buttons stretch to fill the container (e.g. sidebar). Default: compact icon row for navbars. */
  fullWidth?: boolean;
}

export function ThemeToggle({ fullWidth = false }: Props) {
  const { theme, setTheme } = useAppStore();

  return (
    <div className={`flex gap-0.5 p-0.5 bg-stone-100 dark:bg-ink-300 border border-stone-200 dark:border-ink-400 rounded-lg ${fullWidth ? 'w-full' : ''}`}>
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex items-center justify-center rounded-md transition-all duration-150 ${
            fullWidth ? 'flex-1 py-1.5' : 'w-7 h-7'
          } ${
            theme === value
              ? 'bg-white dark:bg-ink-50 text-stone-700 dark:text-stone-200 shadow-sm'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
          }`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
