// The browser's status-bar colour while the phone view is showing (Android Chrome
// reads <meta name="theme-color"> live, also for an installed app).
//
// index.html ships one value, #F7F7F1, the light page background (a site-wide
// decision). The app has a dark mode whose ground is darker than any status bar
// should be, so on the phone view the colour follows the theme and is put back
// when the view goes away. Only the phone view does this: nothing changes for a
// visitor with the flag off.

import { useEffect } from 'react';

/** The light page background, as in index.html. */
export const LIGHT_THEME_COLOR = '#F7F7F1';
/** The dark ground of the app (`dark:bg-ink-100`, oklch(15% 0.02 165)), measured in Chrome. */
export const DARK_THEME_COLOR = '#040e09';

export function themeColorFor(dark: boolean): string {
  return dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
}

export function useThemeColor(): void {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const original = meta.getAttribute('content');
    const apply = () => meta.setAttribute('content', themeColorFor(document.documentElement.classList.contains('dark')));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      if (original !== null) meta.setAttribute('content', original);
    };
  }, []);
}
