// Pseudo-locale coverage for the Watch tab: the dashboard, the camera card and its errors, the detection badge, the mini
// window, the alarm overlay, the "Not a bite" toast, the post-alarm card, the "I just bit my nails" sheet, the streak and
// today cards, the false-alarm rate line, the suggestions and the notification text. Each is rendered in every state with
// the German catalog on and every t() result marked; whatever is left outside the marks was not produced by t()
// (see src/i18n/testing/pseudo.ts).
//
// Some states are not reachable by a first render (a sheet that opens on a click, a model that failed after the camera
// started). Those are reached by laying a value over `useState` for the one component under test (see `forceState`
// below), which is the server-render equivalent of the click.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import type { CustomTag, Incident } from '../../types';

// ── What the components read from the browser, replaced by plain values ─────────────────────────────────────────
const h = vi.hoisted(() => ({
  auth: { user: null as unknown, accessStatus: 'no_auth' as string },
  store: {} as Record<string, unknown>,
  camError: null as null | { kind: 'insecure-context' | 'permission-denied' | 'no-camera' | 'unavailable' },
  status: 'watching' as 'idle' | 'loading' | 'watching' | 'alert' | 'error',
  pip: { supported: true, active: false },
  forced: [] as Array<{ init: unknown; value: unknown }>,
}));

vi.mock('../../contexts/AuthContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../../contexts/AuthContext')>()),
  useAuth: () => ({
    ...h.auth, signingIn: false, signInWithGoogle: () => {}, signOut: async () => {}, refreshProfile: async () => {},
    authError: null, clearAuthError: () => {},
  }),
}));

// A server render reads a flag's server snapshot (always off); the slots should see the flags a test turned on.
vi.mock('../../features/useFeature', async () => {
  const { getFlags: read } = await import('../../features/flags');
  return { useFeature: (name: string) => (read() as Record<string, boolean>)[name] === true, useFeatures: () => read() };
});

// The store, with the state a test wants laid over the real one.
vi.mock('../../store/useAppStore', async importOriginal => {
  const real = await importOriginal<typeof import('../../store/useAppStore')>();
  const useAppStore = ((selector?: (s: unknown) => unknown) => {
    const state = { ...real.useAppStore.getState(), ...h.store };
    return selector ? selector(state) : state;
  }) as typeof real.useAppStore;
  return { ...real, useAppStore };
});

// No camera, no models, no Picture-in-Picture in node.
vi.mock('../../hooks/useCamera', () => ({ useCamera: () => ({ videoRef: { current: null }, error: h.camError }) }));
vi.mock('../../hooks/useDetection', () => ({
  useDetection: () => ({ status: h.status }),
  getModels: async () => ({}),
}));
vi.mock('../../hooks/usePictureInPicture', () => ({
  usePictureInPicture: () => ({ pipActive: h.pip.active, pipWindow: null, pipSupported: h.pip.supported, togglePiP: () => {} }),
}));

// The mini window renders into another window's document with a portal, which a server render cannot do: draw it in place.
vi.mock('react-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-dom')>();
  const createPortal = (children: unknown) => children;
  return { ...actual, createPortal, default: { ...actual, createPortal } };
});

// Lays a value over the next `useState(init)` of a render (once). A click cannot happen in a server render; this is its stand-in.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const useState = ((init: unknown) => {
    const at = h.forced.findIndex(f => Object.is(f.init, init));
    if (at >= 0) return [h.forced.splice(at, 1)[0].value, () => {}];
    return actual.useState(init as never);
  }) as unknown as typeof actual.useState;
  return { ...actual, useState, default: { ...actual, useState } };
});
const forceState = (init: unknown, value: unknown) => { h.forced.push({ init, value }); };

