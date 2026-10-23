// The meta-test of the privacy audit (WS13). An audit that has never failed proves nothing, so this feeds the
// judge (check.mjs) synthetic BAD requests and makes sure each one is caught, and a few GOOD ones and makes
// sure they are not. It also holds the whitelist parity: the client's payload builder and the server's
// validator must list the same event keys. Runs in every `npm test` (no browser, no server).
import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { evaluate, inspectBody, containsNeedle, base64Spellings, hostAllowed, findSignature, percentDecodeToBuffer } from './check.mjs';
import { loadWhitelist } from './whitelist.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ORIGIN = 'http://localhost:3213';
const whitelist = await loadWhitelist(ROOT);

let n = 0;
const http = (over = {}) => ({
  kind: 'http', id: `r${++n}`, target: 'page', method: 'POST', url: `${ORIGIN}/api/thing`, resourceType: 'Fetch',
  headers: { 'Content-Type': 'application/json' }, body: null, bodyState: 'none', ...over,
});
const json = (o) => Buffer.from(JSON.stringify(o));
const run = (records, mode = 'off', extra = {}) => evaluate(records, { mode, origin: ORIGIN, whitelist, ...extra });
const codes = (r) => r.findings.filter(f => f.severity === 'fail').map(f => f.code);

// A fake JPEG: the real start-of-image + JFIF header, then bytes that are not valid UTF-8.
const fakeJpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0'), Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 37 + 11) & 0xff))]);
const fakePng = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR'), Buffer.alloc(40, 7)]);
const hand = () => Array.from({ length: 21 }, (_, i) => ({ x: i / 21 + 0.013, y: 0.5 - i / 40, z: -0.02 * i }));
const faceFlat = () => Array.from({ length: 468 * 3 }, (_, i) => +(Math.sin(i) * 0.4 + 0.5).toFixed(5));

