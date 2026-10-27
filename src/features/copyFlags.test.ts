import { describe, it, expect } from 'vitest';
import { COPY_MARKER_FLAGS, COPY_MARKER_NAME, copyFlagIsOn, parseCopyMarker, readCopyMarker } from './copyFlags';
import { FLAGS_TTL_MS } from './flags';
import { FEATURE_NAMES } from './registry';

const NOW = 1_000_000_000_000;
const none = { marker: null, cached: null, now: NOW };

describe('the marker a marketing page learns its flags from', () => {
  it('names only flags that exist', () => {
    for (const name of COPY_MARKER_FLAGS) expect(FEATURE_NAMES).toContain(name);
  });

  it('parses the server\'s list, and treats anything else as no marker', () => {
    expect([...parseCopyMarker('event_sync phone_companion')!]).toEqual(['event_sync', 'phone_companion']);
    expect([...parseCopyMarker('  event_sync ')!]).toEqual(['event_sync']);
    expect(parseCopyMarker('')).toBeNull();
    expect(parseCopyMarker(null)).toBeNull();
    expect(parseCopyMarker(undefined)).toBeNull();
    expect(parseCopyMarker('hrt_coaching share_links')).toBeNull();   // not copy flags: never trusted from a page
  });

  it('reads it out of a page, and a page without one, or no page, gives none', () => {
    const page = (content: string | null) => ({
      querySelector: (selector: string) => (content !== null && selector === `meta[name="${COPY_MARKER_NAME}"]` ? { getAttribute: () => content } : null),
    }) as unknown as Pick<Document, 'querySelector'>;
    expect([...readCopyMarker(page('event_sync'))!]).toEqual(['event_sync']);
    expect(readCopyMarker(page(null))).toBeNull();
    expect(readCopyMarker(undefined)).toBeNull();   // node: no document
    expect(readCopyMarker({ querySelector: () => { throw new Error('boom'); } } as unknown as Pick<Document, 'querySelector'>)).toBeNull();
  });
});

describe('copyFlagIsOn', () => {
  it('is off when nothing is known: no marker and no answer', () => {
    for (const name of COPY_MARKER_FLAGS) expect(copyFlagIsOn(name, none)).toBe(false);
  });

  it('follows the marker, which is authoritative: a listed flag is on, an unlisted one is off even if the app once heard otherwise', () => {
    const cached = { at: NOW - 1000, flags: { event_sync: true, phone_companion: true } };
    const marker = new Set(['phone_companion']);
    expect(copyFlagIsOn('phone_companion', { marker, cached: null, now: NOW })).toBe(true);
    expect(copyFlagIsOn('event_sync', { marker, cached, now: NOW })).toBe(false);
  });

  it('knows the Lifetime plan: the server lists it only when the flag is on AND it has the price id, so the marker decides the FAQ', () => {
    expect(COPY_MARKER_FLAGS).toContain('lifetime_plan');
    expect([...parseCopyMarker('event_sync lifetime_plan')!]).toEqual(['event_sync', 'lifetime_plan']);
    const flagOnly = { at: NOW - 1000, flags: { lifetime_plan: true } };   // what /api/features says: the flag, not the price id
    expect(copyFlagIsOn('lifetime_plan', { marker: new Set(['lifetime_plan']), cached: null, now: NOW })).toBe(true);
    expect(copyFlagIsOn('lifetime_plan', { marker: new Set(['event_sync']), cached: flagOnly, now: NOW })).toBe(false);
    expect(copyFlagIsOn('lifetime_plan', { marker: null, cached: flagOnly, now: NOW })).toBe(true);   // no marker: a visitor served the cached shell
  });

  it('with no marker the Lifetime words also wait for the price id the build was given, as the card does; a marker needs no such help', () => {
    const flagOnly = { at: NOW - 1000, flags: { lifetime_plan: true, event_sync: true } };
    const withId = { lifetimePriceId: true };
    const noId = { lifetimePriceId: false };
    expect(copyFlagIsOn('lifetime_plan', { marker: null, cached: flagOnly, now: NOW }, withId)).toBe(true);
    expect(copyFlagIsOn('lifetime_plan', { marker: null, cached: flagOnly, now: NOW }, noId)).toBe(false);   // flag on, no card: no Lifetime words
    expect(copyFlagIsOn('lifetime_plan', { marker: new Set(['lifetime_plan']), cached: null, now: NOW }, noId)).toBe(true);   // the server judged
    expect(copyFlagIsOn('event_sync', { marker: null, cached: flagOnly, now: NOW }, noId)).toBe(true);   // no other flag is held back
  });

  it('with no marker uses the app\'s last answer only while it is fresh, and only an exact true', () => {
    const fresh = { at: NOW - 60_000, flags: { event_sync: true, phone_companion: 'yes' } };
    expect(copyFlagIsOn('event_sync', { marker: null, cached: fresh, now: NOW })).toBe(true);
    expect(copyFlagIsOn('phone_companion', { marker: null, cached: fresh, now: NOW })).toBe(false);
    const stale = { at: NOW - FLAGS_TTL_MS, flags: { event_sync: true } };
    expect(copyFlagIsOn('event_sync', { marker: null, cached: stale, now: NOW })).toBe(false);
    const future = { at: NOW + 5_000, flags: { event_sync: true } };   // a clock that went backwards: unknown, so off
    expect(copyFlagIsOn('event_sync', { marker: null, cached: future, now: NOW })).toBe(false);
    for (const junk of [{ at: 'x', flags: {} }, { at: NOW, flags: null }, { at: NOW, flags: 'event_sync' }, {}]) {
      expect(copyFlagIsOn('event_sync', { marker: null, cached: junk, now: NOW })).toBe(false);
    }
  });
});
