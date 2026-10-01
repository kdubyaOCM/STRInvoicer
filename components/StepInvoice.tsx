import React, { useMemo, useState } from 'react';
import { 
  ConfigState, 
  ExpenseCategory, 
  ProcessedDataState, 
  QuarterStatement 
} from '../types';
import { 
  calculateSharedCents, 
  centsToDollars, 
  formatCents, 
  toCents 
} from '../services/moneyUtils';
import { formatCalendarDate } from '../services/dateUtils';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Save, 
  Check, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  FileSpreadsheet, 
  Layers, 
  Info,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  data: ProcessedDataState;
  config: ConfigState;
  onBack: () => void;
  onSaveDraft: (data?: ProcessedDataState) => void;
}

/**
 * Reusable Auditable Quarterly Statement Document Component
 */
export const StatementDocument: React.FC<{
  statement: QuarterStatement;
  config: ConfigState;
  id?: string;
}> = ({ statement, config, id }) => {
  const isNetPositive = statement.closingBalanceCents >= 0;

  return (
    <div 
      id={id} 
      className="bg-white shadow-2xl shadow-slate-200 mx-auto w-full max-w-[210mm] min-h-[297mm] text-slate-900 relative print:shadow-none print:w-full print:max-w-none print:m-0 flex flex-col mb-8 print:mb-0"
    >
      <div className="h-3 w-full bg-slate-900 print:bg-black"></div>
      
      <div className="p-10 sm:p-14 flex-1 flex flex-col">
        
        {/* Header / Brand */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-1 block">
              Australian FY Quarterly Statement
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
              {statement.quarter.label}
            </h1>
            <p className="text-slate-500 font-mono text-xs mt-0.5">
              Statement ID: #{statement.statementId} • Rev {statement.revisionNumber}
            </p>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900">{config.managerName || 'Property Management'}</h2>
            <p className="text-slate-500 whitespace-pre-line text-xs mt-1">{config.managerContact}</p>
          </div>
        </div>

        {/* Metadata Grid: Entity & Dates */}
        <div className="grid grid-cols-2 gap-8 mb-10 border-y border-slate-200 py-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prepared For</h3>
            <div className="text-base font-bold text-slate-900">{config.ownerName || 'Property Owner'}</div>
            <div className="text-xs text-slate-500">Property Owner Account</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Document Issue Date</h3>
              <div className="text-sm font-semibold text-slate-900">
                {formatCalendarDate(statement.issueDate, 'au')}
              </div>
              {statement.originalIssueDate && (
                <div className="text-[10px] text-slate-400">
                  Orig: {formatCalendarDate(statement.originalIssueDate, 'au')}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reporting Quarter</h3>
              <div className="text-xs font-semibold text-slate-900">
                {statement.quarter.dateRangeLabel || statement.quarter.fullLabel}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {statement.quarter.startDate} to {statement.quarter.endDate}
              </div>
            </div>
          </div>
        </div>

        {/* AUDITABLE LEDGER RECONCILIATION SUMMARY BOX */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center justify-between">
            <span>Quarter Balance Continuity</span>
            <span className="text-[10px] text-slate-400 font-mono">Formula: Opening + Credits - Debits = Closing</span>
          </h3>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Opening Balance</span>
              <span className="text-base font-bold text-slate-800">
                {formatCents(statement.openingBalanceCents)}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Brought Forward</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-600 font-semibold uppercase block">+ Total Credits</span>
              <span className="text-base font-bold text-emerald-600">
                {formatCents(statement.totalCreditsCents)}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Funds Received</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-purple-200">
              <span className="text-[10px] text-purple-600 font-semibold uppercase block">- Total Debits</span>
              <span className="text-base font-bold text-purple-600">
                ({formatCents(statement.totalDebitsCents)})
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Fees & Expenses</span>
            </div>

            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-sm">
              <span className="text-[10px] text-slate-300 font-semibold uppercase block">= Closing Balance</span>
              <span className="text-base font-extrabold">
                {formatCents(statement.closingBalanceCents)}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Carried Forward</span>
            </div>
          </div>
        </div>

        {/* DETAILED TRANSACTION SCHEDULE TABLE */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="py-2.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
                Ledger Description & Reference
              </th>
              <th className="py-2.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wide w-36">
                Credit (In)
              </th>
              <th className="py-2.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wide w-36">
                Debit (Out)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            
            {/* 1. CREDITS SECTION */}
            <tr>
              <td colSpan={3} className="py-2.5 pt-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Owner Credits (Rental & Payout Funds Received)</span>
                </div>
              </td>
            </tr>

            {statement.creditEvents.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-2 pl-4 text-slate-400 italic">
                  No cash receipts or credits recorded for this quarter.
                </td>
              </tr>
            ) : (
              statement.creditEvents.map(event => (
                <tr key={event.id} className="hover:bg-slate-50/50">
                  <td className="py-2 pl-4 pr-4">
                    <div className="font-semibold text-slate-900">{event.description}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{formatCalendarDate(event.effectiveDate, 'au')}</span>
                      {event.accountName && <span>• {event.accountName}</span>}
                      {event.reference && <span>• Ref: {event.reference}</span>}
                    </div>
                  </td>
                  <td className="py-2 text-right align-top font-semibold text-slate-900">
                    {formatCents(event.amountCents)}
                  </td>
                  <td className="py-2 text-right align-top text-slate-300">—</td>
                </tr>
              ))
            )}

            <tr className="border-t border-slate-200 bg-slate-50 font-bold">
              <td className="py-2.5 pl-2 text-right text-xs text-slate-600 uppercase">
                Total Owner Credits
              </td>
              <td className="py-2.5 text-right text-emerald-700">
                +{formatCents(statement.totalCreditsCents)}
              </td>
              <td className="py-2.5 text-right text-slate-300"></td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan={3} className="h-4"></td></tr>

            {/* 2. DEBITS SECTION */}
            <tr>
              <td colSpan={3} className="py-2.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                  <span>Owner Debits (Management Fees & Reimbursable Deductions)</span>
                </div>
              </td>
            </tr>

            {/* Management Fee Row */}
            {statement.managementFeeCents > 0 && (
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 pl-4 pr-4">
                  <div className="font-semibold text-slate-900">Property Management Fee</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {statement.managementFeePercent}% of fee base {config.feeBaseMode === 'gross_revenue' ? 'Gross Revenue' : 'Net Payouts'} ({formatCents(statement.managementFeeBaseCents)})
                  </div>
                </td>
                <td className="py-2 text-right align-top text-slate-300">—</td>
                <td className="py-2 text-right align-top font-semibold text-slate-900">
                  ({formatCents(statement.managementFeeCents)})
                </td>
              </tr>
            )}

            {/* Expenses & Allocations */}
            {statement.reimbursableExpenses.map(item => {
              const debitCents = item.debit_amount_cents || toCents(item.debit_amount);
              const isShared = item.assigned_category === ExpenseCategory.SHARED;
              const splitPercent = item.split_percent !== undefined ? item.split_percent : 50;
              const chargedCents = isShared ? calculateSharedCents(debitCents, splitPercent) : debitCents;

              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2 pl-4 pr-4">
                    <div className="font-semibold text-slate-900">{item.description}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{formatCalendarDate(item.date, 'au')}</span>
                      <span>• {item.account_name}</span>
                      {item.contact && <span>• {item.contact}</span>}
                      {isShared && (
                        <span className="text-blue-600 font-semibold">
                          (Shared: Owner Share {splitPercent}% of {formatCents(debitCents)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right align-top text-slate-300">—</td>
                  <td className="py-2 text-right align-top font-semibold text-slate-900">
                    ({formatCents(chargedCents)})
                  </td>
                </tr>
              );
            })}

            {/* Owner Payouts or Distributions */}
            {statement.ownerPayoutsCents > 0 && (
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 pl-4 pr-4">
                  <div className="font-semibold text-slate-900">Distribution Paid to Owner</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Direct bank transfer to owner</div>
                </td>
                <td className="py-2 text-right align-top text-slate-300">—</td>
                <td className="py-2 text-right align-top font-semibold text-slate-900">
                  ({formatCents(statement.ownerPayoutsCents)})
                </td>
              </tr>
            )}

            <tr className="border-t border-slate-200 bg-slate-50 font-bold">
              <td className="py-2.5 pl-2 text-right text-xs text-slate-600 uppercase">
                Total Owner Debits
              </td>
              <td className="py-2.5 text-right text-slate-300"></td>
              <td className="py-2.5 text-right text-purple-700">
                -({formatCents(statement.totalDebitsCents)})
              </td>
            </tr>

            {/* Net Quarter Movement */}
            <tr className="border-t-2 border-slate-900 font-bold bg-slate-100/70">
              <td className="py-3 pl-2 text-right text-xs uppercase tracking-wider text-slate-800">
                Net Quarter Movement (Credits - Debits)
              </td>
              <td colSpan={2} className={`py-3 pr-2 text-right text-sm ${
                statement.netChangeCents >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {formatCents(statement.netChangeCents, { showPlus: true })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* CLOSING BALANCE SUMMARY BANNER */}
        <div className="mt-auto mb-10 pt-4 border-t border-slate-200">
          <div className="flex justify-end">
            <div className="w-full sm:w-2/3 md:w-1/2 bg-slate-900 text-white rounded-xl p-6 shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-80 block">
                    {isNetPositive ? 'Closing Owner Balance (Payable to Owner)' : 'Closing Owner Balance (Due from Owner)'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Carried forward to next quarter opening balance
                  </span>
                </div>
                <span className="text-3xl font-extrabold tracking-tight">
                  {formatCents(statement.closingBalanceCents)}
                </span>
              </div>
              {!isNetPositive && (
                <div className="mt-2 text-xs text-amber-300 bg-amber-950/40 px-2 py-1 rounded inline-block">
                  Expenses exceeded revenue; balance carried forward as debit.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Remittance & Bank Details */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 print:border-none print:bg-transparent print:p-0">
          <h4 className="text-[11px] font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
            Bank / Remittance Details
          </h4>
          <p className="text-slate-600 text-xs font-mono whitespace-pre-wrap">
            {config.managerBank || 'Direct Bank Transfer'}
          </p>
        </div>

      </div>

      <div className="py-4 text-center border-t border-slate-100 mt-auto bg-slate-50/50">
        <p className="text-[10px] text-slate-400 font-mono">
          STR Invoicer • Australian Financial Year Ledger Engine • Document #{statement.statementId}
        </p>
      </div>
    </div>
  );
};

export const StepInvoice: React.FC<Props> = ({ data, config, onBack, onSaveDraft }) => {
  const statements: QuarterStatement[] = data.quarterlyLedger?.statements || [];
  
  // Current active quarter statement
  const [activeQuarterId, setActiveQuarterId] = useState<string>(() => {
    return data.selectedQuarterId || (statements.length > 0 ? statements[0].quarter.id : '');
  });

  const [viewMode, setViewMode] = useState<'statement' | 'master_ledger'>('statement');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const activeIndex = statements.findIndex(s => s.quarter.id === activeQuarterId);
  const currentStatement: QuarterStatement | undefined = statements[activeIndex !== -1 ? activeIndex : 0];

  const handlePrevQuarter = () => {
    if (activeIndex > 0) {
      setActiveQuarterId(statements[activeIndex - 1].quarter.id);
    }
  };

  const handleNextQuarter = () => {
    if (activeIndex < statements.length - 1) {
      setActiveQuarterId(statements[activeIndex + 1].quarter.id);
    }
  };

  // Reconciled Bookings sorted chronologically
  const sortedBookings = useMemo(() => {
    if (!currentStatement) return [];
    return [...currentStatement.bookings].sort((a, b) => {
      const dateA = a.payout_date || a.check_in_date || '';
      const dateB = b.payout_date || b.check_in_date || '';
      return dateA.localeCompare(dateB);
    });
  }, [currentStatement]);

  // Single Statement Print
  const handlePrint = () => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      const invoiceElement = document.getElementById('printable-invoice');
      if (!invoiceElement) throw new Error("Invoice content not found.");

      const printWindow = window.open('', '_blank', 'width=1000,height=850');
      if (!printWindow) {
        // Fallback for iframe / popup blockers
        window.print();
        setTimeout(() => setIsPrinting(false), 1500);
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n');

      const tailwindScript = '<script src="https://cdn.tailwindcss.com"></script>';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Owner Statement - ${currentStatement?.statementId || 'Quarterly'}</title>
            ${tailwindScript}
            ${styles}
            <style>
              body { background: white !important; padding: 0 !important; margin: 0 !important; font-family: 'Inter', sans-serif; }
              #printable-invoice { box-shadow: none !important; border: none !important; margin: 0 auto !important; width: 100% !important; max-width: 100% !important; }
              @media print {
                body { visibility: visible !important; }
                #printable-invoice { visibility: visible !important; position: static !important; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${invoiceElement.outerHTML}
            </div>
            <script>
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 800);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => setIsPrinting(false), 2500);
    } catch (err) {
      console.error("Print failed:", err);
      // Fallback directly to window.print()
      window.print();
      setTimeout(() => setIsPrinting(false), 1500);
    }
  };

  // Batch Print All Statements Sequentially
  const handleBatchPrint = () => {
    if (statements.length === 0) return;
    setIsBatchPrinting(true);
    setPrintError(null);

    try {
      const batchContainer = document.getElementById('printable-batch-container');
      if (!batchContainer) throw new Error("Batch print content not found.");

      const printWindow = window.open('', '_blank', 'width=1050,height=900');
      if (!printWindow) {
        // Fallback for iframe / popup blockers:
        // Activate batch print CSS mode on document body and trigger window.print()
        document.body.classList.add('batch-print-mode');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('batch-print-mode');
          setIsBatchPrinting(false);
        }, 1500);
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n');

      const tailwindScript = '<script src="https://cdn.tailwindcss.com"></script>';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Owner Statements Batch (${statements.length} Quarters - ${config.ownerName || 'Owner'})</title>
            ${tailwindScript}
            ${styles}
            <style>
              body { background: white !important; padding: 0 !important; margin: 0 !important; font-family: 'Inter', sans-serif; }
              .batch-statement-page {
                page-break-after: always !important;
                break-after: page !important;
                margin-bottom: 2.5rem !important;
              }
              .batch-statement-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
                margin-bottom: 0 !important;
              }
              @media print {
                body { visibility: visible !important; }
                .batch-statement-page {
                  page-break-after: always !important;
                  break-after: page !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .batch-statement-page:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="batch-print-container">
              ${batchContainer.innerHTML}
            </div>
            <script>
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 600);
              }, 900);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => setIsBatchPrinting(false), 3000);
    } catch (err) {
      console.error("Batch print failed:", err);
      // Fallback directly to window.print()
      document.body.classList.add('batch-print-mode');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('batch-print-mode');
        setIsBatchPrinting(false);
      }, 1500);
    }
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    onSaveDraft(data);
    setTimeout(() => setIsSaving(false), 2000);
  };

  // Download Current Quarter CSV Schedule
  const handleDownloadQuarterSchedule = () => {
    if (!currentStatement) return;
    setIsDownloading(true);

    try {
      const rows = currentStatement.reimbursableExpenses.map(item => {
        const debitCents = item.debit_amount_cents || toCents(item.debit_amount);
        const isShared = item.assigned_category === ExpenseCategory.SHARED;
        const splitPercent = item.split_percent !== undefined ? item.split_percent : 50;
        const chargedCents = isShared ? calculateSharedCents(debitCents, splitPercent) : debitCents;

        return {
          'Quarter': currentStatement.quarter.label,
          'Date': item.date,
          'Account': item.account_name,
          'Description': item.description,
          'Contact': item.contact,
          'Original Amount ($)': (debitCents / 100).toFixed(2),
          'Category': item.assigned_category,
          'Owner Split %': isShared ? splitPercent : 100,
          'Owner Charged Amount ($)': (chargedCents / 100).toFixed(2),
          'Note': item.note || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Expenses_${currentStatement.quarter.id}`);

      if (currentStatement.directIncomeRows && currentStatement.directIncomeRows.length > 0) {
        const incomeExportRows = currentStatement.directIncomeRows.map(item => ({
          'Quarter': currentStatement.quarter.label,
          'Date': item.date,
          'Account': item.account_name,
          'Description': item.description,
          'Contact': item.contact,
          'Revenue Amount ($)': ((item.debit_amount_cents || item.credit_amount_cents || toCents(item.debit_amount || item.credit_amount)) / 100).toFixed(2),
          'Classification': 'Direct Rental Income (Owner Credit)',
          'Note': item.note || ''
        }));
        const incomeSheet = XLSX.utils.json_to_sheet(incomeExportRows);
        XLSX.utils.book_append_sheet(workbook, incomeSheet, `Direct_Revenue_${currentStatement.quarter.id}`);
      }

      XLSX.writeFile(workbook, `STR_Schedule_${currentStatement.quarter.id}.xlsx`);
    } catch (e) {
      console.error("Export schedule failed:", e);
    }
    setTimeout(() => setIsDownloading(false), 2000);
  };

  // Download Full Multi-Quarter Ledger Summary
  const handleDownloadFullLedger = () => {
    setIsDownloading(true);
    try {
      const summaryRows = statements.map(s => ({
        'Quarter': s.quarter.label,
        'Period Start': s.quarter.startDate,
        'Period End': s.quarter.endDate,
        'Issue Date': s.issueDate,
        'Opening Balance ($)': (s.openingBalanceCents / 100).toFixed(2),
        'Rental Income ($)': (s.rentalIncomeCents / 100).toFixed(2),
        'Other Credits ($)': (s.otherCreditsCents / 100).toFixed(2),
        'Total Credits ($)': (s.totalCreditsCents / 100).toFixed(2),
        'Mgmt Fee ($)': (s.managementFeeCents / 100).toFixed(2),
        'Reimbursable Expenses ($)': (s.reimbursableExpenseCents / 100).toFixed(2),
        'Shared Expenses ($)': (s.sharedExpenseCents / 100).toFixed(2),
        'Owner Distributions ($)': (s.ownerPayoutsCents / 100).toFixed(2),
        'Total Debits ($)': (s.totalDebitsCents / 100).toFixed(2),
        'Net Quarter Change ($)': (s.netChangeCents / 100).toFixed(2),
        'Closing Balance ($)': (s.closingBalanceCents / 100).toFixed(2)
      }));

      const allExpenseRows: any[] = [];
      statements.forEach(s => {
        s.reimbursableExpenses.forEach(item => {
          const debitCents = item.debit_amount_cents || toCents(item.debit_amount);
          const isShared = item.assigned_category === ExpenseCategory.SHARED;
          const splitPercent = item.split_percent !== undefined ? item.split_percent : 50;
          const chargedCents = isShared ? calculateSharedCents(debitCents, splitPercent) : debitCents;

          allExpenseRows.push({
            'Quarter': s.quarter.label,
            'Date': item.date,
            'Account': item.account_name,
            'Description': item.description,
            'Contact': item.contact,
            'Original Amount ($)': (debitCents / 100).toFixed(2),
            'Category': item.assigned_category,
            'Owner Split %': isShared ? splitPercent : 100,
            'Owner Charged Amount ($)': (chargedCents / 100).toFixed(2),
            'Note': item.note || ''
          });
        });
      });

      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const expensesSheet = XLSX.utils.json_to_sheet(allExpenseRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Quarterly Ledger Summary");
      XLSX.utils.book_append_sheet(workbook, expensesSheet, "All Expenses Schedule");
      XLSX.writeFile(workbook, `STR_Quarterly_Ledger_Master_${config.ownerName || 'Owner'}.xlsx`);
    } catch (e) {
      console.error("Export full ledger failed:", e);
    }
    setTimeout(() => setIsDownloading(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Top Navigation & Toolbar Bar */}
      <div className="flex flex-col gap-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer self-start"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Review
          </button>

          {/* View Mode Toggle: Single Quarter Statement vs Master Continuous Ledger */}
          <div className="flex items-center p-1 bg-slate-200/80 rounded-xl">
            <button
              onClick={() => setViewMode('statement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'statement'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quarter Statement
            </button>
            <button
              onClick={() => setViewMode('master_ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'master_ledger'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Master Historical Ledger ({statements.length} Quarters)
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="inline-flex items-center px-3.5 py-2 border border-slate-300 shadow-sm text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {isSaving ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {isSaving ? 'Saved' : 'Save Draft'}
            </button>

            <button
              onClick={handleDownloadQuarterSchedule}
              disabled={isDownloading || !currentStatement}
              className="inline-flex items-center px-3.5 py-2 border border-slate-300 shadow-sm text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Schedule (.xlsx)
            </button>

            <button
              onClick={handleDownloadFullLedger}
              disabled={isDownloading}
              className="inline-flex items-center px-3.5 py-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
              Full Ledger (.xlsx)
            </button>

            {viewMode === 'statement' && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting || isBatchPrinting}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-md text-xs font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {isPrinting ? (
                    <div className="mr-2 h-3.5 w-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isPrinting ? 'Printing...' : 'Print Statement'}
                </button>

                <button
                  type="button"
                  id="batch-print-btn"
                  onClick={handleBatchPrint}
                  disabled={isBatchPrinting || isPrinting || statements.length === 0}
                  title={`Batch print all ${statements.length} quarterly statements sequentially`}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-md text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {isBatchPrinting ? (
                    <div className="mr-2 h-3.5 w-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isBatchPrinting ? 'Printing All...' : 'Batch Print'}
                </button>
              </>
            )}
          </div>
        </div>

        {printError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs flex items-center self-end animate-in fade-in">
            <AlertCircle size={14} className="mr-2" />
            {printError}
          </div>
        )}

        {/* Quarter Navigator Ribbon (When viewing statement) */}
        {viewMode === 'statement' && statements.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevQuarter}
                disabled={activeIndex <= 0}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Quarter"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Quarter:</span>
                <select
                  value={activeQuarterId}
                  onChange={(e) => setActiveQuarterId(e.target.value)}
                  className="rounded-lg border-slate-300 text-xs font-bold text-slate-800 py-1.5 pl-3 pr-8 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {statements.map(s => (
                    <option key={s.quarter.id} value={s.quarter.id}>
                      {s.quarter.label} ({s.quarter.startDate} – {s.quarter.endDate})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextQuarter}
                disabled={activeIndex >= statements.length - 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next Quarter"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Invariant Indicator */}
            {currentStatement && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
                  <span className="text-slate-500">Opening:</span>
                  <span className="font-bold text-slate-800">{formatCents(currentStatement.openingBalanceCents)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg text-emerald-800">
                  <span>+ Credits:</span>
                  <span className="font-bold">{formatCents(currentStatement.totalCreditsCents)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg text-purple-800">
                  <span>- Debits:</span>
                  <span className="font-bold">{formatCents(currentStatement.totalDebitsCents)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-lg text-indigo-900 border border-indigo-200">
                  <span className="font-bold">Closing:</span>
                  <span className="font-extrabold">{formatCents(currentStatement.closingBalanceCents)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VIEW MODE 1: MASTER HISTORICAL LEDGER VIEW */}
      {viewMode === 'master_ledger' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Quarterly Owner Ledger Master</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Audited Continuity
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Canonical Ledger Equation: <code>CLOSING BALANCE = OPENING BALANCE + TOTAL CREDITS - TOTAL DEBITS</code>.
                Opening balance of each quarter exactly equals the closing balance of the prior quarter.
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Final Owner Balance</span>
              <span className={`text-xl font-bold ${
                (data.quarterlyLedger?.finalClosingBalanceCents || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatCents(data.quarterlyLedger?.finalClosingBalanceCents || 0)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">Quarter</th>
                  <th className="px-4 py-3 text-left">Period Dates</th>
                  <th className="px-4 py-3 text-right">Opening Balance</th>
                  <th className="px-4 py-3 text-right text-emerald-700">Rental Income</th>
                  <th className="px-4 py-3 text-right text-emerald-700">Total Credits</th>
                  <th className="px-4 py-3 text-right text-purple-700">Mgmt Fee</th>
                  <th className="px-4 py-3 text-right text-purple-700">Expenses</th>
                  <th className="px-4 py-3 text-right text-purple-700">Distributions</th>
                  <th className="px-4 py-3 text-right text-purple-700">Total Debits</th>
                  <th className="px-4 py-3 text-right">Net Change</th>
                  <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-900">Closing Balance</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {statements.map((s, idx) => {
                  const isCurrent = s.quarter.id === activeQuarterId;
                  const priorClosing = idx > 0 ? statements[idx - 1].closingBalanceCents : config.initialOpeningBalanceCents;
                  const isContinuous = idx === 0 || s.openingBalanceCents === priorClosing;

                  return (
                    <tr key={s.quarter.id} className={`hover:bg-slate-50 ${isCurrent ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-1.5">
                        {s.quarter.label}
                        {isContinuous && (
                          <span title="Continuity verified: Opening balance matches previous closing balance">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {s.quarter.startDate} to {s.quarter.endDate}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {formatCents(s.openingBalanceCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {formatCents(s.rentalIncomeCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-bold bg-emerald-50/40">
                        +{formatCents(s.totalCreditsCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ({formatCents(s.managementFeeCents)})
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ({formatCents(s.reimbursableExpenseCents + s.sharedExpenseCents)})
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {s.ownerPayoutsCents > 0 ? `(${formatCents(s.ownerPayoutsCents)})` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-700 font-bold bg-purple-50/40">
                        -({formatCents(s.totalDebitsCents)})
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        s.netChangeCents >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatCents(s.netChangeCents, { showPlus: true })}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold bg-indigo-50 text-indigo-950">
                        {formatCents(s.closingBalanceCents)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setActiveQuarterId(s.quarter.id);
                            setViewMode('statement');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          View Statement
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: AUDITABLE QUARTER STATEMENT DOCUMENT (Single View) */}
      {viewMode === 'statement' && currentStatement && (
        <StatementDocument 
          statement={currentStatement} 
          config={config} 
          id="printable-invoice" 
        />
      )}

      {/* HIDDEN BATCH PRINT CONTAINER (All quarterly statements rendered sequentially for batch printing) */}
      <div id="printable-batch-container" className="hidden">
        {statements.map((stmt) => (
          <div key={stmt.quarter.id} className="batch-statement-page">
            <StatementDocument 
              statement={stmt} 
              config={config} 
              id={`batch-doc-${stmt.quarter.id}`} 
            />
          </div>
        ))}
      </div>

    </div>
  );
};
