import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  trial_end_date: string | null;
  subscription_status: 'trial' | 'active' | 'paused' | 'cancelled' | 'expired';
  subscription_plan: 'monthly' | 'yearly' | null;
  subscription_end_date: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
}

// 'loading'       — checking session on app start
// 'no_auth'       — not signed in
// 'trial_active'  — signed in, within 7-day trial
// 'subscribed'    — signed in, active paid subscription
// 'paywall'       — trial expired, no active subscription
export type AccessStatus = 'loading' | 'no_auth' | 'trial_active' | 'subscribed' | 'paywall';

interface AuthContextType {
  user: UserProfile | null;
  accessStatus: AccessStatus;
  signingIn: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Electron only: Bearer token stored in localStorage by the main process.
// Web: sessions are HttpOnly cookies — no token in JS at all.
const ELECTRON_TOKEN_KEY = 'nh_token';

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

function computeAccessStatus(user: UserProfile): Exclude<AccessStatus, 'loading'> {
  const now = Date.now();

  if (
    (user.subscription_status === 'active' || user.subscription_status === 'paused') &&
    user.subscription_end_date &&
    new Date(user.subscription_end_date).getTime() > now
  ) {
    return 'subscribed';
  }

  if (
    user.trial_end_date &&
    new Date(user.trial_end_date).getTime() > now &&
    user.subscription_status !== 'expired' &&
    user.subscription_status !== 'cancelled'
  ) {
    return 'trial_active';
  }

  return 'paywall';
}

// apiFetch:
// - Web: credentials: 'include' sends the HttpOnly session cookie automatically.
// - Electron: reads Bearer token from localStorage (set by main process).
async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };

  if (isElectron()) {
    const token = localStorage.getItem(ELECTRON_TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',  // sends HttpOnly cookie on web; harmless in Electron
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// If no prior session indicator exists, start as no_auth so the landing page
// renders immediately without waiting for the /api/user/me round-trip.
// The flag is set after a successful auth and cleared on sign-out.
const SESSION_FLAG = 'sb_has_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(
    localStorage.getItem(SESSION_FLAG) ? 'loading' : 'no_auth'
  );
  const [signingIn, setSigningIn] = useState(false);

  const applyUser = useCallback((profile: UserProfile) => {
    localStorage.setItem(SESSION_FLAG, '1');
    setUser(profile);
    setAccessStatus(computeAccessStatus(profile));
  }, []);

  // On mount: load session. For web, the HttpOnly cookie is sent automatically
  // with credentials: 'include'. For Electron, the Bearer token is in localStorage.
  useEffect(() => {
    // Handle Electron deep-link auth result delivered via custom event.
    // Main process writes token to localStorage then fires 'electron-auth'.
    const onElectronAuth = (e: Event) => {
      const { token, error } = (e as CustomEvent<{ token?: string; error?: string }>).detail;
      if (token) {
        apiFetch('/api/user/me')
          .then(profile => { setSigningIn(false); applyUser(profile); })
          .catch(() => {
            localStorage.removeItem(ELECTRON_TOKEN_KEY);
            setSigningIn(false);
            setAccessStatus('no_auth');
          });
      } else if (error) {
        console.error('Auth error from Electron deep-link:', error);
        setSigningIn(false);
        setAccessStatus('no_auth');
      }
    };
    window.addEventListener('electron-auth', onElectronAuth);

    // Handle OAuth error passed via URL hash (web flow error path only)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hashParams.get('auth_error');
    if (hashError) {
      console.error('Auth error from OAuth callback:', hashError);
      window.history.replaceState(null, '', '/');
      setAccessStatus('no_auth');
      return () => window.removeEventListener('electron-auth', onElectronAuth);
    }

    // Attempt to load the current session (cookie on web, localStorage on Electron)
    apiFetch('/api/user/me')
      .then(applyUser)
      .catch(() => {
        // No valid session — clear any stale Electron token too
        if (isElectron()) localStorage.removeItem(ELECTRON_TOKEN_KEY);
        setAccessStatus('no_auth');
      });

    return () => window.removeEventListener('electron-auth', onElectronAuth);
  }, [applyUser]);

  const signInWithGoogle = () => {
    if (window.electronAPI?.openGoogleAuth) {
      // Electron: main process opens system browser, auth redirects back via custom protocol.
      // Main process writes token to localStorage and fires 'electron-auth'.
      // We also poll localStorage as a belt-and-suspenders fallback.
      setSigningIn(true);
      window.electronAPI.openGoogleAuth();

      let attempts = 0;
      let poll: ReturnType<typeof setInterval> | null = setInterval(() => {
        attempts++;
        const token = localStorage.getItem(ELECTRON_TOKEN_KEY);
        if (token) {
          if (poll) { clearInterval(poll); poll = null; }
          apiFetch('/api/user/me')
            .then(profile => { setSigningIn(false); applyUser(profile); })
            .catch(() => {
              localStorage.removeItem(ELECTRON_TOKEN_KEY);
              setSigningIn(false);
              setAccessStatus('no_auth');
            });
          return;
        }
        if (attempts > 180) {
          if (poll) { clearInterval(poll); poll = null; }
          setSigningIn(false);
        }
      }, 1000);
    } else {
      // Web: navigate to OAuth start. Server sets state cookie, redirects to Google.
      // On return, server sets HttpOnly session cookie and redirects to /.
      window.location.href = '/api/auth/google';
    }
  };

  const signOut = async () => {
    try {
      // C-4/L-2: Tell the server to clear the session cookie
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
    } catch {
      // best effort
    }
    if (isElectron()) localStorage.removeItem(ELECTRON_TOKEN_KEY);
    localStorage.removeItem(SESSION_FLAG);
    setUser(null);
    setAccessStatus('no_auth');
  };

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiFetch('/api/user/me');
      applyUser(profile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  }, [applyUser]);

  return (
    <AuthContext.Provider value={{ user, accessStatus, signingIn, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Exported for use in PaywallPage
export { apiFetch };
