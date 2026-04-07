import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * Applies / removes the `dark` class on <html> based on the stored theme preference.
 * Must be called at the top of any page that needs theme support.
 */
export function useTheme() {
  const { theme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system — follow OS preference, update live
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = (e: MediaQueryList | MediaQueryListEvent) =>
        e.matches ? root.classList.add('dark') : root.classList.remove('dark');
      apply(mq);
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);
}
