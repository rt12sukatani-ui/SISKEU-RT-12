import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import type { KasTransaction, ResidentPublic, RtSettings, TransactionCategory } from '../types';
import {
  downloadMonthlyReportCSV,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatRupiah,
  getCategoryLabel,
  getCurrentYearMonth,
  getResidentMonthDuesSummary,
  getResidentPaidMonthsCoverage,
} from '../utils/format';
import { DownwardSelect } from './DownwardSelect';

interface RecapItemDef {
  key: string;
  label: string;
  categories: TransactionCategory[];
}

interface RecapGroupDef {
  groupLabel: string;
  items: RecapItemDef[];
}

const INCOME_RECAP_GROUPS: RecapGroupDef[] = [
  {
    groupLabel: 'Rutin · Wajib',
    items: [
      { key: 'iuran_rt', label: 'IURAN RT', categories: ['iuran_rt', 'iuran_bulanan'] },
    ],
  },
  {
    groupLabel: 'Rutin · Tertentu / Spesifik',
    items: [
      { key: 'iuran_17an_rt', label: 'IURAN 17AN RT', categories: ['iuran_17an_rt'] },
      { key: 'iuran_17an_rw', label: 'IURAN 17AN RW', categories: ['iuran_17an_rw'] },
      { key: 'iuran_pkk', label: 'IURAN PKK', categories: ['iuran_pkk'] },
      { key: 'arisan', label: 'ARISAN', categories: ['arisan'] },
    ],
  },
  {
    groupLabel: 'Non-Rutin',
    items: [
      { key: 'bantuan_pemerintah', label: 'BANTUAN PEMERINTAH', categories: ['bantuan_pemerintah'] },
      { key: 'sumbangan_donasi', label: 'SUMBANGAN/DONASI', categories: ['sumbangan_donasi', 'donasi'] },
      { key: 'hasil_usaha_kemitraan', label: 'HASIL USAHA/KEMITRAAN', categories: ['hasil_usaha_kemitraan'] },
      { key: 'pdl_bunga_bank', label: 'PENERIMAAN LAINNYA (PDL): BUNGA BANK', categories: ['pdl_bunga_bank'] },
    ],
  },
];

const EXPENSE_RECAP_GROUPS: RecapGroupDef[] = [
  {
    groupLabel: 'Rutin · Pengelola: Pengurus RT',
    items: [
      { key: 'kebersihan_lingkungan', label: 'KEBERSIHAN DAN LINGKUNGAN', categories: ['kebersihan_lingkungan', 'kebersihan'] },
      { key: 'keamanan_ketertiban', label: 'KEAMANAN DAN KETERTIBAN', categories: ['keamanan_ketertiban', 'keamanan'] },
      { key: 'konsumsi', label: 'KONSUMSI (Gula, Teh, Kopi)', categories: ['konsumsi'] },
      { key: 'pdam', label: 'PDAM', categories: ['pdam'] },
      { key: 'listrik', label: 'LISTRIK', categories: ['listrik'] },
      { key: 'internet', label: 'INTERNET', categories: ['internet'] },
      { key: 'iuran_rw', label: 'IURAN RW', categories: ['iuran_rw'] },
      { key: 'pengeluaran_iuran_17an_rw', label: 'IURAN 17AN RW', categories: ['pengeluaran_iuran_17an_rw'] },
      { key: 'inventaris', label: 'INVENTARIS', categories: ['inventaris'] },
      { key: 'fogging', label: 'FOGGING', categories: ['fogging'] },
    ],
  },
  {
    groupLabel: 'Insidentil · Pengelola: Pengurus RT',
    items: [
      { key: 'perbaikan_joglo', label: 'PERBAIKAN JOGLO', categories: ['perbaikan_joglo'] },
      { key: 'pemeliharaan_taman', label: 'PEMELIHARAAN TAMAN', categories: ['pemeliharaan_taman'] },
      { key: 'pemeliharaan_taman_toga', label: 'PEMELIHARAAN TAMAN TOGA', categories: ['pemeliharaan_taman_toga'] },
      { key: 'perbaikan_balai_rt', label: 'PERBAIKAN BALAI RT', categories: ['perbaikan_balai_rt', 'perbaikan'] },
    ],
  },
  {
    groupLabel: 'Insidentil · Pengelola: Panitia / Koordinator',
    items: [
      { key: 'panitia_dasolin', label: 'DASOLIN', categories: ['panitia_dasolin'] },
      { key: 'panitia_17an_rt', label: '17AN RT', categories: ['panitia_17an_rt'] },
      { key: 'panitia_17an_rw', label: '17AN RW', categories: ['panitia_17an_rw'] },
      { key: 'panitia_pkk', label: 'PKK', categories: ['panitia_pkk'] },
      { key: 'panitia_arisan', label: 'ARISAN', categories: ['panitia_arisan'] },
    ],
  },
];

