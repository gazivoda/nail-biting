// Optional sync of history (WS4). Everything here is behind the `event_sync` flag:
// while it is off every path answers 404 for everyone, signed in or not.
//
//   POST   /api/events/sync     { since, events[], deviceId, epoch? }
//                               -> { events[], cursor, hasMore, epoch }
//   GET    /api/events/status   -> { epoch, count, live, deleted, quota, lastChangeAt }
//   DELETE /api/events          wipe the caller's synced events -> { deleted, epoch }
//
// What is stored: HabitEvent records only, per user (server/events/store.js).
// What is refused: anything else. The validator (server/events/validate.js) is a
// whitelist and answers 400 to an unknown field, so landmarks, frames, images or
// calibration data can never be stored, even by a buggy client.
//
// Body size: server.js parses JSON with a 10 kb limit for every route. The sync
// route needs more (a first sync sends up to 500 events), so server.js skips the
// global parser for exactly `/api/events/sync` and this module parses the body
// itself, after the flag check and the sign-in check, with its own limit.
//
// Semantics: last write wins by `updatedAt` with a deterministic tie-break
// (server/events/compare.js); deletes are kept as tombstones; replaying a batch
// changes nothing; the cursor is a monotonic per-server sequence number.

import express from 'express';
import rateLimit from 'express-rate-limit';
import { createEventStore, EVENTS_MIGRATIONS } from '../events/store.js';
import { parseSyncRequest } from '../events/validate.js';
import { LIMITS } from '../events/limits.js';

/**
 * @param {object} [options] overrides for tests
 * @param {Partial<typeof LIMITS>} [options.limits]
 * @param {{ windowMs?: number, limit?: number }} [options.syncRateLimit]
 * @param {{ windowMs?: number, limit?: number }} [options.manageRateLimit]
 */
export function createEventsModule(options = {}) {
  const limits = { ...LIMITS, ...options.limits };

  return {
    name: 'events',
    migrations: EVENTS_MIGRATIONS,

    register({ app, db, authMiddleware, requireFeature }) {
      const store = createEventStore(db);
      const gate = [requireFeature('event_sync'), authMiddleware];

      // Per user, not per address: several people can share one. The server-wide limit of
      // 100 requests / 15 min / address still applies on top.
      const makeLimiter = (cfg, message) => rateLimit({
        windowMs: cfg.windowMs,
        limit: cfg.limit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: req => `events:${req.userId}`,
        message: { error: message },
      });
      const syncLimiter = makeLimiter({ windowMs: 5 * 60 * 1000, limit: 40, ...options.syncRateLimit }, 'Too many sync requests, please slow down.');
      const manageLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 30, ...options.manageRateLimit }, 'Too many requests, please slow down.');

      const parseBody = (req, res, next) => {
        express.json({ limit: limits.bodyLimit })(req, res, err => {
          if (!err) return next();
          if (err.type === 'entity.too.large' || err.status === 413) return res.status(413).json({ error: 'payload_too_large' });
          return res.status(400).json({ error: 'invalid_json' });
        });
      };

      app.post('/api/events/sync', ...gate, syncLimiter, parseBody, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const parsed = parseSyncRequest(req.body, limits);
        if (!parsed.ok) return res.status(400).json(parsed.error);
        const { since, events, epoch } = parsed.value;
        const userId = String(req.userId);

        // A device holding an epoch the server no longer has (the data was wiped, or the
        // server lost it) must stop, not quietly upload its history again.
        if (epoch !== null && epoch !== store.getEpoch(userId)) {
          return res.status(409).json({ error: 'epoch_changed' });
        }
        const currentEpoch = store.ensureEpoch(userId);

        const r = store.sync(userId, events, { since, pageSize: limits.pageSize, quota: limits.quotaPerUser });
        if (!r.ok) return res.status(413).json({ error: r.code, limit: r.limit, count: r.count });
        return res.json({ events: r.events, cursor: r.cursor, hasMore: r.hasMore, epoch: currentEpoch });
      });

      app.get('/api/events/status', ...gate, manageLimiter, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const userId = String(req.userId);
        const { total, live, deleted, lastChangeAt } = store.counts(userId);
        res.json({ epoch: store.getEpoch(userId), count: total, live, deleted, quota: limits.quotaPerUser, lastChangeAt });
      });

      app.delete('/api/events', ...gate, manageLimiter, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const { deleted, epoch } = store.wipe(String(req.userId));
        res.json({ deleted, epoch });
      });
    },
  };
}

export default createEventsModule();
