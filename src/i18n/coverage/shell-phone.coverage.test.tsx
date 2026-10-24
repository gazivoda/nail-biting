// Pseudo-locale coverage for the app shell (scope "shell": tab bar, install banner and guide, onboarding tour,
// desktop camera notice) and the phone view (scope "phone": the two big buttons, today's line, recent entries, the log
// toast, the sync note, and the text helpers behind them). Each state is rendered with the German catalog on and every
// t() result marked; no word may be left outside the marks. A second block renders the same screens in English and
// pins the markup a person who never picks a language sees.
//
// Not reachable in a static render: the stateful body of OnboardingTour (a portal that measures the page), the card
// DesktopCameraNotice shows after an IPC message, and the "sync is on" state of the phone's sync note (a server render
// reads the opt-in's server snapshot, which is "not opted in"). The first two are covered through the components that
// hold all their words (TourCardContent, CameraNoticeCard); the third through syncNoteFor, which holds its sentence.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, setFlags, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { findUnmarkedEnglish } from '../testing/scan';
import { resetLocaleForTests } from '../core';
import { getFlags } from '../../features/flags';
import { messages as shellMessages } from '../scopes/shell';
import { messages as phoneMessages } from '../scopes/phone';
import type { CustomTag, Incident } from '../../types';

const auth = vi.hoisted(() => ({ ctx: { user: null as unknown, accessStatus: 'no_auth' as string } }));
vi.mock('../../contexts/AuthContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../../contexts/AuthContext')>()),
  useAuth: () => ({
    ...auth.ctx, signingIn: false, signInWithGoogle: () => {}, signOut: async () => {}, refreshProfile: async () => {},
    authError: null, clearAuthError: () => {},
  }),
}));

// The hooks that read the browser (install prompt, install guide, the phone-view flag) are replaced by plain values.
const browser = vi.hoisted(() => ({
  canInstall: false, bannerDismissed: false,
  guideVisible: true, platform: 'ios' as string,
  phoneView: false,
}));
vi.mock('../../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    canInstall: browser.canInstall, installed: false, bannerDismissed: browser.bannerDismissed,
    triggerInstall: async () => false, dismissBanner: () => {},
  }),
}));
vi.mock('../../hooks/usePWAGuide', () => ({
  usePWAGuide: () => ({ visible: browser.guideVisible, platform: browser.platform, snooze: () => {}, dismiss: () => {} }),
}));
vi.mock('../../phone/activeStore', async importOriginal => ({
  ...(await importOriginal<typeof import('../../phone/activeStore')>()),
  usePhoneViewActive: () => browser.phoneView,
}));

// A server render reads a flag's server snapshot (always off); the phone view should see the flags a test turned on.
vi.mock('../../features/useFeature', async () => {
  const { getFlags: read } = await import('../../features/flags');
  return { useFeature: (name: string) => (read() as Record<string, boolean>)[name] === true, useFeatures: () => read() };
});

// Components that belong to other groups and have their own coverage test: out of the way, so this file fails only for
// words of the shell and the phone view.
vi.mock('../../components/dashboard/StreakHero', () => ({ StreakHero: () => null }));
vi.mock('../../coaching/UrgeTimer', () => ({ UrgeTimer: () => null }));
vi.mock('../../sync/statusText', async importOriginal => ({
  ...(await importOriginal<typeof import('../../sync/statusText')>()),
  describeStatus: () => ({ headline: '⟦Status⟧', detail: '', tone: 'ok' }),
}));

// The store, with the state a test wants laid over the real one (the same way settings-core.coverage.test.tsx does).
const store = vi.hoisted(() => ({ over: {} as Record<string, unknown> }));
vi.mock('../../store/useAppStore', async importOriginal => {
  const real = await importOriginal<typeof import('../../store/useAppStore')>();
  const useAppStore = ((selector?: (s: unknown) => unknown) => {
    const state = { ...real.useAppStore.getState(), ...store.over };
    return selector ? selector(state) : state;
  }) as typeof real.useAppStore;
  return { ...real, useAppStore };
});

