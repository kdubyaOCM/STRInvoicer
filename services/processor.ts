import { addDays, subDays } from 'date-fns';
import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory, 
  FilesState, 
  MappingState, 
  ProcessedDataState 
} from '../types';
import { parseCalendarDate, getQuarterForDate } from './dateUtils';
import { toCents, centsToDollars } from './moneyUtils';
import { buildQuarterlyLedger } from './ledgerEngine';

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
      reservation_id: findMatch(otaHeaders, ['reference', 'booking', 'reservation', 'id']),
      check_in_date: findMatch(otaHeaders, ['check-in', 'check in', 'start', 'arrival']),
      check_out_date: findMatch(otaHeaders, ['checkout', 'check out', 'end', 'departure']),
      net_payout: findMatch(otaHeaders, ['net', 'payout', 'paid to host', 'disbursement']),
      payout_date: findMatch(otaHeaders, ['payout date', 'paid on', 'disbursement date', 'settlement date']),
      guest_name: findMatch(otaHeaders, ['guest', 'name', 'client']),
      gross_amount: findMatch(otaHeaders, ['gross', 'total amount', 'rent', 'subtotal']),
      ota_fees: findMatch(otaHeaders, ['commission', 'fee', 'charge', 'host fee'])
    },
    gl: {
      date: findMatch(glHeaders, ['date', 'trans date', 'effective date']),
      account_name: findMatch(glHeaders, ['account', 'code', 'category']),
      description: findMatch(glHeaders, ['description', 'detail', 'memo', 'narration']),
      contact: findMatch(glHeaders, ['contact', 'payee', 'payer', 'vendor']),
      debit_amount: findMatch(glHeaders, ['debit', 'expense', 'out', 'payment', 'amount']),
      credit_amount: findMatch(glHeaders, ['credit', 'income', 'in', 'deposit', 'amount']),
      source_type: findMatch(glHeaders, ['source', 'type', 'journal'])
    }
  };
};

