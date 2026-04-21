import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabBar } from './components/layout/TabBar';
import { Dashboard } from './pages/Dashboard';
import { Log } from './pages/Log';
import { Settings } from './pages/Settings';
import { Landing } from './pages/Landing';
import { PaywallPage } from './components/auth/PaywallPage';
import { BlogIndex } from './pages/BlogIndex';
import { BlogPost } from './pages/BlogPost';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPage } from './pages/RefundPage';
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

function AppRouter() {
  const { accessStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showPaywall, setShowPaywall] = useState(false);
  const { remindersEnabled, reminderIntervalMinutes } = useAppStore();

  useNotifications(remindersEnabled, reminderIntervalMinutes);
  useTheme();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (accessStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-cream-100 dark:bg-ink-100">
        <div className="flex items-center gap-3 text-stone-400">
          <img src="/logo.svg" alt="" className="w-6 h-6 animate-pulse" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // ── Not authenticated → Landing ──────────────────────────────────────────
  if (accessStatus === 'no_auth') {
    return <Landing />;
  }

  // ── Paywall (trial expired) or voluntary upgrade ────────────────────────
  if (accessStatus === 'paywall' || showPaywall) {
    return (
      <>
        <PaywallPage
          onBack={accessStatus === 'trial_active' ? () => setShowPaywall(false) : undefined}
        />
        <PWAGuideModal />
      </>
    );
  }

  // ── App (trial_active or subscribed) ────────────────────────────────────
  return (
    <>
      <div className="flex bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">
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
    </>
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
    return <BlogPost slug={slug} />;
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
