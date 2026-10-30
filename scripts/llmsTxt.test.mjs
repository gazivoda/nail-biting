// public/llms.txt is the one-page summary an AI assistant reads before it decides which of our pages to open.
// The file says of itself that every link carries the page's own description, so this pins that promise:
//
//   · each blog link's blurb is the post's whole meta description (blogPosts.ts), not its first sentence.
//     scripts/sync-seo.mjs used to cut at the first sentence, which left "Almost nobody bites mid-workout."
//     and a question with its answer cut off ("Can low iron, zinc or magnesium cause nail biting?");
//   · no blurb anywhere in the file is a fragment (under 9 words) or only a question;
//   · a blog entry names its topic, in the link title or the blurb.
//
// It reads the committed artifact rather than calling the generator (a side-effecting script), so a stale
// file fails here as well as in `npm run seo:check`. llms-full.txt is built, so its half only runs after
// `npm run build:web`, like the other tests that read dist/.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_POSTS } from '../src/data/blogPosts.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'https://stopbiting.today';
const MIN_WORDS = 9;

const wordCount = text => text.split(/\s+/).filter(Boolean).length;
// Every sentence ends in a question mark: a question the blurb never answers.
const onlyQuestion = text => text.trim().split(/(?<=[.!?])\s+/).every(sentence => sentence.endsWith('?'));
// The site's own subject. A link title or blurb that says none of this is about something else.
const TOPIC = /\b(?:nails?|fingernails?|bit(?:e|es|ing|ten|er|ers)?|onychophagia|dermatophagia|bfrbs?|body-focused|habits?)\b/i;
const namesTopic = text => TOPIC.test(text);

const llms = readFileSync(join(ROOT, 'public/llms.txt'), 'utf8');
const entries = [...llms.matchAll(/^- \[(.*)\]\((https:\/\/[^)\s]+)\): (.*)$/gm)]
  .map(([, title, url, blurb]) => ({ title, url, blurb }));
const byUrl = new Map(entries.map(entry => [entry.url, entry]));
const blogEntries = entries.filter(entry => entry.url.startsWith(`${ORIGIN}/blog/`));

describe('llms.txt blurbs', () => {
  it('parses the whole file: every link line is an entry with a blurb', () => {
    const linkLines = llms.split('\n').filter(line => line.startsWith('- ['));
    expect(entries.length).toBe(linkLines.length);
    expect(entries.length).toBeGreaterThan(BLOG_POSTS.length);
  });

  it('lists every blog post once, and nothing else under /blog/', () => {
    expect(blogEntries.length).toBe(BLOG_POSTS.length);
    expect(new Set(blogEntries.map(entry => entry.url)).size).toBe(BLOG_POSTS.length);
  });

  it('every blog blurb is the post\'s whole meta description, under its own title', () => {
    const wrong = BLOG_POSTS.flatMap(post => {
      const entry = byUrl.get(`${ORIGIN}/blog/${post.slug}`);
      if (!entry) return [`${post.slug}: no entry`];
      return entry.title === post.title && entry.blurb === post.description ? [] : [`${post.slug}: ${entry.blurb}`];
    });
    expect(wrong).toEqual([]);
  });

  it('no blurb in the file is a fragment of fewer than 9 words', () => {
    const fragments = entries.filter(entry => wordCount(entry.blurb) < MIN_WORDS).map(entry => `${entry.url}: ${entry.blurb}`);
    expect(fragments).toEqual([]);
  });

  it('no blurb in the file is only a question', () => {
    const questions = entries.filter(entry => onlyQuestion(entry.blurb)).map(entry => `${entry.url}: ${entry.blurb}`);
    expect(questions).toEqual([]);
  });

  it('every blog entry names the topic, in its link title or its blurb', () => {
    const offTopic = blogEntries.filter(entry => !namesTopic(`${entry.title} ${entry.blurb}`)).map(entry => entry.url);
    expect(offTopic).toEqual([]);
  });

  // A check that cannot fail proves nothing: these are the blurbs the old first-sentence cut produced.
  it('the checks above do fail on the old fragments', () => {
    expect(wordCount('Almost nobody bites mid-workout.')).toBeLessThan(MIN_WORDS);
    expect(wordCount('Stress is the weakest-evidenced part of this.')).toBeLessThan(MIN_WORDS);
    expect(onlyQuestion('Can low iron, zinc or magnesium cause nail biting?')).toBe(true);
    expect(onlyQuestion('Can low iron cause nail biting? What the cited studies do and do not establish.')).toBe(false);
    expect(namesTopic('Stress is the weakest-evidenced part of this.')).toBe(false);
    expect(namesTopic('Why nail biting feels calming')).toBe(true);
  });
});

const fullTxt = join(ROOT, 'dist/llms-full.txt');
describe.skipIf(!existsSync(fullTxt))('llms-full.txt (built)', () => {
  it('opens every post with its whole description, not a first sentence', () => {
    const full = readFileSync(fullTxt, 'utf8');
    const missing = BLOG_POSTS.filter(post => !full.includes(`URL: ${ORIGIN}/blog/${post.slug}\n`)
      || !full.includes(`\n\n${post.description}\n\n`)).map(post => post.slug);
    expect(missing).toEqual([]);
  });
});
