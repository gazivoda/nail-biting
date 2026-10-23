// Dashboard's one question: "is this the phone view?" (WS6, flag `phone_companion`).
//
// Cost with the flag off: nothing the page was not already doing. The flag read
// shares the one /api/features request Dashboard's other flag reads make, the
// phone check is a media query, and the webcam probe below runs only when the
// flag is ON (so a flag-off visitor never calls enumerateDevices).

import { useEffect, useState } from 'react';
import { useFeature } from '../features/useFeature';
import { useAuth } from '../contexts/AuthContext';
import { decidePhoneView, hasNoWebcam, isPhoneView } from './phoneDecision';
import { getPhoneViewState, setNoWebcam, setPhoneViewActive, usePhoneViewState } from './activeStore';
import { saveGrant } from './offlineGrant';

let probe: Promise<void> | null = null;

/** Asks the browser once per page load whether it lists a camera. Never prompts. */
function probeWebcam(): void {
  if (probe || getPhoneViewState().noWebcam !== null) return;
  const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  probe = hasNoWebcam(devices).then(setNoWebcam);
}

export function usePhoneView(): boolean {
  const flagOn = useFeature('phone_companion');
  const { user, accessStatus } = useAuth();
  const [phoneLike] = useState(() =>
    isPhoneView(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia.bind(window) : undefined));
  const { noWebcam, fullApp } = usePhoneViewState();

  useEffect(() => {
    if (flagOn && !phoneLike) probeWebcam();
  }, [flagOn, phoneLike]);

  const show = decidePhoneView({ flagOn, phoneLike, noWebcam, fullApp });

  useEffect(() => {
    setPhoneViewActive(show);
    return () => setPhoneViewActive(false);
  }, [show]);

  // Keep a small copy of the access facts so an installed phone app can open
  // with no connection (offlineGrant.ts). Written only while the flag is on and
  // only for a person who has access right now.
  const signedInWithAccess = !!user && (accessStatus === 'trial_active' || accessStatus === 'subscribed');
  useEffect(() => {
    if (flagOn && signedInWithAccess && user) saveGrant(user);
  }, [flagOn, signedInWithAccess, user]);

  return show;
}
