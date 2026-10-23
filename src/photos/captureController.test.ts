import { describe, it, expect } from 'vitest';
import { classifyCameraError, describeCameraProblem, problemFromError } from './cameraProblem';
import { createCaptureController, COUNTDOWN_SECONDS, NOT_READY_HINT, type CapturePorts, type CaptureStreamLike } from './captureController';
import type { AddResult } from './photoStore';

// ── camera error mapper ──────────────────────────────────────────────────────

describe('camera error mapper', () => {
  const named = (name: string) => Object.assign(new Error(name), { name });

  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['PermissionDeniedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-camera'],
    ['DevicesNotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'busy'],
    ['TrackStartError', 'busy'],
    ['AbortError', 'busy'],
    ['TypeError', 'unknown'],
    ['SomethingElse', 'unknown'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyCameraError(named(name))).toBe(kind);
  });

  it('copes with things that are not errors', () => {
    for (const x of [undefined, null, 'x', 4, {}]) expect(classifyCameraError(x)).toBe('unknown');
  });

  it('every message is plain, says what to do, and never blames the person', () => {
    for (const kind of ['permission-denied', 'no-camera', 'busy', 'insecure-context', 'unknown'] as const) {
      for (const watching of [false, true]) {
        const p = describeCameraProblem(kind, watching);
        expect(p.title.length).toBeGreaterThan(5);
        expect(p.detail).toMatch(/\b(try again|Stop watching|Close it|Open Stop Biting)\b/i);
        expect(`${p.title} ${p.detail}`).not.toMatch(/100% private|nothing leaves|zero network/i);
      }
    }
  });

  it('a busy camera names watching as the cause only when watching is running', () => {
    const busy = new Error('busy');
    Object.assign(busy, { name: 'NotReadableError' });
    const watching = problemFromError(busy, true);
    expect(watching.watchingIsUsingIt).toBe(true);
    expect(watching.title).toBe('Watching is using the camera');
    const other = problemFromError(busy, false);
    expect(other.watchingIsUsingIt).toBe(false);
    expect(other.title).toBe('The camera is busy');
    // Watching running does not change what a permission problem says.
    expect(problemFromError(named('NotAllowedError'), true).watchingIsUsingIt).toBe(false);
  });
});

// ── the capture state machine, with a fake camera ───────────────────────────

interface FakeTrack { stop(): void; stopped: number }
interface FakeStream extends CaptureStreamLike { tracks: FakeTrack[]; allStopped(): boolean }

function fakeStream(trackCount = 2): FakeStream {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => {
    const t: FakeTrack = { stopped: 0, stop() { t.stopped++; } };
    return t;
  });
  return { tracks, getTracks: () => tracks, allStopped: () => tracks.every(t => t.stopped > 0) };
}

function rig(over: Partial<CapturePorts<FakeStream, 'video'>> = {}) {
  const streams: FakeStream[] = [];
  const timers: { fn: () => void; ms: number; id: number; cleared: boolean }[] = [];
  const saved: unknown[] = [];
  const control = {
    openError: undefined as unknown,
    openGate: null as null | { release(): void },
    encodeError: undefined as unknown,
    saveResult: null as AddResult | null,
    watching: false,
    clock: 7000,
  };
  const ports: CapturePorts<FakeStream, 'video'> = {
    openCamera: async () => {
      if (control.openGate) await new Promise<void>(res => { control.openGate = { release: res }; });
      if (control.openError !== undefined) throw control.openError;
      const s = fakeStream();
      streams.push(s);
      return s;
    },
    encode: async () => {
      if (control.encodeError !== undefined) throw control.encodeError;
      return { blob: new Blob([new Uint8Array(500)], { type: 'image/jpeg' }), width: 640, height: 480 };
    },
    save: async frame => {
      saved.push(frame);
      return control.saveResult ?? { ok: true, photo: { id: 'p1', takenAt: frame.takenAt, width: frame.width, height: frame.height, bytes: frame.blob.size }, persisted: true };
    },
    now: () => control.clock,
    setTimer: (fn, ms) => {
      const t = { fn, ms, id: timers.length + 1, cleared: false };
      timers.push(t);
      return t.id;
    },
    clearTimer: handle => { const t = timers.find(x => x.id === handle); if (t) t.cleared = true; },
    isWatching: () => control.watching,
    ...over,
  };
  const controller = createCaptureController(ports);
  /** Runs the newest pending timer, like a second passing. */
  const tick = () => {
    const t = [...timers].reverse().find(x => !x.cleared);
    if (!t) throw new Error('no timer');
    t.cleared = true;
    t.fn();
  };
  return { controller, streams, timers, saved, control, tick };
}

