// The arithmetic behind /tools/nail-biting-cost-calculator.
//
// Every figure the visitor sees is either a number they typed or one of our two
// published prices ($2.99/month, $29/year, see /pricing). There is no assumed
// "average cost of nail biting" anywhere in this file, on purpose: the page
// must not assert a statistic the site has not verified.
export const MONTHLY_PRICE = 2.99;
export const YEARLY_PRICE = 29;
export const MONTHLY_PER_YEAR = Math.round(MONTHLY_PRICE * 12 * 100) / 100; // 35.88

export interface CostInput {
  manicuresPerYear: number;
  manicurePrice: number;
  otherPerYear: number;
}

export interface CostResult {
  yearly: number;
  fiveYears: number;
  vsYearlyPlan: number; // yearly spend minus the $29 plan; negative = you spend less than the plan
}

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const cents = (n: number) => Math.round(n * 100) / 100;

export function yearlyCost({ manicuresPerYear, manicurePrice, otherPerYear }: CostInput): CostResult {
  const yearly = cents(clean(manicuresPerYear) * clean(manicurePrice) + clean(otherPerYear));
  return { yearly, fiveYears: cents(yearly * 5), vsYearlyPlan: cents(yearly - YEARLY_PRICE) };
}
