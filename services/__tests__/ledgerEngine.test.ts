import { describe, it, expect } from 'vitest';
import { buildQuarterlyLedger } from '../ledgerEngine';
import { 
  CanonicalGlRow, 
  CanonicalOtaRow, 
  ConfigState, 
  ExpenseCategory 
} from '../../types';
import { calculateSharedCents, toCents } from '../moneyUtils';

describe('Quarterly Ledger Engine & Canonical Accounting Invariant', () => {
  const baseConfig: ConfigState = {
    periodStart: '2020-07-01',
    periodEnd: '2021-06-30',
    managerName: 'Coastal Property Management',
    managerContact: 'info@coastalstays.com.au',
    managerBank: 'BSB: 062-000 Acc: 12345678',
    ownerName: 'Jane Doe',
    mgmtFeePercent: 20,
    feeBaseMode: 'gross_revenue',
    startQuarterId: 'FY2020-21-Q1',
    endQuarterId: 'FY2020-21-Q4',
    initialOpeningBalanceCents: 100000 // $1,000.00 initial balance
  };

  it('maintains strict continuity: closing balance of Q_n exactly equals opening balance of Q_{n+1}', () => {
    const otaBookings: CanonicalOtaRow[] = [
      {
        id: 'ota-1',
        reservation_id: 'RES-001',
        check_in_date: '2020-08-10',
        payout_date: '2020-08-12', // Falls in Q1
        guest_name: 'Alice',
        gross_amount: 1500,
        ota_fees: 150,
        net_payout: 1350,
        gross_amount_cents: 150000,
        ota_fees_cents: 15000,
        net_payout_cents: 135000,
        originalData: {}
      },
      {
        id: 'ota-2',
        reservation_id: 'RES-002',
        check_in_date: '2020-11-05',
        payout_date: '2020-11-07', // Falls in Q2
        guest_name: 'Bob',
        gross_amount: 2000,
        ota_fees: 200,
        net_payout: 1800,
        gross_amount_cents: 200000,
        ota_fees_cents: 20000,
        net_payout_cents: 180000,
        originalData: {}
      }
    ];

    const glExpenses: CanonicalGlRow[] = [
      {
        id: 'exp-1',
        date: '2020-09-15', // Q1
        account_name: 'Cleaning',
        source_type: 'Bill',
        description: 'Clean on check out',
        contact: 'Pro Cleaners',
        debit_amount: 250,
        credit_amount: 0,
        debit_amount_cents: 25000,
        credit_amount_cents: 0,
        assigned_category: ExpenseCategory.REIMBURSABLE,
        include_flag: true,
        is_reconciled_ota: false,
        originalData: {}
      },
      {
        id: 'exp-2',
        date: '2020-12-10', // Q2
        account_name: 'Plumbing',
        source_type: 'Bill',
        description: 'Fix tap',
        contact: 'Bob Plumber',
        debit_amount: 180,
        credit_amount: 0,
        debit_amount_cents: 18000,
        credit_amount_cents: 0,
        assigned_category: ExpenseCategory.REIMBURSABLE,
        include_flag: true,
        is_reconciled_ota: false,
        originalData: {}
      }
    ];

    const ledger = buildQuarterlyLedger({
      otaBookings,
      glIncome: [],
      glExpenses,
      config: baseConfig
    });

    expect(ledger.statements.length).toBe(4); // Q1, Q2, Q3, Q4

    // Verify equation for every single quarter:
    // Closing = Opening + Credits - Debits
    ledger.statements.forEach(statement => {
      expect(statement.closingBalanceCents).toBe(
        statement.openingBalanceCents + statement.totalCreditsCents - statement.totalDebitsCents
      );
    });

    // Verify perfect inter-quarter continuity:
    for (let i = 0; i < ledger.statements.length - 1; i++) {
      expect(ledger.statements[i + 1].openingBalanceCents).toBe(
        ledger.statements[i].closingBalanceCents
      );
    }
  });

  describe('Shared Expense Bug Fix (0%, 50%, 100%)', () => {
    it('correctly calculates 0% shared expense as 0 cents without coercing to 100%', () => {
      const originalAmountCents = 15000; // $150.00
      const split0 = calculateSharedCents(originalAmountCents, 0);
      expect(split0).toBe(0);

      const split50 = calculateSharedCents(originalAmountCents, 50);
      expect(split50).toBe(7500); // $75.00

      const split100 = calculateSharedCents(originalAmountCents, 100);
      expect(split100).toBe(15000); // $150.00
    });

    it('processes a 0% shared expense in the ledger engine with zero owner debit', () => {
      const glExpenses: CanonicalGlRow[] = [
        {
          id: 'exp-zero',
          date: '2020-08-01',
          account_name: 'Internet',
          source_type: 'Bill',
          description: 'Broadband',
          contact: 'Telstra',
          debit_amount: 100,
          credit_amount: 0,
          debit_amount_cents: 10000,
          credit_amount_cents: 0,
          assigned_category: ExpenseCategory.SHARED,
          split_percent: 0, // 0% Owner share!
          include_flag: true,
          is_reconciled_ota: false,
          originalData: {}
        }
      ];

      const ledger = buildQuarterlyLedger({
        otaBookings: [],
        glIncome: [],
        glExpenses,
        config: baseConfig
      });

      const q1 = ledger.statements[0];
      expect(q1.sharedExpenseCents).toBe(0);
      expect(q1.totalDebitsCents).toBe(0);
    });
  });

  describe('Integer Cents Financial Arithmetic', () => {
    it('converts monetary values to exact integer cents without binary floating point drift', () => {
      expect(toCents(19.99)).toBe(1999);
      expect(toCents('$1,234.56')).toBe(123456);
      expect(toCents('(45.50)')).toBe(-4550);
      expect(toCents(-10.25)).toBe(-1025);
    });

    it('calculates management fee rounded once to nearest cent from fee base', () => {
      // 20% on $1555.55 (155555 cents) = 31111 cents ($311.11)
      const ledger = buildQuarterlyLedger({
        otaBookings: [
          {
            id: 'b1',
            reservation_id: 'RES-X',
            check_in_date: '2020-07-15',
            payout_date: '2020-07-20',
            guest_name: 'Guest',
            gross_amount: 1555.55,
            ota_fees: 155.55,
            net_payout: 1400.00,
            gross_amount_cents: 155555,
            ota_fees_cents: 15555,
            net_payout_cents: 140000,
            originalData: {}
          }
        ],
        glIncome: [],
        glExpenses: [],
        config: { ...baseConfig, mgmtFeePercent: 20 }
      });

      const q1 = ledger.statements[0];
      expect(q1.managementFeeCents).toBe(31111); // exactly $311.11
    });
  });
});
