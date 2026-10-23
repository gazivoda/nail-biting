import { ArrowRight } from 'lucide-react';
import { track } from '../../utils/track';
import { useIsPhone } from '../../hooks/useIsPhone';
import { canShare, shareToComputer } from '../../utils/phoneLink';
import { useSignInHref } from '../../auth/useSignInProviders';
import { useLazyFeature } from '../../features/useFlagCopy';

// The app needs a computer webcam, and the trial clock starts at sign-in, so a
// phone visitor who signs in here spends the trial before they can use it.
// They get a way to send themselves the link instead. A mailto needs no
// backend and stores nothing. The small header button keeps its label: it is
// also where an existing account signs in from a phone.
const PHONE_MAILTO =
  'mailto:?subject=' + encodeURIComponent('Stop Biting, for my computer') +
  '&body=' + encodeURIComponent('Open this on my laptop or desktop: https://stopbiting.today');

type ButtonProps = { tone?: 'solid' | 'light'; size?: 'md' | 'sm'; source?: string };

// Every trial button. A new tab on purpose (92360d2): the landing tab, and any
// demo running in it, stays open.
export function TrialButton({ tone = 'solid', size = 'md', source = 'cta_button' }: ButtonProps) {
  const phone = useIsPhone();
  const signInHref = useSignInHref(); // /api/auth/google unless another sign-in method is switched on
  const className = `sg-btn group ${tone === 'light' ? 'sg-btn-light' : ''} ${size === 'sm' ? 'sg-btn-sm' : ''}`;

  const startTrial = (
    <a
      href={signInHref}
      target="_blank"
      rel="nofollow noopener noreferrer"
      onClick={() => track('trial_click', source)}
      className={className}
    >
      Start free trial
      <ArrowRight size={size === 'sm' ? 15 : 18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );

  if (phone && size !== 'sm') return <PhoneTrialButton className={className} source={source} startTrial={startTrial} />;
  return startTrial;
}

// A phone visitor. Until the phone companion (flag phone_companion, WS6) is on, signing up on a phone
// would spend the trial on a screen that cannot detect anything, so the button sends the link to a
// computer instead. With the companion on, a phone has a screen of its own (log a bite or an urge in
// two taps), so the button is the ordinary one. The flag is read here, in a component only a phone
// renders, so a computer's visit never asks for it.
function PhoneTrialButton({ className, source, startTrial }: { className: string; source: string; startTrial: React.ReactElement }) {
  const companion = useLazyFeature('phone_companion');
  if (companion) return startTrial;

  // With the share sheet the link goes wherever the visitor picks; the href
  // stays a mailto for browsers without it and for when sharing fails.
  const share = canShare(navigator);
  const onPhoneClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    track('phone_link_click', source);
    if (!share) return;
    e.preventDefault();
    void shareToComputer(data => navigator.share(data), () => { window.location.href = PHONE_MAILTO; });
  };
  return (
    <a href={PHONE_MAILTO} onClick={onPhoneClick} className={className}>
      {share ? 'Send the link to my computer' : 'Email me the link for my computer'}
      <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );
}
