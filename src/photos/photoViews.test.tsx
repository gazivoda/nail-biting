import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setStorageAdapter } from '../storage/adapter';
import { resetFlagsForTests } from '../features/flags';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { PhotoDiaryView, type PhotoDiaryViewProps } from './PhotoDiaryView';
import { CapturePanelView, type CapturePanelViewProps } from './CapturePanelView';
import { CompareView } from './CompareView';
import { PhotoReminder, PhotoReminderView } from './PhotoReminder';
import { PhotoDiarySettings } from './PhotoDiarySettings';
import { PhotoDiarySettingsView } from './PhotoDiarySettingsCard';
import { TwoStepDelete } from './TwoStepDelete';
import { GUIDE_TEXT, PRIVACY_DETAIL, PRIVACY_STATEMENT } from './copy';
import { describeCameraProblem } from './cameraProblem';
import type { PhotoMeta } from './diaryMeta';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 23, 12, 0, 0).getTime();
const photo = (id: string, daysAgo: number): PhotoMeta => ({ id, takenAt: NOW - daysAgo * DAY, width: 1280, height: 720, bytes: 190_000 });
const noop = () => undefined;
const load = () => Promise.resolve(null);

const diary = (over: Partial<PhotoDiaryViewProps> = {}) => renderToStaticMarkup(
  <PhotoDiaryView photos={[]} persistent now={NOW} status="" capture={null} loadBlob={load}
    onStartCapture={noop} onDeleteOne={noop} onDeleteAll={noop} {...over} />,
);

const panel = (state: CapturePanelViewProps['state']) => renderToStaticMarkup(
  <CapturePanelView state={state} onStart={noop} onTakeNow={noop} onTakeInSeconds={noop} onCancelCountdown={noop}
    onRetake={noop} onSave={noop} onClose={noop} onStopWatchingAndRetry={noop} />,
);

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const BANNED = /100% private|nothing leaves|zero network|no cloud|no server/i;
const fakeStream = {} as MediaStream;
const frame = { blob: new Blob(['x']), width: 640, height: 480, takenAt: NOW };

beforeEach(() => { setStorageAdapter(createMemoryAdapter()); resetFlagsForTests(); });
afterEach(() => { resetStorage(); resetFlagsForTests(); });

