import { v4 as uuidv4 } from 'uuid'; 
import { addDays, subDays, isValid } from 'date-fns';
import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory, 
  FilesState, 
  MappingState, 
  ProcessedDataState,
  RawSpreadsheetRow
} from '../types';

/**
 * Parse a date value from various formats (Excel serial, string, Date object)
 * @param val - The value to parse
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
const parseDateLoose = (val: string | number | Date | null | undefined): string | null => {
  if (!val) return null;
  // If it's Excel serial date
  if (typeof val === 'number') {
    // Excel date to JS date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isValid(date) ? date.toISOString().split('T')[0] : null;
  }
  // Try string parsing
  const str = String(val).trim();
  const d = new Date(str);
  if (isValid(d)) return d.toISOString().split('T')[0];
  
  return null;
};

/**
 * Parse a numeric value from various formats (number, string, accounting format)
 * @param val - The value to parse
 * @returns Parsed number or 0 if invalid
 */
const parseNumber = (val: string | number | null | undefined): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  let str = String(val).trim();
  
  // Handle accounting format (123.45) which means negative
  const isNegative = str.startsWith('(') && str.endsWith(')');
  
  // Remove non-numeric characters except dot and minus
  str = str.replace(/[^0-9.-]/g, '');
  
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  return isNegative ? -Math.abs(num) : num;
};

/**
 * Generate a unique identifier for records
 * @returns A unique string identifier
 */
const genId = (): string => uuidv4();

/**
 * Generate initial column mappings by matching headers to expected field names
 * @param otaData - Raw OTA spreadsheet data
 * @param glData - Raw GL spreadsheet data
 * @returns Initial mapping suggestions for OTA and GL columns
 */
export const generateInitialMappings = (otaData: RawSpreadsheetRow[], glData: RawSpreadsheetRow[]): MappingState => {
  const otaHeaders = otaData.length > 0 ? Object.keys(otaData[0]) : [];
  const glHeaders = glData.length > 0 ? Object.keys(glData[0]) : [];

  const findMatch = (headers: string[], keywords: string[]): string => {
    return headers.find(h => 
      keywords.some(k => h.toLowerCase().includes(k.toLowerCase()))
    ) || '';
  };

  return {
    ota: {
      reservation_id: findMatch(otaHeaders, ['reference', 'booking', 'id']),
      check_in_date: findMatch(otaHeaders, ['check-in', 'check in', 'start']),
      check_out_date: findMatch(otaHeaders, ['checkout', 'check out', 'end']),
      net_payout: findMatch(otaHeaders, ['net', 'payout']),
      payout_date: findMatch(otaHeaders, ['payout date', 'paid on']),
      guest_name: findMatch(otaHeaders, ['guest', 'name']),
      gross_amount: findMatch(otaHeaders, ['amount', 'gross', 'total']),
      ota_fees: findMatch(otaHeaders, ['commission', 'fee', 'charge'])
    },
    gl: {
      date: findMatch(glHeaders, ['date']),
      account_name: findMatch(glHeaders, ['account', 'code']),
      description: findMatch(glHeaders, ['description', 'detail']),
      contact: findMatch(glHeaders, ['contact', 'payee', 'payer']),
      debit_amount: findMatch(glHeaders, ['debit', 'expense', 'out', 'amount']),
      credit_amount: findMatch(glHeaders, ['credit', 'income', 'in', 'amount']),
      source_type: findMatch(glHeaders, ['source'])
    }
  };
};

/**
 * Process OTA and GL data, categorize expenses, and reconcile transactions
 * @param files - Raw data from uploaded files
 * @param config - User configuration including dates and fee structure
 * @param mappings - Column mappings from user input
 * @returns Processed data ready for review and invoice generation
 */