describe('capture controller: the camera is always released', () => {
  it('opens the camera, goes live, and a photo turns every track off at once', async () => {
    const r = rig();
    await r.controller.start();
    expect(r.controller.getState().phase).toBe('live');
    expect(r.streams).toHaveLength(1);
    expect(r.streams[0].allStopped()).toBe(false);
    await r.controller.takeNow('video');
    const s = r.controller.getState();
    expect(s.phase).toBe('review');
    expect(r.streams[0].allStopped()).toBe(true);
    expect(r.streams[0].tracks.every(t => t.stopped === 1)).toBe(true);
    if (s.phase === 'review') {
      expect(s.frame.takenAt).toBe(7000);
      expect(s.frame.width).toBe(640);
    }
  });

  it('the countdown counts 3, 2, 1 and then takes the photo and stops the camera', async () => {
    const r = rig();
    await r.controller.start();
    r.controller.takeWithCountdown('video');
    expect(r.controller.getState()).toMatchObject({ phase: 'counting', secondsLeft: COUNTDOWN_SECONDS });
    r.tick();
    expect(r.controller.getState()).toMatchObject({ phase: 'counting', secondsLeft: 2 });
    r.tick();
    expect(r.controller.getState()).toMatchObject({ phase: 'counting', secondsLeft: 1 });
    r.tick();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(res => setTimeout(res, 0));
    expect(r.controller.getState().phase).toBe('review');
    expect(r.streams[0].allStopped()).toBe(true);
    expect(r.timers.every(t => t.cleared)).toBe(true);
  });

  it('cancelling the countdown goes back to the live preview with the camera still on and no stray timer', async () => {
    const r = rig();
    await r.controller.start();
    r.controller.takeWithCountdown('video');
    r.controller.cancelCountdown();
    expect(r.controller.getState().phase).toBe('live');
    expect(r.streams[0].allStopped()).toBe(false);
    expect(r.timers.every(t => t.cleared)).toBe(true);
  });

  it('Retake opens a fresh stream (the old one is already off); Discard turns everything off', async () => {
    const r = rig();
    await r.controller.start();
    await r.controller.takeNow('video');
    await r.controller.retake();
    expect(r.controller.getState().phase).toBe('live');
    expect(r.streams).toHaveLength(2);
    expect(r.streams[0].allStopped()).toBe(true);
    expect(r.streams[1].allStopped()).toBe(false);
    r.controller.discard();
    expect(r.controller.getState().phase).toBe('idle');
    expect(r.streams[1].allStopped()).toBe(true);
  });

  it('dispose (unmount) stops the camera from every live phase', async () => {
    for (const phase of ['live', 'counting'] as const) {
      const r = rig();
      await r.controller.start();
      if (phase === 'counting') r.controller.takeWithCountdown('video');
      r.controller.dispose();
      expect(r.streams[0].allStopped(), phase).toBe(true);
      expect(r.timers.every(t => t.cleared), phase).toBe(true);
      expect(r.controller.getState().phase).toBe('idle');
    }
  });

  it('a camera that finishes opening AFTER the person left is stopped the moment it arrives', async () => {
    const r = rig();
    r.control.openGate = { release() {} };
    const started = r.controller.start();
    expect(r.controller.getState().phase).toBe('starting');
    r.controller.dispose(); // unmount while the browser is still asking
    r.control.openGate!.release();
    await started;
    expect(r.streams).toHaveLength(1);
    expect(r.streams[0].allStopped()).toBe(true);
    expect(r.controller.getState().phase).toBe('idle');
  });

  it('the page being hidden turns the camera off and says why; starting again works', async () => {
    const r = rig();
    await r.controller.start();
    r.controller.release('You left the page.');
    expect(r.controller.getState()).toEqual({ phase: 'idle', notice: 'You left the page.' });
    expect(r.streams[0].allStopped()).toBe(true);
    await r.controller.start();
    expect(r.controller.getState().phase).toBe('live');
    expect(r.streams).toHaveLength(2);
  });

  it('hiding the page does not throw away a photo that is waiting to be saved', async () => {
    const r = rig();
    await r.controller.start();
    await r.controller.takeNow('video');
    r.controller.release('hidden');
    expect(r.controller.getState().phase).toBe('review');
  });

  it('a track that throws on stop does not stop the others from being stopped', async () => {
    const r = rig({
      openCamera: async () => {
        const s = fakeStream(3);
        s.tracks[0].stop = () => { throw new Error('boom'); };
        r.streams.push(s);
        return s;
      },
    });
    await r.controller.start();
    r.controller.dispose();
    expect(r.streams[0].tracks[1].stopped).toBe(1);
    expect(r.streams[0].tracks[2].stopped).toBe(1);
  });

  it('pressing twice does not open two cameras or take two photos', async () => {
    const r = rig();
    await Promise.all([r.controller.start(), r.controller.start()]);
    expect(r.streams).toHaveLength(1);
    await Promise.all([r.controller.takeNow('video'), r.controller.takeNow('video')]);
    expect(r.controller.getState().phase).toBe('review');
  });
});

