
import { addDays, subDays, isValid } from 'date-fns';
import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory, 
  FilesState, 
  MappingState, 
  ProcessedDataState 
} from '../types';

// Helper for loose date parsing
const parseDateLoose = (val: any): string | null => {
  if (!val) return null;
  // If it's Excel serial date
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isValid(date) ? date.toISOString().split('T')[0] : null;
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (isValid(d)) return d.toISOString().split('T')[0];
  return null;
};

const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val).trim();
  const isNegative = str.startsWith('(') && str.endsWith(')');
  str = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
};

// Generate deterministic-enough random ID
const genId = () => Math.random().toString(36).substring(2, 9);

export const generateInitialMappings = (otaData: any[], glData: any[]): MappingState => {
  const otaHeaders = otaData.length > 0 ? Object.keys(otaData[0]) : [];
  const glHeaders = glData.length > 0 ? Object.keys(glData[0]) : [];

  const findMatch = (headers: string[], keywords: string[]) => {
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

export const processData = (
  files: FilesState, 
  config: ConfigState, 
  mappings: MappingState
): ProcessedDataState => {
  const { periodStart, periodEnd } = config;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

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
      const d = row.check_in_date ? new Date(row.check_in_date) : (row.payout_date ? new Date(row.payout_date) : null);
      if (!d || !isValid(d)) return false;
      return d >= start && d <= end;
    });

  const isSingleColGl = mappings.gl.debit_amount === mappings.gl.credit_amount && !!mappings.gl.debit_amount;

  const allGlRows: CanonicalGlRow[] = files.glRaw
    .map(row => {
      const dateStr = parseDateLoose(row[mappings.gl.date]);
      const account = String(row[mappings.gl.account_name] || '').trim();
      let defaultCat: ExpenseCategory | undefined = undefined;
      const mapEntry = Object.entries(files.classificationMap).find(([k]) => k.toLowerCase() === account.toLowerCase());
      if (mapEntry) {
        defaultCat = mapEntry[1] as ExpenseCategory;
      }

      let debit = parseNumber(row[mappings.gl.debit_amount]);
      let credit = parseNumber(row[mappings.gl.credit_amount]);

      if (isSingleColGl) {
        const val = debit;
        if (val > 0) {
          credit = val;
          debit = 0;
        } else {
          debit = Math.abs(val);
          credit = 0;
        }
      } else {
        if (debit < 0) {
          credit += Math.abs(debit);
          debit = 0;
        }
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
        include_flag: false,
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

  let reconciledCount = 0;
  otaBookings.forEach(ota => {
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
      return text.includes('booking') || text.includes('payout') || (guest && text.includes(guest)) || (ref && text.includes(ref));
    });

    if (match) {
      match.is_reconciled_ota = true;
      match.note = `Reconciled to OTA Booking ${ota.reservation_id}`;
      reconciledCount++;
    }
  });

  const autoReimbursables: CanonicalGlRow[] = [];
  const reviewRows: CanonicalGlRow[] = [];

  glExpenses.forEach(row => {
    if (row.default_category === ExpenseCategory.REIMBURSABLE) {
      row.assigned_category = ExpenseCategory.REIMBURSABLE;
      row.include_flag = true;
      autoReimbursables.push(row);
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
