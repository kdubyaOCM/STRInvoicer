import { ExpenseCategory } from "./types";

export const REQUIRED_OTA_FIELDS = [
  { key: 'reservation_id', label: 'Reservation / Booking ID' },
  { key: 'check_in_date', label: 'Check-in Date' },
  { key: 'net_payout', label: 'Net Payout' },
  { key: 'payout_date', label: 'Payout Date' },
  { key: 'guest_name', label: 'Guest Name' },
  { key: 'gross_amount', label: 'Gross Amount' },
];

// Optional or calculated fields we might want to map if available, 
// but for v0.3 spec, ota_fees is derived or mapped.
export const ALL_OTA_FIELDS = [
  ...REQUIRED_OTA_FIELDS,
  { key: 'ota_fees', label: 'OTA Fees / Commission' },
];

export const REQUIRED_GL_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'account_name', label: 'Account / Category' },
  { key: 'description', label: 'Description' },
  { key: 'contact', label: 'Contact / Payee' },
  { key: 'debit_amount', label: 'Debit (Expense)' },
  { key: 'credit_amount', label: 'Credit (Income)' },
];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OWNER_ONLY]: 'Owner Expense (Not Reimbursed)',
  [ExpenseCategory.MANAGER_ONLY]: 'Manager Expense',
  [ExpenseCategory.REIMBURSABLE]: 'Reimbursable (Charge Owner)',
  [ExpenseCategory.SHARED]: 'Shared Expense',
  [ExpenseCategory.EXCLUDE]: 'Exclude / Ignore',
  [ExpenseCategory.REVIEW_ALWAYS]: 'Needs Review'
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OWNER_ONLY]: 'bg-gray-100 text-gray-800',
  [ExpenseCategory.MANAGER_ONLY]: 'bg-purple-100 text-purple-800',
  [ExpenseCategory.REIMBURSABLE]: 'bg-green-100 text-green-800',
  [ExpenseCategory.SHARED]: 'bg-blue-100 text-blue-800',
  [ExpenseCategory.EXCLUDE]: 'bg-red-50 text-red-500',
  [ExpenseCategory.REVIEW_ALWAYS]: 'bg-yellow-100 text-yellow-800'
};