describe('capture controller: errors', () => {
  const named = (name: string) => Object.assign(new Error(name), { name });

  it('permission denied -> a clear message, no stream left open, and a retry works', async () => {
    const r = rig();
    r.control.openError = named('NotAllowedError');
    await r.controller.start();
    const s = r.controller.getState();
    expect(s.phase).toBe('error');
    if (s.phase === 'error') {
      expect(s.problem.kind).toBe('permission-denied');
      expect(s.problem.title).toBe('The camera is blocked');
    }
    expect(r.streams).toHaveLength(0);
    r.control.openError = undefined;
    await r.controller.retake();
    expect(r.controller.getState().phase).toBe('live');
  });

  it('no camera and unknown errors have their own messages', async () => {
    const a = rig();
    a.control.openError = named('NotFoundError');
    await a.controller.start();
    expect(a.controller.getState()).toMatchObject({ phase: 'error', problem: { kind: 'no-camera' } });
    const b = rig();
    b.control.openError = new Error('weird');
    await b.controller.start();
    expect(b.controller.getState()).toMatchObject({ phase: 'error', problem: { kind: 'unknown' } });
  });

  it('a camera another app (or watching) holds -> "busy", and watching is named only when it is running', async () => {
    const quiet = rig();
    quiet.control.openError = named('NotReadableError');
    await quiet.controller.start();
    expect(quiet.controller.getState()).toMatchObject({ phase: 'error', problem: { kind: 'busy', watchingIsUsingIt: false } });

    const watching = rig();
    watching.control.openError = named('NotReadableError');
    watching.control.watching = true;
    await watching.controller.start();
    expect(watching.controller.getState()).toMatchObject({ phase: 'error', problem: { kind: 'busy', watchingIsUsingIt: true, title: 'Watching is using the camera' } });
  });

  it('a page with no camera API says it needs a secure page', async () => {
    const r = rig({ openCamera: undefined });
    await r.controller.start();
    expect(r.controller.getState()).toMatchObject({ phase: 'error', problem: { kind: 'insecure-context' } });
  });

  it('a press before the camera has a picture keeps the preview and asks to wait', async () => {
    const r = rig();
    await r.controller.start();
    r.control.encodeError = new Error('no-frame');
    await r.controller.takeNow('video');
    expect(r.controller.getState()).toMatchObject({ phase: 'live', hint: NOT_READY_HINT });
    expect(r.streams[0].allStopped()).toBe(false);
    r.control.encodeError = undefined;
    await r.controller.takeNow('video');
    expect(r.controller.getState().phase).toBe('review');
    expect(r.streams[0].allStopped()).toBe(true);
  });
});

describe('capture controller: saving', () => {
  it('Save stores the frame and ends in "saved" with the record', async () => {
    const r = rig();
    await r.controller.start();
    await r.controller.takeNow('video');
    await r.controller.save();
    const s = r.controller.getState();
    expect(s.phase).toBe('saved');
    if (s.phase === 'saved') {
      expect(s.photo.takenAt).toBe(7000);
      expect(s.persisted).toBe(true);
    }
    expect(r.saved).toHaveLength(1);
  });

  it('a failed save keeps the photo on screen with the reason, and it can be saved again', async () => {
    const r = rig();
    await r.controller.start();
    await r.controller.takeNow('video');
    r.control.saveResult = { ok: false, reason: 'full', message: 'The diary is full.' };
    await r.controller.save();
    expect(r.controller.getState()).toMatchObject({ phase: 'review', saveError: 'The diary is full.' });
    r.control.saveResult = null;
    await r.controller.save();
    expect(r.controller.getState().phase).toBe('saved');
  });

  it('a save that throws is reported, not lost', async () => {
    const r = rig({ save: async () => { throw new Error('disk'); } });
    await r.controller.start();
    await r.controller.takeNow('video');
    await r.controller.save();
    expect(r.controller.getState()).toMatchObject({ phase: 'review', saveError: expect.stringContaining('could not be saved') });
  });

  it('Save is ignored outside the review step, and a double press saves once', async () => {
    const r = rig();
    await r.controller.save();
    expect(r.saved).toHaveLength(0);
    await r.controller.start();
    await r.controller.takeNow('video');
    await Promise.all([r.controller.save(), r.controller.save()]);
    expect(r.saved).toHaveLength(1);
  });

  it('notifies subscribers on every change, and stops after unsubscribe', async () => {
    const r = rig();
    const seen: string[] = [];
    const off = r.controller.subscribe(() => seen.push(r.controller.getState().phase));
    await r.controller.start();
    off();
    await r.controller.takeNow('video');
    expect(seen).toEqual(['starting', 'live']);
  });
});
