// The privacy audit's judge (WS13). Pure: no browser, no network, no files. It is given the requests a
// browser session made and says whether any of them could have carried what the product promises never
// leaves the device: camera frames, images, hand or face landmarks, video, or the nail photo diary.
// run.mjs records the session; this file decides. The meta-test (check.test.mjs) feeds it synthetic bad
// requests to prove it CAN fail, which is the only reason to believe a pass.
//
// A "record" is what run.mjs builds from the DevTools protocol:
//   { kind: 'http' | 'ws-open' | 'ws-frame' | 'hook',
//     id, target ('page' | 'worker' | 'service_worker' | ...), method, url, resourceType,
//     headers: { name: value }, body: Buffer | null, bodyState: 'none' | 'present' | 'unavailable',
//     api, bodyType, head (hook records) }
//
// What this can NOT see: traffic the browser makes by itself (component updates, safe browsing, DNS),
// and anything encrypted or obfuscated beyond base64 / percent-encoding / gzip / JSON nesting. See the report.

import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

// ── Findings ────────────────────────────────────────────────────────────────

/** @typedef {{ severity: 'fail' | 'warn', code: string, url: string, message: string, evidence: string, recordId?: string }} Finding */

const clip = (s, n = 120) => {
  const t = String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
  return t.length > n ? `${t.slice(0, n)}...` : t;
};
const hex = (buf, n = 16) => Buffer.from(buf.subarray(0, n)).toString('hex');

// ── Byte signatures ─────────────────────────────────────────────────────────

const SIGNATURES = [
  { kind: 'image', name: 'JPEG', test: (b, i) => b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff },
  { kind: 'image', name: 'PNG', test: (b, i) => b[i] === 0x89 && b[i + 1] === 0x50 && b[i + 2] === 0x4e && b[i + 3] === 0x47 && b[i + 4] === 0x0d && b[i + 5] === 0x0a && b[i + 6] === 0x1a && b[i + 7] === 0x0a },
  { kind: 'image', name: 'GIF', test: (b, i) => b[i] === 0x47 && b[i + 1] === 0x49 && b[i + 2] === 0x46 && b[i + 3] === 0x38 && (b[i + 4] === 0x37 || b[i + 4] === 0x39) && b[i + 5] === 0x61 },
  { kind: 'image', name: 'WebP', test: (b, i) => b[i] === 0x52 && b[i + 1] === 0x49 && b[i + 2] === 0x46 && b[i + 3] === 0x46 && b[i + 8] === 0x57 && b[i + 9] === 0x45 && b[i + 10] === 0x42 && b[i + 11] === 0x50 },
  { kind: 'image', name: 'BMP', test: (b, i) => b[i] === 0x42 && b[i + 1] === 0x4d && b[i + 6] === 0 && b[i + 7] === 0 && b[i + 8] === 0 && b[i + 9] === 0 && (b[i + 14] === 40 || b[i + 14] === 12 || b[i + 14] === 108 || b[i + 14] === 124) },
  { kind: 'image', name: 'AVIF/HEIC', test: (b, i) => b[i + 4] === 0x66 && b[i + 5] === 0x74 && b[i + 6] === 0x79 && b[i + 7] === 0x70 && ['avif', 'avis', 'heic', 'heix', 'mif1'].includes(String.fromCharCode(b[i + 8], b[i + 9], b[i + 10], b[i + 11])) },
  { kind: 'image', name: 'TIFF', test: (b, i) => (b[i] === 0x49 && b[i + 1] === 0x49 && b[i + 2] === 0x2a && b[i + 3] === 0) || (b[i] === 0x4d && b[i + 1] === 0x4d && b[i + 2] === 0 && b[i + 3] === 0x2a) },
  { kind: 'video', name: 'MP4/MOV', test: (b, i) => b[i + 4] === 0x66 && b[i + 5] === 0x74 && b[i + 6] === 0x79 && b[i + 7] === 0x70 },
  { kind: 'video', name: 'WebM/Matroska', test: (b, i) => b[i] === 0x1a && b[i + 1] === 0x45 && b[i + 2] === 0xdf && b[i + 3] === 0xa3 },
  { kind: 'video', name: 'Ogg', test: (b, i) => b[i] === 0x4f && b[i + 1] === 0x67 && b[i + 2] === 0x67 && b[i + 3] === 0x53 },
  { kind: 'video', name: 'AVI', test: (b, i) => b[i] === 0x52 && b[i + 1] === 0x49 && b[i + 2] === 0x46 && b[i + 3] === 0x46 && b[i + 8] === 0x41 && b[i + 9] === 0x56 && b[i + 10] === 0x49 && b[i + 11] === 0x20 },
  { kind: 'video', name: 'FLV', test: (b, i) => b[i] === 0x46 && b[i + 1] === 0x4c && b[i + 2] === 0x56 && b[i + 3] === 0x01 },
];