import { Dashboard } from '../../pages/Dashboard';
import { CameraToggle } from '../../components/dashboard/CameraToggle';
import { CameraPanel } from '../../components/dashboard/CameraPanel';
import { StreakHero } from '../../components/dashboard/StreakHero';
import { SessionGoal } from '../../components/dashboard/SessionGoal';
import { TodayStats } from '../../components/dashboard/TodayStats';
import { PanicButton } from '../../components/dashboard/PanicButton';
import { ReplacementPrompt } from '../../components/dashboard/ReplacementPrompt';
import { suggestion, reminderBody, SUGGESTION_COUNT } from '../../components/dashboard/suggestions';
import { DetectionStatus } from '../../components/detection/DetectionStatus';
import { DetectionSurface } from '../../components/detection/DetectionSurface';
import { CameraView } from '../../components/detection/CameraView';
import { PiPWindow } from '../../components/detection/PiPWindow';
import { AlertOverlay } from '../../components/detection/AlertOverlay';
import { CAMERA_ERROR_MESSAGE, MODEL_ERROR_MESSAGE, modelErrorMessage } from '../../components/detection/cameraErrorCopy';
import { DetectionWave } from '../../components/DetectionWave';
import { NotABiteSeam, PipButton, ToastBody } from '../../falsePositive/NotABiteSeam';
import { notABite, type NotABiteState } from '../../falsePositive/controller';
import { describeFalsePositiveRate, falsePositiveRates } from '../../falsePositive/stats';
import { FalsePositiveRate } from '../../falsePositive/FalsePositiveRate';
import { watchNote } from '../../background/watchText';
import { dispatchWatch, resetWatchForTests } from '../../background/watchStore';
import { t as tAlarm, messages as alarmMessages } from '../scopes/alarm';
import { t as tWatch, messages as watchMessages } from '../scopes/watch';

export const COVERS = [
  'src/pages/Dashboard.tsx',
  'src/components/dashboard/CameraToggle.tsx',
  'src/components/dashboard/CameraPanel.tsx',
  'src/components/dashboard/StreakHero.tsx',
  'src/components/dashboard/SessionGoal.tsx',
  'src/components/dashboard/TodayStats.tsx',
  'src/components/dashboard/PanicButton.tsx',
  'src/components/dashboard/ReplacementPrompt.tsx',
  'src/components/dashboard/suggestions.ts',
  'src/components/detection/DetectionStatus.tsx',
  'src/components/detection/DetectionSurface.tsx',
  'src/components/detection/CameraView.tsx',
  'src/components/detection/PiPWindow.tsx',
  'src/components/detection/AlertOverlay.tsx',
  'src/components/detection/cameraErrorCopy.ts',
  'src/components/DetectionWave.tsx',
  'src/falsePositive/NotABiteSeam.tsx',
  'src/falsePositive/stats.ts',
  'src/falsePositive/FalsePositiveRate.tsx',
];
// NOT-RENDERED src/hooks/useDetection.ts: it needs a camera and the MediaPipe models, so it cannot run in node. Its text is three alarm-scope messages (tab title, OS notification title and body), read inside the alarm callback with t(); the 'alarm text' tests below render those exact keys and check the source calls them (and imports only the alarm scope).
// NOT-RENDERED src/hooks/useNotifications.ts: a hook whose text is built inside a timer callback (needs a window and the Notification API). The title and the body come from t('reminder.title') and reminderBody(n), both rendered below for every suggestion.
// src/detection/zones.ts has no t(): its seven `description` strings are developer documentation of landmark zones (nothing renders them), marked i18n-ignore.

const NOW = new Date(2026, 9, 23, 14, 0).getTime(); // a Friday afternoon
const at = (days: number, hour: number, minute = 0) => new Date(2026, 9, 23 - days, hour, minute).getTime();
const MIN = 60_000;
const DAY = 86_400_000;

const rec = (id: string, ts: number, tag: string, autoDetected: boolean, extra: Partial<Incident> = {}): Incident => ({
  id, timestamp: ts, tag, autoDetected, ts, source: autoDetected ? 'alarm' : 'manual', behavior: 'nail_biting', updatedAt: ts, ...extra,
});
const commute: CustomTag = { id: 'commute', label: 'Commute', emoji: '🚌' } as CustomTag;

// What a person typed (a custom reason) and the name in the greeting are shown as typed.
const FIXTURE = ['Commute', 'Ana', 'Maria'];

function check(html: string, allow: Array<string | RegExp> = []) {
  expectAllTranslated(html, { allow: [...FIXTURE, ...allow] });
  expectNoMissingParams(html);
}
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const videoRef = { current: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.auth = { user: null, accessStatus: 'no_auth' };
  h.store = {};
  h.camError = null;
  h.status = 'watching';
  h.pip = { supported: true, active: false };
  h.forced = [];
  resetWatchForTests();
});
afterEach(() => {
  notABite.disarm();
  resetWatchForTests();
  vi.useRealTimers();
});

