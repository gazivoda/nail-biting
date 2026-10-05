import { describe, it, expect } from 'vitest';
import { yearlyCost, MONTHLY_PER_YEAR, YEARLY_PRICE } from './costCalc';

describe('yearlyCost', () => {
  it('multiplies manicures by price and adds other spend', () => {
    const r = yearlyCost({ manicuresPerYear: 12, manicurePrice: 40, otherPerYear: 30 });
    expect(r.yearly).toBe(510);
    expect(r.fiveYears).toBe(2550);
    expect(r.vsYearlyPlan).toBe(510 - YEARLY_PRICE);
  });

  it('is negative against the yearly plan when you spend less than it', () => {
    expect(yearlyCost({ manicuresPerYear: 1, manicurePrice: 10, otherPerYear: 0 }).vsYearlyPlan).toBe(-19);
  });

  it('treats blank, negative and non-numeric input as zero', () => {
    expect(yearlyCost({ manicuresPerYear: NaN, manicurePrice: -5, otherPerYear: Infinity }).yearly).toBe(0);
  });

  it('publishes the monthly plan as $35.88 over twelve months', () => {
    expect(MONTHLY_PER_YEAR).toBe(35.88);
  });
});
