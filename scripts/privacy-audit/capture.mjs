// Records EVERYTHING a browser session sends, from every context that can send something:
//   · the page and its frames, dedicated and shared workers, the service worker (Target.setAutoAttach, flattened),
//   · every request with its body bytes (Network.requestWillBeSent postDataEntries, falling back to
//     Network.getRequestPostData), the redirects, and WebSocket frames,
//   · plus an in-page hook on fetch / XMLHttpRequest / sendBeacon / WebSocket / RTCPeerConnection / MediaRecorder that
//     says WHAT KIND of object was handed over (an ImageBitmap, a MediaStream, an image Blob, a FormData with files),
//     which the wire cannot tell. The hook reports through a Runtime binding, so it works inside workers too.
// It only observes: the hooks call the original function first and never change what is sent.
//
// Out of reach by design: the browser's own background traffic (safe browsing, component updates), which is not the
// page's; and anything the page could do that is neither HTTP, WebSocket nor WebRTC (there is no such channel in a page).

import { CDP, sleep } from './browser.mjs';

const BINDING = '__auditReport';

/** Installed in every page, frame and worker BEFORE the app's own code runs. */
export const HOOK_SRC = `(() => {
  if (globalThis.__auditHooked) return;
  globalThis.__auditHooked = true;
  const where = typeof document === 'undefined' ? 'worker' : 'page';
  const send = (o) => { try { globalThis.${BINDING}(JSON.stringify(Object.assign({ where }, o))); } catch (e) {} };
  const hex = (u8) => Array.from(u8.subarray(0, 32), b => b.toString(16).padStart(2, '0')).join('');
  const kindOf = (b) => {
    if (b === null || b === undefined) return 'none';
    if (typeof b === 'string') return 'string';
    const tag = Object.prototype.toString.call(b).slice(8, -1);
    return (b.constructor && b.constructor.name) || tag;
  };
  const describe = (api, url, method, body, extra) => {
    const bodyType = kindOf(body);
    const rec = Object.assign({ api, url: String(url), method, bodyType }, extra || {});
    try {
      if (body && typeof body === 'object') {
        if (typeof Blob !== 'undefined' && body instanceof Blob) {
          rec.blobType = body.type; rec.size = body.size;
          body.slice(0, 32).arrayBuffer().then(ab => { rec.head = hex(new Uint8Array(ab)); send(rec); }, () => send(rec));
          return;
        }
        if (ArrayBuffer.isView(body)) { rec.size = body.byteLength; rec.head = hex(new Uint8Array(body.buffer, body.byteOffset, Math.min(32, body.byteLength))); }
        else if (body instanceof ArrayBuffer) { rec.size = body.byteLength; rec.head = hex(new Uint8Array(body, 0, Math.min(32, body.byteLength))); }
        else if (typeof FormData !== 'undefined' && body instanceof FormData) {
          rec.fileEntries = [];
          for (const [name, v] of body.entries()) if (typeof v !== 'string') rec.fileEntries.push({ name, type: v.type, size: v.size, filename: v.name });
        }
      } else if (typeof body === 'string') rec.size = body.length;
    } catch (e) { rec.error = String(e); }
    send(rec);
  };

  const of = globalThis.fetch;
  if (of) globalThis.fetch = function (input, init) {
    try {
      const isReq = typeof Request !== 'undefined' && input instanceof Request;
      const url = isReq ? input.url : String(input);
      const method = (init && init.method) || (isReq ? input.method : 'GET');
      const body = init && init.body !== undefined ? init.body : null;
      const keepalive = !!((init && init.keepalive) || (isReq && input.keepalive));
      if (body !== null) describe('fetch', url, method, body, { keepalive });
      else if (isReq && input.body) { describe('fetch', url, method, input.body, { keepalive }); }
      else if (keepalive) describe('fetch', url, method, null, { keepalive });
    } catch (e) {}
    return of.apply(this, arguments);
  };

  if (typeof XMLHttpRequest !== 'undefined') {
    const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__au = { m, u }; return oo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      try { if (body !== undefined && body !== null) describe('xhr', this.__au ? this.__au.u : '', this.__au ? this.__au.m : '', body); } catch (e) {}
      return os.apply(this, arguments);
    };
  }

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const ob = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      try { describe('sendBeacon', url, 'POST', data === undefined ? null : data); } catch (e) {}
      return ob.apply(this, arguments);
    };
  }

  if (typeof WebSocket !== 'undefined') {
    const os = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      try { describe('websocket', this.url, 'WS', data); } catch (e) {}
      return os.apply(this, arguments);
    };
  }

  // Not expected anywhere in this app. If any of these is used, the audit says so.
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'MediaRecorder']) {
    const C = globalThis[name];
    if (!C) continue;
    const P = new Proxy(C, { construct(t, args, nt) { send({ api: name, url: '', method: 'new', bodyType: name }); return Reflect.construct(t, args, nt); } });
    try { globalThis[name] = P; } catch (e) {}
  }
})();`;