describe('Dashboard, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('greets by the time of day, with a name and without one', () => {
    const seen = new Set<string>();
    for (const [hour, user] of [[9, 'Ana Maria'], [14, 'Ana Maria'], [20, 'Ana Maria'], [9, null], [14, null], [20, null]] as const) {
      vi.setSystemTime(new Date(2026, 9, 23, hour).getTime());
      h.auth = { user: user ? { id: 'u', name: user, trial_end_date: null } : { id: 'u', name: null, trial_end_date: null }, accessStatus: 'subscribed' };
      const html = render(<Dashboard />);
      check(html);
      seen.add(html.match(/<h1[^>]*>(.*?)<\/h1>/)![1].replace(/<[^>]+>/g, ''));
    }
    expect(seen.size).toBe(6); // three greetings x with a name / without one
  });

  it('shows the trial line and the way to a plan under 1 lg', () => {
    h.auth = { user: { id: 'u', name: 'Ana', trial_end_date: new Date(NOW + 5 * DAY).toISOString() }, accessStatus: 'trial_active' };
    const html = render(<Dashboard onUpgrade={() => {}} />);
    check(html);
    expect(html).toContain('Kostenlose Testphase');
    expect(html).toContain('Tarif wählen');
  });

  it('the trial line without a way to upgrade', () => {
    h.auth = { user: { id: 'u', name: 'Ana', trial_end_date: new Date(NOW + 3 * 3600_000).toISOString() }, accessStatus: 'trial_active' };
    const html = render(<Dashboard />);
    check(html);
    expect(html).not.toContain('Tarif wählen');
  });

  it('with the camera off, and with it on, a streak, an alarm to answer and the false-alarm and pause slots on', () => {
    h.auth = { user: { id: 'u', name: 'Ana', trial_end_date: null }, accessStatus: 'subscribed' };
    h.store = { cameraEnabled: false };
    check(render(<Dashboard />));
    h.store = { cameraEnabled: true, incidents: [rec('a', NOW - 30_000, 'auto-detected', true)], customTags: [commute] };
    check(render(<Dashboard />));
  });
});

describe('Dashboard with the optional features on, pseudo-locale', () => {
  usePseudoLocale({ flags: ['false_positive_controls', 'background_watching', 'hrt_coaching'] });

  it('renders every slot', () => {
    h.auth = { user: { id: 'u', name: 'Ana', trial_end_date: null }, accessStatus: 'subscribed' };
    h.store = { cameraEnabled: true };
    check(render(<Dashboard />));
  });
});

describe('the camera card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['background_watching'] });

  it('off: what starting does', () => {
    h.store = { cameraEnabled: false };
    check(render(<CameraToggle />));
  });

  it('on and watching, feed shown and hidden', () => {
    for (const showCameraFeed of [true, false]) {
      h.store = { cameraEnabled: true, showCameraFeed };
      check(render(<CameraToggle />));
    }
  });

  it('on but nothing is watching (a problem title), and with a pause or meeting note', () => {
    h.store = { cameraEnabled: true, showCameraFeed: true };
    check(render(<CameraToggle problem="⟦Kamera läuft nicht⟧" />));
    const paused = watchNote({ kind: 'paused', until: NOW + 15 * MIN, releaseCamera: false }, NOW);
    const meeting = watchNote({ kind: 'meeting', until: NOW + 60 * MIN }, NOW);
    expect(paused && meeting).toBeTruthy();
    check(render(<CameraToggle note={paused} />));
    check(render(<CameraToggle note={meeting} />));
  });

  it('CameraPanel: off, on, and every reason the camera did not start', () => {
    h.store = { cameraEnabled: false };
    check(render(<CameraPanel />));
    h.store = { cameraEnabled: true, showCameraFeed: true };
    check(render(<CameraPanel />));
    for (const kind of ['insecure-context', 'permission-denied', 'no-camera', 'unavailable'] as const) {
      h.camError = { kind };
      const html = render(<CameraPanel />);
      check(html);
      expect(html).toContain(CAMERA_ERROR_MESSAGE[kind]); // the message of that kind, in the language showing
      expect(html).toContain('Kamera läuft nicht'); // the title on the card above it
    }
  });

  it('CameraPanel: the models failed to load after the camera started (the title says detection is not running)', () => {
    h.store = { cameraEnabled: true, showCameraFeed: true };
    h.status = 'error';
    forceState(false, true);
    const html = render(<CameraPanel />);
    check(html);
    expect(html).toContain('Erkennung läuft nicht');
    expect(html).toContain(modelErrorMessage());
  });
});

