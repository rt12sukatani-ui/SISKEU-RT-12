import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  Clock,
  Copy,
  Eye,
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
  calculateResidentLedger,
  CATEGORY_LABELS,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatRupiah,
  formatTimestamp,
  getCurrentYearMonth,
  getRequiredTariff,
  getResidentMonthDuesSummary,
} from '../utils/format';

interface CashflowAndDuesViewProps {
  profile: ResidentPublic;
  residents: ResidentPublic[];
  canManageKas: boolean;
  isOnline: boolean;
  rtSettings: RtSettings;
  transactions: KasTransaction[];
  openPaymentModalInitially?: boolean;
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
  canManageKas,
  isOnline,
  rtSettings,
  transactions,
  openPaymentModalInitially = false,
  onCloseInitialPaymentModal,
  onSubmitDues,
  onAdminCreateTransaction,
  onAdminVerifyTransaction,
}) => {
  const currentMonth = getCurrentYearMonth();
  const myDuesSummary = getResidentMonthDuesSummary(profile, transactions, currentMonth);
  const myFamilyStatus = myDuesSummary.familyStatus;
  const myRequiredTariff = myDuesSummary.tariff;
  const residentMap = new Map(residents.map((r) => [r.uid, r]));

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'kurang_bayar' | 'mine' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedBank, setCopiedBank] = useState(false);

  const [showDuesForm, setShowDuesForm] = useState(openPaymentModalInitially);
  const [showAdminEntryForm, setShowAdminEntryForm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Resident dues submission form state
  const [billingMonth, setBillingMonth] = useState(currentMonth);
  const selectedMonthSummary = getResidentMonthDuesSummary(profile, transactions, billingMonth);
  const [amount, setAmount] = useState(
    String(myDuesSummary.shortfall > 0 ? myDuesSummary.shortfall : myDuesSummary.tariff)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');

  useEffect(() => {
    if (!showDuesForm) {
      setAmount(String(myDuesSummary.shortfall > 0 ? myDuesSummary.shortfall : myDuesSummary.tariff));
    }
  }, [myDuesSummary.shortfall, myDuesSummary.tariff, showDuesForm]);

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
  const [adminCategory, setAdminCategory] = useState<TransactionCategory>('kebersihan');
  const [adminTitle, setAdminTitle] = useState('');
  const [adminAmount, setAdminAmount] = useState('');
  const [adminMonth, setAdminMonth] = useState(getCurrentYearMonth());
  const [adminMethod, setAdminMethod] = useState<PaymentMethod>('tunai');
  const [adminNotes, setAdminNotes] = useState('');

  const pendingList = transactions.filter((t) => t.status === 'pending');

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

  const underpaidList = transactions.filter((t) => isMonthStillUnderpaid(t));

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTransactions = transactions.filter((tx) => {
    if (filterTab === 'pending' && tx.status !== 'pending') return false;
    if (filterTab === 'kurang_bayar' && !isMonthStillUnderpaid(tx)) {
      return false;
    }
    if (filterTab === 'mine' && tx.residentUid !== profile.uid) return false;
    if (filterTab === 'expense' && tx.type !== 'expense') return false;

    if (normalizedSearch) {
      const hay = `${tx.title} ${tx.residentName} ${tx.houseBlock} ${CATEGORY_LABELS[tx.category]}`.toLowerCase();
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

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Masukkan nominal iuran yang valid.');
      return;
    }
    if (paymentMethod !== 'tunai' && !proofImageData) {
      setFormError('Mohon unggah foto bukti transfer/QRIS agar admin dapat memverifikasi.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitDues({
        title: `Iuran Bulanan ${formatMonthLabel(billingMonth)}`,
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
    const numAmount = Number(adminAmount);
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowDuesForm((v) => !v);
              setShowAdminEntryForm(false);
            }}
            className="min-h-[48px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
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
              className="min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Catat Kas (Admin)</span>
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
              ? `Iuran ${formatMonthLabel(currentMonth)}: Lunas (${formatRupiah(myDuesSummary.verifiedPaid)})`
              : myDuesSummary.status === 'kurang_bayar'
              ? `Iuran ${formatMonthLabel(currentMonth)}: Kurang Bayar (kurang ${formatRupiah(myDuesSummary.shortfall)})`
              : myDuesSummary.status === 'menunggu'
              ? `Iuran ${formatMonthLabel(currentMonth)}: Menunggu Verifikasi (${formatRupiah(myDuesSummary.pendingPaid)})`
              : `Iuran ${formatMonthLabel(currentMonth)}: Belum Bayar (${formatRupiah(myRequiredTariff)})`}
          </p>
          {myDuesSummary.carryOverFromPrev > 0 && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Termasuk saldo lebih bulan sebelumnya: {formatRupiah(myDuesSummary.carryOverFromPrev)}
            </p>
          )}
          {myDuesSummary.surplus > 0 && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Kelebihan bayar {formatRupiah(myDuesSummary.surplus)} otomatis menjadi saldo bulan berikutnya
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
                setAmount(String(myDuesSummary.shortfall > 0 ? myDuesSummary.shortfall : myRequiredTariff));
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

      {/* Resident Dues Submission Form */}
      {showDuesForm && (
        <form
          onSubmit={(e) => void handleDuesSubmit(e)}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Pembayaran Iuran
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDuesForm(false);
                onCloseInitialPaymentModal?.();
              }}
              aria-label="Tutup formulir pembayaran"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-sm text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Bulan Tagihan
              </label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => {
                  const nextMonth = e.target.value;
                  setBillingMonth(nextMonth);
                  const nextSummary = getResidentMonthDuesSummary(profile, transactions, nextMonth);
                  setAmount(String(nextSummary.shortfall > 0 ? nextSummary.shortfall : nextSummary.tariff));
                }}
                required
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                {selectedMonthSummary.shortfall > 0 && selectedMonthSummary.shortfall < selectedMonthSummary.tariff
                  ? `Sisa Kurang ${formatRupiah(selectedMonthSummary.shortfall)}`
                  : `Tarif ${FAMILY_STATUS_LABELS[selectedMonthSummary.familyStatus]} ${formatRupiah(selectedMonthSummary.tariff)}`}
              </label>
              <input
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                <option value="transfer">Transfer Bank</option>
                <option value="qris">QRIS RT</option>
                <option value="tunai">Tunai ke Pengurus</option>
              </select>
            </div>
          </div>

          {Number(amount) > 0 && selectedMonthSummary.shortfall > 0 && Number(amount) < selectedMonthSummary.shortfall && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              Pembayaran ({formatRupiah(Number(amount))}) masih kurang {formatRupiah(selectedMonthSummary.shortfall - Number(amount))} dari sisa tagihan {formatRupiah(selectedMonthSummary.shortfall)}. Status akan tercatat sebagai Kurang Bayar hingga kekurangannya dilunasi.
            </div>
          )}

          {Number(amount) > 0 && selectedMonthSummary.shortfall > 0 && Number(amount) === selectedMonthSummary.shortfall && selectedMonthSummary.shortfall < selectedMonthSummary.tariff && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Pembayaran ini melunasi sisa kekurangan bulan {formatMonthLabel(billingMonth)}. Status iuran Anda akan berubah menjadi Lunas setelah diverifikasi admin.
            </div>
          )}

          {Number(amount) > selectedMonthSummary.shortfall && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Kelebihan pembayaran sebesar {formatRupiah(Number(amount) - selectedMonthSummary.shortfall)} akan otomatis menjadi saldo iuran untuk bulan berikutnya.
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Unggah Foto Bukti Transfer / Kwitansi
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="min-h-[48px] px-4 rounded-xl border border-dashed border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold text-sm inline-flex items-center gap-2 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors">
                <Camera className="w-4 h-4 shrink-0" />
                <span>{proofImageData ? 'Ganti Foto Bukti' : 'Pilih atau Foto Bukti'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
              </label>

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
              placeholder="Contoh: Transfer dari rekening atas nama Budi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDuesForm(false)}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm cursor-pointer"
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
      )}

      {/* Admin Create Income/Expense Form */}
      {canManageKas && showAdminEntryForm && (
        <form
          onSubmit={(e) => void handleAdminEntrySubmit(e)}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Catat Transaksi Kas RT (Khusus Admin)
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
                  setAdminCategory(val === 'expense' ? 'kebersihan' : 'donasi');
                }}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="expense">Pengeluaran Kas</option>
                <option value="income">Pemasukan Lain / Donasi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Kategori</label>
              <select
                value={adminCategory}
                onChange={(e) => setAdminCategory(e.target.value as TransactionCategory)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
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
                placeholder="Contoh: Honor petugas kebersihan & angkut sampah"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Nominal (Rp)</label>
              <input
                type="number"
                required
                min={1000}
                value={adminAmount}
                onChange={(e) => setAdminAmount(e.target.value)}
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
                <option value="transfer">Transfer Bank</option>
                <option value="qris">QRIS</option>
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
                      <span>{willBeUnderpaid ? 'Verifikasi (Kurang Bayar)' : 'Setujui (Lunas)'}</span>
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
          {(
            [
              { id: 'all', label: 'Semua Transaksi' },
              { id: 'pending', label: `Menunggu (${pendingList.length})` },
              { id: 'kurang_bayar', label: `Kurang Bayar (${underpaidList.length})` },
              { id: 'mine', label: 'Iuran Saya' },
              { id: 'expense', label: 'Pengeluaran Kas' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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
            placeholder="Cari warga, blok, transaksi..."
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
                        {tx.residentName} · {tx.houseBlock} · {CATEGORY_LABELS[tx.category]} ·{' '}
                        {tx.paymentMethod.toUpperCase()} · {formatTimestamp(tx.createdAt)}
                      </p>
                      {txUnderpaid && txLedger && txLedger.shortfall > 0 && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">
                          Tarif {FAMILY_STATUS_LABELS[txFamily]}: {formatRupiah(txTariff)} (sisa kurang {formatRupiah(txLedger.shortfall)})
                        </p>
                      )}
                      {isSettledMonth && txLedger && txLedger.surplus > 0 && (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                          Saldo lebih {formatRupiah(txLedger.surplus)} masuk ke bulan berikutnya
                        </p>
                      )}
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

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    {tx.proofImageData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.proofImageData || null)}
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Bukti</span>
                      </button>
                    )}

                    <div className="text-right">
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
                            ? 'Lunas'
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
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
              placeholder="Contoh: Foto buram / nominal tidak sesuai mutasi rekening"
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
