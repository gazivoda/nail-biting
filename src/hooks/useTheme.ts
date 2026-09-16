import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * Applies / removes the `dark` class on <html> based on the stored theme preference.
 * Must be called at the top of any page that needs theme support.
 *
 * Pass `override` to pin a route to one appearance regardless of what the visitor
 * has stored — the landing page is light-only, so it reads as health and wellbeing.
 * An override only changes what gets applied to <html>; the stored preference is
 * never written, so the rest of the app still honours it.
 */
export function useTheme(override?: 'light' | 'dark') {
  const { theme } = useAppStore();
  const effective = override ?? theme;

  useEffect(() => {
    const root = document.documentElement;
    if (effective === 'dark') {
      root.classList.add('dark');
    } else if (effective === 'light') {
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
  }, [effective]);
}
