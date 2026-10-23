import { describe, expect, it, vi } from 'vitest';
import { SHARE_LINKS_PATH, createLink, listLinks, parseLink, revokeLink, type ShareRequest } from './api';
import { copyText } from './clipboard';
import {
  EXPIRY_OPTIONS, INTRO, SYNC_NEEDED, daysLeft, describeExpiry, describeViewed, failureText, previewFor,
} from './copy';

const link = { id: 'l1', label: 'for Friday', createdAt: 1, expiresAt: null, lastViewedAt: null, detailed: false };

const reply = (status: number, body: unknown): ShareRequest => vi.fn(async () => ({ status, body }));

describe('api', () => {
  it('lists links and checks the shape of the answer', async () => {
    const r = await listLinks(reply(200, { links: [link], max: 5, syncedEntries: 12 }));
    expect(r).toEqual({ ok: true, value: { links: [link], max: 5, syncedEntries: 12 } });
  });

  it('refuses an answer that is not the documented shape (and reports it as a bad gateway, never as success)', async () => {
    for (const body of [null, {}, { links: 'x', max: 5, syncedEntries: 0 }, { links: [{ id: 5 }], max: 5, syncedEntries: 0 }, { links: [], max: '5', syncedEntries: 0 }]) {
      expect(await listLinks(reply(200, body))).toEqual({ ok: false, status: 502 });
    }
  });

  it('reports the status of a failed request, and 0 when there was no answer', async () => {
    expect(await listLinks(reply(401, null))).toEqual({ ok: false, status: 401 });
    expect(await listLinks(async () => { throw new Error('offline'); })).toEqual({ ok: false, status: 0 });
  });

  it('creates a link with exactly the four allowed fields and returns the token and url', async () => {
    const request = vi.fn(async () => ({ status: 200, body: { ...link, token: 'T'.repeat(43), url: 'https://x/share/T' } }));
    const r = await createLink(request, { label: 'for Friday', expiresInDays: 30, detailed: false, timezone: 'Europe/Belgrade' });
    expect(request).toHaveBeenCalledWith('POST', SHARE_LINKS_PATH, { label: 'for Friday', expiresInDays: 30, detailed: false, timezone: 'Europe/Belgrade' });
    expect(r.ok && r.value.url).toBe('https://x/share/T');
  });

  it('does not treat a created answer without a token as success', async () => {
    expect(await createLink(reply(200, link), { label: '', expiresInDays: null, detailed: false, timezone: 'UTC' })).toEqual({ ok: false, status: 502 });
  });

  it('revokes by id, encoded', async () => {
    const request = vi.fn(async () => ({ status: 200, body: { ok: true } }));
    expect(await revokeLink(request, 'a/b c')).toEqual({ ok: true, value: true });
    expect(request).toHaveBeenCalledWith('DELETE', `${SHARE_LINKS_PATH}/a%2Fb%20c`, undefined);
    expect(await revokeLink(reply(404, null), 'x')).toEqual({ ok: false, status: 404 });
  });

  it('parseLink rejects wrong types', () => {
    expect(parseLink(link)).toEqual(link);
    expect(parseLink({ ...link, detailed: 'no' })).toBeNull();
    expect(parseLink({ ...link, expiresAt: 'soon' })).toBeNull();
    expect(parseLink(null)).toBeNull();
  });
});

describe('copy', () => {
  it('previews exactly what a link shows, and what it never shows', () => {
    const narrow = previewFor(false);
    const wide = previewFor(true);
    expect(narrow.shows.join(' ')).not.toMatch(/calendar|time-of-day/i);
    expect(wide.shows.join(' ')).toMatch(/calendar dates/i);
    expect(wide.shows.join(' ')).toMatch(/time-of-day/i);
    expect(wide.shows.length).toBe(narrow.shows.length + 2);
    for (const p of [narrow, wide]) {
      expect(p.never.join(' ')).toMatch(/name, email/);
      expect(p.never.join(' ')).toMatch(/Photos/);
      expect(p.never.join(' ')).toMatch(/single entry/);
    }
  });

  it('offers 7, 30, 90 days and no expiry', () => {
    expect(EXPIRY_OPTIONS.map(o => o.value)).toEqual([7, 30, 90, null]);
  });

  it('describes expiry, last opened and days left in plain words', () => {
    const now = new Date(2026, 9, 21, 12, 0).getTime();
    expect(describeExpiry(null, now)).toBe('No expiry');
    expect(describeExpiry(now - 1, now)).toBe('Expired');
    expect(describeExpiry(new Date(2026, 10, 20).getTime(), now)).toBe('Expires 20 Nov 2026');
    expect(describeViewed(null)).toBe('Not opened yet');
    expect(describeViewed(new Date(2026, 9, 21, 14, 5).getTime())).toBe('Last opened 21 Oct 2026, 14:05');
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft(now + 86400000 * 2 - 1, now)).toBe(2);
    expect(daysLeft(now - 5, now)).toBe(0);
  });

  it('turns every failure into a plain sentence with no server text', () => {
    for (const status of [0, 400, 401, 404, 409, 429, 500, 502]) {
      for (const action of ['load', 'create', 'revoke'] as const) {
        const t = failureText(status, action);
        expect(t.length).toBeGreaterThan(10);
        expect(t).not.toMatch(/undefined|\[object|API error/);
      }
    }
    expect(failureText(409, 'create')).toMatch(/limit/);
  });

  it('keeps medical claims and the retired privacy wording out of the card text', () => {
    const all = [INTRO, SYNC_NEEDED, ...previewFor(true).shows, ...previewFor(true).never].join(' ');
    expect(all).toMatch(/not a clinician/);
    expect(all).not.toMatch(/\b(cures?|heals?|treats|treatment for|clinically proven|therapy works)\b/i);
    expect(all).not.toMatch(/100% private|no cloud|nothing leaves|zero network/i);
    expect(all).not.toMatch(/[–—]/); // no en or em dash
  });
});

describe('copyText', () => {
  it('uses the clipboard API when it works', async () => {
    const writeText = vi.fn(async () => {});
    const legacyCopy = vi.fn(() => true);
    expect(await copyText('x', { writeText, legacyCopy })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it('falls back to the legacy command when the API refuses', async () => {
    const legacyCopy = vi.fn(() => true);
    expect(await copyText('x', { writeText: async () => { throw new Error('denied'); }, legacyCopy })).toBe(true);
    expect(legacyCopy).toHaveBeenCalled();
  });

  it('falls back when there is no API at all, and says false when nothing works', async () => {
    expect(await copyText('x', { legacyCopy: () => true })).toBe(true);
    expect(await copyText('x', { legacyCopy: () => false })).toBe(false);
    expect(await copyText('x', { legacyCopy: () => { throw new Error('no'); } })).toBe(false);
    expect(await copyText('x', {})).toBe(false);
  });
});
