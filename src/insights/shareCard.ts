// The share card (WS5): a PNG with a milestone's figure and nothing else.
//
// What goes on it: the figure ("7 days"), its plain-words meaning, the date it was reached, the app's
// name and address. What never goes on it: a photo (this version has no way to add one, on purpose), a
// face, a hand, the habit, anyone's name or email, any number that is not the milestone's own, and any
// claim about health or results. It is drawn on a <canvas> on this device; sharing it is the person's
// own action (the Web Share sheet where the browser has one, otherwise a download). Nothing is uploaded.
//
// The model and the drawing are separate so the wording is testable without a DOM: `buildShareCardModel`
// is pure, `drawShareCard` only needs something shaped like a 2D context.

import type { MilestoneStatus } from './milestones';

export const SHARE_CARD_SIZE = 1080;
export const SHARE_CARD_SITE = 'stopbiting.today';

export interface ShareCardModel {
  width: number;
  height: number;
  kicker: string;
  figure: string;
  title: string;
  detail: string;
  /** "Reached 23 October 2026" */
  reached: string;
  brand: string;
  site: string;
  /** Alt text / accessible name for the image. */
  alt: string;
}

export function formatCardDate(ts: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale ?? 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts));
}

export function buildShareCardModel(status: MilestoneStatus, locale?: string): ShareCardModel {
  const at = status.reachedAt;
  if (at === null) throw new Error('A share card needs a milestone that has been reached');
  const { def } = status;
  const reached = `Reached ${formatCardDate(at, locale)}`;
  return {
    width: SHARE_CARD_SIZE,
    height: SHARE_CARD_SIZE,
    kicker: 'Milestone',
    figure: def.figure,
    title: def.title,
    detail: def.detail,
    reached,
    brand: 'Stop Biting',
    site: SHARE_CARD_SITE,
    alt: `Stop Biting milestone: ${def.title}. ${reached}.`,
  };
}

/** The slice of CanvasRenderingContext2D the card uses. Anything with these members can draw it (a recording fake in tests). */
export interface CardContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
  setLineDash(segments: number[]): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

/** Greedy word wrap against a measuring function. A single word wider than the line stays on its own line. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const DEEP = '#0B2A1E';
const LIME = '#C6F24E';
const WHITE = '#FFFFFF';
const DISPLAY = '"Bricolage Grotesque", "Geist", -apple-system, "Segoe UI", sans-serif';
const TEXT = '"Geist", -apple-system, "Segoe UI", sans-serif';

/** Draws the card. Uses only rectangles, circles and text: no image is ever drawn. */
export function drawShareCard(ctx: CardContext, m: ShareCardModel): void {
  const { width: W, height: H } = m;
  const pad = 88;

  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, W, H);

  // The brand's dashed detection rings, faint, in the lower right corner.
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  [150, 260, 370, 480, 590].forEach((r, i) => {
    ctx.globalAlpha = 0.16 - i * 0.025;
    ctx.setLineDash([2 + i, 16 + i * 4]);
    ctx.beginPath();
    ctx.arc(W - 120, H - 120, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Wordmark: the lens mark (a lime ring around a deep centre) and the name.
  ctx.fillStyle = LIME;
  ctx.beginPath();
  ctx.arc(pad + 28, pad + 28, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.arc(pad + 28, pad + 28, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textBaseline = 'middle';
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText(m.brand, pad + 76, pad + 30);

  // Kicker, figure, title.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = LIME;
  ctx.font = `700 34px ${TEXT}`;
  ctx.fillText(m.kicker.toUpperCase(), pad, 400);

  // The figure is as large as fits on one line.
  let size = 220;
  ctx.font = `800 ${size}px ${DISPLAY}`;
  while (size > 90 && ctx.measureText(m.figure).width > W - pad * 2) {
    size -= 10;
    ctx.font = `800 ${size}px ${DISPLAY}`;
  }
  ctx.fillStyle = WHITE;
  ctx.fillText(m.figure, pad, 400 + size * 0.95);

  let y = 400 + size * 0.95 + 80;
  ctx.font = `700 54px ${DISPLAY}`;
  for (const line of wrapLines(m.title, W - pad * 2, s => ctx.measureText(s).width)) {
    ctx.fillText(line, pad, y);
    y += 64;
  }

  ctx.globalAlpha = 0.8;
  ctx.font = `400 36px ${TEXT}`;
  y += 14;
  for (const line of wrapLines(m.detail, W - pad * 2 - 120, s => ctx.measureText(s).width)) {
    ctx.fillText(line, pad, y);
    y += 50;
  }
  ctx.globalAlpha = 1;

  // Footer.
  ctx.fillStyle = LIME;
  ctx.font = `600 32px ${TEXT}`;
  ctx.fillText(m.reached, pad, H - pad - 44);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = WHITE;
  ctx.fillText(m.site, pad, H - pad);
  ctx.globalAlpha = 1;
}

/** Draws the card on an off-screen canvas and returns the PNG. Browser only. */
export async function renderShareCardPng(m: ShareCardModel): Promise<Blob> {
  // Wait for the display font if the page has it, so the card does not fall back to a system face. Never for
  // long: a font that does not load must not leave the person looking at "Making the picture".
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`800 60px "Bricolage Grotesque"`), document.fonts.load(`400 30px "Geist"`)]),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ]);
  } catch { /* draw with whatever is available */ }
  const canvas = document.createElement('canvas');
  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  drawShareCard(ctx, m);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png');
  });
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** The slice of `navigator` the share step uses. */
export interface ShareNavigator {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
}

/**
 * Hands the PNG to the system share sheet when the browser can share files, otherwise downloads it.
 * `download` is injected so tests do not need a DOM. Never throws.
 */
export async function shareOrDownload(
  png: Blob,
  fileName: string,
  text: string,
  nav: ShareNavigator,
  download: (blob: Blob, fileName: string) => void,
): Promise<ShareResult> {
  try {
    const file = new File([png], fileName, { type: 'image/png' });
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Stop Biting', text });
        return 'shared';
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
        // Any other share failure: fall through to the download.
      }
    }
    download(png, fileName);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** Browser download of a blob. The object URL is for a file save, not shown in the page; it is released right away. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
