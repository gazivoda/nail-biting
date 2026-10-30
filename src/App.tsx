import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Landing } from './pages/Landing';
import type { Tab } from './SignedInApp';
// Not lazy: see the /blog/:slug route below.
import { BlogPost } from './pages/BlogPost';

// The signed-in app: the tab bar, the tour, the install guide, the hosts and the lazy pages (Dashboard, Log,
// Settings, the paywall) with everything only they need, notably recharts for the week chart and the Paddle
// checkout SDK. Landing-page visitors are the bulk of traffic and never reach any of it, so keep it out of their
// download. `loadSignedInApp` is also called while a returning visitor's session is being looked up (AppRouter), so
// the chunk is already on its way when the answer arrives.
const loadSignedInApp = () => import('./SignedInApp');
const SignedInApp = lazy(loadSignedInApp);
// The blog index lists every guide, so it carries the whole index (src/data/blogIndex.ts, ~18 KB gzipped). Only a
// reader who opens /blog downloads it; the home page gets its guide count from src/blogCount.ts.
const BlogIndex = lazy(() => import('./pages/BlogIndex').then(m => ({ default: m.BlogIndex })));
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
  // A returning visitor (the session marker is set) is probably about to land in the app: fetch its shell next to
  // the session lookup instead of after it. An anonymous visitor never has the marker, so never gets here.
  useEffect(() => {
    if (accessStatus === 'loading') void loadSignedInApp();
  }, [accessStatus]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (accessStatus === 'loading') return <AppLoading />;

  // ── Not authenticated → Landing ──────────────────────────────────────────
  if (accessStatus === 'no_auth') {
    return <Landing authError={authError} onDismissAuthError={clearAuthError} />;
  }

  // ── Signed in: the paywall (trial expired) or voluntary upgrade, or the app (trial_active or subscribed) ───────
  return (
    <Suspense fallback={<AppLoading />}>
      <SignedInApp
        accessStatus={accessStatus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showPaywall={showPaywall}
        onShowPaywall={setShowPaywall}
      />
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
    return (
      <Suspense fallback={null}>
        <BlogIndex />
      </Suspense>
    );
  }

  // Blog post — /blog/:slug
  if (path.startsWith('/blog/')) {
    const slug = path.slice(6).replace(/\/$/, '');
    // The server injects the article body and meta tags into the HTML shell, so
    // crawlers never depend on this chunk resolving.
    return <BlogPost slug={slug} />;
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