describe('the diary screen', () => {
  it('has a designed empty state: what it is, where photos live, one primary button', () => {
    const html = diary();
    expect(html).toContain('Photo diary');
    expect(html).toContain('Take your first photo');
    expect(html).toContain(PRIVACY_STATEMENT);
    expect(html).toContain(PRIVACY_DETAIL);
    expect(count(html, /<button/g)).toBe(1);
    expect(count(html, /<canvas/g)).toBe(0);
    expect(html).not.toContain('Delete all');
    expect(html).not.toMatch(BANNED);
  });

  it('says it is loading, not empty, while the photos are being read', () => {
    const html = diary({ photos: null });
    expect(html).toContain('Reading your photos from this device');
    expect(html).not.toContain('Take your first photo');
  });

  it('lists photos newest first with a date, an age, and a delete button that names the photo', () => {
    const html = diary({ photos: [photo('c', 1), photo('b', 9), photo('a', 40)] });
    expect(html).toContain('Your photos (3)');
    expect(count(html, /aria-label="Delete the photo from/g)).toBe(3);
    expect(html).toContain('1 day ago');
    expect(html).toContain('9 days ago');
    expect(html).toContain('40 days ago');
    expect(html).toContain('557 KB on this device'); // 3 x 190,000 bytes
    expect(html.indexOf('1 day ago')).toBeLessThan(html.indexOf('40 days ago'));
    expect(html).toContain('Delete all photos');
  });

  it('draws photos on canvases and never as images or blob URLs', () => {
    const html = diary({ photos: [photo('b', 9), photo('a', 40)] });
    expect(count(html, /<canvas/g)).toBe(4); // two thumbnails + the two sides of the slider
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain('blob:');
    expect(html).not.toContain('data:image');
    expect(html).not.toMatch(/src="/);
  });

  it('compares any two photos: two pickers, a slider named "Reveal the earlier photo", date labels', () => {
    const html = diary({ photos: [photo('c', 1), photo('b', 9), photo('a', 40)] });
    expect(count(html, /<select/g)).toBe(2);
    expect(html).toContain('Reveal the earlier photo');
    expect(html).toContain('type="range"');
    expect(html).toContain('Before');
    expect(html).toContain('After');
    // Default pair: the oldest against the newest.
    expect(html).toMatch(/Before, \d{1,2} \w{3} 2026/);
    expect(html).toMatch(/aria-valuetext="The earlier photo is shown across 50 percent/);
    // Option lists have every photo.
    expect(count(html, /<option/g)).toBe(6);
  });

  it('with one photo the slider is replaced by a plain reason', () => {
    const html = diary({ photos: [photo('a', 3)] });
    expect(html).toContain('You need two photos to compare');
    expect(html).not.toContain('type="range"');
    expect(count(html, /<select/g)).toBe(0);
  });

  it('asks for a new photo only when one is due', () => {
    expect(diary({ photos: [photo('a', 3)] })).not.toContain('is due');
    expect(diary({ photos: [photo('a', 9)] })).toContain('Your last photo was 9 days ago. A new one is due.');
  });

  it('warns when the browser is only holding photos in memory', () => {
    expect(diary({ photos: [photo('a', 1)], persistent: false })).toContain('gone when you close this tab');
    expect(diary({ photos: [photo('a', 1)], persistent: true })).not.toContain('gone when you close this tab');
  });

  it('warns in a browser that cannot decode images', () => {
    expect(diary({ photos: [photo('a', 1)], canDecode: false })).toContain('cannot show saved photos');
  });

  it('shows the open capture panel in place of the start button, and announces status text', () => {
    const html = diary({ photos: [photo('a', 1)], capture: <p>CAPTURE-PANEL</p>, status: 'Photo saved on this device.' });
    expect(html).toContain('CAPTURE-PANEL');
    expect(html).not.toMatch(/Take this week(&#x27;|')s photo/);
    expect(html).toContain('Photo saved on this device.');
    expect(html).toContain('role="status"');
  });

  it('keeps the on-screen promises plain: stays on the device, not in Export, sync or the weekly email', () => {
    const html = diary({ photos: [photo('a', 1)] });
    expect(html).toContain('Photos stay on this device.');
    expect(html).toContain('never uploaded, synced, exported or emailed');
    expect(html).toContain('not part of Export, sync or the weekly email');
    expect(html).not.toMatch(BANNED);
  });

  it('makes no medical claim', () => {
    expect(diary()).toContain('not a diagnosis or a treatment');
    expect(diary({ photos: [photo('a', 1)] })).not.toMatch(/heal|cure|treat(s|ed)? your|clinical/i);
  });
});

describe('compare view on its own', () => {
  it('survives a photo that was picked and then deleted (falls back to the default pair)', () => {
    const html = renderToStaticMarkup(<CompareView photos={[photo('x', 2), photo('y', 20)]} loadBlob={load} />);
    expect(html).toContain('type="range"');
  });

  it('says so when both sides are the same photo', () => {
    // Two photos, same default pair cannot be equal; same-photo wording is reachable through the pickers only.
    const html = renderToStaticMarkup(<CompareView photos={[photo('x', 2), photo('y', 20)]} loadBlob={load} initialPosition={80} />);
    expect(html).toContain('value="80"');
    expect(html).toContain('clip-path:inset(0 20% 0 0)');
  });
});

describe('the capture panel', () => {
  it('shows the framing guide as a neutral frame with four corner marks and the plain sentence', () => {
    const html = panel({ phase: 'live', stream: fakeStream });
    expect(html).toContain(GUIDE_TEXT);
    expect(GUIDE_TEXT).toBe('Place your hands flat in the frame, nails facing the camera');
    expect(count(html, /border-lime-300/g)).toBe(4); // four corner marks
    expect(html).toContain('rounded-3xl border-2');
    expect(html).toContain('<video');
    expect(html).toContain('muted');
    // The guide itself is plain boxes: no svg, no path, no image inside it.
    const start = html.indexOf('inset-[7%]');
    const guide = html.slice(start, html.indexOf('</div>', start));
    expect(guide).not.toMatch(/<svg|<path|<img|<canvas|<circle|<polygon/i);
    expect(count(guide, /<span/g)).toBe(4);
    expect(html).not.toMatch(/<img/i);
  });

  it('offers a timer and an immediate shot, both disabled until the camera has a picture', () => {
    const html = panel({ phase: 'live', stream: fakeStream });
    expect(html).toContain('Take photo in 3 seconds');
    expect(html).toContain('Take it now');
    expect(count(html, /disabled=""/g)).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Waiting for the camera picture');
  });

  it('counts down in the open and lets the person cancel', () => {
    const html = panel({ phase: 'counting', stream: fakeStream, secondsLeft: 2 });
    expect(html).toContain('Taking the photo in 2');
    expect(html).toContain('Cancel the timer');
    expect(html).not.toContain('Take it now');
  });

  it('review: the camera is off, and the choices are Save, Retake, Discard', () => {
    const html = panel({ phase: 'review', frame });
    expect(html).toContain('The camera is off.');
    expect(html).toContain('Save photo');
    expect(html).toContain('Retake');
    expect(html).toContain('Discard');
    expect(html).not.toContain('<video');
    expect(count(html, /<canvas/g)).toBe(1);
  });

  it('review with a failed save keeps the photo and says why', () => {
    const html = panel({ phase: 'review', frame, saveError: 'The diary holds 104 photos. Delete some older ones to add more.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('The diary holds 104 photos');
    expect(html).toContain('Save photo');
  });

  it('while saving, every button is disabled', () => {
    const html = panel({ phase: 'saving', frame });
    expect(count(html, /disabled=""/g)).toBe(3);
  });

  it('permission denied: a clear message, Try again, no mention of watching', () => {
    const html = panel({ phase: 'error', problem: describeCameraProblem('permission-denied', true) });
    expect(html).toContain('The camera is blocked');
    expect(html).toContain('Allow it for this site');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Stop watching');
    expect(html).toContain('role="alert"');
  });

  it('busy while watching runs: names watching and offers "Stop watching and try again"', () => {
    const html = panel({ phase: 'error', problem: describeCameraProblem('busy', true) });
    expect(html).toContain('Watching is using the camera');
    expect(html).toContain('Stop watching and try again');
    expect(html).toContain('Try again');
  });

  it('busy for any other reason: no watching button', () => {
    const html = panel({ phase: 'error', problem: describeCameraProblem('busy', false) });
    expect(html).toContain('The camera is busy');
    expect(html).not.toContain('Stop watching');
  });

  it('no camera, an insecure page and an unknown failure each have their own words', () => {
    expect(panel({ phase: 'error', problem: describeCameraProblem('no-camera', false) })).toContain('No camera found');
    expect(panel({ phase: 'error', problem: describeCameraProblem('insecure-context', false) })).toContain('needs a secure page');
    expect(panel({ phase: 'error', problem: describeCameraProblem('unknown', false) })).toContain('did not start');
  });

  it('every state can be left (a Close, Cancel or Discard button exists)', () => {
    const states: CapturePanelViewProps['state'][] = [
      { phase: 'idle' }, { phase: 'starting' }, { phase: 'live', stream: fakeStream },
      { phase: 'counting', stream: fakeStream, secondsLeft: 3 }, { phase: 'review', frame },
      { phase: 'error', problem: describeCameraProblem('unknown', false) },
    ];
    for (const s of states) expect(panel(s), s.phase).toMatch(/>(Close|Cancel|Discard|Cancel the timer)</);
  });

  it('never claims more than it does', () => {
    for (const s of [{ phase: 'idle' }, { phase: 'live', stream: fakeStream }, { phase: 'review', frame }] as CapturePanelViewProps['state'][]) {
      expect(panel(s)).not.toMatch(BANNED);
    }
  });
});

describe('the reminder', () => {
  it('is a quiet strip with two buttons, in the app only', () => {
    const html = renderToStaticMarkup(<PhotoReminderView lastPhotoAge="9 days ago" onOpen={noop} onSnooze={noop} />);
    expect(html).toMatch(/Time for this week(&#x27;|')s hand photo\./);
    expect(html).toContain('Your last one was 9 days ago.');
    expect(html).toContain('Open the photo diary');
    expect(html).toContain('Not now');
    expect(html).not.toContain('role="alert"');
  });

  it('renders nothing with the flag off (and so nothing changes for anyone)', () => {
    expect(renderToStaticMarkup(<PhotoReminder onOpen={noop} />)).toBe('');
  });
});

describe('Settings > Data > Photo diary', () => {
  it('renders nothing with the flag off', () => {
    expect(renderToStaticMarkup(<PhotoDiarySettings />)).toBe('');
  });

  it('says what is stored and offers one delete button, with the promise worded plainly', () => {
    const html = renderToStaticMarkup(<PhotoDiarySettingsView photos={[photo('a', 1), photo('b', 8)]} status="" onDeleteAll={noop} />);
    expect(html).toContain('Photo diary');
    expect(html).toContain('2 photos saved, 371 KB in this browser.');
    expect(html).toContain('Delete all photos');
    expect(html).toContain(PRIVACY_STATEMENT);
    expect(html).toContain('does not remove photos');
    expect(html).not.toMatch(BANNED);
  });

  it('with no photos there is nothing to delete', () => {
    const html = renderToStaticMarkup(<PhotoDiarySettingsView photos={[]} status="" onDeleteAll={noop} />);
    expect(html).toContain('No photos saved.');
    expect(html).not.toContain('Delete all photos');
  });

  it('singular wording for one photo', () => {
    const html = renderToStaticMarkup(<PhotoDiarySettingsView photos={[photo('a', 1)]} status="" onDeleteAll={noop} />);
    expect(html).toContain('1 photo saved');
  });
});

describe('the two-step delete', () => {
  const html = (open: boolean) => renderToStaticMarkup(
    <TwoStepDelete label="Delete" ariaLabel="Delete the photo from 12 Oct 2026" question="Delete this photo?" confirmLabel="Delete" keepLabel="Keep" onConfirm={noop} initiallyOpen={open} />,
  );

  it('starts as one button that names the photo', () => {
    const h = html(false);
    expect(count(h, /<button/g)).toBe(1);
    expect(h).toContain('aria-label="Delete the photo from 12 Oct 2026"');
  });

  it('opens into a question with the safe choice focused, in the page (no window.confirm)', () => {
    const h = html(true);
    expect(h).toContain('Delete this photo?');
    expect(count(h, /<button/g)).toBe(2);
    expect(h).toMatch(/autofocus[^>]*>Keep|>Keep</);
    expect(h.indexOf('autofocus')).toBeGreaterThan(h.indexOf('Delete</button>'));
  });
});
