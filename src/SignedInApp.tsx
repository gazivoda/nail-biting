import { lazy } from 'react';
import { TabBar } from './components/layout/TabBar';
import type { AccessStatus } from './types/access';
import { PWAGuideModal } from './components/PWAGuideModal';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { ProgramHost } from './coaching/ProgramHost';
import { SyncHost } from './sync/SyncHost';
import { BillingHost } from './components/billing/BillingHost';
import { BackgroundHost } from './background/BackgroundHost';
import { MilestoneHost } from './insights/ui/MilestoneHost';
import { LocaleHost } from './i18n/LocaleHost';

// The signed-in app and everything only it needs: the tab bar, the tour, the install guide, the hosts below, and the
// lazy pages. App.tsx imports this file lazily, so a visitor who is not signed in (the bulk of traffic: the home
// page, pricing, an article) never downloads any of it. Signed-in visitors do, started while the session is being
// looked up (App.tsx, `loadSignedInApp`), so the chunk is on its way before the answer is.
//
// The Suspense boundary that shows <AppLoading /> while a chunk below is in flight is in App.tsx, around this
// component: it is the same boundary, at the same place in the tree, that these branches had when they lived there.

// Dashboard, Log, Settings and the paywall are lazy so that recharts and the Paddle checkout SDK stay out of the
// download of anyone who is merely loading the app. This file was already their only importer.
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Log = lazy(() => import('./pages/Log').then(m => ({ default: m.Log })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const PaywallPage = lazy(() =>
  import('./components/auth/PaywallPage').then(m => ({ default: m.PaywallPage })),
);

export type Tab = 'dashboard' | 'log' | 'settings';

interface Props {
  accessStatus: AccessStatus;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  showPaywall: boolean;
  onShowPaywall: (show: boolean) => void;
}

export default function SignedInApp({ accessStatus, activeTab, onTabChange, showPaywall, onShowPaywall }: Props) {
  // ── Paywall (trial expired) or voluntary upgrade ────────────────────────
  if (accessStatus === 'paywall' || showPaywall) {
    return (
      <div className="app-type">
      <PaywallPage
        onBack={accessStatus === 'trial_active' || accessStatus === 'free_tier' || accessStatus === 'subscribed' ? () => onShowPaywall(false) : undefined}
      />
      <PWAGuideModal />
      <BillingHost />{/* WS9: a waiting gift or referral code. Nothing while every flag is off. */}
      <LocaleHost />{/* WS12a: applies a picked language once its flag is on. Nothing when none was picked. */}
      </div>
    );
  }

  // ── App (trial_active or subscribed) ────────────────────────────────────
  return (
    <div className="app-type">
    <div className="flex bg-cream-200 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">
      <TabBar
        active={activeTab}
        onChange={onTabChange}
        onUpgrade={() => onShowPaywall(true)}
      />
      <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
        {/* Dashboard is always mounted so detection keeps running on other tabs */}
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}><Dashboard onUpgrade={() => onShowPaywall(true)} onNavigate={onTabChange} /></div>
        {activeTab === 'log' && <Log onGoToWatch={() => onTabChange('dashboard')} />}
        {activeTab === 'settings' && <Settings onUpgrade={() => onShowPaywall(true)} />}
      </main>
    </div>
    <OnboardingTour />
    <PWAGuideModal />
    <ProgramHost />{/* WS2: the 4-week program view (hrt_coaching). Nothing while the flag is off. */}
    <SyncHost />{/* WS4: background sync, only for a person who switched it on. Nothing, and no request, otherwise. */}
    <BillingHost />{/* WS9: referral code, waiting gift, free-tier meter. Nothing while every flag is off. */}
    <BackgroundHost />{/* WS7a: pause clock, desktop commands, schedule reminders (background_watching). Nothing while the flag is off. */}
    <MilestoneHost />{/* WS5: milestone celebrations (insights). Nothing, and no extra download, while the flag is off. */}
    <LocaleHost />{/* WS12a: applies a picked language once its flag is on. Nothing when none was picked. */}
    </div>
  );
}
