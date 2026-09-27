import type { Incident } from '../types';

// What History can honestly say from the bites a person has confirmed or
// logged. Each insight needs a minimum sample, so two bites never become "your
// top trigger". Ties go to the earlier hour / the first tag seen, which keeps
// the answer stable between renders.
export const MIN_SAMPLE = 3;

export function topTrigger(bites: Incident[]): { tag: string; count: number; of: number } | null {
  const tagged = bites.filter(b => b.tag !== 'auto-detected' && b.tag !== 'unknown');
  if (tagged.length < MIN_SAMPLE) return null;
  const counts = new Map<string, number>();
  for (const b of tagged) counts.set(b.tag, (counts.get(b.tag) ?? 0) + 1);
  let best: string | null = null;
  for (const [tag, n] of counts) if (best === null || n > counts.get(best)!) best = tag;
  const count = counts.get(best!)!;
  return count >= 2 ? { tag: best!, count, of: tagged.length } : null;
}

export function peakHour(bites: Incident[]): { hour: number; count: number } | null {
  if (bites.length < MIN_SAMPLE) return null;
  const counts = new Array(24).fill(0);
  for (const b of bites) counts[new Date(b.timestamp).getHours()]++;
  let hour = 0;
  for (let h = 1; h < 24; h++) if (counts[h] > counts[hour]) hour = h;
  return counts[hour] >= 2 ? { hour, count: counts[hour] } : null;
}

/** "3 to 4 pm", "11 am to 12 pm" */
export function hourRange(hour: number): string {
  const fmt = (h: number) => {
    const n = h % 12 === 0 ? 12 : h % 12;
    return { n, ap: h % 24 < 12 ? 'am' : 'pm' };
  };
  const a = fmt(hour), b = fmt(hour + 1);
  return a.ap === b.ap ? `${a.n} to ${b.n} ${b.ap}` : `${a.n} ${a.ap} to ${b.n} ${b.ap}`;
}
