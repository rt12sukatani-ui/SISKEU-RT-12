import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileBarChart2,
  Megaphone,
  ShieldCheck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type {
  Announcement,
  AppTab,
  EmergencyAlert,
  KasTransaction,
  RbacContext,
  ResidentPublic,
  ResidentRegistryEntry,
  RtSettings,
} from '../types';
import {
  calculateResidentLedger,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatRupiah,
  formatTimestamp,
  getCategoryLabel,
  getCurrentYearMonth,
  getResidentMonthDuesSummary,
  getResidentPaidMonthsCoverage,
  previewPaymentPeriodCoverage,
} from '../utils/format';

interface DashboardViewProps {
  profile: ResidentPublic;
  rbac: RbacContext;
  rtSettings: RtSettings;
  transactions: KasTransaction[];
  residents: ResidentPublic[];
  registryEntries?: ResidentRegistryEntry[];
  announcements: Announcement[];
  emergencies: EmergencyAlert[];
  onNavigate: (tab: AppTab) => void;
  onOpenTutorial: () => void;
  onQuickPayDues: () => void;
  onViewMyDues?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  rbac,
  rtSettings,
  transactions,
  residents,
  registryEntries = [],
  announcements,
  emergencies,
  onNavigate,
  onOpenTutorial,
  onQuickPayDues,
  onViewMyDues,
}) => {
  const [copiedBank, setCopiedBank] = useState(false);
  const [clickedAction, setClickedAction] = useState<'dues' | 'tutorial' | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [calendarCursor, setCalendarCursor] = useState<{ year: number; month: number }>(() => {
    const initial = new Date();
    return { year: initial.getFullYear(), month: initial.getMonth() };
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      window.clearInterval(timer);
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  const triggerActionClick = (key: 'dues' | 'tutorial', callback: () => void) => {
    setClickedAction(key);
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setClickedAction(null);
    }, 450);
    callback();
  };

  const isPengurus = rbac.isPengurus;
  const loginRoleLabel = rbac.positionLabel;

  const currentMonth = getCurrentYearMonth();
  const approvedTx = transactions.filter(
    (t) => t.status === 'approved' || t.status === 'kurang_bayar'
  );
  const allApprovedIncome = approvedTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const allApprovedExpense = approvedTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netBalance = allApprovedIncome - allApprovedExpense;

  // Pemasukan, Iuran Bulanan, dan Pengeluaran khusus bulan berjalan
  const currentMonthApprovedTx = approvedTx.filter(
    (t) => t.billingMonth === currentMonth
  );
  const totalMonthlyDues = currentMonthApprovedTx
    .filter((t) => t.type === 'income' && t.category === 'iuran_bulanan')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalIncome = currentMonthApprovedTx
    .filter((t) => t.type === 'income' && t.category !== 'iuran_bulanan')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpense = currentMonthApprovedTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const pendingVerificationCount = transactions.filter((t) => t.status === 'pending').length;

  const formattedTodayDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTodayTime = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const calendarMonthDate = new Date(calendarCursor.year, calendarCursor.month, 1);
  const calendarMonthLabel = calendarMonthDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
  const leadingEmptyDays = (calendarMonthDate.getDay() + 6) % 7;
  const daysInCalendarMonth = new Date(
    calendarCursor.year,
    calendarCursor.month + 1,
    0
  ).getDate();
  const isViewingCurrentMonth =
    calendarCursor.year === now.getFullYear() &&
    calendarCursor.month === now.getMonth();

  const myDuesSummary = getResidentMonthDuesSummary(profile, transactions, currentMonth);
  const myPaidCoverage = getResidentPaidMonthsCoverage(profile, transactions, currentMonth);
  const isMyDuesSettled =
    myDuesSummary.status === 'lunas' || myPaidCoverage.isReferenceMonthPaid;
  const myPendingPreview =
    myDuesSummary.status === 'menunggu'
      ? previewPaymentPeriodCoverage(
          profile,
          transactions,
          currentMonth,
          myDuesSummary.pendingPaid
        )
      : null;
  const myFamilyLabel = FAMILY_STATUS_LABELS[myDuesSummary.familyStatus];

  const residentMap = new Map(residents.map((r) => [r.uid, r]));
  const paidResidentsCount = (() => {
    const paidUids = new Set<string>();
    for (const r of residents) {
      const summary = getResidentMonthDuesSummary(r, transactions, currentMonth);
      if (summary.status === 'lunas' || summary.paidThisMonth > 0) {
        paidUids.add(r.uid);
      }
    }
    for (const t of currentMonthApprovedTx) {
      if (t.type === 'income' && t.category === 'iuran_bulanan' && t.residentUid) {
        paidUids.add(t.residentUid);
      }
    }
    return paidUids.size;
  })();
  const totalResidentsCount =
    registryEntries.length > 0 ? registryEntries.length : residents.length;
  const lunasResidentsCount = residents.filter(
    (r) => getResidentMonthDuesSummary(r, transactions, currentMonth).status === 'lunas'
  ).length;
  const paymentProgressPct =
    totalResidentsCount > 0
      ? Math.min(100, Math.round((lunasResidentsCount / totalResidentsCount) * 100))
      : 0;

  const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved');
  const recentTx = transactions.slice(0, 5);
  const latestAnnouncements = announcements.slice(0, 3);

  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (paymentProgressPct / 100) * ringCircumference;

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

  const handlePrevCalendarMonth = () => {
    setCalendarCursor((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  };

  const handleNextCalendarMonth = () => {
    setCalendarCursor((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  };

  const handleResetCalendarToday = () => {
    const today = new Date();
    setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Top Account Role + Today Date & Live Clock Strip */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {rtSettings.rtName}/{rtSettings.rwName} · {rtSettings.kelurahan}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 text-[11px] sm:text-sm leading-tight">
          <div className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="capitalize">{formattedTodayDate}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono-num text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{formattedTodayTime}</span>
          </div>
        </div>
      </div>

      {/* Active Emergency Banner if any */}
      {activeEmergencies.length > 0 && (
        <div className="rounded-2xl bg-red-600 text-white p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shadow-sm">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold">
                {activeEmergencies.length} Sinyal Darurat Aktif di Lingkungan
              </h2>
              <p className="text-[11px] sm:text-sm text-red-100 mt-0.5 leading-relaxed">
                {activeEmergencies[0].reporterName} ({activeEmergencies[0].houseBlock}) ·{' '}
                {activeEmergencies[0].emergencyType.toUpperCase()} —{' '}
                {activeEmergencies[0].description || 'Membutuhkan bantuan segera'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dominant Visual Anchor: Architectural Emerald Treasury + Resident Dues Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 items-stretch">
        <section className="lg:col-span-7 relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 dark:from-emerald-950 dark:via-emerald-900 dark:to-slate-900 text-white p-3.5 sm:p-7 flex flex-col justify-between border border-emerald-700/70 dark:border-emerald-800">
          <div className="flex items-start justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0">
              <p className="mt-0.5 sm:mt-4 text-[11px] sm:text-sm font-medium text-emerald-100 leading-tight">Total Saldo Kas RT</p>
              <p className="mt-0.5 sm:mt-1 font-mono-num text-xl sm:text-[2.4rem] font-extrabold tracking-tight leading-none tabular-nums break-words">
                {formatRupiah(netBalance)}
              </p>
            </div>

            {/* SVG Circular Collection Progress Meter */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="relative w-13 h-13 sm:w-16 sm:h-16 flex items-center justify-center">
                <svg className="w-13 h-13 sm:w-16 sm:h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="#6ee7b7"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute font-mono-num text-[11px] sm:text-xs font-bold text-white tabular-nums">
                  {paymentProgressPct}%
                </span>
              </div>
              <span className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-medium text-emerald-200 whitespace-nowrap leading-tight">
                Lunas Bulan Ini
              </span>
            </div>
          </div>

          <div className="mt-3 sm:mt-8 pt-3 sm:pt-5 border-t border-white/15">
            <span className="block mb-1.5 sm:mb-3 text-[11px] sm:text-sm font-semibold text-white leading-tight">Total:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 sm:gap-4">
            <div>
            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-emerald-200 leading-tight">
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">
                {`Iuran RT ${new Date(`${currentMonth}-01`)
                  .toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                  .toUpperCase()}`}
              </span>
            </div>
              <p className="mt-0.5 sm:mt-1 font-mono-num text-xs sm:text-sm font-bold tabular-nums leading-tight">
                {formatRupiah(totalMonthlyDues)}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-end sm:justify-start gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-emerald-200 leading-tight">
                <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-emerald-400" />
                <span className="truncate">Pemasukan Lain</span>
              </div>
              <p className="mt-0.5 sm:mt-1 font-mono-num text-xs sm:text-sm font-bold tabular-nums text-right sm:text-left leading-tight">
                {formatRupiah(totalIncome)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-emerald-200 leading-tight">
                <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-red-400" />
                <span className="truncate">Pengeluaran</span>
              </div>
              <p className="mt-0.5 sm:mt-1 font-mono-num text-xs sm:text-sm font-bold tabular-nums text-red-600 dark:text-red-400 leading-tight">
                {formatRupiah(totalExpense)}
              </p>
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-emerald-200 text-right leading-tight">Partisipasi</p>
              <p className="mt-0.5 sm:mt-1 font-mono-num text-xs sm:text-sm font-bold tabular-nums text-right leading-tight">
                {paidResidentsCount}/{totalResidentsCount} KK
              </p>
            </div>
            </div>
          </div>
        </section>

        {/* Resident Monthly Dues Reminder & Quick Action */}
        <section className="lg:col-span-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
              <span className="font-semibold">
                Iuran {formatMonthLabel(currentMonth)}
              </span>
            </div>
            <div className="mt-0.5 sm:mt-1.5 flex items-center justify-between gap-2 sm:gap-3">
              <h2 className="text-[15px] sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight min-w-0 truncate">
                {profile.displayName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border shrink-0 leading-tight ${
                  isPengurus
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                }`}
              >
                {isPengurus ? (
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                ) : (
                  <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                )}
                <span>{loginRoleLabel}</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
              <span className="font-medium">{profile.houseBlock}</span>
              <span className="font-medium shrink-0 text-right">
                {myFamilyLabel}
              </span>
            </div>

            {myDuesSummary.status === 'lunas' ? (
              <div className="mt-2.5 sm:mt-4 flex items-start gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-2.5 sm:p-4">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 leading-snug">
                    {myPaidCoverage.streakMonthsCount > 1
                      ? `Iuran Lunas  ${myPaidCoverage.streakMonthsCount} Bulan Terbayar`
                      : `Iuran Bulan Ini Sudah Lunas (${myPaidCoverage.totalPaidMonths} Bulan Terbayar)`}
                  </p>
                  <p className="text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300 mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                    {myPaidCoverage.streakMonthsCount > 1 &&
                    myPaidCoverage.streakStartMonth &&
                    myPaidCoverage.streakEndMonth ? (
                      <>
                        Periode lunas:{' '}
                        <strong>
                          {formatMonthLabel(myPaidCoverage.streakStartMonth)} –{' '}
                          {formatMonthLabel(myPaidCoverage.streakEndMonth)}
                        </strong>{' '}
                        ({myPaidCoverage.remainingMonthsFromRef} bulan mulai bulan ini
                        {myPaidCoverage.totalPaidMonths > myPaidCoverage.streakMonthsCount
                          ? `, total ${myPaidCoverage.totalPaidMonths} bulan terbayar`
                          : ''}
                        ).{' '}
                        {myPaidCoverage.partialCarryOverForNext > 0
                          ? `Sisa saldo ${formatRupiah(myPaidCoverage.partialCarryOverForNext)} masuk ke ${formatMonthLabel(myPaidCoverage.nextUnpaidMonth)}.`
                          : 'Terima kasih atas partisipasi Anda.'}
                      </>
                    ) : (
                      <>
                        Terverifikasi {formatRupiah(myDuesSummary.verifiedPaid)} dari tarif{' '}
                        {formatRupiah(myDuesSummary.tariff)}
                        {myDuesSummary.carryOverFromPrev > 0
                          ? ` (termasuk saldo bulan lalu ${formatRupiah(myDuesSummary.carryOverFromPrev)})`
                          : ''}
                        .{' '}
                        {myPaidCoverage.partialCarryOverForNext > 0
                          ? `Sisa saldo ${formatRupiah(myPaidCoverage.partialCarryOverForNext)} otomatis menjadi saldo ${formatMonthLabel(myPaidCoverage.nextUnpaidMonth)}.`
                          : 'Terima kasih atas partisipasi Anda.'}
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : myDuesSummary.status === 'kurang_bayar' ? (
              <div className="mt-2.5 sm:mt-4 flex items-start gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-2.5 sm:p-4">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 leading-snug">
                    Status Pembayaran: Kurang Bayar
                  </p>
                  <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                    Tarif {formatRupiah(myDuesSummary.tariff)}
                    {myDuesSummary.carryOverFromPrev > 0
                      ? ` (terpotong saldo bulan lalu ${formatRupiah(myDuesSummary.carryOverFromPrev)})`
                      : ''}
                    . Sisa kekurangan sebesar{' '}
                    <strong className="font-mono-num">{formatRupiah(myDuesSummary.shortfall)}</strong>.
                  </p>
                </div>
              </div>
            ) : myDuesSummary.status === 'menunggu' ? (
              <div className="mt-2.5 sm:mt-4 flex items-start gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-2.5 sm:p-4">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 leading-snug">
                    Menunggu Verifikasi Admin
                  </p>
                  <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                    Bukti pembayaran {formatRupiah(myDuesSummary.pendingPaid)}
                    {myPendingPreview && myPendingPreview.coveredCount > 1 && myPendingPreview.endMonth
                      ? ` (periode ${myPendingPreview.coveredCount} bulan: ${formatMonthLabel(currentMonth)} – ${formatMonthLabel(myPendingPreview.endMonth)})`
                      : ''}{' '}
                    sedang diperiksa bendahara RT secara real-time.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-2.5 sm:p-4 space-y-1 sm:space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Tagihan Bulan Ini
                  </p>
                  <span className="font-mono-num text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums leading-tight">
                    {formatRupiah(myDuesSummary.tariff)}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-snug sm:leading-relaxed">
                  Jatuh tempo setiap tanggal {rtSettings.dueDayOfMonth} 
                  <br />
                  Transfer ke{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rtSettings.bankName || 'Kas RT'} {rtSettings.bankAccountNumber || ''} an. {rtSettings.bankAccountHolder}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() =>
                triggerActionClick(
                  'dues',
                  isMyDuesSettled
                    ? onViewMyDues || (() => onNavigate('kas'))
                    : onQuickPayDues
                )
              }
              className={`flex-1 min-h-[42px] sm:min-h-[48px] px-3 sm:px-4 rounded-xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
                clickedAction === 'dues'
                  ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-emerald-700 dark:hover:bg-emerald-700 hover:border-emerald-700 dark:hover:border-emerald-700 hover:text-white dark:hover:text-white active:bg-emerald-700 dark:active:bg-emerald-700 active:border-emerald-700 dark:active:border-emerald-700 active:text-white dark:active:text-white'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                {isMyDuesSettled
                  ? 'Lihat Iuran Saya'
                  : myDuesSummary.status === 'kurang_bayar'
                  ? 'Lunasi Kekurangan'
                  : 'Bayar Iuran'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => triggerActionClick('tutorial', onOpenTutorial)}
              className={`shrink-0 min-h-[42px] sm:min-h-[48px] px-3.5 sm:px-4 rounded-xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
                clickedAction === 'tutorial'
                  ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-emerald-700 dark:hover:bg-emerald-700 hover:border-emerald-700 dark:hover:border-emerald-700 hover:text-white dark:hover:text-white active:bg-emerald-700 dark:active:bg-emerald-700 active:border-emerald-700 dark:active:border-emerald-700 active:text-white dark:active:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Panduan</span>
            </button>
          </div>
        </section>
      </div>

      {/* Elderly-Friendly Quick Menu Grid */}
      <section aria-label="Menu Cepat">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-1.5 sm:mb-3">
          <h2 className="text-[13px] sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
            Menu Cepat
          </h2>
          {rbac.canManageKas && pendingVerificationCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('kas')}
              className="min-h-[30px] sm:min-h-[36px] px-2 sm:px-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10.5px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 inline-flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{pendingVerificationCount} bukti menunggu verifikasi</span>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-4 items-stretch">
          {/* Unified Horizontal Pengumuman Card */}
          <button
            type="button"
            onClick={() => onNavigate('pengumuman')}
            className="lg:col-span-7 group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex items-center justify-between gap-2.5 sm:gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 leading-tight">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Pengumuman
                  </h2>
                  {latestAnnouncements[0] && (
                    <span
                      className={`text-[10px] sm:text-[11px] ${
                        latestAnnouncements[0].priority === 'urgent'
                          ? 'font-bold text-red-600 dark:text-red-400'
                          : 'font-semibold text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      · {latestAnnouncements[0].priority === 'urgent' ? 'Mendesak' : 'Info Warga'} ·{' '}
                      {formatTimestamp(latestAnnouncements[0].createdAt)}
                    </span>
                  )}
                </div>

                {latestAnnouncements.length === 0 ? (
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-snug">
                    Tidak ada pengumuman.
                  </p>
                ) : (
                  <>
                    <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">
                      {latestAnnouncements[0].title}
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">
                      {latestAnnouncements[0].body}
                    </p>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Laporan Kas Quick Card */}
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="lg:col-span-5 group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex items-center justify-between gap-2.5 sm:gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <FileBarChart2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                  Laporan Kas
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-snug">
                  Rekap pemasukan, pengeluaran &amp; status iuran bulanan
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 transition-colors" />
          </button>
        </div>
      </section>

      {/* Two-Column Recent Activity & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        <section className="lg:col-span-7 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-3 sm:px-6 py-2 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-[13px] sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Mutasi Kas Terbaru
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('kas')}
              className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[32px] sm:min-h-[44px] inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTx.length === 0 ? (
              <div className="p-6 sm:p-8 text-center space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Belum ada transaksi kas tercatat bulan ini.
                </p>
              </div>
            ) : (
              recentTx.map((tx) => {
                const isIncome = tx.type === 'income';
                const isMonthlyDues = isIncome && tx.category === 'iuran_bulanan';
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
                const txLedger = isMonthlyDues
                  ? calculateResidentLedger(effectiveResident, transactions, tx.billingMonth)
                  : null;
                const isSettledMonth = Boolean(txLedger && txLedger.status === 'lunas');
                const underpaid =
                  isMonthlyDues &&
                  tx.status !== 'rejected' &&
                  !isSettledMonth &&
                  (txLedger?.status === 'kurang_bayar' || tx.status === 'kurang_bayar');
                return (
                  <div
                    key={tx.id}
                    className="px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-snug">
                          {tx.title}
                        </p>
                        <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-tight">
                          {tx.residentName} · {tx.houseBlock} · {getCategoryLabel(tx.category)} ·{' '}
                          {tx.status === 'rejected'
                            ? 'Ditolak'
                            : tx.status === 'pending'
                            ? 'Menunggu'
                            : isMonthlyDues
                            ? isSettledMonth
                              ? 'Lunas'
                              : underpaid
                              ? 'Kurang Bayar'
                              : 'Terverifikasi'
                            : 'Terverifikasi'}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-mono-num text-xs sm:text-sm font-bold tabular-nums shrink-0 ${
                        isIncome
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatRupiah(tx.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="lg:col-span-5 space-y-3 sm:space-y-6">
          {/* Today's Calendar & Live Time Card */}
          <section
            aria-label="Kalender dan Waktu Hari Ini"
            className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-3 sm:px-6 py-2 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[13px] sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2 leading-tight">
                  <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Kalender & Waktu</span>
                </h2>
                <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize truncate leading-tight">
                  {formattedTodayDate} · <span className="font-mono-num font-semibold">{formattedTodayTime}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isViewingCurrentMonth && (
                  <button
                    type="button"
                    onClick={handleResetCalendarToday}
                    className="min-h-[30px] sm:min-h-[36px] px-2 sm:px-2.5 rounded-lg text-[10.5px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                  >
                    Hari Ini
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrevCalendarMonth}
                  aria-label="Bulan sebelumnya"
                  className="min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextCalendarMonth}
                  aria-label="Bulan berikutnya"
                  className="min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5">
              <p className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 capitalize mb-2 sm:mb-3 leading-tight">
                {calendarMonthLabel}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1 sm:mb-1.5">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                  <div key={day} className="py-0.5 sm:py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-xs">
                {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-7 sm:h-8" />
                ))}
                {Array.from({ length: daysInCalendarMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isToday =
                    isViewingCurrentMonth && dayNum === now.getDate();
                  const isDueDay = dayNum === rtSettings.dueDayOfMonth;
                  return (
                    <div
                      key={dayNum}
                      title={
                        isToday
                          ? 'Hari Ini'
                          : isDueDay
                          ? `Jatuh tempo iuran RT (tgl ${rtSettings.dueDayOfMonth})`
                          : undefined
                      }
                      className={`h-7 sm:h-8 rounded-lg flex flex-col items-center justify-center font-mono-num tabular-nums relative ${
                        isToday
                          ? 'bg-emerald-700 text-white font-extrabold shadow-xs'
                          : isDueDay
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/70'
                          : 'text-slate-700 dark:text-slate-300 font-medium'
                      }`}
                    >
                      <span>{dayNum}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700 inline-block" />
                  Hari ini
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-200 dark:bg-amber-800 inline-block" />
                  Jatuh tempo
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
