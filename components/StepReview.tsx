import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CanonicalGlRow, 
  ConfigState, 
  ExpenseCategory, 
  ProcessedDataState 
} from '../types';
import { CATEGORY_LABELS } from '../constants';
import { buildQuarterlyLedger } from '../services/ledgerEngine';
import { calculateSharedCents, centsToDollars, formatCents, toCents } from '../services/moneyUtils';
import { findMatchingOtaBooking } from '../services/reconciliationService';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  Search, 
  X, 
  CheckSquare, 
  Check, 
  Layers, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Calendar,
  Filter
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';

interface Props {
  data: ProcessedDataState;
  config: ConfigState;
  onBack: () => void;
  onNext: (data: ProcessedDataState) => void;
  onSaveDraft: (currentData?: ProcessedDataState) => void;
}

const CAT_CONFIG: Record<ExpenseCategory, { bg: string, text: string, border: string, color: string }> = {
  [ExpenseCategory.REIMBURSABLE]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: '#10B981' },
  [ExpenseCategory.SHARED]: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', color: '#3B82F6' },
  [ExpenseCategory.MANAGER_ONLY]: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', color: '#8B5CF6' },
  [ExpenseCategory.OWNER_ONLY]: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', color: '#64748B' },
  [ExpenseCategory.EXCLUDE]: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', color: '#EF4444' },
  [ExpenseCategory.REVIEW_ALWAYS]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', color: '#F59E0B' },
  [ExpenseCategory.INCOME]: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', color: '#059669' }
};