import { TabBar } from '../../components/layout/TabBar';
import { PageHeader } from '../../components/layout/PageHeader';
import { PWAInstallPrompt } from '../../components/PWAInstallPrompt';
import { PWAGuideModal } from '../../components/PWAGuideModal';
import { TourCardContent, OnboardingTour } from '../../components/onboarding/OnboardingTour';
import { CameraNoticeCard, DesktopCameraNotice } from '../../desktop/DesktopCameraNotice';
import type { DesktopAPI } from '../../desktop/ipc';
import PhoneView from '../../phone/PhoneView';
import { RecentList, TodayLine } from '../../phone/RecentList';
import { LogToast } from '../../phone/LogToast';
import { SyncNoteView } from '../../phone/SyncNoteView';
import { describeEntry, recentRows, todaySentence, whenLabel, type TodayCounts } from '../../phone/history';
import { toastMessage } from '../../phone/toastText';
import { syncNoteFor, PHONE_ONLY, PHONE_ONLY_CAN_SYNC } from '../../phone/syncNote';
import { PHONE_SHARE, shareToComputer } from '../../utils/phoneLink';
import { PRESET_TAGS, type TagOption } from '../../components/dashboard/triggerTags';
import type { LogFlow, LogToast as Toast } from '../../phone/logFlow';

export const COVERS = [
  'src/components/layout/TabBar.tsx',
  'src/components/layout/PageHeader.tsx',
  'src/components/PWAInstallPrompt.tsx',
  'src/components/PWAGuideModal.tsx',
  'src/components/onboarding/OnboardingTour.tsx',
  'src/desktop/DesktopCameraNotice.tsx',
  'src/phone/PhoneView.tsx',
  'src/phone/RecentList.tsx',
  'src/phone/LogToast.tsx',
  'src/phone/SyncNoteView.tsx',
  'src/phone/history.ts',
  'src/phone/toastText.ts',
  'src/phone/syncNote.ts',
  'src/utils/phoneLink.ts',
];
// NOT-RENDERED src/App.tsx: the router, the auth provider and every lazy page cannot mount in node; its one word, the screen-reader "Loading…" of AppLoading, is the common scope's `loading` message, translated and checked in the catalog parity test.

// What a person typed (a custom bite reason) is shown as typed. The trial countdown sentence ("Less than an hour left")
// comes from utils/trial.ts, owned by the billing group.
const FIXTURE = ['Commute', 'Ana', 'ana', 'example', 'com', /^(days?|hours?|left|Less|than|an)$/];

const DAY = 86_400_000;
const DAYS_LEFT = 3; // days left in the phone-view fixture (scripts/trialLength.test.mjs: no trial-length literal)
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const person = (over: Record<string, unknown> = {}) => ({
  id: 'u1', email: 'ana@example.com', name: 'Ana', avatar: null, trial_end_date: null, subscription_status: 'expired',
  subscription_plan: null, subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, ...over,
});

// A message that takes another message as a parameter ("Bite, {reason}" with a tag label) comes out marked twice,
// ⟦Biss, ⟦Stress⟧⟧. Only the outer marks matter to the scan, so the inner ones are dropped first.
function flattenMarks(html: string): string {
  let depth = 0;
  let out = '';
  for (const ch of html) {
    if (ch === '⟦') { depth += 1; if (depth === 1) out += ch; continue; }
    if (ch === '⟧') { if (depth === 1) out += ch; depth = Math.max(0, depth - 1); continue; }
    out += ch;
  }
  return out;
}
const check = (html: string, allow: Array<string | RegExp> = FIXTURE) => {
  expectAllTranslated(flattenMarks(html), { allow });
  expectNoMissingParams(html);
};

