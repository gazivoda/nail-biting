// Draws a saved photo onto a <canvas>. This is how photos are shown, instead of an
// <img>: the site's Content-Security-Policy does not allow blob: image URLs, and a
// photo never needs a URL at all (a URL is a thing that can be copied, cached or
// requested). Decoding happens in memory with createImageBitmap.

export interface DrawResult {
  width: number;
  height: number;
}

export function canDecodePhotos(): boolean {
  return typeof createImageBitmap === 'function';
}

/**
 * Decodes `blob` and draws it into `canvas`, scaled down to at most `maxWidth` pixels
 * wide (never scaled up). Resolves null when the browser cannot decode it.
 */
export async function drawBlobToCanvas(
  blob: Blob,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  /** Checked after decoding: false means the caller moved on, so nothing is drawn. */
  isCurrent: () => boolean = () => true,
): Promise<DrawResult | null> {
  if (!canDecodePhotos()) return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    if (!isCurrent()) return null;
    const k = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * k));
    const height = Math.max(1, Math.round(bitmap.height * k));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { width, height };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
