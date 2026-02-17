import React, { useState, useMemo } from 'react';
import { CanonicalGlRow, ConfigState, ExpenseCategory, ProcessedDataState } from '../types';
import { CATEGORY_LABELS } from '../constants';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Save,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: ProcessedDataState;
  config: ConfigState;
  onBack: () => void;
  onNext: (data: ProcessedDataState) => void;
  onSaveDraft: () => void;
}

// Colors for badges and charts
const CAT_CONFIG: Record<
  ExpenseCategory,
  { bg: string; text: string; border: string; color: string }
> = {
  [ExpenseCategory.REIMBURSABLE]: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    color: '#10B981',
  },
  [ExpenseCategory.SHARED]: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    color: '#3B82F6',
  },
  [ExpenseCategory.MANAGER_ONLY]: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    color: '#8B5CF6',
  },
  [ExpenseCategory.OWNER_ONLY]: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    color: '#64748B',
  },
  [ExpenseCategory.EXCLUDE]: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    color: '#EF4444',
  },
  [ExpenseCategory.REVIEW_ALWAYS]: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    color: '#F59E0B',
  },
};

export const StepReview: React.FC<Props> = ({ data, config, onBack, onNext, onSaveDraft }) => {
  const [reviewRows, setReviewRows] = useState<CanonicalGlRow[]>(data.reviewRows);
  const [filter, setFilter] = useState<'ALL' | 'UNASSIGNED'>('ALL');

  const handleRowChange = (id: string, updates: Partial<CanonicalGlRow>) => {
    setReviewRows((prev) =>
      prev.map((row) => {
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
      })
    );
  };

  const handleNext = () => {
    onNext({ ...data, reviewRows });
  };

  const expenseStats = useMemo(() => {
    const allExpenses = [...data.autoReimbursables, ...reviewRows];
    const buckets: Record<string, number> = {
      [ExpenseCategory.REIMBURSABLE]: 0,
      [ExpenseCategory.SHARED]: 0,
      [ExpenseCategory.MANAGER_ONLY]: 0,
      [ExpenseCategory.OWNER_ONLY]: 0,
      Unassigned: 0,
    };

    allExpenses.forEach((r) => {
      const cat = r.assigned_category;
      // Skip excluded items from stats
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
        value,
        color: CAT_CONFIG[name as ExpenseCategory]?.color || '#F59E0B',
      }));
  }, [data.autoReimbursables, reviewRows]);

  const filteredRows =
    filter === 'ALL'
      ? reviewRows
      : reviewRows.filter(
          (r) => !r.assigned_category || r.assigned_category === ExpenseCategory.REVIEW_ALWAYS
        );

  const unassignedCount = reviewRows.filter(
    (r) => !r.assigned_category || r.assigned_category === ExpenseCategory.REVIEW_ALWAYS
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-medium uppercase tracking-wider">
            <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600">
              <TrendingUp size={16} />
            </div>
            OTA Bookings
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">{data.otaBookings.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total bookings found</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-medium uppercase tracking-wider">
            <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600">
              <DollarSign size={16} />
            </div>
            Net Payout
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">
            $
            {data.stats.totalOtaNet.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Revenue from OTA</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-medium uppercase tracking-wider">
            <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
              <CheckCircle2 size={16} />
            </div>
            Reconciled
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-auto">
            {data.stats.reconciledCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">GL credits matched</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2 text-xs font-medium uppercase tracking-wider">
            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600">
              <AlertCircle size={16} />
            </div>
            Pending Review
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-auto">{unassignedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Items needing action</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Review Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Review Expenses</h2>
              <p className="text-xs text-slate-500">Categorize transactions for the invoice</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-300 p-1">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === 'ALL' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                All ({reviewRows.length})
              </button>
              <button
                onClick={() => setFilter('UNASSIGNED')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === 'UNASSIGNED' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Pending ({unassignedCount})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar relative">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Date & Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
                        <CheckCircle2 className="w-full h-full" />
                      </div>
                      <p className="text-slate-500 text-sm">No items found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const catConfig =
                      row.assigned_category &&
                      row.assigned_category !== ExpenseCategory.REVIEW_ALWAYS
                        ? CAT_CONFIG[row.assigned_category]
                        : null;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-slate-900">{row.date}</div>
                          <div className="text-sm font-medium text-slate-800 mt-0.5">
                            {row.account_name}
                          </div>
                          <div
                            className="text-xs text-slate-500 truncate max-w-[200px]"
                            title={row.description}
                          >
                            {row.description}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{row.contact}</div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">
                            ${row.debit_amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            className={`block w-full rounded-lg border-0 py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-all cursor-pointer ${
                              catConfig
                                ? `text-slate-900 ring-slate-200 ${catConfig.bg}`
                                : 'text-slate-500 ring-slate-200 bg-white hover:ring-slate-300'
                            }`}
                            value={row.assigned_category || ''}
                            onChange={(e) =>
                              handleRowChange(row.id, {
                                assigned_category: e.target.value as ExpenseCategory,
                              })
                            }
                          >
                            <option value="">Select Category...</option>
                            {Object.values(ExpenseCategory)
                              .filter((c) => c !== ExpenseCategory.REVIEW_ALWAYS)
                              .map((cat) => (
                                <option key={cat} value={cat}>
                                  {CATEGORY_LABELS[cat]}
                                </option>
                              ))}
                          </select>
                          {row.assigned_category === ExpenseCategory.SHARED && (
                            <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Owner %
                              </span>
                              <input
                                type="number"
                                className="block w-16 rounded border-0 py-0.5 text-xs text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                                value={row.split_percent ?? 50}
                                onChange={(e) =>
                                  handleRowChange(row.id, {
                                    split_percent: parseFloat(e.target.value),
                                  })
                                }
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <input
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

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Expense Distribution</h3>
            {/* Explicit sizing to prevent width(-1) error */}
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <PieChart>
                  <Pie
                    data={expenseStats}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {expenseStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number | undefined) =>
                      val !== undefined ? `$${val.toFixed(2)}` : '$0.00'
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-500">Reimbursable Total</span>
                <span className="font-semibold text-emerald-600">
                  $
                  {expenseStats
                    .find((s) => s.name === CATEGORY_LABELS[ExpenseCategory.REIMBURSABLE])
                    ?.value.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Expenses</span>
                <span className="font-semibold text-slate-900">
                  ${expenseStats.reduce((acc, cur) => acc + cur.value, 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-200">
        <button
          onClick={onBack}
          className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>

        <div className="flex space-x-3">
          <button
            onClick={onSaveDraft}
            className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft (.json)
          </button>
          <button
            onClick={handleNext}
            className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
          >
            Finalize Invoice
            <ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
