// Pseudo-locale coverage for the photo diary (scope "photos"). Every screen and state of src/photos is rendered
// with the German catalog on and every t() result marked; nothing may be left outside the marks (see
// src/i18n/testing/pseudo.ts). The English wording itself is pinned by src/photos/*.test.* and
// scripts/photoGuard.test.mjs; this file proves that no English is left in the code and that each language says it.
//
// Rendered here: the diary (empty, loading, with photos of every age, not saved to disk, cannot decode, status,
// capture panel open), the before/after view, every phase of the capture panel (each camera problem included), the
// delete confirmation, the reminder strip, the Settings > Data card, and the wired panel and diary in their first state.
// The text helpers (camera problems, capture controller messages, store failures, ages, sizes) are called directly.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams, setFlags } from '../testing/pseudo';
import { formatToParts } from '../message';
import { messages, t } from '../scopes/photos';
import { messages as de } from '../locales/de/photos';
import { messages as es } from '../locales/es/photos';
import { messages as ptBR } from '../locales/pt-BR/photos';
import { PhotoDiary } from '../../photos/PhotoDiary';
import { PhotoDiaryView, type PhotoDiaryViewProps } from '../../photos/PhotoDiaryView';
import { CompareView } from '../../photos/CompareView';
import { CapturePanel } from '../../photos/CapturePanel';
import { CapturePanelView, type CapturePanelViewProps } from '../../photos/CapturePanelView';
import { TwoStepDelete } from '../../photos/TwoStepDelete';
import { PhotoReminder, PhotoReminderView } from '../../photos/PhotoReminder';
import { PhotoDiarySettingsCard, PhotoDiarySettingsView } from '../../photos/PhotoDiarySettingsCard';
import { classifyCameraError, describeCameraProblem, problemFromError, type CameraProblemKind } from '../../photos/cameraProblem';
import { createCaptureController, type CapturePorts, type CaptureStreamLike } from '../../photos/captureController';
import { createPhotoStore } from '../../photos/photoStore';
import { kvMetaPort } from '../../photos/metaKv';
import { MAX_PHOTOS, describeAge, formatBytes, parseMeta, serializeMeta, type PhotoMeta } from '../../photos/diaryMeta';
import { GUIDE_TEXT, INTRO, NOT_MEDICAL, NOT_SAVED_WARNING, PRIVACY_DETAIL, PRIVACY_STATEMENT } from '../../photos/copy';
import { createMemoryBlobStore } from '../../storage/blobs';

export const COVERS = [
  'src/photos/PhotoDiary.tsx',
  'src/photos/PhotoDiaryView.tsx',
  'src/photos/CompareView.tsx',
  'src/photos/CapturePanel.tsx',
  'src/photos/CapturePanelView.tsx',
  'src/photos/TwoStepDelete.tsx',
  'src/photos/PhotoReminder.tsx',
  'src/photos/PhotoDiarySettingsCard.tsx',
  'src/photos/cameraProblem.ts',
  'src/photos/captureController.ts',
  'src/photos/photoStore.ts',
  'src/photos/diaryMeta.ts',
  'src/photos/copy.ts',
];
// (src/photos/PhotoDiarySettings.tsx only decides whether the card shows, by the photo_diary flag, and holds no text of its own;
// the card's text is rendered below through PhotoDiarySettingsView and PhotoDiarySettingsCard.)

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 23, 12, 0, 0).getTime();
const photo = (id: string, daysAgo: number, bytes = 190_000): PhotoMeta => ({ id, takenAt: NOW - daysAgo * DAY, width: 1280, height: 720, bytes });
const noop = () => undefined;
const load = () => Promise.resolve(null);
const fakeStream = {} as MediaStream;
const frame = { blob: new Blob(['x']), width: 640, height: 480, takenAt: NOW };
/** The state machine here runs on fake streams; the view only needs the shape. */
const asPanelState = (s: unknown) => s as CapturePanelViewProps['state'];

/** Every HTML string rendered in this file, for the "each message is shown somewhere" check at the end. */
const rendered: string[] = [];

/** File sizes are written with the units KB and MB in every language; they are not words to translate. */
const UNITS = ['KB', 'MB'];

/** Renders, records, and asserts that all words came out of t(). */
function check(node: ReactElement, allow: Array<string | RegExp> = []): string {
  const html = renderToStaticMarkup(node);
  rendered.push(html);
  expectAllTranslated(html, { allow: [...UNITS, ...allow] });
  expectNoMissingParams(html);
  return html;
}

const diary = (over: Partial<PhotoDiaryViewProps> = {}) => (
  <PhotoDiaryView photos={[]} persistent now={NOW} status="" capture={null} loadBlob={load}
    onStartCapture={noop} onDeleteOne={noop} onDeleteAll={noop} {...over} />
);