export const processData = (
  files: FilesState, 
  config: ConfigState, 
  mappings: MappingState
): ProcessedDataState => {
  // 1. Normalize OTA Data with Integer Cents and Timezone-Neutral Dates
  const otaBookings: CanonicalOtaRow[] = files.otaRaw
    .map(row => {
      const checkIn = parseCalendarDate(row[mappings.ota.check_in_date]);
      const checkOut = parseCalendarDate(row[mappings.ota.check_out_date]);
      const payoutDate = parseCalendarDate(row[mappings.ota.payout_date]) || checkIn;

      const grossCents = toCents(row[mappings.ota.gross_amount]);
      const otaFeesCents = toCents(row[mappings.ota.ota_fees]);
      let netCents = toCents(row[mappings.ota.net_payout]);
      if (netCents === 0 && grossCents > 0) {
        netCents = Math.max(0, grossCents - otaFeesCents);
      }

      const effectiveDate = payoutDate || checkIn || '';
      const quarter = effectiveDate ? getQuarterForDate(effectiveDate) : undefined;

      return {
        id: genId(),
        reservation_id: String(row[mappings.ota.reservation_id] || '').trim(),
        check_in_date: checkIn || '',
        check_out_date: checkOut || undefined,
        guest_name: String(row[mappings.ota.guest_name] || '').trim(),
        gross_amount: centsToDollars(grossCents),
        ota_fees: centsToDollars(otaFeesCents),
        net_payout: centsToDollars(netCents),
        gross_amount_cents: grossCents,
        ota_fees_cents: otaFeesCents,
        net_payout_cents: netCents,
        payout_date: payoutDate || '',
        quarterId: quarter?.id,
        originalData: row
      };
    })
    .filter(row => row.check_in_date || row.payout_date);

  // Check if Debit and Credit are mapped to the same column (Single column mode)
  const isSingleColGl = mappings.gl.debit_amount === mappings.gl.credit_amount && !!mappings.gl.debit_amount;

  // 2. Normalize GL Data
  const allGlRows: CanonicalGlRow[] = files.glRaw
    .map(row => {
      const dateStr = parseCalendarDate(row[mappings.gl.date]);
      const account = String(row[mappings.gl.account_name] || '').trim();
      
      // Look up classification in map
      let defaultCat: ExpenseCategory | undefined = undefined;
      const mapEntry = Object.entries(files.classificationMap).find(
        ([k]) => k.toLowerCase() === account.toLowerCase()
      );
      if (mapEntry) {
        defaultCat = mapEntry[1] as ExpenseCategory;
      }

      let debitCents = toCents(row[mappings.gl.debit_amount]);
      let creditCents = toCents(row[mappings.gl.credit_amount]);

      if (isSingleColGl) {
        const val = debitCents;
        if (val > 0) {
          creditCents = val;
          debitCents = 0;
        } else {
          debitCents = Math.abs(val);
          creditCents = 0;
        }
      } else {
        // Handle negative amounts
        if (debitCents < 0) {
          creditCents += Math.abs(debitCents);
          debitCents = 0;
        }
        if (creditCents < 0) {
          debitCents += Math.abs(creditCents);
          creditCents = 0;
        }
      }

      const quarter = dateStr ? getQuarterForDate(dateStr) : undefined;

      return {
        id: genId(),
        date: dateStr || '',
        account_name: account,
        source_type: String(row[mappings.gl.source_type] || ''),
        description: String(row[mappings.gl.description] || ''),
        contact: String(row[mappings.gl.contact] || ''),
        debit_amount: centsToDollars(debitCents),
        credit_amount: centsToDollars(creditCents),
        debit_amount_cents: debitCents,
        credit_amount_cents: creditCents,
        default_category: defaultCat,
        include_flag: false,
        is_reconciled_ota: false,
        quarterId: quarter?.id,
        originalData: row
      };
    })
    .filter(row => Boolean(row.date));

  const glIncome = allGlRows.filter(r => r.credit_amount_cents > 0);
  const glExpenses = allGlRows.filter(r => r.debit_amount_cents > 0);

  // 3. Reconcile OTA Payouts to GL Cash Receipts
  let reconciledCount = 0;

  otaBookings.forEach(ota => {
    const rawPayoutDate = ota.payout_date || ota.check_in_date;
    if (!rawPayoutDate) return;

    const [y, m, d] = rawPayoutDate.split('-').map(Number);
    const payoutJsDate = new Date(y, m - 1, d);
    const minDate = subDays(payoutJsDate, 5);
    const maxDate = addDays(payoutJsDate, 5);

    const match = glIncome.find(gl => {
      if (gl.is_reconciled_ota) return false;
      const [gy, gm, gd] = gl.date.split('-').map(Number);
      const glJsDate = new Date(gy, gm - 1, gd);
      if (glJsDate < minDate || glJsDate > maxDate) return false;

      // Match amount within 200 cents ($2.00)
      const amountDiff = Math.abs(gl.credit_amount_cents - ota.net_payout_cents);
      if (amountDiff > 200) return false;

      const text = (gl.description + ' ' + gl.contact).toLowerCase();
      const guest = ota.guest_name.toLowerCase();
      const ref = ota.reservation_id.toLowerCase();
      
      return (
        text.includes('booking') || 
        text.includes('payout') || 
        text.includes('airbnb') ||
        (guest && text.includes(guest)) || 
        (ref && text.includes(ref))
      );
    });

    if (match) {
      match.is_reconciled_ota = true;
      match.note = `Reconciled to Booking ${ota.reservation_id}`;
      reconciledCount++;
    }
  });

  // 4. Initial Classification Logic for GL Transactions
  const autoReimbursables: CanonicalGlRow[] = [];
  const reviewRows: CanonicalGlRow[] = [];

  // Review all GL expenses AND any unreconciled GL transactions (e.g. general receipts, bank items)
  const seenIds = new Set<string>();
  const rowsToClassify: CanonicalGlRow[] = [];

  glExpenses.forEach(r => {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      rowsToClassify.push(r);
    }
  });

  glIncome.forEach(r => {
    if (!r.is_reconciled_ota && !seenIds.has(r.id)) {
      seenIds.add(r.id);
      rowsToClassify.push(r);
    }
  });

  rowsToClassify.forEach(row => {
    if (row.default_category === ExpenseCategory.REIMBURSABLE) {
      row.assigned_category = ExpenseCategory.REIMBURSABLE;
      row.include_flag = true;
      autoReimbursables.push(row);
    } else if (row.default_category === ExpenseCategory.MANAGER_ONLY) {
      row.assigned_category = ExpenseCategory.MANAGER_ONLY;
      row.include_flag = false;
      reviewRows.push(row);
    } else if (row.default_category === ExpenseCategory.OWNER_ONLY) {
      row.assigned_category = ExpenseCategory.OWNER_ONLY;
      row.include_flag = false;
      reviewRows.push(row);
    } else if (row.default_category === ExpenseCategory.SHARED) {
      row.assigned_category = ExpenseCategory.SHARED;
      row.split_percent = 50;
      row.include_flag = true;
      reviewRows.push(row);
    } else if (row.default_category === ExpenseCategory.INCOME) {
      row.assigned_category = ExpenseCategory.INCOME;
      row.include_flag = true;
      row.reconciliation_mode = 'DIRECT_INCOME';
      reviewRows.push(row);
    } else if (row.default_category === ExpenseCategory.EXCLUDE) {
      row.assigned_category = ExpenseCategory.EXCLUDE;
      row.include_flag = false;
      reviewRows.push(row);
    } else {
      row.assigned_category = row.default_category || ExpenseCategory.REVIEW_ALWAYS;
      row.include_flag = false;
      reviewRows.push(row);
    }
  });

  // 5. Build Quarterly Ledger
  const quarterlyLedger = buildQuarterlyLedger({
    otaBookings,
    glIncome,
    glExpenses,
    config
  });

  const totalOtaRevenue = otaBookings.reduce((sum, r) => sum + r.gross_amount, 0);
  const totalOtaNet = otaBookings.reduce((sum, r) => sum + r.net_payout, 0);

  return {
    otaBookings,
    glIncome,
    glExpenses,
    reviewRows,
    autoReimbursables,
    quarterlyLedger,
    selectedQuarterId: quarterlyLedger.statements[0]?.quarter.id,
    stats: {
      totalOtaRevenue,
      totalOtaNet,
      reconciledCount,
      unreconciledCount: Math.max(0, otaBookings.length - reconciledCount)
    }
  };
};
