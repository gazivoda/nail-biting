import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabBar } from './components/layout/TabBar';
import { Landing } from './pages/Landing';
import { BlogIndex } from './pages/BlogIndex';

// The signed-in app — and everything only it needs, notably recharts for the
// week chart and the Paddle checkout SDK. Landing-page visitors are the bulk of
// traffic and never reach any of it, so keep it out of their download.
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Log = lazy(() => import('./pages/Log').then(m => ({ default: m.Log })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const PaywallPage = lazy(() =>
  import('./components/auth/PaywallPage').then(m => ({ default: m.PaywallPage })),
);
// BlogPost is the only route that renders article bodies. It no longer imports
// them: each article is fetched from /posts/<slug>.json (see hooks/usePost.ts),
// so a reader downloads the one they open, not all of them.
const BlogPost = lazy(() =>
  import('./pages/BlogPost').then(m => ({ default: m.BlogPost })),
);
// Same reason: comparePages.ts is ~94KB of source that only /compare/* and
// /solutions/* read, and it was riding in the main chunk.
const ComparePage = lazy(() =>
  import('./pages/ComparePage').then(m => ({ default: m.ComparePage })),
);
// The sign-in page (WS8): only visitors who open /signin download it.
const SignInPage = lazy(() => import('./pages/SignIn').then(m => ({ default: m.SignInPage })));
// The gift redeem page (WS9): only a recipient who opens a gift link downloads it.
const RedeemPage = lazy(() => import('./pages/RedeemPage').then(m => ({ default: m.RedeemPage })));
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPage } from './pages/RefundPage';
import { EditorialPolicyPage } from './pages/EditorialPolicyPage';
import { About } from './pages/About';
import { HowItWorks } from './pages/HowItWorks';
import { PricingPage } from './pages/PricingPage';
import { LocalizedSite } from './pages/LocalizedSite';
import { hasLocalePrefix, parseSitePath } from './i18n/marketing/routes';
import { CostCalculator } from './pages/CostCalculator';
import { NailGrowthCalculator } from './pages/NailGrowthCalculator';
import { PrintableTracker } from './pages/PrintableTracker';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useAppStore } from './store/useAppStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAGuideModal } from './components/PWAGuideModal';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { ProgramHost } from './coaching/ProgramHost';
import { SyncHost } from './sync/SyncHost';
import { BillingHost } from './components/billing/BillingHost';
import { BackgroundHost } from './background/BackgroundHost';
import { MilestoneHost } from './insights/ui/MilestoneHost';
import { LocaleHost } from './i18n/LocaleHost';
import { useLocaleVersion } from './i18n/hooks';
import { useT as useCommonT } from './i18n/scopes/common';

// Real path-based routing (no hash fragments — required for Google indexability).
function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return path;
}

type Tab = 'dashboard' | 'log' | 'settings';

// Shown while the session is being checked and while a lazy chunk is in flight.
// Same markup for both so a signed-in user sees one continuous state rather than
// a spinner, a flash, and then another spinner.
function AppLoading() {
  const tc = useCommonT();
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-type flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream-200 dark:bg-ink-100"
    >
      <img src="/logo.svg" alt="" className="h-16 w-16 motion-safe:animate-pulse dark:hidden" />
      <img src="/logo-dark.svg" alt="" className="hidden h-16 w-16 motion-safe:animate-pulse dark:block" />
      <span className="font-display text-2xl font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">Stop Biting</span>
      <span className="sr-only">{tc('loading')}</span>
    </div>
  );
}