/** Signature found at the start (offset 0) of the bytes, or anywhere when `anywhere` is true. */
export function findSignature(bytes, { anywhere = false } = {}) {
  if (!bytes || bytes.length < 4) return null;
  for (const s of SIGNATURES) if (s.test(bytes, 0)) return { kind: s.kind, name: s.name, offset: 0 };
  if (!anywhere) return null;
  // Anywhere in the bytes: only the signatures that are long or distinctive enough not to appear by chance.
  const needles = [
    ['image', 'JPEG', Buffer.from([0xff, 0xd8, 0xff]), 0],
    ['image', 'PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 0],
    ['image', 'GIF', Buffer.from('GIF89a'), 0],
    ['image', 'GIF', Buffer.from('GIF87a'), 0],
    ['image', 'WebP', Buffer.from('WEBP'), -8],
    ['video', 'WebM/Matroska', Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 0],
  ];
  let best = null;
  for (const [kind, name, needle, back] of needles) {
    const at = bytes.indexOf(needle);
    if (at === -1) continue;
    const off = at + back;
    if (off < 0) continue;
    if (name === 'WebP' && bytes.toString('latin1', off, off + 4) !== 'RIFF') continue;
    if (!best || off < best.offset) best = { kind, name, offset: off };
  }
  return best;
}

const isUtf8 = (buf) => {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
};

// ── Text scanning ───────────────────────────────────────────────────────────

const DATA_IMAGE = /data:\s*(?:image|video|audio)\/[a-z0-9.+-]+\s*[;,]/i;
const LANDMARK_KEY = /landmark|keypoint|face_?mesh|world_?landmark|handedness|blend_?shape|hand_?points|face_?points|mesh_?points|pose_?points|tensor/i;
const MEDIA_KEY = /^(?:frames?|image|images|img|photo|photos|picture|video|videoFrame|pixels|bitmap|imageData|snapshot|screenshot|thumbnail|canvas|stream|mediaStream)$/i;
// Thirty or more decimal numbers in a row (a hand is 21 points x 3, a face mesh 468 x 3).
const FLOAT_RUN = /(?:-?\d+\.\d{2,}[\s,;:|\]\[{}"']*){30,}/;
const B64_RUN = /[A-Za-z0-9+/_-]{24,}={0,2}/g;
const B64_PREFIXES = [
  ['/9j/', 'JPEG'], ['_9j_', 'JPEG (url-safe)'], ['iVBORw0KGgo', 'PNG'], ['R0lGODlh', 'GIF'], ['R0lGODdh', 'GIF'], ['UklGR', 'RIFF (WebP/AVI)'],
  ['AAAAIGZ0eXA', 'MP4'], ['AAAAGGZ0eXA', 'MP4'], ['AAAAHGZ0eXA', 'MP4'], ['AAAAFGZ0eXA', 'MP4'], ['GkXfo', 'WebM'],
];

function b64ToBuffer(run) {
  try {
    return Buffer.from(run.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch { return null; }
}

/** Percent-escapes decoded to BYTES (not to UTF-16 text), so %FF%D8%FF becomes the JPEG start. */
export function percentDecodeToBuffer(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x25 && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) { out.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else if (c === 0x2b) out.push(0x20);
    else if (c < 0x80) out.push(c);
    else for (const b of Buffer.from(s[i], 'utf8')) out.push(b);
  }
  return Buffer.from(out);
}

/** Is the value plainly a point? {x,y}, {x,y,z}, [x,y], [x,y,z] with numbers. */
function isPoint(v) {
  if (Array.isArray(v)) return v.length >= 2 && v.length <= 4 && v.every(n => typeof n === 'number' && Number.isFinite(n));
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    return typeof v.x === 'number' && typeof v.y === 'number' && keys.length <= 5
      && keys.every(k => ['x', 'y', 'z', 'visibility', 'presence'].includes(k));
  }
  return false;
}

/**
 * Walks parsed JSON and reports landmark-shaped data. Returns [{ code, evidence }].
 * Depth and size are bounded so a hostile payload cannot hang the audit.
 */
export function walkJson(value, path = '$', out = [], depth = 0) {
  if (depth > 12 || out.length > 20) return out;
  if (Array.isArray(value)) {
    if (value.length >= 21) {
      const points = value.filter(isPoint).length;
      if (points >= value.length * 0.9) {
        out.push({ code: 'landmark-array', evidence: `${path}: array of ${value.length} point-like items (hand = 21, face mesh = 468/478)` });
        return out;
      }
      const nums = value.filter(n => typeof n === 'number');
      if (value.length >= 63 && nums.length >= value.length * 0.9 && nums.filter(n => !Number.isInteger(n)).length >= nums.length * 0.5) {
        out.push({ code: 'float-array', evidence: `${path}: flat array of ${value.length} mostly non-integer numbers (a tensor or 21/468 points flattened)` });
        return out;
      }
    }
    for (let i = 0; i < Math.min(value.length, 2000); i++) walkJson(value[i], `${path}[${i}]`, out, depth + 1);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (LANDMARK_KEY.test(k)) out.push({ code: 'landmark-key', evidence: `${path}.${clip(k, 40)}: key names landmarks or face/hand tracking data` });
      else if (MEDIA_KEY.test(k) && v !== null && v !== false && v !== '' && !(typeof v === 'number')) out.push({ code: 'media-key', evidence: `${path}.${clip(k, 40)}: key names image/video/frame data` });
      walkJson(v, `${path}.${k}`, out, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 40) {
    const t = value.trim();
    if ((t.startsWith('{') || t.startsWith('[')) && t.length < 5_000_000) {
      try { walkJson(JSON.parse(t), `${path}(json-in-string)`, out, depth + 1); } catch { /* not JSON */ }
    }
  }
  return out;
}

/**
 * Scans text for what a request must never carry. `depth` bounds the recursion into decoded content.
 * Returns [{ code, evidence }].
 */
export function scanText(text, depth = 0) {
  const found = [];
  if (!text) return found;
  const add = (code, evidence) => { if (!found.some(f => f.code === code && f.evidence === evidence)) found.push({ code, evidence }); };

  if (DATA_IMAGE.test(text)) add('data-uri', `contains a data: URI (${clip(text.match(DATA_IMAGE)[0], 40)})`);
  if (FLOAT_RUN.test(text)) add('float-run', `a run of 30+ decimal numbers in a row: "${clip(text.match(FLOAT_RUN)[0], 80)}"`);

  // Base64 runs: known image prefixes, then decode and look for signatures anywhere.
  let n = 0;
  for (const m of text.matchAll(B64_RUN)) {
    if (++n > 200) break;
    const run = m[0];
    for (const [prefix, name] of B64_PREFIXES) {
      if (run.startsWith(prefix) && run.length >= 24) {
        const decoded = b64ToBuffer(run.slice(0, 64));
        const sig = decoded && findSignature(decoded);
        if (sig) add('image-base64', `base64 of a ${sig.name} (${prefix}...), ${run.length} chars`);
      }
    }
    if (run.length >= 64 && run.length <= 8_000_000) {
      const decoded = b64ToBuffer(run);
      const sig = decoded && findSignature(decoded, { anywhere: decoded.length < 4_000_000 });
      if (sig && !(sig.offset === 0 && sig.name === 'TIFF')) add('image-base64', `a base64 run of ${run.length} chars decodes to ${sig.name} data at offset ${sig.offset}`);
      else if (decoded && depth < 3 && decoded.length > 32 && isUtf8(decoded)) {
        for (const f of inspectBody(decoded, { depth: depth + 1 })) add(f.code, `(inside base64) ${f.evidence}`);
      }
    }
  }
  // Hex strings: a JPEG/PNG start spelled out in hex.
  if (/(?:^|[^0-9a-f])(?:ffd8ffe[0-9a-f]|ffd8ffdb|89504e470d0a1a0a|474946383[79]61)/i.test(text)) add('image-hex', 'hex spelling of an image file header');
  return found;
}

// ── One body ────────────────────────────────────────────────────────────────

function decompress(buf, encoding) {
  const enc = String(encoding ?? '').toLowerCase();
  try {
    if (enc.includes('gzip') || (buf[0] === 0x1f && buf[1] === 0x8b)) return gunzipSync(buf);
    if (enc.includes('br')) return brotliDecompressSync(buf);
    if (enc.includes('deflate')) return inflateSync(buf);
  } catch { /* fall through */ }
  return null;
}

function parseMultipart(buf, boundary) {
  const parts = [];
  const sep = Buffer.from(`--${boundary}`);
  let start = buf.indexOf(sep);
  while (start !== -1) {
    const next = buf.indexOf(sep, start + sep.length);
    if (next === -1) break;
    const chunk = buf.subarray(start + sep.length, next);
    const headEnd = chunk.indexOf('\r\n\r\n');
    if (headEnd !== -1) {
      const head = chunk.subarray(0, headEnd).toString('latin1');
      parts.push({ head, body: chunk.subarray(headEnd + 4, Math.max(headEnd + 4, chunk.length - 2)) });
    }
    start = next;
  }
  return parts;
}

/**
 * Inspects the bytes of one request body (or one decoded layer of it).
 * @returns {{ code: string, evidence: string }[]}
 */
export function inspectBody(buf, { contentType = '', contentEncoding = '', depth = 0, trustedBinary = false } = {}) {
  const found = [];
  if (!buf || buf.length === 0) return found;
  const ct = String(contentType).toLowerCase();
  const add = (code, evidence) => found.push({ code, evidence });

  if (/^(image|video|audio)\//.test(ct)) add('media-content-type', `Content-Type ${ct}`);

  // Compressed bodies: look inside. If we cannot, that is itself opaque.
  const inflated = depth < 2 ? decompress(buf, contentEncoding) : null;
  if (inflated) return [...found, ...inspectBody(inflated, { contentType, depth: depth + 1, trustedBinary })];
  if (/gzip|br|deflate/i.test(contentEncoding) && !inflated) add('opaque-body', `Content-Encoding ${contentEncoding} that could not be decoded`);

  // Raw signature anywhere in the bytes (a UTF-8 text body cannot contain 0xFF, so this only fires on binary data).
  const sig = findSignature(buf, { anywhere: buf.length < 8_000_000 });
  if (sig) add(sig.kind === 'video' ? 'video-bytes' : 'image-bytes', `${sig.name} signature at offset ${sig.offset} (${hex(buf.subarray(sig.offset))})`);

  if (ct.startsWith('multipart/')) {
    const boundary = /boundary=("?)([^";]+)\1/i.exec(contentType)?.[2];
    if (boundary) {
      for (const part of parseMultipart(buf, boundary)) {
        const partType = /content-type:\s*([^\r\n;]+)/i.exec(part.head)?.[1]?.trim().toLowerCase() ?? '';
        const filename = /filename="?([^";\r\n]*)/i.exec(part.head)?.[1];
        if (/^(image|video|audio)\//.test(partType)) add('multipart-media', `multipart part with Content-Type ${partType}`);
        else if (filename !== undefined && partType !== 'text/plain') add('multipart-file', `multipart part is a file upload (filename "${clip(filename, 40)}", ${partType || 'no type'})`);
        for (const f of inspectBody(part.body, { contentType: partType, depth: depth + 1 })) add(f.code, `(multipart part) ${f.evidence}`);
      }
    } else add('multipart-file', 'multipart/form-data body without a readable boundary');
    return dedupe(found);
  }

  const textual = isUtf8(buf);
  if (!textual && !sig && !trustedBinary) {
    add('binary-body', `${buf.length} bytes that are not text (first bytes ${hex(buf)}); could be a frame, tensor or video`);
  }
  if (!textual) {
    // Still look for ASCII-embedded base64 / data URIs inside the binary.
    for (const f of scanText(buf.toString('latin1'), depth)) add(f.code, f.evidence);
    return dedupe(found);
  }

  const text = buf.toString('utf8');

  if (ct.includes('x-www-form-urlencoded') || (/^[\w.%+-]+=/.test(text) && !text.trimStart().startsWith('{'))) {
    const params = new URLSearchParams(text);
    for (const [k, v] of params) {
      if (LANDMARK_KEY.test(k)) add('landmark-key', `form field "${clip(k, 40)}" names landmarks or tracking data`);
      if (depth < 2 && v) {
        for (const f of inspectBody(Buffer.from(v, 'utf8'), { depth: depth + 1 })) add(f.code, `(form field ${clip(k, 30)}) ${f.evidence}`);
      }
    }
    const raw = percentDecodeToBuffer(text);
    const rsig = findSignature(raw, { anywhere: true });
    if (rsig && !isUtf8(raw)) add(rsig.kind === 'video' ? 'video-bytes' : 'image-bytes', `percent-encoded ${rsig.name} bytes in a form body`);
  }

  // JSON?
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      for (const w of walkJson(JSON.parse(trimmed))) add(w.code, w.evidence);
    } catch { /* not JSON */ }
  }

  for (const f of scanText(text, depth)) add(f.code, f.evidence);
  return dedupe(found);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(f => { const k = `${f.code}|${f.evidence}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ── Needles (the photo diary) ───────────────────────────────────────────────

/** base64 spellings of `bytes` at each of the three possible alignments, with the unstable edge characters cut off. */
export function base64Spellings(bytes) {
  const out = [];
  for (let pad = 0; pad < 3; pad++) {
    const enc = Buffer.concat([Buffer.alloc(pad), bytes]).toString('base64').replace(/=+$/, '');
    const skip = pad === 0 ? 0 : Math.ceil((pad * 8) / 6);
    const s = enc.slice(skip, Math.max(skip, enc.length - 2));
    if (s.length >= 16) out.push(s, s.replace(/\+/g, '-').replace(/\//g, '_'));
  }
  return out;
}

/** Does `haystack` (a Buffer) contain `needle`, spelled raw, hex, base64 (any alignment) or percent-encoded? */
export function containsNeedle(haystack, needle) {
  if (!haystack || !haystack.length || !needle || needle.length < 12) return null;
  if (haystack.indexOf(needle) !== -1) return 'raw bytes';
  const text = haystack.toString('latin1');
  if (text.includes(needle.toString('hex'))) return 'hex';
  for (const s of base64Spellings(needle)) if (text.includes(s)) return 'base64';
  const pct = [...needle].map(b => `%${b.toString(16).padStart(2, '0')}`).join('');
  if (text.toLowerCase().includes(pct)) return 'percent-encoded';
  return null;
}

// ── Hosts ───────────────────────────────────────────────────────────────────

/**
 * The hosts the site is allowed to talk to (nothing else). Mirrors what the page's own Content-Security-Policy
 * (server.js) lets it reach, minus what a signed-in detection session does not use. Fonts are self-hosted.
 */
export const DEFAULT_ALLOWED_HOSTS = [
  { host: 'www.googletagmanager.com', why: 'Google Tag Manager loader (index.html)' },
  { host: 'www.google-analytics.com', why: 'Google Analytics' },
  { host: '*.google-analytics.com', why: 'Google Analytics (regional collectors)' },
  { host: 'analytics.google.com', why: 'Google Analytics' },
  { host: 'www.google.com', why: 'Google Analytics (ads/audience pings, connect-src)' },
  { host: '*.paddle.com', why: 'Paddle checkout and billing' },
  { host: 'public.profitwell.com', why: 'Paddle (ProfitWell) retention script, CSP script-src' },
  { host: 'lh3.googleusercontent.com', why: 'Google account avatar (image GET only)' },
];

export function hostAllowed(host, origin, allowed = DEFAULT_ALLOWED_HOSTS) {
  const h = host.toLowerCase();
  if (h === new URL(origin).host.toLowerCase()) return { ok: true, why: 'same origin' };
  const bare = h.replace(/:\d+$/, '');
  for (const a of allowed) {
    const rule = a.host.toLowerCase();
    if (rule.startsWith('*.')) { if (bare.endsWith(rule.slice(1)) && bare.length > rule.length - 1) return { ok: true, why: a.why }; }
    else if (bare === rule || h === rule) return { ok: true, why: a.why };
  }
  return { ok: false, why: '' };
}

// ── The whole session ───────────────────────────────────────────────────────

const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:', 'chrome:', 'chrome-extension:', 'devtools:', 'filesystem:']);
const REQUIRED_EVENT_KEYS = ['id', 'ts', 'source', 'behavior', 'updatedAt'];

/**
 * @param {object[]} records
 * @param {{ mode: 'off' | 'on' | 'flagsoff', origin: string,
 *           whitelist: { top: Set<string>, event: Set<string>, response: Set<string> },
 *           allowedHosts?: object[], needles?: { label: string, bytes: Buffer }[] }} opts
 */
export function evaluate(records, opts) {
  const { mode, origin, whitelist, needles = [] } = opts;
  const allowedHosts = opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;
  /** @type {Finding[]} */
  const findings = [];
  const hosts = new Map();
  const byTarget = {};
  const byType = {};
  const eventKeysSeen = new Set();
  const topKeysSeen = new Set();
  const responseKeysSeen = new Set();
  let syncPosts = 0;
  let syncEvents = 0;
  let eventsRequests = 0;
  let bodiesChecked = 0;
  let bytesChecked = 0;
  let local = 0;
  let unavailable = 0;

  const fail = (rec, code, message, evidence) => findings.push({ severity: 'fail', code, url: rec.url ?? '', message, evidence: clip(evidence, 220), recordId: rec.id });
  const warn = (rec, code, message, evidence) => findings.push({ severity: 'warn', code, url: rec.url ?? '', message, evidence: clip(evidence, 220), recordId: rec.id });

  for (const rec of records) {
    byTarget[rec.target ?? 'page'] = (byTarget[rec.target ?? 'page'] ?? 0) + 1;
    if (rec.kind === 'hook') {
      const t = String(rec.bodyType ?? '');
      // An attempt counts even if the site's CSP then blocks it: the page tried to talk to a stranger.
      if (/^https?:|^wss?:/i.test(String(rec.url ?? ''))) {
        try {
          const u = new URL(rec.url);
          hosts.set(u.host, hosts.get(u.host) ?? 0);
          if (!hostAllowed(u.host, origin, allowedHosts).ok) fail(rec, 'host-not-allowed', `${rec.api} to a host outside the allowlist (${u.host})`, `${rec.api} ${rec.method ?? ''} ${rec.url}`);
        } catch { /* relative or malformed */ }
      }
      if (/ImageBitmap|MediaStream|VideoFrame|ImageData|HTMLVideoElement|HTMLCanvasElement|OffscreenCanvas|HTMLImageElement|MediaStreamTrack/.test(t)) {
        fail(rec, 'media-object-sent', `${rec.api} was handed a ${t} as its body`, `${rec.api} ${rec.method ?? ''} ${rec.url} body=${t}`);
      }
      if (/^(image|video|audio)\//.test(String(rec.blobType ?? '').toLowerCase())) {
        fail(rec, 'media-blob-sent', `${rec.api} sent a ${rec.blobType} Blob`, `${rec.api} ${rec.url} blob type ${rec.blobType}, ${rec.size} bytes`);
      }
      if (rec.fileEntries?.length) {
        fail(rec, 'file-upload', `${rec.api} sent a FormData with file entries`, rec.fileEntries.map(f => `${f.name}:${f.type}:${f.size}`).join(', '));
      }
      if (rec.head) {
        const head = Buffer.from(rec.head, 'hex');
        const sig = findSignature(head);
        if (sig) fail(rec, sig.kind === 'video' ? 'video-bytes' : 'image-bytes', `${rec.api} body starts with a ${sig.name} signature`, `${rec.api} ${rec.url} head ${rec.head}`);
      }
      if (['RTCPeerConnection', 'webkitRTCPeerConnection', 'MediaRecorder'].includes(rec.api)) {
        fail(rec, 'webrtc-or-recorder-used', `the page created a ${rec.api}, a way to send or record camera media that this app does not use`, `${rec.api} in ${rec.target ?? 'page'}`);
      }
      if (rec.bodyType === 'ReadableStream' && rec.url) {
        warn(rec, 'stream-body', `${rec.api} used a ReadableStream body that cannot be read here`, `${rec.api} ${rec.url}`);
      }
      continue;
    }

    let url;
    try { url = new URL(rec.url); } catch { warn(rec, 'bad-url', 'request URL could not be parsed', rec.url); continue; }
    byType[rec.resourceType ?? rec.kind] = (byType[rec.resourceType ?? rec.kind] ?? 0) + 1;

    if (LOCAL_SCHEMES.has(url.protocol)) {
      local++;
      // A data: image URL used as a request is local, but make sure nothing is being posted along with it.
    } else {
      hosts.set(url.host, (hosts.get(url.host) ?? 0) + 1);
      const h = hostAllowed(url.host, origin, allowedHosts);
      if (!h.ok) fail(rec, 'host-not-allowed', `request to a host outside the allowlist (${url.host})`, `${rec.method ?? rec.kind} ${rec.url}`);
      else if (url.host !== new URL(origin).host && rec.method && rec.method !== 'GET' && rec.method !== 'HEAD' && rec.method !== 'OPTIONS' && rec.body && rec.body.length > 2048 && !/paddle|google/.test(url.host)) {
        warn(rec, 'large-third-party-body', 'large body to a third party', `${rec.method} ${rec.url} ${rec.body.length} bytes`);
      }
    }

    // The URL itself (query string) is part of the request.
    const rawUrl = rec.url.length > 20000 ? rec.url.slice(0, 20000) : rec.url;
    if (!LOCAL_SCHEMES.has(url.protocol)) {
      for (const f of scanText(decodeURIComponentSafe(rawUrl))) fail(rec, f.code, `the URL carries ${f.code}`, f.evidence);
      const qs = [...url.searchParams.keys()].find(k => LANDMARK_KEY.test(k) || MEDIA_KEY.test(k));
      if (qs) fail(rec, 'landmark-key', `query parameter "${clip(qs, 40)}" names media or landmark data`, rec.url);
      const raw = percentDecodeToBuffer(url.search);
      const sig = findSignature(raw, { anywhere: true });
      if (sig && !isUtf8(raw)) fail(rec, sig.kind === 'video' ? 'video-bytes' : 'image-bytes', `percent-encoded ${sig.name} bytes in the URL`, rec.url);
    }

    // Header values that smuggle content.
    for (const [name, value] of Object.entries(rec.headers ?? {})) {
      if (/^(cookie|authorization|user-agent|accept.*|sec-.*|referer|origin|host|connection|pragma|cache-control|content-length|priority|upgrade-insecure-requests|if-.*)$/i.test(name)) continue;
      const v = String(value);
      if (v.length > 200) for (const f of scanText(v)) fail(rec, f.code, `header ${name} carries ${f.code}`, f.evidence);
    }

    const contentType = rec.headers ? (rec.headers['Content-Type'] ?? rec.headers['content-type'] ?? '') : '';
    const contentEncoding = rec.headers ? (rec.headers['Content-Encoding'] ?? rec.headers['content-encoding'] ?? '') : '';

    if (rec.bodyState === 'unavailable') {
      unavailable++;
      const thirdParty = !hostAllowed(url.host, origin, [] ).ok;
      if (thirdParty && !/google|paddle|profitwell/.test(url.host)) fail(rec, 'body-unreadable', 'a request has a body the audit could not read', `${rec.method} ${rec.url}`);
      else warn(rec, 'body-unreadable', 'a request has a body the audit could not read', `${rec.method} ${rec.url}`);
    }

    if (rec.body && rec.body.length) {
      bodiesChecked++;
      bytesChecked += rec.body.length;
      // Binary beacons from the analytics hosts are theirs; everything else must be text.
      const analytics = /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com)$/.test(url.hostname);
      for (const f of inspectBody(rec.body, { contentType, contentEncoding, trustedBinary: false })) {
        // Google Analytics bodies are urlencoded text; any hit there is still a failure.
        fail(rec, f.code, `the request body carries ${f.code}${analytics ? ' (to an analytics host)' : ''}`, f.evidence);
      }
      for (const n of needles) {
        const how = containsNeedle(rec.body, n.bytes);
        if (how) fail(rec, 'photo-bytes', `bytes of the nail photo (${n.label}) appear in the request body (${how})`, `${rec.method} ${rec.url}`);
      }
    }
    if (needles.length && !LOCAL_SCHEMES.has(url.protocol)) {
      const urlBytes = Buffer.from(`${rec.url}\n${decodeURIComponentSafe(rec.url)}`, 'latin1');
      for (const n of needles) {
        const how = containsNeedle(urlBytes, n.bytes);
        if (how) fail(rec, 'photo-bytes', `bytes of the nail photo (${n.label}) appear in the URL (${how})`, rec.url);
      }
    }

    // ── Event sync rules ──
    const path = url.pathname;
    const sameOrigin = url.host === new URL(origin).host;
    if (sameOrigin && (path === '/api/events' || path.startsWith('/api/events/'))) {
      eventsRequests++;
      if (mode !== 'on') {
        fail(rec, 'events-call-while-sync-off', `a request to ${path} while sync is off`, `${rec.method} ${rec.url}`);
      } else if (path === '/api/events/sync') {
        if (rec.method === 'OPTIONS') continue;
        if (rec.method !== 'POST') { fail(rec, 'events-method', `unexpected ${rec.method} to /api/events/sync`, rec.url); continue; }
        syncPosts++;
        let json = null;
        try { json = JSON.parse(rec.body?.toString('utf8') ?? ''); } catch { /* checked below */ }
        if (!json || typeof json !== 'object' || Array.isArray(json)) { fail(rec, 'events-body', 'the sync body is not a JSON object', clip(rec.body?.toString('utf8') ?? '(empty)', 120)); continue; }
        for (const k of Object.keys(json)) {
          topKeysSeen.add(k);
          if (!whitelist.top.has(k)) fail(rec, 'events-key-not-whitelisted', `top-level key "${clip(k, 40)}" is not in WS4's whitelist`, `keys: ${Object.keys(json).join(',')}`);
        }
        const evs = Array.isArray(json.events) ? json.events : [];
        if (!Array.isArray(json.events)) fail(rec, 'events-body', 'the sync body has no events array', Object.keys(json).join(','));
        syncEvents += evs.length;
        evs.forEach((e, i) => {
          if (!e || typeof e !== 'object' || Array.isArray(e)) { fail(rec, 'events-body', `events[${i}] is not an object`, typeof e); return; }
          for (const k of Object.keys(e)) {
            eventKeysSeen.add(k);
            if (!whitelist.event.has(k)) fail(rec, 'events-key-not-whitelisted', `events[${i}].${clip(k, 40)} is not in WS4's whitelist`, `keys: ${Object.keys(e).join(',')}`);
          }
          for (const k of REQUIRED_EVENT_KEYS) if (!(k in e)) fail(rec, 'events-key-missing', `events[${i}] lacks required key ${k}`, `keys: ${Object.keys(e).join(',')}`);
          if (e.triggers !== undefined && !(Array.isArray(e.triggers) && e.triggers.every(t => typeof t === 'string' && t.length <= 64))) fail(rec, 'events-body', `events[${i}].triggers is not a short list of strings`, clip(JSON.stringify(e.triggers), 100));
          if (e.competingResponse && typeof e.competingResponse === 'object') {
            for (const k of Object.keys(e.competingResponse)) {
              responseKeysSeen.add(k);
              if (!whitelist.response.has(k)) fail(rec, 'events-key-not-whitelisted', `events[${i}].competingResponse.${clip(k, 40)} is not in WS4's whitelist`, '');
            }
          }
        });
      } else if (rec.method === 'DELETE') {
        fail(rec, 'events-wipe', 'a request wiped the synced data during the audit', `${rec.method} ${rec.url}`);
      }
    }
  }

  if (mode === 'on' && syncPosts === 0) {
    findings.push({ severity: 'fail', code: 'inconclusive-no-sync', url: '', message: 'sync was switched on but no POST /api/events/sync was observed, so the sync-ON checks proved nothing', evidence: 'expected at least one sync request', });
  }

  const failures = findings.filter(f => f.severity === 'fail');
  return {
    ok: failures.length === 0,
    findings,
    stats: {
      records: records.length,
      requests: records.filter(r => r.kind === 'http').length,
      webSocketFrames: records.filter(r => r.kind === 'ws-frame').length,
      webSocketsOpened: records.filter(r => r.kind === 'ws-open').length,
      hookCalls: records.filter(r => r.kind === 'hook').length,
      localSchemeRequests: local,
      bodiesChecked,
      bytesChecked,
      bodiesUnreadable: unavailable,
      eventsRequests,
      syncPosts,
      syncEvents,
      hosts: Object.fromEntries([...hosts.entries()].sort((a, b) => b[1] - a[1])),
      byTarget,
      byResourceType: byType,
      eventKeysSeen: [...eventKeysSeen].sort(),
      topKeysSeen: [...topKeysSeen].sort(),
      responseKeysSeen: [...responseKeysSeen].sort(),
      needlesSearched: needles.length,
    },
  };
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}
