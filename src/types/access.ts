// Auth/subscription types, split out of AuthContext so the access rules can be
// tested without pulling in React.

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
// 'trial_active'  — signed in, within the trial window
// 'subscribed'    — signed in, active or paused paid subscription
// 'paywall'       — trial over, no active subscription
export type AccessStatus = 'loading' | 'no_auth' | 'trial_active' | 'subscribed' | 'paywall';
