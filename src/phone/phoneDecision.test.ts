import { describe, it, expect } from 'vitest';
import { PHONE_VIEW_QUERY, decidePhoneView, hasNoWebcam, isPhoneView } from './phoneDecision';

describe('isPhoneView', () => {
  it('is true when the phone query matches', () => {
    expect(isPhoneView(q => ({ matches: q === PHONE_VIEW_QUERY }))).toBe(true);
  });
  it('is false for a desktop, a tablet, and when matchMedia is missing or throws', () => {
    expect(isPhoneView(() => ({ matches: false }))).toBe(false);
    expect(isPhoneView(undefined)).toBe(false);
    expect(isPhoneView(() => { throw new Error('x'); })).toBe(false);
  });
  it('keeps a phone on its side (wide but short) on the phone view, and nothing else', () => {
    // The query is two clauses, both needing a touch-only pointer: a small screen, or a short one.
    expect(PHONE_VIEW_QUERY).toBe('(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)');
    for (const clause of PHONE_VIEW_QUERY.split(', ')) expect(clause.startsWith('(pointer: coarse) and ')).toBe(true);
  });
});

describe('hasNoWebcam', () => {
  const lister = (kinds: string[]) => ({ enumerateDevices: async () => kinds.map(kind => ({ kind })) });

  it('is true only for a non-empty list with no camera in it', async () => {
    expect(await hasNoWebcam(lister(['audioinput', 'audiooutput']))).toBe(true);
    expect(await hasNoWebcam(lister(['audiooutput']))).toBe(true);
  });
  it('is false when a camera is listed', async () => {
    expect(await hasNoWebcam(lister(['audioinput', 'videoinput']))).toBe(false);
  });
  it('is false for an EMPTY list: Safari answers with nothing until capture is granted', async () => {
    expect(await hasNoWebcam(lister([]))).toBe(false);
  });
  it('is false whenever the answer is uncertain', async () => {
    expect(await hasNoWebcam(undefined)).toBe(false);
    expect(await hasNoWebcam({})).toBe(false);
    expect(await hasNoWebcam({ enumerateDevices: async () => { throw new Error('blocked'); } })).toBe(false);
    expect(await hasNoWebcam({ enumerateDevices: (async () => null) as never })).toBe(false);
  });
  it('never opens a camera: only enumerateDevices is ever called', async () => {
    const calls: string[] = [];
    const devices = {
      enumerateDevices: async () => { calls.push('enumerateDevices'); return [{ kind: 'audiooutput' }]; },
      getUserMedia: async () => { calls.push('getUserMedia'); },
    };
    await hasNoWebcam(devices);
    expect(calls).toEqual(['enumerateDevices']);
  });
});

describe('decidePhoneView', () => {
  const base = { flagOn: true, phoneLike: false, noWebcam: null as boolean | null, fullApp: false };

  it('is off whenever the flag is off, whatever the device', () => {
    expect(decidePhoneView({ ...base, flagOn: false, phoneLike: true })).toBe(false);
    expect(decidePhoneView({ ...base, flagOn: false, noWebcam: true })).toBe(false);
  });
  it('is on for a phone and for a computer with no webcam', () => {
    expect(decidePhoneView({ ...base, phoneLike: true })).toBe(true);
    expect(decidePhoneView({ ...base, noWebcam: true })).toBe(true);
  });
  it('stays off for a computer with a camera, or while the probe has not answered', () => {
    expect(decidePhoneView({ ...base, noWebcam: false })).toBe(false);
    expect(decidePhoneView({ ...base, noWebcam: null })).toBe(false);
  });
  it('"Open the full app" wins for the rest of the page load', () => {
    expect(decidePhoneView({ ...base, phoneLike: true, fullApp: true })).toBe(false);
    expect(decidePhoneView({ ...base, noWebcam: true, fullApp: true })).toBe(false);
  });
});
