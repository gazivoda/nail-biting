// What the audit does in the browser: the way a person would, through the real UI, with real mouse events.
//   1. open the signed-in app; detection starts with the fake camera (a test pattern, not a person)
//   2. log bites with a trigger tag, log an urge with the breathing timer (when that flag is on)
//   3. Settings: with mode "on", switch sync on the way a person does (the opt-in), then "Sync now"
//      with mode "off", walk Settings and History without switching it on
//   4. History > Insights/Photos: take a diary photo with the fake camera and save it (when photo_diary is on)
//   5. back to Watch; keep detecting until the time is up; more activity part-way through
// It returns what happened so the report can say it, and the photo's fingerprints so no request can hide them.
import { sleep } from './browser.mjs';

const FIND = `(q) => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  let els = q.css ? [...document.querySelectorAll(q.css)] : [...document.querySelectorAll('button,[role=button],[role=switch],[role=tab],[role=radio],a,input,summary')];
  if (q.text) {
    const t = q.text.toLowerCase();
    els = els.filter((el) => {
      const own = (el.innerText || el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      return q.exact ? own === t || aria === t : own.includes(t) || aria.includes(t);
    });
  }
  els = els.filter(vis);
  if (q.inside) {
    const t = q.inside.toLowerCase();
    els = els.filter((el) => { const box = el.closest('div.rounded-2xl, section, [role=dialog]'); return !!box && (box.innerText || '').toLowerCase().includes(t); });
  }
  const el = els[q.index || 0];
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  const top = document.elementFromPoint(x, y);
  const covered = !top || !(el === top || el.contains(top) || top.contains(el));
  return { x, y, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60), checked: el.getAttribute('aria-checked'), disabled: !!el.disabled, n: els.length, covered, coveredBy: covered && top ? (top.tagName + ' ' + (top.getAttribute('aria-label') || (top.innerText || '').trim().slice(0, 30))) : null };
}`;

const PHOTO_PROBE = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('stop-biting-local-blobs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  if (!db.objectStoreNames.contains('blobs')) return [];
  const st = db.transaction('blobs', 'readonly').objectStore('blobs');
  const keys = await new Promise((res) => { const r = st.getAllKeys(); r.onsuccess = () => res(r.result); });
  const out = [];
  for (const k of keys) {
    if (!String(k).startsWith('photo-diary/')) continue;
    const v = await new Promise((res) => { const r = db.transaction('blobs', 'readonly').objectStore('blobs').get(k); r.onsuccess = () => res(r.result); });
    if (!(v instanceof Blob)) continue;
    const u8 = new Uint8Array(await v.arrayBuffer());
    const b64 = (a) => { let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s); };
    const distinct = (a) => new Set(a).size;
    const win = (frac) => {
      let at = Math.max(0, Math.min(u8.length - 48, Math.floor(u8.length * frac)));
      // a window with real variety (not a run of one byte), searched forward from the target position
      for (let i = 0; i < 4000 && at + 48 < u8.length; i++, at++) if (distinct(u8.subarray(at, at + 48)) >= 28) break;
      return { at, b64: b64(u8.subarray(at, at + 48)), distinct: distinct(u8.subarray(at, at + 48)) };
    };
    const digest = await crypto.subtle.digest('SHA-256', u8);
    out.push({ key: String(k), size: u8.length, type: v.type, sha256: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''), windows: [0.2, 0.4, 0.6, 0.8].map(win) });
  }
  return out;
})()`;

export function makePage(cdp, sessionId, origin, log) {
  const send = (m, p) => cdp.send(m, p, sessionId);
  const page = {
    sessionId,
    send,
    async eval(expression, { awaitPromise = true } = {}) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async find(q) { return page.eval(`(${FIND})(${JSON.stringify(q)})`); },
    async click(q, { optional = false, timeout = 8000 } = {}) {
      const until = Date.now() + timeout;
      let hit = null;
      let lastCover = null;
      while (Date.now() < until) {
        hit = await page.find(q).catch(() => null);
        if (hit && hit.covered) {
          lastCover = hit.coveredBy;
          // the "Install Stop Biting" banner can sit over a button: dismiss it the way a person would
          const dis = await page.find({ css: 'button[aria-label="Dismiss"]' }).catch(() => null);
          if (dis && !dis.covered) { await page.rawClick(dis); await sleep(400); }
          hit = null;
        } else if (hit && !hit.disabled) break;
        else hit = null;
        await sleep(200);
      }
      if (!hit && lastCover) throw new Error(`${JSON.stringify(q)} is covered by ${lastCover}`);
      if (!hit) {
        if (optional) return null;
        throw new Error(`could not find ${JSON.stringify(q)}`);
      }
      await page.rawClick(hit);
      return hit;
    },
    async rawClick(hit) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit.x, y: hit.y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
    },
    async waitText(text, timeout = 8000) {
      const until = Date.now() + timeout;
      const t = JSON.stringify(text.toLowerCase());
      while (Date.now() < until) {
        if (await page.eval(`document.body.innerText.toLowerCase().includes(${t})`).catch(() => false)) return true;
        await sleep(200);
      }
      return false;
    },
    async frames() { return page.eval('(window.__auditFrames && window.__auditFrames.texVideo) || 0').catch(() => 0); },
    async shot(name, dir) {
      if (!dir) return;
      try {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        const { writeFileSync, mkdirSync } = await import('node:fs');
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${name}.png`, Buffer.from(data, 'base64'));
      } catch (e) { log(`  (screenshot ${name} failed: ${e.message})`); }
    },
  };
  return page;
}

