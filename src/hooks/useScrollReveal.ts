import { useEffect } from 'react';

// Activates scroll-reveal on all .reveal and .reveal-card elements.
// Shared by Landing and PricingPage — both render sections styled with the
// reveal classes, which start hidden until this observer adds .revealed.
//
// Everything below exists to honour one rule: a visitor must never meet a blank
// section. Content parked at `opacity: 0` is unreadable, so the reveal is a
// progressive enhancement that has to fail open, never closed.

const SELECTOR = '.reveal, .reveal-card';

// Where an element counts as "in reading position", as a fraction of the
// viewport measured from the top. 0.8 puts the trigger a fifth of the way up
// from the bottom edge: far enough in that the 520ms rule-draw on a section
// mark finishes somewhere the visitor is actually looking, rather than
// completing against the very bottom of the window.
const READING_LINE = 0.8;

// How long an entrance costs, worst case: the longest inline stagger delay
// Landing and PricingPage set on a reveal target (240ms) plus the 600ms fade in
// index.css. Used to lead the trigger by exactly the distance the page will
// travel during the entrance, so the fade finishes as the element arrives at
// reading position rather than starting there. At a standstill the lead is
// nothing and the mark still rules itself where it is read; at 1,200px/s it is
// about a screen, which is the difference between a section that is there and
// one the visitor scrolls past while it is still at zero opacity.
const ENTRANCE_S = 0.84;

// Ceiling on that lead, in viewport heights. Past it the page is outrunning the
// entrance however early it starts, so the entrance is shortened instead.
const MAX_LEAD = 2;

// If the IntersectionObserver has not delivered a single entry by now it is not
// going to, so show everything. A working observer always delivers its first
// batch within a frame or two of `observe()`, so this never fires in practice —
// it is the net under "the observer did not run at all".
const OBSERVER_FAILSAFE_MS = 1200;

export function useScrollReveal() {
  useEffect(() => {
    const revealAll = () => {
      document.querySelectorAll(SELECTOR).forEach(el => el.classList.add('revealed'));
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return;
    }

    // Deliberately not `if (pending.size === 0) return;`. That failed closed: it
    // installed no observer, no listeners and no failsafe, so any .reveal that
    // entered the DOM later (a lazy section, a route swap) was stranded at
    // opacity 0 permanently and silently. The sweep re-queries, so an empty
    // start is fine.
    const pending = new Set<Element>(document.querySelectorAll(SELECTOR));

    let observerDelivered = false;

    // `immediate` is for elements caught while the page is being flicked. The
    // inline stagger delays Landing and PricingPage set (80/160/240ms) are a
    // reading pleasure, but stacked in front of a 600ms fade they are what
    // actually leaves a section blank on a fast scroll: section 02's margin
    // measured 0.04 opacity a tenth of a second after it was revealed, filling
    // the whole reading area. At speed the delay is dropped and the fade is
    // cut short, so the content is simply there.
    const markRevealed = (el: Element, immediate = false) => {
      if (immediate) {
        (el as HTMLElement).style.transitionDelay = '0ms';
        el.classList.add('revealed-fast');
      }
      el.classList.add('revealed');
      pending.delete(el);
    };

    // `threshold: 0` with the trigger expressed entirely as a root inset.
    // A ratio cannot serve this page: a section mark is 17px tall, so the old
    // `threshold: 0.12` asked barely 2px of it to cross the line and fired
    // while the rule was still pinned to the bottom edge of the window, and the
    // same 0.12 against a 1,400px section means something else entirely. With
    // threshold 0 the negative bottom margin *is* the trigger, so a 17px rule
    // and a full-height section both fire at the same place on screen.
    const observer = new IntersectionObserver(
      entries => {
        observerDelivered = true;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          markRevealed(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: `0px 0px -${Math.round((1 - READING_LINE) * 100)}% 0px` },
    );
    pending.forEach(el => observer.observe(el));

    // The synchronous half, and the reason a fast scroll no longer leaves whole
    // sections blank. IntersectionObserver samples between frames and coalesces
    // its callbacks, so a quick flick can carry an element right through the
    // viewport before an entry is ever delivered — measured on this page at a
    // 1,600px-per-tick scroll, five of ten section marks never drew and eight
    // blocks were still at opacity 0 once the page came to rest. This runs off
    // the scroll event itself, one rAF at most behind the pixels.
    //
    // It also covers the tail of the document, where an element's top can never
    // cross the reading line because there is nothing left to scroll, and the
    // short-page case where the document does not scroll at all.
    let frame = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const sweep = () => {
      frame = 0;

      // Pick up anything that entered the DOM after mount. `pending` is built
      // once, and a set built once goes stale the moment a lazy section or a
      // route swap renders — leaving that content at opacity 0 with no error.
      // A querySelectorAll over a few dozen nodes is microseconds next to the
      // getBoundingClientRect calls below, and :not(.revealed) keeps it short.
      document
        .querySelectorAll('.reveal:not(.revealed), .reveal-card:not(.revealed)')
        .forEach(el => {
          if (pending.has(el)) return;
          pending.add(el);
          observer.observe(el);
        });

      if (pending.size === 0) return;
      const viewport = window.innerHeight;

      const now = performance.now();
      const y = window.scrollY;
      const speed = (Math.abs(y - lastY) / Math.max(1, now - lastT)) * 1000;
      lastY = y;
      lastT = now;

      const cap = viewport * MAX_LEAD;
      const lead = Math.min(speed * ENTRANCE_S, cap);
      const line = viewport * READING_LINE + lead;
      const outrunning = speed * ENTRANCE_S > cap;
      const atBottom =
        y + viewport >= document.documentElement.scrollHeight - 2;
      // Measure everything before mutating anything: writing a class or an
      // inline style between two getBoundingClientRect reads forces a
      // synchronous reflow per read, in the one frame this code exists to keep
      // cheap.
      const due: Element[] = [];
      for (const el of pending) {
        const { top } = el.getBoundingClientRect();
        if (top < line || (atBottom && top < viewport)) due.push(el);
      }
      for (const el of due) {
        markRevealed(el, outrunning);
        observer.unobserve(el);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sweep);
    };

    // First pass: anything already at or above reading position on load is
    // shown straight away rather than waiting for a scroll that may never come.
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const failsafe = window.setTimeout(() => {
      if (!observerDelivered) revealAll();
    }, OBSERVER_FAILSAFE_MS);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(failsafe);
    };
  }, []);
}
