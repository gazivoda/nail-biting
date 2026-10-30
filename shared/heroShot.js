// The home page's hero screenshot, in ONE place.
//
// Three audiences import this file (it is plain ES-module JavaScript with a hand-written heroShot.d.ts beside it): the
// React page (src/pages/Landing.tsx, through Vite), server.js (the preload on `/`) and server/marketing/localePages.js
// (the same preload on the translated home pages). The preload must name exactly the candidates and the `sizes` of the
// <img>, or the browser downloads a second copy of the picture: that is why they are one constant and not three strings.
//
// It is the real Watch screen of the app with example data (public/shots/*.json carry the provenance), shown at three
// widths of the same capture, never drawn or generated:
//   app-watch-640@1x.webp    640 x 396    for a phone at 1x to about 1.9x (the home page's mobile Lighthouse run is 1.75x)
//   app-watch-1280@1x.webp  1280 x 792    for a phone at 2x to 3x, a tablet, a desktop at 2x
//   app-watch-1280.webp     2560 x 1584   for anything denser (also the `src` fallback and the structured data's image)
//
// `sizes` is the width the picture really takes, because the browser picks a candidate from it. Below 1024 px the hero is
// one column and the picture is the viewport minus the page gutter and the hero's padding (5.5rem at phone widths, measured
// 232 px at a 320 px window, 302 at 390, 324 at 412; a few px less than this from 600 px up, which only ever errs towards
// the larger file). It used to say 100vw, which asked for 84 px more than it drew and had a 412 px phone download the
// 1280 px file for a 574 px picture. From 1024 px the hero has two columns and the picture is at most 492 px: 36rem
// (576) was verified at 1440 px 1x and 2x and is left as it was.

export const HERO_SHOT = {
  src: '/shots/app-watch-1280.webp',
  srcSet: '/shots/app-watch-640@1x.webp 640w, /shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w',
  sizes: '(min-width: 1024px) 36rem, calc(100vw - 5.5rem)',
  // The 1280 file's size: the picture's aspect ratio, so the <img> reserves its box before it arrives.
  width: 1280,
  height: 792,
};

/** The <link rel="preload"> that starts the download with the HTML (React only creates the <img> after the bundle has run). */
export function heroShotPreloadTag() {
  return `<link rel="preload" as="image" href="${HERO_SHOT.src}" imagesrcset="${HERO_SHOT.srcSet}" imagesizes="${HERO_SHOT.sizes}" fetchpriority="high">`;
}
