import { describe, it, expect } from 'vitest';
import { findMatchingOtaBooking } from '../reconciliationService';
import { buildQuarterlyLedger } from '../ledgerEngine';
import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory 
} from '../../types';

describe('Income / Revenue Classification and Double-Counting Reconciliation', () => {
  const baseConfig: ConfigState = {
    periodStart: '2021-04-01',
    periodEnd: '2021-06-30',
    managerName: 'Coastal Property Management',
    managerContact: 'info@coastalstays.com.au',
    managerBank: 'BSB: 062-000 Acc: 12345678',
    ownerName: 'Jane Doe',
    mgmtFeePercent: 20,
    feeBaseMode: 'gross_revenue',
    startQuarterId: 'FY2020-21-Q4',
    endQuarterId: 'FY2020-21-Q4',
    initialOpeningBalanceCents: 0
  };

  const sampleOtaBookings: CanonicalOtaRow[] = [
    {
      id: 'ota-smith',
      reservation_id: 'RES-8899',
      check_in_date: '2021-04-05',
      payout_date: '2021-04-07',
      guest_name: 'David Smith',
      gross_amount: 1200,
      ota_fees: 120,
      net_payout: 1080,
      gross_amount_cents: 120000,
      ota_fees_cents: 12000,
      net_payout_cents: 108000,
      originalData: {}
    }
  ];

  describe('Intelligent Booking Matcher', () => {
    it('detects a direct revenue item with no OTA match (e.g. Kevin Canning $2,125.00)', () => {
      const glRow: CanonicalGlRow = {
        id: 'gl-kevin',
        date: '2021-04-06',
        account_name: 'Smart Access',
        source_type: 'Bank Transfer',
        description: 'Kevin Canning',
        contact: 'Kevin Canning',
        debit_amount: 2125,
        credit_amount: 0,
        debit_amount_cents: 212500,
        credit_amount_cents: 0,
        include_flag: true,
        is_reconciled_ota: false,
        originalData: {}
      };

      const result = findMatchingOtaBooking(glRow, sampleOtaBookings);
      expect(result.confidence).toBe('NONE');
      expect(result.booking).toBeNull();
      expect(result.suggestedMode).toBe('DIRECT_INCOME');
    });

    it('detects matching booking when guest name and amount match (avoiding double count)', () => {
      const glRow: CanonicalGlRow = {
        id: 'gl-david',
        date: '2021-04-07',
        account_name: 'Stripe Payout',
        source_type: 'Deposit',
        description: 'Payout for David Smith',
        contact: 'David Smith',
        debit_amount: 1080,
        credit_amount: 0,
        debit_amount_cents: 108000,
        credit_amount_cents: 0,
        include_flag: true,
        is_reconciled_ota: false,
        originalData: {}
      };

      const result = findMatchingOtaBooking(glRow, sampleOtaBookings);
      expect(result.confidence).toBe('HIGH');
      expect(result.booking?.reservation_id).toBe('RES-8899');
      expect(result.suggestedMode).toBe('MATCHED_OTA');
    });
  });

  describe('Ledger Engine Revenue Recognition', () => {
    it('includes direct rental revenue as Owner Credit on the statement and ledger', () => {
      const directRevenueRows: CanonicalGlRow[] = [
        {
          id: 'gl-kevin-rev',
          date: '2021-04-06',
          account_name: 'Smart Access',
          source_type: 'Direct Booking',
          description: 'Kevin Canning',
          contact: 'Kevin Canning',
          debit_amount: 2125,
          credit_amount: 0,
          debit_amount_cents: 212500,
          credit_amount_cents: 0,
          assigned_category: ExpenseCategory.INCOME,
          reconciliation_mode: 'DIRECT_INCOME',
          include_flag: true,
          is_reconciled_ota: false,
          originalData: {}
        },
        {
          id: 'gl-afani-rev',
          date: '2021-04-18',
          account_name: 'Smart Access',
          source_type: 'Direct Booking',
          description: 'Afani Taituave',
          contact: 'Afani Taituave',
          debit_amount: 400,
          credit_amount: 0,
          debit_amount_cents: 40000,
          credit_amount_cents: 0,
          assigned_category: ExpenseCategory.INCOME,
          reconciliation_mode: 'DIRECT_INCOME',
          include_flag: true,
          is_reconciled_ota: false,
          originalData: {}
        }
      ];

      const ledger = buildQuarterlyLedger({
        otaBookings: [],
        glIncome: [],
        glExpenses: directRevenueRows,
        config: { ...baseConfig, mgmtFeePercent: 20 }
      });

      const q4 = ledger.statements[0];
      // Total direct revenue: $2,125 + $400 = $2,525.00 (252500 cents)
      expect(q4.directRentalIncomeCents).toBe(252500);
      expect(q4.rentalIncomeCents).toBe(252500);
      expect(q4.totalCreditsCents).toBe(252500);

      // Management Fee 20% on $2,525.00 = $505.00 (50500 cents)
      expect(q4.managementFeeCents).toBe(50500);
      expect(q4.totalDebitsCents).toBe(50500);

      // Closing balance = 252500 - 50500 = 202000 cents ($2,020.00)
      expect(q4.closingBalanceCents).toBe(202000);
    });

    it('does not double count when income row is matched to an existing OTA booking', () => {
      const glIncomeRows: CanonicalGlRow[] = [
        {
          id: 'gl-smith-matched',
          date: '2021-04-07',
          account_name: 'Airbnb Payout',
          source_type: 'Bill',
          description: 'David Smith Payout',
          contact: 'David Smith',
          debit_amount: 1080,
          credit_amount: 0,
          debit_amount_cents: 108000,
          credit_amount_cents: 0,
          assigned_category: ExpenseCategory.INCOME,
          reconciliation_mode: 'MATCHED_OTA',
          reconciled_ota_id: 'ota-smith',
          include_flag: true,
          is_reconciled_ota: true,
          originalData: {}
        }
      ];

      const ledger = buildQuarterlyLedger({
        otaBookings: sampleOtaBookings,
        glIncome: [],
        glExpenses: glIncomeRows,
        config: { ...baseConfig, mgmtFeePercent: 0 }
      });

      const q4 = ledger.statements[0];
      // The OTA booking net payout is $1,080.00. Because it is matched, it should NOT be counted twice ($2,160.00).
      expect(q4.rentalIncomeCents).toBe(108000);
      expect(q4.totalCreditsCents).toBe(108000);
      expect(q4.closingBalanceCents).toBe(108000);
    });

    it('excludes duplicate revenue when flagged as DUPLICATE_EXCLUDE', () => {
      const duplicateRow: CanonicalGlRow = {
        id: 'gl-dup',
        date: '2021-04-07',
        account_name: 'Airbnb Payout',
        source_type: 'Bill',
        description: 'Duplicate Payout',
        contact: 'David Smith',
        debit_amount: 1080,
        credit_amount: 0,
        debit_amount_cents: 108000,
        credit_amount_cents: 0,
        assigned_category: ExpenseCategory.INCOME,
        reconciliation_mode: 'DUPLICATE_EXCLUDE',
        include_flag: true,
        is_reconciled_ota: false,
        originalData: {}
      };

      const ledger = buildQuarterlyLedger({
        otaBookings: [],
        glIncome: [],
        glExpenses: [duplicateRow],
        config: { ...baseConfig, mgmtFeePercent: 0 }
      });

      const q4 = ledger.statements[0];
      expect(q4.rentalIncomeCents).toBe(0);
      expect(q4.totalCreditsCents).toBe(0);
    });

    it('excludes expenses in glIncome from credits when classified as OWNER_ONLY or anything other than INCOME', () => {
      // Recreating the exact user scenario:
      // GL file contains expenses recorded with credit amounts under Smart Access account:
      // - AAMI Business Insurance $134.39
      // - Ring Yearly Plan $99.90
      // - Vodafone Aus $252.76
      // - IFTTT Pro $3.95
      // These are classified as OWNER_ONLY (Owners category).
      const expenseCreditsInGl: CanonicalGlRow[] = [
        {
          id: 'gl-aami',
          date: '2021-04-09',
          account_name: 'Smart Access',
          source_type: 'Bank Transfer',
          description: 'SPD012831805 AAMI BUSINESS IN',
          contact: 'AAMI',
          debit_amount: 0,
          credit_amount: 134.39,
          debit_amount_cents: 0,
          credit_amount_cents: 13439,
          default_category: ExpenseCategory.OWNER_ONLY,
          assigned_category: ExpenseCategory.OWNER_ONLY,
          include_flag: false,
          is_reconciled_ota: false,
          originalData: {}
        },
        {
          id: 'gl-ring',
          date: '2021-04-10',
          account_name: 'Smart Access',
          source_type: 'Bank Transfer',
          description: 'RING YEARLY PLAN S Card xx1266 AUD',
          contact: 'Ring',
          debit_amount: 0,
          credit_amount: 99.90,
          debit_amount_cents: 0,
          credit_amount_cents: 9990,
          default_category: ExpenseCategory.OWNER_ONLY,
          assigned_category: ExpenseCategory.OWNER_ONLY,
          include_flag: false,
          is_reconciled_ota: false,
          originalData: {}
        },
        {
          id: 'gl-voda',
          date: '2021-04-26',
          account_name: 'Smart Access',
          source_type: 'Bank Transfer',
          description: 'A4-25952c01e Vodafone Aus',
          contact: 'Vodafone',
          debit_amount: 0,
          credit_amount: 252.76,
          debit_amount_cents: 0,
          credit_amount_cents: 25276,
          default_category: ExpenseCategory.OWNER_ONLY,
          assigned_category: ExpenseCategory.OWNER_ONLY,
          include_flag: false,
          is_reconciled_ota: false,
          originalData: {}
        },
        {
          id: 'gl-ifttt',
          date: '2021-04-20',
          account_name: 'Smart Access',
          source_type: 'Bank Transfer',
          description: 'IFTTT PRO (LEGACY) Card xx1266 USD',
          contact: 'IFTTT',
          debit_amount: 0,
          credit_amount: 3.95,
          debit_amount_cents: 0,
          credit_amount_cents: 395,
          default_category: ExpenseCategory.OWNER_ONLY,
          assigned_category: ExpenseCategory.OWNER_ONLY,
          include_flag: false,
          is_reconciled_ota: false,
          originalData: {}
        }
      ];

      const ledger = buildQuarterlyLedger({
        otaBookings: [],
        glIncome: expenseCreditsInGl,
        glExpenses: [],
        config: { ...baseConfig, mgmtFeePercent: 20 }
      });

      const q4 = ledger.statements[0];
      // None of these should be recognized as credits or rental income!
      expect(q4.rentalIncomeCents).toBe(0);
      expect(q4.directRentalIncomeCents).toBe(0);
      expect(q4.otherCreditsCents).toBe(0);
      expect(q4.totalCreditsCents).toBe(0);
      expect(q4.creditEvents.length).toBe(0);
      expect(q4.directIncomeRows?.length || 0).toBe(0);
    });

    it('routes glIncome rows to reimbursable debits if classified as REIMBURSABLE instead of counting as credit', () => {
      const reimbursableGl: CanonicalGlRow[] = [
        {
          id: 'gl-cleaning',
          date: '2021-04-12',
          account_name: 'Cleaning',
          source_type: 'Bank Transfer',
          description: 'Deep Clean',
          contact: 'Clean Co',
          debit_amount: 0,
          credit_amount: 150.00,
          debit_amount_cents: 0,
          credit_amount_cents: 15000,
          default_category: ExpenseCategory.REIMBURSABLE,
          assigned_category: ExpenseCategory.REIMBURSABLE,
          include_flag: true,
          is_reconciled_ota: false,
          originalData: {}
        }
      ];

      const ledger = buildQuarterlyLedger({
        otaBookings: [],
        glIncome: reimbursableGl,
        glExpenses: [],
        config: { ...baseConfig, mgmtFeePercent: 0 }
      });

      const q4 = ledger.statements[0];
      expect(q4.totalCreditsCents).toBe(0);
      expect(q4.reimbursableExpenseCents).toBe(15000);
      expect(q4.totalDebitsCents).toBe(15000);
      expect(q4.closingBalanceCents).toBe(-15000);
    });
  });
});