beforeEach(() => {
  auth.ctx = { user: null, accessStatus: 'no_auth' };
  browser.canInstall = false; browser.bannerDismissed = false; browser.guideVisible = true; browser.platform = 'ios'; browser.phoneView = false;
  store.over = {};
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Tab bar ──────────────────────────────────────────────────────────────────

describe('tab bar, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });
  const bar = (active: 'dashboard' | 'log' | 'settings' = 'dashboard') =>
    renderToStaticMarkup(<TabBar active={active} onChange={() => {}} onUpgrade={() => {}} />);

  it('every tab active, signed out: labels, navigation and the privacy line are translated', () => {
    for (const tab of ['dashboard', 'log', 'settings'] as const) {
      const html = bar(tab);
      check(html);
      expect(html).toContain('Überwachen');
      expect(html).toContain('Verlauf');
      expect(html).toContain('Einstellungen');
      expect(html).toContain('Hauptnavigation');
      expect(html).toContain('Während die Erkennung läuft, werden keine Kameradaten gesendet');
      expect(html).not.toContain('Abmelden'); // signed out: no account block
    }
  });

  it('phone view: the first tab is "Heute"', () => {
    browser.phoneView = true;
    const html = bar();
    check(html);
    expect(html).toContain('Heute');
    expect(html).not.toContain('Überwachen');
  });

  it('subscribed account: name, "Abonniert", sign out', () => {
    auth.ctx = { user: person({ subscription_status: 'active' }), accessStatus: 'subscribed' };
    const html = bar();
    check(html);
    expect(html).toContain('Abonniert');
    expect(html).toContain('Abmelden');
    expect(html).not.toContain('Kostenlose Testphase');
  });

  it('free account without a name falls back to the email', () => {
    auth.ctx = { user: person({ name: null }), accessStatus: 'free_tier' };
    const html = bar();
    check(html);
    expect(html).toContain('ana@example.com');
  });

  it('trial: days (many, one, rounded up), hours (many, one), under an hour, and no date', () => {
    const cases: Array<[string, string | null, string[]]> = [
      ['5 days', iso(5 * DAY - HOUR), ['>5<', 'Tage übrig']],
      ['1 day', iso(DAY + HOUR), ['>2<', 'Tage übrig']],
      ['exactly 1 day', iso(DAY + 60_000), ['>2<', 'Tage übrig']],
      ['hours', iso(5 * HOUR + 60_000), ['>5<', 'Stunden übrig']],
      ['one hour', iso(HOUR + 60_000), ['>1<', 'Stunde übrig']],
      ['no date', null, ['Endet heute']],
    ];
    for (const [name, end, expected] of cases) {
      auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: end }), accessStatus: 'trial_active' };
      const html = bar();
      check(html);
      expect(html, name).toContain('Kostenlose Testphase');
      expect(html, name).toContain('Upgrade');
      for (const piece of expected) expect(html, `${name}: ${piece}`).toContain(piece);
    }
    // one day: the number is 1 and the unit is singular
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(DAY - 1000) }), accessStatus: 'trial_active' };
    expect(bar()).toContain('Stunden übrig'); // inside the last day the count is in hours (23 of them)
    // under an hour: the sentence comes from trialLeft() (billing group)
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(30 * 60_000) }), accessStatus: 'trial_active' };
    const under = bar();
    check(under);
    expect(under).not.toContain('Tage übrig');
  });

  it('the install button shows when the browser can install', () => {
    browser.canInstall = true;
    const html = bar();
    check(html);
    expect(html).toContain('App installieren');
  });

  it('PageHeader has only the words it is given', () => {
    const html = renderToStaticMarkup(<PageHeader title={'⟦Verlauf⟧'} right={<span>{'⟦Mehr⟧'}</span>} />);
    check(html);
  });
});

// ── Install banner and guide ─────────────────────────────────────────────────

describe('install banner and guide, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('install banner', () => {
    browser.canInstall = true;
    const html = renderToStaticMarkup(<PWAInstallPrompt />);
    check(html);
    expect(html).toContain('Stop Biting installieren');
    expect(html).toContain('Zum Home-Bildschirm hinzufügen');
    expect(html).toContain('App installieren');
    expect(html).toContain('aria-label="⟦Ausblenden⟧"');
  });

  it('install banner is absent when the browser cannot install, or after it was dismissed', () => {
    expect(renderToStaticMarkup(<PWAInstallPrompt />)).toBe('');
    browser.canInstall = true; browser.bannerDismissed = true;
    expect(renderToStaticMarkup(<PWAInstallPrompt />)).toBe('');
  });

  it('guide on iOS: benefits, the three steps, the Safari note, the footer', () => {
    const html = renderToStaticMarkup(<PWAGuideModal />);
    check(html);
    for (const piece of ['So installierst du auf iOS', 'Tippe auf „Teilen“', 'Tippe auf „Zum Home-Bildschirm“', 'Tippe auf „Hinzufügen“', 'Zum Installieren in Safari öffnen', 'Vielleicht später', 'Erkennung im Hintergrund']) {
      expect(html, piece).toContain(piece);
    }
    expect(html).toContain('<strong>⟦Safari⟧</strong>'); // the bold word is the rich tag's content
    expect(html).toContain('aria-label="⟦Ausblenden⟧"');
    expect(html).toContain('alt="⟦Stop-Biting-Symbol⟧"');
  });

  it('guide on a Chromium browser that can install: the one-click install button', () => {
    browser.platform = 'chromium'; browser.canInstall = true;
    const html = renderToStaticMarkup(<PWAGuideModal />);
    check(html);
    expect(html).toContain('Mit einem Klick installieren');
    expect(html).toContain('Stop Biting installieren');
    expect(html).toContain('Kein App-Store nötig');
  });

  it('guide inside the phone view: the benefits are about the phone view', () => {
    browser.phoneView = true;
    for (const platform of ['ios', 'chromium']) {
      browser.platform = platform; browser.canInstall = true;
      const html = renderToStaticMarkup(<PWAGuideModal />);
      check(html);
      expect(html).toContain('Mit ein, zwei Tipps erfassen');
      expect(html).toContain('Funktioniert ohne Empfang');
      expect(html).not.toContain('Erkennung im Hintergrund');
    }
  });

  it('guide waits for the browser to offer the prompt on Chromium, and stays away when not visible', () => {
    browser.platform = 'chromium'; browser.canInstall = false;
    expect(renderToStaticMarkup(<PWAGuideModal />)).toBe('');
    browser.guideVisible = false; browser.platform = 'ios';
    expect(renderToStaticMarkup(<PWAGuideModal />)).toBe('');
  });
});

