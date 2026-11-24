import type { FamilyStatus, KasTransaction, ResidentPublic, TransactionCategory } from '../types';

export const TARIFF_BY_FAMILY_STATUS: Record<FamilyStatus, number> = {
  umum: 120000,
  khusus: 60000,
};

export const FAMILY_STATUS_LABELS: Record<FamilyStatus, string> = {
  umum: 'Umum (Suami Istri)',
  khusus: 'Khusus (Ortu Tunggal)',
};

export function getRequiredTariff(familyStatus?: FamilyStatus): number {
  return familyStatus === 'khusus' ? 60000 : 120000;
}

export function isTransactionUnderpaid(
  tx: KasTransaction,
  residentFamilyStatus?: FamilyStatus
): boolean {
  if (tx.status === 'kurang_bayar') return true;
  if (tx.type !== 'income' || tx.category !== 'iuran_bulanan' || tx.status === 'rejected') {
    return false;
  }
  const effectiveStatus = tx.familyStatus || residentFamilyStatus || 'umum';
  return Number(tx.amount || 0) < getRequiredTariff(effectiveStatus);
}

export function getResidentMonthDuesSummary(
  resident: ResidentPublic,
  transactions: KasTransaction[],
  yearMonth: string
): {
  familyStatus: FamilyStatus;
  tariff: number;
  verifiedPaid: number;
  paidThisMonth: number;
  carryOverFromPrev: number;
  pendingPaid: number;
  shortfall: number;
  surplus: number;
  status: 'lunas' | 'kurang_bayar' | 'menunggu' | 'belum_bayar';
} {
  const ledger = calculateResidentLedger(resident, transactions, yearMonth);
  return {
    familyStatus: ledger.familyStatus,
    tariff: ledger.requiredTariff,
    verifiedPaid: ledger.totalEffective,
    paidThisMonth: ledger.paidThisMonth,
    carryOverFromPrev: ledger.carryOverFromPrev,
    pendingPaid: ledger.pendingPaid,
    shortfall: ledger.shortfall,
    surplus: ledger.surplus,
    status: ledger.status,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNominalInput(value: string | number): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseNominalInput(value: string | number): number {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) || 0;
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthLabel(yearMonth: string): string {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Baru saja';
  let date: Date;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    date = new Date(ts);
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    return 'Baru saja';
  }
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export interface TransactionCategoryOption {
  id: TransactionCategory;
  label: string;
}

export interface TransactionCategoryGroup {
  groupLabel: string;
  items: TransactionCategoryOption[];
}

export const TRANSACTION_CATEGORY_GROUPS: Record<'income' | 'expense', TransactionCategoryGroup[]> = {
  income: [
    {
      groupLabel: 'RUTIN · WAJIB',
      items: [{ id: 'iuran_rt', label: 'Iuran RT' }],
    },
    {
      groupLabel: 'RUTIN · TERTENTU/SPESIFIK',
      items: [
        { id: 'iuran_17an_rt', label: 'Iuran 17an RT' },
        { id: 'iuran_17an_rw', label: 'Iuran 17an RW' },
        { id: 'iuran_pkk', label: 'Iuran PKK' },
        { id: 'arisan', label: 'Arisan' },
      ],
    },
    {
      groupLabel: 'NON-RUTIN',
      items: [
        { id: 'bantuan_pemerintah', label: 'Bantuan Pemerintah' },
        { id: 'sumbangan_donasi', label: 'Sumbangan / Donasi' },
        { id: 'hasil_usaha_kemitraan', label: 'Hasil Usaha / Kemitraan' },
        { id: 'pdl_bunga_bank', label: 'Penerimaan Lainnya (PDL): Bunga Bank' },
      ],
    },
  ],
  expense: [
    {
      groupLabel: 'RUTIN · PENGELOLA: PENGURUS RT',
      items: [
        { id: 'kebersihan_lingkungan', label: 'Kebersihan dan Lingkungan' },
        { id: 'keamanan_ketertiban', label: 'Keamanan dan Ketertiban' },
        { id: 'konsumsi', label: 'Konsumsi (Gula, Teh, Kopi)' },
        { id: 'pdam', label: 'PDAM' },
        { id: 'listrik', label: 'Listrik' },
        { id: 'internet', label: 'Internet' },
        { id: 'iuran_rw', label: 'Iuran RW' },
        { id: 'pengeluaran_iuran_17an_rw', label: 'Iuran 17an RW' },
        { id: 'inventaris', label: 'Inventaris' },
        { id: 'fogging', label: 'Fogging' },
      ],
    },
    {
      groupLabel: 'INSIDENTIL · PENGELOLA: PENGURUS RT',
      items: [
        { id: 'perbaikan_joglo', label: 'Perbaikan Joglo' },
        { id: 'pemeliharaan_taman', label: 'Pemeliharaan Taman' },
        { id: 'pemeliharaan_taman_toga', label: 'Pemeliharaan Taman Toga' },
        { id: 'perbaikan_balai_rt', label: 'Perbaikan Balai RT' },
      ],
    },
    {
      groupLabel: 'INSIDENTIL · PENGELOLA: PANITIA/KOORDINATOR',
      items: [
        { id: 'panitia_dasolin', label: 'Dasolin' },
        { id: 'panitia_17an_rt', label: '17an RT' },
        { id: 'panitia_17an_rw', label: '17an RW' },
        { id: 'panitia_pkk', label: 'PKK' },
        { id: 'panitia_arisan', label: 'Arisan' },
      ],
    },
  ],
};

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  // Penerimaan
  iuran_rt: 'Iuran RT',
  iuran_17an_rt: 'Iuran 17an RT',
  iuran_17an_rw: 'Iuran 17an RW',
  iuran_pkk: 'Iuran PKK',
  arisan: 'Arisan',
  bantuan_pemerintah: 'Bantuan Pemerintah',
  sumbangan_donasi: 'Sumbangan / Donasi',
  hasil_usaha_kemitraan: 'Hasil Usaha / Kemitraan',
  pdl_bunga_bank: 'Penerimaan Lainnya (PDL): Bunga Bank',
  // Pengeluaran Rutin
  kebersihan_lingkungan: 'Kebersihan dan Lingkungan',
  keamanan_ketertiban: 'Keamanan dan Ketertiban',
  konsumsi: 'Konsumsi (Gula, Teh, Kopi)',
  pdam: 'PDAM',
  listrik: 'Listrik',
  internet: 'Internet',
  iuran_rw: 'Iuran RW',
  pengeluaran_iuran_17an_rw: 'Iuran 17an RW',
  inventaris: 'Inventaris',
  fogging: 'Fogging',
  // Pengeluaran Insidentil - Pengurus RT
  perbaikan_joglo: 'Perbaikan Joglo',
  pemeliharaan_taman: 'Pemeliharaan Taman',
  pemeliharaan_taman_toga: 'Pemeliharaan Taman Toga',
  perbaikan_balai_rt: 'Perbaikan Balai RT',
  // Pengeluaran Insidentil - Panitia/Koordinator
  panitia_dasolin: 'Dasolin (Panitia)',
  panitia_17an_rt: '17an RT (Panitia)',
  panitia_17an_rw: '17an RW (Panitia)',
  panitia_pkk: 'PKK (Panitia)',
  panitia_arisan: 'Arisan (Panitia)',
  // Legacy
  iuran_bulanan: 'Iuran Bulanan',
  donasi: 'Donasi Warga',
  kebersihan: 'Kebersihan & Sampah',
  keamanan: 'Keamanan & Ronda',
  sosial: 'Dana Sosial',
  perbaikan: 'Perbaikan Fasilitas',
  lainnya: 'Lainnya',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as TransactionCategory] || category;
}

