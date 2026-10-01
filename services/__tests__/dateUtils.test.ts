import { describe, it, expect } from 'vitest';
import { 
  parseCalendarDate, 
  getQuarterForDate, 
  generateQuarterRange, 
  isDateInQuarter,
  formatCalendarDate
} from '../dateUtils';

describe('Australian Financial Year Quarter & Calendar Date Parsing', () => {
  it('correctly parses ISO dates without timezone drift', () => {
    expect(parseCalendarDate('2021-07-01')).toBe('2021-07-01');
    expect(parseCalendarDate('2021-09-30T23:59:59.000Z')).toBe('2021-09-30');
    expect(parseCalendarDate('2021-10-01T00:00:00.000Z')).toBe('2021-10-01');
  });

  it('correctly parses Australian DD/MM/YYYY dates', () => {
    expect(parseCalendarDate('30/09/2021')).toBe('2021-09-30');
    expect(parseCalendarDate('01/10/2021')).toBe('2021-10-01');
    expect(parseCalendarDate('31/12/2021')).toBe('2021-12-31');
    expect(parseCalendarDate('01/01/2022')).toBe('2022-01-01');
    expect(parseCalendarDate('31/03/2022')).toBe('2022-03-31');
    expect(parseCalendarDate('01/04/2022')).toBe('2022-04-01');
    expect(parseCalendarDate('30/06/2022')).toBe('2022-06-30');
    expect(parseCalendarDate('01/07/2022')).toBe('2022-07-01');
  });

  it('correctly parses Excel serial date numbers', () => {
    // 44105 = 2020-10-01
    expect(parseCalendarDate(44105)).toBe('2020-10-01');
    // 44104 = 2020-09-30
    expect(parseCalendarDate(44104)).toBe('2020-09-30');
  });

  it('correctly parses textual dates with month names', () => {
    expect(parseCalendarDate('30 Sep 2021')).toBe('2021-09-30');
    expect(parseCalendarDate('1 October 2021')).toBe('2021-10-01');
    expect(parseCalendarDate('December 31, 2021')).toBe('2021-12-31');
    expect(parseCalendarDate('1 Jan 2022')).toBe('2022-01-01');
  });

  describe('Australian Financial-Year Boundary Tests', () => {
    // Boundary 1: 30 September / 1 October (Q1 vs Q2)
    it('accurately distinguishes 30 September (Q1) and 1 October (Q2)', () => {
      const sep30 = getQuarterForDate('2020-09-30');
      expect(sep30.quarter).toBe(1);
      expect(sep30.fy).toBe('FY2020-21');
      expect(sep30.startDate).toBe('2020-07-01');
      expect(sep30.endDate).toBe('2020-09-30');

      const oct1 = getQuarterForDate('2020-10-01');
      expect(oct1.quarter).toBe(2);
      expect(oct1.fy).toBe('FY2020-21');
      expect(oct1.startDate).toBe('2020-10-01');
      expect(oct1.endDate).toBe('2020-12-31');
    });

    // Boundary 2: 31 December / 1 January (Q2 vs Q3)
    it('accurately distinguishes 31 December (Q2) and 1 January (Q3)', () => {
      const dec31 = getQuarterForDate('2020-12-31');
      expect(dec31.quarter).toBe(2);
      expect(dec31.fy).toBe('FY2020-21');

      const jan1 = getQuarterForDate('2021-01-01');
      expect(jan1.quarter).toBe(3);
      expect(jan1.fy).toBe('FY2020-21');
      expect(jan1.startDate).toBe('2021-01-01');
      expect(jan1.endDate).toBe('2021-03-31');
    });

    // Boundary 3: 31 March / 1 April (Q3 vs Q4)
    it('accurately distinguishes 31 March (Q3) and 1 April (Q4)', () => {
      const mar31 = getQuarterForDate('2021-03-31');
      expect(mar31.quarter).toBe(3);
      expect(mar31.fy).toBe('FY2020-21');

      const apr1 = getQuarterForDate('2021-04-01');
      expect(apr1.quarter).toBe(4);
      expect(apr1.fy).toBe('FY2020-21');
      expect(apr1.startDate).toBe('2021-04-01');
      expect(apr1.endDate).toBe('2021-06-30');
    });

    // Boundary 4: 30 June / 1 July (Q4 vs Next FY Q1)
    it('accurately distinguishes 30 June (Q4) and 1 July (Next FY Q1)', () => {
      const jun30 = getQuarterForDate('2021-06-30');
      expect(jun30.quarter).toBe(4);
      expect(jun30.fy).toBe('FY2020-21');

      const jul1 = getQuarterForDate('2021-07-01');
      expect(jul1.quarter).toBe(1);
      expect(jul1.fy).toBe('FY2021-22');
      expect(jul1.startDate).toBe('2021-07-01');
      expect(jul1.endDate).toBe('2021-09-30');
    });
  });

  describe('Quarter Range Generation', () => {
    it('generates continuous sequential quarters from FY2020-21 Q1 to FY2021-22 Q4', () => {
      const range = generateQuarterRange('FY2020-21-Q1', 'FY2021-22-Q4');
      expect(range.length).toBe(8);
      expect(range[0].id).toBe('FY2020-21-Q1');
      expect(range[0].startDate).toBe('2020-07-01');
      expect(range[1].id).toBe('FY2020-21-Q2');
      expect(range[2].id).toBe('FY2020-21-Q3');
      expect(range[3].id).toBe('FY2020-21-Q4');
      expect(range[4].id).toBe('FY2021-22-Q1');
      expect(range[7].id).toBe('FY2021-22-Q4');
      expect(range[7].endDate).toBe('2022-06-30');
    });
  });
});
