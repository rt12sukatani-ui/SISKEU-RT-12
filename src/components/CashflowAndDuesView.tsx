import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  Clock,
  Copy,
  Eye,
  Image as ImageIcon,
  Plus,
  Search,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { compressProofImage } from '../lib/crypto';
import type {
  KasTransaction,
  PaymentMethod,
  ResidentPublic,
  RtSettings,
  TransactionCategory,
} from '../types';
import {
  calculatePeriodDuesTarget,
  calculateResidentLedger,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatNominalInput,
  formatRupiah,
  formatTimestamp,
  getCategoryLabel,
  getCurrentYearMonth,
  getRequiredTariff,
  getResidentMonthDuesSummary,
  getResidentPaidMonthsCoverage,
  parseNominalInput,
  previewPaymentPeriodCoverage,
  TRANSACTION_CATEGORY_GROUPS,
} from '../utils/format';

interface CashflowAndDuesViewProps {
  profile: ResidentPublic;
  residents: ResidentPublic[];
  isPengurus: boolean;
  canManageKas: boolean;
  isOnline: boolean;
  rtSettings: RtSettings;
  transactions: KasTransaction[];
  openPaymentModalInitially?: boolean;
  initialFilterTab?: 'all' | 'pending' | 'kurang_bayar' | 'mine' | 'expense';
  focusTransactionsKey?: number;
  onCloseInitialPaymentModal?: () => void;
  onSubmitDues: (data: {
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    proofImageData: string;
    notes: string;
  }) => Promise<void>;
  onAdminCreateTransaction: (data: {
    type: 'income' | 'expense';
    category: TransactionCategory;
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => Promise<void>;
  onAdminVerifyTransaction: (
    tx: KasTransaction,
    decision: 'approved' | 'rejected',
    rejectionReason?: string
  ) => Promise<void>;
}

export const CashflowAndDuesView: React.FC<CashflowAndDuesViewProps> = ({
  profile,
  residents,
  isPengurus,
  canManageKas,
  isOnline,
  rtSettings,
  transactions,
  openPaymentModalInitially = false,
  initialFilterTab = 'all',
  focusTransactionsKey = 0,
  onCloseInitialPaymentModal,
  onSubmitDues,
  onAdminCreateTransaction,
  onAdminVerifyTransaction,
}) => {
  const currentMonth = getCurrentYearMonth();
  const myDuesSummary = getResidentMonthDuesSummary(profile, transactions, currentMonth);
  const myPaidCoverage = getResidentPaidMonthsCoverage(profile, transactions, currentMonth);
  const myFamilyStatus = myDuesSummary.familyStatus;
  const myRequiredTariff = myDuesSummary.tariff;
  const residentMap = new Map(residents.map((r) => [r.uid, r]));

  const defaultStartMonth = myPaidCoverage.isReferenceMonthPaid
    ? myPaidCoverage.nextUnpaidMonth
    : currentMonth;

  const resolvedInitialTab = !isPengurus && (initialFilterTab === 'mine' || initialFilterTab === 'expense')
    ? 'all'
    : initialFilterTab;
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'kurang_bayar' | 'mine' | 'expense'>(
    resolvedInitialTab
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedBank, setCopiedBank] = useState(false);
  const transactionsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextTab =
      !isPengurus && (initialFilterTab === 'mine' || initialFilterTab === 'expense')
        ? 'all'
        : initialFilterTab;
    setFilterTab(nextTab);
  }, [initialFilterTab, isPengurus, focusTransactionsKey]);

