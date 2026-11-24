import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import type { AppTab } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
}

const TUTORIAL_STEPS: {
  title: string;
  description: string;
  tip: string;
  targetTab: AppTab;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    title: '1. Pantau Kas RT Secara Transparan',
    description:
      'Di halaman Beranda, Anda bisa langsung melihat total saldo kas RT saat ini, pemasukan, pengeluaran, serta status iuran bulanan rumah Anda.',
    tip: 'Semua angka dicatat terbuka agar seluruh warga bisa memeriksa keuangan bersama.',
    targetTab: 'beranda',
    icon: Wallet,
  },
  {
    title: '2. Bayar Iuran',
    description:
      'Masuk ke menu Kas & Iuran untuk mengirim iuran bulanan. Cukup pilih bulan, ambil atau unggah foto bukti pembayaran, lalu kirim. Bendahara RT akan memverifikasi secara langsung.',
    tip: 'Jika sedang tidak ada internet, data disimpan sementara dan dikirim otomatis saat online.',
    targetTab: 'kas',
    icon: CheckCircle2,
  },
  {
    title: '3. Laporan Bulanan & Pengumuman Real-Time',
    description:
      'Lihat ringkasan pemasukan dan pengeluaran per bulan di menu Laporan, serta terima pengumuman penting lingkungan seperti kerja bakti atau jadwal posyandu di menu Pengumuman.',
    tip: 'Aktifkan notifikasi agar pengingat iuran dan kabar warga langsung muncul di layar ponsel.',
    targetTab: 'pengumuman',
    icon: Bell,
  },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [clickedBtn, setClickedBtn] = useState<'prev' | 'next' | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setClickedBtn(null);
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    }
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const current = TUTORIAL_STEPS[stepIndex];
  const Icon = current.icon;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const flashButton = (btn: 'prev' | 'next') => {
    setClickedBtn(btn);
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setClickedBtn(null);
    }, 380);
  };

  const handleClose = () => {
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    setClickedBtn(null);
    setStepIndex(0);
    onClose();
  };

  const handleNext = () => {
    flashButton('next');
    if (isLast) {
      onNavigate('beranda');
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = window.setTimeout(() => {
        setStepIndex(0);
        setClickedBtn(null);
        onClose();
      }, 160);
    } else {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      onNavigate(TUTORIAL_STEPS[nextIdx].targetTab);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      flashButton('prev');
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      onNavigate(TUTORIAL_STEPS[prevIdx].targetTab);
    }
  };

  const buttonBaseClass =
    'min-h-[42px] sm:min-h-[48px] px-4 sm:px-5 rounded-xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer touch-manipulation select-none enabled:active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

  const getButtonColorClass = (isActiveClicked: boolean) =>
    isActiveClicked
      ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
      : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white enabled:hover:bg-emerald-700 dark:enabled:hover:bg-emerald-700 enabled:hover:border-emerald-700 dark:enabled:hover:border-emerald-700 enabled:hover:text-white dark:enabled:hover:text-white enabled:active:bg-emerald-700 dark:enabled:active:bg-emerald-700 enabled:active:border-emerald-700 dark:enabled:active:border-emerald-700 enabled:active:text-white dark:enabled:active:text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overscroll-contain touch-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain touch-pan-y rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 pb-safe shadow-2xl"
      >
        <div className="sm:hidden pb-2.5 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Panduan Warga Baru · Langkah {stepIndex + 1} dari {TUTORIAL_STEPS.length}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup panduan"
            className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 sm:mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-700 dark:bg-emerald-500 transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${(stepIndex + 1) / TUTORIAL_STEPS.length})` }}
          />
        </div>

        <div className="mt-4 sm:mt-6 flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
            <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h3 id="tutorial-title" className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {current.title}
            </h3>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-base text-slate-700 dark:text-slate-300 leading-snug sm:leading-relaxed">
              {current.description}
            </p>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3">
          <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-snug sm:leading-relaxed">
            {current.tip}
          </p>
        </div>

        <div className="mt-4 sm:mt-6 flex items-center justify-between gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={stepIndex === 0}
            className={`${buttonBaseClass} ${getButtonColorClass(clickedBtn === 'prev')}`}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Sebelumnya</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className={`${buttonBaseClass} ${getButtonColorClass(clickedBtn === 'next')}`}
          >
            <span>{isLast ? 'Selesai & Mulai' : 'Lanjut'}</span>
            {!isLast && <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
          </button>
        </div>
      </div>
    </div>
  );
};
