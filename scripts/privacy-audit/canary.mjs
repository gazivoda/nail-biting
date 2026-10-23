// The audit's own negative control, in the real browser. The page itself is made to send things it must never send,
// through the real network stack, and the audit has to catch every one. If it does not, the audit is blind and a
// green run means nothing. (check.test.mjs proves the judge on synthetic records; this proves the whole chain:
// Chrome, the DevTools capture, the in-page hooks, the judge.)
//
// Sent from the page (same-origin paths answer 404, the unknown host is blocked by the site's CSP; both are still
// attempts the audit must record):
//   a JPEG as a Blob body                       -> image-bytes
//   the JPEG as base64 inside JSON ("frame")     -> image-base64, media-key
//   a 21-point hand landmark JSON                -> landmark-array
//   a 468-point face mesh as a flat float array  -> float-array
//   an ImageBitmap handed to fetch               -> media-object-sent
//   a FormData with a File (multipart upload)    -> file-upload, multipart-media
//   an XHR with a PNG ArrayBuffer                -> image-bytes
//   sendBeacon of landmarks to an unknown host   -> host-not-allowed
//   a GET whose query string is a data: image    -> data-uri
//   a GET request to an unknown host             -> host-not-allowed
//   events sync call while sync is off           -> events-call-while-sync-off
export const CANARY_SRC = `(async () => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#fc0';
  for (let i = 0; i < 44; i++) g.fillRect(i, (i * 7) % 48, 4, 3);
  const jpeg = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const png = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const hand = Array.from({ length: 21 }, (_, i) => ({ x: i / 21 + 0.011, y: 0.5 - i / 50, z: -0.01 * i }));
  const mesh = Array.from({ length: 468 * 3 }, (_, i) => +(Math.sin(i) * 0.4 + 0.5).toFixed(5));
  const post = (url, init) => fetch(url, Object.assign({ method: 'POST' }, init)).catch(() => {});
  await post('/api/canary/blob', { body: jpeg });
  await post('/api/canary/json', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frame: b64 }) });
  await post('/api/canary/landmarks', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hand }) });
  await post('/api/canary/mesh', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: mesh }) });
  await post('/api/canary/bitmap', { body: await createImageBitmap(c) });
  const fd = new FormData(); fd.append('photo', new File([jpeg], 'hand.jpg', { type: 'image/jpeg' }));
  await post('/api/canary/form', { body: fd });
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  await new Promise((res) => { const x = new XMLHttpRequest(); x.open('POST', '/api/canary/xhr'); x.onloadend = res; x.send(pngBytes); });
  navigator.sendBeacon('https://telemetry.canary.invalid/collect', new Blob([JSON.stringify(hand)], { type: 'application/json' }));
  await fetch('https://telemetry.canary.invalid/ping').catch(() => {});
  await fetch('/api/canary/q?i=' + encodeURIComponent('data:image/png;base64,iVBORw0KGgo=')).catch(() => {});
  await post('/api/events/sync', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, events: [], deviceId: 'canary' }) });
  return 'sent';
})()`;

/** Every one of these must show up in a canary run, or the audit cannot see what it claims to see. */
export const CANARY_EXPECTED = [
  'image-bytes', 'image-base64', 'media-key', 'landmark-array', 'float-array', 'media-object-sent', 'file-upload',
  'multipart-media', 'host-not-allowed', 'data-uri', 'events-call-while-sync-off',
];
