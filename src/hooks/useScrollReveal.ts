import { useEffect } from 'react';

// Activates scroll-reveal on all .reveal and .reveal-card elements.
// Shared by Landing and PricingPage — both render sections styled with the
// reveal classes, which start hidden until this observer adds .revealed.
export function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.reveal, .reveal-card').forEach(el => {
        el.classList.add('revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    document.querySelectorAll('.reveal, .reveal-card').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
