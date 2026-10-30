import { useState } from 'react';

// A phone, not a narrow desktop window: a touch-only pointer AND a small
// screen. The app needs a computer webcam, so these visitors cannot start a
// trial where they are. A desktop browser resized to 400px still has a mouse
// and keeps the normal button.
export const PHONE_QUERY = '(pointer: coarse) and (max-width: 767px)';

type MatchMedia = (query: string) => { matches: boolean };

export function isPhone(matchMedia: MatchMedia | undefined): boolean {
  try {
    return !!matchMedia && matchMedia(PHONE_QUERY).matches;
  } catch {
    return false;
  }
}

/** Whether this document is a phone right now. False where there is no window (server rendering, tests). */
export function currentIsPhone(): boolean {
  return isPhone(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia.bind(window) : undefined);
}

// Read once, in the first render. This used to start at false and flip in an effect, so a phone's first paint
// showed the standard "Start free trial" button and the next frame swapped it for the longer "Send the link to my
// computer": the button grew from about 200 px to the full column, the "How it works" link wrapped under it and
// the screenshot and notes below moved down 60 px (CLS 0.098 on the home page in a mobile Lighthouse run, and the
// wrong label for a frame on every phone). The app is client-rendered with createRoot, never hydrated, so reading
// the media query during the first render cannot mismatch any server markup; the crawler copy is the separate
// article the server injects (server.js injectSsrArticle). Without a window it is false, as before.
export function useIsPhone(): boolean {
  const [phone] = useState(currentIsPhone);
  return phone;
}