// ── Onboarding tour ──────────────────────────────────────────────────────────

describe('onboarding tour, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });
  const STEP_TITLES = ['Das ist der Detektor', 'Kamerabild bleibt verborgen', 'Deine Serie', 'Gebissen und der Alarm hat es nicht bemerkt?', 'Verlauf'];

  it('every step: title, body, progress, skip and next', () => {
    STEP_TITLES.forEach((title, i) => {
      const html = renderToStaticMarkup(<TourCardContent step={i} onSkip={() => {}} onNext={() => {}} />);
      check(html);
      expect(html, `step ${i + 1}`).toContain(title);
      expect(html).toContain(`Schritt ${i + 1} von ${STEP_TITLES.length}`);
      expect(html).toContain('Tour überspringen');
      expect(html).toContain(i < STEP_TITLES.length - 1 ? 'Weiter' : 'Fertig');
    });
  });

  it('the tour is a portal that measures the page: before it opens it renders nothing', () => {
    // (its effects do not run in a static render, so the first step is not reached here)
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768 });
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: () => {} });
    expect(renderToStaticMarkup(<OnboardingTour />)).toBe('');
  });
});

// ── Desktop camera notice ────────────────────────────────────────────────────

describe('desktop camera notice, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });
  const card = (explain: boolean, platform: DesktopAPI['platform'], busy = false) =>
    renderToStaticMarkup(<CameraNoticeCard explain={explain} platform={platform} busy={busy} onPrimary={() => {}} onDismiss={() => {}} />);

  it('before the system asks: what the camera is for, and the macOS line only on a Mac', () => {
    const mac = card(true, 'darwin');
    check(mac);
    for (const piece of ['Kamerazugriff', 'Stop Biting nutzt deine Kamera', 'Als Nächstes bittet dich macOS um deine Erlaubnis.', 'Weiter', 'Jetzt nicht']) expect(mac, piece).toContain(piece);
    for (const platform of ['win32', 'linux'] as const) {
      const other = card(true, platform);
      check(other);
      expect(other).not.toContain('macOS');
    }
  });

  it('camera switched off in the system: the path is the Mac wording on macOS and Linux, the Windows wording on Windows', () => {
    const mac = card(false, 'darwin');
    check(mac);
    for (const piece of ['Die Kamera ist ausgeschaltet', 'Systemeinstellungen, unter Datenschutz &amp; Sicherheit, dann Kamera', 'Einstellungen öffnen', 'Schließen']) expect(mac, piece).toContain(piece);
    const win = card(false, 'win32');
    check(win);
    expect(win).toContain('Einstellungen, unter Datenschutz &amp; Sicherheit, dann Kamera');
    expect(win).not.toContain('Systemeinstellungen');
    check(card(false, 'linux'));
    check(card(true, 'darwin', true)); // busy: same words, buttons disabled
  });

  it('the stateful wrapper shows nothing until main sends a prompt', () => {
    const api = {
      platform: 'darwin',
      camera: { status: () => Promise.resolve({ access: 'unknown', pending: false }), onPrompt: () => () => {}, decline: () => {}, request: () => Promise.resolve(), openSettings: () => {} },
    } as unknown as DesktopAPI;
    expect(renderToStaticMarkup(<DesktopCameraNotice api={api} />)).toBe('');
  });
});

// ── Phone view ───────────────────────────────────────────────────────────────

const T0 = new Date(2026, 9, 23, 15, 0, 0).getTime(); // 23 Oct 2026, 15:00 local
const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m, 0).getTime();
const incidents: Incident[] = [
  { id: 'a', timestamp: at(14, 40), tag: 'stress', autoDetected: false },
  { id: 'b', timestamp: at(14, 10), tag: 'commute', autoDetected: false },
  { id: 'c', timestamp: at(13, 50), tag: 'urge', autoDetected: false, competingResponse: { done: true, durationSec: 60 } } as Incident,
  { id: 'd', timestamp: at(13, 20), tag: 'urge', autoDetected: false },
  { id: 'e', timestamp: at(12, 0), tag: 'auto-detected', autoDetected: true },
  { id: 'f', timestamp: at(11, 0), tag: 'auto-detected', autoDetected: true, falsePositive: true } as Incident,
  { id: 'g', timestamp: at(10, 0), tag: 'auto-detected', autoDetected: true, confirmed: true },
  { id: 'h', timestamp: at(9, 0), tag: 'focus', autoDetected: false },
  { id: 'i', timestamp: at(8, 0), tag: 'who-knows', autoDetected: false },
];
const custom: CustomTag[] = [{ id: 'commute', label: 'Commute', emoji: '🚌' }];