describe('the camera frame, pseudo-locale', () => {
  usePseudoLocale({ flags: ['background_watching'] });

  it('the badge in every status', () => {
    for (const status of ['idle', 'loading', 'watching', 'alert', 'error'] as const) {
      check(render(<DetectionStatus status={status} cameraEnabled />));
    }
  });

  it('the surface: every status with the feed shown and hidden, off, flashing, and a failure with its retry', () => {
    for (const status of ['idle', 'loading', 'watching', 'alert', 'error'] as const) {
      for (const showFeed of [true, false]) {
        check(render(<DetectionSurface videoRef={videoRef} status={status} cameraEnabled showFeed={showFeed} showFlash={status === 'alert'} />));
      }
    }
    check(render(<DetectionSurface videoRef={videoRef} status="idle" cameraEnabled={false} showFeed={false} showFlash={false} />));
    const failed = render(<DetectionSurface videoRef={videoRef} status="idle" cameraEnabled showFeed showFlash={false} cameraError={CAMERA_ERROR_MESSAGE['no-camera']} onRetry={() => {}} />);
    check(failed);
    expect(failed).toContain('Erneut versuchen');
    const model = render(<DetectionSurface videoRef={videoRef} status="error" cameraEnabled showFeed showFlash={false} onRetry={() => {}} />);
    check(model);
    expect(model).toContain(modelErrorMessage());
  });

  it('CameraView: the mini-window button, before and after it is used, and while the models or the camera fail', () => {
    h.store = { cameraEnabled: true, showCameraFeed: true };
    check(render(<CameraView videoRef={videoRef} />));
    h.pip.active = true;
    check(render(<CameraView videoRef={videoRef} />));
    h.pip.active = false;
    h.status = 'alert';
    check(render(<CameraView videoRef={videoRef} />));
    h.status = 'error';
    check(render(<CameraView videoRef={videoRef} />));
    h.status = 'watching';
    check(render(<CameraView videoRef={videoRef} cameraError={CAMERA_ERROR_MESSAGE['permission-denied']} />));
  });

  it('CameraView: no mini-window button where the browser has none', () => {
    h.store = { cameraEnabled: true };
    h.pip.supported = false;
    const html = render(<CameraView videoRef={videoRef} />);
    check(html);
    expect(html).not.toContain('Minimieren');
  });

  it('the wave: the label under it, for each detection status it can be given', () => {
    check(render(<DetectionWave />));
    for (const detectionStatus of ['idle', 'loading', 'watching', 'alert', 'error'] as const) {
      check(render(<DetectionWave detectionStatus={detectionStatus} />));
    }
  });
  // The wave writes its other labels (Detected!, Loading models…, Model error, Waiting…) into the DOM from effects, which do not run in
  // node. They are looked up by id in WAVE_LABEL, typed against the catalog, so a key without a German text fails catalogs.test.ts;
  // this test makes sure each exists and is translated.
  it('the wave: every label it can write into the DOM has a German text', () => {
    const waveKeys = (Object.keys(watchMessages) as Array<keyof typeof watchMessages>).filter(k => k.startsWith('wave.'));
    expect(waveKeys).toHaveLength(5);
    check(render(<ul>{waveKeys.map(k => <li key={k}>{tWatch(k)}</li>)}</ul>));
    for (const k of waveKeys) expect(tWatch(k), k).not.toBe(`⟦${watchMessages[k]}⟧`); // translated, not the English fallback
  });

  it('the camera error texts: one per kind, and for the models', () => {
    const kinds = ['insecure-context', 'permission-denied', 'no-camera', 'unavailable'] as const;
    const html = render(<ul>{kinds.map(k => <li key={k}>{CAMERA_ERROR_MESSAGE[k]}</li>)}<li>{modelErrorMessage()}</li></ul>);
    check(html);
    expect(new Set(kinds.map(k => CAMERA_ERROR_MESSAGE[k])).size).toBe(4);
  });

  it('the English constant the landing-page demo reads is still the English text', () => {
    expect(MODEL_ERROR_MESSAGE).toBe("Detection couldn't load. Check your connection and try again.");
  });
});

describe('the mini window, pseudo-locale', () => {
  usePseudoLocale({ flags: ['background_watching'] });
  const pipWindow = { document: { body: {} } } as unknown as Window;

  it('every status, and stopped', () => {
    h.store = { cameraEnabled: true };
    for (const status of ['idle', 'loading', 'watching', 'alert', 'error'] as const) {
      check(render(<PiPWindow pipWindow={pipWindow} status={status} />));
    }
    h.store = { cameraEnabled: false };
    check(render(<PiPWindow pipWindow={pipWindow} status="idle" />));
  });

  it('paused (a two-line status and a Resume button) and in a meeting', () => {
    h.store = { cameraEnabled: true };
    dispatchWatch({ type: 'pause', now: NOW, minutes: 15, releaseCamera: false });
    const paused = render(<PiPWindow pipWindow={pipWindow} status="watching" />);
    check(paused);
    expect(paused).toContain('Fortsetzen');
    dispatchWatch({ type: 'resume' });
    dispatchWatch({ type: 'meeting', now: NOW, minutes: 60 });
    check(render(<PiPWindow pipWindow={pipWindow} status="watching" />));
  });

  // The "Not a bite" button inside the strip (NotABiteSeam surface="pip") reads the controller through useSyncExternalStore, and a server
  // render always takes the disarmed snapshot, so it is rendered on its own below (PipButton), not through the strip.
});

