import { QuarterNumber, QuarterPeriod } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * Parses any date format (ISO, Australian DD/MM/YYYY, Excel serial, textual dates)
 * into a timezone-neutral canonical 'YYYY-MM-DD' calendar string.
 * Returns null if invalid or unparseable.
 */
export function parseCalendarDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;

  // Handle Excel Serial Number (e.g. 44105)
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    // Excel serial date 1 = 1900-01-01. Day 60 was 1900-02-29 (Excel leap year bug).
    // For dates >= 1970 (serial >= 25569), calculate milliseconds in UTC
    const utcMs = Math.round((val - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad(m)}-${pad(day)}`;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1. Direct ISO format check: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidDateParts(y, m, d)) {
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  // 2. Numeric with slash, dash, or dot: DD/MM/YYYY or YYYY/MM/DD
  const delimiterMatch = str.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})/);
  if (delimiterMatch) {
    const p1 = parseInt(delimiterMatch[1], 10);
    const p2 = parseInt(delimiterMatch[2], 10);
    const p3 = parseInt(delimiterMatch[3], 10);

    // If first part is 4 digits -> YYYY/MM/DD
    if (delimiterMatch[1].length === 4) {
      if (isValidDateParts(p1, p2, p3)) {
        return `${p1}-${pad(p2)}-${pad(p3)}`;
      }
    } else {
      // Australian format standard: DD/MM/YYYY
      let year = p3;
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      const month = p2;
      const day = p1;
      if (isValidDateParts(year, month, day)) {
        return `${year}-${pad(month)}-${pad(day)}`;
      }
    }
  }

  // 3. Textual month format: "30 Sep 2021", "30-Sep-2021", "September 30, 2021"
  const textMatch = str.match(/(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const month = parseMonthName(textMatch[2]);
    const year = parseInt(textMatch[3], 10);
    if (month && isValidDateParts(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  const textMatchUS = str.match(/([a-zA-Z]+)[\s\-]+(\d{1,2}),?[\s\-]+(\d{4})/);
  if (textMatchUS) {
    const month = parseMonthName(textMatchUS[1]);
    const day = parseInt(textMatchUS[2], 10);
    const year = parseInt(textMatchUS[3], 10);
    if (month && isValidDateParts(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // 4. Fallback: Parse via Date object using UTC extraction
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    const y = fallback.getFullYear();
    const m = fallback.getMonth() + 1;
    const d = fallback.getDate();
    if (isValidDateParts(y, m, d)) {
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  return null;
}

function parseMonthName(name: string): number | null {
  const clean = name.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (MONTH_NAMES[i].toLowerCase() === clean || MONTH_SHORT[i].toLowerCase() === clean) {
      return i + 1;
    }
  }
  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Formats a canonical YYYY-MM-DD string for display.
 */
export function formatCalendarDate(
  isoDate: string | null | undefined, 
  style: 'au' | 'short' | 'long' = 'au'
): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoDate;

  if (style === 'au') {
    return `${pad(d)}/${pad(m)}/${y}`;
  }
  if (style === 'short') {
    return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
  }
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Creates a QuarterPeriod definition given financial year start year and quarter number.
 * E.g. fyStartYear = 2020, quarter = 1 -> FY2020-21 Q1 (1 Jul 2020 - 30 Sep 2020)
 */
export function createQuarterPeriod(fyStartYear: number, quarter: QuarterNumber): QuarterPeriod {
  const nextYear = fyStartYear + 1;
  const fyShort = `FY${fyStartYear}-${String(nextYear).slice(-2)}`;
  const id = `${fyShort}-Q${quarter}`;
  const label = `${fyShort} Q${quarter}`;

  let startDate = '';
  let endDate = '';
  let dateRangeLabel = '';

  switch (quarter) {
    case 1:
      startDate = `${fyStartYear}-07-01`;
      endDate = `${fyStartYear}-09-30`;
      dateRangeLabel = `1 Jul ${fyStartYear} – 30 Sep ${fyStartYear}`;
      break;
    case 2:
      startDate = `${fyStartYear}-10-01`;
      endDate = `${fyStartYear}-12-31`;
      dateRangeLabel = `1 Oct ${fyStartYear} – 31 Dec ${fyStartYear}`;
      break;
    case 3:
      startDate = `${nextYear}-01-01`;
      endDate = `${nextYear}-03-31`;
      dateRangeLabel = `1 Jan ${nextYear} – 31 Mar ${nextYear}`;
      break;
    case 4:
      startDate = `${nextYear}-04-01`;
      endDate = `${nextYear}-06-30`;
      dateRangeLabel = `1 Apr ${nextYear} – 30 Jun ${nextYear}`;
      break;
  }

  return {
    id,
    fy: fyShort,
    fyStartYear,
    quarter,
    label,
    fullLabel: `${label} (${dateRangeLabel})`,
    startDate,
    endDate
  };
}

/**
 * Returns the Australian Financial Year Quarter for any given calendar date.
 * E.g. '2020-09-30' -> FY2020-21 Q1
 *      '2020-10-01' -> FY2020-21 Q2
 */
export function getQuarterForDate(dateStr: string): QuarterPeriod {
  const canonical = parseCalendarDate(dateStr) || dateStr;
  const parts = canonical.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (month >= 7 && month <= 9) {
    return createQuarterPeriod(year, 1);
  } else if (month >= 10 && month <= 12) {
    return createQuarterPeriod(year, 2);
  } else if (month >= 1 && month <= 3) {
    return createQuarterPeriod(year - 1, 3);
  } else {
    // Month 4, 5, 6
    return createQuarterPeriod(year - 1, 4);
  }
}

/**
 * Generates an ordered chronological list of Australian FY QuarterPeriods
 * from a start quarter up to an end quarter.
 */
export function generateQuarterRange(startQuarterId: string, endQuarterId: string): QuarterPeriod[] {
  const all = generateAllQuarters(2020, 2030);
  const startIdx = all.findIndex(q => q.id === startQuarterId);
  const endIdx = all.findIndex(q => q.id === endQuarterId);

  if (startIdx === -1 && endIdx === -1) {
    return all.slice(0, 16);
  }
  const actualStart = startIdx !== -1 ? startIdx : 0;
  const actualEnd = endIdx !== -1 ? endIdx : all.length - 1;

  if (actualStart <= actualEnd) {
    return all.slice(actualStart, actualEnd + 1);
  }
  return all.slice(actualEnd, actualStart + 1);
}

/**
 * Generates all Australian FY Quarter periods between given start and end financial years.
 * Default: FY2020-21 (starts 1 July 2020) through FY2027-28.
 */
export function generateAllQuarters(fromFyYear = 2020, toFyYear = 2028): QuarterPeriod[] {
  const quarters: QuarterPeriod[] = [];
  for (let fy = fromFyYear; fy <= toFyYear; fy++) {
    for (let q: QuarterNumber = 1; q <= 4; q = (q + 1) as QuarterNumber) {
      quarters.push(createQuarterPeriod(fy, q));
    }
  }
  return quarters;
}

/**
 * Checks if a given date string falls strictly within a quarter period.
 * Comparison is exact calendar string comparison (YYYY-MM-DD >= start && <= end).
 */
export function isDateInQuarter(dateStr: string, quarter: QuarterPeriod): boolean {
  const canonical = parseCalendarDate(dateStr);
  if (!canonical) return false;
  return canonical >= quarter.startDate && canonical <= quarter.endDate;
}
