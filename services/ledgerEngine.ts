import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory, 
  LedgerEvent, 
  LedgerEventType, 
  QuarterPeriod, 
  QuarterStatement, 
  QuarterlyLedger 
} from '../types';
import { 
  calculateClosingBalanceCents, 
  calculateManagementFeeCents, 
  calculateSharedCents, 
  centsToDollars, 
  toCents 
} from './moneyUtils';
import { 
  formatCalendarDate, 
  generateQuarterRange, 
  getQuarterForDate, 
  isDateInQuarter, 
  parseCalendarDate 
} from './dateUtils';

interface BuildLedgerParams {
  otaBookings: CanonicalOtaRow[];
  glIncome: CanonicalGlRow[];
  glExpenses: CanonicalGlRow[];
  config: ConfigState;
}

/**
 * Builds the complete multi-quarter owner ledger.
 * Guarantees that:
 * 1. For every quarter: Closing Balance = Opening Balance + Total Credits - Total Debits
 * 2. Closing Balance of Q[i] === Opening Balance of Q[i+1]
 * 3. All calculations are performed in integer cents.
 */
export function buildQuarterlyLedger(params: BuildLedgerParams): QuarterlyLedger {
  const { otaBookings, glIncome, glExpenses, config } = params;

  // Determine quarter range
  const startQuarterId = config.startQuarterId || 'FY2020-21-Q1';
  // If endQuarterId is not provided, detect from data or default to recent quarter (e.g. FY2024-25-Q4)
  let endQuarterId = config.endQuarterId;
  if (!endQuarterId) {
    const dates: string[] = [];
    otaBookings.forEach(b => {
      if (b.payout_date) dates.push(b.payout_date);
      if (b.check_in_date) dates.push(b.check_in_date);
    });
    glIncome.forEach(g => { if (g.date) dates.push(g.date); });
    glExpenses.forEach(g => { if (g.date) dates.push(g.date); });

    if (dates.length > 0) {
      dates.sort();
      const latestDate = dates[dates.length - 1];
      const latestQuarter = getQuarterForDate(latestDate);
      endQuarterId = latestQuarter.id;
    } else {
      endQuarterId = 'FY2024-25-Q4';
    }
  }

  const quarters = generateQuarterRange(startQuarterId, endQuarterId);
  const initialOpeningBalanceCents = config.initialOpeningBalanceCents || 0;

  // Build unified GL state map so reviewRows edits and classification changes are respected across all pipelines
  const glStateMap = new Map<string, CanonicalGlRow>();
  glExpenses.forEach(r => glStateMap.set(r.id, r));
  glIncome.forEach(r => {
    if (!glStateMap.has(r.id)) {
      glStateMap.set(r.id, r);
    }
  });

  let runningBalanceCents = initialOpeningBalanceCents;
  const statements: QuarterStatement[] = [];
  const quarterMap: Record<string, QuarterStatement> = {};

  let totalHistoricalCreditsCents = 0;
  let totalHistoricalDebitsCents = 0;

  for (let i = 0; i < quarters.length; i++) {
    const quarter = quarters[i];
    const openingBalanceCents = runningBalanceCents;

    // Track processed GL IDs to prevent any duplicate execution in the same quarter
    const processedGlIds = new Set<string>();

    // 1. Gather all events belonging to this quarter by effective cash date
    const creditEvents: LedgerEvent[] = [];
    const debitEvents: LedgerEvent[] = [];
    const quarterBookings: CanonicalOtaRow[] = [];
    const reimbursableExpenses: CanonicalGlRow[] = [];
    const directIncomeRows: CanonicalGlRow[] = [];

    let rentalIncomeCents = 0;
    let directRentalIncomeCents = 0;
    let otherCreditsCents = 0;
    let reimbursableExpenseCents = 0;
    let sharedExpenseCents = 0;
    let ownerPayoutsCents = 0;
    let guestRefundsCents = 0;

    // Cash Receipt Recognition:
    // A. Reconciled GL Income Rows
    // If GL Income row falls in this quarter:
    glIncome.forEach(glOriginal => {
      // Pick up latest classification if row was in glExpenses/reviewRows
      const gl = glStateMap.get(glOriginal.id) || glOriginal;

      const glDate = parseCalendarDate(gl.date);
      if (!glDate || !isDateInQuarter(glDate, quarter)) return;

      const descLower = (gl.description + ' ' + gl.contact + ' ' + gl.account_name).toLowerCase();
      const amountCents = gl.credit_amount_cents || gl.debit_amount_cents || toCents(gl.credit_amount || gl.debit_amount);
      if (amountCents <= 0) return;

      const cat = gl.assigned_category || gl.default_category;

      // CRITICAL USER REQUIREMENT:
      // "If these are classified as anything other than Income/Revenue then they need to be excluded as a credit."
      if (cat && cat !== ExpenseCategory.INCOME) {
        // If it was classified as REIMBURSABLE or SHARED, route to reimbursable debits
        if (cat === ExpenseCategory.REIMBURSABLE) {
          reimbursableExpenseCents += amountCents;
          reimbursableExpenses.push(gl);
          debitEvents.push({
            id: `LE-GL-DR-${gl.id}`,
            quarterId: quarter.id,
            effectiveDate: glDate,
            source: 'GL',
            sourceId: gl.id,
            transactionType: LedgerEventType.REIMBURSABLE_EXPENSE,
            side: 'DEBIT',
            description: gl.description || gl.account_name || 'Reimbursable Expense',
            accountName: gl.account_name,
            contact: gl.contact,
            amountCents
          });
        } else if (cat === ExpenseCategory.SHARED) {
          const splitPercent = gl.split_percent;
          const allocatedCents = calculateSharedCents(amountCents, splitPercent);
          if (allocatedCents > 0 || splitPercent === 0) {
            sharedExpenseCents += allocatedCents;
            reimbursableExpenses.push(gl);
            debitEvents.push({
              id: `LE-GL-DR-SH-${gl.id}`,
              quarterId: quarter.id,
              effectiveDate: glDate,
              source: 'GL',
              sourceId: gl.id,
              transactionType: LedgerEventType.SHARED_EXPENSE,
              side: 'DEBIT',
              description: `${gl.description || gl.account_name} (Split ${splitPercent ?? 50}%)`,
              accountName: gl.account_name,
              contact: gl.contact,
              amountCents: allocatedCents,
              originalAmountCents: amountCents,
              splitPercent: splitPercent ?? 50
            });
          }
        }
        // If OWNER_ONLY, MANAGER_ONLY, EXCLUDE, or REVIEW_ALWAYS:
        // EXCLUDED AS A CREDIT!
        processedGlIds.add(gl.id);
        return;
      }

      // Check if this is an Owner Top-Up or Owner Deposit
      if (descLower.includes('owner top') || descLower.includes('owner deposit') || descLower.includes('funds from owner')) {
        otherCreditsCents += amountCents;
        creditEvents.push({
          id: `LE-GL-CR-${gl.id}`,
          quarterId: quarter.id,
          effectiveDate: glDate,
          source: 'GL',
          sourceId: gl.id,
          transactionType: LedgerEventType.OWNER_FUNDS_IN,
          side: 'CREDIT',
          description: gl.description || 'Owner Funds Deposit',
          accountName: gl.account_name,
          contact: gl.contact,
          amountCents
        });
        processedGlIds.add(gl.id);
        return;
      }

      // Check if this is a Supplier Refund / Rebate
      if (descLower.includes('refund') || descLower.includes('rebate')) {
        otherCreditsCents += amountCents;
        creditEvents.push({
          id: `LE-GL-CR-${gl.id}`,
          quarterId: quarter.id,
          effectiveDate: glDate,
          source: 'GL',
          sourceId: gl.id,
          transactionType: LedgerEventType.EXPENSE_REFUND,
          side: 'CREDIT',
          description: gl.description || 'Supplier Refund / Rebate',
          accountName: gl.account_name,
          contact: gl.contact,
          amountCents
        });
        processedGlIds.add(gl.id);
        return;
      }

      // If matched to an OTA booking (to prevent double counting)
      if (gl.is_reconciled_ota || gl.reconciliation_mode === 'MATCHED_OTA') {
        processedGlIds.add(gl.id);
        return;
      }

      // If explicitly flagged as duplicate
      if (gl.reconciliation_mode === 'DUPLICATE_EXCLUDE') {
        processedGlIds.add(gl.id);
        return;
      }

      // Only recognized as Rental Income (Owner Credit) if classified as INCOME
      if (cat === ExpenseCategory.INCOME) {
        rentalIncomeCents += amountCents;
        directRentalIncomeCents += amountCents;
        directIncomeRows.push(gl);
        creditEvents.push({
          id: `LE-GL-CR-${gl.id}`,
          quarterId: quarter.id,
          effectiveDate: glDate,
          source: 'GL',
          sourceId: gl.id,
          transactionType: LedgerEventType.RENTAL_INCOME,
          side: 'CREDIT',
          description: gl.description || 'Rental / Direct Revenue Received',
          accountName: gl.account_name,
          contact: gl.contact,
          amountCents,
          note: gl.note
        });
        processedGlIds.add(gl.id);
      }
    });

    // B. OTA Bookings Recognition:
    // Recognize OTA bookings whose CASH PAYOUT date falls into this quarter.
    // (If payout_date is missing, fallback to check_in_date).
    otaBookings.forEach(booking => {
      const effectiveDate = parseCalendarDate(booking.payout_date || booking.check_in_date);
      if (!effectiveDate || !isDateInQuarter(effectiveDate, quarter)) return;

      quarterBookings.push(booking);

      const netCents = booking.net_payout_cents || toCents(booking.net_payout);
      if (netCents > 0) {
        rentalIncomeCents += netCents;
        creditEvents.push({
          id: `LE-OTA-${booking.id}`,
          quarterId: quarter.id,
          effectiveDate,
          source: 'OTA',
          sourceId: booking.id,
          transactionType: LedgerEventType.RENTAL_INCOME,
          side: 'CREDIT',
          description: `${booking.guest_name ? booking.guest_name + ' - ' : ''}OTA Payout (Ref: ${booking.reservation_id})`,
          reference: booking.reservation_id,
          amountCents: netCents
        });
      }
    });

    // C. GL Expenses Recognition (Reimbursable & Shared Expenses, Owner Payouts, Direct Revenue, etc.)
    glExpenses.forEach(row => {
      if (processedGlIds.has(row.id)) return;

      const expDate = parseCalendarDate(row.date);
      if (!expDate || !isDateInQuarter(expDate, quarter)) return;

      const descLower = (row.description + ' ' + row.contact + ' ' + row.account_name).toLowerCase();
      const debitCents = row.debit_amount_cents || toCents(row.debit_amount);
      const creditCents = row.credit_amount_cents || toCents(row.credit_amount);
      const rowAmountCents = debitCents > 0 ? debitCents : creditCents;
      if (rowAmountCents <= 0) return;

      // Check if this was an Owner Payout / Transfer from property manager to owner
      if (descLower.includes('owner distribution') || descLower.includes('owner transfer') || descLower.includes('paid to owner') || descLower.includes('owner payout')) {
        ownerPayoutsCents += rowAmountCents;
        debitEvents.push({
          id: `LE-GL-DR-PAYOUT-${row.id}`,
          quarterId: quarter.id,
          effectiveDate: expDate,
          source: 'GL',
          sourceId: row.id,
          transactionType: LedgerEventType.OWNER_PAYOUT,
          side: 'DEBIT',
          description: row.description || 'Distribution Paid to Owner',
          accountName: row.account_name,
          contact: row.contact,
          amountCents: rowAmountCents
        });
        processedGlIds.add(row.id);
        return;
      }

      // Check if this was a guest refund / chargeback borne by owner
      if (descLower.includes('chargeback') || descLower.includes('guest refund')) {
        guestRefundsCents += rowAmountCents;
        debitEvents.push({
          id: `LE-GL-DR-REFUND-${row.id}`,
          quarterId: quarter.id,
          effectiveDate: expDate,
          source: 'GL',
          sourceId: row.id,
          transactionType: LedgerEventType.GUEST_REFUND,
          side: 'DEBIT',
          description: row.description || 'Guest Refund / Chargeback',
          accountName: row.account_name,
          contact: row.contact,
          amountCents: rowAmountCents
        });
        processedGlIds.add(row.id);
        return;
      }

      // Expense Category Evaluation
      const cat = row.assigned_category || row.default_category;

      // 1. Income / Revenue Classification
      if (cat === ExpenseCategory.INCOME) {
        // Check if explicitly marked as a duplicate of already recognized revenue
        if (row.reconciliation_mode === 'DUPLICATE_EXCLUDE') {
          processedGlIds.add(row.id);
          return;
        }

        // Check if matched to an existing OTA booking
        if (row.reconciliation_mode === 'MATCHED_OTA') {
          // Booking was already loaded in earlier data load, prevent double counting
          processedGlIds.add(row.id);
          return;
        }

        // Direct / Additional Rental Revenue (Owner Credit)
        directRentalIncomeCents += rowAmountCents;
        rentalIncomeCents += rowAmountCents;
        directIncomeRows.push(row);

        creditEvents.push({
          id: `LE-GL-CR-REV-${row.id}`,
          quarterId: quarter.id,
          effectiveDate: expDate,
          source: 'GL',
          sourceId: row.id,
          transactionType: LedgerEventType.RENTAL_INCOME,
          side: 'CREDIT',
          description: `Direct Revenue: ${row.description || 'Guest Booking'}${row.contact && !row.description.includes(row.contact) ? ' • ' + row.contact : ''}`,
          accountName: row.account_name,
          contact: row.contact,
          amountCents: rowAmountCents,
          note: row.note || 'Direct Guest Rental Revenue'
        });
        processedGlIds.add(row.id);
        return;
      }

      // 2. Reimbursable & Shared Expenses
      // CRITICAL: Any row classified as OWNER_ONLY, MANAGER_ONLY, EXCLUDE, or REVIEW_ALWAYS is excluded as a credit!
      if (cat === ExpenseCategory.REIMBURSABLE || (row.include_flag && cat !== ExpenseCategory.SHARED && cat !== ExpenseCategory.EXCLUDE && cat !== ExpenseCategory.MANAGER_ONLY && cat !== ExpenseCategory.OWNER_ONLY)) {
        reimbursableExpenseCents += rowAmountCents;
        reimbursableExpenses.push(row);
        debitEvents.push({
          id: `LE-GL-DR-${row.id}`,
          quarterId: quarter.id,
          effectiveDate: expDate,
          source: 'GL',
          sourceId: row.id,
          transactionType: LedgerEventType.REIMBURSABLE_EXPENSE,
          side: 'DEBIT',
          description: row.description || row.account_name || 'Reimbursable Expense',
          accountName: row.account_name,
          contact: row.contact,
          amountCents: rowAmountCents
        });
        processedGlIds.add(row.id);
      } else if (cat === ExpenseCategory.SHARED) {
        // Deterministic split percentage calculation in integer cents
        const splitPercent = row.split_percent;
        const allocatedCents = calculateSharedCents(rowAmountCents, splitPercent);

        if (allocatedCents > 0 || splitPercent === 0) {
          sharedExpenseCents += allocatedCents;
          reimbursableExpenses.push(row);
          debitEvents.push({
            id: `LE-GL-DR-SH-${row.id}`,
            quarterId: quarter.id,
            effectiveDate: expDate,
            source: 'GL',
            sourceId: row.id,
            transactionType: LedgerEventType.SHARED_EXPENSE,
            side: 'DEBIT',
            description: `${row.description || row.account_name} (Split ${splitPercent ?? 50}%)`,
            accountName: row.account_name,
            contact: row.contact,
            amountCents: allocatedCents,
            originalAmountCents: rowAmountCents,
            splitPercent: splitPercent ?? 50
          });
          processedGlIds.add(row.id);
        }
      }
      // If OWNER_ONLY, MANAGER_ONLY, EXCLUDE: NOT a credit, NOT a reimbursable charge!
    });

    // D. Management Fee Calculation
    // Fee Base: Total quarter gross revenue or net payouts
    let feeBaseCents = 0;
    if (config.feeBaseMode === 'gross_revenue') {
      // Sum of gross bookings in this quarter + direct rental revenue
      const grossBookings = quarterBookings.reduce((sum, b) => sum + (b.gross_amount_cents || toCents(b.gross_amount)), 0);
      feeBaseCents = grossBookings + directRentalIncomeCents;
      if (feeBaseCents === 0) feeBaseCents = rentalIncomeCents;
    } else {
      // Net payouts mode
      feeBaseCents = rentalIncomeCents;
    }

    const managementFeeCents = calculateManagementFeeCents(feeBaseCents, config.mgmtFeePercent);

    if (managementFeeCents > 0) {
      debitEvents.unshift({
        id: `LE-MGMT-FEE-${quarter.id}`,
        quarterId: quarter.id,
        effectiveDate: quarter.endDate,
        source: 'CALCULATED',
        transactionType: LedgerEventType.MANAGEMENT_FEE,
        side: 'DEBIT',
        description: `Property Management Fee (${config.mgmtFeePercent}% of fee base ${config.feeBaseMode === 'gross_revenue' ? 'Gross' : 'Net'})`,
        amountCents: managementFeeCents
      });
    }

    // Mathematical Totals in Integer Cents
    const totalCreditsCents = creditEvents.reduce((sum, e) => sum + e.amountCents, 0);
    const totalDebitsCents = debitEvents.reduce((sum, e) => sum + e.amountCents, 0);
    const netChangeCents = totalCreditsCents - totalDebitsCents;
    const closingBalanceCents = calculateClosingBalanceCents(openingBalanceCents, totalCreditsCents, totalDebitsCents);

    const issueDate = config.issueDate || parseCalendarDate(new Date()) || quarter.endDate;
    const statementNumber = `ST-${quarter.fy.replace(/[^a-zA-Z0-9]/g, '')}-Q${quarter.quarter}`;

    const statement: QuarterStatement = {
      quarter,
      statementId: statementNumber,
      issueDate,
      originalIssueDate: config.originalIssueDate,
      generatedAt: new Date().toISOString(),
      revisionNumber: config.revisionNumber || 1,
      isFinalised: true,
      openingBalanceCents,
      totalCreditsCents,
      totalDebitsCents,
      netChangeCents,
      closingBalanceCents,
      rentalIncomeCents,
      directRentalIncomeCents,
      otherCreditsCents,
      managementFeeCents,
      managementFeeBaseCents: feeBaseCents,
      managementFeePercent: config.mgmtFeePercent,
      reimbursableExpenseCents,
      sharedExpenseCents,
      ownerPayoutsCents,
      guestRefundsCents,
      events: [...creditEvents, ...debitEvents],
      creditEvents,
      debitEvents,
      bookings: quarterBookings,
      reimbursableExpenses,
      directIncomeRows
    };

    statements.push(statement);
    quarterMap[quarter.id] = statement;

    // Carry closing balance forward to opening balance of next quarter!
    runningBalanceCents = closingBalanceCents;
    totalHistoricalCreditsCents += totalCreditsCents;
    totalHistoricalDebitsCents += totalDebitsCents;
  }

  return {
    statements,
    quarterMap,
    startQuarterId,
    endQuarterId,
    initialOpeningBalanceCents,
    totalHistoricalCreditsCents,
    totalHistoricalDebitsCents,
    finalClosingBalanceCents: runningBalanceCents
  };
}