export function downloadMonthlyReportCSV(
  yearMonth: string,
  transactions: KasTransaction[],
  rtName: string
): void {
  const headers = [
    'ID Transaksi',
    'Tanggal',
    'Bulan Tagihan',
    'Jenis',
    'Kategori',
    'Keterangan',
    'Nama Warga',
    'Blok Rumah',
    'Metode',
    'Nominal (IDR)',
    'Status',
  ];

  const rows = transactions.map((tx) => [
    tx.id,
    formatTimestamp(tx.createdAt),
    tx.billingMonth,
    tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    getCategoryLabel(tx.category),
    `"${(tx.title || '').replace(/"/g, '""')}"`,
    `"${(tx.residentName || '').replace(/"/g, '""')}"`,
    `"${(tx.houseBlock || '').replace(/"/g, '""')}"`,
    tx.paymentMethod.toUpperCase(),
    String(tx.amount),
    tx.status === 'approved'
      ? 'Disetujui'
      : tx.status === 'kurang_bayar'
      ? 'Kurang Bayar'
      : tx.status === 'rejected'
      ? 'Ditolak'
      : 'Menunggu',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Laporan-Kas-${rtName.replace(/\s+/g, '-')}-${yearMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const PUSH_ENABLED_STORAGE_KEY = 'kaswarga_push_enabled';

export function isBrowserPushEnabled(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  return window.localStorage.getItem(PUSH_ENABLED_STORAGE_KEY) !== 'false';
}

export function setBrowserPushEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function requestBrowserPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    setBrowserPushEnabled(true);
    return 'granted';
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    setBrowserPushEnabled(true);
  }
  return result;
}

export function sendBrowserPush(title: string, body: string): void {
  if (!isBrowserPushEnabled()) return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });
  } catch {
    // Fallback silently if browser blocks Notification constructor inside iframe
  }
}