describe('the alarm, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('the overlay: the flash and the coaching and "Not a bite" seams (disarmed) around it', () => {
    check(render(<AlertOverlay visible />));
    expect(render(<AlertOverlay visible={false} />)).toBe('');
  });

  it('the "Not a bite" toast and the mini-window button in every phase', () => {
    const offered: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'offered' } };
    const marked: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'marked' } };
    const calibrate: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'marked', suggestCalibration: true } };
    for (const state of [offered, marked, calibrate]) {
      check(render(<ToastBody state={state} />));
      check(render(<PipButton state={state} />));
    }
    const html = render(<ToastBody state={calibrate} />);
    expect(html).toContain('Kalibrieren');
    expect(html).toContain('Rückgängig');
    expect(render(<ToastBody state={{ armed: true, offer: null }} />)).toContain('role="status"');
  });

  it('the seam itself draws nothing on a server render (it takes the disarmed snapshot); its two views are rendered above', () => {
    notABite.arm({ mark: () => {}, undo: () => {} });
    notABite.offer('a');
    expect(render(<NotABiteSeam surface="pip" />)).toBe('');
    expect(render(<NotABiteSeam surface="main" />)).toBe('');
  });

  it('alarm text: the tab title and the OS notification, and the file that sets them uses only the alarm scope', () => {
    const html = render(<ul>{(['alert.tabTitle', 'alert.notification.title', 'alert.notification.body'] as const).map(k => <li key={k}>{tAlarm(k)}</li>)}</ul>);
    check(html);
    expect(html).toContain('Nicht beißen!');
    const source = readFileSync(new URL('../../hooks/useDetection.ts', import.meta.url), 'utf8');
    expect(source).toContain("t('alert.tabTitle')");
    expect(source).toContain("t('alert.notification.title')");
    expect(source).toContain("t('alert.notification.body')");
    expect(source).toMatch(/from '\.\.\/i18n\/scopes\/alarm'/);
    expect(source).not.toMatch(/scopes\/watch|i18n\/format/);
  });

  it('the "Hands check" reminder: title, and a whole body for each suggestion', () => {
    const bodies = Array.from({ length: SUGGESTION_COUNT }, (_, n) => reminderBody(n));
    const html = render(<ul><li>{tAlarm('reminder.title')}</li>{bodies.map(b => <li key={b}>{b}</li>)}</ul>);
    check(html);
    expect(new Set(bodies).size).toBe(SUGGESTION_COUNT);
    expect(reminderBody(SUGGESTION_COUNT)).toBe(reminderBody(0)); // it wraps
    expect(Object.keys(alarmMessages).filter(k => k.startsWith('reminder.body.'))).toHaveLength(SUGGESTION_COUNT);
  });
});

describe('the streak, the session and today, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('StreakHero: a new account (nothing to count from yet, no best)', () => {
    h.store = { lastBiteTime: null, firstOpenTime: NOW - 5 * MIN, bestStreakMs: 0 };
    const html = render(<StreakHero />);
    check(html);
    expect(html).toContain('noch keiner');
  });

  it('StreakHero: since a bite today, yesterday, and on an earlier day (with days on the clock and the badge)', () => {
    const seen = new Set<string>();
    for (const [lastBiteTime, bestStreakMs] of [[at(0, 10), 5 * 60 * MIN + 20 * MIN], [at(1, 21, 30), 90 * MIN], [at(4, 8), 26 * 60 * MIN]] as const) {
      h.store = { lastBiteTime, firstOpenTime: at(30, 8), bestStreakMs };
      const html = render(<StreakHero />);
      check(html);
      seen.add(html.match(/Seit deinem letzten Biss[^<]*/)![0].replace(/[\d:]+/g, '#'));
    }
    expect(seen.size).toBe(3); // today, yesterday, a date
  });

  it('StreakHero: a long streak shows the badge', () => {
    h.store = { lastBiteTime: null, firstOpenTime: NOW - 3 * DAY, bestStreakMs: 2 * 60 * MIN };
    const html = render(<StreakHero />);
    check(html);
    expect(html).toContain('Läuft bei dir');
  });

  it('SessionGoal: not shown before a session, running, paused, and the goal reached', () => {
    h.store = { cameraEnabled: false };
    expect(render(<SessionGoal />)).toBe('');
    h.store = { cameraEnabled: true };
    forceState(0, 12 * MIN + 34_000);
    check(render(<SessionGoal />));
    h.store = { cameraEnabled: false };
    forceState(0, 7 * MIN);
    const paused = render(<SessionGoal />);
    check(paused);
    expect(paused).toContain('Pausiert.');
    h.store = { cameraEnabled: true };
    forceState(0, 26 * MIN);
    const done = render(<SessionGoal />);
    check(done);
    expect(done).toContain('Ziel erreicht!');
  });

  it('TodayStats: nothing today, and a day with alarms and bites', () => {
    h.store = { incidents: [] };
    check(render(<TodayStats />));
    h.store = {
      incidents: [
        rec('a', at(0, 9), 'auto-detected', true),
        rec('b', at(0, 10), 'auto-detected', true),
        rec('c', at(0, 11), 'stress', false),
        rec('d', at(0, 12), 'urge', false),
      ],
    };
    check(render(<TodayStats />));
  });
});

