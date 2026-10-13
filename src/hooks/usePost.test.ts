import { describe, it, expect, vi } from 'vitest';
import { loadPost } from './usePost';

const post = (slug: string) => ({
  slug, title: 'T', description: 'D', tag: 'Health', readingMinutes: 3,
  datePublished: '2026-10-01', dateModified: '2026-10-01', related: [], productLink: null,
  sections: [{ heading: 'H', body: 'B' }],
});
const reply = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});

describe('loadPost', () => {
  it('returns the article for a 200 whose slug matches', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, post('a-post')));
    const r = await loadPost('a-post', f);
    expect(r.status).toBe('ok');
    expect(f).toHaveBeenCalledWith('/posts/a-post.json', { signal: undefined });
  });

  it('treats only an HTTP 404 as not found', async () => {
    expect((await loadPost('gone', vi.fn().mockResolvedValue(reply(404)))).status).toBe('notfound');
  });

  it('treats a 500 and a network failure as an error, not a missing article', async () => {
    expect((await loadPost('a', vi.fn().mockResolvedValue(reply(500)))).status).toBe('error');
    expect((await loadPost('a', vi.fn().mockRejectedValue(new TypeError('offline')))).status).toBe('error');
  });

  it('rejects a response for a different slug or a malformed body', async () => {
    expect((await loadPost('a', vi.fn().mockResolvedValue(reply(200, post('b'))))).status).toBe('error');
    expect((await loadPost('a', vi.fn().mockResolvedValue(reply(200, { slug: 'a' })))).status).toBe('error');
  });

  it('never requests a path for an invalid slug', async () => {
    const f = vi.fn();
    expect((await loadPost('../etc/passwd', f)).status).toBe('notfound');
    expect((await loadPost('Has-Caps', f)).status).toBe('notfound');
    expect(f).not.toHaveBeenCalled();
  });
});
