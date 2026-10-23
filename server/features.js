// Feature flags, server side.
//
// The owner turns a flag on by setting an environment variable on the server and
// restarting it (no rebuild, no deploy of new code):
//
//     FEATURE_FLAGS=event_sync,data_backup,insights
//
// A comma-separated list of flag names. Anything not listed is OFF. The server
// exposes the resulting map at GET /api/features (server/routes/features.js);
// the client reads that (src/features/flags.ts); SSR'd marketing pages and
// route modules read it here with `flags.isOn(name)`; and a route that belongs
// to an unreleased feature is wrapped in `requireFeature(name)`, which answers
// 404 while the flag is off.
//
// The client keeps its own typed copy of the registry (src/features/flags.ts).
// A test (server/features.test.js) fails when the two lists differ, so adding a
// flag means editing both files. Names are lower snake_case.

/** Every flag in the product. Keep sorted by workstream; add new ones here AND in src/features/flags.ts. */
export const FLAG_NAMES = [
  // WS1 detect more behaviours
  'detection_behaviors',
  'experimental',
  // WS2 coaching / HRT
  'hrt_coaching',
  'urge_timer',
  // WS3 fewer false alarms
  'false_positive_controls',
  // WS4 sync
  'event_sync',
  'data_backup',
  // WS5 insights
  'insights',
  'photo_diary',
  'weekly_email',
  // WS6 phone companion
  'phone_companion',
  // WS7a / WS7b background watching, desktop
  'background_watching',
  'desktop_app',
  // WS8 sign-in
  'signin_magic_link',
  'signin_apple',
  'signin_microsoft',
  // WS9 pricing
  'free_tier',
  'lifetime_plan',
  'gift_plan',
  'referrals',
  'regional_pricing',
  // WS10 sharing
  'share_links',
  // WS11a marketing
  'compare_competitors',
  'social_proof',
  // WS12 locales
  'locale_es',
  'locale_de',
  'locale_pt_br',
];

/**
 * Flags that only make sense with another flag on. Advisory: nothing is
 * switched off automatically, but a startup warning tells the owner.
 */
export const FLAG_DEPENDS_ON = {
  experimental: ['detection_behaviors'],
  urge_timer: ['hrt_coaching'],
  weekly_email: ['event_sync', 'insights'],
  photo_diary: ['insights'],
};

/**
 * Parses a FEATURE_FLAGS value.
 *
 * - Names are case-insensitive and may be separated by commas and/or spaces.
 * - Unknown names are reported in `unknown` and ignored (a typo must not enable
 *   anything). There is deliberately no "all": every flag is switched on by name.
 *
 * @returns {{ flags: Record<string, boolean>, unknown: string[] }}
 */
export function parseFlags(raw, { known = FLAG_NAMES } = {}) {
  const flags = Object.fromEntries(known.map(name => [name, false]));
  const unknown = [];
  const tokens = String(raw ?? '')
    .split(/[,\s]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(flags, token)) {
      flags[token] = true;
    } else {
      unknown.push(token);
    }
  }
  return { flags, unknown };
}

/** Flags that are on while something they depend on is off. */
export function unmetDependencies(flags, dependsOn = FLAG_DEPENDS_ON) {
  const out = [];
  for (const [name, needs] of Object.entries(dependsOn)) {
    if (!flags[name]) continue;
    const missing = needs.filter(n => !flags[n]);
    if (missing.length) out.push({ flag: name, missing });
  }
  return out;
}

/**
 * Builds the flag set from an environment. `isOn` of an unknown name is false.
 * The map is computed once: flags change only when the server restarts.
 */
export function createFlags(env = process.env, { warn = console.warn, known = FLAG_NAMES } = {}) {
  const { flags, unknown } = parseFlags(env.FEATURE_FLAGS, { known });

  if (unknown.length) {
    warn(`[features] ignoring unknown flag(s) in FEATURE_FLAGS: ${unknown.join(', ')}`);
  }
  for (const { flag, missing } of unmetDependencies(flags)) {
    warn(`[features] ${flag} is on but ${missing.join(', ')} is off; ${flag} will not do anything useful`);
  }

  const frozen = Object.freeze({ ...flags });
  return {
    names: [...known],
    /** A fresh copy of the map, every known flag present as true or false. */
    all: () => ({ ...frozen }),
    isOn: name => frozen[name] === true,
    /** The names that are on, for logging. */
    enabled: () => known.filter(n => frozen[n]),
    unknown,
  };
}

/**
 * Express middleware factory: `requireFeature('event_sync')` answers 404 while
 * the flag is off, so an unreleased endpoint is indistinguishable from one that
 * does not exist. Throws at registration time on an unknown name, so a typo
 * fails the server's boot instead of silently leaving a route permanently dark.
 */
export function createRequireFeature(flags) {
  return function requireFeature(name) {
    if (!flags.names.includes(name)) {
      throw new Error(`requireFeature: unknown feature flag "${name}"`);
    }
    return function featureGate(_req, res, next) {
      if (flags.isOn(name)) return next();
      res.status(404).json({ error: 'Not found' });
    };
  };
}
