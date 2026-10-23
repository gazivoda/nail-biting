// The History | Insights switch under the History title. Rendered by Log.tsx only while an insights flag is on.

import { SegmentedControl } from '../../components/ui/SegmentedControl';
// The switch is part of the History page itself (not the lazy Insights chunk), so its words are in the `history` scope.
import { useT } from '../../i18n/scopes/history';

export type HistoryView = 'history' | 'insights';

export function HistoryInsightsSwitch({ view, onChange, insightsLabel }: {
  view: HistoryView;
  onChange: (v: HistoryView) => void;
  insightsLabel: string;
}) {
  const t = useT();
  return (
    <div className="-mt-2 mb-6">
      <SegmentedControl<HistoryView>
        ariaLabel={t('switch.label')}
        value={view}
        onChange={onChange}
        options={[
          { label: t('switch.history'), value: 'history' },
          { label: insightsLabel, value: 'insights' },
        ]}
      />
    </div>
  );
}
