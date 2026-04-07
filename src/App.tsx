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
import { useNotifications } from './hooks/useNotifications';
import { useAppStore } from './store/useAppStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// Real path-based routing (no hash fragments — required for Google indexability).
// The server handles /blog and /blog/:slug with SSR meta injection,
// then serves the same SPA shell which this router then renders client-side.
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (accessStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream-100">
        <div className="flex items-center gap-3 text-stone-400">
          <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
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
      <PaywallPage
        onBack={accessStatus === 'trial_active' ? () => setShowPaywall(false) : undefined}
      />
    );
  }

  // ── App (trial_active or subscribed) ────────────────────────────────────
  return (
    <div className="flex bg-cream-100 text-stone-800 min-h-screen">
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        onUpgrade={() => setShowPaywall(true)}
      />
      <main className="flex-1 ml-56">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'log' && <Log />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
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
    return (
      <div className="min-h-dvh bg-cream-100 text-stone-800 flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-stone-500 max-w-prose text-sm leading-relaxed">
          Stop Biting processes your webcam feed entirely on-device using WebAssembly. No camera data is ever transmitted to any server. Session logs and streak data are stored locally in SQLite on your machine. Uninstalling the app removes all local data. Google account information is used solely for authentication.
        </p>
        <a href="/" className="mt-8 text-sm text-forest-600 hover:text-forest-500 transition-colors">Back to app</a>
      </div>
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