function phoneView(props: { upgrade?: boolean; navigate?: boolean } = {}) {
  return renderToStaticMarkup(
    <PhoneView onUpgrade={props.upgrade ? () => {} : undefined} onNavigate={props.navigate ? () => {} : undefined} />,
  );
}
const at3pm = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0); };

describe('phone view, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('empty, signed in without a name, in the morning: the greeting marks the time-of-day word', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(9));
    auth.ctx = { user: person({ name: '' }), accessStatus: 'subscribed' };
    const html = phoneView();
    check(html);
    expect(html).toContain('⟦Guten ⟧<span class="sg-mark whitespace-nowrap dark:![background:none]">⟦Morgen⟧</span>⟦.⟧');
    for (const piece of ['Ich habe gebissen', 'Ich spüre einen Drang', 'Heute nichts erfasst', 'Zuletzt', 'Noch nichts erfasst', 'Nur auf diesem Handy gespeichert.', 'Die vollständige App auf diesem Gerät öffnen', 'Link für meinen Computer per E-Mail senden']) {
      expect(html, piece).toContain(piece);
    }
    expect(html).toContain('aria-label="⟦Erfassen⟧"');
    expect(html).not.toContain('Alle'); // "Gesamter Verlauf" button only when there are entries
  });

  it('afternoon and evening greetings, with the first name', () => {
    auth.ctx = { user: person(), accessStatus: 'subscribed' };
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(15));
    const afternoon = phoneView();
    check(afternoon);
    expect(afternoon).toContain('⟦Guten Tag⟧⟦, ⟧<span class="sg-mark whitespace-nowrap dark:![background:none]">⟦Ana⟧</span>⟦.⟧');
    vi.setSystemTime(at(20));
    const evening = phoneView();
    check(evening);
    expect(evening).toContain('⟦Guten Abend⟧⟦, ⟧<span');
  });

  it('with entries, a share sheet, the trial line and the upgrade and history buttons', () => {
    at3pm();
    vi.stubGlobal('navigator', { share: () => Promise.resolve() });
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(3 * DAY - HOUR) }), accessStatus: 'trial_active' };
    store.over = { incidents, customTags: custom };
    const html = flattenMarks(phoneView({ upgrade: true, navigate: true }));
    check(html);
    for (const piece of ['Kostenlose Testphase: ', 'Tarif wählen', 'Gesamter Verlauf', 'Link an meinen Computer senden', 'Biss, ', 'Drang, Timer beendet', 'Kein Biss', 'Alarm']) {
      expect(html, piece).toContain(piece);
    }
    expect(html).toContain('🚌 Commute');
  });

  it('free plan: the history window, in days (many and one), and without the window', () => {
    at3pm();
    for (const [historyDays, expected] of [[7, 'deine letzten 7 Tage'], [1, 'deinen letzten Tag'], [null, 'Kostenloser Tarif.']] as const) {
      auth.ctx = { user: person({ entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: historyDays } } }), accessStatus: 'free_tier' };
      const html = phoneView({ upgrade: true });
      check(html);
      expect(html, String(historyDays)).toContain(expected);
      expect(html).toContain('Tarif wählen');
    }
  });

  it('urge timer on: the timer replaces the plain urge button (its words are the coaching group\'s)', () => {
    setFlags('urge_timer');
    expect(getFlags().urge_timer).toBe(true);
    const html = phoneView();
    check(html);
    expect(html).not.toContain('Ich spüre einen Drang');
    expect(html).toContain('Ich habe gebissen');
  });

  it('the mail draft carries the translated subject and text', () => {
    const html = phoneView();
    const subject = encodeURIComponent('⟦Stop Biting, für meinen Computer⟧');
    expect(html).toContain(`mailto:?subject=${subject}`);
    expect(html).toContain(encodeURIComponent('⟦Öffne das auf meinem Laptop oder Desktop-Rechner:⟧'));
  });
});

