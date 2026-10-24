# Privacy audit (WS13)

The plan's most important QA item: **no camera frames, images, landmarks or video leave the device; only small event
records leave, and only after the person opts in; nail photos never leave.** This is the test that records every request a
real browser session makes with detection running and fails if any of them could carry what that sentence forbids.

Short version: in five-minute sessions with detection running on a fake camera, with sync off and with sync on, the audit
found **nothing** that carries image data, landmarks, video or the diary photo, contacted **no host outside the allowlist**
(only the app's own origin and Google Analytics / Tag Manager), made **zero** `/api/events/*` requests with sync off, and
sent only WS4's whitelisted keys with sync on (in the probe-build run, with real alarms, a "Not a bite", a coaching response and a
deletion record, all 12 whitelisted keys appeared and nothing else). A canary run in which the page deliberately sends images, landmarks and a
beacon to a stranger is caught 11 times out of 11, so the green results are not a blind spot. Section 5 says plainly what
a fake camera cannot prove.

Files: `scripts/privacy-audit/` (`run.mjs` the runner, `check.mjs` the judge, `capture.mjs` the recorder, `scenario.mjs`
the UI walk, `canary.mjs` the negative control, `browser.mjs` Chrome and the server, `whitelist.mjs`, `report.mjs`,
`probe-root.sh`), tests `check.test.mjs` (always run) and `smoke.test.mjs` (only with `PRIVACY_AUDIT=1`), raw results in
`docs/agents/privacy-audit-results/*.json`.

## 1. How to run it

```
npm run build:web
npm run privacy:audit                                    # 5 minutes per mode, sync off then sync on
node scripts/privacy-audit/run.mjs --mode all            # canary, flags off, sync off, sync on
node scripts/privacy-audit/run.mjs --seconds 45          # the smoke
PRIVACY_AUDIT=1 npx vitest run scripts/privacy-audit/smoke.test.mjs     # smoke + canary as a test (skipped otherwise)
bash scripts/privacy-audit/probe-root.sh /tmp/probe-root && node scripts/privacy-audit/run.mjs --root /tmp/probe-root --probe --mode all
node scripts/privacy-audit/report.mjs                    # rewrites the Results section of this file from the JSON
```

Exit code 0 = pass, 1 = a privacy violation was found (the message names the URL and the evidence), 2 = inconclusive (the
session could not reach the states the audit needs, for example detection never started, no diary photo could be taken or
sync could not be switched on: a pass would have proved nothing, so it is a failure too). Ports: 3213 (server), 4213
(Chrome). Chrome is `/Applications/Google Chrome.app/...` (override with `CHROME_BIN`). No new dependency: Node's
global `WebSocket` and `fetch`, plus `better-sqlite3` and `jsonwebtoken` that the server already has.

## 2. What it does

1. Starts the **real** `server.js` on the real `dist/` (the output of `npm run build:web`), a scratch `DATA_DIR`, throwaway
   credentials (the same environment `scripts/marketingSite.test.mjs` uses: no real `.env`, no mail, no Paddle), `NODE_ENV`
   unset like the Dockerfile.
2. **Signs a person in for real**: a row in the real `users` table after the server created it, and a session JWT signed
   exactly as `server.js` does (`jwt.sign({ sub }, JWT_SECRET, { expiresIn: '14d', algorithm: 'HS256' })`) sent as the
   `nh_session` cookie. The audit checks `GET /api/user/me` answers 200 before it starts.
