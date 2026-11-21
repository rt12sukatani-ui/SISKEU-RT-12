import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Database,
  Download,
  Printer,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import type { KasTransaction, ResidentPublic, RtSettings, TransactionCategory } from '../types';
import {
  CATEGORY_LABELS,
  downloadMonthlyReportCSV,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatRupiah,
  getCurrentYearMonth,
  getResidentMonthDuesSummary,
} from '../utils/format';

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
  const [residentFilter, setResidentFilter] = useState<'all' | 'lunas' | 'unpaid'>('all');
  const [residentSearch, setResidentSearch] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

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

  const expenseBreakdown = useMemo(() => {
    const map = new Map<TransactionCategory, number>();
    for (const tx of approvedMonthTx) {
      if (tx.type === 'expense') {
        map.set(tx.category, (map.get(tx.category) || 0) + Number(tx.amount || 0));
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [approvedMonthTx]);

  const residentSummaries = useMemo(
    () =>
      residents.map((res) => ({
        resident: res,
        summary: getResidentMonthDuesSummary(res, transactions, selectedMonth),
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Laporan Keuangan Bulanan Otomatis
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {rtSettings.rtName} · {rtSettings.rwName} · Rekap periode {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <input
            type="month"
            aria-label="Pilih bulan laporan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => downloadMonthlyReportCSV(selectedMonth, monthTransactions, rtSettings.rtName)}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* 3-Column Monthly KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pemasukan Terverifikasi
            </p>
            <ArrowDownLeft className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2.5 font-mono-num text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatRupiah(monthIncome)}
          </p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pengeluaran Operasional
            </p>
            <ArrowUpRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="mt-2.5 font-mono-num text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatRupiah(monthExpense)}
          </p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Surplus / Selisih Bulan Ini
          </p>
          <p
            className={`mt-2.5 font-mono-num text-2xl sm:text-3xl font-extrabold tabular-nums ${
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Expense Breakdown */}
        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Rincian Pengeluaran per Pos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Distribusi penggunaan dana kas RT bulan {formatMonthLabel(selectedMonth)}
          </p>

          <div className="mt-5 space-y-4">
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                Belum ada pengeluaran tercatat pada bulan ini.
              </p>
            ) : (
              expenseBreakdown.map(([cat, total]) => {
                const pct = monthExpense > 0 ? Math.round((total / monthExpense) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatRupiah(total)} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 dark:bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Resident Dues Transparency List & Auto Reminder */}
        <section className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Status Iuran Warga ({paidResidentsCount}/{residents.length} Lunas)
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {canManageResidents && onOpenResidentRegistry && (
                <button
                  type="button"
                  onClick={onOpenResidentRegistry}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Database Warga</span>
                </button>
              )}
              {canManageReports && unpaidResidents.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleReminders()}
                  disabled={sendingReminders}
                  className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>
                    {sendingReminders
                      ? 'Mengirim Pengingat...'
                      : `Kirim Pengingat (${unpaidResidents.length} Warga)`}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit">
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
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
                className="w-full min-h-[38px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
          </div>

          {reminderFeedback && (
            <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800">
              {reminderFeedback}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
            {visibleResidents.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Tidak ada data warga sesuai filter.
              </p>
            ) : (
              visibleResidents.map(({ resident: res, summary }) => (
                <div
                  key={res.uid}
                  className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {res.displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {res.houseBlock} · {FAMILY_STATUS_LABELS[summary.familyStatus]} · Tarif{' '}
                      <span className="font-mono-num">{formatRupiah(summary.tariff)}</span>
                      {summary.carryOverFromPrev > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {' '}· Saldo lalu {formatRupiah(summary.carryOverFromPrev)}
                        </span>
                      )}
                      {summary.surplus > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {' '}· Lebih +{formatRupiah(summary.surplus)} (ke bln depan)
                        </span>
                      )}
                    </p>
                  </div>
                  {summary.status === 'lunas' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lunas</span>
                    </span>
                  ) : summary.status === 'kurang_bayar' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
                      <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-mono-num">Kurang (-{formatRupiah(summary.shortfall)})</span>
                    </span>
                  ) : summary.status === 'menunggu' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                      <span>Menunggu Verifikasi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Belum Bayar</span>
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
