// Gift codes (WS9, flag gift_plan).
//
// A gift is bought through Paddle (one-time price PADDLE_PRICE_ID_GIFT). The webhook creates a code,
// emails it to the buyer as a link, and the recipient redeems it once while signed in.
//
//   * The code is 20 characters of Crockford base32: 100 bits from the system's CSPRNG. It cannot be
//     guessed, and only its SHA-256 is stored, so a copy of the database does not contain a usable code.
//   * Single use: redeeming is one UPDATE that only succeeds on a row that is neither redeemed nor
//     revoked, in the same transaction that saves the days for the recipient.
//   * What it grants is a block of GIFT_PLAN_DAYS days (default 365) that starts when the recipient
//     has no other access (entitlements.js). It can have an expiry (GIFT_CODE_EXPIRY_DAYS, default
//     none), after which it can no longer be redeemed.
//   * If the buyer's email did not go out, the purchase stays retryable: the stored code cannot be
//     read back, so the next attempt issues a NEW code for the same purchase (the old hash is replaced)
//     and sends that one.

import { createHash, randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const CODE_LENGTH = 20;
const DAY_MS = 86_400_000;

export function generateGiftCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] & 31]; // 256 is a multiple of 32: no modulo bias
  return out;
}

/** The pretty form people see and paste: XXXXX-XXXXX-XXXXX-XXXXX. */
export function formatGiftCode(code) {
  return code.match(/.{5}/g).join('-');
}

/** Canonical 20-character code from whatever was typed or pasted, or null. Crockford's look-alike rules apply. */
export function normalizeGiftCode(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

export const hashGiftCode = canonical => createHash('sha256').update(canonical).digest('hex');

export function createGifts(db, { entitlements, giftDays, expiryDays = 0, now = Date.now }) {
  const iso = t => new Date(t).toISOString();
  const byTxn = db.prepare('SELECT * FROM gift_codes WHERE txn_id = ?');
  const byHash = db.prepare('SELECT * FROM gift_codes WHERE code_hash = ?');
  const insert = db.prepare(`
    INSERT INTO gift_codes (txn_id, code_hash, days, buyer_email, buyer_user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const reissue = db.prepare('UPDATE gift_codes SET code_hash = ?, buyer_email = COALESCE(?, buyer_email) WHERE id = ? AND redeemed_at IS NULL AND revoked_at IS NULL');
  const sent = db.prepare('UPDATE gift_codes SET email_sent_at = ? WHERE id = ? AND email_sent_at IS NULL');
  const claim = db.prepare('UPDATE gift_codes SET redeemed_by = ?, redeemed_at = ? WHERE id = ? AND redeemed_at IS NULL AND revoked_at IS NULL');
  const revoke = db.prepare('UPDATE gift_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL');

  return {
    byTransaction: txnId => byTxn.get(txnId) ?? null,

    /**
     * Makes the code for a purchase. The plaintext is returned ONCE, for the email.
     * @returns {{ duplicate: true } | { code: string, row: object }}
     *   duplicate: the purchase already has a code AND its email went out; nothing to do.
     */
    issueForTransaction({ txnId, buyerEmail = null, buyerUserId = null }) {
      const tx = db.transaction(() => {
        const existing = byTxn.get(txnId);
        if (existing && (existing.email_sent_at || existing.redeemed_at || existing.revoked_at)) return { duplicate: true };
        const code = generateGiftCode();
        const hash = hashGiftCode(code);
        if (existing) {
          reissue.run(hash, buyerEmail, existing.id);
          return { code, row: byTxn.get(txnId) };
        }
        const t = now();
        insert.run(txnId, hash, giftDays, buyerEmail, buyerUserId, iso(t), expiryDays > 0 ? iso(t + expiryDays * DAY_MS) : null);
        return { code, row: byTxn.get(txnId) };
      });
      return tx();
    },

    markEmailSent(txnId) {
      const row = byTxn.get(txnId);
      if (row) sent.run(iso(now()), row.id);
    },

    /**
     * @returns {{ ok: true, days: number } | { ok: false, reason: 'invalid' | 'already_redeemed' | 'expired' | 'revoked' }}
     */
    redeem({ userId, code }) {
      const canonical = normalizeGiftCode(code);
      if (!canonical) return { ok: false, reason: 'invalid' };
      const tx = db.transaction(() => {
        const row = byHash.get(hashGiftCode(canonical));
        if (!row) return { ok: false, reason: 'invalid' };
        if (row.revoked_at) return { ok: false, reason: 'revoked' };
        if (row.redeemed_at) return { ok: false, reason: 'already_redeemed' };
        if (row.expires_at && row.expires_at <= iso(now())) return { ok: false, reason: 'expired' };
        if (claim.run(userId, iso(now()), row.id).changes !== 1) return { ok: false, reason: 'already_redeemed' };
        entitlements.bank(userId, 'gift', row.days, `gift:${row.id}`);
        return { ok: true, days: row.days };
      });
      return tx();
    },

    /**
     * A refunded or charged-back gift purchase: the code stops working, and if it was already redeemed the
     * recipient's days are taken back too.
     * @returns {{ found: boolean, redeemedBy: string | null }}
     */
    revokeByTransaction(txnId, reason = 'refund') {
      const row = byTxn.get(txnId);
      if (!row) return { found: false, redeemedBy: null };
      revoke.run(iso(now()), row.id);
      if (row.redeemed_at) entitlements.revokeBySource(`gift:${row.id}`, reason);
      return { found: true, redeemedBy: row.redeemed_by ?? null };
    },
  };
}
