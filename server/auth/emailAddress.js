// Email address handling for sign-in.
//
// Every place that compares or stores an address for sign-in goes through
// normalizeEmail(), so "Ann@Example.com " and "ann@example.com" are one person.
// It is deliberately conservative: it rejects anything that could smuggle a
// header or a second recipient into an outgoing message, and it does NOT try to
// be clever about "+tags" or dots (those are different mailboxes as far as we can
// tell).

const FORBIDDEN = /[\s<>()[\]\\,;:"\u0000-\u001f\u007f]/;

/**
 * @param {unknown} raw
 * @returns {string | null} the trimmed, lower-cased address, or null if it is not
 *   a plausible single address.
 */
export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64) return null;
  if (FORBIDDEN.test(local) || FORBIDDEN.test(domain)) return null;
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return null;
  if (domain.split('.').pop().length < 2) return null;
  return email;
}