3. Launches headless Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` and drives it over the
   DevTools protocol with **real mouse events** through the real UI:
   - detection starts by itself and must hand video frames to MediaPipe at 1.5 a second or more (the session really
     detects; a stalled detector would make a pass meaningless; the measured rate is about 9.5 a second);
   - three bites with trigger tags, one bite logged and undone (a deletion record), two more after the opt-in, an urge
     with the breathing timer, mid-session activity at 50 % and 75 % of the time;
   - Settings: **sync OFF mode** walks Settings and History without switching sync on; **sync ON mode** switches the
     "Sync my history across devices" switch (the opt-in) and presses "Sync now";
   - History > Insights: takes a **diary photo with the fake camera** and saves it, then reads the stored JPEG back out of
     the browser's IndexedDB (`stop-biting-local-blobs`) and takes four 48-byte windows of its entropy-coded data as
     fingerprints;
   - **probe mode** (`--probe`, on a scratch build made with `probe-root.sh`): WS7a's measurement hook makes the detector
     see a 21-point hand and a 478-point face on the mouth, so **real alarms** happen with landmark data in the page: the
     alarm overlay, the coaching prompt, the "Not a bite" toast, a bite with a reason, and the alarm event records.
4. Records, in **every context that can send something**: the page, frames, dedicated and shared workers and the **service
   worker** (`Target.setAutoAttach`, flattened), each with `Network.enable({ maxPostDataSize: 10 MB })`. For every request
   it keeps the URL, method, headers and the **body bytes** (`postDataEntries`, falling back to `Network.getRequestPostData`),
   redirects, and WebSocket frames (`Network.webSocketFrameSent`). `sendBeacon` and `fetch` with `keepalive` appear as normal
   requests and are tagged with their resource type. On top of the wire there is an **in-page hook** (installed before the
   app's code, also in workers, reporting through a `Runtime` binding) on `fetch`, `XMLHttpRequest`, `sendBeacon` and
   `WebSocket.send`, which says what **kind of object** was handed over (an ImageBitmap, a MediaStream, an image Blob, a
   FormData with files), which the wire cannot tell, and which also reports any `RTCPeerConnection` or `MediaRecorder`.
5. Hands the records to the judge (`check.mjs`), which **fails** on:
   - **image data**: JPEG, PNG, GIF, WebP, BMP, AVIF/HEIC, TIFF signatures in the raw bytes (anywhere in binary bodies),
     base64 prefixes (`/9j/`, `iVBORw0KGgo`, `R0lGOD`, `UklGR`) and any base64 run that decodes to such a file, `data:image`
     URIs, hex spellings, percent-encoded bytes, bodies inside gzip, inside form fields, inside JSON strings, inside
     base64 inside JSON, `multipart/form-data` with image parts or file uploads, `image/*` `video/*` `audio/*` content types;
   - **landmark-like payloads**: arrays of 21 or more point-like items (`{x,y[,z]}` or 2-4 numbers), flat arrays of 63 or
     more mostly non-integer numbers (21 or 468 points flattened), keys such as `landmarks`, `keypoints`, `faceMesh`,
     `handedness`, `blendshapes`, a run of 30 or more decimal numbers in any text body, and keys that name `frame`, `image`,
     `photo`, `video`, `pixels`;
   - **video or stream-derived bodies**: MP4/MOV, WebM, Ogg, AVI, FLV signatures, any body that is not text and not a
     known image (a tensor, a frame), a `MediaStream`, `ImageBitmap`, `VideoFrame`, `ImageData`, canvas or video element
     handed to a network API, a WebRTC connection or a `MediaRecorder`;
   - **a host outside the allowlist** (same origin; Google Tag Manager and Analytics; `*.paddle.com`, ProfitWell; Google
     account avatar images). Fonts are self-hosted, so no font host is allowed. The matching follows CSP rules
     (`*.paddle.com` means subdomains only; `google-analytics.com.evil.test` and `evilpaddle.com` fail), an attempt counts
     even when the site's CSP then blocks it, and the observed host list is printed. The allowlist is cross-checked against
     the live `Content-Security-Policy` header of the server: every allowlisted host appears in `connect-src`, `img-src`,
     `script-src` or `frame-src`;
   - **sync OFF: any request at all to `/api/events/*`** from any context, any method;
   - **sync ON**: every `POST /api/events/sync` body must be a JSON object whose top-level keys are within WS4's `TOP_KEYS`,
     every event's keys within `EVENT_KEYS` and every `competingResponse` key within its two allowed keys; required keys
     present; triggers short strings; no `DELETE /api/events` (a wipe). The whitelist is **read from
     `server/events/validate.js`, not retyped**, and the client's `SYNC_EVENT_FIELDS` in `src/sync/payload.ts` must be the same
     list (the audit fails if either side drifts). The observed key set is printed and compared with the whitelist;
   - **the diary photo**: none of the four byte windows of the stored photo may appear in any body, URL or WebSocket frame,
     raw, hex, base64 (at all three alignments, and url-safe), or percent-encoded;
   - **preconditions** (exit 2): detection frames, bites logged, urge logged, diary photo stored, sync switched on, every
     logged entry seen in the sync requests (`distinct event ids >= entries logged`), real alarms raised (probe).
6. Also checks statically that the generated service worker (`sw.js`, `workbox-*.js`) contains no `sendBeacon`, XHR,
   WebSocket, `"POST"` or push/sync handler.

### The checks can fail (proof, not promise)

- `scripts/privacy-audit/check.test.mjs` (runs in every `npm test`, no browser): 37 tests that feed the judge synthetic **bad**
  requests (a JPEG body, PNG/GIF/WebP, base64 images in JSON, `data:` URIs, a 21-point hand, a 468-point mesh, flat float
  arrays, float runs, unknown and look-alike hosts, a WebSocket frame with an image, multipart image and file uploads,
  tensors, MP4/WebM, image content types, gzip/percent-encoded/form-wrapped images, landmarks inside base64, ImageBitmap,
  MediaStream, image Blob, FormData files, WebRTC, MediaRecorder, an unreadable body, the photo bytes in a body or a URL,
  every sync-ON rule, sync OFF calls) and **good** ones (Google Analytics, Tag Manager, Paddle, same-origin traffic, ordinary
  numeric JSON). It found three real weaknesses in the first version of the judge, which were fixed.
- **The canary** (`--mode canary`, and a test in `smoke.test.mjs`): in the real browser the page itself sends a JPEG Blob, a
  JPEG as base64 in JSON, a multipart upload with a File, an XHR with a PNG, a 21-point hand, a 468-point mesh, an ImageBitmap,
  a beacon and a GET to an unknown host, a `data:` image in a query string and an `/api/events/sync` call with sync off.
  The audit must raise all 11 expected finding codes, or the verdict is BLIND and the run fails. That proves the chain end to
  end (Chrome, the DevTools capture, the hooks, the judge), not only the judge.

## 3. Results

<!-- results:start -->
_Generated by `node scripts/privacy-audit/report.mjs` from `docs/agents/privacy-audit-results/*.json`. Run: 2026-10-24 03:33 UTC, Chrome/155.0.8059.85, Node v24.15.0, 300 s of detection per mode._

| Mode | Verdict | Detection | Logged through the UI | Requests (http / ws frames) | `/api/events/*` | Hosts contacted | Violations |
|---|---|---|---|---|---|---|---|
| flags off (production as shipped) | **PASS** | 300.5 s, 9.6 video frames/s to MediaPipe | 7 bites, 0 urge, 0 diary photo | 118 / 0 | 0 (0 sync POSTs, 0 event records) | `localhost:3213` (115), `www.google-analytics.com` (2), `www.googletagmanager.com` (1) | 0 |
| sync OFF (event_sync flag on, nobody opted in) | **PASS** | 300.5 s, 9.58 video frames/s to MediaPipe | 7 bites, 1 urge, 1 diary photo | 130 / 0 | 0 (0 sync POSTs, 0 event records) | `localhost:3213` (127), `www.google-analytics.com` (2), `www.googletagmanager.com` (1) | 0 |
| sync ON (opted in through the UI) | **PASS** | 305.4 s, 9.59 video frames/s to MediaPipe | 7 bites, 1 urge, 1 diary photo | 140 / 0 | 8 (8 sync POSTs, 9 event records) | `localhost:3213` (137), `www.google-analytics.com` (2), `www.googletagmanager.com` (1) | 0 |
| sync OFF, probe build (real alarms) | **PASS** | 300.5 s, 9.44 video frames/s to MediaPipe | 7 bites, 1 urge, 2 real alarms, 1 diary photo | 133 / 0 | 0 (0 sync POSTs, 0 event records) | `localhost:3213` (130), `www.google-analytics.com` (2), `www.googletagmanager.com` (1) | 0 |
| sync ON, probe build (real alarms) | **PASS** | 305.4 s, 9.44 video frames/s to MediaPipe | 7 bites, 1 urge, 2 real alarms, 1 diary photo | 142 / 0 | 8 (8 sync POSTs, 11 event records) | `localhost:3213` (139), `www.google-analytics.com` (2), `www.googletagmanager.com` (1) | 0 |

### flags off (production as shipped)

- Verdict **PASS**; 0 violations; 0 notes.
- Flags on the server: `(none)`. Signed in with a real session (GET /api/user/me answered 200).
- Detection ran for 300.5 s and handed 2898 video frames to MediaPipe (9.6 a second).
- Requests recorded: 118 HTTP (page: 55, service_worker: 65 records by context), 2 in-page hook reports, 0 WebSocket frames. Bodies inspected: 0 (0 bytes), unreadable: 0.
- Resource types: Document 1, Font 3, Script 28, Stylesheet 1, Image 7, Manifest 1, Fetch 73, Other 4.
- Hosts: `localhost:3213` (115), `www.google-analytics.com` (2), `www.googletagmanager.com` (1).
- `/api/events/*` requests: **0** (required to be zero).
- Photo diary: 0 photo stored in the browser (-); 0 fingerprint windows of its bytes (raw, hex, base64 at 3 alignments, percent-encoded) searched in every body and URL: **not found**.
- Service worker: active **true**; its own requests 65; answered 11 page requests; static check of `sw.js, workbox-74048807.js` for upload-capable code (sendBeacon, XHR, WebSocket, POST, push/sync handlers): none.
- Allowlist hosts not named in the page's Content-Security-Policy: none.

### sync OFF (event_sync flag on, nobody opted in)

- Verdict **PASS**; 0 violations; 0 notes.
- Flags on the server: `event_sync,data_backup,insights,photo_diary,urge_timer,hrt_coaching,false_positive_controls`. Signed in with a real session (GET /api/user/me answered 200).
- Detection ran for 300.5 s and handed 2892 video frames to MediaPipe (9.58 a second), and kept doing so through the diary photo session (a second camera stream).
- Requests recorded: 130 HTTP (page: 67, service_worker: 65 records by context), 2 in-page hook reports, 0 WebSocket frames. Bodies inspected: 0 (0 bytes), unreadable: 0.
- Resource types: Document 1, Font 3, Script 41, Stylesheet 1, Image 7, Manifest 1, Fetch 72, Other 4.
- Hosts: `localhost:3213` (127), `www.google-analytics.com` (2), `www.googletagmanager.com` (1).
- `/api/events/*` requests: **0** (required to be zero).
- Photo diary: 1 photo stored in the browser (8762 bytes image/jpeg); 4 fingerprint windows of its bytes (raw, hex, base64 at 3 alignments, percent-encoded) searched in every body and URL: **not found**.
- Service worker: active **true**; its own requests 65; answered 22 page requests; static check of `sw.js, workbox-74048807.js` for upload-capable code (sendBeacon, XHR, WebSocket, POST, push/sync handlers): none.
- Allowlist hosts not named in the page's Content-Security-Policy: none.

### sync ON (opted in through the UI)

- Verdict **PASS**; 0 violations; 0 notes.
- Flags on the server: `event_sync,data_backup,insights,photo_diary,urge_timer,hrt_coaching,false_positive_controls`. Signed in with a real session (GET /api/user/me answered 200).
- Detection ran for 305.4 s and handed 2942 video frames to MediaPipe (9.59 a second), and kept doing so through the diary photo session (a second camera stream).
- Requests recorded: 140 HTTP (page: 85, service_worker: 65 records by context), 10 in-page hook reports, 0 WebSocket frames. Bodies inspected: 8 (2819 bytes), unreadable: 0.
- Resource types: Document 1, Font 3, Script 42, Stylesheet 1, Image 7, Manifest 1, Fetch 81, Other 4.
- Hosts: `localhost:3213` (137), `www.google-analytics.com` (2), `www.googletagmanager.com` (1).
- `/api/events/*` requests: **8**; sync POST bodies: top-level keys seen `deviceId, epoch, events, since`; event keys seen `behavior, competingResponse, deleted, deviceId, id, source, triggers, ts, updatedAt`; competingResponse keys `done, durationSec`; 9 distinct events synced.
- WS4 whitelist (read from `server/events/validate.js`): top `since, events, deviceId, epoch`; event `id, ts, source, behavior, hand, triggers, falsePositive, competingResponse, confirmed, deviceId, updatedAt, deleted`; client `SYNC_EVENT_FIELDS` equals the server list: **true**. Whitelisted keys not seen in this run: `hand, falsePositive, confirmed`.
- Photo diary: 1 photo stored in the browser (11305 bytes image/jpeg); 4 fingerprint windows of its bytes (raw, hex, base64 at 3 alignments, percent-encoded) searched in every body and URL: **not found**.
- Service worker: active **true**; its own requests 65; answered 23 page requests; static check of `sw.js, workbox-74048807.js` for upload-capable code (sendBeacon, XHR, WebSocket, POST, push/sync handlers): none.
- Allowlist hosts not named in the page's Content-Security-Policy: none.

### sync OFF, probe build (real alarms)

- Verdict **PASS**; 0 violations; 0 notes.
- Flags on the server: `event_sync,data_backup,insights,photo_diary,urge_timer,hrt_coaching,false_positive_controls`. Signed in with a real session (GET /api/user/me answered 200).
- Detection ran for 300.5 s and handed 2850 video frames to MediaPipe (9.44 a second), and kept doing so through the diary photo session (a second camera stream).
- Requests recorded: 133 HTTP (page: 69, service_worker: 66 records by context), 2 in-page hook reports, 0 WebSocket frames. Bodies inspected: 0 (0 bytes), unreadable: 0.
- Resource types: Document 1, Font 3, Script 41, Stylesheet 1, Image 7, Manifest 1, Fetch 74, Other 5.
- Hosts: `localhost:3213` (130), `www.google-analytics.com` (2), `www.googletagmanager.com` (1).
- `/api/events/*` requests: **0** (required to be zero).
- Photo diary: 1 photo stored in the browser (10401 bytes image/jpeg); 4 fingerprint windows of its bytes (raw, hex, base64 at 3 alignments, percent-encoded) searched in every body and URL: **not found**.
- Service worker: active **true**; its own requests 66; answered 23 page requests; static check of `sw.js, workbox-4d5504b4.js` for upload-capable code (sendBeacon, XHR, WebSocket, POST, push/sync handlers): none.
- Allowlist hosts not named in the page's Content-Security-Policy: none.

### sync ON, probe build (real alarms)

- Verdict **PASS**; 0 violations; 0 notes.
- Flags on the server: `event_sync,data_backup,insights,photo_diary,urge_timer,hrt_coaching,false_positive_controls`. Signed in with a real session (GET /api/user/me answered 200).
- Detection ran for 305.4 s and handed 2894 video frames to MediaPipe (9.44 a second), and kept doing so through the diary photo session (a second camera stream).
- Requests recorded: 142 HTTP (page: 86, service_worker: 66 records by context), 10 in-page hook reports, 0 WebSocket frames. Bodies inspected: 8 (3282 bytes), unreadable: 0.
- Resource types: Document 1, Font 3, Script 42, Stylesheet 1, Image 7, Manifest 1, Fetch 82, Other 5.
- Hosts: `localhost:3213` (139), `www.google-analytics.com` (2), `www.googletagmanager.com` (1).
- `/api/events/*` requests: **8**; sync POST bodies: top-level keys seen `deviceId, epoch, events, since`; event keys seen `behavior, competingResponse, confirmed, deleted, deviceId, falsePositive, hand, id, source, triggers, ts, updatedAt`; competingResponse keys `done, durationSec`; 11 distinct events synced.
- WS4 whitelist (read from `server/events/validate.js`): top `since, events, deviceId, epoch`; event `id, ts, source, behavior, hand, triggers, falsePositive, competingResponse, confirmed, deviceId, updatedAt, deleted`; client `SYNC_EVENT_FIELDS` equals the server list: **true**. Whitelisted keys not seen in this run: none (all 12 were exercised).
- Photo diary: 1 photo stored in the browser (11445 bytes image/jpeg); 4 fingerprint windows of its bytes (raw, hex, base64 at 3 alignments, percent-encoded) searched in every body and URL: **not found**.
- Service worker: active **true**; its own requests 66; answered 24 page requests; static check of `sw.js, workbox-4d5504b4.js` for upload-capable code (sendBeacon, XHR, WebSocket, POST, push/sync handlers): none.
- Allowlist hosts not named in the page's Content-Security-Policy: none.

### Canary: the audit sees what it claims to see

The page itself was made to send what it must never send (a JPEG as a Blob, as base64 in JSON, in a multipart upload and in an XHR; a 21-point hand and a 468-point face mesh; an ImageBitmap; a beacon and a GET to an unknown host; a data: image in a query; an `/api/events/sync` call while sync is off). Verdict **CAUGHT**: 11 of 11 expected finding codes were raised.

Codes raised: `data-uri`, `events-call-while-sync-off`, `file-upload`, `float-array`, `float-run`, `host-not-allowed`, `image-base64`, `image-bytes`, `landmark-array`, `media-blob-sent`, `media-content-type`, `media-key`, `media-object-sent`, `multipart-media`.

<!-- results:end -->

### Re-run on the merged tree (WS12a and `origin/main`), 90 seconds per mode

The five-minute results above were taken on the tree before WS12a and the SEO commits were merged. After the merge the normal build was audited
again in all four modes, 90 seconds each (`node scripts/privacy-audit/run.mjs --mode all --seconds 90`): **flags off PASS** (135 requests),
**sync OFF PASS** (150 requests, 0 to `/api/events/*`), **sync ON PASS** (154 requests, 4 sync POSTs carrying 7 events, only whitelisted keys),
**canary CAUGHT** (11 of 11). Hosts: the app's origin, `www.googletagmanager.com` and `www.google-analytics.com`, as before. The service worker is
active and makes 75 requests of its own (65 before the merge: WS12a and the merged chunks are in the precache). The locale catalogs are lazy and are
not fetched while English is in use. The five-minute set and the probe-build runs (real alarms) will be repeated after WS12b.

## 4. Hosts

Allowed by the audit (and present in the server's CSP): the app's own origin; `www.googletagmanager.com`,
`www.google-analytics.com`, `*.google-analytics.com`, `analytics.google.com`, `www.google.com` (Google Analytics and Tag
Manager, loaded by `index.html` after `load`); `*.paddle.com`, `public.profitwell.com` (Paddle checkout and retention
script); `lh3.googleusercontent.com` (Google account avatar, image GET only). **Contacted in the sessions:** the app's origin,
`www.googletagmanager.com` and `www.google-analytics.com` only. Paddle, ProfitWell and the avatar host were never contacted,
because nobody opens the paywall or checkout in a detection session and the audit user has no avatar. Google Analytics
receives the page URL and title, the viewport, the user agent, scroll and engagement events, none of which is camera data;
that is the existing, disclosed analytics and is outside the claim "no camera data is sent while it runs".

## 5. What this cannot prove

- **The fake camera has no hand and no face.** Chrome's fake device streams a synthetic test pattern. MediaPipe finds
  nothing in it, so in the normal runs the detector never produces a real landmark and the alarm path never runs. What the
  runs do prove: the code paths that capture frames, run detection, log entries, sync, take a photo and idle are free of
  uploads, and nothing carries image bytes or landmark-shaped data. What they cannot prove is behaviour that only a real
  hand or face provokes. The **probe-build runs** narrow that gap: they put 21 hand and 478 face landmarks into the detector
  and trigger real alarms, coaching and "Not a bite", and check that the resulting event records contain only whitelisted keys.
  But the probe's landmarks are generated, they are not what MediaPipe returns for a real image (real results also carry
  handedness scores and world coordinates in memory), and the probe is a different build from the one that ships. A person
  with a real camera should repeat `npm run privacy:audit` once with a hand in front of it.
- **Only what a page can send.** Browser-internal traffic (safe browsing, component updates, DNS) is not the page's and is not
  recorded. The audit does not see another process on the machine.
- **Chrome only**, headless, on macOS. Not Safari, Firefox, Edge, a phone, the installed PWA, Document Picture-in-Picture or
  the Electron app (its main process has its own network code and was not audited).
- **Things that were not opened:** the Paddle checkout overlay (a third-party iframe), the sign-in page, the share-link page,
  the weekly-email card, the phone view and the locale picker. The server-side jobs (weekly email, share link pages) are
  not browser traffic. A sync session with another device was not run (WS4's own tests cover two browsers).
- **Five minutes** of detection per mode. The background sync timer is about every five minutes with jitter, so it may not fire
  inside the window; sync was triggered by switching it on, "Sync now" and the 30 seconds after a local change, which is the
  same code path.
- **Encrypted or obfuscated payloads**: the judge looks through base64, hex, percent-encoding, gzip, JSON-in-JSON and
  multipart. A payload deliberately encrypted or compressed with a custom scheme would not be recognised as an image; it would
  be caught as a binary body, or by its host, but not by content. The guard tests (`scripts/syncGuard.test.mjs`,
  `photoGuard.test.mjs`, the photo and sync tests that throw on any network call) are the structural defence; this audit is the
  behavioural one.
- **A local proxy sits in front of `server.js`** (see below). It changes one response header and nothing else, but it is a
  difference from production.

### A finding about local testing, not about privacy

`server.js` sends `upgrade-insecure-requests` in its Content-Security-Policy. In production the site is https and that does
nothing. On `http://localhost`, Chrome applies it to the **service worker's own fetches**, so the worker's first request
(`/index.html`, which redirects to `/`) becomes `https://localhost:PORT/`, a TLS error, and **the service worker never installs on
plain-http localhost** (WS8 noticed this and WS6 explained it). Consequence for QA: every local run in this repository that
does not remove that directive never exercises the service worker. For this audit a pass-through proxy removes that one
directive from the CSP header (the only change), so the service worker installs and its 65 precache requests and its answers to
the page are recorded. Production is not affected; nothing in the code needs fixing.

## 6. Verdict

With the evidence in section 3: **no request in any mode carried image data, landmarks, frames, video or the diary photo; no
request left the allowlisted hosts; sync off made zero event requests; sync on sent only the whitelisted keys.** That is
the strongest statement the tool can support. It is not a proof about real hands and faces (section 5), and it covers the
build and the flags named in the Results.

Re-run after anything that touches detection, sync, the photo diary, the service worker or a script tag (including WS12,
which adds locale loading), and once with a real camera.