const panel = (state: CapturePanelViewProps['state']) => (
  <CapturePanelView state={state} onStart={noop} onTakeNow={noop} onTakeInSeconds={noop} onCancelCountdown={noop}
    onRetake={noop} onSave={noop} onClose={noop} onStopWatchingAndRetry={noop} />
);

describe('photo diary screen, pseudo-locale', () => {
  usePseudoLocale({ flags: ['photo_diary'] });

  it('empty diary: what it is, where photos live, one primary button', () => {
    const html = check(diary());
    expect(html).toContain(t('diary.takeFirst'));
    expect(html).toContain(`${t('diary.privacy.statement')} ${t('diary.privacy.detail')}`);
  });

  it('loading (photos still being read)', () => {
    check(diary({ photos: null }));
  });

  it('with photos of every age: today, yesterday, a week, long ago; a new photo is due', () => {
    const photos = [photo('d', 0), photo('c', 1), photo('b', 9), photo('a', 40)];
    check(diary({ photos }));
    check(diary({ photos: [photo('a', 9)] })); // the "A new one is due" line
    check(diary({ photos: [photo('a', 3)] })); // not due
  });

  it('one photo (the before/after view explains it needs two)', () => {
    check(diary({ photos: [photo('a', 3)] }));
  });

  it('browser holds photos in memory only, and cannot decode images', () => {
    check(diary({ photos: [photo('a', 1)], persistent: false, canDecode: false }));
  });

  it('shows the status text, and the open capture panel in place of the start button', () => {
    check(diary({
      photos: [photo('a', 1)],
      status: t('status.saved'),
      capture: panel({ phase: 'idle' }),
    }));
    for (const status of [t('status.savedTabOnly'), t('status.deleted'), t('status.deletedAll', { count: 3 })]) check(diary({ photos: [photo('a', 1)], status }));
    check(diary({ photos: [], capture: panel({ phase: 'starting' }) }));
  });

  it('delete confirmations for a photo and for all photos', () => {
    check(
      <TwoStepDelete label={t('diary.deleteAll')} question={t('diary.deleteAll.question', { count: 3 })}
        confirmLabel={t('diary.deleteAll.confirm')} keepLabel={t('diary.deleteAll.keep')} onConfirm={noop} initiallyOpen />,
    );
    check(
      <TwoStepDelete compact label={t('diary.deleteAll')} ariaLabel={t('diary.deleteOne.aria', { date: '23. Okt. 2026' })}
        question={t('diary.deleteOne.question')} confirmLabel={t('diary.deleteAll.confirm')} keepLabel={t('diary.keep')} onConfirm={noop} />,
    );
    // plural forms of the "delete all" question: one photo and many
    for (const count of [1, 2, 104]) expect(t('diary.deleteAll.question', { count })).toContain('⟦');
  });

  it('the wired diary renders its first state (reading the photos)', () => {
    const html = check(<PhotoDiary />);
    expect(html).toContain('photo-diary-title');
  });
});

describe('before and after, pseudo-locale', () => {
  usePseudoLocale();

  it('needs two photos', () => {
    check(<CompareView photos={[photo('a', 3)]} loadBlob={load} />);
  });

  it('two photos, three photos, a moved slider', () => {
    check(<CompareView photos={[photo('x', 2), photo('y', 20)]} loadBlob={load} />);
    check(<CompareView photos={[photo('c', 1), photo('b', 9), photo('a', 40)]} loadBlob={load} initialPosition={80} />);
  });

  it('both sides the same photo (reachable through the pickers; here by giving two records one id)', () => {
    const twin = photo('same', 5);
    check(<CompareView photos={[twin, { ...twin }]} loadBlob={load} />);
  });
});

describe('capture panel, pseudo-locale', () => {
  usePseudoLocale();

  it('idle, with the default sentence and with a notice the controller made', () => {
    check(panel({ phase: 'idle' }));
    check(panel({ phase: 'idle', notice: t('capture.hiddenNotice') }));
  });

  it('starting', () => {
    check(panel({ phase: 'starting' }));
  });

  it('live (waiting for the picture), with the hint after a press with no picture yet, counting down', () => {
    const live = check(panel({ phase: 'live', stream: fakeStream }));
    expect(live).toContain('<video');
    check(panel({ phase: 'live', stream: fakeStream, hint: t('capture.notReady') }));
    for (const secondsLeft of [3, 2, 1]) check(panel({ phase: 'counting', stream: fakeStream, secondsLeft }));
  });

  it('review, review with a failed save, saving, saved', () => {
    check(panel({ phase: 'review', frame }));
    check(panel({ phase: 'review', frame, saveError: t('store.full', { max: MAX_PHOTOS }) }));
    check(panel({ phase: 'saving', frame }));
    check(panel({ phase: 'saved', photo: photo('a', 0), persisted: true }));
  });

  it('each camera problem, watching or not', () => {
    const kinds: CameraProblemKind[] = ['permission-denied', 'no-camera', 'busy', 'insecure-context', 'unknown'];
    for (const kind of kinds) {
      for (const watching of [false, true]) {
        const html = check(panel({ phase: 'error', problem: describeCameraProblem(kind, watching) }));
        expect(html.includes('photo-capture-title')).toBe(true);
      }
    }
  });

  it('the wired panel renders its first state', () => {
    check(<CapturePanel onClose={noop} onSaved={noop} />);
  });
});

