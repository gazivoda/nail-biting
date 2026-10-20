import { TrialButton } from './TrialButton';
import { track } from '../../utils/track';

// Mid-article block, in the Signal language: a deep card with one lime button.
// Same offer and privacy wording as the footer call to action; its own source
// labels (`blog-<slug>-mid`) so GA can rank it. No bite notch: it is a small
// card and nothing overhangs its corner.
export function BlogMidCta({ slug }: { slug: string }) {
  const source = `blog-${slug}-mid`;
  return (
    <aside aria-label="About Stop Biting" className="sg-page mb-10">
      <div className="sg-dark flex flex-col items-start gap-5 rounded-2xl bg-[color:var(--c-deep)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="sg-h3 text-white">Biting without <span className="sg-hl">noticing?</span></p>
          <p className="sg-small mt-2 max-w-[46ch]">
            Stop Biting is a webcam alarm that runs in your browser on a laptop or desktop. No camera
            data is sent while it runs. 3 days free, no card. Or{' '}
            <a href="/#live-demo" onClick={() => track('demo_link_click', source)} className="sg-link">
              try the 60 second demo
            </a>{' '}
            first, no account.
          </p>
        </div>
        <div className="shrink-0">
          <TrialButton tone="light" source={source} />
        </div>
      </div>
    </aside>
  );
}
