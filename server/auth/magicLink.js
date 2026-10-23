// Emailed sign-in links: token lifecycle.
//
//  - The token is 32 random bytes (base64url, 43 characters). It exists in the
//    email and nowhere else: the database keeps only its SHA-256, so a leaked
//    database cannot be turned into working links.
//  - It expires after 15 minutes and can be used once. "Used" is claimed with a
//    single conditional UPDATE, so two simultaneous clicks cannot both win.
//  - The hash we look up is compared again with timingSafeEqual. (The lookup is by
//    an indexed digest of a 256-bit secret, which leaks nothing an attacker can
//    use; the explicit constant-time compare is belt and braces.)
//  - Requests are throttled per address here (rows are counted in the database, so
//    the limit survives a restart) and per IP in the route module.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
/** At most this many links per address per window, and no more than one per gap. */
export const PER_EMAIL_MAX = 5;
export const PER_EMAIL_WINDOW_MS = 60 * 60 * 1000;
export const PER_EMAIL_MIN_GAP_MS = 30 * 1000;
/** Used and expired rows are kept this long (so the page can say "already used"), then deleted. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = token => createHash('sha256').update(token).digest('hex');

export function createMagicLinkStore(db, { now = Date.now, ttlMs = MAGIC_LINK_TTL_MS } = {}) {
  const insert = db.prepare(`
    INSERT INTO magic_link_tokens (token_hash, email, created_at, expires_at, used_at, created_ip)
    VALUES (?, ?, ?, ?, NULL, ?)`);
  const byHash = db.prepare('SELECT * FROM magic_link_tokens WHERE token_hash = ?');
  const claim = db.prepare(
    'UPDATE magic_link_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?');
  const recent = db.prepare(
    'SELECT COUNT(*) AS n, MAX(created_at) AS last FROM magic_link_tokens WHERE email = ? AND created_at > ?');
  const purgeOld = db.prepare('DELETE FROM magic_link_tokens WHERE expires_at < ? AND created_at < ?');

  return {
    /**
     * May another link be sent to this address right now? Counts every link
     * issued to it (whether or not the address has an account, so the answer
     * never depends on whether it does).
     * @returns {{ allowed: true } | { allowed: false, reason: 'too_soon' | 'too_many' }}
     */
    checkEmailAllowance(email) {
      const t = now();
      const { n, last } = recent.get(email, t - PER_EMAIL_WINDOW_MS);
      if (n >= PER_EMAIL_MAX) return { allowed: false, reason: 'too_many' };
      if (last != null && t - last < PER_EMAIL_MIN_GAP_MS) return { allowed: false, reason: 'too_soon' };
      return { allowed: true };
    },

    /** Creates a link token. The raw token is returned once, for the email, and never stored. */
    issue({ email, ip = null }) {
      const t = now();
      purgeOld.run(t - RETENTION_MS, t - RETENTION_MS);
      const token = randomBytes(32).toString('base64url');
      insert.run(hashToken(token), email, t, t + ttlMs, ip);
      return { token, expiresAt: t + ttlMs };
    },

    /**
     * Spends a token. Everything that is not a live token reports a reason, and
     * none of the reasons reveal anything about accounts.
     * @returns {{ ok: true, email: string } | { ok: false, reason: 'invalid' | 'expired' | 'used' }}
     */
    consume(token) {
      if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return { ok: false, reason: 'invalid' };
      const hash = hashToken(token);
      return db.transaction(() => {
        const row = byHash.get(hash);
        if (!row) return { ok: false, reason: 'invalid' };
        const a = Buffer.from(hash, 'hex');
        const b = Buffer.from(row.token_hash, 'hex');
        if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
        if (row.used_at != null) return { ok: false, reason: 'used' };
        const t = now();
        if (row.expires_at <= t) return { ok: false, reason: 'expired' };
        const res = claim.run(t, row.id, t);
        if (res.changes !== 1) return { ok: false, reason: 'used' };
        return { ok: true, email: row.email };
      })();
    },
  };
}
