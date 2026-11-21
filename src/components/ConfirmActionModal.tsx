import React from 'react';
import { AlertTriangle, FileSpreadsheet, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  details = [],
  confirmLabel = 'Konfirmasi & Simpan',
  cancelLabel = 'Batal',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!busy) onCancel();
      }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                destructive
                  ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {destructive ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Tutup konfirmasi"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 pb-safe space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {description}
          </p>

          {details.length > 0 && (
            <ul className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {details.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">•</span>
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`min-h-[44px] px-5 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-50 transition-colors ${
                destructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {busy ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
