import { ArrowRight } from 'lucide-react';

// Every trial button. A new tab on purpose (92360d2): the landing tab, and any
// demo running in it, stays open.
export function TrialButton({ tone = 'solid', size = 'md' }: { tone?: 'solid' | 'light'; size?: 'md' | 'sm' }) {
  return (
    <a
      href="/api/auth/google"
      target="_blank"
      rel="noopener noreferrer"
      className={`sg-btn group ${tone === 'light' ? 'sg-btn-light' : ''} ${size === 'sm' ? 'sg-btn-sm' : ''}`}
    >
      Start free trial
      <ArrowRight size={size === 'sm' ? 15 : 18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );
}