describe('capture text made by the state machine and the store, pseudo-locale', () => {
  usePseudoLocale();

  interface Fake extends CaptureStreamLike { tracks: Array<{ stop(): void }> }
  const fakeCamera = (): Fake => ({ tracks: [{ stop: noop }], getTracks() { return this.tracks; } });
  const ports = (over: Partial<CapturePorts<Fake, string>> = {}): CapturePorts<Fake, string> => ({
    openCamera: async () => fakeCamera(),
    encode: async () => ({ blob: new Blob(['x']), width: 4, height: 3 }),
    save: async () => ({ ok: true, photo: photo('a', 0), persisted: true }),
    now: () => NOW,
    setTimer: () => 0,
    clearTimer: noop,
    isWatching: () => false,
    ...over,
  });

  it('a page without a camera API is an insecure-page problem', async () => {
    const c = createCaptureController<Fake, string>(ports({ openCamera: undefined }));
    await c.start();
    const s = c.getState();
    expect(s.phase).toBe('error');
    if (s.phase === 'error') check(panel({ phase: 'error', problem: s.problem }));
  });

  it('the browser refusing the camera, with and without watching', async () => {
    for (const [name, watching] of [['NotAllowedError', false], ['NotFoundError', false], ['NotReadableError', true], ['NotReadableError', false], ['Weird', false]] as const) {
      const c = createCaptureController(ports({
        openCamera: () => Promise.reject(Object.assign(new Error(name), { name })),
        isWatching: () => watching,
      }));
      await c.start();
      const s = c.getState();
      expect(s.phase).toBe('error');
      if (s.phase === 'error') {
        check(panel({ phase: 'error', problem: s.problem }));
        expect(problemFromError(Object.assign(new Error(name), { name }), watching).kind).toBe(classifyCameraError({ name }));
      }
    }
  });

  it('pressing the button before the camera shows a picture keeps the preview and says so', async () => {
    const c = createCaptureController(ports({ encode: () => Promise.reject(new Error('no frame')) }));
    await c.start();
    await c.takeNow('video');
    const s = c.getState();
    expect(s.phase).toBe('live');
    if (s.phase === 'live') check(panel(asPanelState(s)));
  });

  it('a camera that vanished: the photo could not be taken', async () => {
    // an openCamera that resolves to nothing leaves the controller without a stream, so a failed encode reaches the error branch
    const c = createCaptureController(ports({ openCamera: async () => null as unknown as Fake, encode: () => Promise.reject(new Error('no frame')) }));
    await c.start();
    await c.takeNow('video');
    const s = c.getState();
    expect(s.phase).toBe('error');
    if (s.phase === 'error') check(panel({ phase: 'error', problem: s.problem }));
  });

  it('a save that throws, a full diary, a browser that will not write', async () => {
    const c = createCaptureController(ports({ save: () => Promise.reject(new Error('disk')) }));
    await c.start();
    await c.takeNow('video');
    await c.save();
    const s = c.getState();
    expect(s.phase).toBe('review');
    if (s.phase === 'review') check(panel(asPanelState(s)));

    const full = createPhotoStore({
      blobs: createMemoryBlobStore(),
      meta: { read: () => parseMeta(serializeMeta(Array.from({ length: MAX_PHOTOS }, (_, i) => photo(`p${i}`, i)))), write: () => true, subscribe: () => noop },
      now: () => NOW, newId: () => 'new', isPersistent: () => true,
    });
    const r1 = await full.add({ blob: new Blob(['x']), width: 4, height: 3 });
    expect(r1.ok).toBe(false);
    if (!r1.ok) check(panel({ phase: 'review', frame, saveError: r1.message }));

    const broken = createPhotoStore({
      blobs: { ...createMemoryBlobStore(), put: async () => false },
      meta: { read: () => [], write: () => true, subscribe: () => noop },
      now: () => NOW, newId: () => 'new', isPersistent: () => true,
    });
    const r2 = await broken.add({ blob: new Blob(['x']), width: 4, height: 3 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) check(panel({ phase: 'review', frame, saveError: r2.message }));
  });

  it('ages and sizes are said in the language', () => {
    const ages = [0, 1, 2, 9, 40].map(d => describeAge(NOW - d * DAY, NOW));
    check(<ul>{ages.map(a => <li key={a}>{a}</li>)}</ul>);
    const sizes = [0, 1, 180 * 1024, 1024 * 1024 - 1, 2.4 * 1024 * 1024].map(formatBytes);
    check(<ul>{sizes.map(s => <li key={s}>{s}</li>)}</ul>);
    expect(sizes[4]).toContain('2,4'); // a decimal comma in German
  });

  it('the fixed paragraphs of copy.ts are the English of the scope, and the guide sentence matches', () => {
    expect(GUIDE_TEXT).toBe(messages['capture.guide']);
    expect(PRIVACY_STATEMENT).toBe(messages['diary.privacy.statement']);
    expect(PRIVACY_DETAIL).toBe(messages['diary.privacy.detail']);
    expect(NOT_SAVED_WARNING).toBe(messages['diary.notSaved']);
    expect(INTRO).toBe(messages['diary.intro']);
    expect(NOT_MEDICAL).toBe(messages['diary.notMedical']);
    // and in German they are something else, through t()
    expect(t('capture.guide')).not.toContain(GUIDE_TEXT);
  });
});

describe('reminder and Settings card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['photo_diary'] });

  it('the reminder strip, for a photo of today and for an old one', () => {
    check(<PhotoReminderView lastPhotoAge={describeAge(NOW - 9 * DAY, NOW)} onOpen={noop} onSnooze={noop} />);
    check(<PhotoReminderView lastPhotoAge={describeAge(NOW, NOW)} onOpen={noop} onSnooze={noop} />);
  });

  it('the reminder renders nothing in node (the flag reads as off on the server) and does not throw', () => {
    setFlags('photo_diary');
    expect(renderToStaticMarkup(<PhotoReminder onOpen={noop} />)).toBe('');
  });

  it('the Settings card: no photos, one, many; a status line', () => {
    check(<PhotoDiarySettingsView photos={[]} status="" onDeleteAll={noop} />);
    check(<PhotoDiarySettingsView photos={[photo('a', 1)]} status="" onDeleteAll={noop} />);
    check(<PhotoDiarySettingsView photos={[photo('a', 1), photo('b', 8), photo('c', 20, 3_000_000)]} status={t('settings.allDeleted')} onDeleteAll={noop} />);
  });

  it('the wired Settings card reads the records and shows them', () => {
    kvMetaPort.write([photo('a', 1), photo('b', 8)]);
    const html = check(<PhotoDiarySettingsCard />);
    expect(html).toContain('2 Fotos gespeichert');
  });
});

