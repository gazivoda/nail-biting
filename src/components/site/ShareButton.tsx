import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { copyText } from '../../utils/shareLink';
import { track } from '../../utils/track';

// "Copy link" for a calculator result. The link holds only the numbers the
// visitor typed (see utils/shareLink.ts), which the note under it says.
export function ShareButton({ getUrl, source }: { getUrl: () => string; source: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    const ok = await copyText(getUrl());
    setCopied(ok);
    setFailed(!ok);
    if (ok) {
      track('share_click', source);
      window.setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        className="sg-btn sg-btn-ink sg-btn-sm"
      >
        <Link2 size={15} aria-hidden="true" />
        {copied ? 'Link copied' : 'Copy link to this result'}
      </button>
      <p className="sg-note mt-2" role="status">
        {failed ? 'Your browser would not copy it. Select the address bar after reloading.' : 'The link holds only the numbers you entered.'}
      </p>
    </div>
  );
}
