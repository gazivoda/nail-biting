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
// BlogPost is the only route that renders article bodies, and blogPosts.ts is a
// single ~700KB array literal that no bundler can tree-shake. Splitting it out
// keeps every other route — the landing page above all — from paying for it.
const BlogPost = lazy(() =>
  import('./pages/BlogPost').then(m => ({ default: m.BlogPost })),
);
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPage } from './pages/RefundPage';
import { About } from './pages/About';
import { HowItWorks } from './pages/HowItWorks';
import { PricingPage } from './pages/PricingPage';
import { ComparePage } from './pages/ComparePage';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useAppStore } from './store/useAppStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAGuideModal } from './components/PWAGuideModal';
import { OnboardingTour } from './components/onboarding/OnboardingTour';

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
  return (
    <div className="flex items-center justify-center min-h-dvh bg-cream-200 dark:bg-ink-100">
      <div className="flex items-center gap-3 text-stone-400">
        <img src="/logo.svg" alt="" className="w-6 h-6 animate-pulse" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

function AppRouter() {
  const { accessStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showPaywall, setShowPaywall] = useState(false);
  const { remindersEnabled, reminderIntervalMinutes } = useAppStore();

  useNotifications(remindersEnabled, reminderIntervalMinutes);
  useTheme();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (accessStatus === 'loading') return <AppLoading />;

  // ── Not authenticated → Landing ──────────────────────────────────────────
  if (accessStatus === 'no_auth') {
    return <Landing />;
  }

  // ── Paywall (trial expired) or voluntary upgrade ────────────────────────
  if (accessStatus === 'paywall' || showPaywall) {
    return (
      <Suspense fallback={<AppLoading />}>
        <PaywallPage
          onBack={accessStatus === 'trial_active' ? () => setShowPaywall(false) : undefined}
        />
        <PWAGuideModal />
      </Suspense>
    );
  }

  // ── App (trial_active or subscribed) ────────────────────────────────────
  return (
    <Suspense fallback={<AppLoading />}>
      <div className="flex bg-cream-200 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          onUpgrade={() => setShowPaywall(true)}
        />
        <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
          {/* Dashboard is always mounted so detection keeps running on other tabs */}
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}><Dashboard /></div>
          {activeTab === 'log' && <Log />}
          {activeTab === 'settings' && <Settings onUpgrade={() => setShowPaywall(true)} />}
        </main>
      </div>
      <OnboardingTour />
      <PWAGuideModal />
    </Suspense>
  );
}

export default function App() {
  const path = usePath();

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

  // Compare pages
  if (path.startsWith('/compare/') || path.startsWith('/solutions/')) {
    return <ComparePage path={path} />;
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

  // Main app (root and everything else)
  return (
    <AuthProvider>
      <AppRouter />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}