/** Counts video frames handed to MediaPipe (WebGL texture uploads) so a pass cannot be a stalled detector. Page only. */
export const FRAME_COUNTER_SRC = `(() => {
  if (window.__auditFrames) return;
  const A = window.__auditFrames = { texVideo: 0, drawVideo: 0, started: performance.now() };
  const hook = (proto, name, pick, key) => { const o = proto[name]; proto[name] = function () { try { if (pick(arguments) instanceof HTMLVideoElement) A[key]++; } catch (e) {} return o.apply(this, arguments); }; };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { hook(C.prototype, 'texImage2D', a => a[a.length - 1], 'texVideo'); hook(C.prototype, 'texSubImage2D', a => a[a.length - 1], 'texVideo'); }
  hook(CanvasRenderingContext2D.prototype, 'drawImage', a => a[0], 'drawVideo');
})();`;

const b64 = (s) => Buffer.from(s, 'base64');

export class Recorder {
  /**
   * @param {CDP} cdp browser-level connection
   * @param {{ initScripts?: string[], log?: (s: string) => void }} opts
   */
  constructor(cdp, { initScripts = [], log = () => {} } = {}) {
    this.cdp = cdp;
    this.initScripts = initScripts;
    this.log = log;
    /** @type {object[]} */
    this.records = [];
    this.sessions = new Map(); // sessionId -> { type, url, targetId }
    this.sockets = new Map();  // `${sessionId}:${requestId}` -> url
    this.byRequest = new Map();
    this.pendingBodies = [];
    this.setups = new Map(); // targetId -> { sessionId, ready }
    this.seq = 0;
    this.t0 = Date.now();
    this.counts = { targets: {} };
    cdp.on(msg => this.onEvent(msg));
  }

  async start() {
    await this.cdp.send('Target.setDiscoverTargets', { discover: true });
    await this.cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  }