/**
 * @param {object} o
 * @param {ReturnType<typeof makePage>} o.page
 * @param {import('./capture.mjs').Recorder} o.rec
 * @param {'on' | 'off' | 'flagsoff'} o.mode
 * @param {number} o.seconds  how long detection runs in total
 * @param {string[]} o.flags  the server's feature flags
 */
export async function runScenario({ page, rec, mode, seconds, flags, log, shotDir, probe = false }) {
  const has = (f) => flags.includes(f);
  const steps = [];
  const out = { steps, bitesLogged: 0, urgeLogged: 0, alarmsRaised: 0, syncSwitchedOn: false, photo: null, frameSamples: [], notes: [] };
  const step = async (name, fn, { required = false } = {}) => {
    const t = Date.now();
    try {
      const v = await fn();
      steps.push({ name, ok: true, ms: Date.now() - t, detail: v ?? undefined });
      log(`  ok   ${name}${v ? ` (${typeof v === 'string' ? v : JSON.stringify(v)})` : ''}`);
      return v;
    } catch (e) {
      steps.push({ name, ok: false, ms: Date.now() - t, error: String(e.message ?? e), required });
      log(`  FAIL ${name}: ${String(e.message ?? e).slice(0, 200)}`);
      await page.shot(`fail-${name.replace(/\W+/g, '-')}`, shotDir);
      return null;
    }
  };

  // ── 1. detection ──
  const start = Date.now();
  const detectionStarted = await step('detection starts with the fake camera', async () => {
    for (let i = 0; i < 120; i++) {
      if ((await page.frames()) > 4) return `${await page.frames()} frames after ${Math.round((Date.now() - start) / 1000)}s`;
      await sleep(1000);
    }
    throw new Error(`no video frames reached MediaPipe in 120s; page says: ${await page.eval('document.body.innerText.slice(0, 200)').catch(() => '?')}`);
  }, { required: true });
  if (!detectionStarted) return out;
  const t0 = Date.now();
  const elapsed = () => (Date.now() - t0) / 1000;
  await page.shot('01-watch', shotDir);
  const sample = () => { void page.frames().then(n => out.frameSamples.push({ t: +elapsed().toFixed(1), frames: n })); };
  sample();
  await sleep(2000);

  const nav = async (label) => { await page.click({ css: 'nav[aria-label="Main navigation"] button', text: label, exact: true }); await sleep(900); };
  const logBite = async (tagLabel) => {
    await page.click({ text: 'I just bit my nails' });
    await sleep(400);
    await page.click({ text: tagLabel, exact: true });
    if (!(await page.waitText('Logged:', 4000))) throw new Error('no "Logged:" confirmation');
    out.bitesLogged++;
    await sleep(900);
  };

  // ── 2. bites and an urge ──
  await step('log three bites with trigger tags', async () => {
    await logBite('Stress'); await logBite('Boredom'); await logBite('Deep focus');
    return `${out.bitesLogged} logged`;
  });
  await page.shot('02-after-bites', shotDir);

  if (has('urge_timer')) {
    await step('urge: open, start the breathing timer, stop it', async () => {
      await page.click({ text: 'I feel an urge' });
      await sleep(500);
      await page.click({ text: 'Start', exact: true });
      await sleep(5000);
      await page.shot('03-urge-running', shotDir);
      await page.click({ text: 'Stop', exact: true, inside: 'seconds left' });
      if (!(await page.waitText('logged as an urge', 4000))) throw new Error('no urge confirmation');
      out.urgeLogged++;
      await sleep(800);
    });
  }
  sample();

  // ── 3. Settings: the opt-in (mode on) ──
  await step('Settings tab opens', () => nav('Settings'));
  await page.shot('04-settings', shotDir);
  if (has('event_sync')) {
    const switchQ = { css: '[role=switch]', text: 'Sync my history across devices', exact: true };
    if (mode === 'on') {
      await step('switch sync on (the opt-in)', async () => {
        const hit = await page.click(switchQ);
        await sleep(800);
        const now = await page.find(switchQ);
        if (!now || now.checked !== 'true') throw new Error(`switch did not turn on (aria-checked=${now?.checked})`);
        out.syncSwitchedOn = true;
        return `was ${hit.checked}`;
      }, { required: true });
      await step('first sync request is made', async () => {
        for (let i = 0; i < 60; i++) {
          if (rec.records.some(r => r.kind === 'http' && /\/api\/events\/sync$/.test(r.url.split('?')[0]) && r.method === 'POST')) return `after ${i}s`;
          await sleep(1000);
        }
        throw new Error('no POST /api/events/sync within 60s of switching sync on');
      }, { required: true });
      await page.shot('05-sync-on', shotDir);
    } else {
      await step('sync switch is visible and stays off', async () => {
        const now = await page.find(switchQ);
        if (!now) throw new Error('sync switch not found');
        if (now.checked === 'true') throw new Error('sync switch is already on');
        return `aria-checked=${now.checked}`;
      });
    }
  }
  await step('scroll through Settings', async () => {
    await page.eval('window.scrollTo(0, document.body.scrollHeight)');
    await sleep(700);
    await page.eval('window.scrollTo(0, 0)');
  });

  // ── back to Watch: more bites after the opt-in ──
  await step('Watch tab', () => nav('Watch'));
  await step('log two more bites', async () => { await logBite('Not sure'); await logBite('Stress'); return `${out.bitesLogged} logged in all`; });
  await step('log a bite and undo it (the deletion is a record that syncs)', async () => {
    await page.click({ text: 'I just bit my nails' });
    await sleep(400);
    await page.click({ text: 'Boredom', exact: true });
    if (!(await page.waitText('Logged:', 4000))) throw new Error('no "Logged:" confirmation');
    await page.click({ text: 'Undo', exact: true });
    await sleep(1200);
  });
  if (mode === 'on') {
    await step('Sync now', async () => {
      await nav('Settings');
      await page.click({ text: 'Sync now', exact: true });
      await sleep(2500);
      await nav('Watch');
    });
  }
  sample();

  // ── 3b. real alarms, with real landmark data in the page (probe build only) ──
  if (probe) {
    const incidents = () => page.eval(`(JSON.parse(localStorage.getItem('stop-biting-state') || '{}').state?.incidents || []).length`);
    const alarmRound = async (n, react) => {
      const before = await incidents();
      await page.eval('window.__sbProbe.inject = true');
      let got = false;
      for (let i = 0; i < 50 && !got; i++) { await sleep(500); got = (await incidents()) > before; }
      await sleep(1500);
      await page.eval('window.__sbProbe.inject = false');
      if (!got) throw new Error('no alarm event was created while the detector saw a hand on the mouth');
      out.alarmsRaised++;
      await sleep(800);
      await page.shot(`alarm-${n}`, shotDir);
      if (react) await react();
      await sleep(1500);
      return `alarm ${n} logged`;
    };
    out.alarmRound = alarmRound;
    await step('real alarm 1: detector sees 21 hand + 478 face points on the mouth; pick a reason, do the coaching response', () => alarmRound(1, async () => {
      await page.click({ text: 'Stress', exact: true, inside: 'what set it off' }, { optional: true, timeout: 3000 });
      await page.click({ text: 'Sip water mindfully' }, { optional: true, timeout: 2000 });
      await sleep(1500);
      await page.click({ text: 'Done', exact: true }, { optional: true, timeout: 3000 });
    }));
    out.alarm1At = elapsed();
    sample();
  }

  // ── 4. History and the photo diary ──
  await step('History tab', () => nav('History'));
  await page.shot('06-history', shotDir);
  if (has('photo_diary')) {
    const photo = await step('photo diary: open the view, take a photo with the fake camera, save it', async () => {
      await page.click({ css: '[role=tab],button', text: has('insights') ? 'Insights' : 'Photos', exact: true });
      await sleep(1500);
      await page.shot('07-insights', shotDir);
      await page.click({ css: '#photo-diary-take, button', text: 'photo' }, { timeout: 15000 }).catch(async () => {
        await page.click({ css: '#photo-diary-take' }, { timeout: 10000 });
      });
      await sleep(800);
      await page.click({ text: 'Start the camera' }, { optional: true, timeout: 4000 });
      // wait for the live preview, then take it now
      for (let i = 0; i < 30; i++) {
        if (await page.eval(`(() => { const v = document.querySelector('video[aria-label="Live camera preview"]'); return !!(v && v.readyState >= 2 && v.videoWidth > 0); })()`).catch(() => false)) break;
        await sleep(500);
      }
      await page.shot('08-capture', shotDir);
      await page.click({ text: 'Take it now' }, { timeout: 15000 });
      await sleep(1500);
      await page.shot('09-captured', shotDir);
      await page.click({ text: 'Save', exact: false }, { timeout: 15000 });
      await sleep(2500);
      await page.shot('10-saved', shotDir);
      const photos = await page.eval(PHOTO_PROBE);
      if (!photos.length) throw new Error('no photo found in the browser\'s local store after saving');
      return photos;
    });
    if (photo) out.photo = photo;
    // Is detection still alive after the diary used the camera?
    const f1 = await page.frames();
    await nav('Watch').catch(() => {});
    await sleep(3000);
    const f2 = await page.frames();
    out.notes.push(`frames before/after the diary: ${f1} -> ${f2}`);
  } else {
    await step('walk History', async () => { await page.eval('window.scrollTo(0, document.body.scrollHeight)'); await sleep(800); await page.eval('window.scrollTo(0, 0)'); });
  }
  await nav('Watch').catch(() => {});
  sample();

  // ── 5. keep detecting; more activity part-way through ──
  const total = Math.max(seconds, elapsed() + 8);
  let round = 0;
  while (elapsed() < total) {
    const left = total - elapsed();
    if (probe && out.alarmRound && !out.alarm2Done && seconds >= 150 && elapsed() >= Math.max(0.3 * seconds, (out.alarm1At ?? 0) + 33)) {
      out.alarm2Done = true; // the detector's episode window is 30 s, so this one is a new entry
      await step('real alarm 2 (a new episode): "Not a bite"', () => out.alarmRound(2, async () => {
        await page.click({ text: 'Not a bite', exact: true }, { optional: true, timeout: 3000 });
      }));
    }
    const nextAt = [0.5, 0.75].map(f => f * seconds).find(a => a > elapsed() && round < 2);
    if (nextAt !== undefined && nextAt - elapsed() < 12 && seconds >= 120) {
      round++;
      await step(`mid-session activity ${round}`, async () => {
        await logBite('Stress');
        if (mode === 'on') { await nav('Settings'); await page.click({ text: 'Sync now', exact: true }); await sleep(2500); }
        await nav('History'); await sleep(1500); await nav('Watch');
      });
    }
    await sleep(Math.min(5000, Math.max(250, left * 1000)));
    if (Math.floor(elapsed()) % 15 < 5) sample();
  }
  sample();
  await sleep(500);
  if (mode === 'on') {
    // let the last change reach the server before the recording stops
    await step('final Sync now', async () => { await nav('Settings'); await page.click({ text: 'Sync now', exact: true }, { optional: true }); await sleep(3000); await nav('Watch'); });
  }
  out.durationSec = +elapsed().toFixed(1);
  out.finalFrames = await page.frames();
  out.serviceWorker = await page.eval(`(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    return { registrations: regs.map(r => ({ scope: r.scope, active: r.active ? r.active.state : null, script: r.active ? r.active.scriptURL : null, waiting: !!r.waiting, installing: !!r.installing })), caches: keys };
  })()`).catch(e => ({ error: String(e.message ?? e) }));
  return out;
}
