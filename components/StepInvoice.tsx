
import React, { useMemo, useState } from 'react';
import { ConfigState, ExpenseCategory, ProcessedDataState } from '../types';
import { ArrowLeft, Download, Printer, Save, Check, AlertCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

interface Props {
  data: ProcessedDataState;
  config: ConfigState;
  onBack: () => void;
  onSaveDraft: () => void;
}

export const StepInvoice: React.FC<Props> = ({ data, config, onBack, onSaveDraft }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const invoiceDate = format(new Date(), 'dd MMM yyyy');
  
  const invoiceId = useMemo(() => {
    const end = config.periodEnd ? new Date(config.periodEnd) : new Date();
    const dateStr = isValid(end) ? format(end, 'yyMMdd') : format(new Date(), 'yyMMdd');
    return `SW${dateStr}1124`;
  }, [config.periodEnd]);

  const sortedBookings = useMemo(() => {
    return [...data.otaBookings].sort((a, b) => {
      const dateA = new Date(a.check_in_date || a.payout_date || 0).getTime();
      const dateB = new Date(b.check_in_date || b.payout_date || 0).getTime();
      return dateA - dateB;
    });
  }, [data.otaBookings]);

  const totals = useMemo(() => {
    const grossRevenue = data.stats.totalOtaRevenue;
    const netPayouts = data.stats.totalOtaNet;
    const feeBase = config.feeBaseMode === 'gross_revenue' ? grossRevenue : netPayouts;
    const mgmtFeeAmount = feeBase * (config.mgmtFeePercent / 100);
    const allProcessedExpenses = [
      ...data.autoReimbursables,
      ...data.reviewRows
    ];
    const reimbursableItems = allProcessedExpenses.filter(r => r.include_flag);
    const totalReimbursables = reimbursableItems.reduce((sum, r) => {
      let amount = r.debit_amount;
      if (r.assigned_category === ExpenseCategory.SHARED && r.split_percent !== undefined) {
        amount = amount * (r.split_percent / 100);
      }
      return sum + amount;
    }, 0);
    const totalDeductions = mgmtFeeAmount + totalReimbursables;
    const netToOwner = netPayouts - totalDeductions;
    return {
      grossRevenue,
      netPayouts,
      feeBase,
      feeBaseLabel: config.feeBaseMode === 'gross_revenue' ? 'Gross OTA Revenue' : 'Net OTA Payouts',
      mgmtFeeAmount,
      totalReimbursables,
      totalDeductions,
      netToOwner,
      reimbursableItems
    };
  }, [data, config]);

  const handlePrint = () => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      const invoiceElement = document.getElementById('printable-invoice');
      if (!invoiceElement) throw new Error("Invoice content not found.");

      // Pop-out approach: Better for restricted iframes
      const printWindow = window.open('', '_blank', 'width=1000,height=800');
      
      if (!printWindow) {
        setPrintError("Popup blocked. Please allow popups for this site to print.");
        setIsPrinting(false);
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n');

      const tailwindScript = '<script src="https://cdn.tailwindcss.com"></script>';

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Invoice - ${invoiceId}</title>
            ${tailwindScript}
            ${styles}
            <style>
              body { background: white !important; padding: 0 !important; margin: 0 !important; }
              #printable-invoice { box-shadow: none !important; border: none !important; margin: 0 auto !important; }
              @media print {
                body { visibility: visible !important; }
                #printable-invoice { visibility: visible !important; position: static !important; }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${invoiceElement.outerHTML}
            </div>
            <script>
              // Wait for Tailwind to process classes
              setTimeout(() => {
                window.print();
                // Close after a delay to ensure print dialog finishes
                setTimeout(() => {
                  window.close();
                }, 500);
              }, 1000);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Reset state after a safe buffer
      setTimeout(() => setIsPrinting(false), 3000);
    } catch (err) {
      console.error("Print failed:", err);
      setPrintError("Could not initialize print dialog.");
      setIsPrinting(false);
    }
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    onSaveDraft();
    setTimeout(() => setIsSaving(false), 2000);
  };

  const handleDownloadCsv = () => {
    setIsDownloading(true);
    try {
      const rows = totals.reimbursableItems.map(item => ({
        Date: item.date,
        Account: item.account_name,
        Description: item.description,
        Contact: item.contact,
        'Original Amount': item.debit_amount,
        Category: item.assigned_category,
        'Split %': item.split_percent || 100,
        'Charged Amount': (item.assigned_category === ExpenseCategory.SHARED ? item.debit_amount * ((item.split_percent || 100)/100) : item.debit_amount),
        Note: item.note || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reimbursables");
      XLSX.writeFile(workbook, `Reimbursables_${config.periodStart}_${config.periodEnd}.csv`);
    } catch (e) {
      console.error("Export failed", e);
    }
    setTimeout(() => setIsDownloading(false), 2000);
  };

  const isNetPositive = totals.netToOwner >= 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col gap-4 mb-8 no-print">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Review
          </button>
          <div className="flex space-x-3">
            <button
              onClick={handleSaveDraft}
              className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              {isSaving ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saved' : 'Save Draft'}
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={isDownloading}
              className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isDownloading ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Download className="mr-2 h-4 w-4" />}
              {isDownloading ? 'Downloaded' : 'Download Schedule'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center px-6 py-2.5 border border-transparent shadow-md text-sm font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-70"
            >
              {isPrinting ? <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Printer className="mr-2 h-4 w-4" />}
              {isPrinting ? 'Opening Window...' : 'Print Statement'}
            </button>
          </div>
        </div>
        {printError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs flex items-center self-end animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={14} className="mr-2" />
            {printError}
          </div>
        )}
      </div>

      <div id="printable-invoice" className="bg-white shadow-2xl shadow-slate-200 mx-auto w-full max-w-[210mm] min-h-[297mm] text-slate-900 relative print:shadow-none print:w-full print:max-w-none print:m-0 flex flex-col">
        <div className="h-3 w-full bg-slate-800 print:bg-black"></div>
        <div className="p-12 sm:p-16 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-16">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1 uppercase">Owner Statement</h1>
              <p className="text-slate-500 font-medium">#{invoiceId}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-900">{config.managerName}</h2>
              <p className="text-slate-500 whitespace-pre-line text-sm mt-1">{config.managerContact}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12 border-b border-slate-100 pb-12">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Prepared For</h3>
              <div className="text-lg font-semibold text-slate-900">{config.ownerName}</div>
              <div className="text-slate-600">Property Owner</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statement Date</h3>
                <div className="font-medium text-slate-900">{invoiceDate}</div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Period</h3>
                <div className="font-medium text-slate-900 text-sm">
                   {config.periodStart} <span className="text-slate-400 text-xs mx-1">to</span> {config.periodEnd}
                </div>
              </div>
            </div>
          </div>

          <table className="w-full mb-12">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide w-40">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td colSpan={2} className="py-2">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Funds Received (Bookings)</div>
                </td>
              </tr>
              {sortedBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50/50">
                  <td className="py-2 pl-4 pr-4">
                    <div className="text-sm font-medium text-slate-900">{booking.guest_name || 'Guest Booking'}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                       <span>{booking.check_in_date}</span>
                       {booking.check_out_date && <span>to {booking.check_out_date}</span>}
                       <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                       <span>Ref: {booking.reservation_id}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right align-top text-slate-600 text-sm">
                    ${booking.net_payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="py-3 pl-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Total Funds Received
                </td>
                <td className="py-3 text-right font-bold text-slate-900">
                  ${totals.netPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr><td colSpan={2} className="h-4"></td></tr>
              <tr>
                <td colSpan={2} className="py-2">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Less Deductions</div>
                </td>
              </tr>
              <tr>
                <td className="py-4 pl-2 pr-4">
                  <div className="font-medium text-slate-900">Property Management Fee</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {config.mgmtFeePercent}% of {totals.feeBaseLabel} (${totals.feeBase.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </div>
                </td>
                <td className="py-4 text-right align-top text-slate-900">
                  (${totals.mgmtFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </td>
              </tr>
              {totals.reimbursableItems.map((item) => {
                let displayAmount = item.debit_amount;
                let descSuffix = "";
                if (item.assigned_category === ExpenseCategory.SHARED) {
                   displayAmount = item.debit_amount * ((item.split_percent || 100) / 100);
                   descSuffix = ` (Split ${item.split_percent}%)`;
                }
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 pl-4 pr-4">
                      <div className="text-sm font-medium text-slate-900">{item.description}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                         <span>{item.date}</span>
                         <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                         <span>{item.account_name}</span>
                         {item.contact && (
                           <>
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             <span>{item.contact}</span>
                           </>
                         )}
                         {descSuffix && <span className="text-blue-600 font-medium">{descSuffix}</span>}
                      </div>
                    </td>
                    <td className="py-2 text-right align-top text-slate-600 text-sm">
                      (${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-200">
                <td className="py-3 pl-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Total Deductions
                </td>
                <td className="py-3 text-right font-semibold text-slate-700">
                  (${totals.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-auto mb-16">
             <div className="flex justify-end">
               <div className="w-2/3 md:w-1/2 bg-slate-900 text-white rounded-lg p-6 shadow-lg">
                 <div className="flex justify-between items-center">
                   <span className="text-sm font-medium uppercase tracking-wider opacity-80">
                     {isNetPositive ? 'Net Payout to Owner' : 'Amount Due from Owner'}
                   </span>
                   <span className="text-3xl font-bold">
                     ${Math.abs(totals.netToOwner).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                   </span>
                 </div>
                 {!isNetPositive && (
                   <div className="mt-2 text-xs text-red-200 bg-red-900/30 px-2 py-1 rounded inline-block">
                     Expenses exceeded revenue this period.
                   </div>
                 )}
               </div>
             </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 print:border-none print:bg-transparent print:p-0 mt-8">
            <h4 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">Payment / Transfer Details</h4>
            <p className="text-slate-600 text-sm font-mono whitespace-pre-wrap">{config.managerBank}</p>
          </div>
        </div>
        
        <div className="py-6 text-center border-t border-slate-100 mt-auto">
           <p className="text-[10px] text-slate-400">Generated by STR Invoicer</p>
        </div>
      </div>
    </div>
  );
};
