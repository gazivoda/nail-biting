import { TrialButton } from './TrialButton';
import { track } from '../../utils/track';

// Mid-article block. Same offer and privacy wording as the end-of-post card;
// its own source labels (`blog-<slug>-mid`) so GA can rank mid against end.
export function BlogMidCta({ slug }: { slug: string }) {
  const source = `blog-${slug}-mid`;
  return (
    <aside
      aria-label="About Stop Biting"
      className="sg-page mb-10 flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="sg-h3">Biting without noticing?</p>
        <p className="sg-small mt-1 max-w-[46ch]">
          Stop Biting is a webcam alarm that runs in your browser on a laptop or desktop. No camera
          data is sent while it runs. 3 days free, no card. Or{' '}
          <a href="/#live-demo" onClick={() => track('demo_link_click', source)} className="sg-link">
            try the 60 second demo
          </a>{' '}
          first, no account.
        </p>
      </div>
      <TrialButton source={source} />
    </aside>
  );
}
