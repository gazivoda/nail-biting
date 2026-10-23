// One photo, drawn on a <canvas> (never an <img>: see drawBlob.ts). The bytes are
// loaded through `load` (the local blob store) and decoded in memory.

import { useEffect, useRef, type CSSProperties } from 'react';
import { drawBlobToCanvas } from './drawBlob';

export interface PhotoCanvasProps {
  /** Changes when the picture to draw changes (a photo id, or a review frame's time). */
  sourceKey: string;
  /** Gives the bytes; null when they are gone. Read when `sourceKey` changes, so it need not be stable. */
  load: () => Promise<Blob | null>;
  /** Widest pixel size to decode to; the canvas is displayed smaller or larger by CSS. */
  maxWidth: number;
  label: string;
  className?: string;
  style?: CSSProperties;
  /** Draw only once scrolled near the viewport (the gallery of up to 104 photos). */
  lazy?: boolean;
}

export function PhotoCanvas({ sourceKey, load, maxWidth, label, className, style, lazy = false }: PhotoCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    const run = () => {
      void loadRef.current().then(blob => {
        if (cancelled || !blob) return null;
        return drawBlobToCanvas(blob, canvas, maxWidth, () => !cancelled);
      });
    };
    if (lazy && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      }, { rootMargin: '240px' });
      io.observe(canvas);
      return () => {
        cancelled = true;
        io.disconnect();
      };
    }
    run();
    return () => { cancelled = true; };
  }, [sourceKey, maxWidth, lazy]);

  return <canvas ref={ref} role="img" aria-label={label} className={className} style={style} />;
}
