import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Settings,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  FileJson,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ConfigState, FilesState, SessionState, isSessionState } from '../types';
import { readSpreadsheet, parseClassificationMap } from '../services/excelService';

interface Props {
  initialConfig: ConfigState;
  onNext: (files: FilesState, config: ConfigState) => void;
  onResumeSession: (session: SessionState) => void;
}

export const StepLoad: React.FC<Props> = ({ initialConfig, onNext, onResumeSession }) => {
  const [config, setConfig] = useState<ConfigState>(initialConfig);
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const handleFileChange =
    (setter: React.Dispatch<React.SetStateAction<File | null>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setResumeError(
            'The uploaded file does not appear to be a valid STR Invoicer session file.'
          );
        }
      } catch (err) {
        setResumeError('Failed to read file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleNext = async () => {
    if (!otaFile || !glFile) {
      setError('Please upload both OTA and GL files.');
      return;
    }

    // Validate file types
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const otaExt = otaFile.name.substring(otaFile.name.lastIndexOf('.')).toLowerCase();
    const glExt = glFile.name.substring(glFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(otaExt) || !validExtensions.includes(glExt)) {
      setError('Invalid file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files only.');
      return;
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (otaFile.size > maxSize || glFile.size > maxSize) {
      setError('File size too large. Please ensure files are under 10MB.');
      return;
    }

    if (!config.periodStart || !config.periodEnd) {
      setError('Please specify the reporting period.');
      return;
    }

    // Validate date range
    const startDate = new Date(config.periodStart);
    const endDate = new Date(config.periodEnd);
    if (startDate > endDate) {
      setError('Period start date must be before end date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const otaRaw = await readSpreadsheet(otaFile);
      const glRaw = await readSpreadsheet(glFile);

      // Validate that files have data
      if (otaRaw.length === 0) {
        setError('OTA file appears to be empty. Please check your file.');
        setIsLoading(false);
        return;
      }
      if (glRaw.length === 0) {
        setError('GL file appears to be empty. Please check your file.');
        setIsLoading(false);
        return;
      }

      let classificationMap = {};
      if (mapFile) {
        const mapExt = mapFile.name.substring(mapFile.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(mapExt)) {
          setError('Invalid classification map file type. Please upload Excel or CSV only.');
          setIsLoading(false);
          return;
        }
        if (mapFile.size > maxSize) {
          setError('Classification map file size too large. Please ensure file is under 10MB.');
          setIsLoading(false);
          return;
        }
        classificationMap = await parseClassificationMap(mapFile);
      }
      onNext({ otaRaw, glRaw, classificationMap }, config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('File parsing error:', errorMessage);
      setError(
        'Failed to parse files. Please ensure they are valid Excel/CSV files and contain properly formatted data.'
      );
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
    required = false,
  }: {
    title: string;
    desc: string;
    file: File | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: LucideIcon;
    required?: boolean;
  }) => (
    <label
      className={`relative group border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer block ${
        file
          ? 'border-indigo-300 bg-indigo-50/50'
          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
      }`}
    >
      <input type="file" onChange={onChange} className="hidden" accept=".xlsx,.xls,.csv" />
      <div className="absolute top-4 right-4">
        {file ? (
          <div className="bg-green-100 p-1 rounded-full">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        ) : required ? (
          <span className="text-xs font-medium text-red-400 bg-red-50 px-2 py-1 rounded-full">
            Required
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            Optional
          </span>
        )}
      </div>
      <div className="flex flex-col items-center text-center">
        <div
          className={`p-3 rounded-full mb-3 ${file ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}
        >
          <Icon size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 h-5 truncate w-full">
          {file ? file.name : desc}
        </p>
        <span className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-full text-indigo-700 bg-indigo-100 group-hover:bg-indigo-200 transition-colors">
          {file ? 'Change File' : 'Select File'}
        </span>
      </div>
    </label>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <FileJson size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Resume in-flight invoice prep
          </h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-sm text-slate-600">
            <p className="font-medium">Have a saved session file (.json)?</p>
            <p className="text-xs text-slate-400 mt-1">
              Load it here to restore your configuration immediately.
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <label className="cursor-pointer w-full flex justify-center">
              <span className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center">
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
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-2 text-sm text-slate-500 uppercase tracking-wider font-medium">
            Or Start New
          </span>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              1. Upload Data Sources
            </h2>
          </div>
          <div className="text-xs text-slate-400">Supports .xlsx, .csv</div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileCard
            title="OTA Export"
            desc="Booking statements"
            file={otaFile}
            onChange={handleFileChange(setOtaFile)}
            icon={FileText}
            required
          />
          <FileCard
            title="General Ledger"
            desc="Accounting export"
            file={glFile}
            onChange={handleFileChange(setGlFile)}
            icon={FileText}
            required
          />
          <FileCard
            title="Classification Map"
            desc="Mapping rules"
            file={mapFile}
            onChange={handleFileChange(setMapFile)}
            icon={Settings}
          />
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Settings size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            2. Configuration
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2 mb-4">
                Reporting Settings
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reporting Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 mb-1 block">Start Date</span>
                    <input
                      type="date"
                      className="block w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-shadow shadow-sm"
                      value={config.periodStart}
                      onChange={(e) => setConfig({ ...config, periodStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 mb-1 block">End Date</span>
                    <input
                      type="date"
                      className="block w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-shadow shadow-sm"
                      value={config.periodEnd}
                      onChange={(e) => setConfig({ ...config, periodEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Mgmt Fee %
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="block w-full rounded-lg border-slate-200 pr-8 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={config.mgmtFeePercent}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 100) {
                          setConfig({ ...config, mgmtFeePercent: value });
                        }
                      }}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className="text-slate-400 sm:text-sm">%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Fee Base
                  </label>
                  <select
                    className="block w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                    value={config.feeBaseMode}
                    onChange={(e) => setConfig({ ...config, feeBaseMode: e.target.value as any })}
                  >
                    <option value="gross_revenue">Gross Revenue</option>
                    <option value="net_payouts">Net Payouts</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2 mb-4">
                Entity Details
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Property Owner Name
                </label>
                <input
                  type="text"
                  className="block w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                  value={config.ownerName}
                  onChange={(e) => setConfig({ ...config, ownerName: e.target.value })}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Property Manager Name
                </label>
                <input
                  type="text"
                  className="block w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                  value={config.managerName}
                  onChange={(e) => setConfig({ ...config, managerName: e.target.value })}
                  placeholder="e.g. Coastal Stays LLC"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Manager Contact
                  </label>
                  <input
                    type="text"
                    className="block w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                    value={config.managerContact}
                    onChange={(e) => setConfig({ ...config, managerContact: e.target.value })}
                    placeholder="Email or Phone"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Bank Details
                  </label>
                  <input
                    type="text"
                    className="block w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                    value={config.managerBank}
                    onChange={(e) => setConfig({ ...config, managerBank: e.target.value })}
                    placeholder="Bank Account info"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start shadow-sm">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-red-800">Configuration Error</h3>
            <div className="mt-1 text-sm text-red-600">{error}</div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={handleNext}
          disabled={isLoading}
          className="group relative inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Processing Files...
            </>
          ) : (
            <>
              Proceed to Mapping
              <ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
