import { describe, it, expect } from 'vitest';
import { PHONE_ONLY, PHONE_ONLY_CAN_SYNC, syncNoteFor } from './syncNote';

describe('syncNoteFor: the one sentence about where phone entries live', () => {
  it('sync not offered by the server: says only that it is on this phone, with no instruction it cannot keep', () => {
    const n = syncNoteFor({ syncAvailable: false, optedIn: false });
    expect(n).toEqual({ kind: 'phone_only', text: 'Stored on this phone only.', action: null });
    expect(n.text).toBe(PHONE_ONLY);
    expect(n.text).not.toMatch(/Settings/);
  });
  it('sync offered but this account has not turned it on: the plain sentence and a way to Settings', () => {
    const n = syncNoteFor({ syncAvailable: true, optedIn: false });
    expect(n.text).toBe('Stored on this phone only. Turn on sync in Settings to see it on your computer.');
    expect(n.text).toBe(PHONE_ONLY_CAN_SYNC);
    expect(n.action).toBe('settings');
  });
  it('sync on: does not say "this phone only"', () => {
    const n = syncNoteFor({ syncAvailable: true, optedIn: true });
    expect(n.kind).toBe('syncing');
    expect(n.text).not.toMatch(/this phone only/i);
    expect(n.action).toBeNull();
  });
  it('an opt-in with the flag off is still "this phone only" (the server would answer 404)', () => {
    expect(syncNoteFor({ syncAvailable: false, optedIn: true }).kind).toBe('phone_only');
  });
});