export const processData = (
  files: FilesState, 
  config: ConfigState, 
  mappings: MappingState
): ProcessedDataState => {
  const { periodStart, periodEnd } = config;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  // 1. Normalize OTA Data
  const otaBookings: CanonicalOtaRow[] = files.otaRaw
    .map(row => {
      const checkIn = parseDateLoose(row[mappings.ota.check_in_date]);
      const payoutDate = parseDateLoose(row[mappings.ota.payout_date]);
      
      return {
        id: genId(),
        reservation_id: String(row[mappings.ota.reservation_id] || ''),
        check_in_date: checkIn || '',
        check_out_date: parseDateLoose(row[mappings.ota.check_out_date]) || undefined,
        guest_name: String(row[mappings.ota.guest_name] || ''),
        gross_amount: parseNumber(row[mappings.ota.gross_amount]),
        ota_fees: parseNumber(row[mappings.ota.ota_fees]),
        net_payout: parseNumber(row[mappings.ota.net_payout]),
        payout_date: payoutDate || '',
        originalData: row
      };
    })
    .filter(row => {
      // Filter by reporting period (check_in or payout date)
      const d = row.check_in_date ? new Date(row.check_in_date) : (row.payout_date ? new Date(row.payout_date) : null);
      if (!d || !isValid(d)) return false;
      return d >= start && d <= end;
    });

  // Check if Debit and Credit are mapped to the same column (Single column mode)
  const isSingleColGl = mappings.gl.debit_amount === mappings.gl.credit_amount && !!mappings.gl.debit_amount;

  // 2. Normalize GL Data
  const allGlRows: CanonicalGlRow[] = files.glRaw
    .map(row => {
      const dateStr = parseDateLoose(row[mappings.gl.date]);
      const account = String(row[mappings.gl.account_name] || '').trim();
      
      // Look up classification
      let defaultCat: ExpenseCategory | undefined = undefined;
      const mapEntry = Object.entries(files.classificationMap).find(([k, v]) => k.toLowerCase() === account.toLowerCase());
      if (mapEntry) {
        defaultCat = mapEntry[1] as ExpenseCategory;
      }

      let debit = parseNumber(row[mappings.gl.debit_amount]);
      let credit = parseNumber(row[mappings.gl.credit_amount]);

      // Logic for single column or cross-column clean up
      if (isSingleColGl) {
        // If single column: Positive usually means Income (Credit) or Expense (Debit) depending on bank.
        // Standard convention for "Amount" column in many exports:
        // +ve = Credit (In), -ve = Debit (Out).
        const val = debit; // Same as credit
        if (val > 0) {
          credit = val;
          debit = 0;
        } else {
          debit = Math.abs(val);
          credit = 0;
        }
      } else {
        // Separate columns.
        // Handle negative values (refunds/reversals).
        // If Debit is negative, it's actually Credit.
        if (debit < 0) {
          credit += Math.abs(debit);
          debit = 0;
        }
        // If Credit is negative, it's actually Debit.
        if (credit < 0) {
          debit += Math.abs(credit);
          credit = 0;
        }
      }

      return {
        id: genId(),
        date: dateStr || '',
        account_name: account,
        source_type: String(row[mappings.gl.source_type] || ''),
        description: String(row[mappings.gl.description] || ''),
        contact: String(row[mappings.gl.contact] || ''),
        debit_amount: debit,
        credit_amount: credit,
        default_category: defaultCat,
        include_flag: false, // will set logic below
        is_reconciled_ota: false,
        originalData: row
      };
    })
    .filter(row => {
      const d = new Date(row.date);
      return isValid(d) && d >= start && d <= end;
    });

  const glIncome = allGlRows.filter(r => r.credit_amount > 0);
  const glExpenses = allGlRows.filter(r => r.debit_amount > 0);

  // 3. Reconcile OTA Payouts
  let reconciledCount = 0;
  
  otaBookings.forEach(ota => {
    // Attempt to find GL income row
    const payoutDate = new Date(ota.payout_date || ota.check_in_date);
    const minDate = subDays(payoutDate, 3);
    const maxDate = addDays(payoutDate, 3);

    const match = glIncome.find(gl => {
      if (gl.is_reconciled_ota) return false;
      const glDate = new Date(gl.date);
      if (glDate < minDate || glDate > maxDate) return false;

      const amountDiff = Math.abs(gl.credit_amount - ota.net_payout);
      if (amountDiff > 2) return false;

      const text = (gl.description + ' ' + gl.contact).toLowerCase();
      const guest = ota.guest_name.toLowerCase();
      const ref = ota.reservation_id.toLowerCase();
      
      if (text.includes('booking') || text.includes('payout') || (guest && text.includes(guest)) || (ref && text.includes(ref))) {
        return true;
      }
      return false;
    });

    if (match) {
      match.is_reconciled_ota = true;
      match.note = `Reconciled to OTA Booking ${ota.reservation_id}`;
      reconciledCount++;
    }
  });

  // 4. Initial Classification Logic for Expenses
  const autoReimbursables: CanonicalGlRow[] = [];
  const reviewRows: CanonicalGlRow[] = [];

  glExpenses.forEach(row => {
    if (row.default_category === ExpenseCategory.REIMBURSABLE) {
      row.assigned_category = ExpenseCategory.REIMBURSABLE;
      row.include_flag = true;
      autoReimbursables.push(row);
    } else if (row.default_category === ExpenseCategory.MANAGER_ONLY) {
      row.assigned_category = ExpenseCategory.MANAGER_ONLY;
      row.include_flag = false;
      // Optionally add to review if visibility needed, skipping for auto-flow
    } else if (row.default_category === ExpenseCategory.OWNER_ONLY) {
       row.assigned_category = ExpenseCategory.OWNER_ONLY;
       row.include_flag = false; 
    } else {
      row.assigned_category = row.default_category || ExpenseCategory.REVIEW_ALWAYS;
      row.include_flag = false;
      reviewRows.push(row);
    }
  });

  return {
    otaBookings,
    glIncome,
    glExpenses,
    reviewRows,
    autoReimbursables,
    stats: {
      totalOtaRevenue: otaBookings.reduce((sum, r) => sum + r.gross_amount, 0),
      totalOtaNet: otaBookings.reduce((sum, r) => sum + r.net_payout, 0),
      reconciledCount,
      unreconciledCount: otaBookings.length - reconciledCount
    }
  };
};