describe('every message of the scope is shown by some rendered state', () => {
  usePseudoLocale();

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  // Sent from the controller or the store as plain strings and handed to the panel; these are the keys the panel shows
  // only after another module produced the text, so they are exercised above through those modules.
  it('finds each German message (any literal piece of it) in the HTML rendered above', () => {
    if (rendered.length < 20) return; // run on its own with -t: nothing was rendered before this test
    const html = rendered.join('\n');
    const params = { age: 'X', size: 'X', date: 'X', n: 'X', seconds: 'X', percent: 'X', max: 'X' };
    const missing: string[] = [];
    for (const [key, template] of Object.entries(de)) {
      const pieces = new Set<string>();
      for (const count of [0, 1, 2]) {
        for (const part of formatToParts(template, { ...params, count }, 'de')) {
          if (part.value) continue;
          for (const piece of part.text.split(/<\/?b>/)) if (piece.trim().length >= 2) pieces.add(piece.trim());
        }
      }
      if (![...pieces].some(piece => html.includes(escape(piece)))) missing.push(key);
    }
    expect(missing, 'messages no rendered state shows').toEqual([]);
  });

});

describe('the privacy wording says what the code does, in every language', () => {
  const locales = { de, es, 'pt-BR': ptBR } as const;
  const banned = /100\s?%|nothing leaves|nichts verl|nada sale|nunca sale|nada deixa|zero network|no cloud|no server/i;

  it.each(Object.entries(locales))('%s: no stronger promise than the English', (_code, catalog) => {
    for (const key of ['diary.privacy.statement', 'diary.privacy.detail', 'diary.notSaved', 'diary.notMedical', 'settings.note'] as const) {
      expect(catalog[key], key).not.toMatch(banned);
    }
    expect(catalog['diary.notMedical'], 'no health claim').not.toMatch(/cura|heil|Heilung|cure/i);
  });
});
