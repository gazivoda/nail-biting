// Sign-in buttons for the sign-in page. Each follows its provider's own button
// guidance: Apple's black button with the Apple logo and "Sign in with Apple";
// Microsoft's light button with its four-square logo, grey text and border and
// "Sign in with Microsoft"; Google's light button with the multicolour G.
// Brand marks are inline SVG (no extra requests). They are plain links: the
// server starts each flow and redirects to the provider.
//
// Shape: pills, to sit with the rest of the site (the providers allow the corner
// radius to follow the host's style; colours, logo and wording are left as given).
// The wording is each provider's own phrase in the person's language (src/i18n/locales/*/auth.ts).

import { useT } from '../../i18n/scopes/auth';

const BASE =
  'inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full px-5 text-[1rem] font-semibold leading-none transition-opacity hover:opacity-90 active:translate-y-px';

function AppleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="-mt-0.5 flex-none">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 21 21" width="20" height="20" className="flex-none">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20" className="flex-none">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Google: the same address every Google button on the site uses. */
export function GoogleButton() {
  const t = useT();
  return (
    <a href="/api/auth/google" rel="nofollow" className={`${BASE} border border-[#747775] bg-white text-[#1f1f1f]`}>
      <GoogleLogo />
      {t('provider.google')}
    </a>
  );
}

export function AppleButton() {
  const t = useT();
  return (
    <a href="/api/auth/apple" rel="nofollow" className={`${BASE} bg-black text-white`}>
      <AppleLogo />
      {t('provider.apple')}
    </a>
  );
}

export function MicrosoftButton() {
  const t = useT();
  return (
    <a href="/api/auth/microsoft" rel="nofollow" className={`${BASE} border border-[#8c8c8c] bg-white text-[#5e5e5e]`}>
      <MicrosoftLogo />
      {t('provider.microsoft')}
    </a>
  );
}
