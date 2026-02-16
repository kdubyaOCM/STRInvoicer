import React, { useState, useEffect } from 'react';
import { StepLoad } from './components/StepLoad';
import { StepMap } from './components/StepMap';
import { StepReview } from './components/StepReview';
import { StepInvoice } from './components/StepInvoice';
import {
  ProcessStep,
  FilesState,
  ConfigState,
  ProcessedDataState,
  MappingState,
  SessionState,
  isSessionState,
} from './types';
import { processData, generateInitialMappings } from './services/processor';
import { Check, ChevronRight } from 'lucide-react';

const STEPS = [
  { id: ProcessStep.LOAD, label: 'Load Data' },
  { id: ProcessStep.MAP, label: 'Map Columns' },
  { id: ProcessStep.REVIEW, label: 'Review & Assign' },
  { id: ProcessStep.INVOICE, label: 'Generate Invoice' },
];

export default function App() {
  const [currentStep, setCurrentStep] = useState<ProcessStep>(ProcessStep.LOAD);

  // State for all data through the pipeline
  const [files, setFiles] = useState<FilesState>({
    otaRaw: [],
    glRaw: [],
    classificationMap: {},
  });

  const [config, setConfig] = useState<ConfigState>({
    periodStart: '',
    periodEnd: '',
    managerName: '',
    managerContact: '',
    managerBank: '',
    ownerName: '',
    mgmtFeePercent: 20,
    feeBaseMode: 'gross_revenue',
  });

  const [mappings, setMappings] = useState<MappingState>({
    ota: {},
    gl: {},
  });

  const [processedData, setProcessedData] = useState<ProcessedDataState | null>(null);

  // Auto-scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Transitions
  const handleFilesLoaded = (loadedFiles: FilesState, loadedConfig: ConfigState) => {
    setFiles(loadedFiles);
    setConfig(loadedConfig);
    const initialMappings = generateInitialMappings(loadedFiles.otaRaw, loadedFiles.glRaw);
    setMappings(initialMappings);
    setCurrentStep(ProcessStep.MAP);
  };

  const handleMappingConfirmed = (confirmedMappings: MappingState) => {
    setMappings(confirmedMappings);
    const result = processData(files, config, confirmedMappings);
    setProcessedData(result);
    setCurrentStep(ProcessStep.REVIEW);
  };

  const handleReviewComplete = (updatedData: ProcessedDataState) => {
    setProcessedData(updatedData);
    setCurrentStep(ProcessStep.INVOICE);
  };

  const handleBack = () => {
    if (currentStep === ProcessStep.MAP) setCurrentStep(ProcessStep.LOAD);
    if (currentStep === ProcessStep.REVIEW) setCurrentStep(ProcessStep.MAP);
    if (currentStep === ProcessStep.INVOICE) setCurrentStep(ProcessStep.REVIEW);
  };

  const handleSaveSession = () => {
    const session: SessionState = {
      version: 1,
      savedAt: new Date().toISOString(),
      currentStep,
      files,
      config,
      mappings,
      processedData,
    };

    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeOwner = config.ownerName
      ? config.ownerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : 'owner';
    const safePeriod = config.periodStart ? config.periodStart : 'draft';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    const filename = `str-session-${safeOwner}-${safePeriod}-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreFromSession = (session: SessionState) => {
    setFiles(session.files);
    setConfig(session.config);
    setMappings(session.mappings);
    setProcessedData(session.processedData);
    const isValidStep = Object.values(ProcessStep).includes(session.currentStep);
    setCurrentStep(isValidStep ? session.currentStep : ProcessStep.REVIEW);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18">
          <div className="flex items-center justify-between h-full py-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-md shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 3.667h6m-6 0V17h-6v-6.333H3M9 7v6.333H3V7h6z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">STR Invoicer</h1>
                <p className="text-xs text-slate-500 font-medium">Offline Processor</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-1">
              {STEPS.map((step, idx) => {
                const isActive = step.id === currentStep;
                const isPast = STEPS.findIndex((s) => s.id === currentStep) > idx;
                const isLast = idx === STEPS.length - 1;
                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`flex items-center px-3 py-2 rounded-full transition-all duration-300 ${
                        isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : isPast
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isPast ? <Check size={14} strokeWidth={3} /> : idx + 1}
                      </div>
                      <span
                        className={`ml-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-indigo-900'
                            : isPast
                              ? 'text-slate-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="w-8 flex justify-center">
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
        <div className="md:hidden h-1 bg-slate-100 w-full">
          <div
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{
              width: `${((STEPS.findIndex((s) => s.id === currentStep) + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          {currentStep === ProcessStep.LOAD && (
            <StepLoad
              initialConfig={config}
              onNext={handleFilesLoaded}
              onResumeSession={restoreFromSession}
            />
          )}

          {currentStep === ProcessStep.MAP && (
            <StepMap
              files={files}
              initialMappings={mappings}
              onBack={handleBack}
              onNext={handleMappingConfirmed}
            />
          )}

          {currentStep === ProcessStep.REVIEW && processedData && (
            <StepReview
              data={processedData}
              config={config}
              onBack={handleBack}
              onNext={handleReviewComplete}
              onSaveDraft={handleSaveSession}
            />
          )}

          {currentStep === ProcessStep.INVOICE && processedData && (
            <StepInvoice
              data={processedData}
              config={config}
              onBack={handleBack}
              onSaveDraft={handleSaveSession}
            />
          )}
        </div>
      </main>
    </div>
  );
}