describe('the sheet and the card after an alarm, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('PanicButton: the button, the question with the reasons (and a custom one), and the confirmation', () => {
    h.store = { customTags: [commute] };
    const button = render(<PanicButton />);
    check(button);
    expect(button).toContain('Ich habe gerade an den Nägeln gekaut');

    forceState(false, true); // the sheet is open
    const sheet = render(<PanicButton />);
    check(sheet);
    expect(sheet).toContain('Was hat es ausgelöst?');
    expect(sheet).toContain('Abbrechen');
    expect(sheet).toContain('Commute');

    forceState(null, { id: 'x', label: 'Commute' }); // a bite was just logged
    const logged = render(<PanicButton />);
    check(logged);
    expect(logged).toContain('Rückgängig');
    forceState(null, { id: 'x', label: '⟦Stress⟧' });
    check(render(<PanicButton />)); // the live region says it too
  });

  it('ReplacementPrompt: each of the four suggestions, with a custom reason', () => {
    h.store = { customTags: [commute] };
    const seen = new Set<string>();
    for (let k = 0; k < SUGGESTION_COUNT; k += 1) {
      h.store = { customTags: [commute], incidents: [rec('a', NOW - 30_000 + k, 'auto-detected', true)] };
      const html = render(<ReplacementPrompt />);
      check(html);
      expect(html).toContain('Biss, Grund unklar'); // "Not sure" is worded as a bite
      seen.add(suggestion(NOW - 30_000 + k));
    }
    expect(seen.size).toBe(SUGGESTION_COUNT);
  });

  it('ReplacementPrompt: nothing to ask when the last alarm is old or already answered', () => {
    h.store = { incidents: [rec('a', NOW - 3 * 60 * MIN, 'auto-detected', true)] };
    expect(render(<ReplacementPrompt />)).toBe('');
    h.store = { incidents: [] };
    expect(render(<ReplacementPrompt />)).toBe('');
  });
});

describe('the false-alarm rate, pseudo-locale', () => {
  usePseudoLocale({ flags: ['false_positive_controls'] });

  // [alarms, marked] this week and the week before
  const history = (thisWeek: [number, number], lastWeek: [number, number]): Incident[] => {
    const out: Incident[] = [];
    const add = (week: number, [alarms, marked]: [number, number]) => {
      for (let i = 0; i < alarms; i += 1) out.push(rec(`w${week}-${i}`, NOW - (week * 7 + 1) * DAY - i * MIN, 'auto-detected', true, i < marked ? { falsePositive: true } : {}));
    };
    add(0, thisWeek);
    add(1, lastWeek);
    return out;
  };

  it('every sentence: alone (1 alarm, few alarms), down, up, about the same', () => {
    const cases: Array<[string, [number, number], [number, number]]> = [
      ['one alarm', [1, 1], [0, 0]],
      ['two alarms, no comparison', [2, 1], [5, 2]],
      ['down', [4, 1], [4, 2]],
      ['up', [4, 3], [4, 1]],
      ['about the same', [4, 2], [4, 2]],
    ];
    const sentences = new Set<string>();
    for (const [name, week, before] of cases) {
      const sentence = describeFalsePositiveRate(falsePositiveRates(history(week, before), NOW));
      expect(sentence, name).not.toBeNull();
      check(render(<p>{sentence}</p>));
      sentences.add(sentence!.replace(/\d+/g, '#'));
      check(render(<FalsePositiveRate incidents={history(week, before)} />));
    }
    expect(sentences.size).toBe(5);
    expect(describeFalsePositiveRate(falsePositiveRates([], NOW))).toBeNull();
  });
});

