import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  trial_end_date: string | null;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  subscription_plan: 'monthly' | 'yearly' | null;
  subscription_end_date: string | null;
  paypal_subscription_id: string | null;
}

// 'loading'       — checking stored token on app start
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
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'nh_token';

function computeAccessStatus(user: UserProfile): Exclude<AccessStatus, 'loading'> {
  const now = Date.now();

  if (
    user.subscription_status === 'active' &&
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

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [signingIn, setSigningIn] = useState(false);

  const applyUser = useCallback((profile: UserProfile) => {
    setUser(profile);
    setAccessStatus(computeAccessStatus(profile));
  }, []);

  // On mount: check URL hash for token from OAuth callback, then load profile
  useEffect(() => {
    // Handle Electron deep-link auth result delivered via custom event.
    // Main process writes token to localStorage then fires 'electron-auth'.
    const onElectronAuth = (e: Event) => {
      const { token, error } = (e as CustomEvent<{ token?: string; error?: string }>).detail;
      if (token) {
        // Token is already in localStorage (set by executeJavaScript in main.ts)
        apiFetch('/api/user/me')
          .then(profile => { setSigningIn(false); applyUser(profile); })
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
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

    // Check URL hash for OAuth callback token (web browser flow).
    // Server redirects to /#token=xxx or /#auth_error=xxx after Google OAuth.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hashToken = hashParams.get('token');
    const hashError = hashParams.get('auth_error');

    if (hashToken) {
      localStorage.setItem(TOKEN_KEY, hashToken);
      window.history.replaceState(null, '', '/');
      apiFetch('/api/user/me')
        .then(applyUser)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setAccessStatus('no_auth');
        });
      return () => window.removeEventListener('electron-auth', onElectronAuth);
    }

    if (hashError) {
      console.error('Auth error from OAuth callback:', hashError);
      window.history.replaceState(null, '', '/');
      setAccessStatus('no_auth');
      return () => window.removeEventListener('electron-auth', onElectronAuth);
    }

    // On initial mount: check for a token already stored (persisted login)
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setAccessStatus('no_auth');
    } else {
      apiFetch('/api/user/me')
        .then(applyUser)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setAccessStatus('no_auth');
        });
    }

    return () => {
      window.removeEventListener('electron-auth', onElectronAuth);
    };
  }, [applyUser]);

  const signInWithGoogle = () => {
    if (window.electronAPI?.openGoogleAuth) {
      // In Electron: main process fetches the Google URL from Express and opens
      // it in the system browser via shell.openExternal — never inside Electron.
      // After auth, server redirects to nailhabit://auth?token=xxx which the OS
      // routes back to Electron. Main process writes token to localStorage and
      // fires 'electron-auth'. We also poll localStorage as a belt-and-suspenders
      // fallback in case the event is missed (e.g. page still loading when fired).
      setSigningIn(true);
      window.electronAPI.openGoogleAuth();

      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          clearInterval(poll);
          apiFetch('/api/user/me')
            .then(profile => { setSigningIn(false); applyUser(profile); })
            .catch(() => {
              localStorage.removeItem(TOKEN_KEY);
              setSigningIn(false);
              setAccessStatus('no_auth');
            });
        }
        // Stop polling after 3 minutes
        if (attempts > 180) { clearInterval(poll); setSigningIn(false); }
      }, 1000);
    } else {
      // In browser / PWA: normal navigation
      window.location.href = '/api/auth/google';
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
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