function parseTxDate(ts: unknown): Date | null {
  if (!ts) return null;
  let date: Date;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    date = new Date(ts);
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    return null;
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTxDate(ts: unknown): string {
  const date = parseTxDate(ts);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTxTime(ts: unknown): string {
  const date = parseTxDate(ts);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

interface MonthlyReportViewProps {
  canManageReports: boolean;
  canManageResidents: boolean;
  rtSettings: RtSettings;
  transactions: KasTransaction[];
  residents: ResidentPublic[];
  onSendPaymentReminders: (unpaidResidents: ResidentPublic[], yearMonth: string) => Promise<number>;
  onOpenResidentRegistry?: () => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  canManageReports,
  canManageResidents,
  rtSettings,
  transactions,
  residents,
  onSendPaymentReminders,
  onOpenResidentRegistry,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [recapSearch, setRecapSearch] = useState('');
  const [recapCategory, setRecapCategory] = useState<string>('all');
  const [recapMethod, setRecapMethod] = useState<'all' | 'transfer' | 'tunai'>('all');
  const [recapFlow, setRecapFlow] = useState<'all' | 'income' | 'expense'>('all');
  const [residentFilter, setResidentFilter] = useState<'all' | 'lunas' | 'unpaid'>('all');
  const [residentSearch, setResidentSearch] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [clickedAction, setClickedAction] = useState<'csv' | 'print' | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  const triggerActionClick = (key: 'csv' | 'print', callback: () => void) => {
    setClickedAction(key);
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setClickedAction(null);
    }, 450);
    callback();
  };

  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.billingMonth === selectedMonth),
    [transactions, selectedMonth]
  );

  const approvedMonthTx = useMemo(
    () => monthTransactions.filter((t) => t.status === 'approved' || t.status === 'kurang_bayar'),
    [monthTransactions]
  );

  const monthIncome = approvedMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const monthExpense = approvedMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const monthNet = monthIncome - monthExpense;

  const incomeByCategoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of approvedMonthTx) {
      if (tx.type === 'income') {
        map.set(tx.category, (map.get(tx.category) || 0) + Number(tx.amount || 0));
      }
    }
    return map;
  }, [approvedMonthTx]);

  const expenseByCategoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of approvedMonthTx) {
      if (tx.type === 'expense') {
        map.set(tx.category, (map.get(tx.category) || 0) + Number(tx.amount || 0));
      }
    }
    return map;
  }, [approvedMonthTx]);

  const unmappedIncomeCategories = useMemo(() => {
    const mapped = new Set<string>(
      INCOME_RECAP_GROUPS.flatMap((g) => g.items.flatMap((i) => i.categories))
    );
    return Array.from(incomeByCategoryMap.entries()).filter(
      ([cat, total]) => !mapped.has(cat) && total > 0
    );
  }, [incomeByCategoryMap]);

  const unmappedExpenseCategories = useMemo(() => {
    const mapped = new Set<string>(
      EXPENSE_RECAP_GROUPS.flatMap((g) => g.items.flatMap((i) => i.categories))
    );
    return Array.from(expenseByCategoryMap.entries()).filter(
      ([cat, total]) => !mapped.has(cat) && total > 0
    );
  }, [expenseByCategoryMap]);

  const categoryFilterMap = useMemo(() => {
    const map = new Map<string, TransactionCategory[]>();
    for (const g of [...INCOME_RECAP_GROUPS, ...EXPENSE_RECAP_GROUPS]) {
      for (const item of g.items) {
        map.set(item.key, item.categories);
      }
    }
    return map;
  }, []);

  const filteredRecapTransactions = useMemo(() => {
    const q = recapSearch.trim().toLowerCase();
    const matchedCats = recapCategory === 'all' ? null : categoryFilterMap.get(recapCategory);
    return approvedMonthTx.filter((tx) => {
      if (recapFlow !== 'all' && tx.type !== recapFlow) return false;
      if (recapMethod !== 'all' && tx.paymentMethod !== recapMethod) return false;
      if (recapCategory !== 'all') {
        if (matchedCats) {
          if (!matchedCats.includes(tx.category)) return false;
        } else if (tx.category !== recapCategory) {
          return false;
        }
      }
      if (q) {
        const hay = `${tx.title} ${tx.residentName} ${tx.houseBlock} ${getCategoryLabel(
          tx.category
        )} ${tx.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [approvedMonthTx, recapSearch, recapCategory, recapMethod, recapFlow, categoryFilterMap]);

  const filteredRecapIncome = useMemo(
    () =>
      filteredRecapTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [filteredRecapTransactions]
  );

  const filteredRecapExpense = useMemo(
    () =>
      filteredRecapTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [filteredRecapTransactions]
  );

  const hasRecapFilters =
    Boolean(recapSearch.trim()) ||
    recapCategory !== 'all' ||
    recapMethod !== 'all' ||
    recapFlow !== 'all';

  const handleResetRecapFilters = () => {
    setRecapSearch('');
    setRecapCategory('all');
    setRecapMethod('all');
    setRecapFlow('all');
  };

  const residentSummaries = useMemo(
    () =>
      residents.map((res) => ({
        resident: res,
        summary: getResidentMonthDuesSummary(res, transactions, selectedMonth),
        coverage: getResidentPaidMonthsCoverage(res, transactions, selectedMonth),
      })),
    [residents, transactions, selectedMonth]
  );

  const paidResidentsCount = useMemo(
    () => residentSummaries.filter((item) => item.summary.status === 'lunas').length,
    [residentSummaries]
  );

  const unpaidResidents = useMemo(
    () =>
      residentSummaries
        .filter((item) => item.summary.status !== 'lunas')
        .map((item) => item.resident),
    [residentSummaries]
  );

  const visibleResidents = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    return residentSummaries.filter(({ resident, summary }) => {
      if (residentFilter === 'lunas' && summary.status !== 'lunas') return false;
      if (residentFilter === 'unpaid' && summary.status === 'lunas') return false;
      if (q) {
        return `${resident.displayName} ${resident.houseBlock}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [residentSummaries, residentFilter, residentSearch]);

  const handleReminders = async () => {
    if (unpaidResidents.length === 0) return;
    setSendingReminders(true);
    setReminderFeedback(null);
    try {
      const sentCount = await onSendPaymentReminders(unpaidResidents, selectedMonth);
      setReminderFeedback(
        `Pengingat iuran ${formatMonthLabel(selectedMonth)} berhasil dikirim ke ${sentCount} warga.`
      );
    } catch {
      setReminderFeedback('Gagal mengirim pengingat pembayaran.');
    } finally {
      setSendingReminders(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-base sm:text-2xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-slate-100">
            Laporan Keuangan Bulanan Otomatis
          </h1>
          <p className="text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            {rtSettings.rtName} · {rtSettings.rwName} · Rekap periode {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 print:hidden">
          <input
            type="month"
            aria-label="Pilih bulan laporan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="col-span-2 sm:w-auto min-h-[42px] sm:min-h-[44px] px-3 sm:px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          />
          <button
            type="button"
            onClick={() =>
              triggerActionClick('csv', () =>
                downloadMonthlyReportCSV(selectedMonth, monthTransactions, rtSettings.rtName)
              )
            }
            className={`col-span-1 sm:w-auto min-h-[42px] sm:min-h-[44px] px-3 sm:px-3.5 rounded-xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
              clickedAction === 'csv'
                ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-emerald-700 dark:hover:bg-emerald-700 hover:border-emerald-700 dark:hover:border-emerald-700 hover:text-white dark:hover:text-white active:bg-emerald-700 dark:active:bg-emerald-700 active:border-emerald-700 dark:active:border-emerald-700 active:text-white dark:active:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() => triggerActionClick('print', () => window.print())}
            className={`col-span-1 sm:w-auto min-h-[42px] sm:min-h-[44px] px-3 sm:px-3.5 rounded-xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
              clickedAction === 'print'
                ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-emerald-700 dark:hover:bg-emerald-700 hover:border-emerald-700 dark:hover:border-emerald-700 hover:text-white dark:hover:text-white active:bg-emerald-700 dark:active:bg-emerald-700 active:border-emerald-700 dark:active:border-emerald-700 active:text-white dark:active:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* 3-Column Monthly KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-6">
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[10.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight truncate">
              Pemasukan Terverifikasi
            </p>
            <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="mt-1 sm:mt-2.5 font-mono-num text-sm sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums leading-tight">
            {formatRupiah(monthIncome)}
          </p>
        </div>
        <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-6">
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[10.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight truncate">
              Pengeluaran Operasional
            </p>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 dark:text-red-400 shrink-0" />
          </div>
          <p className="mt-1 sm:mt-2.5 font-mono-num text-sm sm:text-3xl font-extrabold text-red-600 dark:text-red-400 tabular-nums leading-tight">
            {formatRupiah(monthExpense)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-6 flex items-center justify-between sm:block gap-2">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
            Surplus / Selisih Bulan Ini
          </p>
          <p
            className={`sm:mt-2.5 font-mono-num text-sm sm:text-3xl font-extrabold tabular-nums leading-tight ${
              monthNet >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {monthNet >= 0 ? '+' : ''}
            {formatRupiah(monthNet)}
          </p>
        </div>
      </div>

      {/* Rekap Pemasukan & Pengeluaran (Tabel Interaktif & Filter) */}
      <section className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 space-y-2 sm:space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 sm:gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={recapSearch}
                onChange={(e) => setRecapSearch(e.target.value)}
                placeholder="Cari uraian, warga, atau kategori..."
                aria-label="Cari rekap pemasukan dan pengeluaran"
                className="w-full min-h-[36px] sm:min-h-[42px] pl-9 sm:pl-10 pr-3 sm:pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <DownwardSelect
              value={recapCategory}
              onChange={setRecapCategory}
              ariaLabel="Filter kategori rekap"
              options={[{ value: 'all', label: 'Semua kategori' }]}
              groups={[
                ...INCOME_RECAP_GROUPS.map((group) => ({
                  label: `Pemasukan · ${group.groupLabel}`,
                  options: group.items.map((item) => ({
                    value: item.key,
                    label: item.label,
                  })),
                })),
                ...EXPENSE_RECAP_GROUPS.map((group) => ({
                  label: `Pengeluaran · ${group.groupLabel}`,
                  options: group.items.map((item) => ({
                    value: item.key,
                    label: item.label,
                  })),
                })),
              ]}
              className="w-full lg:w-60 min-h-[36px] sm:min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
            />

            <DownwardSelect
              value={recapMethod}
              onChange={(val) => setRecapMethod(val as 'all' | 'transfer' | 'tunai')}
              ariaLabel="Filter metode pembayaran rekap"
              options={[
                { value: 'all', label: 'Semua metode' },
                { value: 'transfer', label: 'Transfer Bank' },
                { value: 'tunai', label: 'Tunai' },
              ]}
              className="w-full lg:w-44 min-h-[36px] sm:min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
            />

            <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 shrink-0">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'income', label: 'Masuk' },
                  { id: 'expense', label: 'Keluar' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRecapFlow(tab.id)}
                  className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    recapFlow === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {recapFlow === 'income'
                  ? 'Rekap Transaksi Pemasukan'
                  : recapFlow === 'expense'
                  ? 'Rekap Transaksi Pengeluaran'
                  : 'Rekap Transaksi Pengeluaran & Pemasukan'}
              </h2>
              {hasRecapFilters && (
                <button
                  type="button"
                  onClick={handleResetRecapFilters}
                  className="min-h-[28px] sm:min-h-[32px] px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer print:hidden"
                >
                  <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono-num tabular-nums leading-tight">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-semibold">
                {filteredRecapTransactions.length} baris
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                +{formatRupiah(filteredRecapIncome)}
              </span>
              <span className="font-bold text-red-600 dark:text-red-400">
                -{formatRupiah(filteredRecapExpense)}
              </span>
            </div>
          </div>
        </div>

        {filteredRecapTransactions.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Tidak ada transaksi terverifikasi sesuai filter pada bulan {formatMonthLabel(selectedMonth)}.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                    <th className="py-3 pl-6 pr-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-3 px-3 whitespace-nowrap">Jam</th>
                    <th className="py-3 px-3">Uraian</th>
                    <th className="py-3 px-3 whitespace-nowrap">Kategori</th>
                    <th className="py-3 px-3 whitespace-nowrap">Jenis Pembayaran</th>
                    <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredRecapTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 pl-6 pr-3 text-xs text-slate-500 dark:text-slate-400 font-mono-num whitespace-nowrap">
                          {formatTxDate(tx.createdAt)}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-500 dark:text-slate-400 font-mono-num whitespace-nowrap">
                          {formatTxTime(tx.createdAt)}
                        </td>
                        <td className="py-3.5 px-3 min-w-[220px]">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {tx.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {tx.residentName} · {tx.houseBlock}
                            {tx.notes ? ` · ${tx.notes}` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {getCategoryLabel(tx.category)}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {tx.paymentMethod === 'transfer' ? 'Transfer Bank' : 'Tunai'}
                        </td>
                        <td
                          className={`py-3.5 pl-3 pr-6 text-right font-mono-num font-bold tabular-nums whitespace-nowrap ${
                            isIncome
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatRupiah(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecapTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <div key={tx.id} className="px-3 py-2 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {tx.title}
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                          {formatTxDate(tx.createdAt)} · {formatTxTime(tx.createdAt)} ·{' '}
                          {tx.paymentMethod === 'transfer' ? 'Transfer Bank' : 'Tunai'}
                        </p>
                      </div>
                      <p
                        className={`font-mono-num text-xs font-bold tabular-nums shrink-0 leading-tight ${
                          isIncome
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </p>
                    </div>
                    <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-tight">
                      {getCategoryLabel(tx.category)} · {tx.residentName} ({tx.houseBlock})
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Resident Dues Transparency List & Auto Reminder */}
      <section className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <h2 className="text-[13px] sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Status Iuran Warga ({paidResidentsCount}/{residents.length} Lunas)
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {canManageReports && unpaidResidents.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleReminders()}
                  disabled={sendingReminders}
                  className="min-h-[36px] sm:min-h-[44px] px-3 sm:px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-[11px] sm:text-xs inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>
                    {sendingReminders
                      ? 'Mengirim Pengingat...'
                      : `Kirim Pengingat (${unpaidResidents.length} Warga)`}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 print:hidden">
            <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-full sm:w-fit">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'lunas', label: 'Lunas' },
                  { id: 'unpaid', label: 'Belum Lunas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResidentFilter(tab.id)}
                  className={`min-h-[30px] sm:min-h-[38px] px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    residentFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={residentSearch}
                onChange={(e) => setResidentSearch(e.target.value)}
                placeholder="Cari nama atau blok..."
                aria-label="Cari status warga"
                className="w-full min-h-[34px] sm:min-h-[38px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
          </div>

          {reminderFeedback && (
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-emerald-50 dark:bg-emerald-950/40 text-[11px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800 leading-snug">
              {reminderFeedback}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
            {visibleResidents.length === 0 ? (
              <p className="p-6 sm:p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Tidak ada data warga sesuai filter.
              </p>
            ) : (
              visibleResidents.map(({ resident: res, summary, coverage }) => (
                <div
                  key={res.uid}
                  className="px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-snug">
                      {res.displayName}
                    </p>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {res.houseBlock} · {FAMILY_STATUS_LABELS[summary.familyStatus]} · Tarif{' '}
                      <span className="font-mono-num">{formatRupiah(summary.tariff)}</span>
                      {summary.carryOverFromPrev > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {' '}· Saldo lalu {formatRupiah(summary.carryOverFromPrev)}
                        </span>
                      )}
                      {summary.status === 'lunas' &&
                      coverage.streakMonthsCount > 1 &&
                      coverage.streakEndMonth ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {' '}· Lunas {coverage.streakMonthsCount} bln (s.d. {formatMonthLabel(coverage.streakEndMonth)})
                          {coverage.partialCarryOverForNext > 0
                            ? ` + saldo ${formatRupiah(coverage.partialCarryOverForNext)}`
                            : ''}
                        </span>
                      ) : summary.surplus > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {' '}· Lebih +{formatRupiah(summary.surplus)} (ke bln depan)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {summary.status === 'lunas' ? (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span>
                        {coverage.totalPaidMonths > 1
                          ? `Lunas (${coverage.totalPaidMonths} Bln)`
                          : 'Lunas'}
                      </span>
                    </span>
                  ) : summary.status === 'kurang_bayar' ? (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0 leading-tight">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-mono-num">Kurang (-{formatRupiah(summary.shortfall)})</span>
                    </span>
                  ) : summary.status === 'menunggu' ? (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0 leading-tight">
                      <span>Menunggu Verifikasi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 leading-tight">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Belum Bayar</span>
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
    </div>
  );
};
