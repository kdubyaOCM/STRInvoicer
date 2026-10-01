export enum ProcessStep {
  LOAD = 'LOAD',
  MAP = 'MAP',
  REVIEW = 'REVIEW',
  INVOICE = 'INVOICE'
}

export enum ExpenseCategory {
  OWNER_ONLY = 'OWNER_ONLY',
  MANAGER_ONLY = 'MANAGER_ONLY',
  REIMBURSABLE = 'REIMBURSABLE',
  SHARED = 'SHARED',
  EXCLUDE = 'EXCLUDE',
  REVIEW_ALWAYS = 'REVIEW_ALWAYS',
  INCOME = 'INCOME'
}

export type QuarterNumber = 1 | 2 | 3 | 4;

export interface QuarterPeriod {
  id: string; // e.g. 'FY2020-21-Q1'
  fy: string; // e.g. 'FY2020-21'
  fyStartYear: number; // e.g. 2020
  quarter: QuarterNumber; // 1, 2, 3, or 4
  label: string; // e.g. 'FY2020-21 Q1'
  fullLabel: string; // e.g. 'FY2020-21 Q1 (1 Jul 2020 – 30 Sep 2020)'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export enum LedgerEventType {
  RENTAL_INCOME = 'RENTAL_INCOME',
  OWNER_FUNDS_IN = 'OWNER_FUNDS_IN',
  EXPENSE_REFUND = 'EXPENSE_REFUND',
  CREDIT_ADJUSTMENT = 'CREDIT_ADJUSTMENT',
  MANAGEMENT_FEE = 'MANAGEMENT_FEE',
  REIMBURSABLE_EXPENSE = 'REIMBURSABLE_EXPENSE',
  SHARED_EXPENSE = 'SHARED_EXPENSE',
  OWNER_PAYOUT = 'OWNER_PAYOUT',
  GUEST_REFUND = 'GUEST_REFUND',
  DEBIT_ADJUSTMENT = 'DEBIT_ADJUSTMENT'
}

export type LedgerSide = 'CREDIT' | 'DEBIT';

export interface LedgerEvent {
  id: string;
  quarterId: string;
  effectiveDate: string; // YYYY-MM-DD
  source: 'GL' | 'OTA' | 'CALCULATED' | 'MANUAL';
  sourceId?: string;
  transactionType: LedgerEventType;
  side: LedgerSide;
  description: string;
  accountName?: string;
  contact?: string;
  reference?: string;
  amountCents: number; // Positive integer in cents
  originalAmountCents?: number; // In cents before split allocation
  splitPercent?: number; // 0 to 100 for shared
  note?: string;
  reconciledOtaId?: string;
}

export interface QuarterStatement {
  quarter: QuarterPeriod;
  statementId: string;
  issueDate: string; // YYYY-MM-DD
  originalIssueDate?: string;
  generatedAt: string; // ISO datetime
  revisionNumber: number;
  isFinalised: boolean;
  
  // Ledger arithmetic in integer cents
  openingBalanceCents: number;
  totalCreditsCents: number;
  totalDebitsCents: number;
  netChangeCents: number; // credits - debits
  closingBalanceCents: number; // opening + credits - debits

  // Detail subtotals in integer cents
  rentalIncomeCents: number;
  directRentalIncomeCents?: number;
  otherCreditsCents: number;
  managementFeeCents: number;
  managementFeeBaseCents: number;
  managementFeePercent: number;
  reimbursableExpenseCents: number;
  sharedExpenseCents: number;
  ownerPayoutsCents: number;
  guestRefundsCents: number;

  events: LedgerEvent[];
  creditEvents: LedgerEvent[];
  debitEvents: LedgerEvent[];
  bookings: CanonicalOtaRow[];
  reimbursableExpenses: CanonicalGlRow[];
  directIncomeRows?: CanonicalGlRow[];
}

export interface QuarterlyLedger {
  statements: QuarterStatement[];
  quarterMap: Record<string, QuarterStatement>;
  startQuarterId: string;
  endQuarterId: string;
  initialOpeningBalanceCents: number;
  totalHistoricalCreditsCents: number;
  totalHistoricalDebitsCents: number;
  finalClosingBalanceCents: number;
}