  useEffect(() => {
    if (focusTransactionsKey > 0 && !openPaymentModalInitially) {
      const timer = window.setTimeout(() => {
        transactionsSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [focusTransactionsKey, openPaymentModalInitially]);

  const [showDuesForm, setShowDuesForm] = useState(openPaymentModalInitially);
  const [showAdminEntryForm, setShowAdminEntryForm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Resident dues submission form state
  const [billingMonth, setBillingMonth] = useState(defaultStartMonth);
  const [periodMonths, setPeriodMonths] = useState<number>(1);
  const selectedMonthSummary = getResidentMonthDuesSummary(profile, transactions, billingMonth);
  const periodTarget = calculatePeriodDuesTarget(profile, transactions, billingMonth, periodMonths);
  const [amount, setAmount] = useState(formatNominalInput(periodTarget.totalAmount));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');

  useEffect(() => {
    if (openPaymentModalInitially) {
      const nextStart = myPaidCoverage.isReferenceMonthPaid
        ? myPaidCoverage.nextUnpaidMonth
        : currentMonth;
      const nextTarget = calculatePeriodDuesTarget(profile, transactions, nextStart, 1);
      setBillingMonth(nextStart);
      setPeriodMonths(1);
      setAmount(formatNominalInput(nextTarget.totalAmount));
      setShowDuesForm(true);
    }
  }, [openPaymentModalInitially, myPaidCoverage.isReferenceMonthPaid, myPaidCoverage.nextUnpaidMonth, currentMonth, profile, transactions]);

  useEffect(() => {
    if (!showDuesForm) {
      setBillingMonth(defaultStartMonth);
      setPeriodMonths(1);
      const nextTarget = calculatePeriodDuesTarget(profile, transactions, defaultStartMonth, 1);
      setAmount(formatNominalInput(nextTarget.totalAmount));
    }
  }, [defaultStartMonth, profile, transactions, showDuesForm]);

  const paymentPreview = previewPaymentPeriodCoverage(
    profile,
    transactions,
    billingMonth,
    parseNominalInput(amount)
  );

  const [proofImageData, setProofImageData] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Admin verification rejection modal
  const [rejectingTx, setRejectingTx] = useState<KasTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Admin cashflow entry form
  const [adminType, setAdminType] = useState<'expense' | 'income'>('expense');
  const [adminCategory, setAdminCategory] = useState<TransactionCategory>('kebersihan_lingkungan');
  const [adminTitle, setAdminTitle] = useState('');
  const [adminAmount, setAdminAmount] = useState('');
  const [adminMonth, setAdminMonth] = useState(getCurrentYearMonth());
  const [adminMethod, setAdminMethod] = useState<PaymentMethod>('tunai');
  const [adminNotes, setAdminNotes] = useState('');

  const pendingList = transactions.filter((t) => t.status === 'pending');

  // Khusus warga: tampilan transaksi hanya menampilkan transaksi pribadi
  const baseTransactions = isPengurus
    ? transactions
    : transactions.filter((t) => t.residentUid === profile.uid);

  const visiblePendingList = baseTransactions.filter((t) => t.status === 'pending');

  const isMonthStillUnderpaid = (tx: KasTransaction) => {
    if (tx.type !== 'income' || tx.category !== 'iuran_bulanan' || tx.status === 'rejected') {
      return false;
    }
    const txFamily = tx.familyStatus || residentMap.get(tx.residentUid)?.familyStatus || 'umum';
    const effectiveResident: ResidentPublic = residentMap.get(tx.residentUid) || {
      uid: tx.residentUid,
      displayName: tx.residentName,
      houseBlock: tx.houseBlock,
      residentStatus: 'tetap',
      familyStatus: txFamily,
      elderlyMode: false,
      communityId: 'rt_warga',
    };
    const ledger = calculateResidentLedger(effectiveResident, transactions, tx.billingMonth);
    return ledger.status === 'kurang_bayar';
  };

  const underpaidList = baseTransactions.filter((t) => isMonthStillUnderpaid(t));

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTransactions = baseTransactions.filter((tx) => {
    if (!isPengurus && tx.residentUid !== profile.uid) return false;
    if (filterTab === 'pending' && tx.status !== 'pending') return false;
    if (filterTab === 'kurang_bayar' && !isMonthStillUnderpaid(tx)) {
      return false;
    }
    if (filterTab === 'mine' && tx.residentUid !== profile.uid) return false;
    if (filterTab === 'expense' && tx.type !== 'expense') return false;

    if (normalizedSearch) {
      const hay = `${tx.title} ${tx.residentName} ${tx.houseBlock} ${getCategoryLabel(tx.category)}`.toLowerCase();
      return hay.includes(normalizedSearch);
    }
    return true;
  });

  const handleCopyAccount = async () => {
    if (!rtSettings.bankAccountNumber) return;
    try {
      const cleanAccountNumber = rtSettings.bankAccountNumber.replace(/\D/g, '');
      await navigator.clipboard.writeText(cleanAccountNumber);
      setCopiedBank(true);
      window.setTimeout(() => setCopiedBank(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFormError(null);
    try {
      const compressed = await compressProofImage(file);
      setProofImageData(compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memproses foto bukti.');
    }
  };

  const handleDuesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const numAmount = parseNominalInput(amount);
    if (!numAmount || numAmount < 1000) {
      setFormError('Masukkan nominal iuran minimal Rp 1.000.');
      return;
    }
    if (paymentMethod !== 'tunai' && !proofImageData) {
      setFormError('Mohon unggah foto bukti pembayaran agar admin dapat memverifikasi.');
      return;
    }

    setSubmitting(true);
    try {
      const coveredCount = paymentPreview.coveredCount;
      const effectiveMonths =
        coveredCount > 1 && paymentPreview.endMonth ? coveredCount : periodMonths;
      const effectiveEndMonth =
        coveredCount > 1 && paymentPreview.endMonth
          ? paymentPreview.endMonth
          : periodTarget.endMonth;
      const duesTitle =
        effectiveMonths > 1
          ? `Iuran ${effectiveMonths} Bulan (${formatMonthLabel(billingMonth)} – ${formatMonthLabel(effectiveEndMonth)})`
          : `Iuran Bulanan ${formatMonthLabel(billingMonth)}`;

      await onSubmitDues({
        title: duesTitle,
        amount: numAmount,
        billingMonth,
        paymentMethod,
        proofImageData,
        notes: notes.trim(),
      });
      setFormSuccess(
        isOnline
          ? 'Bukti pembayaran berhasil dikirim dan menunggu verifikasi admin RT.'
          : 'Tersimpan di antrean offline. Akan dikirim otomatis saat internet kembali terhubung.'
      );
      setProofImageData('');
      setNotes('');
      setShowDuesForm(false);
      onCloseInitialPaymentModal?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengirim pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseNominalInput(adminAmount);
    if (!adminTitle.trim() || !numAmount || numAmount <= 0) return;

    setSubmitting(true);
    try {
      await onAdminCreateTransaction({
        type: adminType,
        category: adminCategory,
        title: adminTitle.trim(),
        amount: numAmount,
        billingMonth: adminMonth,
        paymentMethod: adminMethod,
        notes: adminNotes.trim(),
      });
      setAdminTitle('');
      setAdminAmount('');
      setAdminNotes('');
      setShowAdminEntryForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Kas Warga & Verifikasi Iuran
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Unggah bukti transfer untuk verifikasi real-time · Catatan transaksi transparan
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              const nextTarget = calculatePeriodDuesTarget(profile, transactions, defaultStartMonth, 1);
              setBillingMonth(defaultStartMonth);
              setPeriodMonths(1);
              setAmount(formatNominalInput(nextTarget.totalAmount));
              setShowDuesForm(true);
              setShowAdminEntryForm(false);
            }}
            className="min-h-[48px] px-4 sm:px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Bayar Iuran</span>
          </button>

          {canManageKas && (
            <button
              type="button"
              onClick={() => {
                setShowAdminEntryForm((v) => !v);
                setShowDuesForm(false);
              }}
              className="min-h-[48px] px-3.5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Catat Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {formSuccess && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          {formSuccess}
        </div>
      )}

      {/* Family Tariff & Current Month Payment Status Banner */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Status Keluarga: {FAMILY_STATUS_LABELS[myFamilyStatus]} Tarif Wajib{' '}
            <span className="font-mono-num text-slate-700 dark:text-slate-200">
              {formatRupiah(myRequiredTariff)}/bulan
            </span>
          </p>
          {(profile.familyStatus || 'umum') !== myFamilyStatus && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Perubahan ke {FAMILY_STATUS_LABELS[profile.familyStatus || 'umum']} berlaku mulai bulan berikutnya; iuran {formatMonthLabel(currentMonth)} tetap terkunci.
            </p>
          )}
          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {myDuesSummary.status === 'lunas'
              ? myPaidCoverage.streakMonthsCount > 1
                ? `Iuran ${formatMonthLabel(currentMonth)}: Lunas · ${myPaidCoverage.streakMonthsCount} Bulan Terbayar`
                : `Iuran ${formatMonthLabel(currentMonth)}: Lunas`
              : myDuesSummary.status === 'kurang_bayar'
              ? `Iuran ${formatMonthLabel(currentMonth)}: Kurang Bayar (${formatRupiah(myDuesSummary.shortfall)})`
              : myDuesSummary.status === 'menunggu'
              ? `Iuran ${formatMonthLabel(currentMonth)}: Menunggu Verifikasi (${formatRupiah(myDuesSummary.pendingPaid)})`
              : `Iuran ${formatMonthLabel(currentMonth)}: Belum Bayar (${formatRupiah(myRequiredTariff)})`}
          </p>
          {myDuesSummary.status === 'lunas' && myPaidCoverage.streakStartMonth && myPaidCoverage.streakEndMonth && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Periode terbayar: {formatMonthLabel(myPaidCoverage.streakStartMonth)}
              {myPaidCoverage.streakEndMonth !== myPaidCoverage.streakStartMonth
                ? ` – ${formatMonthLabel(myPaidCoverage.streakEndMonth)}`
                : ''}{' '}
              ({myPaidCoverage.remainingMonthsFromRef} bulan mulai bulan ini
              {myPaidCoverage.totalPaidMonths > myPaidCoverage.streakMonthsCount
                ? ` · total ${myPaidCoverage.totalPaidMonths} bulan terbayar`
                : ''}
              )
            </p>
          )}
          {myDuesSummary.carryOverFromPrev > 0 && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Termasuk saldo lebih bulan sebelumnya: {formatRupiah(myDuesSummary.carryOverFromPrev)}
            </p>
          )}
          {myDuesSummary.status === 'lunas' && myPaidCoverage.partialCarryOverForNext > 0 && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Sisa saldo {formatRupiah(myPaidCoverage.partialCarryOverForNext)} otomatis menjadi saldo {formatMonthLabel(myPaidCoverage.nextUnpaidMonth)}
            </p>
          )}
          {rtSettings.bankAccountNumber && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rekening RT: {rtSettings.bankName || 'Bank'} <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">{rtSettings.bankAccountNumber}</span> an. {rtSettings.bankAccountHolder || 'Kas RT'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {rtSettings.bankAccountNumber && (
            <button
              type="button"
              onClick={() => void handleCopyAccount()}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {copiedBank ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Rekening</span>
                </>
              )}
            </button>
          )}

          {myDuesSummary.status === 'kurang_bayar' && (
            <button
              type="button"
              onClick={() => {
                setBillingMonth(currentMonth);
                setPeriodMonths(1);
                setAmount(formatNominalInput(myDuesSummary.shortfall > 0 ? myDuesSummary.shortfall : myRequiredTariff));
                setShowDuesForm(true);
                setShowAdminEntryForm(false);
              }}
              className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              Lunasi Kekurangan ({formatRupiah(myDuesSummary.shortfall)})
            </button>
          )}
        </div>
      </div>

      {/* Resident Dues Submission Popup Modal */}
      {showDuesForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pembayaran Iuran"
          onClick={() => {
            if (!submitting) {
              setShowDuesForm(false);
              onCloseInitialPaymentModal?.();
            }
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  Pembayaran Iuran
                </h2>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowDuesForm(false);
                  onCloseInitialPaymentModal?.();
                }}
                aria-label="Tutup formulir pembayaran"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleDuesSubmit(e)}
              className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe space-y-5"
            >
              {formError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-sm text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

          {myPaidCoverage.isReferenceMonthPaid && myPaidCoverage.streakEndMonth && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Iuran Anda sudah lunas hingga {formatMonthLabel(myPaidCoverage.streakEndMonth)} ({myPaidCoverage.totalPaidMonths} bulan terbayar). Pembayaran lanjutan otomatis dimulai dari {formatMonthLabel(myPaidCoverage.nextUnpaidMonth)}.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Mulai Bulan Tagihan
              </label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => {
                  const nextMonth = e.target.value;
                  setBillingMonth(nextMonth);
                  const nextTarget = calculatePeriodDuesTarget(
                    profile,
                    transactions,
                    nextMonth,
                    periodMonths
                  );
                  setAmount(formatNominalInput(nextTarget.totalAmount));
                }}
                required
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Periode Pembayaran
              </label>
              <select
                value={periodMonths}
                onChange={(e) => {
                  const nextPeriod = Number(e.target.value) || 1;
                  setPeriodMonths(nextPeriod);
                  const nextTarget = calculatePeriodDuesTarget(
                    profile,
                    transactions,
                    billingMonth,
                    nextPeriod
                  );
                  setAmount(formatNominalInput(nextTarget.totalAmount));
                }}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((mCount) => (
                  <option key={mCount} value={mCount}>
                    {mCount === 1
                      ? '1 Bulan'
                      : mCount === 3
                      ? '3 Bulan (Triwulan)'
                      : mCount === 6
                      ? '6 Bulan (1 Semester)'
                      : mCount === 12
                      ? '12 Bulan (1 Tahun)'
                      : `${mCount} Bulan`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                {selectedMonthSummary.shortfall > 0 && selectedMonthSummary.shortfall < selectedMonthSummary.tariff && periodMonths === 1
                  ? `Kurang Bayar ${formatRupiah(selectedMonthSummary.shortfall)}`
                  : `${FAMILY_STATUS_LABELS[selectedMonthSummary.familyStatus]}`}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatNominalInput(e.target.value))}
                placeholder="120.000"
                required
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-num"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
              >
                <option value="transfer">Transfer</option>
                <option value="tunai">Tunai</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <span>
                Periode dipilih:{' '}
                {periodMonths === 1
                  ? formatMonthLabel(billingMonth)
                  : `${formatMonthLabel(billingMonth)} – ${formatMonthLabel(periodTarget.endMonth)} (${periodMonths} Bulan)`}
              </span>
              <span className="font-mono-num text-emerald-700 dark:text-emerald-400">
                Total: {formatRupiah(periodTarget.totalAmount)}
              </span>
            </div>
            {parseNominalInput(amount) > 0 && paymentPreview.coveredCount === 0 && paymentPreview.shortfallInStartMonth > 0 && (
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Nominal ({formatRupiah(parseNominalInput(amount))}) masih kurang {formatRupiah(paymentPreview.shortfallInStartMonth)} untuk melunasi {formatMonthLabel(billingMonth)}. Status akan tercatat Kurang Bayar hingga dilunasi.
              </p>
            )}
            {parseNominalInput(amount) > 0 && paymentPreview.coveredCount >= 1 && paymentPreview.endMonth && (
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Nominal {formatRupiah(parseNominalInput(amount))} melunasi {paymentPreview.coveredCount} bulan (
                {paymentPreview.coveredCount === 1
                  ? formatMonthLabel(billingMonth)
                  : `${formatMonthLabel(billingMonth)} – ${formatMonthLabel(paymentPreview.endMonth)}`}
                )
                {paymentPreview.remainderForNextMonth > 0
                  ? ` + sisa saldo ${formatRupiah(paymentPreview.remainderForNextMonth)} untuk bulan berikutnya`
                  : '.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Unggah Foto Bukti Pembayaran / Kwitansi
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <label className="min-h-[48px] px-3.5 sm:px-4 rounded-xl border border-dashed border-slate-400 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>{proofImageData ? 'Foto Ulang' : 'Ambil Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                </label>

                <label className="min-h-[48px] px-3.5 sm:px-4 rounded-xl border border-dashed border-slate-400 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span>{proofImageData ? 'Ganti Galeri' : 'Pilih Galeri'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                </label>
              </div>

              {proofImageData && (
                <div className="flex items-center gap-3">
                  <img
                    src={proofImageData}
                    alt="Pratinjau bukti transfer"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewImage(proofImageData)}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Perbesar Foto
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              maxLength={250}
              placeholder="Transfer dari rekening atas nama Budi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowDuesForm(false);
                onCloseInitialPaymentModal?.();
              }}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm cursor-pointer"
            >
              {submitting ? 'Mengirim...' : 'Kirim Pembayaran'}
            </button>
          </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create Income/Expense Form */}
      {canManageKas && showAdminEntryForm && (
        <form
          onSubmit={(e) => void handleAdminEntrySubmit(e)}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Catat Transaksi RT
            </h2>
            <button
              type="button"
              onClick={() => setShowAdminEntryForm(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Jenis</label>
              <select
                value={adminType}
                onChange={(e) => {
                  const val = e.target.value as 'expense' | 'income';
                  setAdminType(val);
                  setAdminCategory(val === 'expense' ? 'kebersihan_lingkungan' : 'iuran_rt');
                }}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="expense">Pengeluaran Kas</option>
                <option value="income">Penerimaan Kas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Kategori</label>
              <select
                value={adminCategory}
                onChange={(e) => setAdminCategory(e.target.value as TransactionCategory)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                {TRANSACTION_CATEGORY_GROUPS[adminType].map((group) => (
                  <optgroup key={group.groupLabel} label={group.groupLabel}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Bulan Buku</label>
              <input
                type="month"
                value={adminMonth}
                onChange={(e) => setAdminMonth(e.target.value)}
                required
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-1.5">Keterangan Transaksi</label>
              <input
                type="text"
                required
                maxLength={110}
                placeholder="Honor petugas kebersihan & angkut sampah"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Nominal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="10.000"
                value={adminAmount}
                onChange={(e) => setAdminAmount(formatNominalInput(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Metode</label>
              <select
                value={adminMethod}
                onChange={(e) => setAdminMethod(e.target.value as PaymentMethod)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-1.5">Catatan (Opsional)</label>
              <input
                type="text"
                maxLength={250}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Nomor kwitansi atau detail penerima"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] px-6 rounded-xl bg-slate-900 dark:bg-emerald-700 text-white font-semibold text-sm cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* Admin Real-Time Verification Queue */}
      {canManageKas && pendingList.length > 0 && (
        <section className="rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Antrean Verifikasi Admin ({pendingList.length})
              </h2>
            </div>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Pembaruan Real-Time
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingList.map((tx) => {
              const effectiveResident: ResidentPublic = residentMap.get(tx.residentUid) || {
                uid: tx.residentUid,
                displayName: tx.residentName,
                houseBlock: tx.houseBlock,
                residentStatus: 'tetap',
                familyStatus: tx.familyStatus || 'umum',
                elderlyMode: false,
                communityId: 'rt_warga',
              };
              const simulatedTxs = transactions.map((t) =>
                t.id === tx.id ? { ...t, status: 'approved' as const } : t
              );
              const ledgerAfter = calculateResidentLedger(
                effectiveResident,
                simulatedTxs,
                tx.billingMonth
              );
              const otherTxs = transactions.filter((t) => t.id !== tx.id);
              const txPreview =
                tx.category === 'iuran_bulanan'
                  ? previewPaymentPeriodCoverage(
                      effectiveResident,
                      otherTxs,
                      tx.billingMonth,
                      tx.amount
                    )
                  : null;
              const txFamily =
                tx.category === 'iuran_bulanan'
                  ? ledgerAfter.familyStatus
                  : tx.familyStatus || effectiveResident.familyStatus || 'umum';
              const txTariff =
                tx.category === 'iuran_bulanan'
                  ? ledgerAfter.requiredTariff
                  : getRequiredTariff(txFamily);
              const willBeUnderpaid =
                tx.category === 'iuran_bulanan' && ledgerAfter.status === 'kurang_bayar';
              const isSettlementTopUp =
                tx.category === 'iuran_bulanan' &&
                !willBeUnderpaid &&
                (ledgerAfter.paidThisMonth > tx.amount || ledgerAfter.carryOverFromPrev > 0);
              return (
                <div
                  key={tx.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {tx.residentName} · {tx.houseBlock}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {tx.title} · {FAMILY_STATUS_LABELS[txFamily]} · {tx.paymentMethod.toUpperCase()}
                      </p>
                      <p className="font-mono-num text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
                        {formatRupiah(tx.amount)}
                      </p>
                      {willBeUnderpaid ? (
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-1">
                          Kurang Bayar (masih kurang {formatRupiah(ledgerAfter.shortfall)} dari tarif {formatRupiah(txTariff)})
                        </p>
                      ) : txPreview && txPreview.coveredCount > 1 && txPreview.endMonth ? (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                          Lunas {txPreview.coveredCount} Bulan ({formatMonthLabel(tx.billingMonth)} – {formatMonthLabel(txPreview.endMonth)})
                          {txPreview.remainderForNextMonth > 0
                            ? ` · Sisa ${formatRupiah(txPreview.remainderForNextMonth)} ke bulan berikutnya`
                            : ''}
                        </p>
                      ) : ledgerAfter.surplus > 0 ? (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                          Lunas · Lebih {formatRupiah(ledgerAfter.surplus)} menjadi saldo bulan berikutnya
                        </p>
                      ) : isSettlementTopUp ? (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                          Pelunasan bulan {formatMonthLabel(tx.billingMonth)} (status menjadi Lunas)
                        </p>
                      ) : null}
                      {tx.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Catatan: {tx.notes}
                        </p>
                      )}
                    </div>

                    {tx.proofImageData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.proofImageData || null)}
                        className="shrink-0 group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        <img
                          src={tx.proofImageData}
                          alt={`Bukti ${tx.residentName}`}
                          className="w-16 h-16 object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="sr-only">Perbesar bukti</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onAdminVerifyTransaction(tx, 'approved')}
                      className="flex-1 min-h-[44px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {willBeUnderpaid
                          ? 'Verifikasi (Kurang Bayar)'
                          : txPreview && txPreview.coveredCount > 1
                          ? `Setujui (${txPreview.coveredCount} Bln Lunas)`
                          : 'Setujui (Lunas)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingTx(tx);
                        setRejectReason('');
                      }}
                      className="flex-1 min-h-[44px] px-3 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search + Segmented Filter Bar */}
      <div
        ref={transactionsSectionRef}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 scroll-mt-20"
      >
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full lg:w-fit overflow-x-auto no-scrollbar">
          {(isPengurus
            ? ([
                { id: 'all', label: 'Semua Transaksi' },
                { id: 'pending', label: `Menunggu (${visiblePendingList.length})` },
                { id: 'kurang_bayar', label: `Kurang Bayar (${underpaidList.length})` },
                { id: 'mine', label: 'Iuran Saya' },
                { id: 'expense', label: 'Pengeluaran Kas' },
              ] as const)
            : ([
                { id: 'all', label: 'Transaksi Saya' },
                { id: 'pending', label: `Menunggu (${visiblePendingList.length})` },
                { id: 'kurang_bayar', label: `Kurang Bayar (${underpaidList.length})` },
              ] as const)
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`min-h-[42px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isPengurus ? 'Cari warga, blok, transaksi...' : 'Cari transaksi iuran saya...'}
            aria-label="Cari transaksi kas"
            className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Transaction Ledger List */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? `Tidak ada transaksi yang cocok dengan "${searchQuery}".`
                  : 'Tidak ada transaksi pada kategori ini.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const isMonthlyDues = isIncome && tx.category === 'iuran_bulanan';
              const effectiveResident: ResidentPublic = residentMap.get(tx.residentUid) || {
                uid: tx.residentUid,
                displayName: tx.residentName,
                houseBlock: tx.houseBlock,
                residentStatus: 'tetap',
                familyStatus: tx.familyStatus || 'umum',
                elderlyMode: false,
                communityId: 'rt_warga',
              };
              const txLedger = isMonthlyDues
                ? calculateResidentLedger(effectiveResident, transactions, tx.billingMonth)
                : null;
              const txPreview =
                isMonthlyDues && tx.status !== 'rejected'
                  ? previewPaymentPeriodCoverage(
                      effectiveResident,
                      transactions.filter((t) => t.id !== tx.id),
                      tx.billingMonth,
                      tx.amount
                    )
                  : null;
              const txFamily = txLedger?.familyStatus || tx.familyStatus || effectiveResident.familyStatus || 'umum';
              const txTariff = txLedger?.requiredTariff || getRequiredTariff(txFamily);
              const isSettledMonth = Boolean(txLedger && txLedger.status === 'lunas');
              const txUnderpaid =
                isMonthlyDues &&
                tx.status !== 'rejected' &&
                !isSettledMonth &&
                (txLedger?.status === 'kurang_bayar' || tx.status === 'kurang_bayar');

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {tx.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tx.residentName} · {tx.houseBlock} · {getCategoryLabel(tx.category)} ·{' '}
                        {tx.paymentMethod.toUpperCase()} · {formatTimestamp(tx.createdAt)}
                      </p>
                      {txUnderpaid && txLedger && txLedger.shortfall > 0 && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">
                          Tarif {FAMILY_STATUS_LABELS[txFamily]}: {formatRupiah(txTariff)} (Kurang Bayar {formatRupiah(txLedger.shortfall)})
                        </p>
                      )}
                      {isSettledMonth && txPreview && txPreview.coveredCount > 1 && txPreview.endMonth ? (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                          Melunasi {txPreview.coveredCount} bulan ({formatMonthLabel(tx.billingMonth)} – {formatMonthLabel(txPreview.endMonth)})
                          {txPreview.remainderForNextMonth > 0
                            ? ` · sisa ${formatRupiah(txPreview.remainderForNextMonth)} ke bulan berikutnya`
                            : ''}
                        </p>
                      ) : isSettledMonth && txLedger && txLedger.surplus > 0 ? (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                          Saldo lebih {formatRupiah(txLedger.surplus)} masuk ke bulan berikutnya
                        </p>
                      ) : null}
                      {tx.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {tx.notes}
                        </p>
                      )}
                      {tx.status === 'rejected' && tx.rejectionReason && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                          Alasan ditolak: {tx.rejectionReason}
                        </p>
                      )}
                      {tx.isOfflinePending && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-semibold">
                          Menunggu koneksi internet untuk sinkronisasi
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                    {tx.proofImageData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.proofImageData || null)}
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Bukti</span>
                      </button>
                    )}

                    <div className="sm:text-right mr-auto sm:mr-0">
                      <p
                        className={`font-mono-num text-sm sm:text-base font-bold tabular-nums ${
                          isIncome
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-0.5 ${
                          tx.status === 'rejected'
                            ? 'text-red-600 dark:text-red-400'
                            : tx.status === 'pending'
                            ? 'text-amber-700 dark:text-amber-400'
                            : isSettledMonth || tx.status === 'approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {tx.status === 'rejected'
                          ? 'Ditolak'
                          : tx.status === 'pending'
                          ? txUnderpaid
                            ? 'Kurang Bayar · Menunggu'
                            : 'Menunggu Verifikasi'
                          : isMonthlyDues
                          ? isSettledMonth
                            ? txPreview && txPreview.coveredCount > 1
                              ? `Lunas (${txPreview.coveredCount} Bln)`
                              : 'Lunas'
                            : 'Kurang Bayar'
                          : 'Disetujui'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Photo Proof Lightbox Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto bukti pembayaran"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-lg w-full rounded-3xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Foto Bukti Pembayaran
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Bukti transfer warga"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-slate-100 dark:bg-slate-950"
            />
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
        >
          <div className="max-w-md w-full rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Tolak Bukti Pembayaran
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Berikan alasan singkat untuk {rejectingTx.residentName} agar warga dapat mengunggah ulang bukti yang benar.
            </p>
            <input
              type="text"
              maxLength={180}
              placeholder="Foto buram / nominal tidak sesuai mutasi rekening"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingTx(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = rejectingTx;
                  const reason = rejectReason.trim() || 'Bukti pembayaran perlu diperbaiki.';
                  setRejectingTx(null);
                  void onAdminVerifyTransaction(target, 'rejected', reason);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