describe('the false-alarm rate with the flag off, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });
  it('renders nothing', () => {
    expect(render(<FalsePositiveRate incidents={[rec('a', NOW - DAY, 'auto-detected', true)]} />)).toBe('');
  });
});

describe('the suggestions, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('each of the four, and it wraps around', () => {
    const list = Array.from({ length: SUGGESTION_COUNT }, (_, n) => suggestion(n));
    check(render(<ul>{list.map(s => <li key={s}>{s}</li>)}</ul>));
    expect(new Set(list).size).toBe(SUGGESTION_COUNT);
    expect(suggestion(SUGGESTION_COUNT + 1)).toBe(suggestion(1));
  });
});

describe('English is unchanged for a person who never picks a language', () => {
  it('the suggestions, the reminder and the camera errors read as before', () => {
    expect(suggestion(0)).toBe('Press thumb to each fingertip');
    expect(suggestion(1)).toBe('Clench and release fist · 5×');
    expect(suggestion(3)).toBe('Sip water mindfully');
    expect(reminderBody(2)).toBe("Where are your hands? If they're near your face, try: exhale slowly through your nose.");
    expect(reminderBody(1)).toBe("Where are your hands? If they're near your face, try: clench and release fist · 5×.");
    expect(CAMERA_ERROR_MESSAGE['no-camera']).toBe('No camera found. The detector needs a webcam to watch for your hands.');
    expect(tAlarm('alert.notification.body')).toBe('Nail biting detected — take your hands away.');
    expect(tAlarm('alert.tabTitle')).toBe('⚠️ Stop biting! – Stop Biting');
  });

  // The words on the screen, as the code printed them before the extraction (tags dropped, spaces folded).
  const words = (html: string) => html
    .replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    h.auth = { user: { id: 'u', name: 'Ana Maria', trial_end_date: null }, accessStatus: 'subscribed' };
  });

  it('the dashboard heading, per time of day, with a name and without', () => {
    const heading = (hour: number, name: string | null) => {
      vi.setSystemTime(new Date(2026, 9, 23, hour).getTime());
      h.auth = { user: { id: 'u', name, trial_end_date: null }, accessStatus: 'subscribed' };
      return words(render(<Dashboard />).match(/<h1[^>]*>.*?<\/h1>/)![0]);
    };
    expect(heading(9, 'Ana Maria')).toBe('Good morning, Ana .');
    expect(heading(14, 'Ana Maria')).toBe('Good afternoon, Ana .');
    expect(heading(20, null)).toBe('Good evening, there .');
    h.store = { cameraEnabled: false };
    vi.setSystemTime(NOW);
    h.auth = { user: { id: 'u', name: 'Ana', trial_end_date: new Date(NOW + 5 * DAY).toISOString() }, accessStatus: 'trial_active' };
    expect(words(render(<Dashboard onUpgrade={() => {}} />))).toContain('Free trial: 5 days left. Choose a plan');
  });

  it('the camera card', () => {
    h.store = { cameraEnabled: false };
    expect(words(render(<CameraToggle />))).toBe(
      'Start the alarm Your browser will ask to use the camera. Keep this tab open while you work; the alarm sounds when a hand reaches your mouth. Start detection No camera data is sent while it runs',
    );
    h.store = { cameraEnabled: true, showCameraFeed: true };
    expect(words(render(<CameraToggle />))).toBe('Detection active Runs on this device Stop Show camera feed');
    expect(words(render(<CameraToggle problem="Camera not running" />))).toBe('Camera not running See below for how to fix it Stop Show camera feed');
    h.camError = { kind: 'permission-denied' };
    expect(words(render(<CameraPanel />))).toContain("Camera not running See below for how to fix it");
    expect(words(render(<CameraPanel />))).toContain("Camera access was blocked. Allow it from the camera icon in your browser's address bar, then try again. Try again");
  });

  it('the badge, the mini window and the overlay', () => {
    expect(['idle', 'loading', 'watching', 'alert', 'error'].map(s => words(render(<DetectionStatus status={s as 'idle'} cameraEnabled />))))
      .toEqual(['Detection off', 'Loading detection…', 'Watching', 'Hands near mouth', "Detection couldn't load"]);
    h.store = { cameraEnabled: true };
    h.pip.supported = true;
    expect(words(render(<CameraView videoRef={videoRef} />))).toContain('Minimize');
    const strip = { document: { body: {} } } as unknown as Window;
    expect(['idle', 'loading', 'watching', 'alert', 'error'].map(s => words(render(<PiPWindow pipWindow={strip} status={s as 'idle'} />))))
      .toEqual(['Waiting Stop', 'Starting Stop', 'Watching Stop', 'Nail biting detected Stop', 'Not running Stop']);
    expect(words(render(<AlertOverlay visible />))).toBe('Hands down Press your thumb to each fingertip.');
    const offered: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'offered' } };
    expect(words(render(<ToastBody state={offered} />))).toBe('Alarm. If it was a false alarm, press Not a bite. Alarm. Only resting your hand? Not a bite ×');
  });

  it('the cards of the Watch tab', () => {
    h.store = { lastBiteTime: null, firstOpenTime: NOW - 5 * MIN, bestStreakMs: 0 };
    expect(words(render(<StreakHero />))).toBe("Current streak 00 hrs : 05 min Since you started. A bite resets it; an alarm doesn't. Best: none yet");
    h.store = { lastBiteTime: at(0, 10), firstOpenTime: at(30, 8), bestStreakMs: 5 * 60 * MIN };
    expect(words(render(<StreakHero />))).toMatch(/Since your last bite, today at 10:00( ?[AaPp][Mm])?\./); // the clock follows the browser's own format
    h.store = { lastBiteTime: at(1, 21, 30), firstOpenTime: at(30, 8), bestStreakMs: 5 * 60 * MIN };
    expect(words(render(<StreakHero />))).toMatch(/Since your last bite, yesterday at (09:30 ?[Pp][Mm]|21:30)\./);
    h.store = { lastBiteTime: at(4, 8), firstOpenTime: at(30, 8), bestStreakMs: 5 * 60 * MIN };
    expect(words(render(<StreakHero />))).toMatch(/Since your last bite, Mon,? (Oct 19|19 Oct) at (08:00 ?[Aa][Mm]|08:00)\./);

    h.store = { cameraEnabled: true };
    forceState(0, 26 * MIN);
    expect(words(render(<SessionGoal />))).toBe('Session 26:00 / 25m goal Goal reached!');
    h.store = { cameraEnabled: false };
    forceState(0, 7 * MIN);
    expect(words(render(<SessionGoal />))).toBe('Session 07:00 / 25m goal Paused. Start detection to carry on.');

    h.store = { incidents: [rec('a', at(0, 9), 'auto-detected', true), rec('b', at(0, 10), 'auto-detected', true), rec('c', at(0, 11), 'stress', false)] };
    expect(words(render(<TodayStats />))).toBe('Today 2 alarms to review 1 bites');

    h.store = { customTags: [commute] };
    expect(words(render(<PanicButton />))).toBe('I just bit my nails');
    forceState(false, true);
    expect(words(render(<PanicButton />))).toBe('What triggered it? Stress Deep focus Boredom Not sure 🚌 Commute Cancel');
    forceState(null, { id: 'x', label: 'Stress' });
    expect(words(render(<PanicButton />))).toBe('Logged: Stress. Your streak starts again from now. Logged: Stress. Your streak starts again from now. Undo');

    h.store = { customTags: [commute], incidents: [rec('a', NOW - 30_000, 'auto-detected', true)] };
    expect(words(render(<ReplacementPrompt />))).toBe(
      'Alarm: try this instead Press thumb to each fingertip If it was a bite, what set it off? Stress Deep focus Boredom Bite, not sure why 🚌 Commute Not a bite, just my hand nearby',
    );
  });

  it('the false-alarm rate sentences', () => {
    const entries = (a: number, m: number, week: number) => Array.from({ length: a }, (_, i) => rec(`${week}-${i}`, NOW - (week * 7 + 1) * DAY - i * MIN, 'auto-detected', true, i < m ? { falsePositive: true } : {}));
    const say = (a: number, m: number, b: number, bm: number) => describeFalsePositiveRate(falsePositiveRates([...entries(a, m, 0), ...entries(b, bm, 1)], NOW));
    expect(say(1, 1, 0, 0)).toBe('1 of 1 alarm in the last 7 days marked not a bite (100%).');
    expect(say(2, 1, 5, 2)).toBe('1 of 2 alarms in the last 7 days marked not a bite (50%).');
    expect(say(4, 1, 4, 2)).toBe('1 of 4 alarms in the last 7 days marked not a bite (25%), down from 2 of 4 (50%) the 7 days before.');
    expect(say(4, 3, 4, 1)).toBe('3 of 4 alarms in the last 7 days marked not a bite (75%), up from 1 of 4 (25%) the 7 days before.');
    expect(say(4, 2, 4, 2)).toBe('2 of 4 alarms in the last 7 days marked not a bite (50%), about the same as 2 of 4 (50%) the 7 days before.');
  });
});
