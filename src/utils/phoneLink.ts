// A phone visitor cannot use the app (it needs a computer webcam), so the trial
// button gives them a way to send themselves the link. Where the browser has the
// Web Share sheet (most phones) it opens the sheet, which offers Messages, Notes,
// AirDrop, mail and so on; everywhere else, and if sharing fails, it falls back
// to a mailto. Nothing is stored, nothing is sent to us.
//
// The words are getters, read when the sheet or the mail draft is built, in the language showing then.
// Spreading the object (`{ ...PHONE_SHARE }`) reads them at that moment.
import { t } from '../i18n/scopes/shell';

export const PHONE_SHARE = {
  get title() { return t('share.title'); },
  get text() { return t('share.text'); },
  url: 'https://stopbiting.today',
} as const;

type ShareFn = (data: { title: string; text: string; url: string }) => Promise<void>;

export function canShare(nav: { share?: unknown } | undefined): boolean {
  return typeof nav?.share === 'function';
}

/**
 * Opens the share sheet. Returns after it settles. `onFallback` runs only when
 * sharing really failed: closing the sheet (AbortError) is the visitor's choice
 * and must not open a mail client.
 */
export async function shareToComputer(share: ShareFn, onFallback: () => void): Promise<void> {
  try {
    await share({ ...PHONE_SHARE });
  } catch (err) {
    if ((err as { name?: string } | null)?.name === 'AbortError') return;
    onFallback();
  }
}
