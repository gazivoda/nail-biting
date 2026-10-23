// Settings > Account & Sync > "Language" (WS12a). Mounted by sections/AccountSyncSection.tsx with one line.
//
// Shown only while at least one locale flag (locale_es, locale_de, locale_pt_br) is on, and lists only the
// languages whose flag is on, plus English. The pick is stored on this device (kv 'i18n'); the browser's
// language is never read. Language names are written in their own language, never translated.

import { Languages } from 'lucide-react';
import { Section } from './ui';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useFeatures } from '../../features/useFeature';
import { LOCALES, LOCALE_INFO, didLocaleLoadFail, isLocaleReviewed, type Locale } from '../../i18n/core';
import { useLocale } from '../../i18n/hooks';
import { useT } from '../../i18n/scopes/language';

export function LanguageSettings() {
  const flags = useFeatures();
  const t = useT();
  const { locale, preferred, setLocale } = useLocale();

  const options = LOCALES.filter(l => {
    const flag = LOCALE_INFO[l].flag;
    return flag === null || flags[flag] === true;
  });
  if (options.length < 2) return null;

  const value: Locale = options.includes(preferred) ? preferred : 'en';
  const waiting = value !== locale; // picked, catalog on its way
  const failed = waiting && didLocaleLoadFail(value);
  const draft = locale !== 'en' && !isLocaleReviewed(locale);

  return (
    <Section title={t('title')} icon={Languages} fullWidth>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{t('intro')}</p>
      <SegmentedControl
        ariaLabel={t('groupLabel')}
        value={value}
        onChange={setLocale}
        options={options.map(l => ({ value: l, label: LOCALE_INFO[l].native }))}
      />
      {waiting && !failed && <p role="status" className="text-sm text-stone-600 dark:text-stone-300">{t('loading')}</p>}
      {failed && <p role="alert" className="text-sm text-alert-600 dark:text-alert-400">{t('loadFailed')}</p>}
      {draft && <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{t('draftNote')}</p>}
    </Section>
  );
}
