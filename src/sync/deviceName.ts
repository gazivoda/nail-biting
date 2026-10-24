// A readable name for this browser ("Chrome on macOS") for the Account & Sync
// card. Pure string work on the user agent; the name stays on this device and is
// never sent to the server (the server only ever sees the random device id).

import { t } from '../i18n/scopes/data';

export function defaultDeviceName(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux|X11/.test(ua) ? 'Linux'
    : null;
  // Order matters: Edge and Opera also say Chrome, Chrome also says Safari.
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /Electron\//.test(ua) ? t('device.app')
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  if (browser && os) return t('device.browserOnOs', { browser, os });
  return browser ?? os ?? t('device.fallback');
}
