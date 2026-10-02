import { useRef, useState } from 'react';

const VIDEO_SRC = '/video/stop-biting.mp4';
const POSTER_SRC = '/video/stop-biting-poster.webp';
const TITLE = 'Stop Biting in 30 seconds';

// Click-to-play on purpose: browsers block autoplay with sound, and
// preload="none" keeps the video file off the page's load path entirely.
export function PromoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.play().catch(() => setStarted(false));
  };
  const handleEnded = () => {
    if (videoRef.current) videoRef.current.currentTime = 0;
    setStarted(false);
  };

  return (
    <div className="sg-promo">
      <video
        ref={videoRef}
        className="sg-promo__video"
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        width={1920}
        height={1080}
        preload="none"
        playsInline
        controls={started}
        onEnded={handleEnded}
        aria-label={TITLE}
      />
      {!started && (
        <button type="button" className="sg-promo__play" onClick={handlePlay} aria-label={`Play video: ${TITLE}`}>
          <span className="sg-promo__icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
          </span>
          <span className="sg-promo__label">Watch it, 30 seconds, sound on</span>
        </button>
      )}
    </div>
  );
}
