# API Reference

This document provides technical documentation for the internal APIs, interfaces, and functions used in STR Invoicer. This is a client-side application with no server-side APIs, but these public interfaces and functions form the "API" that components use to process data.

## 📋 Table of Contents

- [Type Definitions](#type-definitions)
- [Core Processing Functions](#core-processing-functions)
- [Excel/CSV Service Functions](#excelcsv-service-functions)
- [Constants and Configurations](#constants-and-configurations)

## Type Definitions

### Process Steps

```typescript
enum ProcessStep {
  LOAD = 'LOAD',
  MAP = 'MAP',
  REVIEW = 'REVIEW',
  INVOICE = 'INVOICE',
}
```

Represents the four steps in the invoice generation workflow.

### Expense Categories

```typescript
enum ExpenseCategory {
  OWNER_ONLY = 'OWNER_ONLY', // Expense paid by owner, not reimbursed
  MANAGER_ONLY = 'MANAGER_ONLY', // Expense paid by manager
  REIMBURSABLE = 'REIMBURSABLE', // Expense to be reimbursed to owner
  SHARED = 'SHARED', // Expense split between owner and manager
  EXCLUDE = 'EXCLUDE', // Excluded from calculations
  REVIEW_ALWAYS = 'REVIEW_ALWAYS', // Requires manual review
}
```

Categories for classifying general ledger expenses.

### ConfigState

```typescript
interface ConfigState {
  periodStart: string; // ISO date string (YYYY-MM-DD)
  periodEnd: string; // ISO date string (YYYY-MM-DD)
  managerName: string; // Property manager's name
  managerContact: string; // Email or phone
  managerBank: string; // Bank account details for payment
  ownerName: string; // Property owner's name
  mgmtFeePercent: number; // Management fee percentage (0-100)
  feeBaseMode: 'gross_revenue' | 'net_payouts'; // Basis for fee calculation
}
```

User configuration for the invoice period.

### FilesState

```typescript
interface FilesState {
  otaRaw: any[]; // Raw OTA booking data
  glRaw: any[]; // Raw general ledger data
  classificationMap: Record<string, ExpenseCategory>; // Account -> Category mapping
}
```

Stores uploaded file data before processing.

### MappingState

```typescript
interface MappingState {
  ota: Record<string, string>; // internal field name -> CSV column header
  gl: Record<string, string>; // internal field name -> CSV column header
}
```

Maps CSV/Excel column headers to internal field names.

### CanonicalOtaRow

```typescript
interface CanonicalOtaRow {
  id: string; // Generated UUID
  reservation_id: string; // Booking/reservation ID
  check_in_date: string; // ISO date (YYYY-MM-DD)
  check_out_date?: string; // ISO date (YYYY-MM-DD)
  guest_name: string; // Guest's name
  gross_amount: number; // Total booking amount
  ota_fees: number; // OTA commission/fees
  net_payout: number; // Amount paid out to owner
  payout_date: string; // Date payout was received
  originalData: any; // Original row data for reference
}
```

Normalized OTA booking record.

### CanonicalGlRow

```typescript
interface CanonicalGlRow {
  id: string; // Generated UUID
  date: string; // Transaction date (YYYY-MM-DD)
  account_name: string; // GL account name
  source_type: string; // Transaction source
  description: string; // Transaction description
  contact: string; // Payee/payer
  debit_amount: number; // Debit amount (expenses)
  credit_amount: number; // Credit amount (income)

  // Classification fields
  default_category?: ExpenseCategory; // Auto-assigned category
  assigned_category?: ExpenseCategory; // User-assigned category
  split_percent?: number; // Split percentage for SHARED (0-100)
  include_flag: boolean; // Whether to include in calculations

  // Reconciliation fields
  is_reconciled_ota: boolean; // If true, this income is from reconciled OTA payout
  note?: string; // User notes

  originalData: any; // Original row data
}
```

Normalized general ledger transaction record.

### ProcessedDataState

```typescript
interface ProcessedDataState {
  otaBookings: CanonicalOtaRow[]; // All OTA bookings in period
  glIncome: CanonicalGlRow[]; // Income transactions
  glExpenses: CanonicalGlRow[]; // Expense transactions
  reviewRows: CanonicalGlRow[]; // Items needing manual review
  autoReimbursables: CanonicalGlRow[]; // Auto-classified reimbursables
  stats: {
    totalOtaRevenue: number; // Total gross OTA revenue
    totalOtaNet: number; // Total net payouts
    reconciledCount: number; // Count of reconciled items
    unreconciledCount: number; // Count of unreconciled items
  };
}
```

Processed and categorized data ready for review and invoice generation.

### SessionState

```typescript
interface SessionState {
  version: 1; // Schema version
  savedAt: string; // ISO timestamp when saved
  createdAt?: string; // Optional creation timestamp
  currentStep: ProcessStep; // Current workflow step
  files: FilesState; // Uploaded file data
  config: ConfigState; // User configuration
  mappings: MappingState; // Column mappings
  processedData: ProcessedDataState | null; // Processed data (if available)
}
```

Complete application state for session persistence.

## Core Processing Functions

### generateInitialMappings

```typescript
function generateInitialMappings(otaData: any[], glData: any[]): MappingState;
```

Generates initial column mappings by auto-detecting common field names in uploaded data.

**Parameters:**

- `otaData`: Array of raw OTA booking records
- `glData`: Array of raw general ledger records

**Returns:** `MappingState` with auto-detected mappings

**Example:**

```typescript
const otaData = [{ 'Booking ID': '123', 'Guest Name': 'John Doe' /* ... */ }];
const glData = [{ Date: '2024-01-01', Description: 'Cleaning' /* ... */ }];

const mappings = generateInitialMappings(otaData, glData);
// mappings.ota.reservation_id === 'Booking ID'
// mappings.ota.guest_name === 'Guest Name'
// mappings.gl.date === 'Date'
```

**Auto-detection Keywords:**

OTA fields:

- `reservation_id`: 'reference', 'booking', 'id'
- `check_in_date`: 'check-in', 'check in', 'start'
- `check_out_date`: 'checkout', 'check out', 'end'
- `net_payout`: 'net', 'payout'
- `payout_date`: 'payout date', 'paid on'
- `guest_name`: 'guest', 'name'
- `gross_amount`: 'amount', 'gross', 'total'
- `ota_fees`: 'commission', 'fee', 'charge'

GL fields:

- `date`: 'date'
- `account_name`: 'account', 'code'
- `description`: 'description', 'detail'
- `contact`: 'contact', 'payee', 'payer'
- `debit_amount`: 'debit', 'expense', 'out', 'amount'
- `credit_amount`: 'credit', 'income', 'in', 'amount'
- `source_type`: 'source'

### processData

```typescript
function processData(
  files: FilesState,
  config: ConfigState,
  mappings: MappingState
): ProcessedDataState;
```

Main data processing function that normalizes, categorizes, and reconciles data.

**Parameters:**

- `files`: Uploaded file data
- `config`: User configuration (dates, names, fees)
- `mappings`: Column mappings from user

**Returns:** `ProcessedDataState` with processed and categorized data

**Processing Steps:**

1. **Normalize OTA data** - Convert to `CanonicalOtaRow[]`
2. **Normalize GL data** - Convert to `CanonicalGlRow[]`
3. **Filter by date range** - Only include transactions within configured period
4. **Split income/expenses** - Separate GL records by debit/credit
5. **Auto-categorize** - Apply classification map and rules
6. **Reconcile OTA payouts** - Match OTA payouts with GL income entries
7. **Identify review items** - Flag items needing manual review
8. **Calculate statistics** - Compute totals and counts

**Example:**

```typescript
const processedData = processData(files, config, mappings);

console.log(processedData.stats.totalOtaRevenue); // 10000.00
console.log(processedData.otaBookings.length); // 25
console.log(processedData.glExpenses.length); // 150
console.log(processedData.reviewRows.length); // 5
```

### Date Parsing (Internal)

```typescript
function parseDateLoose(val: any): string | null;
```

Parses various date formats including:

- Excel serial dates (numeric)
- ISO date strings
- Common date formats

**Returns:** ISO date string (YYYY-MM-DD) or null if invalid

### Number Parsing (Internal)

```typescript
function parseNumber(val: any): number;
```

Parses various number formats including:

- Accounting format with parentheses for negatives: `(123.45)` → `-123.45`
- Currency symbols: `$1,234.56` → `1234.56`
- Percentage formats

**Returns:** Numeric value or 0 if invalid

## Excel/CSV Service Functions

### readSpreadsheet

```typescript
async function readSpreadsheet(file: File): Promise<any[]>;
```

Reads Excel (.xlsx, .xls) or CSV files and converts to JSON array.

**Parameters:**

- `file`: File object from input[type="file"]

**Returns:** Promise resolving to array of row objects

**Example:**

```typescript
const file = event.target.files[0];
const data = await readSpreadsheet(file);
// data = [{ 'Column1': 'value1', 'Column2': 'value2' }, ...]
```

**Supported Formats:**

- Excel (.xlsx, .xls)
- CSV (.csv)

### parseClassificationMap

```typescript
async function parseClassificationMap(file: File): Promise<Record<string, string>>;
```

Parses a classification mapping file that maps GL accounts to expense categories.

**Parameters:**

- `file`: Excel/CSV file with account and category columns

**Returns:** Promise resolving to mapping object

**Expected File Format:**

```csv
Account Name,Default Category
Cleaning,REIMBURSABLE
Utilities,SHARED
Repairs,OWNER_ONLY
```

**Example:**

```typescript
const mapFile = event.target.files[0];
const classMap = await parseClassificationMap(mapFile);
// classMap = { 'Cleaning': 'REIMBURSABLE', 'Utilities': 'SHARED', ... }
```

## Constants and Configurations

### Required OTA Fields

```typescript
const REQUIRED_OTA_FIELDS = [
  { key: 'reservation_id', label: 'Reservation / Booking ID' },
  { key: 'check_in_date', label: 'Check-in Date' },
  { key: 'net_payout', label: 'Net Payout' },
  { key: 'payout_date', label: 'Payout Date' },
  { key: 'guest_name', label: 'Guest Name' },
  { key: 'gross_amount', label: 'Gross Amount' },
];
```

### Required GL Fields

```typescript
const REQUIRED_GL_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'account_name', label: 'Account / Category' },
  { key: 'description', label: 'Description' },
  { key: 'contact', label: 'Contact / Payee' },
  { key: 'debit_amount', label: 'Debit (Expense)' },
  { key: 'credit_amount', label: 'Credit (Income)' },
];
```

### Category Labels

```typescript
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OWNER_ONLY]: 'Owner Expense (Not Reimbursed)',
  [ExpenseCategory.MANAGER_ONLY]: 'Manager Expense',
  [ExpenseCategory.REIMBURSABLE]: 'Reimbursable (Charge Owner)',
  [ExpenseCategory.SHARED]: 'Shared Expense',
  [ExpenseCategory.EXCLUDE]: 'Exclude / Ignore',
  [ExpenseCategory.REVIEW_ALWAYS]: 'Needs Review',
};
```

### Category Colors (for UI)

```typescript
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OWNER_ONLY]: 'bg-gray-100 text-gray-800',
  [ExpenseCategory.MANAGER_ONLY]: 'bg-purple-100 text-purple-800',
  [ExpenseCategory.REIMBURSABLE]: 'bg-green-100 text-green-800',
  [ExpenseCategory.SHARED]: 'bg-blue-100 text-blue-800',
  [ExpenseCategory.EXCLUDE]: 'bg-red-50 text-red-500',
  [ExpenseCategory.REVIEW_ALWAYS]: 'bg-yellow-100 text-yellow-800',
};
```

## Type Guards

### isSessionState

```typescript
function isSessionState(value: any): value is SessionState;
```

Type guard to verify if an object conforms to the SessionState interface.

**Parameters:**

- `value`: Any value to check

**Returns:** Boolean indicating if value is a valid SessionState

**Example:**

```typescript
const loadedData = JSON.parse(fileContent);
if (isSessionState(loadedData)) {
  // Safe to use as SessionState
  restoreSession(loadedData);
} else {
  console.error('Invalid session file format');
}
```

## Usage Examples

### Complete Workflow Example

```typescript
import { readSpreadsheet } from './services/excelService';
import { generateInitialMappings, processData } from './services/processor';

// 1. Load files
const otaFile = document.getElementById('ota-upload').files[0];
const glFile = document.getElementById('gl-upload').files[0];

const otaRaw = await readSpreadsheet(otaFile);
const glRaw = await readSpreadsheet(glFile);

const files: FilesState = {
  otaRaw,
  glRaw,
  classificationMap: {},
};

// 2. Generate initial mappings
const mappings = generateInitialMappings(otaRaw, glRaw);

// 3. Configure settings
const config: ConfigState = {
  periodStart: '2024-01-01',
  periodEnd: '2024-01-31',
  managerName: 'ABC Property Management',
  managerContact: 'manager@example.com',
  managerBank: 'Account: 123456789',
  ownerName: 'John Doe',
  mgmtFeePercent: 20,
  feeBaseMode: 'gross_revenue',
};

// 4. Process data
const processedData = processData(files, config, mappings);

// 5. Access processed data
console.log('Total Revenue:', processedData.stats.totalOtaRevenue);
console.log('Bookings:', processedData.otaBookings.length);
console.log('Expenses:', processedData.glExpenses.length);
console.log('Items to Review:', processedData.reviewRows.length);
```

### Session Persistence Example

```typescript
// Save session
const session: SessionState = {
  version: 1,
  savedAt: new Date().toISOString(),
  currentStep: ProcessStep.REVIEW,
  files,
  config,
  mappings,
  processedData,
};

const json = JSON.stringify(session, null, 2);
const blob = new Blob([json], { type: 'application/json' });
// ... trigger download

// Load session
const fileContent = await loadedFile.text();
const loadedSession = JSON.parse(fileContent);

if (isSessionState(loadedSession)) {
  // Restore application state
  setFiles(loadedSession.files);
  setConfig(loadedSession.config);
  setMappings(loadedSession.mappings);
  setProcessedData(loadedSession.processedData);
  setCurrentStep(loadedSession.currentStep);
}
```

## Notes on Data Processing

### Reconciliation Logic

The reconciliation process matches OTA payouts with GL income entries using:

1. **Date matching** - Payout date ± 7 days
2. **Amount matching** - Within $0.01 tolerance
3. **Fuzzy matching** - For partial reconciliation

### Auto-Classification

Expenses are automatically classified based on:

1. **Classification map** - Pre-defined account → category mapping
2. **Keyword detection** - Common patterns in descriptions
3. **Account name patterns** - Recognized expense types

Items that can't be confidently classified are marked as `REVIEW_ALWAYS`.

### Fee Calculation Modes

**Gross Revenue Mode:**

```
Management Fee = Total OTA Gross Revenue × (mgmtFeePercent / 100)
```

**Net Payouts Mode:**

```
Management Fee = Total OTA Net Payouts × (mgmtFeePercent / 100)
```

---

**Last Updated:** February 2026  
**Version:** 1.0
