import { ArrowRight } from 'lucide-react';
import { track } from '../../utils/track';
import { useIsPhone } from '../../hooks/useIsPhone';
import { canShare, shareToComputer } from '../../utils/phoneLink';
import { useSignInHref } from '../../auth/useSignInProviders';
import { useCopyFlag } from '../../features/useFlagCopy';
import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
import { useSiteT } from '../../i18n/marketing/useSite';

// The app needs a computer webcam, and the trial clock starts at sign-in, so a
// phone visitor who signs in here spends the trial before they can use it.
// They get a way to send themselves the link instead. A mailto needs no
// backend and stores nothing. The small header button keeps its label: it is
// also where an existing account signs in from a phone.

type ButtonProps = { tone?: 'solid' | 'light'; size?: 'md' | 'sm'; source?: string };

// Every trial button. A new tab on purpose (92360d2): the landing tab, and any
// demo running in it, stays open.
export function TrialButton({ tone = 'solid', size = 'md', source = 'cta_button' }: ButtonProps) {
  const phone = useIsPhone();
  const t = useChromeT();
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
      {t('trial.start')}
      <ArrowRight size={size === 'sm' ? 15 : 18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );

  if (phone && size !== 'sm') return <PhoneTrialButton className={className} source={source} startTrial={startTrial} />;
  return startTrial;
}

// A phone visitor. Until the phone companion (flag phone_companion, WS6) is on, signing up on a phone
// would spend the trial on a screen that cannot detect anything, so the button sends the link to a
// computer instead. With the companion on, a phone has a screen of its own (log a bite or an urge in
// two taps), so the button is the ordinary one. The flag comes from the marker the server wrote into the
// page (src/features/copyFlags.ts), never from a request.
function PhoneTrialButton({ className, source, startTrial }: { className: string; source: string; startTrial: React.ReactElement }) {
  const companion = useCopyFlag('phone_companion');
  const t = useSiteT(useChromeT);
  if (companion) return startTrial;

  // With the share sheet the link goes wherever the visitor picks; the href
  // stays a mailto for browsers without it and for when sharing fails.
  const mailto =
    'mailto:?subject=' + encodeURIComponent(t('trial.mailSubject')) +
    '&body=' + encodeURIComponent(t('trial.mailBody'));
  const share = canShare(navigator);
  const onPhoneClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    track('phone_link_click', source);
    if (!share) return;
    e.preventDefault();
    void shareToComputer(
      data => navigator.share({ ...data, title: t('trial.mailSubject'), text: t('trial.shareText') }),
      () => { window.location.href = mailto; },
    );
  };
  return (
    <a href={mailto} onClick={onPhoneClick} className={className}>
      {share ? t('trial.send') : t('trial.email')}
      <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </a>
  );
}
