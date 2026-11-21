import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'min-h-[44px] px-3 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'min-h-[44px] px-3 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
          }`}
        >
          <Share className="w-4 h-4 shrink-0" />
          <span>Pasang di iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Pasang di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan pasang iOS"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li>1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.</li>
                <li>2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>3. Ketuk <strong>Tambah</strong> untuk akses offline cepat seperti aplikasi asli.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
