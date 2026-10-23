import { describe, it, expect } from 'vitest';
import { watchNote } from './watchText';

const clock = (ts: number) => `${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;
const now = new Date(2026, 9, 23, 14, 0).getTime();

describe('the words for a pause or a meeting', () => {
  it('says nothing while watching just runs or is stopped', () => {
    expect(watchNote({ kind: 'running' }, now, clock)).toBeNull();
    expect(watchNote({ kind: 'stopped' }, now, clock)).toBeNull();
  });

  it('a pause names its end time, and no line repeats another', () => {
    const n = watchNote({ kind: 'paused', until: now + 15 * 60_000, releaseCamera: true }, now, clock)!;
    expect(n.kind).toBe('paused');
    expect(n.title).toBe('Paused until 14:15');
    expect(n.short).toBe(n.title);
    expect(n.hint).not.toContain('14:15');
    expect(n.detail).toContain('camera is off');
  });

  it('a pause that keeps the camera open says so instead of promising the camera is off', () => {
    const n = watchNote({ kind: 'paused', until: now + 15 * 60_000, releaseCamera: false }, now, clock)!;
    expect(n.detail).not.toContain('camera is off');
    expect(n.detail).toContain('camera stays on');
    expect(n.hint).not.toContain('Camera off');
  });

  it('has a two-line form for the 64 px mini window', () => {
    const p = watchNote({ kind: 'paused', until: now + 15 * 60_000, releaseCamera: true }, now, clock)!;
    expect(p.strip).toEqual({ status: 'Paused', detail: 'until 14:15' });
    const m = watchNote({ kind: 'meeting', until: now + 3_600_000 }, now, clock)!;
    expect(m.strip).toEqual({ status: 'Watching', detail: 'silent until 15:00' });
  });

  it('"until tomorrow" says tomorrow', () => {
    const n = watchNote({ kind: 'paused', until: new Date(2026, 9, 24, 6, 0).getTime(), releaseCamera: true }, now, clock)!;
    expect(n.title).toBe('Paused until tomorrow 6:00');
  });

  it('meeting mode says it is silent, still logs, and fits the mini window', () => {
    const n = watchNote({ kind: 'meeting', until: now + 3_600_000 }, now, clock)!;
    expect(n.title).toBe('Meeting mode until 15:00');
    expect(n.detail).toMatch(/silent/);
    expect(n.detail).toMatch(/logged/);
    expect(n.short.length).toBeLessThanOrEqual(24);
  });

  it('plain words: no medical claim, no picture of the habit', () => {
    for (const s of [{ kind: 'paused', until: now + 1, releaseCamera: true }, { kind: 'meeting', until: now + 1 }] as const) {
      const n = watchNote(s, now, clock)!;
      expect(JSON.stringify(n)).not.toMatch(/treat|cure|clinical|therapy|nail|bite|biting|hand|mouth/i);
    }
  });
});
