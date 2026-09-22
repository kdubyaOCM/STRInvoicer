import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CanonicalGlRow, 
  ConfigState, 
  ExpenseCategory, 
  ProcessedDataState 
} from '../types';
import { CATEGORY_LABELS } from '../constants';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  Save,
  Search,
  X,
  CheckSquare,
  Check,
  Layers,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  Receipt
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

// Colors for badges and charts
const CAT_CONFIG: Record<ExpenseCategory, { bg: string, text: string, border: string, color: string }> = {
  [ExpenseCategory.REIMBURSABLE]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: '#10B981' },
  [ExpenseCategory.SHARED]: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', color: '#3B82F6' },
  [ExpenseCategory.MANAGER_ONLY]: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', color: '#8B5CF6' },
  [ExpenseCategory.OWNER_ONLY]: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', color: '#64748B' },
  [ExpenseCategory.EXCLUDE]: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', color: '#EF4444' },
  [ExpenseCategory.REVIEW_ALWAYS]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', color: '#F59E0B' }
};

export const StepReview: React.FC<Props> = ({ data, config, onBack, onNext, onSaveDraft }) => {
  const [reviewRows, setReviewRows] = useState<CanonicalGlRow[]>(data.reviewRows);
  
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

  // Single row update
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
            updated.split_percent = updated.split_percent ?? 50;
            break;
          case ExpenseCategory.MANAGER_ONLY:
          case ExpenseCategory.OWNER_ONLY:
          case ExpenseCategory.EXCLUDE:
            updated.include_flag = false;
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
          updated.split_percent = splitPercent !== undefined ? splitPercent : (updated.split_percent ?? 50);
          break;
        case ExpenseCategory.MANAGER_ONLY:
        case ExpenseCategory.OWNER_ONLY:
        case ExpenseCategory.EXCLUDE:
          updated.include_flag = false;
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
    onNext({ ...data, reviewRows });
  };

  // Filter and search calculations
  const filteredRows = useMemo(() => {
    return reviewRows.filter(row => {
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
  }, [reviewRows, filterUnclassifiedOnly, searchTerm]);

  // Overall counts
  const unassignedCount = useMemo(() => {
    return reviewRows.filter(r => !r.assigned_category || r.assigned_category === ExpenseCategory.REVIEW_ALWAYS).length;
  }, [reviewRows]);

  const classifiedCount = useMemo(() => {
    return reviewRows.length - unassignedCount;
  }, [reviewRows.length, unassignedCount]);

  // Selected stats
  const selectedAmount = useMemo(() => {
    let sum = 0;
    reviewRows.forEach(r => {
      if (selectedIds.has(r.id)) {
        sum += r.debit_amount;
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

  // Toggle single row with Shift+Click support for rapid range selection
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
      // Deselect all currently filtered
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredRows.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      // Select all currently filtered
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

  // 1. RECHARTS: Expense Distribution Pie Chart Data
  const expenseStats = useMemo(() => {
    const allExpenses = [...data.autoReimbursables, ...reviewRows];
    const buckets: Record<string, number> = {
      [ExpenseCategory.REIMBURSABLE]: 0,
      [ExpenseCategory.SHARED]: 0,
      [ExpenseCategory.MANAGER_ONLY]: 0,
      [ExpenseCategory.OWNER_ONLY]: 0,
      'Unassigned': 0
    };

    allExpenses.forEach(r => {
      const cat = r.assigned_category;
      if (cat === ExpenseCategory.EXCLUDE) return;

      if (cat && buckets[cat] !== undefined) {
        buckets[cat] += r.debit_amount;
      } else if (!cat || cat === ExpenseCategory.REVIEW_ALWAYS) {
        buckets['Unassigned'] += r.debit_amount;
      }
    });

    return Object.entries(buckets)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({ 
        name: CATEGORY_LABELS[name as ExpenseCategory] || name, 
        value: Math.round(value * 100) / 100,
        color: CAT_CONFIG[name as ExpenseCategory]?.color || '#F59E0B'
      }));
  }, [data.autoReimbursables, reviewRows]);

  const totalExpenseAmount = useMemo(() => {
    return expenseStats.reduce((sum, item) => sum + item.value, 0);
  }, [expenseStats]);

  const reimbursableAmount = useMemo(() => {
    return expenseStats.find(s => s.name === CATEGORY_LABELS[ExpenseCategory.REIMBURSABLE])?.value || 0;
  }, [expenseStats]);

  // 2. RECHARTS: Revenue Over Time Bar Chart Data
  const revenueOverTime = useMemo(() => {
    const map: Record<string, { rawDate: string, gross: number, net: number, count: number }> = {};
    
    // Process OTA Bookings
    data.otaBookings.forEach(booking => {
      const rawDate = booking.check_in_date || booking.payout_date;
      if (!rawDate) return;
      const key = rawDate.slice(0, 10);
      if (!map[key]) {
        map[key] = { rawDate: key, gross: 0, net: 0, count: 0 };
      }
      map[key].gross += booking.gross_amount || 0;
      map[key].net += booking.net_payout || 0;
      map[key].count += 1;
    });

    // Fallback: If no OTA dates exist, check GL Income credits
    if (Object.keys(map).length === 0 && data.glIncome.length > 0) {
      data.glIncome.forEach(inc => {
        if (!inc.date) return;
        const key = inc.date.slice(0, 10);
        if (!map[key]) {
          map[key] = { rawDate: key, gross: 0, net: 0, count: 0 };
        }
        map[key].gross += inc.credit_amount || 0;
        map[key].net += inc.credit_amount || 0;
        map[key].count += 1;
      });
    }

    const sorted = Object.values(map).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    return sorted.map(item => {
      let displayDate = item.rawDate;
      try {
        const parts = item.rawDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (!isNaN(d.getTime())) {
            displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
        }
      } catch {
        // keep fallback
      }
      return {
        ...item,
        label: displayDate,
        gross: Math.round(item.gross * 100) / 100,
        net: Math.round(item.net * 100) / 100
      };
    });
  }, [data.otaBookings, data.glIncome]);

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
             Net Payout
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">
            ${data.stats.totalOtaNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
          <div className="text-xs text-slate-400 mt-1">Disbursed revenue from OTA</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
           <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
             <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><CheckCircle2 size={16}/></div>
             Reconciled Credits
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">{data.stats.reconciledCount}</div>
          <div className="text-xs text-slate-400 mt-1">GL payouts successfully matched</div>
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
                Expense classification distribution and revenue over time across the statement period
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
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
                      No expense data available
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

            {/* Chart 2: Revenue Over Time (Bar Chart) - 7 Cols */}
            <div className="lg:col-span-7 bg-slate-50/60 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <BarChart3 size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Revenue Over Time</h4>
                      <p className="text-[11px] text-slate-500">Gross revenue vs net payout per booking date</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                      <span className="text-slate-600 font-medium">Gross: <strong>${data.stats.totalOtaRevenue.toFixed(0)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-slate-600 font-medium">Net: <strong>${data.stats.totalOtaNet.toFixed(0)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart Display */}
                <div className="w-full h-[250px]">
                  {revenueOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                      <BarChart 
                        data={revenueOverTime} 
                        margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false}
                          interval="preserveStartEnd"
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
                            name === 'gross' ? 'Gross Revenue' : 'Net Payout'
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
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
                          name="Gross Revenue" 
                          fill="#6366f1" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={32}
                        />
                        <Bar 
                          dataKey="net" 
                          name="Net Payout" 
                          fill="#10b981" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                      <Calendar size={24} className="mb-2 text-slate-300" />
                      <span>No dated revenue entries recorded in the uploaded OTA file</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Quick Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 mt-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Net Payout</span>
                  <span className="text-sm font-bold text-emerald-600">${data.stats.totalOtaNet.toFixed(2)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Avg Payout/Booking</span>
                  <span className="text-sm font-bold text-slate-800">
                    ${data.otaBookings.length > 0 ? (data.stats.totalOtaNet / data.otaBookings.length).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">OTA Fees & Comm.</span>
                  <span className="text-sm font-bold text-indigo-600">
                    ${Math.max(0, data.stats.totalOtaRevenue - data.stats.totalOtaNet).toFixed(2)}
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
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md transition-colors"
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
              <h2 className="text-base font-bold text-slate-900">Review Expenses</h2>
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

          {/* Filter Controls: Search & Dedicated Toggle Switch */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            
            {/* Search input */}
            <div className="relative flex-1 sm:w-56">
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
              {/* Physical switch mechanism */}
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

        {/* Bulk Selection Action Bar (appears when 1 or more items are selected) */}
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
                  ${selectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    onChange={(e) => setBulkSplitPercent(parseFloat(e.target.value) || 0)}
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

              {/* Quick 1-click action buttons */}
              <div className="flex items-center gap-1 border-l border-indigo-200 pl-2">
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
          /* Sub-header helper when nothing is selected */
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</th>
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
                           {(searchTerm || filterUnclassifiedOnly) && (
                             <button 
                               onClick={() => { setSearchTerm(''); setFilterUnclassifiedOnly(false); }}
                               className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                             >
                               Clear search and turn off filter
                             </button>
                           )}
                         </div>
                       )}
                     </td>
                   </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isSelected = selectedIds.has(row.id);
                    const catConfig = row.assigned_category && row.assigned_category !== ExpenseCategory.REVIEW_ALWAYS 
                      ? CAT_CONFIG[row.assigned_category] 
                      : null;
                      
                    return (
                      <tr 
                        key={row.id} 
                        id={`expense-row-${row.id}`}
                        className={`transition-colors group ${
                          isSelected 
                            ? 'bg-indigo-50/70 hover:bg-indigo-100/70 border-l-2 border-indigo-600' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox cell */}
                        <td className="w-12 px-3 py-4 text-center">
                          <input 
                            id={`checkbox-row-${row.id}`}
                            type="checkbox"
                            aria-label={`Select expense ${row.description || row.account_name}`}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={isSelected}
                            onClick={(e) => handleToggleRow(row.id, e)}
                            onChange={() => {}} // Controlled via onClick with Shift support
                          />
                        </td>

                        {/* Date & Description cell */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{row.date}</span>
                            {!row.assigned_category || row.assigned_category === ExpenseCategory.REVIEW_ALWAYS ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                                Pending
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm font-semibold text-slate-800 mt-0.5">{row.account_name}</div>
                          <div className="text-xs text-slate-600 truncate max-w-[280px]" title={row.description}>{row.description}</div>
                          {row.contact && <div className="text-xs text-slate-400 mt-0.5">{row.contact}</div>}
                        </td>

                        {/* Amount cell */}
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">${row.debit_amount.toFixed(2)}</div>
                        </td>

                        {/* Classification cell */}
                        <td className="px-4 py-4 whitespace-nowrap">
                           <select
                              id={`select-category-${row.id}`}
                              className={`block w-full rounded-lg border-0 py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-all cursor-pointer ${
                                catConfig 
                                  ? `text-slate-900 ring-slate-200 font-medium ${catConfig.bg}` 
                                  : 'text-slate-500 ring-slate-200 bg-white hover:ring-slate-300'
                              }`}
                              value={row.assigned_category || ''}
                              onChange={(e) => handleRowChange(row.id, { assigned_category: e.target.value as ExpenseCategory })}
                            >
                              <option value="">Select Category...</option>
                              {Object.values(ExpenseCategory).filter(c => c !== ExpenseCategory.REVIEW_ALWAYS).map(cat => (
                                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                              ))}
                            </select>

                            {row.assigned_category === ExpenseCategory.SHARED && (
                              <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                 <span className="text-[10px] font-bold text-slate-500 uppercase">Owner %</span>
                                 <input 
                                    type="number" 
                                    className="block w-16 rounded border-0 py-0.5 text-xs text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                                    value={row.split_percent ?? 50}
                                    onChange={(e) => handleRowChange(row.id, { split_percent: parseFloat(e.target.value) })}
                                 />
                              </div>
                            )}
                        </td>

                        {/* Notes cell */}
                        <td className="px-4 py-4">
                          <input 
                              id={`note-input-${row.id}`}
                              type="text" 
                              placeholder="Add note..."
                              className="block w-full rounded border-0 py-1.5 text-xs text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 bg-slate-50 focus:bg-white"
                              value={row.note || ''}
                              onChange={(e) => handleRowChange(row.id, { note: e.target.value })}
                           />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
           </table>
        </div>
      </div>

      {/* Bottom Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-slate-200">
        <button
          id="review-back-btn"
          onClick={onBack}
          className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>
        
        <div className="flex space-x-3">
          <button
            id="review-save-draft-btn"
            onClick={() => onSaveDraft({ ...data, reviewRows })}
            className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft (.json)
          </button>
          <button
            id="review-finalize-btn"
            onClick={handleNext}
            className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            Finalize Invoice
            <ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