  /** Waits until the recorder has finished instrumenting a target (so it is safe to navigate), returns its session id. */
  async attached(targetId, timeoutMs = 10000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const s = this.setups.get(targetId);
      if (s) { await s.ready; return s.sessionId; }
      await sleep(25);
    }
    throw new Error(`target ${targetId} was never attached`);
  }

  targetType(sessionId) { return this.sessions.get(sessionId)?.type ?? 'unknown'; }

  async setup(sessionId, info, waiting) {
    this.sessions.set(sessionId, { type: info.type, url: info.url, targetId: info.targetId });
    // Chrome's own built-in extensions (text-to-speech etc.) are the browser's, not the page's: let them run, do not record them.
    if (/^chrome-extension:|^chrome:|^devtools:/.test(info.url ?? '')) {
      this.sessions.get(sessionId).ignored = true;
      if (waiting) await this.cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
      return;
    }
    this.counts.targets[info.type] = (this.counts.targets[info.type] ?? 0) + 1;
    const send = (m, p) => {
      if (process.env.AUDIT_DEBUG) this.log(`  . ${info.type} ${info.url.slice(-40)} ${m}`);
      // A command a paused worker never answers must not wedge the worker: give up after 4 s and carry on.
      const timeout = new Promise(r => setTimeout(() => r('timeout'), 4000));
      return Promise.race([this.cdp.send(m, p, sessionId), timeout]).then(
        v => { if (v === 'timeout') { this.log(`  ! ${info.type} ${m}: no answer in 4s`); return null; } return v; },
        e => { this.log(`  ! ${info.type} ${m}: ${String(e.message).slice(0, 80)}`); return null; },
      );
    };
    const isPage = info.type === 'page' || info.type === 'iframe';
    const isWorker = /worker/.test(info.type);
    if (isPage || isWorker) {
      await send('Network.enable', isWorker ? {} : { maxPostDataSize: 10_000_000 });
      await send('Runtime.addBinding', { name: BINDING });
      // Dedicated workers and frames attach through their parent; service and shared workers are already attached by the
      // browser-level call (a second session on a paused service worker stops it answering commands).
      await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: 'service_worker', exclude: true }, { type: 'shared_worker', exclude: true }, {}] });
    }
    if (isPage) {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SRC, runImmediately: true });
      for (const src of this.initScripts) await send('Page.addScriptToEvaluateOnNewDocument', { source: src, runImmediately: true });
    } else if (isWorker) {
      await send('Runtime.enable');
      await send('Runtime.evaluate', { expression: HOOK_SRC });
    }
    if (waiting) await send('Runtime.runIfWaitingForDebugger');
  }

  onEvent(msg) {
    const { method, params, sessionId } = msg;
    if (method === 'Target.attachedToTarget') {
      const p = this.setup(params.sessionId, params.targetInfo, params.waitingForDebugger);
      this.setups.set(params.targetInfo.targetId, { sessionId: params.sessionId, ready: p });
      return;
    }
    if (method === 'Target.detachedFromTarget') return;
    if (!sessionId || this.sessions.get(sessionId)?.ignored) return;
    const target = this.targetType(sessionId);
    const at = Date.now() - this.t0;

    if (method === 'Network.requestWillBeSent') {
      const r = params.request;
      const key = `${sessionId}:${params.requestId}`;
      const rec = {
        kind: 'http', id: `h${++this.seq}`, t: at, target, sessionId, requestId: params.requestId,
        method: r.method, url: r.url + (r.urlFragment ?? ''), resourceType: params.type, headers: r.headers ?? {},
        initiator: params.initiator?.type, redirectedFrom: params.redirectResponse ? params.redirectResponse.url : undefined,
        body: null, bodyState: 'none', hasPostData: !!r.hasPostData,
      };
      if (Array.isArray(r.postDataEntries) && r.postDataEntries.length) {
        const parts = r.postDataEntries.map(e => (e.bytes ? b64(e.bytes) : null));
        if (parts.every(Boolean)) { rec.body = Buffer.concat(parts); rec.bodyState = 'present'; }
      }
      if (!rec.body && typeof r.postData === 'string') { rec.body = Buffer.from(r.postData, 'utf8'); rec.bodyState = 'present'; }
      if (!rec.body && r.hasPostData) {
        rec.bodyState = 'unavailable';
        this.pendingBodies.push(
          this.cdp.send('Network.getRequestPostData', { requestId: params.requestId }, sessionId)
            .then(res => { rec.body = res.base64Encoded ? b64(res.postData) : Buffer.from(res.postData, 'utf8'); rec.bodyState = 'present'; })
            .catch(() => { /* stays unavailable */ }),
        );
      }
      this.byRequest.set(key, rec);
      this.records.push(rec);
      return;
    }
    if (method === 'Network.responseReceived') {
      const rec = this.byRequest.get(`${sessionId}:${params.requestId}`);
      if (rec) { rec.status = params.response.status; rec.mime = params.response.mimeType; rec.fromServiceWorker = !!params.response.fromServiceWorker; }
      return;
    }
    if (method === 'Network.loadingFailed') {
      const rec = this.byRequest.get(`${sessionId}:${params.requestId}`);
      if (rec) rec.failed = params.errorText;
      return;
    }
    if (method === 'Network.webSocketCreated') {
      this.sockets.set(`${sessionId}:${params.requestId}`, params.url);
      this.records.push({ kind: 'ws-open', id: `w${++this.seq}`, t: at, target, url: params.url, method: 'WS', headers: {} });
      return;
    }
    if (method === 'Network.webSocketFrameSent') {
      const url = this.sockets.get(`${sessionId}:${params.requestId}`) ?? 'ws://unknown/';
      const f = params.response;
      this.records.push({
        kind: 'ws-frame', id: `f${++this.seq}`, t: at, target, url, method: 'WS', headers: {},
        body: f.opcode === 2 ? b64(f.payloadData) : Buffer.from(f.payloadData ?? '', 'utf8'), bodyState: 'present',
      });
      return;
    }
    if (method === 'Runtime.bindingCalled' && params.name === BINDING) {
      try {
        const o = JSON.parse(params.payload);
        this.records.push({ kind: 'hook', id: `k${++this.seq}`, t: at, target: o.where === 'worker' ? target : target, ...o });
      } catch { /* malformed report */ }
    }
  }

  /** Waits for the post-data fetches that were still in flight. */
  async settle() {
    await Promise.allSettled(this.pendingBodies);
    this.pendingBodies = [];
    await sleep(50);
  }
}
