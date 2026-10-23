// Small shared helpers for the extra sign-in routes: starting a session the same
// way the Google callback does, building failure redirects, telling who is
// calling, and a constant-time string compare.

import { createHash, timingSafeEqual } from 'node:crypto';

/** The session cookie, byte for byte what the Google callback sets in server.js. */
export function sessionCookieOptions(appUrl) {
  return {
    httpOnly: true,                       // not readable by JS
    secure: appUrl.startsWith('https'),   // HTTPS only in production
    sameSite: 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000,     // 14 days, matches the JWT expiry
  };
}

/**
 * Finishes a sign-in the way the Google callback does:
 *  - web: sets the nh_session cookie; the person goes to `${APP_URL}/`
 *  - ELECTRON_PROTOCOL set: no cookie; the token goes in a stopbiting://auth deep link
 * @returns {string} where to send the person next
 */
export function completeSignIn({ signToken, config, res, userId }) {
  const token = signToken(userId);
  if (config.ELECTRON_PROTOCOL) {
    return `${config.ELECTRON_PROTOCOL}://auth?token=${encodeURIComponent(token)}`;
  }
  res.cookie('nh_session', token, sessionCookieOptions(config.APP_URL));
  return `${config.APP_URL}/`;
}

/**
 * Where a failed browser sign-in lands: the sign-in page, which explains it.
 * (Google's failures go to /#auth_error=...; that path stays as it is.)
 * With ELECTRON_PROTOCOL the desktop app gets stopbiting://auth?error=...
 */
export function failureRedirect(config, code, extra = {}) {
  const q = new URLSearchParams({ error: code, ...extra }).toString();
  if (config.ELECTRON_PROTOCOL) return `${config.ELECTRON_PROTOCOL}://auth?${q}`;
  return `${config.APP_URL}/signin?${q}`;
}

/** Loopback, private (RFC 1918), link-local, carrier-grade NAT and IPv6 unique-local addresses. */
export function isPrivateAddress(address) {
  if (typeof address !== 'string') return false;
  const a = address.trim().toLowerCase().replace(/^::ffff:/, '');
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (v4) {
    const [x, y] = [Number(v4[1]), Number(v4[2])];
    return x === 10 || x === 127 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168)
      || (x === 169 && y === 254) || (x === 100 && y >= 64 && y <= 127);
  }
  return a === '::1' || /^f[cd][0-9a-f]{2}:/.test(a) || /^fe[89ab][0-9a-f]:/.test(a);
}

/**
 * The caller's address, for rate limiting and for the audit column.
 *
 * server.js does not set `trust proxy`, so `req.ip` is the address of whatever is
 * directly in front of the app: behind a reverse proxy (Coolify/Traefik) that is
 * the proxy, and every visitor would share one bucket. The proxy appends the
 * address it saw to X-Forwarded-For, so the LAST entry is the one to trust
 * (earlier entries are client-supplied). That header is honoured ONLY when the TCP
 * peer is itself on a private network, i.e. a proxy in front of us; a request that
 * reaches the app directly from the internet cannot spoof it. (With a second proxy
 * in front of that one, such as a CDN, the last entry is the CDN's address.)
 */
export function clientIp(req) {
  const peer = req.socket?.remoteAddress;
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim() && isPrivateAddress(peer)) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.ip || peer || 'unknown';
}

/**
 * Browser POSTs to the JSON endpoints must come from our own site. (They also
 * require Content-Type: application/json, which a cross-site form cannot send
 * and a cross-site fetch cannot send without a CORS preflight the API refuses.)
 * Requests with no Origin header (curl, server to server) are allowed: they
 * carry no browser credentials to abuse.
 */
export function sameOriginOk(req, config) {
  const origin = req.headers?.origin;
  if (!origin || config.ELECTRON_PROTOCOL) return true;
  try {
    return origin === new URL(config.APP_URL).origin;
  } catch {
    return false;
  }
}

/** Constant-time equality for two strings of any length. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