describe('phone view parts, pseudo-locale', () => {
  usePseudoLocale({ flags: [] });

  it('RecentList: empty, with entries, with and without the "all history" button', () => {
    at3pm();
    const empty = renderToStaticMarkup(<RecentList onSeeAll={() => {}} />);
    check(empty);
    expect(empty).toContain('Noch nichts erfasst');
    expect(empty).not.toContain('Gesamter Verlauf');
    store.over = { incidents, customTags: custom };
    const withAll = renderToStaticMarkup(<RecentList onSeeAll={() => {}} />);
    check(withAll);
    expect(withAll).toContain('Gesamter Verlauf');
    expect(flattenMarks(withAll)).toContain('Biss, Stress');
    check(renderToStaticMarkup(<RecentList />));
  });

  it('TodayLine: nothing, and every mix of bites, urges and alarms to review', () => {
    at3pm();
    check(renderToStaticMarkup(<TodayLine />));
    const mixes: Array<[TodayCounts, string]> = [
      [{ bites: 0, urges: 0, alarmsToReview: 0 }, 'Heute nichts erfasst'],
      [{ bites: 1, urges: 0, alarmsToReview: 0 }, '1 Biss heute'],
      [{ bites: 2, urges: 1, alarmsToReview: 0 }, '2 Bisse, 1 Drang heute'],
      [{ bites: 0, urges: 3, alarmsToReview: 1 }, '3 Dränge, 1 Alarm zu prüfen heute'],
      [{ bites: 1000, urges: 2, alarmsToReview: 2 }, '1000 Bisse, 2 Dränge, 2 Alarme zu prüfen heute'],
    ];
    for (const [counts, expected] of mixes) {
      const html = renderToStaticMarkup(<p>{todaySentence(counts)}</p>);
      check(html);
      expect(flattenMarks(html)).toContain(expected);
    }
    store.over = { incidents };
    check(renderToStaticMarkup(<TodayLine />));
  });

  it('describeEntry and recentRows: every kind of entry', () => {
    const labels = incidents.map(i => describeEntry(i, custom).label);
    const html = renderToStaticMarkup(<ul>{labels.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    check(html);
    expect(describeEntry({ id: 'x', timestamp: T0, tag: 'commute', autoDetected: false }, []).label).toBe('⟦Biss⟧'); // a removed custom tag
    expect(recentRows(incidents, custom, 3)).toHaveLength(3);
    // today: the time; earlier days: "Yesterday, 14:40" and "Mon, Oct 19, 14:40" in the words of the language showing
    at3pm();
    expect(whenLabel(at(14, 40), T0)).toMatch(/^[\d:.\sAPM]+$/);
    const yesterday = renderToStaticMarkup(<p>{whenLabel(at(14, 40) - DAY, T0)}</p>);
    check(yesterday);
    expect(yesterday).toMatch(/^<p>⟦[^⟧]+⟧, [\d:.\sAPM]+<\/p>$/); // the day word comes from the history scope (utils/time.ts), then the time
    // a week-old date is all Intl (weekday, month, time), with no word of ours to mark
    expect(findUnmarkedEnglish(renderToStaticMarkup(<p>{whenLabel(at(14, 40) - 5 * DAY, T0)}</p>))).toEqual([]);
  });

  it('LogToast: nothing, an urge, a bite with each reason chosen and none', () => {
    const flow = { undo: () => {}, tapTrigger: () => {} } as unknown as LogFlow;
    const states: Array<Toast | null> = [
      null,
      { kind: 'urge', id: 'u' },
      { kind: 'bite', id: 'b', trigger: 'unknown' },
      ...PRESET_TAGS.map(p => ({ kind: 'bite', id: 'b', trigger: p.id }) as Toast),
      { kind: 'bite', id: 'b', trigger: 'commute' },
    ];
    for (const toast of states) {
      const html = renderToStaticMarkup(<LogToast toast={toast} flow={flow} customTags={custom} />);
      if (!toast) {
        expect(html).toBe('<p role="status" aria-live="polite" class="sr-only"></p>'); // nothing to say, nothing shown
        continue;
      }
      check(html);
      {
        expect(html).toContain('Rückgängig');
        expect(html).toContain(toast.kind === 'urge' ? 'Drang erfasst. Deine Serie bleibt unberührt.' : 'Biss erfasst');
      }
      if (toast.kind === 'bite') expect(html).toContain('Was hat es ausgelöst? Du kannst das überspringen.');
    }
  });

  it('toastMessage: every input', () => {
    const options: TagOption[] = [...PRESET_TAGS, ...custom];
    const inputs: Array<Toast | null> = [null, { kind: 'urge', id: 'u' }, { kind: 'bite', id: 'b', trigger: 'unknown' }, { kind: 'bite', id: 'b', trigger: 'stress' }, { kind: 'bite', id: 'b', trigger: 'commute' }, { kind: 'bite', id: 'b', trigger: 'gone' }];
    const html = renderToStaticMarkup(<div>{inputs.map((t, i) => <p key={i}>{toastMessage(t, options)}</p>)}</div>);
    check(html);
    expect(flattenMarks(html)).toContain('Biss erfasst: Commute. Deine Serie beginnt ab jetzt neu.');
    expect(flattenMarks(html)).toContain('Biss erfasst: Unsicher. Deine Serie beginnt ab jetzt neu.'); // a reason that no longer exists falls back to "Not sure"
  });

  it('SyncNoteView: the sync flag off, and on without the person having opted in', () => {
    const off = renderToStaticMarkup(<SyncNoteView onOpenSettings={() => {}} />);
    check(off);
    expect(off).toContain('Nur auf diesem Handy gespeichert.');
    expect(off).not.toContain('Einstellungen öffnen');
    setFlags('event_sync');
    auth.ctx = { user: person(), accessStatus: 'subscribed' };
    const on = renderToStaticMarkup(<SyncNoteView onOpenSettings={() => {}} />);
    check(on);
    expect(on).toContain('Schalte die Synchronisierung in den Einstellungen ein');
    expect(on).toContain('Einstellungen öffnen');
  });

  it('syncNoteFor: all three sentences', () => {
    const inputs = [{ syncAvailable: false, optedIn: false }, { syncAvailable: true, optedIn: false }, { syncAvailable: true, optedIn: true }];
    const notes = inputs.map(syncNoteFor);
    const html = renderToStaticMarkup(<div>{notes.map(n => <p key={n.kind}>{n.text}</p>)}</div>);
    check(html);
    expect(html).toContain('Die Synchronisierung ist eingeschaltet, daher sieht dein Computer diese Einträge.');
  });

  it('the share text carries the language showing, read when the sheet opens', async () => {
    let shared: { title: string; text: string; url: string } | null = null;
    await shareToComputer(async data => { shared = data; }, () => {});
    expect(shared).toEqual({ title: '⟦Stop Biting, für meinen Computer⟧', text: '⟦Öffne das auf meinem Laptop oder Desktop-Rechner:⟧', url: 'https://stopbiting.today' });
    check(renderToStaticMarkup(<p>{PHONE_SHARE.title} {PHONE_SHARE.text}</p>));
  });
});

// ── English stays as it is ───────────────────────────────────────────────────

describe('English (no language picked): the text and markup of today', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetStorage(); resetLocaleForTests(); });

  it('tab bar', () => {
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(5 * DAY - HOUR) }), accessStatus: 'trial_active' };
    browser.canInstall = true;
    const html = renderToStaticMarkup(<TabBar active="log" onChange={() => {}} onUpgrade={() => {}} />);
    for (const piece of ['>Watch<', '>History<', '>Settings<', 'aria-label="Main navigation"', '>Free trial<', 'tracking-[-0.045em]">5</span>', '>days left</span>', 'Upgrade</button>', 'Sign out</button>', 'Install app</button>', '>No camera data is sent while it runs<']) {
      expect(html, piece).toContain(piece);
    }
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(DAY + HOUR) }), accessStatus: 'trial_active' };
    expect(renderToStaticMarkup(<TabBar active="log" onChange={() => {}} onUpgrade={() => {}} />)).toContain('>days left</span>');
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(HOUR + 60_000) }), accessStatus: 'trial_active' };
    expect(renderToStaticMarkup(<TabBar active="log" onChange={() => {}} onUpgrade={() => {}} />)).toContain('>hour left</span>');
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(5 * HOUR + 60_000) }), accessStatus: 'trial_active' };
    expect(renderToStaticMarkup(<TabBar active="log" onChange={() => {}} onUpgrade={() => {}} />)).toContain('>hours left</span>');
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: null }), accessStatus: 'trial_active' };
    expect(renderToStaticMarkup(<TabBar active="log" onChange={() => {}} onUpgrade={() => {}} />)).toContain('>Ends today<');
    browser.phoneView = true;
    expect(renderToStaticMarkup(<TabBar active="dashboard" onChange={() => {}} onUpgrade={() => {}} />)).toContain('>Today<');
  });

  it('install banner, guide, tour card and camera notice', () => {
    browser.canInstall = true;
    const banner = renderToStaticMarkup(<PWAInstallPrompt />);
    for (const piece of ['>Install Stop Biting</p>', 'Add to home screen for quick access, no app store needed.', 'Install app</button>', 'aria-label="Dismiss"']) expect(banner, piece).toContain(piece);
    const guide = renderToStaticMarkup(<PWAGuideModal />);
    for (const piece of ['Stop Biting works best<br/>as an installed app', 'Free · no App Store · takes 10 seconds', 'Background detection', 'Tap &quot;Add to Home Screen&quot;', 'the ↑ icon at the bottom of Safari', 'Make sure you&#x27;re using <strong>Safari</strong>. Only Safari supports installation on iOS.', 'Open in Safari to install', 'Maybe later', 'alt="Stop Biting icon"']) {
      expect(guide, piece).toContain(piece);
    }
    const tour = renderToStaticMarkup(<TourCardContent step={0} onSkip={() => {}} onNext={() => {}} />);
    for (const piece of ['Step 1 of 5', 'Skip tour', 'This is the detector', 'Next <svg']) expect(tour, piece).toContain(piece);
    expect(renderToStaticMarkup(<TourCardContent step={4} onSkip={() => {}} onNext={() => {}} />)).toContain('>Done</button>');
    const notice = renderToStaticMarkup(<CameraNoticeCard explain={false} platform="win32" busy={false} onPrimary={() => {}} onDismiss={() => {}} />);
    expect(notice).toContain('Camera access is off for Stop Biting. Turn it on in Settings, under Privacy &amp; security, then Camera, then start watching again.');
    const mac = renderToStaticMarkup(<CameraNoticeCard explain={false} platform="darwin" busy={false} onPrimary={() => {}} onDismiss={() => {}} />);
    expect(mac).toContain('Turn it on in System Settings, under Privacy &amp; Security, then Camera, then start watching again.');
  });

  it('phone view', () => {
    at3pm();
    auth.ctx = { user: person({ subscription_status: 'trial', trial_end_date: iso(DAYS_LEFT * DAY - HOUR) }), accessStatus: 'trial_active' };
    store.over = { incidents, customTags: custom };
    const html = phoneView({ upgrade: true, navigate: true });
    for (const piece of [
      'Good afternoon, <span class="sg-mark whitespace-nowrap dark:![background:none]">Ana</span>.',
      `Free trial: ${DAYS_LEFT} days left.`, // a fixture value, not the trial length
      '>Choose a plan</button>',
      'aria-label="Log"',
      'I bit</button>',
      'I feel an urge</button>',
      '5 bites, 2 urges, 1 alarm to review today',
      '>Recent</h2>',
      '>All history</button>',
      '>Bite, Stress</span>',
      '>Bite, 🚌 Commute</span>',
      '>Urge, timer finished</span>',
      '>Urge</span>',
      '>Alarm</span>',
      '>Not a bite</span>',
      'Email me the link for my computer',
      'Open the full app on this device',
      'Stored on this phone only.',
    ]) {
      expect(html, piece).toContain(piece);
    }
    // the six newest entries are listed; the older kinds of entry read as before
    expect(incidents.slice(6).map(i => describeEntry(i, custom).label)).toEqual(['Bite', 'Bite, Deep focus', 'Bite']);
    // the mail draft is exactly the English one
    expect(html).toContain(`mailto:?subject=${encodeURIComponent('Stop Biting, for my computer')}&amp;body=${encodeURIComponent('Open this on my laptop or desktop: https://stopbiting.today')}`);
    // the sentences of the English scopes read as before
    expect(PHONE_ONLY).toBe('Stored on this phone only.');
    expect(PHONE_ONLY_CAN_SYNC).toBe('Stored on this phone only. Turn on sync in Settings to see it on your computer.');
    expect(phoneMessages['home.bite']).toBe('I bit');
    expect(shellMessages['tabs.watch']).toBe('Watch');
  });

  it('phone view, free plan', () => {
    at3pm();
    auth.ctx = { user: person({ entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: 7 } } }), accessStatus: 'free_tier' };
    expect(phoneView({ upgrade: true })).toContain('Free plan: History shows your last 7 days.');
    // the screen has always said "N days", also for 1 (the window is never that short)
    auth.ctx = { user: person({ entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: 1 } } }), accessStatus: 'free_tier' };
    expect(phoneView({ upgrade: true })).toContain('Free plan: History shows your last 1 days.');
    auth.ctx = { user: person({ name: '', entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: null } } }), accessStatus: 'free_tier' };
    const html = phoneView();
    expect(html).toContain('Free plan.');
    expect(html).toContain('Good afternoon, <span class="sg-mark whitespace-nowrap dark:![background:none]">there</span>.');
  });

  it('today line, for 0, 1, 2 and 1000', () => {
    expect(todaySentence({ bites: 0, urges: 0, alarmsToReview: 0 })).toBe('Nothing logged today');
    expect(todaySentence({ bites: 1, urges: 1, alarmsToReview: 1 })).toBe('1 bite, 1 urge, 1 alarm to review today');
    expect(todaySentence({ bites: 2, urges: 0, alarmsToReview: 0 })).toBe('2 bites today');
    expect(todaySentence({ bites: 1000, urges: 0, alarmsToReview: 1000 })).toBe('1000 bites, 1000 alarms to review today');
  });
});
