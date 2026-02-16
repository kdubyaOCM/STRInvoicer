import React, { useState } from 'react';
import { FilesState, MappingState } from '../types';
import { REQUIRED_OTA_FIELDS, REQUIRED_GL_FIELDS, ALL_OTA_FIELDS } from '../constants';
import { ArrowLeft, ArrowRight, Table, CheckCircle2, AlertTriangle } from 'lucide-react';

interface FieldRowProps {
  field: { key: string; label: string };
  value: string;
  options: string[];
  onChange: (val: string) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, value, options, onChange }) => {
  const isMapped = !!value;
  return (
    <div className="group relative bg-white rounded-lg border border-slate-200 p-3 hover:border-indigo-300 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          {field.label}
        </label>
        {isMapped ? (
          <CheckCircle2 size={14} className="text-green-500" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-amber-400" />
        )}
      </div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-sm ring-1 ring-inset focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors ${
          isMapped
            ? 'text-slate-900 ring-slate-300 bg-slate-50'
            : 'text-slate-500 ring-amber-200 bg-amber-50'
        }`}
      >
        <option value="">Select header...</option>
        {options.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
};

interface Props {
  files: FilesState;
  initialMappings: MappingState;
  onBack: () => void;
  onNext: (mappings: MappingState) => void;
}

export const StepMap: React.FC<Props> = ({ files, initialMappings, onBack, onNext }) => {
  const [mappings, setMappings] = useState<MappingState>(initialMappings);

  const otaHeaders = files.otaRaw.length ? Object.keys(files.otaRaw[0]) : [];
  const glHeaders = files.glRaw.length ? Object.keys(files.glRaw[0]) : [];

  const handleOtaChange = (key: string, value: string) => {
    setMappings((prev) => ({ ...prev, ota: { ...prev.ota, [key]: value } }));
  };

  const handleGlChange = (key: string, value: string) => {
    setMappings((prev) => ({ ...prev, gl: { ...prev.gl, [key]: value } }));
  };

  const isComplete = () => {
    const missingOta = REQUIRED_OTA_FIELDS.some((f) => !mappings.ota[f.key]);
    const missingGl = REQUIRED_GL_FIELDS.some((f) => !mappings.gl[f.key]);
    return !missingOta && !missingGl;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <div className="p-1.5 bg-blue-100 rounded-full text-blue-600 shrink-0">
          <AlertTriangle size={16} />
        </div>
        <div className="text-sm text-blue-800">
          <p className="font-medium">Map your file columns to our internal fields.</p>
          <p className="opacity-80 mt-1">
            We've tried to auto-detect matches. Please verify all fields marked with colored
            indicators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* OTA Mapping */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Table size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                OTA File Mapping
              </h2>
              <p className="text-xs text-slate-500">Booking / Reservation Export</p>
            </div>
            <div className="ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
              {optionsCount(mappings.ota)} / {ALL_OTA_FIELDS.length}
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/30 flex-1">
            {ALL_OTA_FIELDS.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={mappings.ota[field.key] || ''}
                options={otaHeaders}
                onChange={(val) => handleOtaChange(field.key, val)}
              />
            ))}
          </div>
        </section>

        {/* GL Mapping */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Table size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                GL File Mapping
              </h2>
              <p className="text-xs text-slate-500">Accounting / Bank Export</p>
            </div>
            <div className="ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
              {optionsCount(mappings.gl)} / {REQUIRED_GL_FIELDS.length}
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/30 flex-1">
            {REQUIRED_GL_FIELDS.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={mappings.gl[field.key] || ''}
                options={glHeaders}
                onChange={(val) => handleGlChange(field.key, val)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          className="inline-flex items-center px-5 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-4">
          {!isComplete() && (
            <span className="text-sm text-amber-600 font-medium">Please map all fields</span>
          )}
          <button
            onClick={() => onNext(mappings)}
            disabled={!isComplete()}
            className="group inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
          >
            Generate Review Data
            <ArrowRight className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

function optionsCount(obj: Record<string, string>) {
  return Object.values(obj).filter(Boolean).length;
}
