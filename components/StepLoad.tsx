import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Settings, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle, 
  FileJson, 
  Calendar, 
  DollarSign, 
  Layers,
  User,
  Users,
  Building2,
  Plus,
  Trash2,
  Check,
  ShieldCheck
} from 'lucide-react';
import { ConfigState, FilesState, SessionState, isSessionState, PropertyOwnerRecord } from '../types';
import { readSpreadsheet, parseClassificationMap } from '../services/excelService';
import { generateAllQuarters, parseCalendarDate } from '../services/dateUtils';
import { centsToDollars, toCents } from '../services/moneyUtils';
import { 
  getManagerProfile, 
  saveManagerProfile, 
  getOwnersList, 
  getActiveOwner, 
  saveOwner, 
  createOwner, 
  deleteOwner, 
  setLastActiveOwnerId 
} from '../services/customerDatabase';

interface Props {
  initialConfig: ConfigState;
  onNext: (files: FilesState, config: ConfigState) => void;
  onResumeSession: (session: SessionState) => void;
}

export const StepLoad: React.FC<Props> = ({ initialConfig, onNext, onResumeSession }) => {
  const allQuarters = generateAllQuarters(2020, 2028);

  // Customer Database State
  const [ownersList, setOwnersList] = useState<PropertyOwnerRecord[]>(() => getOwnersList());
  const [activeOwner, setActiveOwner] = useState<PropertyOwnerRecord>(() => getActiveOwner());
  const [isAddingNewOwner, setIsAddingNewOwner] = useState<boolean>(false);
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newPropertyName, setNewPropertyName] = useState<string>('');
  const [managerSaveNotice, setManagerSaveNotice] = useState<boolean>(false);

  // Initialize Config from active customer and manager profile
  const [config, setConfig] = useState<ConfigState>(() => {
    const manager = getManagerProfile();
    const owner = getActiveOwner();
    const todayIso = parseCalendarDate(new Date()) || new Date().toISOString().slice(0, 10);

    return {
      customerId: owner.id,
      propertyName: owner.propertyName || '',
      ownerName: initialConfig.ownerName || owner.name,
      managerName: initialConfig.managerName || manager.managerName,
      managerContact: initialConfig.managerContact || manager.managerContact,
      managerBank: initialConfig.managerBank || manager.managerBank,
      periodStart: initialConfig.periodStart || (owner.startQuarterId ? '2020-07-01' : '2020-07-01'),
      periodEnd: initialConfig.periodEnd || '2025-06-30',
      mgmtFeePercent: initialConfig.mgmtFeePercent ?? (owner.mgmtFeePercent ?? manager.defaultMgmtFeePercent),
      feeBaseMode: initialConfig.feeBaseMode || (owner.feeBaseMode || manager.defaultFeeBaseMode),
      quarterMode: initialConfig.quarterMode ?? true,
      startQuarterId: initialConfig.startQuarterId || owner.startQuarterId || 'FY2020-21-Q1',
      endQuarterId: initialConfig.endQuarterId || owner.endQuarterId || 'FY2024-25-Q4',
      initialOpeningBalanceCents: initialConfig.initialOpeningBalanceCents ?? (owner.initialOpeningBalanceCents || 0),
      issueDate: initialConfig.issueDate || todayIso,
      originalIssueDate: initialConfig.originalIssueDate || '',
      revisionNumber: initialConfig.revisionNumber || 1
    };
  });

  const [initialBalanceDollars, setInitialBalanceDollars] = useState<string>(
    centsToDollars(config.initialOpeningBalanceCents || 0).toFixed(2)
  );

  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Switch Active Customer
  const handleSelectCustomer = (ownerId: string) => {
    if (ownerId === '__new__') {
      setIsAddingNewOwner(true);
      return;
    }

    const selected = ownersList.find(o => o.id === ownerId);
    if (!selected) return;

    // Set as active customer in persistent database
    setLastActiveOwnerId(selected.id);
    setActiveOwner(selected);

    // Update form configuration to match this customer
    setConfig(prev => ({
      ...prev,
      customerId: selected.id,
      ownerName: selected.name,
      propertyName: selected.propertyName || '',
      mgmtFeePercent: selected.mgmtFeePercent ?? prev.mgmtFeePercent,
      feeBaseMode: selected.feeBaseMode || prev.feeBaseMode,
      initialOpeningBalanceCents: selected.initialOpeningBalanceCents ?? 0,
      startQuarterId: selected.startQuarterId || prev.startQuarterId,
      endQuarterId: selected.endQuarterId || prev.endQuarterId
    }));

    setInitialBalanceDollars(centsToDollars(selected.initialOpeningBalanceCents || 0).toFixed(2));
  };

  // Create New Customer
  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerName.trim()) return;

    const created = createOwner(newOwnerName.trim(), newPropertyName.trim());
    const updatedList = getOwnersList();
    setOwnersList(updatedList);
    setActiveOwner(created);
    setIsAddingNewOwner(false);
    setNewOwnerName('');
    setNewPropertyName('');

    setConfig(prev => ({
      ...prev,
      customerId: created.id,
      ownerName: created.name,
      propertyName: created.propertyName || '',
      mgmtFeePercent: created.mgmtFeePercent ?? prev.mgmtFeePercent,
      feeBaseMode: created.feeBaseMode || prev.feeBaseMode,
      initialOpeningBalanceCents: 0
    }));
    setInitialBalanceDollars('0.00');
  };

  // Delete Customer
  const handleDeleteCustomer = (id: string) => {
    if (ownersList.length <= 1) return;
    const confirmDelete = window.confirm(`Are you sure you want to remove customer "${activeOwner.name}" from your database?`);
    if (!confirmDelete) return;

    const res = deleteOwner(id);
    if (res.success) {
      const refreshedList = getOwnersList();
      setOwnersList(refreshedList);
      if (res.newActiveId) {
        handleSelectCustomer(res.newActiveId);
      }
    }
  };

  // Auto-save Property Owner edits to database
  const handleOwnerFieldChange = (updates: Partial<PropertyOwnerRecord>) => {
    if (!activeOwner) return;
    const updated = saveOwner({
      id: activeOwner.id,
      ...updates
    });
    setActiveOwner(updated);
    setOwnersList(getOwnersList());
  };

  // Auto-save Property Manager Profile edits (stored once globally)
  const handleManagerFieldChange = (field: 'managerName' | 'managerContact' | 'managerBank', value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    saveManagerProfile({ [field]: value });
    setManagerSaveNotice(true);
    setTimeout(() => setManagerSaveNotice(false), 3000);
  };

  // Sync date ranges when quarters change
  const handleStartQuarterChange = (qId: string) => {
    const q = allQuarters.find(x => x.id === qId);
    const newStart = q ? q.startDate : config.periodStart;
    setConfig(prev => ({
      ...prev,
      startQuarterId: qId,
      periodStart: newStart
    }));
    handleOwnerFieldChange({ startQuarterId: qId });
  };

  const handleEndQuarterChange = (qId: string) => {
    const q = allQuarters.find(x => x.id === qId);
    const newEnd = q ? q.endDate : config.periodEnd;
    setConfig(prev => ({
      ...prev,
      endQuarterId: qId,
      periodEnd: newEnd
    }));
    handleOwnerFieldChange({ endQuarterId: qId });
  };

  const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInitialBalanceDollars(val);
    const cents = toCents(val);
    setConfig(prev => ({ ...prev, initialOpeningBalanceCents: cents }));
    handleOwnerFieldChange({ initialOpeningBalanceCents: cents });
  };

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleResumeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (isSessionState(json)) {
          onResumeSession(json);
        } else {
          setResumeError("The uploaded file does not appear to be a valid STR Invoicer session file.");
        }
      } catch (err) {
        setResumeError("Failed to read file. Please ensure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleNext = async () => {
    if (!otaFile || !glFile) {
      setError("Please upload both OTA and GL spreadsheet files.");
      return;
    }
    if (!config.periodStart || !config.periodEnd) {
      setError("Please specify the reporting period or quarter range.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const otaRaw = await readSpreadsheet(otaFile);
      const glRaw = await readSpreadsheet(glFile);
      let classificationMap = {};
      if (mapFile) {
        classificationMap = await parseClassificationMap(mapFile);
      }
      onNext({ otaRaw, glRaw, classificationMap }, config);
    } catch (err: any) {
      setError("Failed to parse files. Please ensure they are valid Excel/CSV files.");
    } finally {
      setIsLoading(false);
    }
  };

  const FileCard = ({ 
    title, 
    desc, 
    file, 
    onChange, 
    icon: Icon, 
    required = false 
  }: { 
    title: string, 
    desc: string, 
    file: File | null, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    icon: any,
    required?: boolean
  }) => (
    <label className={`relative group border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer block ${
      file 
        ? 'border-indigo-300 bg-indigo-50/50' 
        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
    }`}>
      <input type="file" onChange={onChange} className="hidden" accept=".xlsx,.xls,.csv" />
      <div className="absolute top-4 right-4">
        {file ? (
          <div className="bg-green-100 p-1 rounded-full"><CheckCircle className="w-5 h-5 text-green-600" /></div>
        ) : required ? (
          <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">Required</span>
        ) : (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Optional</span>
        )}
      </div>
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 rounded-full mb-3 ${file ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
          <Icon size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 h-5 truncate w-full">{file ? file.name : desc}</p>
        <span className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-full text-indigo-700 bg-indigo-100 group-hover:bg-indigo-200 transition-colors">
          {file ? 'Change File' : 'Select File'}
        </span>
      </div>
    </label>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Resume Session Card */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <FileJson size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Resume in-flight invoice prep</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-sm text-slate-600">
            <p className="font-medium">Have a saved session file (.json)?</p>
            <p className="text-xs text-slate-400 mt-1">Load it here to restore all mapped transactions and ledger data immediately.</p>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <label className="cursor-pointer w-full flex justify-center">
               <span className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center cursor-pointer">
                 <Upload className="mr-2 h-4 w-4 text-slate-400" />
                 Load Session JSON
               </span>
               <input type="file" onChange={handleResumeFile} className="hidden" accept=".json" />
            </label>
          </div>
        </div>
        {resumeError && (
          <div className="px-6 pb-6 pt-0">
             <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                <span>{resumeError}</span>
             </div>
          </div>
        )}
      </section>

      <div className="relative">
         <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-200"></div></div>
         <div className="relative flex justify-center"><span className="bg-slate-50 px-2 text-sm text-slate-500 uppercase tracking-wider font-medium">Or Start New</span></div>
      </div>

      {/* Upload Spreadsheets */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2"><Upload size={18} className="text-indigo-600" /><h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">1. Upload Data Sources</h2></div>
          <div className="text-xs text-slate-400">Supports .xlsx, .csv</div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileCard title="OTA Export" desc="Booking statements (Airbnb, Booking.com)" file={otaFile} onChange={handleFileChange(setOtaFile)} icon={FileText} required />
          <FileCard title="General Ledger" desc="Bank / accounting export (GL transactions)" file={glFile} onChange={handleFileChange(setGlFile)} icon={FileText} required />
          <FileCard title="Classification Map" desc="Account to Category rules" file={mapFile} onChange={handleFileChange(setMapFile)} icon={Settings} />
        </div>
      </section>

      {/* Quarterly Ledger & Configuration */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">2. Customer Database & Configuration</h2>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Persistent Customer Profiles
          </span>
        </div>
        
        <div className="p-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Reporting Settings - 5 cols */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2 mb-4 flex items-center gap-1.5">
                <Calendar size={15} className="text-indigo-600" />
                Quarterly Reporting Range (From 2020 onward)
              </h3>

              {/* Quarter Range Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Quarter</label>
                  <select
                    className="block w-full rounded-lg border-slate-300 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 shadow-sm bg-white py-2"
                    value={config.startQuarterId}
                    onChange={(e) => handleStartQuarterChange(e.target.value)}
                  >
                    {allQuarters.map(q => (
                      <option key={`start-${q.id}`} value={q.id}>
                        {q.label} ({q.dateRangeLabel})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">Start: {config.periodStart}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Quarter</label>
                  <select
                    className="block w-full rounded-lg border-slate-300 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 shadow-sm bg-white py-2"
                    value={config.endQuarterId}
                    onChange={(e) => handleEndQuarterChange(e.target.value)}
                  >
                    {allQuarters.map(q => (
                      <option key={`end-${q.id}`} value={q.id}>
                        {q.label} ({q.dateRangeLabel})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">End: {config.periodEnd}</span>
                </div>
              </div>

              {/* Opening Balance & Issue Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Opening Balance ($)</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <span className="text-slate-400 text-xs">$</span>
                    </div>
                    <input 
                      type="number"
                      step="0.01"
                      className="block w-full rounded-lg border-slate-300 pl-6 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 py-2"
                      value={initialBalanceDollars}
                      onChange={handleInitialBalanceChange}
                      placeholder="0.00"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">+ve: Manager owes Owner</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Document Issue Date</label>
                  <input 
                    type="date"
                    className="block w-full rounded-lg border-slate-300 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2"
                    value={config.issueDate || ''}
                    onChange={(e) => setConfig({ ...config, issueDate: e.target.value })}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Actual generation date</span>
                </div>
              </div>

              {/* Management Fee & Base */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                   <label className="block text-xs font-semibold text-slate-700 mb-1">Mgmt Fee %</label>
                   <div className="relative rounded-md shadow-sm">
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        step="0.1"
                        className="block w-full rounded-lg border-slate-300 pr-8 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 py-2" 
                        value={config.mgmtFeePercent} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setConfig({...config, mgmtFeePercent: val});
                          handleOwnerFieldChange({ mgmtFeePercent: val });
                        }} 
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"><span className="text-slate-400 sm:text-xs">%</span></div>
                   </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Base</label>
                  <select 
                    className="block w-full rounded-lg border-slate-300 text-xs font-medium focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                    value={config.feeBaseMode} 
                    onChange={e => {
                      const val = e.target.value as any;
                      setConfig({...config, feeBaseMode: val});
                      handleOwnerFieldChange({ feeBaseMode: val });
                    }}
                  >
                    <option value="gross_revenue">Gross Revenue (Recommended)</option>
                    <option value="net_payouts">Net Payouts</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Entity Details & Customer Database - 7 cols */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* SECTION A: PROPERTY OWNER (CUSTOMER DIRECTORY) */}
              <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Property Owner / Customer Account</h3>
                      <p className="text-[11px] text-slate-500">Defaults to the last loaded customer; manually switch to work on others</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingNewOwner(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer self-start sm:self-center"
                  >
                    <Plus size={13} />
                    New Customer
                  </button>
                </div>

                {/* Customer Selector Dropdown */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Active Customer
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      className="block w-full rounded-xl border-slate-300 text-xs font-bold text-slate-900 bg-white shadow-sm py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                      value={activeOwner.id}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                    >
                      {ownersList.map(owner => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name} {owner.propertyName ? `• ${owner.propertyName}` : ''} {owner.id === activeOwner.id ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>

                    {ownersList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(activeOwner.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                        title="Delete this customer record"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>★ Default: The app automatically remembers and opens this customer next time.</span>
                    <span className="text-indigo-600 font-semibold">{ownersList.length} total customer(s)</span>
                  </div>
                </div>

                {/* Inline New Customer Creation Form */}
                {isAddingNewOwner && (
                  <form onSubmit={handleCreateCustomerSubmit} className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">Add New Property Owner / Customer</span>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingNewOwner(false)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input 
                        type="text"
                        placeholder="Owner Name (e.g. Sarah Connor)"
                        className="w-full text-xs rounded-lg border-indigo-200 bg-white px-2.5 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                        autoFocus
                      />
                      <input 
                        type="text"
                        placeholder="Property / Unit (e.g. Palm Villa #2)"
                        className="w-full text-xs rounded-lg border-indigo-200 bg-white px-2.5 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                        value={newPropertyName}
                        onChange={(e) => setNewPropertyName(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newOwnerName.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Plus size={12} />
                      Save & Switch to this Customer
                    </button>
                  </form>
                )}

                {/* Active Owner Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Property Owner Name</label>
                    <input 
                      type="text" 
                      className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                      value={config.ownerName} 
                      onChange={e => {
                        const val = e.target.value;
                        setConfig({...config, ownerName: val});
                        handleOwnerFieldChange({ name: val });
                      }} 
                      placeholder="e.g. John & Jane Smith" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Property / Unit Reference</label>
                    <input 
                      type="text" 
                      className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                      value={config.propertyName || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setConfig({...config, propertyName: val});
                        handleOwnerFieldChange({ propertyName: val });
                      }} 
                      placeholder="e.g. Seaside Retreat Unit 4" 
                    />
                  </div>
                </div>
              </div>

              {/* SECTION B: PROPERTY MANAGER (SAVED ONCE, GLOBAL) */}
              <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Property Manager / Agency Profile</h3>
                      <p className="text-[11px] text-slate-500">Recorded once — automatically shared and applied across all customer statements</p>
                    </div>
                  </div>

                  {managerSaveNotice && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in flex items-center gap-1">
                      <ShieldCheck size={12} />
                      Profile Saved
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Property Manager / Agency Name</label>
                    <input 
                      type="text" 
                      className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                      value={config.managerName} 
                      onChange={e => handleManagerFieldChange('managerName', e.target.value)} 
                      placeholder="e.g. Coastal Holiday Stays Pty Ltd" 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                       <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Contact</label>
                       <input 
                         type="text" 
                         className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                         value={config.managerContact} 
                         onChange={e => handleManagerFieldChange('managerContact', e.target.value)} 
                         placeholder="manager@domain.com.au" 
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-slate-700 mb-1">Bank / BSB / Account Details</label>
                       <input 
                         type="text" 
                         className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2" 
                         value={config.managerBank} 
                         onChange={e => handleManagerFieldChange('managerBank', e.target.value)} 
                         placeholder="BSB: 123-456 Acc: 98765432" 
                       />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Historical Issue Date (if regenerating)</label>
                    <input 
                      type="date"
                      className="block w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2"
                      value={config.originalIssueDate || ''}
                      onChange={e => setConfig({...config, originalIssueDate: e.target.value})}
                      placeholder="Leave empty for original generation"
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start shadow-sm">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="ml-3"><h3 className="text-sm font-semibold text-red-800">Configuration Error</h3><div className="mt-1 text-sm text-red-600">{error}</div></div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={handleNext}
          disabled={isLoading}
          className="group relative inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Processing Files...
            </>
          ) : (
            <>Proceed to Mapping<ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
          )}
        </button>
      </div>
    </div>
  );
};