export interface MonthlyDuesLedger {
  billingMonth: string;
  familyStatus: FamilyStatus;
  requiredTariff: number;
  carryOverFromPrev: number; // Saldo lebih dari bulan sebelumnya
  paidThisMonth: number;     // Pembayaran terverifikasi di bulan ini
  pendingPaid: number;       // Pembayaran menunggu verifikasi di bulan ini
  totalEffective: number;    // carryOverFromPrev + paidThisMonth
  shortfall: number;         // Kekurangan (0 jika lunas/lebih)
  surplus: number;           // Kelebihan bayar untuk bulan berikutnya
  status: 'lunas' | 'kurang_bayar' | 'menunggu' | 'belum_bayar';
}

export function advanceYearMonth(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  let y = Number(yStr);
  let m = Number(mStr) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function parseFamilyStatusLog(
  log?: string[]
): Array<{ effectiveMonth: string; status: FamilyStatus }> {
  if (!Array.isArray(log)) return [];
  const parsed: Array<{ effectiveMonth: string; status: FamilyStatus }> = [];
  for (const item of log) {
    if (typeof item !== 'string') continue;
    const match = /^(\d{4}-\d{2}):(umum|khusus)$/.exec(item.trim());
    if (match) {
      parsed.push({
        effectiveMonth: match[1],
        status: match[2] as FamilyStatus,
      });
    }
  }
  return parsed.sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
}

export function getResidentFamilyStatusForMonth(
  resident: ResidentPublic,
  yearMonth: string,
  residentTransactions?: KasTransaction[]
): FamilyStatus {
  const entries = parseFamilyStatusLog(resident.familyStatusLog);
  if (entries.length > 0 && /^\d{4}-\d{2}$/.test(yearMonth)) {
    let matched: FamilyStatus | null = null;
    for (const entry of entries) {
      if (entry.effectiveMonth <= yearMonth) {
        matched = entry.status;
      }
    }
    if (matched) return matched;
  }

  // Fallback untuk riwayat lama: kunci berdasarkan snapshot transaksi pada bulan tersebut
  if (residentTransactions && residentTransactions.length > 0) {
    const monthTxWithStatus = residentTransactions.find(
      (t) =>
        t.residentUid === resident.uid &&
        t.type === 'income' &&
        t.category === 'iuran_bulanan' &&
        t.billingMonth === yearMonth &&
        t.status !== 'rejected' &&
        (t.familyStatus === 'umum' || t.familyStatus === 'khusus')
    );
    if (monthTxWithStatus?.familyStatus) {
      return monthTxWithStatus.familyStatus;
    }
  }

  return resident.familyStatus || 'umum';
}

export function getEffectiveFamilyStatusChangeMonth(
  allTransactions: KasTransaction[],
  residentUid: string,
  currentYm: string = getCurrentYearMonth()
): string {
  const hasCurrentMonthPayment = allTransactions.some(
    (t) =>
      t.residentUid === residentUid &&
      t.type === 'income' &&
      t.category === 'iuran_bulanan' &&
      t.billingMonth === currentYm &&
      t.status !== 'rejected'
  );
  return hasCurrentMonthPayment ? advanceYearMonth(currentYm) : currentYm;
}

export function buildUpdatedFamilyStatusLog(
  resident: ResidentPublic,
  nextStatus: FamilyStatus,
  effectiveMonth: string
): string[] {
  const currentEntries = parseFamilyStatusLog(resident.familyStatusLog);
  const previousStatus: FamilyStatus = resident.familyStatus || 'umum';

  const map = new Map<string, FamilyStatus>();
  if (currentEntries.length === 0) {
    map.set('1970-01', previousStatus);
  } else {
    for (const e of currentEntries) {
      map.set(e.effectiveMonth, e.status);
    }
  }
  map.set(effectiveMonth, nextStatus);

  const sorted = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, st]) => `${ym}:${st}`);

  if (sorted.length <= 20) return sorted;
  return [sorted[0], ...sorted.slice(-(20 - 1))];
}

