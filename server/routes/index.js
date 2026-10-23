// The server route registry.
//
// server.js makes ONE call into this file, `registerRoutes({...})`, placed after
// the built-in auth/Paddle routes and BEFORE static files and the server-side
// rendered page routes (and their catch-all 404). Everything new on the server
// lives in a module under server/routes/ and is listed below. A workstream adds
// exactly:
//
//   1. server/routes/<name>.js        its routes (see _example.js)
//   2. one `import` and one entry in ROUTE_MODULES below
//
// A module is `{ name, migrations?, register(ctx) }`. `ctx` is built by
// buildContext(); route modules take what they need from it:
//
//   app                Express app. Register routes on it.
//   db                 better-sqlite3 handle for data/users.db.
//   authMiddleware     requires a valid session; sets req.userId.
//   getUser(id)        user row (lazily marks expired trials), or null.
//   saveUser(user)     upsert a user row; returns the saved row.
//   findUserByEmail(e) user row by email, or null.
//   signToken(userId)  signs a session JWT (same as the Google sign-in does).
//   sendEmail({...})   transactional email via Resend (email.js).
//   flags              flags.isOn(name), flags.all(). Read-only.
//   requireFeature(n)  middleware: 404 while flag n is off. Throws on a typo.
//   config             { APP_URL, ELECTRON_PROTOCOL, isProduction }.
//
// Keep secrets out of ctx: modules read their own env vars.

import { sendEmail } from '../../email.js';
import { createFlags, createRequireFeature } from '../features.js';
import { runMigrations } from '../db/migrate.js';
import features from './features.js';
import example from './_example.js';

/** Registered in this order. Append your module; do not reorder others. */
export const ROUTE_MODULES = [
  features,
  example,
  // WS4  events sync          -> import events from './events.js'
  // WS5  weekly email         -> import insights from './insights.js'
  // WS8  sign-in providers    -> import signin from './signin.js'
  // WS9  referrals / pricing  -> import billing from './billing.js'
  // WS10 share links          -> import share from './share.js'
];

/** Completes the context server.js passes in. Exported for tests. */
export function buildContext(partial, env = process.env) {
  const flags = partial.flags ?? createFlags(env);
  return {
    sendEmail,
    ...partial,
    flags,
    requireFeature: createRequireFeature(flags),
    config: { isProduction: env.NODE_ENV === 'production', ...partial.config },
  };
}

/**
 * Runs every module's migrations, then registers every module's routes.
 * Throws on a bad migration or a mistyped flag name, so the server fails at
 * boot instead of serving a half-installed feature.
 *
 * @returns the finished context.
 */
export function registerRoutes(partialCtx, modules = ROUTE_MODULES, env = process.env, log = console.log) {
  const ctx = buildContext(partialCtx, env);

  const steps = modules.flatMap(m => m.migrations ?? []);
  if (steps.length > 0) {
    const ran = runMigrations(ctx.db, steps);
    if (ran.length) log(`[routes] applied migrations: ${ran.join(', ')}`);
  }

  for (const mod of modules) mod.register(ctx);

  const on = ctx.flags.enabled();
  log(`[routes] ${modules.map(m => m.name).join(', ')} registered; flags on: ${on.length ? on.join(', ') : 'none'}`);
  return ctx;
}
