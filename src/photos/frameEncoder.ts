// Turns the live preview into the JPEG that gets saved. The browser's own canvas does
// the work; the bytes go straight to the caller (and from there to the local blob
// store). Mirrored on purpose: the preview is a mirror, so what was seen is what is saved.

import { JPEG_QUALITY, MAX_SIDE, fitWithin } from './diaryMeta';

export interface EncodedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Draws the current frame of `video` (scaled to at most MAX_SIDE) and encodes it as a JPEG. */
export async function encodeVideoFrame(video: HTMLVideoElement): Promise<EncodedImage> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!(vw > 0) || !(vh > 0) || video.readyState < 2) throw new Error('no-frame');
  const { width, height } = fitWithin(vw, vh, MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  canvas.width = 0; // release the pixel buffer now rather than at the next collection
  canvas.height = 0;
  if (!blob) throw new Error('encode-failed');
  return { blob, width, height };
}

/** The camera request for the diary: video only, the front camera if there is a choice. */
export function openDiaryCamera(): Promise<MediaStream> | undefined {
  const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') return undefined;
  return md.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}