export function calculateResidentLedger(
  resident: ResidentPublic,
  allTransactions: KasTransaction[],
  targetMonth: string // format 'YYYY-MM'
): MonthlyDuesLedger {
  const isValidYm = /^\d{4}-\d{2}$/.test(targetMonth);

  // Filter semua transaksi iuran milik warga ini (kecuali yang ditolak)
  const userTxs = allTransactions.filter(
    (t) =>
      t.residentUid === resident.uid &&
      t.type === 'income' &&
      t.category === 'iuran_bulanan' &&
      t.status !== 'rejected' &&
      /^\d{4}-\d{2}$/.test(t.billingMonth || '')
  );

  const targetFamilyStatus = getResidentFamilyStatusForMonth(resident, targetMonth, userTxs);
  const targetTariff = getRequiredTariff(targetFamilyStatus);

  const defaultLedger: MonthlyDuesLedger = {
    billingMonth: targetMonth,
    familyStatus: targetFamilyStatus,
    requiredTariff: targetTariff,
    carryOverFromPrev: 0,
    paidThisMonth: 0,
    pendingPaid: 0,
    totalEffective: 0,
    shortfall: targetTariff,
    surplus: 0,
    status: 'belum_bayar',
  };

  if (!isValidYm) return defaultLedger;

  let earliestMonth = targetMonth;
  for (const t of userTxs) {
    if (t.billingMonth < earliestMonth) {
      earliestMonth = t.billingMonth;
    }
  }

  let runningSurplus = 0;
  let cursor = earliestMonth;
  let steps = 0;
  const MAX_MONTHS = 240;

  while (cursor <= targetMonth && steps < MAX_MONTHS) {
    const monthFamilyStatus = getResidentFamilyStatusForMonth(resident, cursor, userTxs);
    const tariff = getRequiredTariff(monthFamilyStatus);

    const approvedPaid = userTxs
      .filter(
        (t) =>
          t.billingMonth === cursor &&
          (t.status === 'approved' || t.status === 'kurang_bayar')
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const pendingPaid = userTxs
      .filter((t) => t.billingMonth === cursor && t.status === 'pending')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const carryOver = runningSurplus;
    const totalEffective = carryOver + approvedPaid;
    const shortfall = Math.max(0, tariff - totalEffective);
    const surplus = Math.max(0, totalEffective - tariff);

    if (cursor === targetMonth) {
      let status: MonthlyDuesLedger['status'] = 'belum_bayar';
      if (totalEffective >= tariff) {
        status = 'lunas';
      } else if (pendingPaid > 0) {
        status = totalEffective + pendingPaid >= tariff ? 'menunggu' : 'kurang_bayar';
      } else if (approvedPaid > 0 || carryOver > 0) {
        status = 'kurang_bayar';
      }

      return {
        billingMonth: cursor,
        familyStatus: monthFamilyStatus,
        requiredTariff: tariff,
        carryOverFromPrev: carryOver,
        paidThisMonth: approvedPaid,
        pendingPaid,
        totalEffective,
        shortfall,
        surplus,
        status,
      };
    }

    // Kelebihan bayar otomatis menjadi saldo bulan berikutnya
    runningSurplus = surplus;
    cursor = advanceYearMonth(cursor);
    steps++;
  }

  return defaultLedger;
}

export function addMonthsToYearMonth(yearMonth: string, offset: number): string {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  let result = yearMonth;
  const count = Math.max(0, Math.floor(offset));
  for (let i = 0; i < count; i++) {
    result = advanceYearMonth(result);
  }
  return result;
}

export interface ResidentPaidCoverage {
  referenceMonth: string;
  isReferenceMonthPaid: boolean;
  remainingMonthsFromRef: number;
  streakStartMonth: string | null;
  streakEndMonth: string | null;
  streakMonthsCount: number;
  totalPaidMonths: number;
  paidMonthsInRefYear: number;
  nextUnpaidMonth: string;
  partialCarryOverForNext: number;
}

export function getResidentPaidMonthsCoverage(
  resident: ResidentPublic,
  allTransactions: KasTransaction[],
  referenceMonth: string = getCurrentYearMonth()
): ResidentPaidCoverage {
  const isValidRef = /^\d{4}-\d{2}$/.test(referenceMonth);
  const safeRef = isValidRef ? referenceMonth : getCurrentYearMonth();

  const userTxs = allTransactions.filter(
    (t) =>
      t.residentUid === resident.uid &&
      t.type === 'income' &&
      t.category === 'iuran_bulanan' &&
      t.status !== 'rejected' &&
      /^\d{4}-\d{2}$/.test(t.billingMonth || '')
  );

  if (userTxs.length === 0) {
    return {
      referenceMonth: safeRef,
      isReferenceMonthPaid: false,
      remainingMonthsFromRef: 0,
      streakStartMonth: null,
      streakEndMonth: null,
      streakMonthsCount: 0,
      totalPaidMonths: 0,
      paidMonthsInRefYear: 0,
      nextUnpaidMonth: safeRef,
      partialCarryOverForNext: 0,
    };
  }

  let earliestMonth = safeRef;
  let latestTxMonth = safeRef;
  for (const t of userTxs) {
    if (t.billingMonth < earliestMonth) earliestMonth = t.billingMonth;
    if (t.billingMonth > latestTxMonth) latestTxMonth = t.billingMonth;
  }

  const paidMonths: string[] = [];
  let runningSurplus = 0;
  let cursor = earliestMonth;
  let steps = 0;
  const MAX_MONTHS = 240;
  let firstUnpaidFromRef: string | null = null;
  let partialAtFirstUnpaid = 0;

  while (steps < MAX_MONTHS) {
    const monthFamilyStatus = getResidentFamilyStatusForMonth(resident, cursor, userTxs);
    const tariff = getRequiredTariff(monthFamilyStatus);

    const approvedPaid = userTxs
      .filter(
        (t) =>
          t.billingMonth === cursor &&
          (t.status === 'approved' || t.status === 'kurang_bayar')
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalEffective = runningSurplus + approvedPaid;

    if (totalEffective >= tariff) {
      paidMonths.push(cursor);
      runningSurplus = totalEffective - tariff;
    } else {
      if (cursor >= safeRef && firstUnpaidFromRef === null) {
        firstUnpaidFromRef = cursor;
        partialAtFirstUnpaid = totalEffective;
      }
      runningSurplus = 0;
      if (cursor >= safeRef && cursor >= latestTxMonth) {
        break;
      }
    }

    cursor = advanceYearMonth(cursor);
    steps++;
  }

  if (firstUnpaidFromRef === null) {
    firstUnpaidFromRef = cursor;
    partialAtFirstUnpaid = runningSurplus;
  }

  const refIdx = paidMonths.indexOf(safeRef);
  const isReferenceMonthPaid = refIdx !== -1;

  let streakStartMonth: string | null = null;
  let streakEndMonth: string | null = null;
  let streakMonthsCount = 0;
  let remainingMonthsFromRef = 0;

  if (isReferenceMonthPaid) {
    let startIdx = refIdx;
    while (
      startIdx > 0 &&
      advanceYearMonth(paidMonths[startIdx - 1]) === paidMonths[startIdx]
    ) {
      startIdx--;
    }
    let endIdx = refIdx;
    while (
      endIdx < paidMonths.length - 1 &&
      advanceYearMonth(paidMonths[endIdx]) === paidMonths[endIdx + 1]
    ) {
      endIdx++;
    }
    streakStartMonth = paidMonths[startIdx];
    streakEndMonth = paidMonths[endIdx];
    streakMonthsCount = endIdx - startIdx + 1;
    remainingMonthsFromRef = endIdx - refIdx + 1;
  }

  const refYearPrefix = `${safeRef.slice(0, 4)}-`;
  const paidMonthsInRefYear = paidMonths.filter((m) => m.startsWith(refYearPrefix)).length;

  return {
    referenceMonth: safeRef,
    isReferenceMonthPaid,
    remainingMonthsFromRef,
    streakStartMonth,
    streakEndMonth,
    streakMonthsCount,
    totalPaidMonths: paidMonths.length,
    paidMonthsInRefYear,
    nextUnpaidMonth: firstUnpaidFromRef,
    partialCarryOverForNext: partialAtFirstUnpaid,
  };
}

export function calculatePeriodDuesTarget(
  resident: ResidentPublic,
  allTransactions: KasTransaction[],
  startMonth: string,
  periodMonths: number
): {
  totalAmount: number;
  endMonth: string;
  hasAlreadyPaidMonths: boolean;
  fullRateTotal: number;
} {
  const safePeriod = Math.max(1, Math.min(12, Math.round(periodMonths || 1)));
  const safeStart = /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : getCurrentYearMonth();
  const endMonth = addMonthsToYearMonth(safeStart, safePeriod - 1);

  const userTxs = allTransactions.filter(
    (t) =>
      t.residentUid === resident.uid &&
      t.type === 'income' &&
      t.category === 'iuran_bulanan' &&
      t.status !== 'rejected' &&
      /^\d{4}-\d{2}$/.test(t.billingMonth || '')
  );

  const startLedger = calculateResidentLedger(resident, allTransactions, safeStart);
  let carry = startLedger.carryOverFromPrev;
  let totalShortfall = 0;
  let fullRateTotal = 0;
  let alreadyPaidMonthsCount = 0;
  let cursor = safeStart;

  for (let i = 0; i < safePeriod; i++) {
    const fam = getResidentFamilyStatusForMonth(resident, cursor, userTxs);
    const tariff = getRequiredTariff(fam);
    fullRateTotal += tariff;

    const approvedInMonth = userTxs
      .filter(
        (t) =>
          t.billingMonth === cursor &&
          (t.status === 'approved' || t.status === 'kurang_bayar')
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const available = carry + approvedInMonth;
    if (available >= tariff) {
      alreadyPaidMonthsCount++;
      carry = available - tariff;
    } else {
      totalShortfall += tariff - available;
      carry = 0;
    }

    cursor = advanceYearMonth(cursor);
  }

  return {
    totalAmount: totalShortfall > 0 ? totalShortfall : fullRateTotal,
    endMonth,
    hasAlreadyPaidMonths: alreadyPaidMonthsCount > 0,
    fullRateTotal,
  };
}

export function previewPaymentPeriodCoverage(
  resident: ResidentPublic,
  otherTransactions: KasTransaction[],
  startMonth: string,
  paymentAmount: number
): {
  coveredCount: number;
  startMonth: string;
  endMonth: string | null;
  remainderForNextMonth: number;
  shortfallInStartMonth: number;
} {
  const safeStart = /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : getCurrentYearMonth();
  const amt = Math.max(0, Number(paymentAmount) || 0);

  const userTxs = otherTransactions.filter(
    (t) =>
      t.residentUid === resident.uid &&
      t.type === 'income' &&
      t.category === 'iuran_bulanan' &&
      t.status !== 'rejected' &&
      /^\d{4}-\d{2}$/.test(t.billingMonth || '')
  );

  const startLedger = calculateResidentLedger(resident, otherTransactions, safeStart);
  let carry = startLedger.carryOverFromPrev + amt;
  let cursor = safeStart;
  let coveredCount = 0;
  let endMonth: string | null = null;
  let remainderForNextMonth = 0;
  let shortfallInStartMonth = 0;

  for (let i = 0; i < 60; i++) {
    const fam = getResidentFamilyStatusForMonth(resident, cursor, userTxs);
    const tariff = getRequiredTariff(fam);
    const approvedInMonth = userTxs
      .filter(
        (t) =>
          t.billingMonth === cursor &&
          (t.status === 'approved' || t.status === 'kurang_bayar')
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const available = carry + approvedInMonth;
    if (available >= tariff) {
      coveredCount++;
      endMonth = cursor;
      carry = available - tariff;
    } else {
      if (i === 0) {
        shortfallInStartMonth = tariff - available;
      } else {
        remainderForNextMonth = available;
      }
      break;
    }
    cursor = advanceYearMonth(cursor);
  }

  return {
    coveredCount,
    startMonth: safeStart,
    endMonth,
    remainderForNextMonth,
    shortfallInStartMonth,
  };
}