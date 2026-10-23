// The History | Insights switch under the History title. Rendered by Log.tsx only while an insights flag is on.

import { SegmentedControl } from '../../components/ui/SegmentedControl';

export type HistoryView = 'history' | 'insights';

export function HistoryInsightsSwitch({ view, onChange, insightsLabel }: {
  view: HistoryView;
  onChange: (v: HistoryView) => void;
  insightsLabel: string;
}) {
  return (
    <div className="-mt-2 mb-6">
      <SegmentedControl<HistoryView>
        ariaLabel="History view"
        value={view}
        onChange={onChange}
        options={[
          { label: 'History', value: 'history' },
          { label: insightsLabel, value: 'insights' },
        ]}
      />
    </div>
  );
}