export const StepReview: React.FC<Props> = ({ data, config, onBack, onNext, onSaveDraft }) => {
  const [reviewRows, setReviewRows] = useState<CanonicalGlRow[]>(data.reviewRows);
  const [selectedQuarterFilter, setSelectedQuarterFilter] = useState<string>('ALL');
  
  // Dedicated Toggle: Filter out any lines that have a classification assigned
  const [filterUnclassifiedOnly, setFilterUnclassifiedOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Dashboard collapsible state
  const [showDashboard, setShowDashboard] = useState<boolean>(true);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState<ExpenseCategory | ''>('');
  const [bulkSplitPercent, setBulkSplitPercent] = useState<number>(50);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  // Available Quarters from Ledger
  const availableQuarters = useMemo(() => {
    if (data.quarterlyLedger?.statements) {
      return data.quarterlyLedger.statements.map(s => s.quarter);
    }
    return [];
  }, [data.quarterlyLedger]);

  // Single row update with deterministic nullish shared percentage
  const handleRowChange = (id: string, updates: Partial<CanonicalGlRow>) => {
    setReviewRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, ...updates };
      
      if (updates.assigned_category) {
        switch (updates.assigned_category) {
          case ExpenseCategory.REIMBURSABLE:
            updated.include_flag = true;
            break;
          case ExpenseCategory.SHARED:
            updated.include_flag = true;
            updated.split_percent = updated.split_percent !== undefined ? updated.split_percent : 50;
            break;
          case ExpenseCategory.MANAGER_ONLY:
          case ExpenseCategory.OWNER_ONLY:
          case ExpenseCategory.EXCLUDE:
            updated.include_flag = false;
            break;
          case ExpenseCategory.INCOME:
            updated.include_flag = true;
            if (!updated.reconciliation_mode) {
              const matchResult = findMatchingOtaBooking(row, data.otaBookings);
              if (matchResult.booking) {
                updated.reconciled_ota_id = matchResult.booking.id;
                updated.reconciliation_mode = 'MATCHED_OTA';
                updated.matched_booking_ref = matchResult.booking.reservation_id;
                updated.matched_guest_name = matchResult.booking.guest_name;
                updated.matched_amount_cents = matchResult.booking.net_payout_cents;
                updated.note = `Reconciled to Booking #${matchResult.booking.reservation_id}`;
              } else {
                updated.reconciliation_mode = 'DIRECT_INCOME';
                updated.note = 'Direct Rental Revenue';
              }
            }
            break;
        }
      }
      return updated;
    }));
  };

  // Bulk assignment logic
  const handleBatchAssign = (category: ExpenseCategory, splitPercent?: number) => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    setReviewRows(prev => prev.map(row => {
      if (!selectedIds.has(row.id)) return row;

      const updated = { ...row, assigned_category: category };
      switch (category) {
        case ExpenseCategory.REIMBURSABLE:
          updated.include_flag = true;
          break;
        case ExpenseCategory.SHARED:
          updated.include_flag = true;
          updated.split_percent = splitPercent !== undefined ? Math.min(100, Math.max(0, splitPercent)) : (updated.split_percent ?? 50);
          break;
        case ExpenseCategory.MANAGER_ONLY:
        case ExpenseCategory.OWNER_ONLY:
        case ExpenseCategory.EXCLUDE:
          updated.include_flag = false;
          break;
        case ExpenseCategory.INCOME:
          updated.include_flag = true;
          const matchResult = findMatchingOtaBooking(row, data.otaBookings);
          if (matchResult.booking) {
            updated.reconciled_ota_id = matchResult.booking.id;
            updated.reconciliation_mode = 'MATCHED_OTA';
            updated.matched_booking_ref = matchResult.booking.reservation_id;
            updated.matched_guest_name = matchResult.booking.guest_name;
            updated.matched_amount_cents = matchResult.booking.net_payout_cents;
            updated.note = `Reconciled to Booking #${matchResult.booking.reservation_id}`;
          } else {
            updated.reconciliation_mode = 'DIRECT_INCOME';
            updated.note = 'Direct Rental Revenue';
          }
          break;
      }
      return updated;
    }));

    setSelectedIds(new Set());
    setBulkCategory('');
    setFeedbackMessage(`Successfully assigned ${count} expenses to "${CATEGORY_LABELS[category]}"`);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  const handleNext = () => {
    // Rebuild quarterly ledger with the updated reviewRows to ensure perfect mathematical consistency
    const updatedExpenses = [
      ...data.autoReimbursables,
      ...reviewRows
    ];

    // Sync reviewRows classification back to glIncome in case any glIncome row was classified
    const reviewMap = new Map<string, CanonicalGlRow>();
    reviewRows.forEach(r => reviewMap.set(r.id, r));
    const updatedGlIncome = data.glIncome.map(g => reviewMap.get(g.id) || g);

    const updatedLedger = buildQuarterlyLedger({
      otaBookings: data.otaBookings,
      glIncome: updatedGlIncome,
      glExpenses: updatedExpenses,
      config
    });

    onNext({ 
      ...data, 
      glIncome: updatedGlIncome,
      reviewRows,
      quarterlyLedger: updatedLedger,
      selectedQuarterId: selectedQuarterFilter !== 'ALL' ? selectedQuarterFilter : (updatedLedger.statements[0]?.quarter.id)
    });
  };

  // Filter and search calculations
  const filteredRows = useMemo(() => {
    return reviewRows.filter(row => {
      // Quarter Filter
      if (selectedQuarterFilter !== 'ALL' && row.quarterId !== selectedQuarterFilter) {
        return false;
      }

      const isUnclassified = !row.assigned_category || row.assigned_category === ExpenseCategory.REVIEW_ALWAYS;
      
      // When toggle is ON: Filter out any lines that already have a classification assigned!
      if (filterUnclassifiedOnly && !isUnclassified) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesDate = row.date?.toLowerCase().includes(query);
        const matchesDesc = row.description?.toLowerCase().includes(query);
        const matchesAccount = row.account_name?.toLowerCase().includes(query);
        const matchesContact = row.contact?.toLowerCase().includes(query);
        const matchesAmount = row.debit_amount.toString().includes(query);
        if (!matchesDate && !matchesDesc && !matchesAccount && !matchesContact && !matchesAmount) {
          return false;
        }
      }

      return true;
    });
  }, [reviewRows, selectedQuarterFilter, filterUnclassifiedOnly, searchTerm]);

  // Overall counts
  const unassignedCount = useMemo(() => {
    return reviewRows.filter(r => !r.assigned_category || r.assigned_category === ExpenseCategory.REVIEW_ALWAYS).length;
  }, [reviewRows]);

  const classifiedCount = useMemo(() => {
    return reviewRows.length - unassignedCount;
  }, [reviewRows.length, unassignedCount]);

  // Selected stats in integer cents
  const selectedAmountCents = useMemo(() => {
    let sum = 0;
    reviewRows.forEach(r => {
      if (selectedIds.has(r.id)) {
        sum += (r.debit_amount_cents || toCents(r.debit_amount));
      }
    });
    return sum;
  }, [reviewRows, selectedIds]);

  // Master checkbox indeterminate state
  useEffect(() => {
    if (masterCheckboxRef.current) {
      const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id));
      const someFilteredSelected = filteredRows.some(r => selectedIds.has(r.id));
      masterCheckboxRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [filteredRows, selectedIds]);

  // Toggle single row with Shift+Click support for range selection
  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (isShift && lastSelectedId && lastSelectedId !== id) {
        const lastIdx = filteredRows.findIndex(r => r.id === lastSelectedId);
        const currentIdx = filteredRows.findIndex(r => r.id === id);

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          const shouldSelect = !prev.has(id);

          for (let i = start; i <= end; i++) {
            if (shouldSelect) {
              next.add(filteredRows[i].id);
            } else {
              next.delete(filteredRows[i].id);
            }
          }
          setLastSelectedId(id);
          return next;
        }
      }

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastSelectedId(id);
      return next;
    });
  };

  // Toggle master select all visible
  const handleToggleSelectAll = () => {
    const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id));
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredRows.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredRows.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  // Select all pending helper
  const handleSelectAllPending = () => {
    const pendingIds = reviewRows
      .filter(r => !r.assigned_category || r.assigned_category === ExpenseCategory.REVIEW_ALWAYS)
      .map(r => r.id);
    setSelectedIds(new Set(pendingIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  // 1. RECHARTS: Expense Distribution Pie Chart Data (Calculated in Cents)
  const expenseStats = useMemo(() => {
    const allExpenses = [...data.autoReimbursables, ...reviewRows];
    const bucketsCents: Record<string, number> = {
      [ExpenseCategory.REIMBURSABLE]: 0,
      [ExpenseCategory.SHARED]: 0,
      [ExpenseCategory.MANAGER_ONLY]: 0,
      [ExpenseCategory.OWNER_ONLY]: 0,
      'Unassigned': 0
    };

    allExpenses.forEach(r => {
      if (selectedQuarterFilter !== 'ALL' && r.quarterId !== selectedQuarterFilter) return;

      const cat = r.assigned_category;
      if (cat === ExpenseCategory.EXCLUDE) return;

      const cents = r.debit_amount_cents || toCents(r.debit_amount);

      if (cat && bucketsCents[cat] !== undefined) {
        if (cat === ExpenseCategory.SHARED) {
          bucketsCents[cat] += calculateSharedCents(cents, r.split_percent);
        } else {
          bucketsCents[cat] += cents;
        }
      } else if (!cat || cat === ExpenseCategory.REVIEW_ALWAYS) {
        bucketsCents['Unassigned'] += cents;
      }
    });

    return Object.entries(bucketsCents)
      .filter(([_, val]) => val > 0)
      .map(([name, valCents]) => ({ 
        name: CATEGORY_LABELS[name as ExpenseCategory] || name, 
        value: centsToDollars(valCents),
        color: CAT_CONFIG[name as ExpenseCategory]?.color || '#F59E0B'
      }));
  }, [data.autoReimbursables, reviewRows, selectedQuarterFilter]);

  const totalExpenseAmount = useMemo(() => {
    return expenseStats.reduce((sum, item) => sum + item.value, 0);
  }, [expenseStats]);

  const reimbursableAmount = useMemo(() => {
    return expenseStats.find(s => s.name === CATEGORY_LABELS[ExpenseCategory.REIMBURSABLE])?.value || 0;
  }, [expenseStats]);

  // 2. RECHARTS: Revenue / Quarterly Trend Bar Chart Data
  const revenueTrendData = useMemo(() => {
    if (data.quarterlyLedger?.statements && data.quarterlyLedger.statements.length > 0) {
      return data.quarterlyLedger.statements.map(s => ({
        label: s.quarter.label,
        gross: centsToDollars(s.managementFeeBaseCents),
        net: centsToDollars(s.rentalIncomeCents),
        closingBalance: centsToDollars(s.closingBalanceCents)
      }));
    }

    // Fallback: per-date summary if ledger not ready
    const map: Record<string, { label: string, gross: number, net: number }> = {};
    data.otaBookings.forEach(b => {
      const d = b.payout_date || b.check_in_date;
      if (!d) return;
      const k = d.slice(0, 7);
      if (!map[k]) map[k] = { label: k, gross: 0, net: 0 };
      map[k].gross += b.gross_amount;
      map[k].net += b.net_payout;
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }, [data.quarterlyLedger, data.otaBookings]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Level KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><TrendingUp size={16}/></div>
            OTA Bookings
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">{data.otaBookings.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total reservations loaded</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
             <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><DollarSign size={16}/></div>
             Net Cash Payout
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">
            ${data.stats.totalOtaNet.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Disbursed cash receipts from OTA</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
           <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
             <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><CheckCircle2 size={16}/></div>
             Reconciled Credits
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">{data.stats.reconciledCount}</div>
          <div className="text-xs text-slate-400 mt-1">GL cash receipts matched to bookings</div>
        </div>

        {/* Interactive Pending Review Card (Toggles the unclassified filter on click) */}
        <div 
          id="stat-pending-review-card"
          onClick={() => setFilterUnclassifiedOnly(prev => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilterUnclassifiedOnly(prev => !prev); }}
          className={`p-5 rounded-2xl shadow-sm border flex flex-col cursor-pointer transition-all duration-200 select-none ${
            filterUnclassifiedOnly 
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/80 shadow-amber-100' 
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-md'
          }`}
          title="Click to toggle unclassified filter on/off"
        >
           <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
             <div className="flex items-center gap-2">
               <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><AlertCircle size={16}/></div>
               <span>Pending Review</span>
             </div>
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
               filterUnclassifiedOnly 
                 ? 'bg-amber-500 text-white' 
                 : 'bg-slate-100 text-slate-600'
             }`}>
               {filterUnclassifiedOnly ? 'Filter Active' : 'Click to filter'}
             </span>
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-auto">{unassignedCount}</div>
          <div className="text-xs text-slate-400 mt-1">
            {filterUnclassifiedOnly ? 'Only pending lines displayed' : 'Transactions requiring category'}
          </div>
        </div>
      </div>

      {/* SUMMARY DASHBOARD (RECHARTS) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Dashboard Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-200">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Summary Dashboard</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Expense classification distribution and quarterly revenue trend across historical quarters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Quarter Filter Selector */}
            {availableQuarters.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <Filter size={13} className="text-slate-400" />
                <span className="text-slate-500 font-medium">Scope:</span>
                <select
                  value={selectedQuarterFilter}
                  onChange={(e) => setSelectedQuarterFilter(e.target.value)}
                  className="border-0 bg-transparent text-xs font-semibold text-slate-800 focus:ring-0 p-0 cursor-pointer"
                >
                  <option value="ALL">All Quarters (Cumulative)</option>
                  {availableQuarters.map(q => (
                    <option key={q.id} value={q.id}>{q.label}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowDashboard(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-colors cursor-pointer"
            >
              {showDashboard ? (
                <>
                  <ChevronUp size={14} />
                  <span>Collapse Dashboard</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>Expand Dashboard</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Charts Content */}
        {showDashboard && (
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            
            {/* Chart 1: Expenses by Category (Pie Chart) - 5 Cols */}
            <div className="lg:col-span-5 bg-slate-50/60 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <PieChartIcon size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Expenses by Category</h4>
                      <p className="text-[11px] text-slate-500">Breakdown of categorized & pending expenses</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Expenses</span>
                    <span className="text-sm font-bold text-slate-900">${totalExpenseAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Pie Chart Display */}
                <div className="w-full h-[250px] flex items-center justify-center">
                  {expenseStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                      <PieChart>
                        <Pie
                          data={expenseStats}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {expenseStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number) => [`$${val.toFixed(2)}`, 'Amount']}
                          contentStyle={{ 
                            borderRadius: '10px', 
                            border: '1px solid #e2e8f0', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-slate-400 text-xs py-8">
                      No expense data available for this scope
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Category Quick Highlights */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 mt-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Reimbursable</span>
                  <span className="text-sm font-bold text-emerald-600">${reimbursableAmount.toFixed(2)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Pending Review</span>
                  <span className="text-sm font-bold text-amber-600">
                    {unassignedCount} items
                  </span>
                </div>
              </div>
            </div>

            {/* Chart 2: Revenue Over Time / Quarters (Bar Chart) - 7 Cols */}
            <div className="lg:col-span-7 bg-slate-50/60 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <BarChart3 size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Quarterly Financial Trend</h4>
                      <p className="text-[11px] text-slate-500">Gross fee base vs net cash payout received</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                      <span className="text-slate-600 font-medium">Gross Fee Base</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-slate-600 font-medium">Net Disbursed</span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart Display */}
                <div className="w-full h-[250px]">
                  {revenueTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                      <BarChart 
                        data={revenueTrendData} 
                        margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip 
                          formatter={(val: number, name: string) => [
                            `$${val.toFixed(2)}`, 
                            name === 'gross' ? 'Gross Base' : name === 'net' ? 'Net Cash' : 'Closing Balance'
                          ]}
                          contentStyle={{ 
                            borderRadius: '10px', 
                            border: '1px solid #e2e8f0', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="right" 
                          height={28} 
                          iconType="circle" 
                          wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} 
                        />
                        <Bar 
                          dataKey="gross" 
                          name="Gross Base" 
                          fill="#6366f1" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={32}
                        />
                        <Bar 
                          dataKey="net" 
                          name="Net Cash" 
                          fill="#10b981" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                      <Calendar size={24} className="mb-2 text-slate-300" />
                      <span>No quarterly revenue entries available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Quick Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 mt-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Net Cash</span>
                  <span className="text-sm font-bold text-emerald-600">${data.stats.totalOtaNet.toFixed(2)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Quarters in Range</span>
                  <span className="text-sm font-bold text-slate-800">
                    {data.quarterlyLedger?.statements.length || 0} Quarters
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Final Ledger Balance</span>
                  <span className="text-sm font-bold text-indigo-600">
                    {formatCents(data.quarterlyLedger?.finalClosingBalanceCents || 0)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Notification banner */}
      {feedbackMessage && (
        <div 
          id="batch-feedback-banner"
          className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* MAIN REVIEW EXPENSES TABLE CARD */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-[640px]">
        
        {/* Card Header & Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Review Expenses & Allocations</h2>
              {unassignedCount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  {unassignedCount} pending classification
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  All categorized
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Categorize transactions individually or select multiple with checkboxes to batch assign</p>
          </div>

          {/* Filter Controls: Search, Quarter Filter & Dedicated Toggle Switch */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            
            {/* Search input */}
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                id="expense-search-input"
                type="text"
                placeholder="Search payee, desc..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* DEDICATED TOGGLE SWITCH: Filter Unclassified */}
            <button
              id="toggle-filter-unclassified"
              type="button"
              role="switch"
              aria-checked={filterUnclassifiedOnly}
              onClick={() => setFilterUnclassifiedOnly(prev => !prev)}
              title={filterUnclassifiedOnly ? "Turn off filter to show all expenses" : "Filter out classified lines and show only unclassified items"}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none border ${
                filterUnclassifiedOnly
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm shadow-amber-200'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
              }`}
            >
              <div 
                className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors duration-200 ${
                  filterUnclassifiedOnly ? 'bg-amber-700/60 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
              </div>

              <span>Filter Unclassified</span>
              
              <span 
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-colors ${
                  filterUnclassifiedOnly 
                    ? 'bg-amber-700/50 text-white' 
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {unassignedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Active Filter Status Bar when Toggle is ON */}
        {filterUnclassifiedOnly && (
          <div 
            id="unclassified-filter-active-bar"
            className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="font-medium">
                <strong>Filter Active:</strong> Showing only <strong>{filteredRows.length}</strong> unclassified items needing a category ({classifiedCount} classified lines filtered out)
              </span>
            </div>
            <button
              id="reset-filter-toggle-btn"
              onClick={() => setFilterUnclassifiedOnly(false)}
              className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer ml-3 shrink-0"
            >
              Show all {reviewRows.length} lines
            </button>
          </div>
        )}

        {/* Bulk Selection Action Bar */}
        {selectedIds.size > 0 ? (
          <div 
            id="bulk-actions-toolbar"
            className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 bg-indigo-100/80 px-2.5 py-1 rounded-lg">
                <CheckSquare size={14} className="text-indigo-600" />
                <span>{selectedIds.size} selected</span>
                <span className="text-indigo-500 font-normal">|</span>
                <span className="text-indigo-700 font-medium">
                  {formatCents(selectedAmountCents)}
                </span>
              </div>

              <button
                id="bulk-deselect-btn"
                onClick={handleClearSelection}
                className="text-xs text-indigo-700 hover:text-indigo-900 underline font-medium cursor-pointer"
              >
                Clear selection
              </button>

              {selectedIds.size < filteredRows.length && (
                <button
                  onClick={handleToggleSelectAll}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-white/70 hover:bg-white px-2 py-0.5 rounded border border-indigo-200 transition-colors cursor-pointer"
                >
                  Select all {filteredRows.length} visible
                </button>
              )}

              {unassignedCount > 0 && selectedIds.size < unassignedCount && !filterUnclassifiedOnly && (
                <button
                  onClick={handleSelectAllPending}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer"
                >
                  Select all {unassignedCount} pending
                </button>
              )}
            </div>

            {/* Bulk Classification Dropdown & Apply Form */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <span className="text-xs font-medium text-slate-700 hidden sm:inline">Assign classification:</span>
              
              <select
                id="bulk-category-select"
                className="rounded-lg border border-indigo-300 py-1 pl-2.5 pr-7 text-xs font-medium text-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as ExpenseCategory)}
              >
                <option value="">Select category...</option>
                {Object.values(ExpenseCategory)
                  .filter(c => c !== ExpenseCategory.REVIEW_ALWAYS)
                  .map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
              </select>

              {bulkCategory === ExpenseCategory.SHARED && (
                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Owner %</span>
                  <input 
                    type="number"
                    min={0}
                    max={100}
                    className="w-12 py-0.5 text-xs text-slate-900 border-0 focus:ring-0 text-center font-semibold"
                    value={bulkSplitPercent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setBulkSplitPercent(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                    }}
                  />
                </div>
              )}

              <button
                id="bulk-apply-btn"
                disabled={!bulkCategory}
                onClick={() => bulkCategory && handleBatchAssign(bulkCategory, bulkSplitPercent)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg shadow-sm transition-all ${
                  bulkCategory
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-indigo-200'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check size={14} />
                Apply to {selectedIds.size}
              </button>

              <div className="flex items-center gap-1 border-l border-indigo-200 pl-2">
                <button
                  id="quick-income-btn"
                  onClick={() => handleBatchAssign(ExpenseCategory.INCOME)}
                  title="Classify selected items as Income / Revenue (Owner Credit)"
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                >
                  <TrendingUp size={12} />
                  + Income / Revenue
                </button>
                <button
                  id="quick-reimbursable-btn"
                  onClick={() => handleBatchAssign(ExpenseCategory.REIMBURSABLE)}
                  title="Quickly assign selected items as Reimbursable (100% Owner)"
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
                >
                  + Reimbursable
                </button>
                <button
                  id="quick-exclude-btn"
                  onClick={() => handleBatchAssign(ExpenseCategory.EXCLUDE)}
                  title="Quickly exclude selected items from invoice"
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Exclude
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" />
              <span>Select multiple rows via checkboxes or hold <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Shift</kbd> to select ranges.</span>
            </span>
            {unassignedCount > 0 && !filterUnclassifiedOnly && (
              <button
                id="select-pending-helper-btn"
                onClick={handleSelectAllPending}
                className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline text-[11px] cursor-pointer"
              >
                Select all {unassignedCount} pending
              </button>
            )}
          </div>
        )}
        
        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar relative max-h-[560px]">
           <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">
                    <input 
                      id="master-select-checkbox"
                      ref={masterCheckboxRef}
                      type="checkbox"
                      aria-label="Select all visible expenses"
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={allFilteredSelected}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Description</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">Classification</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Notes / Ref</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="py-14 text-center">
                       <div className="mx-auto h-12 w-12 text-emerald-400 mb-3 flex items-center justify-center bg-emerald-50 rounded-full">
                         <CheckCircle2 size={28} className="text-emerald-500" />
                       </div>
                       {filterUnclassifiedOnly && unassignedCount === 0 ? (
                         <div>
                           <h4 className="text-slate-900 font-bold text-base">All Expenses Classified!</h4>
                           <p className="text-slate-500 text-sm mt-1">There are no pending unclassified expenses remaining.</p>
                           <button
                             onClick={() => setFilterUnclassifiedOnly(false)}
                             className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                           >
                             <Eye size={14} />
                             View All Classified Expenses
                           </button>
                         </div>
                       ) : (
                         <div>
                           <p className="text-slate-600 text-sm font-medium">No expenses match your search or filter.</p>
                           {(searchTerm || filterUnclassifiedOnly || selectedQuarterFilter !== 'ALL') && (
                             <button 
                               onClick={() => {
                                 setSearchTerm('');
                                 setFilterUnclassifiedOnly(false);
                                 setSelectedQuarterFilter('ALL');
                               }}
                               className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                             >
                               Clear all filters
                             </button>
                           )}
                         </div>
                       )}
                     </td>
                   </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isSelected = selectedIds.has(row.id);
                    const isShared = row.assigned_category === ExpenseCategory.SHARED;
                    const splitVal = row.split_percent !== undefined ? row.split_percent : 50;
                    const debitCents = row.debit_amount_cents || toCents(row.debit_amount);
                    const chargedCents = isShared ? calculateSharedCents(debitCents, splitVal) : debitCents;

                    return (
                      <tr 
                        key={row.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center align-top">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => handleToggleRow(row.id, e)}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-500">{row.date}</span>
                            {row.quarterId && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {row.quarterId.replace('FY', 'FY ')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-slate-900 mt-0.5">{row.description}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{row.account_name}</span>
                            {row.contact && <span>• {row.contact}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <div className={`text-sm font-bold ${
                            row.assigned_category === ExpenseCategory.INCOME ? 'text-emerald-700' : 'text-slate-900'
                          }`}>
                            {row.assigned_category === ExpenseCategory.INCOME ? `+${formatCents(debitCents)}` : formatCents(debitCents)}
                          </div>
                          {row.assigned_category === ExpenseCategory.INCOME && (
                            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                              Revenue (Owner Credit)
                            </div>
                          )}
                          {isShared && (
                            <div className="text-xs text-blue-600 font-semibold mt-0.5">
                              Owner Share: {formatCents(chargedCents)} ({splitVal}%)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1.5">
                            <select
                              value={row.assigned_category || ExpenseCategory.REVIEW_ALWAYS}
                              onChange={(e) => handleRowChange(row.id, { assigned_category: e.target.value as ExpenseCategory })}
                              className="block w-full text-xs font-medium rounded-lg border-slate-200 py-1.5 pl-2.5 pr-8 focus:border-indigo-500 focus:ring-indigo-500 bg-white shadow-sm"
                            >
                              {Object.values(ExpenseCategory).map(cat => (
                                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                              ))}
                            </select>

                            {/* Income / Revenue Reconciliation Panel */}
                            {row.assigned_category === ExpenseCategory.INCOME && (
                              <div className="mt-2 p-2.5 rounded-xl border text-xs bg-emerald-50/80 border-emerald-300 text-emerald-950 space-y-1.5 shadow-xs">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold flex items-center gap-1.5 text-[11px] text-emerald-900">
                                    <TrendingUp size={13} className="text-emerald-600 shrink-0" />
                                    {row.reconciliation_mode === 'MATCHED_OTA' 
                                      ? `Matched to Booking #${row.matched_booking_ref || ''}`
                                      : row.reconciliation_mode === 'DUPLICATE_EXCLUDE'
                                      ? 'Duplicate / Already Counted'
                                      : 'Direct Guest Revenue'}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    row.reconciliation_mode === 'MATCHED_OTA'
                                      ? 'bg-blue-100 text-blue-800'
                                      : row.reconciliation_mode === 'DUPLICATE_EXCLUDE'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-emerald-200 text-emerald-900'
                                  }`}>
                                    {row.reconciliation_mode === 'MATCHED_OTA' 
                                      ? 'Reconciled (Single Count)' 
                                      : row.reconciliation_mode === 'DUPLICATE_EXCLUDE' 
                                      ? 'Excluded' 
                                      : '+ Owner Credit'}
                                  </span>
                                </div>

                                {row.reconciliation_mode === 'MATCHED_OTA' && (
                                  <div className="text-[11px] text-slate-700 leading-tight">
                                    Matches guest <strong>{row.matched_guest_name || 'Guest'}</strong>. Confirms banking cash receipt; linked to booking to prevent double-counting.
                                  </div>
                                )}

                                {(!row.reconciliation_mode || row.reconciliation_mode === 'DIRECT_INCOME') && (
                                  <div className="text-[11px] text-slate-700 leading-tight">
                                    Recognized as independent direct rental revenue. Will be included in statement funds received as an Owner Credit.
                                  </div>
                                )}

                                {row.reconciliation_mode === 'DUPLICATE_EXCLUDE' && (
                                  <div className="text-[11px] text-amber-800 leading-tight">
                                    Flagged as duplicate of revenue already recognized from earlier data load. Excluded from statement credits.
                                  </div>
                                )}

                                 <div className="flex items-center gap-1.5 pt-1.5 border-t border-emerald-200/80 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleRowChange(row.id, { 
                                      reconciliation_mode: 'DIRECT_INCOME',
                                      note: row.note || 'Direct Rental Revenue'
                                    })}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                      row.reconciliation_mode === 'DIRECT_INCOME' || !row.reconciliation_mode
                                        ? 'bg-emerald-700 text-white shadow-xs'
                                        : 'bg-white text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                    }`}
                                  >
                                    Direct Revenue (+ Credit)
                                  </button>

                                  {data.otaBookings.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.reconciliation_mode === 'MATCHED_OTA') {
                                          handleRowChange(row.id, { reconciliation_mode: 'DIRECT_INCOME' });
                                        } else {
                                          const matchResult = findMatchingOtaBooking(row, data.otaBookings);
                                          const targetBooking = matchResult.booking || data.otaBookings[0];
                                          handleRowChange(row.id, { 
                                            reconciliation_mode: 'MATCHED_OTA',
                                            reconciled_ota_id: targetBooking.id,
                                            matched_booking_ref: targetBooking.reservation_id,
                                            matched_guest_name: targetBooking.guest_name,
                                            matched_amount_cents: targetBooking.net_payout_cents,
                                            note: `Reconciled to Booking #${targetBooking.reservation_id}`
                                          });
                                        }
                                      }}
                                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                        row.reconciliation_mode === 'MATCHED_OTA'
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : 'bg-white text-blue-800 hover:bg-blue-100 border border-blue-200'
                                      }`}
                                    >
                                      {row.reconciliation_mode === 'MATCHED_OTA' ? '✓ Linked with Booking' : 'Link with Booking'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRowChange(row.id, { 
                                      reconciliation_mode: row.reconciliation_mode === 'DUPLICATE_EXCLUDE' ? 'DIRECT_INCOME' : 'DUPLICATE_EXCLUDE' 
                                    })}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                      row.reconciliation_mode === 'DUPLICATE_EXCLUDE'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                  >
                                    {row.reconciliation_mode === 'DUPLICATE_EXCLUDE' ? '✓ Flagged Duplicate' : 'Flag as Duplicate'}
                                  </button>
                                </div>

                                {/* Booking Selection Dropdown when in MATCHED_OTA mode */}
                                {row.reconciliation_mode === 'MATCHED_OTA' && data.otaBookings.length > 0 && (
                                  <div className="pt-1 text-[11px] flex items-center gap-1.5">
                                    <span className="text-slate-500 font-semibold shrink-0">Linked To:</span>
                                    <select
                                      value={row.reconciled_ota_id || ''}
                                      onChange={(e) => {
                                        const chosen = data.otaBookings.find(b => b.id === e.target.value);
                                        if (chosen) {
                                          handleRowChange(row.id, {
                                            reconciled_ota_id: chosen.id,
                                            matched_booking_ref: chosen.reservation_id,
                                            matched_guest_name: chosen.guest_name,
                                            matched_amount_cents: chosen.net_payout_cents,
                                            note: `Reconciled to Booking #${chosen.reservation_id}`
                                          });
                                        }
                                      }}
                                      className="w-full text-[11px] font-medium rounded border border-blue-300 py-0.5 px-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                    >
                                      {data.otaBookings.map(b => (
                                        <option key={b.id} value={b.id}>
                                          #{b.reservation_id} • {b.guest_name || 'Guest'} (${(b.net_payout || 0).toFixed(2)}) • {b.payout_date || b.check_in_date}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Split percentage with nullish safe 0% support */}
                            {isShared && (
                              <div className="flex items-center gap-2 bg-blue-50/70 p-1.5 rounded-lg border border-blue-200 text-xs text-blue-900">
                                <span className="font-semibold text-[11px]">Owner %:</span>
                                <input 
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  className="w-14 py-0.5 text-xs text-center font-bold bg-white rounded border border-blue-300 focus:ring-1 focus:ring-blue-500"
                                  value={splitVal}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    handleRowChange(row.id, { 
                                      split_percent: isNaN(val) ? 0 : Math.min(100, Math.max(0, val)) 
                                    });
                                  }}
                                />
                                <span className="text-[11px] font-bold text-blue-700">
                                  = {formatCents(chargedCents)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            placeholder="Add memo or note..."
                            value={row.note || ''}
                            onChange={(e) => handleRowChange(row.id, { note: e.target.value })}
                            className="w-full text-xs text-slate-700 border-0 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-0 p-1 bg-transparent placeholder:text-slate-300"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
           </table>
        </div>

        {/* Footer info & pagination count */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredRows.length}</strong> of <strong>{reviewRows.length}</strong> expenses
          </span>
          <span className="font-mono text-[11px]">
            STR Invoicer Multi-Quarter Engine
          </span>
        </div>

      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mapping
        </button>

        <button
          onClick={handleNext}
          className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer"
        >
          Generate Quarterly Statements & Ledger
          <ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};
