import type { ReactNode } from 'react';
import { Rings } from './Rings';

// The top of every content page: a deep-forest card with the bite notch and
// detection rings, same as the homepage hero. Put the breadcrumb, h1 and lede
// inside it; sg-dark re-points the text and rule tokens so they just work.
export function PageHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`sg-hero sg-dark bite relative overflow-hidden p-7 sm:p-10 lg:p-14 ${className}`}>
      <Rings className="-bottom-72 -right-60 h-[40rem] w-[40rem]" />
      <div className="relative">{children}</div>
    </div>
  );
}
