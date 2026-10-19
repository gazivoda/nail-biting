// The arithmetic behind /tools/nail-growth-timeline-calculator.
//
// The two rates are the averages measured in one study: Yaemsiri et al., "Growth
// rate of human fingernails and toenails in healthy American young adults",
// J Eur Acad Dermatol Venereol 2010;24(4):420-423 (PubMed 19744178). 22 healthy
// young adults marked their nails and measured the distance one to three months
// later: 3.47 mm/month for fingernails, 1.62 mm/month for toenails. That is the
// only number in this file. The page says it is an average from a small sample,
// so the result is "about", never a promise.
export const FINGERNAIL_MM_PER_MONTH = 3.47;
export const TOENAIL_MM_PER_MONTH = 1.62;

export type NailKind = 'fingernail' | 'toenail';

export interface GrowthResult {
  months: number; // one decimal
  weeks: number;  // whole weeks, from the same rate
}

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function monthsToGrow(mm: number, kind: NailKind): GrowthResult {
  const rate = kind === 'fingernail' ? FINGERNAIL_MM_PER_MONTH : TOENAIL_MM_PER_MONTH;
  const months = clean(mm) / rate;
  // 52 weeks over 12 months, rounded to a whole week.
  return { months: Math.round(months * 10) / 10, weeks: Math.round(months * (52 / 12)) };
}
