import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  HeartPulse,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import type { AppTab } from '../types';

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
  {
    title: '4. Tombol Darurat SOS & Profil Kesehatan',
    description:
      'Dalam kondisi gawat darurat (medis, keamanan, atau kebakaran), buka menu Darurat lalu tekan tombol SOS satu ketukan. Ringkasan golongan darah, alergi, dan kontak keluarga otomatis terkirim ke pengurus dan tim medis.',
    tip: 'Data kesehatan Anda dienkripsi dengan AES-256-GCM dan tersimpan aman di perangkat untuk akses darurat meski tanpa sinyal.',
    targetTab: 'darurat',
    icon: HeartPulse,
  },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  if (!isOpen) return null;

  const current = TUTORIAL_STEPS[stepIndex];
  const Icon = current.icon;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      setStepIndex(0);
    } else {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      onNavigate(TUTORIAL_STEPS[nextIdx].targetTab);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      onNavigate(TUTORIAL_STEPS[prevIdx].targetTab);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
      >
        <div className="sm:hidden pb-3 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
            <BookOpen className="w-4 h-4" />
            <span>Panduan Warga Baru · Langkah {stepIndex + 1} dari {TUTORIAL_STEPS.length}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-700 dark:bg-emerald-500 transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${(stepIndex + 1) / TUTORIAL_STEPS.length})` }}
          />
        </div>

        <div className="mt-6 flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h3 id="tutorial-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {current.title}
            </h3>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-300 leading-relaxed">
              {current.description}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {current.tip}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={stepIndex === 0}
            className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="min-h-[48px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>{isLast ? 'Selesai & Mulai' : 'Lanjut'}</span>
            {!isLast && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