describe('the privacy audit judge: it fails bad requests', () => {
  it('a JPEG body', () => {
    const r = run([http({ headers: { 'Content-Type': 'application/octet-stream' }, body: fakeJpeg() })]);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('image-bytes');
  });
  it('a PNG, a GIF and a WebP body', () => {
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([1, 0, 1, 0, 0x80, 0xff, 0xff])]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.from([0xff, 0xfe])]);
    for (const body of [fakePng(), gif, webp]) expect(codes(run([http({ body })]))).toContain('image-bytes');
  });
  it('an image inside a JSON string as base64', () => {
    const b64 = fakeJpeg().toString('base64');
    expect(codes(run([http({ body: json({ note: 'hi', blob: b64 }) })]))).toContain('image-base64');
    expect(codes(run([http({ body: json({ x: fakePng().toString('base64') }) })]))).toContain('image-base64');
  });
  it('a data: URI image in a body or in the URL', () => {
    expect(codes(run([http({ body: json({ a: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }) })]))).toContain('data-uri');
    expect(codes(run([http({ method: 'GET', url: `${ORIGIN}/api/x?i=${encodeURIComponent('data:image/png;base64,iVBORw0KGgo=')}` })]))).toContain('data-uri');
  });
  it('a 21-point hand landmark payload (keyed or not)', () => {
    expect(codes(run([http({ body: json({ landmarks: hand() }) })]))).toEqual(expect.arrayContaining(['landmark-key', 'landmark-array']));
    expect(codes(run([http({ body: json({ points: hand() }) })]))).toContain('landmark-array');
    expect(codes(run([http({ body: json([hand().map(p => [p.x, p.y, p.z])]) })]))).toContain('landmark-array');
  });
  it('a 468-point face mesh, flat floats and as objects', () => {
    expect(codes(run([http({ body: json({ v: faceFlat() }) })]))).toContain('float-array');
    expect(codes(run([http({ body: json({ mesh: Array.from({ length: 468 }, (_, i) => ({ x: i / 468, y: 0.3, z: 0.01 })) }) })]))).toContain('landmark-array');
    expect(codes(run([http({ body: json({ faceMesh: [1] }) })]))).toContain('landmark-key');
  });
  it('a long run of floats in a plain text body', () => {
    const text = Array.from({ length: 63 }, (_, i) => (i * 0.0137 + 0.25).toFixed(4)).join(',');
    expect(codes(run([http({ headers: { 'Content-Type': 'text/plain' }, body: Buffer.from(text) })]))).toContain('float-run');
  });
  it('a request to a host that is not on the allowlist', () => {
    const r = run([http({ method: 'GET', url: 'https://telemetry.example.net/collect?x=1' })]);
    expect(codes(r)).toContain('host-not-allowed');
    expect(r.stats.hosts['telemetry.example.net']).toBe(1);
  });
  it('a lookalike host', () => {
    expect(codes(run([http({ method: 'GET', url: 'https://www.google-analytics.com.evil.test/x' })]))).toContain('host-not-allowed');
    expect(codes(run([http({ method: 'GET', url: 'https://evilpaddle.com/x' })]))).toContain('host-not-allowed');
    expect(codes(run([http({ method: 'GET', url: 'http://localhost:9999/x' })]))).toContain('host-not-allowed');
  });
  it('a web socket to an unknown host, and a web socket frame with an image', () => {
    expect(codes(run([{ kind: 'ws-open', id: 'w1', target: 'page', url: 'wss://rt.example.net/s' }]))).toContain('host-not-allowed');
    expect(codes(run([{ kind: 'ws-frame', id: 'w2', target: 'page', method: 'WS', url: `${ORIGIN.replace('http', 'ws')}/ws`, headers: {}, body: fakeJpeg(), bodyState: 'present' }]))).toContain('image-bytes');
  });
  it('a multipart/form-data upload with an image part', () => {
    const b = 'XBOUNDARYX';
    const body = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeJpeg(), Buffer.from(`\r\n--${b}--\r\n`),
    ]);
    const r = run([http({ headers: { 'Content-Type': `multipart/form-data; boundary=${b}` }, body })]);
    expect(codes(r)).toEqual(expect.arrayContaining(['multipart-media']));
  });
  it('a file upload that is not labelled as an image', () => {
    const b = 'BB';
    const body = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="f"; filename="x.bin"\r\nContent-Type: application/octet-stream\r\n\r\nabc\r\n--${b}--\r\n`);
    expect(codes(run([http({ headers: { 'Content-Type': `multipart/form-data; boundary=${b}` }, body })]))).toContain('multipart-file');
  });
  it('a body that is not text and not a known image (a tensor, a frame, a video chunk)', () => {
    const f32 = Buffer.from(new Float32Array(200).map((_, i) => Math.sin(i)).buffer);
    expect(codes(run([http({ headers: { 'Content-Type': 'application/octet-stream' }, body: f32 })]))).toContain('binary-body');
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(40, 0xfe)]);
    expect(codes(run([http({ body: mp4 })]))).toContain('video-bytes');
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40, 0x81)]);
    expect(codes(run([http({ body: webm })]))).toContain('video-bytes');
  });
  it('an image-typed or video-typed Content-Type', () => {
    expect(codes(run([http({ headers: { 'Content-Type': 'image/webp' }, body: Buffer.from('x') })]))).toContain('media-content-type');
    expect(codes(run([http({ headers: { 'Content-Type': 'video/webm' }, body: Buffer.from('x') })]))).toContain('media-content-type');
  });
  it('an image that was gzipped, percent-encoded or wrapped in a form field', () => {
    expect(codes(run([http({ headers: { 'Content-Encoding': 'gzip' }, body: gzipSync(fakeJpeg()) })]))).toContain('image-bytes');
    const pct = [...fakeJpeg().subarray(0, 40)].map(b => `%${b.toString(16).padStart(2, '0')}`).join('');
    expect(codes(run([http({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: Buffer.from(`d=${pct}`) })]))).toEqual(expect.arrayContaining(['image-bytes']));
    expect(codes(run([http({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: Buffer.from(`d=${encodeURIComponent(fakeJpeg().toString('base64'))}`) })]))).toContain('image-base64');
  });
  it('an image or landmarks nested in a JSON string inside a base64 string', () => {
    const inner = JSON.stringify({ landmarks: hand() });
    expect(codes(run([http({ body: json({ blob: Buffer.from(inner).toString('base64') }) })])).length).toBeGreaterThan(0);
  });
  it('a hook record that shows an ImageBitmap, MediaStream or image Blob being sent', () => {
    for (const bodyType of ['ImageBitmap', 'MediaStream', 'VideoFrame', 'ImageData', 'HTMLVideoElement', 'OffscreenCanvas']) {
      expect(codes(run([{ kind: 'hook', id: 'h', target: 'page', api: 'fetch', method: 'POST', url: `${ORIGIN}/api/x`, bodyType }]))).toContain('media-object-sent');
    }
    expect(codes(run([{ kind: 'hook', id: 'h', target: 'page', api: 'sendBeacon', url: `${ORIGIN}/api/x`, bodyType: 'Blob', blobType: 'image/jpeg', size: 9000 }]))).toContain('media-blob-sent');
    expect(codes(run([{ kind: 'hook', id: 'h', target: 'worker', api: 'xhr', url: `${ORIGIN}/api/x`, bodyType: 'FormData', fileEntries: [{ name: 'photo', type: 'image/jpeg', size: 3 }] }]))).toContain('file-upload');
    expect(codes(run([{ kind: 'hook', id: 'h', target: 'page', api: 'fetch', url: `${ORIGIN}/api/x`, bodyType: 'Blob', head: 'ffd8ffe000104a46' }]))).toContain('image-bytes');
  });
  it('a WebRTC connection or a MediaRecorder', () => {
    for (const api of ['RTCPeerConnection', 'MediaRecorder']) {
      expect(codes(run([{ kind: 'hook', id: 'h', target: 'page', api, url: '', method: 'new', bodyType: api }]))).toContain('webrtc-or-recorder-used');
    }
  });
  it('a body the audit cannot read, to a stranger', () => {
    expect(codes(run([http({ url: 'https://example.net/x', bodyState: 'unavailable' })]))).toEqual(expect.arrayContaining(['host-not-allowed', 'body-unreadable']));
  });
});

describe('the privacy audit judge: the nail photo diary', () => {
  const photo = Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 131 + (i >> 3) * 17) & 0xff));
  const needle = photo.subarray(1500, 1560);
  const needles = [{ label: 'photo[0]@37%', bytes: needle }];
  it('finds the photo bytes raw, in hex, in base64 at every alignment, and percent-encoded', () => {
    expect(containsNeedle(Buffer.concat([Buffer.from('xx'), photo]), needle)).toBe('raw bytes');
    expect(containsNeedle(Buffer.from(`k=${needle.toString('hex')}`), needle)).toBe('hex');
    for (let pad = 0; pad < 3; pad++) {
      const b64 = Buffer.concat([Buffer.alloc(pad, 1), photo]).toString('base64');
      expect(containsNeedle(Buffer.from(JSON.stringify({ p: b64 })), needle)).toBe('base64');
    }
    expect(base64Spellings(needle).length).toBeGreaterThanOrEqual(6);
    expect(containsNeedle(Buffer.from(`d=${[...needle].map(b => `%${b.toString(16).padStart(2, '0')}`).join('')}`), needle)).toBe('percent-encoded');
  });
  it('does not find it in unrelated text', () => {
    expect(containsNeedle(Buffer.from('{"events":[{"id":"a"}]}'), needle)).toBeNull();
  });
  it('fails a request that carries it', () => {
    const r = run([http({ body: json({ events: [], note: photo.toString('base64') }) })], 'off', { needles });
    expect(codes(r)).toContain('photo-bytes');
    const viaUrl = run([http({ method: 'GET', url: `${ORIGIN}/api/x?p=${encodeURIComponent(needle.toString('base64'))}` })], 'off', { needles });
    expect(codes(viaUrl)).toContain('photo-bytes');
  });
});

describe('the privacy audit judge: event sync rules', () => {
  const ev = (o = {}) => ({ id: 'a1', ts: 1730000000000, source: 'manual', behavior: 'nail_biting', updatedAt: 1730000000001, ...o });
  const sync = (events, top = {}) => http({ url: `${ORIGIN}/api/events/sync`, body: json({ since: 0, events, deviceId: 'dev-1', ...top }) });

  it('sync OFF: any /api/events request fails, whatever the method', () => {
    for (const method of ['POST', 'GET', 'DELETE']) {
      expect(codes(run([http({ method, url: `${ORIGIN}/api/events/status` })], 'off'))).toContain('events-call-while-sync-off');
    }
    expect(codes(run([sync([ev()])], 'flagsoff'))).toContain('events-call-while-sync-off');
  });
  it('sync OFF: other API calls are fine', () => {
    expect(run([http({ method: 'GET', url: `${ORIGIN}/api/features` }), http({ method: 'GET', url: `${ORIGIN}/api/auth/me` })], 'off').ok).toBe(true);
  });
  it('sync ON: a request with exactly the whitelisted keys passes and the keys are reported', () => {
    const r = run([sync([ev({ hand: 'left', triggers: ['stress'], falsePositive: false, competingResponse: { done: true, durationSec: 30 }, confirmed: true, deviceId: 'dev-1', deleted: false })])], 'on');
    expect(r.ok).toBe(true);
    expect(r.stats.syncPosts).toBe(1);
    expect(r.stats.syncEvents).toBe(1);
    expect(r.stats.eventKeysSeen).toEqual([...whitelist.event].sort());
  });
  it('sync ON: an event key outside the whitelist fails (landmarks, a photo reference, a note)', () => {
    for (const extra of [{ landmarks: [1, 2] }, { photoId: 'p1' }, { note: 'hello' }, { frame: 'x' }]) {
      expect(codes(run([sync([ev(extra)])], 'on'))).toContain('events-key-not-whitelisted');
    }
  });
  it('sync ON: a top-level key or a competingResponse key outside the whitelist fails', () => {
    expect(codes(run([sync([ev()], { calibration: [1] })], 'on'))).toContain('events-key-not-whitelisted');
    expect(codes(run([sync([ev({ competingResponse: { done: true, audio: 'x' } })])], 'on'))).toContain('events-key-not-whitelisted');
  });
  it('sync ON: a missing required key fails, and so does a non-text trigger', () => {
    const { ts: _ts, ...noTs } = ev();
    expect(codes(run([sync([noTs])], 'on'))).toContain('events-key-missing');
    expect(codes(run([sync([ev({ triggers: [{ x: 1 }] })])], 'on'))).toContain('events-body');
  });
  it('sync ON: nothing sent at all is inconclusive, not a pass', () => {
    const r = run([http({ method: 'GET', url: `${ORIGIN}/api/features` })], 'on');
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('inconclusive-no-sync');
  });
  it('sync ON: a wipe during the audit is flagged', () => {
    expect(codes(run([sync([ev()]), http({ method: 'DELETE', url: `${ORIGIN}/api/events` })], 'on'))).toContain('events-wipe');
  });
});

describe('the privacy audit judge: it passes clean traffic', () => {
  it('Google Analytics, Tag Manager, Paddle and same-origin traffic', () => {
    const r = run([
      http({ method: 'GET', url: `${ORIGIN}/`, resourceType: 'Document' }),
      http({ method: 'GET', url: `${ORIGIN}/assets/index-abc12345.js`, resourceType: 'Script' }),
      http({ method: 'GET', url: `${ORIGIN}/mediapipe-models/hand_landmarker.task`, resourceType: 'Fetch' }),
      http({ method: 'GET', url: 'https://www.googletagmanager.com/gtag/js?id=G-WXS5XX6ZV0', resourceType: 'Script' }),
      http({ method: 'POST', url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-WXS5XX6ZV0&dl=http%3A%2F%2Flocalhost%3A3213%2F&en=page_view', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: Buffer.from('en=scroll&epn.percent_scrolled=90') }),
      http({ method: 'GET', url: 'https://region1.google-analytics.com/g/collect?v=2&en=user_engagement&_et=12345' }),
      http({ method: 'GET', url: 'https://cdn.paddle.com/paddle/v2/paddle.js', resourceType: 'Script' }),
      http({ method: 'GET', url: `${ORIGIN}/api/features` }),
      http({ method: 'GET', url: 'data:image/png;base64,iVBORw0KGgo=', resourceType: 'Image' }),
      { kind: 'hook', id: 'h1', target: 'page', api: 'fetch', method: 'GET', url: `${ORIGIN}/api/features`, bodyType: 'none' },
      { kind: 'hook', id: 'h2', target: 'page', api: 'fetch', method: 'POST', url: `${ORIGIN}/api/events/sync`, bodyType: 'string' },
    ], 'off');
    // the hook record for /api/events is only a description; the HTTP record is what the sync-off rule judges
    expect(r.findings.filter(f => f.severity === 'fail')).toEqual([]);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.stats.hosts).sort()).toEqual(['cdn.paddle.com', 'localhost:3213', 'region1.google-analytics.com', 'www.google-analytics.com', 'www.googletagmanager.com']);
  });
  it('ordinary JSON with numbers is not mistaken for landmarks', () => {
    const body = json({ events: [{ id: 'a', ts: 1730000000000, updatedAt: 1730000000001, source: 'manual', behavior: 'nail_biting', triggers: ['stress'] }], since: 1730000000000, deviceId: 'd' });
    expect(inspectBody(body, { contentType: 'application/json' })).toEqual([]);
    expect(inspectBody(json({ counts: Array.from({ length: 60 }, (_, i) => i) }), { contentType: 'application/json' })).toEqual([]);
    expect(inspectBody(json({ dates: Array.from({ length: 30 }, (_, i) => 1730000000000 + i * 86400000) }), { contentType: 'application/json' })).toEqual([]);
  });
});

describe('the privacy audit judge: helpers', () => {
  it('host matching follows the CSP rules', () => {
    expect(hostAllowed('localhost:3213', ORIGIN).ok).toBe(true);
    expect(hostAllowed('checkout.paddle.com', ORIGIN).ok).toBe(true);
    expect(hostAllowed('paddle.com', ORIGIN).ok).toBe(false); // *.paddle.com is subdomains only, like CSP
    expect(hostAllowed('region1.google-analytics.com', ORIGIN).ok).toBe(true);
    expect(hostAllowed('google-analytics.com.evil.test', ORIGIN).ok).toBe(false);
    expect(hostAllowed('fonts.googleapis.com', ORIGIN).ok).toBe(false); // fonts are self-hosted
  });
  it('signatures', () => {
    expect(findSignature(fakeJpeg())?.name).toBe('JPEG');
    expect(findSignature(Buffer.concat([Buffer.from('abc'), fakePng()]), { anywhere: true })?.name).toBe('PNG');
    expect(findSignature(Buffer.from('{"a":1}'))).toBeNull();
    expect(percentDecodeToBuffer('%ff%d8%ff%e0').equals(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
  });
});

describe("WS4's whitelist is read from the code, and the client and server agree", () => {
  it('has the keys the notes list', () => {
    expect([...whitelist.top].sort()).toEqual(['deviceId', 'epoch', 'events', 'since']);
    expect([...whitelist.event].sort()).toEqual(['behavior', 'competingResponse', 'confirmed', 'deleted', 'deviceId', 'falsePositive', 'hand', 'id', 'source', 'triggers', 'ts', 'updatedAt']);
    expect([...whitelist.response].sort()).toEqual(['done', 'durationSec']);
  });
  it('client SYNC_EVENT_FIELDS === server EVENT_KEYS', () => {
    expect(whitelist.parity).toBe(true);
  });
});