export interface PropertyManagerProfile {
  managerName: string;
  managerContact: string;
  managerBank: string;
  defaultMgmtFeePercent: number;
  defaultFeeBaseMode: 'gross_revenue' | 'net_payouts';
  updatedAt: string;
}

export interface PropertyOwnerRecord {
  id: string;
  name: string;
  propertyName?: string;
  contactEmail?: string;
  mgmtFeePercent?: number;
  feeBaseMode?: 'gross_revenue' | 'net_payouts';
  initialOpeningBalanceCents?: number;
  startQuarterId?: string;
  endQuarterId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigState {
  customerId?: string; // ID of active PropertyOwnerRecord
  propertyName?: string; // Property or unit reference
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  managerName: string;
  managerContact: string;
  managerBank: string;
  ownerName: string;
  mgmtFeePercent: number;
  feeBaseMode: 'gross_revenue' | 'net_payouts';
  
  // Quarterly Ledger Configuration
  quarterMode?: boolean; // defaults to true
  startQuarterId?: string; // e.g. 'FY2020-21-Q1'
  endQuarterId?: string; // e.g. 'FY2024-25-Q4'
  initialOpeningBalanceCents?: number; // in integer cents, defaults to 0
  issueDate?: string; // YYYY-MM-DD defaults to generation date
  originalIssueDate?: string; // Optional historical issue date
  revisionNumber?: number;
}

export interface FilesState {
  otaRaw: any[];
  glRaw: any[];
  classificationMap: Record<string, ExpenseCategory>;
}

export interface MappingState {
  ota: Record<string, string>; // internal field -> csv header
  gl: Record<string, string>;
}

// Normalized Data Structures (Both integer cents and display dollar amounts)
export interface CanonicalOtaRow {
  id: string;
  reservation_id: string;
  check_in_date: string; // YYYY-MM-DD
  check_out_date?: string; // YYYY-MM-DD
  guest_name: string;
  gross_amount: number; // dollars (for UI)
  ota_fees: number; // dollars
  net_payout: number; // dollars
  gross_amount_cents: number; // integer cents
  ota_fees_cents: number; // integer cents
  net_payout_cents: number; // integer cents
  payout_date: string; // YYYY-MM-DD
  quarterId?: string;
  originalData: any;
}

export interface CanonicalGlRow {
  id: string;
  date: string; // YYYY-MM-DD
  account_name: string;
  source_type: string;
  description: string;
  contact: string;
  debit_amount: number; // dollars
  credit_amount: number; // dollars
  debit_amount_cents: number; // integer cents
  credit_amount_cents: number; // integer cents
  
  // Classification fields
  default_category?: ExpenseCategory;
  assigned_category?: ExpenseCategory;
  split_percent?: number; // 0-100 (nullish semantics: 0 is 0%)
  include_flag: boolean;
  
  // Reconciliation fields
  is_reconciled_ota: boolean;
  reconciled_ota_id?: string;
  reconciliation_mode?: 'DIRECT_INCOME' | 'MATCHED_OTA' | 'DUPLICATE_EXCLUDE';
  matched_booking_ref?: string;
  matched_guest_name?: string;
  matched_amount_cents?: number;
  note?: string;
  quarterId?: string;
  
  originalData: any;
}

export interface ProcessedDataState {
  otaBookings: CanonicalOtaRow[];
  glIncome: CanonicalGlRow[];
  glExpenses: CanonicalGlRow[];
  reviewRows: CanonicalGlRow[];
  autoReimbursables: CanonicalGlRow[];
  quarterlyLedger?: QuarterlyLedger;
  selectedQuarterId?: string;
  stats: {
    totalOtaRevenue: number;
    totalOtaNet: number;
    reconciledCount: number;
    unreconciledCount: number;
  };
}

// Session Persistence
export interface SessionState {
  version: 1;
  savedAt: string;
  createdAt?: string;
  currentStep: ProcessStep;
  files: FilesState;
  config: ConfigState;
  mappings: MappingState;
  processedData: ProcessedDataState | null;
}

export function isSessionState(value: any): value is SessionState {
  return (
    value &&
    typeof value === 'object' &&
    value.version === 1 &&
    typeof value.savedAt === 'string' &&
    typeof value.currentStep === 'string' &&
    value.files &&
    typeof value.files === 'object' &&
    value.config &&
    typeof value.config === 'object' &&
    value.mappings &&
    typeof value.mappings === 'object'
  );
}