function AppRouter() {
  const { accessStatus, authError, clearAuthError } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showPaywall, setShowPaywall] = useState(false);
  const { remindersEnabled, reminderIntervalMinutes, detecting } = useAppStore();
  useLocaleVersion(); // WS12a: a language change re-renders the whole signed-in tree below (state is kept)

  useNotifications(remindersEnabled, reminderIntervalMinutes, detecting);
  // The landing page below is light-only by design. Pinning it here rather than
  // inside Landing is what keeps it simple: this effect is the only writer of the
  // `dark` class on this route, so there is nothing for the page to fight.
  useTheme(accessStatus === 'no_auth' ? 'light' : undefined);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (accessStatus === 'loading') return <AppLoading />;

  // ── Not authenticated → Landing ──────────────────────────────────────────
  if (accessStatus === 'no_auth') {
    return <Landing authError={authError} onDismissAuthError={clearAuthError} />;
  }

  // ── Paywall (trial expired) or voluntary upgrade ────────────────────────
  if (accessStatus === 'paywall' || showPaywall) {
    return (
      <Suspense fallback={<AppLoading />}>
        <div className="app-type">
        <PaywallPage
          onBack={accessStatus === 'trial_active' || accessStatus === 'free_tier' || accessStatus === 'subscribed' ? () => setShowPaywall(false) : undefined}
        />
        <PWAGuideModal />
        <BillingHost />{/* WS9: a waiting gift or referral code. Nothing while every flag is off. */}
        <LocaleHost />{/* WS12a: applies a picked language once its flag is on. Nothing when none was picked. */}
        </div>
      </Suspense>
    );
  }

  // ── App (trial_active or subscribed) ────────────────────────────────────
  return (
    <Suspense fallback={<AppLoading />}>
      <div className="app-type">
      <div className="flex bg-cream-200 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          onUpgrade={() => setShowPaywall(true)}
        />
        <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
          {/* Dashboard is always mounted so detection keeps running on other tabs */}
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}><Dashboard onUpgrade={() => setShowPaywall(true)} onNavigate={setActiveTab} /></div>
          {activeTab === 'log' && <Log onGoToWatch={() => setActiveTab('dashboard')} />}
          {activeTab === 'settings' && <Settings onUpgrade={() => setShowPaywall(true)} />}
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
    </Suspense>
  );
}

export default function App() {
  const path = usePath();

  // The four core marketing pages in Spanish, German and Brazilian Portuguese (WS12b): /es, /es/pricing, ... The server
  // only serves these addresses while the language's flag is on. Rendered bare (no AuthProvider): a landing page.
  if (hasLocalePrefix(path)) {
    const site = parseSitePath(path);
    if (site && site.locale !== 'en') return <LocalizedSite locale={site.locale} page={site.page} />;
  }

  // Blog index
  if (path === '/blog' || path === '/blog/') {
    return <BlogIndex />;
  }

  // Blog post — /blog/:slug
  if (path.startsWith('/blog/')) {
    const slug = path.slice(6).replace(/\/$/, '');
    // The server injects the article body and meta tags into the HTML shell, so
    // crawlers never depend on this chunk resolving.
    return (
      <Suspense fallback={null}>
        <BlogPost slug={slug} />
      </Suspense>
    );
  }

  // About page
  if (path === '/about') {
    return <About />;
  }

  // How it works
  if (path === '/how-it-works') {
    return <HowItWorks />;
  }

  // Pricing
  if (path === '/pricing') {
    return <PricingPage />;
  }

  // Free printable tracker
  if (path === '/tools/nail-biting-tracker-printable') {
    return <PrintableTracker />;
  }

  // Free cost calculator
  if (path === '/tools/nail-biting-cost-calculator') {
    return <CostCalculator />;
  }
  if (path === '/tools/nail-growth-timeline-calculator') {
    return <NailGrowthCalculator />;
  }

  // Compare pages
  if (path.startsWith('/compare/') || path.startsWith('/solutions/') || path.startsWith('/features/')) {
    return (
      <Suspense fallback={null}>
        <ComparePage path={path} />
      </Suspense>
    );
  }

  // Privacy policy
  if (path === '/privacy') {
    return <PrivacyPage />;
  }

  // Terms of service
  if (path === '/terms-and-conditions') {
    return <TermsPage />;
  }

  // Refund policy
  if (path === '/refund-policy') {
    return <RefundPage />;
  }

  // Editorial policy and corrections. Needs a real client route: server.js
  // renders the page for crawlers, and without this the SPA would replace it
  // with the landing page the moment React mounts.
  if (path === '/editorial-policy') {
    return <EditorialPolicyPage />;
  }

  // Sign in (served by server/routes/authProviders.js only while a sign-in flag is on)
  if (path === '/signin') {
    return (
      <Suspense fallback={null}>
        <SignInPage />
      </Suspense>
    );
  }

  // Redeem a gift (served by server/routes/billing.js only while gift_plan is on)
  if (path === '/redeem') {
    return (
      <AuthProvider>
        <Suspense fallback={null}>
          <RedeemPage />
        </Suspense>
      </AuthProvider>
    );
  }

  // Main app (root and everything else)
  return (
    <AuthProvider>
      <AppRouter />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}
