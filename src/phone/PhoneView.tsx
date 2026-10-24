// The phone view (WS6, flag `phone_companion`): the Watch tab for a device that
// cannot watch. Two big buttons, the streak, today's count and the recent
// entries, nothing that needs a camera. Dashboard renders this instead of the
// camera dashboard (one early return); the tab bar, History, Settings, the
// upgrade path and background sync are the app's own and stay as they are.
//
// Text and neutral shapes only: nothing here draws the habit.

import { useEffect, useRef } from 'react';
import { StreakHero } from '../components/dashboard/StreakHero';
import { UrgeTimer } from '../coaching/UrgeTimer';
import { useAuth } from '../contexts/AuthContext';
import { useFeature } from '../features/useFeature';
import { useAppStore } from '../store/useAppStore';
import { useFreeTier } from '../billing/useFreeTier';
import { track } from '../utils/track';
import { trialLeft } from '../utils/trial';
import { canShare, PHONE_SHARE, shareToComputer } from '../utils/phoneLink';
import { setFullApp } from './activeStore';
import { LogToast } from './LogToast';
import { takeQuickAction } from './quickAction';
import { RecentList, TodayLine } from './RecentList';
import { SyncNoteView } from './SyncNoteView';
import { useThemeColor } from './themeColor';
import { useLogFlow } from './useLogFlow';
import { useT } from '../i18n/scopes/phone';

export type PhoneTab = 'log' | 'settings';

// Built when the view renders (the words of PHONE_SHARE are in the language showing).
const phoneMailto = () =>
  'mailto:?subject=' + encodeURIComponent(PHONE_SHARE.title) +
  '&body=' + encodeURIComponent(`${PHONE_SHARE.text} ${PHONE_SHARE.url}`);

const TEXT_BUTTON =
  'inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300';

// The marked word of the greeting: the name, or "there" when the account has none.
const GREETING_TAGS = {
  name: (chunks: React.ReactNode) => <span className="sg-mark whitespace-nowrap dark:![background:none]">{chunks}</span>,
};

function SendLinkToComputer() {
  const t = useT();
  const mailto = phoneMailto();
  const share = canShare(typeof navigator === 'undefined' ? undefined : navigator);
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    track('phone_link_click', 'phone_view');
    if (!share) return;
    e.preventDefault();
    void shareToComputer(data => navigator.share(data), () => { window.location.href = mailto; });
  };
  return (
    <a href={mailto} onClick={onClick} className={TEXT_BUTTON}>
      {share ? t('home.send.share') : t('home.send.email')}
    </a>
  );
}

export default function PhoneView({ onUpgrade, onNavigate }: {
  onUpgrade?: () => void;
  onNavigate?: (tab: PhoneTab) => void;
}) {
  const t = useT();
  const { user, accessStatus } = useAuth();
  const customTags = useAppStore(s => s.customTags);
  const free = useFreeTier();
  const urgeTimerOn = useFeature('urge_timer');
  const { flow, toast } = useLogFlow();
  useThemeColor(); // the status bar follows light and dark while this view is up
  const urgeRef = useRef<HTMLDivElement>(null);

  const firstName = user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const trialLeftText = accessStatus === 'trial_active' ? trialLeft(user?.trial_end_date) : null;

  // A home-screen shortcut opens /?action=bite or /?action=urge. Acted on once
  // (and removed from the address), so a reload or a relaunch never logs twice.
  useEffect(() => {
    const action = takeQuickAction(window.location, window.history);
    if (action === 'bite') flow.tapBite();
    if (action === 'urge') {
      // With the timer on, open its choice sheet (the person presses Start); without it, log the urge.
      const trigger = urgeRef.current?.querySelector('button');
      if (urgeTimerOn && trigger) trigger.click();
      else flow.tapUrge();
    }
    // Once per mount: the flow and the address are the only inputs, and takeQuickAction returns null after the first call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-phone-view=""
      className="mx-auto w-full max-w-md pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))]"
    >
      <header className="mb-5">
        <h1 className="font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-stone-900 dark:text-stone-100">
          {firstName
            ? t.rich('home.greeting.named', { part, name: firstName }, GREETING_TAGS)
            : t.rich('home.greeting.anon', { part }, GREETING_TAGS)}
        </h1>
        {free.active && (
          // WS9's free plan: the limits are on detection time and how far back History reaches. Detection is not
          // on this screen, so the one limit that touches it is the history window.
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-stone-600 dark:text-stone-300">
            <span>{free.historyDays ? t('home.freePlanHistory', { days: free.historyDays }) : t('home.freePlan')}</span>
            {onUpgrade && (
              <button type="button" onClick={onUpgrade} className={`${TEXT_BUTTON} -mx-3`}>
                {t('home.choosePlan')}
              </button>
            )}
          </p>
        )}
        {trialLeftText && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-stone-600 dark:text-stone-300">
            <span>{t('home.trial', { left: trialLeftText })}</span>
            {onUpgrade && (
              <button type="button" onClick={onUpgrade} className={`${TEXT_BUTTON} -mx-3`}>
                {t('home.choosePlan')}
              </button>
            )}
          </p>
        )}
      </header>

      <StreakHero />

      <section aria-label={t('home.logAria')} className="mt-5 flex flex-col gap-3">
        {/* scripts/phoneGuards.test.mjs finds the two big buttons by their English words, which now live in
            src/i18n/scopes/phone.ts: I bit</button> and I feel an urge</button> */}
        <button
          type="button"
          onClick={() => flow.tapBite()}
          className="w-full select-none rounded-full bg-alert-600 min-h-16 py-4 font-display text-xl font-bold tracking-[-0.01em] text-white transition-colors duration-150 [@media(hover:hover)]:hover:bg-alert-800 active:scale-[0.99] motion-reduce:active:scale-100 dark:bg-alert-400 dark:text-alert-900 dark:[@media(hover:hover)]:hover:bg-alert-100"
        >
          {t('home.bite')}
        </button>

        <div ref={urgeRef} className="[&>div>button]:min-h-16 [&>div>button]:text-xl">
          {urgeTimerOn ? (
            <UrgeTimer />
          ) : (
            <button
              type="button"
              onClick={() => flow.tapUrge()}
              className="w-full select-none rounded-full border-2 border-deep min-h-16 py-3.5 font-display text-xl font-bold tracking-[-0.01em] text-deep transition-colors duration-150 [@media(hover:hover)]:hover:bg-deep [@media(hover:hover)]:hover:text-white active:scale-[0.99] motion-reduce:active:scale-100 dark:border-lime-300 dark:text-lime-300 dark:[@media(hover:hover)]:hover:bg-lime-300 dark:[@media(hover:hover)]:hover:text-deep"
            >
              {t('home.urge')}
            </button>
          )}
        </div>

        <LogToast toast={toast} flow={flow} customTags={customTags} />
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <TodayLine />
        <RecentList onSeeAll={onNavigate ? () => onNavigate('log') : undefined} />
      </div>

      <div className="mt-6">
        <SyncNoteView onOpenSettings={() => onNavigate?.('settings')} />
      </div>

      <div className="mt-4 flex flex-col items-center gap-1">
        <SendLinkToComputer />
        <button type="button" onClick={() => setFullApp(true)} className={TEXT_BUTTON}>
          {t('home.openFull')}
        </button>
      </div>
    </div>
  );
}
