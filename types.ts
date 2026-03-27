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
  REVIEW_ALWAYS = 'REVIEW_ALWAYS'
}

export interface ConfigState {
  periodStart: string;
  periodEnd: string;
  managerName: string;
  managerContact: string;
  managerBank: string;
  ownerName: string;
  mgmtFeePercent: number;
  feeBaseMode: 'gross_revenue' | 'net_payouts';
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

// Normalized Data Structures
export interface CanonicalOtaRow {
  id: string; // generated uuid
  reservation_id: string;
  check_in_date: string; // ISO date string YYYY-MM-DD
  check_out_date?: string;
  guest_name: string;
  gross_amount: number;
  ota_fees: number;
  net_payout: number;
  payout_date: string;
  originalData: any;
}

export interface CanonicalGlRow {
  id: string; // generated uuid
  date: string;
  account_name: string;
  source_type: string;
  description: string;
  contact: string;
  debit_amount: number;
  credit_amount: number;
  
  // Classification fields
  default_category?: ExpenseCategory;
  assigned_category?: ExpenseCategory;
  split_percent?: number; // 0-100
  include_flag: boolean;
  
  // Reconciliation fields
  is_reconciled_ota: boolean; // if true, this is income we ignore because it's OTA payout
  note?: string;
  
  originalData: any;
}

export interface ProcessedDataState {
  otaBookings: CanonicalOtaRow[];
  glIncome: CanonicalGlRow[];
  glExpenses: CanonicalGlRow[];
  reviewRows: CanonicalGlRow[]; // Rows needing manual review
  autoReimbursables: CanonicalGlRow[]; // Rows auto-classified as reimbursable
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
    // processedData can be null, so strict check might be optional, but key should exist if we want to be strict.
    // However, JS often omits keys if undefined. We'll trust the structure if main blocks exist.
  );
}