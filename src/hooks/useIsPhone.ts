import { useEffect, useState } from 'react';

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

// False on the server and on first paint, so the markup crawlers and the first
// render see is always the standard button; phones switch after mount.
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    setPhone(isPhone(window.matchMedia?.bind(window)));
  }, []);
  return phone;
}
