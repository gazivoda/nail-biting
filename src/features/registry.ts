// The typed registry of feature flags. Pure data: no imports, no side effects,
// so the server tests can read it and the client can type-check against it.
//
// Every user-facing feature ships behind one of these, OFF until the owner turns
// it on by adding its name to FEATURE_FLAGS on the server (see
// server/features.js and docs/agents/ARCHITECTURE.md, "Feature flags").
//
// The server keeps its own list of the same names (server/features.js);
// server/features.test.js fails if the two differ. To add a flag: add it here,
// add the name to FLAG_NAMES in server/features.js, add it to .env.example.

export interface FlagInfo {
  /** Workstream that owns the feature. */
  owner: string;
  /** One line for the owner: what turns on. */
  description: string;
  /** Other flags this one needs to be useful (advisory; nothing is switched off automatically). */
  dependsOn?: readonly string[];
  /** What the owner must do before switching it on in production. */
  before?: string;
}

export const FEATURES = {
  // ── WS1 detect more behaviours ─────────────────────────────────────────────
  detection_behaviors: {
    owner: 'WS1',
    description: 'Settings > Behaviors: choose which behaviours to monitor; history and stats filter by behaviour.',
  },
  experimental: {
    owner: 'WS1',
    description: 'Show detection behaviours that have no real-footage validation yet.',
    dependsOn: ['detection_behaviors'],
    before: 'Record real landmark fixtures and set the precision threshold.',
  },

  // ── WS2 coaching / HRT ─────────────────────────────────────────────────────
  hrt_coaching: {
    owner: 'WS2',
    description: 'Competing-response prompt after an alarm, settings for it, and the 4-week program.',
    before: 'Review the lesson text (NEEDS HUMAN REVIEW).',
  },
  urge_timer: {
    owner: 'WS2',
    description: '"I feel an urge" button with the guided breathing timer.',
    dependsOn: ['hrt_coaching'],
  },

  // ── WS3 fewer false alarms ─────────────────────────────────────────────────
  false_positive_controls: {
    owner: 'WS3',
    description: '"Not a bite" (alarm toast, minimized window, History), learned poses, hand filter, chin-rest rule, optional calibration, false-alarm rate (Settings > Detection).',
    before: 'Read docs/agents/legal/ws3-privacy.md (NEEDS HUMAN REVIEW); record real fixtures to check the chin-rest rule (docs/agents/ws3-notes.md).',
  },

  // ── WS4 sync ───────────────────────────────────────────────────────────────
  event_sync: {
    owner: 'WS4',
    description: 'Opt-in sync of history between devices (Settings > Account & Sync).',
    before: 'Review the drafted privacy wording (NEEDS HUMAN REVIEW).',
  },
  data_backup: {
    owner: 'WS4',
    description: 'Export and import of history as a file, with or without an account.',
  },

  // ── WS5 insights ───────────────────────────────────────────────────────────
  insights: {
    owner: 'WS5',
    description: 'Charts, heatmap, trends and milestones.',
  },
  photo_diary: {
    owner: 'WS5',
    description: 'Local-only weekly hand photo diary with before/after slider.',
    dependsOn: ['insights'],
  },
  weekly_email: {
    owner: 'WS5',
    description: 'Opt-in weekly summary email built from synced events.',
    dependsOn: ['event_sync', 'insights'],
    before: 'Pick and verify the email provider and sender domain.',
  },

  // ── WS6 phone ──────────────────────────────────────────────────────────────
  phone_companion: {
    owner: 'WS6',
    description: 'Phone view: quick logging, streak, urge timer.',
  },

  // ── WS7 background / desktop ───────────────────────────────────────────────
  background_watching: {
    owner: 'WS7a',
    description: 'Picture-in-Picture watcher, schedules, pause controls, meeting mode.',
  },
  desktop_app: {
    owner: 'WS7b',
    description: 'Desktop app surface (download links, tray features). Marketing claims stay off until signed builds exist.',
    before: 'Code-signing certificates and a tested installer.',
  },

  // ── WS8 sign-in ────────────────────────────────────────────────────────────
  signin_magic_link: {
    owner: 'WS8',
    description: 'Sign in with an emailed link.',
    before: 'Email provider configured (RESEND_API_KEY, EMAIL_FROM).',
  },
  signin_apple: {
    owner: 'WS8',
    description: 'Sign in with Apple.',
    before: 'Apple developer registration and keys in the server env.',
  },
  signin_microsoft: {
    owner: 'WS8',
    description: 'Sign in with Microsoft.',
    before: 'Microsoft app registration and keys in the server env.',
  },

  // ── WS9 pricing ────────────────────────────────────────────────────────────
  free_tier: {
    owner: 'WS9',
    description: 'Optional free tier with the limits the owner sets.',
    before: 'Decide the limits.',
  },
  lifetime_plan: {
    owner: 'WS9',
    description: 'Lifetime plan at checkout.',
    before: 'Create the Paddle product and set its price id.',
  },
  gift_plan: {
    owner: 'WS9',
    description: 'Gift purchase.',
    before: 'Create the Paddle product and set its price id.',
  },
  referrals: {
    owner: 'WS9',
    description: 'Personal referral link; both sides get the configured credit.',
  },
  regional_pricing: {
    owner: 'WS9',
    description: 'Pricing page shows Paddle-localised prices.',
    before: 'Enable localised pricing in the Paddle dashboard.',
  },

  // ── WS10 sharing ───────────────────────────────────────────────────────────
  share_links: {
    owner: 'WS10',
    description: 'Read-only share link for a therapist or accountability partner.',
    dependsOn: ['event_sync'], // a link shows the owner's SYNCED history; with sync off it shows "nothing yet"
    before: 'Review the drafted privacy wording (NEEDS HUMAN REVIEW).',
  },

  // ── WS11a marketing ────────────────────────────────────────────────────────
  compare_competitors: {
    owner: 'WS11a',
    description: 'Comparison pages for other products; indexable and in the sitemap only while on.',
    before: 'Verify every competitor fact (NEEDS HUMAN VERIFICATION).',
  },
  social_proof: {
    owner: 'WS11a',
    description: 'Testimonial sections. Also hidden automatically while the data file is empty.',
    before: 'Add real, consented testimonials to the data file.',
  },

  // ── WS12 locales ───────────────────────────────────────────────────────────
  locale_es: {
    owner: 'WS12',
    description: 'Spanish app and core pages.',
    before: 'Native review of the machine translation.',
  },
  locale_de: {
    owner: 'WS12',
    description: 'German app and core pages.',
    before: 'Native review of the machine translation.',
  },
  locale_pt_br: {
    owner: 'WS12',
    description: 'Brazilian Portuguese app and core pages.',
    before: 'Native review of the machine translation.',
  },
} as const satisfies Record<string, FlagInfo>;

export type FeatureName = keyof typeof FEATURES;

export const FEATURE_NAMES = Object.keys(FEATURES) as FeatureName[];

export function isFeatureName(x: string): x is FeatureName {
  return Object.prototype.hasOwnProperty.call(FEATURES, x);
}
