// The WS9 side of POST /api/paddle/webhook.
//
// server.js keeps the route, the raw-body parser and the signature check exactly as they were; after
// the signature has been verified and the body parsed it makes ONE call here, `take(event, res)`:
//
//   * an event whose id was already handled is acknowledged and ignored (replay safety);
//   * transaction.completed and adjustment.* (lifetime, gift, referral, refund) are handled here, and
//     recorded as handled only once that succeeded. If handling throws, `take` throws, server.js
//     answers 500 and Paddle retries; nothing was recorded, and the effects are idempotent anyway;
//   * every other event (the subscription.* family the existing handlers deal with) is left to them,
//     and is recorded as handled when the response has gone out with a success status.
//
// Events carry `event_id` ("evt_..."). One without it cannot be de-duplicated here; its effects are
// idempotent on their own keys, so it is still handled.
//
// Out of order delivery of subscription.* events is NOT addressed here (Paddle recommends comparing
// occurred_at); that is listed as a known gap in docs/agents/ws9-notes.md.

const HANDLED_HERE = new Set(['transaction.completed', 'adjustment.created', 'adjustment.updated']);
const KEEP_MS = 60 * 86_400_000;

export function createBillingWebhook({ db, purchases, now = Date.now, log = console.log, logError = console.error }) {
  const seen = db.prepare('SELECT 1 FROM paddle_events WHERE event_id = ?');
  const insert = db.prepare('INSERT OR IGNORE INTO paddle_events (event_id, event_type, occurred_at, processed_at) VALUES (?, ?, ?, ?)');
  const prune = db.prepare('DELETE FROM paddle_events WHERE processed_at < ?');

  function record(event) {
    if (typeof event?.event_id !== 'string') return;
    try {
      insert.run(event.event_id, String(event.event_type ?? ''), typeof event.occurred_at === 'string' ? event.occurred_at : null, new Date(now()).toISOString());
    } catch (err) {
      logError(`[billing] could not record event ${event.event_id}: ${err.message}`);
    }
  }

  async function dispatch(event) {
    if (event.event_type === 'transaction.completed') return purchases.onTransactionCompleted(event.data);
    return purchases.onAdjustment(event.data);
  }

  return {
    /** Forget events older than 60 days. Called once at boot. */
    prune() {
      return prune.run(new Date(now() - KEEP_MS).toISOString()).changes;
    },

    /**
     * @param event  the parsed, signature-verified webhook body
     * @param res    the Express response (to learn when the legacy handlers succeeded); optional
     * @returns {Promise<boolean>} true when the event is done and the caller should just answer 200
     */
    async take(event, res) {
      const id = typeof event?.event_id === 'string' ? event.event_id : null;
      if (id && seen.get(id)) {
        log(`[billing] ${event.event_type} ${id} already handled, ignored`);
        return true;
      }
      if (HANDLED_HERE.has(event?.event_type)) {
        await dispatch(event);
        record(event);
        return true;
      }
      if (res) res.once('finish', () => { if (res.statusCode < 400) record(event); });
      return false;
    },
  };
}
