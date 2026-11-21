import type {
  AdminRoleRecord,
  Announcement,
  AnnouncementCategory,
  BannerSlide,
  EmergencyAlert,
  EmergencyStatus,
  EmergencyType,
  FamilyStatus,
  KasTransaction,
  LoginRole,
  NotificationType,
  PaymentMethod,
  PengurusPosition,
  PrivateDataRecord,
  RbacPermission,
  ResidentPublic,
  ResidentRegistryEntry,
  ResidentStatus,
  RtSettings,
  SheetConnection,
  SheetDbInfo,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  UserAccountLookup,
  UserNotification,
  VerificationStatus,
} from '../types';

export const DEFAULT_SPREADSHEET_TITLE = 'DATABASE_SISKEU_RT12_RW20';
export const BUILTIN_SHEETS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbz6JnE9qNRo65i0Zn-Zt9YYE_ZdTE7j9wwxJweXgftxd3z58Qe-pXKHAk1ktToKQ_Z1/exec';
const LEGACY_SPREADSHEET_TITLE = 'SISKEU_RT12_RW20_DATABASE';
const SAVED_SPREADSHEET_ID_KEY = 'siskeu_rt12_spreadsheet_id_v1';
const SAVED_WEBAPP_URL_KEY = 'siskeu_rt12_webapp_url_v1';
const SAVED_VERIFIED_SESSION_KEY = 'siskeu_rt12_verified_session_v1';
const CHUNK_SIZE = 45000;

export const SHEET_TABS = {
  SETTINGS: 'pengaturan',
  RESIDENT_REGISTRY: 'database_warga',
  USER_ACCOUNTS: 'akun_pengguna',
  USERS: 'profil_warga',
  ADMINS: 'pengurus_admin',
  PRIVATE_DATA: 'data_pribadi',
  TRANSACTIONS: 'transaksi_kas',
  ANNOUNCEMENTS: 'pengumuman',
  EMERGENCIES: 'darurat_sos',
  NOTIFICATIONS: 'notifikasi',
  SLIDES: 'foto_kegiatan',
} as const;

export type SheetTabName = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

const LEGACY_TAB_TO_INDONESIAN: Record<string, SheetTabName> = {
  settings: SHEET_TABS.SETTINGS,
  resident_registry: SHEET_TABS.RESIDENT_REGISTRY,
  user_accounts: SHEET_TABS.USER_ACCOUNTS,
  users: SHEET_TABS.USERS,
  admins: SHEET_TABS.ADMINS,
  private_data: SHEET_TABS.PRIVATE_DATA,
  transactions: SHEET_TABS.TRANSACTIONS,
  announcements: SHEET_TABS.ANNOUNCEMENTS,
  emergencies: SHEET_TABS.EMERGENCIES,
  notifications: SHEET_TABS.NOTIFICATIONS,
  slides: SHEET_TABS.SLIDES,
};

export const SHEET_HEADERS: Record<SheetTabName, string[]> = {
  pengaturan: [
    'kunci',
    'nama_rt',
    'nama_rw',
    'kelurahan',
    'iuran_bulanan',
    'tanggal_jatuh_tempo',
    'nama_bank',
    'nomor_rekening',
    'atas_nama_rekening',
    'telepon_darurat_rt',
    'telepon_medis',
    'diperbarui_oleh',
    'diperbarui_pada',
  ],
  database_warga: [
    'id_database',
    'nama_lengkap',
    'blok_rumah',
    'peran',
    'jabatan_pengurus',
    'daftar_kewenangan',
    'status_hunian',
    'status_keluarga',
    'uid_terklaim',
    'username_terklaim',
    'id_komunitas',
    'dibuat_oleh',
    'dibuat_pada',
    'diperbarui_pada',
    'status_verifikasi',
  ],
  akun_pengguna: [
    'username',
    'uid',
    'peran',
    'id_database',
    'hash_sandi',
    'dibuat_pada',
  ],
  profil_warga: [
    'uid',
    'username',
    'peran_akun',
    'jabatan_pengurus',
    'daftar_kewenangan',
    'id_database',
    'nama_tampilan',
    'blok_rumah',
    'status_hunian',
    'status_keluarga',
    'riwayat_status_keluarga',
    'bulan_bayar_terakhir',
    'mode_lansia',
    'id_komunitas',
    'dibuat_pada',
    'diperbarui_pada',
    'status_verifikasi',
  ],
  pengurus_admin: [
    'uid',
    'email',
    'nama',
    'jabatan',
    'daftar_kewenangan',
    'id_database',
    'dibuat_pada',
  ],
  data_pribadi: [
    'id',
    'uid',
    'jenis_dokumen',
    'data_terenkripsi',
    'algoritma_enkripsi',
    'bagikan_saat_darurat',
    'ringkasan_medis',
    'diperbarui_pada',
  ],
  transaksi_kas: [
    'id',
    'jenis',
    'kategori',
    'judul',
    'nominal',
    'bulan_tagihan',
    'uid_warga',
    'nama_warga',
    'blok_rumah',
    'status_keluarga',
    'metode_pembayaran',
    'status',
    'alasan_penolakan',
    'diverifikasi_oleh',
    'catatan',
    'id_komunitas',
    'dibuat_pada',
    'diperbarui_pada',
    'foto_bukti_1',
    'foto_bukti_2',
    'foto_bukti_3',
    'foto_bukti_4',
    'foto_bukti_5',
  ],
  pengumuman: [
    'id',
    'judul',
    'isi_pesan',
    'kategori',
    'prioritas',
    'uid_penulis',
    'nama_penulis',
    'id_komunitas',
    'dibuat_pada',
    'diperbarui_pada',
  ],
  darurat_sos: [
    'id',
    'uid_pelapor',
    'nama_pelapor',
    'blok_rumah',
    'jenis_darurat',
    'deskripsi',
    'lokasi',
    'ringkasan_medis',
    'kontak_darurat',
    'status',
    'nama_penanggap',
    'id_komunitas',
    'dibuat_pada',
    'diperbarui_pada',
  ],
  notifikasi: [
    'id',
    'uid_tujuan',
    'uid_pengirim',
    'judul',
    'pesan',
    'jenis',
    'sudah_dibaca',
    'id_terkait',
    'dibuat_pada',
  ],
  foto_kegiatan: [
    'id',
    'judul',
    'subjudul',
    'urutan',
    'diunggah_oleh',
    'id_komunitas',
    'dibuat_pada',
    'diperbarui_pada',
    'foto_1',
    'foto_2',
    'foto_3',
    'foto_4',
    'foto_5',
    'foto_6',
  ],
};

export interface SheetSnapshotData {
  rtSettings: RtSettings | null;
  registryEntries: ResidentRegistryEntry[];
  userAccounts: UserAccountLookup[];
  users: ResidentPublic[];
  admins: AdminRoleRecord[];
  privateData: PrivateDataRecord[];
  transactions: KasTransaction[];
  announcements: Announcement[];
  emergencies: EmergencyAlert[];
  notifications: UserNotification[];
  slides: BannerSlide[];
}

export class SheetsAuthExpiredError extends Error {
  constructor(
    message = 'Sesi akses Google Sheets telah berakhir. Silakan masuk ulang dengan Google.'
  ) {
    super(message);
    this.name = 'SheetsAuthExpiredError';
  }
}

export function getSavedSpreadsheetId(): string | null {
  try {
    return localStorage.getItem(SAVED_SPREADSHEET_ID_KEY);
  } catch {
    return null;
  }
}

export function saveSpreadsheetId(id: string): void {
  try {
    localStorage.setItem(SAVED_SPREADSHEET_ID_KEY, id);
  } catch {
    // Ignore storage errors
  }
}

export function clearSavedSpreadsheetId(): void {
  try {
    localStorage.removeItem(SAVED_SPREADSHEET_ID_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getSavedWebAppUrl(): string | null {
  try {
    return localStorage.getItem(SAVED_WEBAPP_URL_KEY);
  } catch {
    return null;
  }
}

export function saveWebAppUrl(url: string): void {
  try {
    localStorage.setItem(SAVED_WEBAPP_URL_KEY, url);
  } catch {
    // Ignore storage errors
  }
}

export function clearSavedWebAppUrl(): void {
  try {
    localStorage.removeItem(SAVED_WEBAPP_URL_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getDefaultWebAppUrl(): string {
  const envUrl = (import.meta.env.VITE_SHEETS_WEBAPP_URL || '').trim();
  if (envUrl && extractWebAppUrl(envUrl)) return envUrl;
  const savedUrl = (getSavedWebAppUrl() || '').trim();
  if (savedUrl && extractWebAppUrl(savedUrl)) return savedUrl;
  return BUILTIN_SHEETS_WEBAPP_URL;
}

export interface PersistedVerifiedSession {
  uid: string;
  username: string;
  role: LoginRole;
  registryId: string;
  displayName: string;
  webAppUrl?: string;
  spreadsheetId?: string;
  verifiedAtIso: string;
}

export function getSavedVerifiedSession(): PersistedVerifiedSession | null {
  try {
    const raw = localStorage.getItem(SAVED_VERIFIED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedVerifiedSession>;
    if (!parsed || !parsed.uid || !parsed.username || !parsed.role) return null;
    return {
      uid: parsed.uid,
      username: parsed.username,
      role: parsed.role === 'pengurus' ? 'pengurus' : 'warga',
      registryId: parsed.registryId || '',
      displayName: parsed.displayName || parsed.username,
      webAppUrl: parsed.webAppUrl,
      spreadsheetId: parsed.spreadsheetId,
      verifiedAtIso: parsed.verifiedAtIso || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveVerifiedSession(session: PersistedVerifiedSession): void {
  try {
    localStorage.setItem(SAVED_VERIFIED_SESSION_KEY, JSON.stringify(session));
    if (session.webAppUrl) {
      saveWebAppUrl(session.webAppUrl);
    }
    if (session.spreadsheetId) {
      saveSpreadsheetId(session.spreadsheetId);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearVerifiedSession(): void {
  try {
    localStorage.removeItem(SAVED_VERIFIED_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function extractAndSaveWebAppUrlFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const currentUrl = new URL(window.location.href);
    const paramCandidate =
      currentUrl.searchParams.get('webapp') ||
      currentUrl.searchParams.get('sheet_url') ||
      '';
    let validUrl = paramCandidate ? extractWebAppUrl(paramCandidate) : null;

    if (!validUrl && currentUrl.hash.includes('webapp=')) {
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
      const hashCandidate = hashParams.get('webapp') || '';
      validUrl = hashCandidate ? extractWebAppUrl(hashCandidate) : null;
    }

    if (validUrl) {
      saveWebAppUrl(validUrl);
      currentUrl.searchParams.delete('webapp');
      currentUrl.searchParams.delete('sheet_url');
      window.history.replaceState({}, document.title, currentUrl.toString());
      return validUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractWebAppUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (
      u.protocol === 'https:' &&
      u.hostname === 'script.google.com' &&
      u.pathname.includes('/macros/') &&
      u.pathname.endsWith('/exec')
    ) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  return trimmed;
}

export function generateRecordId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function columnIndexToLetter(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function splitChunks(value: string, chunkCount: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    chunks.push(start < value.length ? value.slice(start, start + CHUNK_SIZE) : '');
  }
  return chunks;
}

function joinChunks(
  rowObj: Record<string, string>,
  prefixes: string[],
  chunkCount: number
): string {
  for (const prefix of prefixes) {
    let out = '';
    for (let i = 1; i <= chunkCount; i++) {
      out += rowObj[`${prefix}${i}`] || '';
    }
    if (out) return out;
  }
  return '';
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function parseBoolId(val: string): boolean {
  const normalized = val.trim().toLowerCase();
  return normalized === 'ya' || normalized === 'true' || normalized === '1';
}

function parseTransactionType(val: string): TransactionType {
  const v = val.trim().toLowerCase();
  return v === 'pengeluaran' || v === 'expense' ? 'expense' : 'income';
}

function serializeTransactionType(t: TransactionType): string {
  return t === 'expense' ? 'pengeluaran' : 'pemasukan';
}

function parseTransactionStatus(val: string): TransactionStatus {
  const v = val.trim().toLowerCase();
  if (v === 'disetujui' || v === 'approved') return 'approved';
  if (v === 'ditolak' || v === 'rejected') return 'rejected';
  if (v === 'kurang_bayar') return 'kurang_bayar';
  return 'pending';
}

function serializeTransactionStatus(s: TransactionStatus): string {
  if (s === 'approved') return 'disetujui';
  if (s === 'rejected') return 'ditolak';
  if (s === 'kurang_bayar') return 'kurang_bayar';
  return 'menunggu';
}

function parseEmergencyStatus(val: string): EmergencyStatus {
  const v = val.trim().toLowerCase();
  if (v === 'ditangani' || v === 'responding') return 'responding';
  if (v === 'selesai' || v === 'resolved') return 'resolved';
  return 'active';
}

function serializeEmergencyStatus(s: EmergencyStatus): string {
  if (s === 'responding') return 'ditangani';
  if (s === 'resolved') return 'selesai';
  return 'aktif';
}

function parseAnnouncementPriority(val: string): 'normal' | 'urgent' {
  const v = val.trim().toLowerCase();
  return v === 'mendesak' || v === 'urgent' ? 'urgent' : 'normal';
}

function serializeAnnouncementPriority(p: 'normal' | 'urgent'): string {
  return p === 'urgent' ? 'mendesak' : 'normal';
}

function parseVerificationStatus(val: string): VerificationStatus {
  const v = val.trim().toLowerCase();
  if (v === 'menunggu' || v === 'pending' || v === 'belum') return 'pending';
  if (v === 'ditolak' || v === 'rejected' || v === 'nonaktif') return 'rejected';
  return 'verified';
}

function serializeVerificationStatus(s?: VerificationStatus): string {
  if (s === 'pending') return 'menunggu';
  if (s === 'rejected') return 'ditolak';
  return 'terverifikasi';
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new SheetsAuthExpiredError();
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const apiErr = (parsed as { error?: { message?: string } })?.error?.message;
    throw new Error(apiErr || `Google API error (${res.status})`);
  }

  return parsed as T;
}

const ensuredSchemaUrls = new Set<string>();
const inFlightConnects = new Map<string, Promise<SheetDbInfo>>();
const inFlightFetches = new Map<string, Promise<SheetSnapshotData>>();

async function webAppGet<T extends { ok?: boolean; error?: string }>(
  webAppUrl: string,
  timeoutMs = 20000
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller !== null ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(webAppUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller?.signal,
    });
    const text = await res.text();
    let parsed: T | null = null;
    try {
      parsed = text ? (JSON.parse(text) as T) : null;
    } catch {
      throw new Error(
        'Respon dari Apps Script tidak valid. Pastikan Web App di-deploy dengan akses "Siapa saja (Anyone)".'
      );
    }
    if (!res.ok || !parsed || parsed.ok === false) {
      throw new Error(parsed?.error || `Gagal terhubung ke Apps Script (${res.status})`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Koneksi ke Google Spreadsheet habis waktu (timeout). Silakan coba lagi.');
    }
    throw err;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

async function webAppPost<T extends { ok?: boolean; error?: string }>(
  webAppUrl: string,
  payload: Record<string, unknown>,
  timeoutMs = 30000
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller !== null ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    const text = await res.text();
    let parsed: T | null = null;
    try {
      parsed = text ? (JSON.parse(text) as T) : null;
    } catch {
      throw new Error(
        'Respon dari Apps Script tidak valid. Pastikan Web App di-deploy dengan akses "Siapa saja (Anyone)".'
      );
    }

    if (!res.ok || !parsed || parsed.ok === false) {
      throw new Error(parsed?.error || `Gagal terhubung ke Apps Script (${res.status})`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Permintaan ke Google Spreadsheet habis waktu (timeout). Silakan coba lagi.');
    }
    throw err;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

export async function connectWebAppAndEnsureSchema(
  rawUrl: string,
  defaultSettings: RtSettings,
  options?: { forceSchema?: boolean }
): Promise<SheetDbInfo> {
  const candidate = (rawUrl || '').trim() || getDefaultWebAppUrl();
  const webAppUrl = extractWebAppUrl(candidate);
  if (!webAppUrl) {
    throw new Error(
      'URL Web App Google Apps Script tidak valid. Pastikan berawalan https://script.google.com/macros/s/... dan berakhiran /exec.'
    );
  }

  const key = `${webAppUrl}:${options?.forceSchema ? 'force' : 'auto'}`;
  const existingPromise = inFlightConnects.get(key);
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<SheetDbInfo> => {
    const nowIso = new Date().toISOString();
    const skipSchema = !options?.forceSchema && ensuredSchemaUrls.has(webAppUrl);

    let res: {
      ok: boolean;
      spreadsheetId: string;
      spreadsheetTitle?: string;
      spreadsheetUrl?: string;
    };

    if (skipSchema) {
      res = await webAppGet<{
        ok: boolean;
        spreadsheetId: string;
        spreadsheetTitle?: string;
        spreadsheetUrl?: string;
      }>(webAppUrl);
    } else {
      res = await webAppPost<{
        ok: boolean;
        spreadsheetId: string;
        spreadsheetTitle?: string;
        spreadsheetUrl?: string;
      }>(webAppUrl, {
        action: 'ensureSchema',
        tabs: Object.values(SHEET_TABS),
        headers: SHEET_HEADERS,
        legacyMap: LEGACY_TAB_TO_INDONESIAN,
        defaultSettingsRow: settingsToRow(defaultSettings, nowIso),
      });
      ensuredSchemaUrls.add(webAppUrl);
    }

    saveWebAppUrl(webAppUrl);
    return {
      mode: 'webapp',
      spreadsheetId: res.spreadsheetId,
      spreadsheetTitle: res.spreadsheetTitle || DEFAULT_SPREADSHEET_TITLE,
      spreadsheetUrl:
        res.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}/edit`,
      webAppUrl,
      lastSyncedAtIso: nowIso,
    };
  })().finally(() => {
    inFlightConnects.delete(key);
  });

  inFlightConnects.set(key, task);
  return task;
}

export async function findAppDatabaseSpreadsheet(
  accessToken: string
): Promise<SheetDbInfo | null> {
  const q = encodeURIComponent(
    `(name = '${DEFAULT_SPREADSHEET_TITLE}' or name = '${LEGACY_SPREADSHEET_TITLE}') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&orderBy=modifiedTime%20desc&pageSize=5`;
  const data = await googleFetch<{
    files?: Array<{ id: string; name: string; webViewLink?: string }>;
  }>(url, accessToken);

  const file =
    data.files?.find((f) => f.name === DEFAULT_SPREADSHEET_TITLE) || data.files?.[0];
  if (!file) return null;
  return {
    mode: 'oauth',
    spreadsheetId: file.id,
    spreadsheetTitle: file.name,
    spreadsheetUrl:
      file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
  };
}

export async function createAppDatabaseSpreadsheet(
  accessToken: string,
  defaultSettings: RtSettings
): Promise<SheetDbInfo> {
  const allTabs = Object.values(SHEET_TABS);
  const created = await googleFetch<{
    spreadsheetId: string;
    properties: { title: string };
    spreadsheetUrl: string;
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: DEFAULT_SPREADSHEET_TITLE },
      sheets: allTabs.map((title) => ({
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    }),
  });

  const nowIso = new Date().toISOString();
  const valueUpdates = allTabs.map((tab) => ({
    range: `${tab}!A1`,
    values:
      tab === SHEET_TABS.SETTINGS
        ? [SHEET_HEADERS[tab], settingsToRow(defaultSettings, nowIso)]
        : [SHEET_HEADERS[tab]],
  }));

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: valueUpdates,
      }),
    }
  );

  saveSpreadsheetId(created.spreadsheetId);
  return {
    mode: 'oauth',
    spreadsheetId: created.spreadsheetId,
    spreadsheetTitle: created.properties?.title || DEFAULT_SPREADSHEET_TITLE,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    lastSyncedAtIso: nowIso,
  };
}

interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties?: { title?: string };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
}

export async function connectAndEnsureSchema(
  accessToken: string,
  spreadsheetId: string,
  defaultSettings: RtSettings
): Promise<SheetDbInfo> {
  const meta = await googleFetch<SpreadsheetMetadata>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`,
    accessToken
  );

  const existingSheetsByTitle = new Map<string, number>();
  for (const s of meta.sheets || []) {
    if (s.properties?.title && typeof s.properties.sheetId === 'number') {
      existingSheetsByTitle.set(s.properties.title, s.properties.sheetId);
    }
  }

  // Rename legacy English tabs to Indonesian names if target Indonesian tab doesn't exist yet
  const structuralRequests: Array<Record<string, unknown>> = [];
  for (const [legacyTitle, idTitle] of Object.entries(LEGACY_TAB_TO_INDONESIAN)) {
    const legacyId = existingSheetsByTitle.get(legacyTitle);
    if (legacyId !== undefined && !existingSheetsByTitle.has(idTitle)) {
      structuralRequests.push({
        updateSheetProperties: {
          properties: { sheetId: legacyId, title: idTitle },
          fields: 'title',
        },
      });
      existingSheetsByTitle.delete(legacyTitle);
      existingSheetsByTitle.set(idTitle, legacyId);
    }
  }

  const allTabs = Object.values(SHEET_TABS);
  const missingTabs = allTabs.filter((tab) => !existingSheetsByTitle.has(tab));
  for (const title of missingTabs) {
    structuralRequests.push({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (structuralRequests.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: structuralRequests }),
      }
    );
  }

  // Ensure row 1 of every tab uses Bahasa Indonesia headers
  const headerRanges = allTabs
    .map((tab) => `ranges=${encodeURIComponent(`${tab}!A1:Z2`)}`)
    .join('&');
  const headerCheck = await googleFetch<{
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${headerRanges}`,
    accessToken
  );

  const headerUpdates: Array<{ range: string; values: string[][] }> = [];
  const nowIso = new Date().toISOString();

  allTabs.forEach((tab, idx) => {
    const existingRows = headerCheck.valueRanges?.[idx]?.values || [];
    const targetHeaders = SHEET_HEADERS[tab];
    if (existingRows.length === 0 || existingRows[0].length === 0) {
      headerUpdates.push({
        range: `${tab}!A1`,
        values:
          tab === SHEET_TABS.SETTINGS
            ? [targetHeaders, settingsToRow(defaultSettings, nowIso)]
            : [targetHeaders],
      });
    } else {
      const currentHeaderRow = existingRows[0];
      const matchesIndonesian =
        currentHeaderRow.length === targetHeaders.length &&
        targetHeaders.every((h, i) => currentHeaderRow[i] === h);
      if (!matchesIndonesian) {
        headerUpdates.push({
          range: `${tab}!A1`,
          values: [targetHeaders],
        });
      }
    }
  });

  if (headerUpdates.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: headerUpdates,
        }),
      }
    );
  }

  saveSpreadsheetId(meta.spreadsheetId);
  return {
    mode: 'oauth',
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.properties?.title || DEFAULT_SPREADSHEET_TITLE,
    spreadsheetUrl:
      meta.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${meta.spreadsheetId}/edit`,
    lastSyncedAtIso: nowIso,
  };
}

function rowsToObjects(values?: string[][]): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.every((cell) => !cell || !cell.trim())) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = row[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

export async function fetchAllSheetTables(
  conn: SheetConnection
): Promise<SheetSnapshotData> {
  const dedupKey =
    conn.mode === 'webapp'
      ? `webapp:${conn.webAppUrl || ''}`
      : `oauth:${conn.spreadsheetId}`;
  const inFlight = inFlightFetches.get(dedupKey);
  if (inFlight) return inFlight;

  const task = (async (): Promise<SheetSnapshotData> => {
    const allTabs = Object.values(SHEET_TABS);
    const byTab = new Map<SheetTabName, Record<string, string>[]>();

    if (conn.mode === 'webapp') {
      if (!conn.webAppUrl) {
        throw new Error('URL Web App Apps Script belum terhubung.');
      }
      const res = await webAppPost<{
        ok: boolean;
        tables?: Record<string, string[][]>;
      }>(conn.webAppUrl, {
        action: 'fetchAll',
        tabs: allTabs,
      });
      allTabs.forEach((tab) => {
        byTab.set(tab, rowsToObjects(res.tables?.[tab]));
      });
    } else {
    if (!conn.accessToken) {
      throw new SheetsAuthExpiredError();
    }
    const rangesParam = allTabs
      .map((tab) => `ranges=${encodeURIComponent(`${tab}!A1:Z`)}`)
      .join('&');

    const res = await googleFetch<{
      valueRanges?: Array<{ values?: string[][] }>;
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        conn.spreadsheetId
      )}/values:batchGet?${rangesParam}`,
      conn.accessToken
    );

    allTabs.forEach((tab, idx) => {
      byTab.set(tab, rowsToObjects(res.valueRanges?.[idx]?.values));
    });
  }

  // 1. Pengaturan (Settings)
  const settingsRows = byTab.get(SHEET_TABS.SETTINGS) || [];
  const rtConfigRow =
    settingsRows.find((r) => {
      const k = pick(r, 'kunci', 'key');
      return k === 'konfigurasi_rt' || k === 'rt_config';
    }) || settingsRows[0];
  const rtSettings: RtSettings | null = rtConfigRow
    ? {
        rtName: pick(rtConfigRow, 'nama_rt', 'rtName') || 'RT 12',
        rwName: pick(rtConfigRow, 'nama_rw', 'rwName') || 'RW 20',
        kelurahan: pick(rtConfigRow, 'kelurahan') || 'Sukatani',
        monthlyDuesAmount:
          Number(pick(rtConfigRow, 'iuran_bulanan', 'monthlyDuesAmount')) || 120000,
        dueDayOfMonth:
          Number(pick(rtConfigRow, 'tanggal_jatuh_tempo', 'dueDayOfMonth')) || 10,
        bankName: pick(rtConfigRow, 'nama_bank', 'bankName'),
        bankAccountNumber: pick(rtConfigRow, 'nomor_rekening', 'bankAccountNumber'),
        bankAccountHolder: pick(rtConfigRow, 'atas_nama_rekening', 'bankAccountHolder'),
        emergencyPhoneRT:
          pick(rtConfigRow, 'telepon_darurat_rt', 'emergencyPhoneRT') || '112',
        emergencyPhoneMedical:
          pick(rtConfigRow, 'telepon_medis', 'emergencyPhoneMedical') || '118',
        updatedBy: pick(rtConfigRow, 'diperbarui_oleh', 'updatedBy') || 'system',
        updatedAt: pick(rtConfigRow, 'diperbarui_pada', 'updatedAt'),
      }
    : null;

  // 2. Database Warga (Resident Registry)
  const registryEntries: ResidentRegistryEntry[] = (
    byTab.get(SHEET_TABS.RESIDENT_REGISTRY) || []
  )
    .map((r, rowIdx) => {
      const fullName = pick(r, 'nama_lengkap', 'fullName');
      const houseBlock = pick(r, 'blok_rumah', 'houseBlock');
      const rawId = pick(r, 'id_database', 'registryId');
      const registryId =
        rawId ||
        (fullName && houseBlock
          ? `manual_${fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${houseBlock
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')}_${rowIdx}`
          : '');
      const roleRaw = pick(r, 'peran', 'role');
      const posRaw = pick(r, 'jabatan_pengurus', 'pengurusPosition');
      const permsRaw = pick(r, 'daftar_kewenangan', 'permissionsJson');
      const famRaw = pick(r, 'status_keluarga', 'familyStatus');
      const verRaw = pick(r, 'status_verifikasi', 'verificationStatus');
      return {
        registryId,
        fullName,
        houseBlock,
        role: (roleRaw === 'pengurus' ? 'pengurus' : 'warga') as LoginRole,
        ...(posRaw ? { pengurusPosition: posRaw as PengurusPosition } : {}),
        ...(permsRaw
          ? { permissions: safeJsonParse<RbacPermission[]>(permsRaw, []) }
          : {}),
        residentStatus: (pick(r, 'status_hunian', 'residentStatus') ||
          'tetap') as ResidentStatus,
        familyStatus: (famRaw === 'khusus' ? 'khusus' : 'umum') as FamilyStatus,
        verificationStatus: parseVerificationStatus(verRaw),
        claimedUid: pick(r, 'uid_terklaim', 'claimedUid'),
        claimedUsername: pick(r, 'username_terklaim', 'claimedUsername'),
        communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
        createdBy: pick(r, 'dibuat_oleh', 'createdBy'),
        createdAt: pick(r, 'dibuat_pada', 'createdAt'),
        updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
      };
    })
    .filter((e) => Boolean(e.registryId && (e.fullName || e.houseBlock)));

  // 3. Akun Pengguna (User Accounts)
  const userAccounts: UserAccountLookup[] = (
    byTab.get(SHEET_TABS.USER_ACCOUNTS) || []
  )
    .map((r) => ({
      username: pick(r, 'username'),
      uid: pick(r, 'uid'),
      role: (pick(r, 'peran', 'role') === 'pengurus' ? 'pengurus' : 'warga') as LoginRole,
      registryId: pick(r, 'id_database', 'registryId'),
      passwordHash: pick(r, 'hash_sandi', 'passwordHash'),
      createdAt: pick(r, 'dibuat_pada', 'createdAt'),
    }))
    .filter((a) => Boolean(a.username && a.uid));

  // 4. Profil Warga (Users)
  const users: ResidentPublic[] = (byTab.get(SHEET_TABS.USERS) || [])
    .map((r) => {
      const uid = pick(r, 'uid');
      const username = pick(r, 'username');
      const roleRaw = pick(r, 'peran_akun', 'accountRole');
      const posRaw = pick(r, 'jabatan_pengurus', 'pengurusPosition');
      const permsRaw = pick(r, 'daftar_kewenangan', 'permissionsJson');
      const registryId = pick(r, 'id_database', 'registryId');
      const famRaw = pick(r, 'status_keluarga', 'familyStatus');
      const famLogRaw = pick(r, 'riwayat_status_keluarga', 'familyStatusLogJson');
      const lastPaid = pick(r, 'bulan_bayar_terakhir', 'lastPaidMonth');
      const verRaw = pick(r, 'status_verifikasi', 'verificationStatus');
      return {
        uid,
        ...(username ? { username } : {}),
        ...(roleRaw
          ? { accountRole: (roleRaw === 'pengurus' ? 'pengurus' : 'warga') as LoginRole }
          : {}),
        ...(posRaw ? { pengurusPosition: posRaw as PengurusPosition } : {}),
        ...(permsRaw
          ? { permissions: safeJsonParse<RbacPermission[]>(permsRaw, []) }
          : {}),
        ...(registryId ? { registryId } : {}),
        displayName: pick(r, 'nama_tampilan', 'displayName'),
        houseBlock: pick(r, 'blok_rumah', 'houseBlock'),
        residentStatus: (pick(r, 'status_hunian', 'residentStatus') ||
          'tetap') as ResidentStatus,
        familyStatus: (famRaw === 'khusus' ? 'khusus' : 'umum') as FamilyStatus,
        familyStatusLog: safeJsonParse<string[]>(famLogRaw, []),
        ...(lastPaid ? { lastPaidMonth: lastPaid } : {}),
        verificationStatus: parseVerificationStatus(verRaw),
        elderlyMode: parseBoolId(pick(r, 'mode_lansia', 'elderlyMode')),
        communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
        createdAt: pick(r, 'dibuat_pada', 'createdAt'),
        updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
      };
    })
    .filter((u) => Boolean(u.uid));

  // 5. Pengurus Admin (Admins)
  const admins: AdminRoleRecord[] = (byTab.get(SHEET_TABS.ADMINS) || [])
    .map((r) => {
      const uid = pick(r, 'uid');
      const permsRaw = pick(r, 'daftar_kewenangan', 'permissionsJson');
      const regId = pick(r, 'id_database', 'registryId');
      return {
        uid,
        email: pick(r, 'email'),
        name: pick(r, 'nama', 'name'),
        role: (pick(r, 'jabatan', 'role') || 'ketua_rt') as AdminRoleRecord['role'],
        ...(permsRaw
          ? { permissions: safeJsonParse<RbacPermission[]>(permsRaw, []) }
          : {}),
        ...(regId ? { registryId: regId } : {}),
        createdAt: pick(r, 'dibuat_pada', 'createdAt'),
      };
    })
    .filter((a) => Boolean(a.uid));

  // 6. Data Pribadi (Private Data)
  const privateData: PrivateDataRecord[] = (
    byTab.get(SHEET_TABS.PRIVATE_DATA) || []
  )
    .map((r) => {
      const docRaw = pick(r, 'jenis_dokumen', 'docType').toLowerCase();
      return {
        id: pick(r, 'id'),
        uid: pick(r, 'uid'),
        docType: (docRaw === 'kesehatan' || docRaw === 'health'
          ? 'health'
          : 'profile') as 'profile' | 'health',
        encryptedPayload: pick(r, 'data_terenkripsi', 'encryptedPayload'),
        encryptionAlg:
          pick(r, 'algoritma_enkripsi', 'encryptionAlg') || 'AES-GCM-256',
        shareInEmergency: parseBoolId(
          pick(r, 'bagikan_saat_darurat', 'shareInEmergency')
        ),
        emergencySummary: pick(r, 'ringkasan_medis', 'emergencySummary'),
        updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
      };
    })
    .filter((p) => Boolean(p.id && p.uid));

  // 7. Transaksi Kas (Transactions)
  const transactions: KasTransaction[] = (
    byTab.get(SHEET_TABS.TRANSACTIONS) || []
  )
    .map((r) => {
      const famRaw = pick(r, 'status_keluarga', 'familyStatus');
      return {
        id: pick(r, 'id'),
        type: parseTransactionType(pick(r, 'jenis', 'type')),
        category: (pick(r, 'kategori', 'category') ||
          'iuran_bulanan') as TransactionCategory,
        title: pick(r, 'judul', 'title'),
        amount: Number(pick(r, 'nominal', 'amount')) || 0,
        billingMonth: pick(r, 'bulan_tagihan', 'billingMonth'),
        residentUid: pick(r, 'uid_warga', 'residentUid'),
        residentName: pick(r, 'nama_warga', 'residentName'),
        houseBlock: pick(r, 'blok_rumah', 'houseBlock'),
        ...(famRaw
          ? { familyStatus: (famRaw === 'khusus' ? 'khusus' : 'umum') as FamilyStatus }
          : {}),
        paymentMethod: (pick(r, 'metode_pembayaran', 'paymentMethod') ||
          'transfer') as PaymentMethod,
        proofImageData: joinChunks(r, ['foto_bukti_', 'proofChunk'], 5),
        status: parseTransactionStatus(pick(r, 'status')),
        rejectionReason: pick(r, 'alasan_penolakan', 'rejectionReason'),
        verifiedBy: pick(r, 'diverifikasi_oleh', 'verifiedBy'),
        notes: pick(r, 'catatan', 'notes'),
        communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
        createdAt: pick(r, 'dibuat_pada', 'createdAt'),
        updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
      };
    })
    .filter((t) => Boolean(t.id));

  // 8. Pengumuman (Announcements)
  const announcements: Announcement[] = (
    byTab.get(SHEET_TABS.ANNOUNCEMENTS) || []
  )
    .map((r) => ({
      id: pick(r, 'id'),
      title: pick(r, 'judul', 'title'),
      body: pick(r, 'isi_pesan', 'body'),
      category: (pick(r, 'kategori', 'category') || 'penting') as AnnouncementCategory,
      priority: parseAnnouncementPriority(pick(r, 'prioritas', 'priority')),
      authorUid: pick(r, 'uid_penulis', 'authorUid'),
      authorName: pick(r, 'nama_penulis', 'authorName'),
      communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
      createdAt: pick(r, 'dibuat_pada', 'createdAt'),
      updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
    }))
    .filter((a) => Boolean(a.id));

  // 9. Darurat SOS (Emergencies)
  const emergencies: EmergencyAlert[] = (
    byTab.get(SHEET_TABS.EMERGENCIES) || []
  )
    .map((r) => ({
      id: pick(r, 'id'),
      reporterUid: pick(r, 'uid_pelapor', 'reporterUid'),
      reporterName: pick(r, 'nama_pelapor', 'reporterName'),
      houseBlock: pick(r, 'blok_rumah', 'houseBlock'),
      emergencyType: (pick(r, 'jenis_darurat', 'emergencyType') ||
        'medis') as EmergencyType,
      description: pick(r, 'deskripsi', 'description'),
      locationText: pick(r, 'lokasi', 'locationText'),
      medicalSummary: pick(r, 'ringkasan_medis', 'medicalSummary'),
      emergencyContact: pick(r, 'kontak_darurat', 'emergencyContact'),
      status: parseEmergencyStatus(pick(r, 'status')),
      responderName: pick(r, 'nama_penanggap', 'responderName'),
      communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
      createdAt: pick(r, 'dibuat_pada', 'createdAt'),
      updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
    }))
    .filter((e) => Boolean(e.id));

  // 10. Notifikasi (Notifications)
  const notifications: UserNotification[] = (
    byTab.get(SHEET_TABS.NOTIFICATIONS) || []
  )
    .map((r) => ({
      id: pick(r, 'id'),
      targetUid: pick(r, 'uid_tujuan', 'targetUid'),
      senderUid: pick(r, 'uid_pengirim', 'senderUid'),
      title: pick(r, 'judul', 'title'),
      message: pick(r, 'pesan', 'message'),
      type: (pick(r, 'jenis', 'type') || 'announcement') as NotificationType,
      isRead: parseBoolId(pick(r, 'sudah_dibaca', 'isRead')),
      relatedId: pick(r, 'id_terkait', 'relatedId'),
      createdAt: pick(r, 'dibuat_pada', 'createdAt'),
    }))
    .filter((n) => Boolean(n.id));

  // 11. Foto Kegiatan (Slides)
  const slides: BannerSlide[] = (byTab.get(SHEET_TABS.SLIDES) || [])
    .map((r) => ({
      id: pick(r, 'id'),
      title: pick(r, 'judul', 'title'),
      subtitle: pick(r, 'subjudul', 'subtitle'),
      imageData: joinChunks(r, ['foto_', 'imgChunk'], 6),
      sortOrder: Number(pick(r, 'urutan', 'sortOrder')) || 0,
      uploadedBy: pick(r, 'diunggah_oleh', 'uploadedBy'),
      communityId: pick(r, 'id_komunitas', 'communityId') || 'rt_warga',
      createdAt: pick(r, 'dibuat_pada', 'createdAt'),
      updatedAt: pick(r, 'diperbarui_pada', 'updatedAt'),
    }))
    .filter((s) => Boolean(s.id))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return {
      rtSettings,
      registryEntries,
      userAccounts,
      users,
      admins,
      privateData,
      transactions,
      announcements,
      emergencies,
      notifications,
      slides,
    };
  })().finally(() => {
    inFlightFetches.delete(dedupKey);
  });

  inFlightFetches.set(dedupKey, task);
  return task;
}

// ==========================================
// Row Serializers (Bahasa Indonesia)
// ==========================================

export function settingsToRow(
  s: RtSettings,
  updatedAtIso = new Date().toISOString()
): string[] {
  return [
    'konfigurasi_rt',
    s.rtName || 'RT 12',
    s.rwName || 'RW 20',
    s.kelurahan || 'Sukatani',
    String(s.monthlyDuesAmount ?? 120000),
    String(s.dueDayOfMonth ?? 10),
    s.bankName || '',
    s.bankAccountNumber || '',
    s.bankAccountHolder || '',
    s.emergencyPhoneRT || '112',
    s.emergencyPhoneMedical || '118',
    s.updatedBy || 'system',
    typeof s.updatedAt === 'string' && s.updatedAt ? s.updatedAt : updatedAtIso,
  ];
}

export function registryEntryToRow(e: ResidentRegistryEntry): string[] {
  const nowIso = new Date().toISOString();
  return [
    e.registryId,
    e.fullName,
    e.houseBlock,
    e.role,
    e.pengurusPosition || '',
    e.permissions ? JSON.stringify(e.permissions) : '',
    e.residentStatus,
    e.familyStatus,
    e.claimedUid || '',
    e.claimedUsername || '',
    e.communityId || 'rt_warga',
    e.createdBy || '',
    typeof e.createdAt === 'string' && e.createdAt ? e.createdAt : nowIso,
    typeof e.updatedAt === 'string' && e.updatedAt ? e.updatedAt : nowIso,
    serializeVerificationStatus(e.verificationStatus),
  ];
}

export function userAccountToRow(a: UserAccountLookup): string[] {
  const nowIso = new Date().toISOString();
  return [
    a.username,
    a.uid,
    a.role,
    a.registryId,
    a.passwordHash || '',
    typeof a.createdAt === 'string' && a.createdAt ? a.createdAt : nowIso,
  ];
}

export function userProfileToRow(u: ResidentPublic): string[] {
  const nowIso = new Date().toISOString();
  return [
    u.uid,
    u.username || '',
    u.accountRole || 'warga',
    u.pengurusPosition || '',
    u.permissions ? JSON.stringify(u.permissions) : '',
    u.registryId || '',
    u.displayName,
    u.houseBlock,
    u.residentStatus,
    u.familyStatus || 'umum',
    JSON.stringify(u.familyStatusLog || []),
    u.lastPaidMonth || '',
    u.elderlyMode ? 'ya' : 'tidak',
    u.communityId || 'rt_warga',
    typeof u.createdAt === 'string' && u.createdAt ? u.createdAt : nowIso,
    typeof u.updatedAt === 'string' && u.updatedAt ? u.updatedAt : nowIso,
    serializeVerificationStatus(u.verificationStatus),
  ];
}

export function adminRecordToRow(a: AdminRoleRecord): string[] {
  const nowIso = new Date().toISOString();
  return [
    a.uid,
    a.email,
    a.name,
    a.role,
    a.permissions ? JSON.stringify(a.permissions) : '',
    a.registryId || '',
    typeof a.createdAt === 'string' && a.createdAt ? a.createdAt : nowIso,
  ];
}

export function privateDataToRow(p: PrivateDataRecord): string[] {
  const nowIso = new Date().toISOString();
  return [
    p.id,
    p.uid,
    p.docType === 'health' ? 'kesehatan' : 'profil',
    p.encryptedPayload,
    p.encryptionAlg || 'AES-GCM-256',
    p.shareInEmergency ? 'ya' : 'tidak',
    p.emergencySummary || '',
    p.updatedAt || nowIso,
  ];
}

export function transactionToRow(tx: KasTransaction): string[] {
  const nowIso = new Date().toISOString();
  const chunks = splitChunks(tx.proofImageData || '', 5);
  return [
    tx.id,
    serializeTransactionType(tx.type),
    tx.category,
    tx.title,
    String(tx.amount),
    tx.billingMonth,
    tx.residentUid,
    tx.residentName,
    tx.houseBlock,
    tx.familyStatus || '',
    tx.paymentMethod,
    serializeTransactionStatus(tx.status),
    tx.rejectionReason || '',
    tx.verifiedBy || '',
    tx.notes || '',
    tx.communityId || 'rt_warga',
    typeof tx.createdAt === 'string' && tx.createdAt ? tx.createdAt : nowIso,
    typeof tx.updatedAt === 'string' && tx.updatedAt ? tx.updatedAt : nowIso,
    ...chunks,
  ];
}

export function announcementToRow(a: Announcement): string[] {
  const nowIso = new Date().toISOString();
  return [
    a.id,
    a.title,
    a.body,
    a.category,
    serializeAnnouncementPriority(a.priority),
    a.authorUid,
    a.authorName,
    a.communityId || 'rt_warga',
    typeof a.createdAt === 'string' && a.createdAt ? a.createdAt : nowIso,
    typeof a.updatedAt === 'string' && a.updatedAt ? a.updatedAt : nowIso,
  ];
}

export function emergencyToRow(e: EmergencyAlert): string[] {
  const nowIso = new Date().toISOString();
  return [
    e.id,
    e.reporterUid,
    e.reporterName,
    e.houseBlock,
    e.emergencyType,
    e.description || '',
    e.locationText || '',
    e.medicalSummary || '',
    e.emergencyContact || '',
    serializeEmergencyStatus(e.status),
    e.responderName || '',
    e.communityId || 'rt_warga',
    typeof e.createdAt === 'string' && e.createdAt ? e.createdAt : nowIso,
    typeof e.updatedAt === 'string' && e.updatedAt ? e.updatedAt : nowIso,
  ];
}

export function notificationToRow(n: UserNotification): string[] {
  const nowIso = new Date().toISOString();
  return [
    n.id,
    n.targetUid,
    n.senderUid,
    n.title,
    n.message,
    n.type,
    n.isRead ? 'ya' : 'tidak',
    n.relatedId || '',
    typeof n.createdAt === 'string' && n.createdAt ? n.createdAt : nowIso,
  ];
}

export function slideToRow(s: BannerSlide): string[] {
  const nowIso = new Date().toISOString();
  const chunks = splitChunks(s.imageData || '', 6);
  return [
    s.id,
    s.title,
    s.subtitle,
    String(s.sortOrder ?? 0),
    s.uploadedBy,
    s.communityId || 'rt_warga',
    typeof s.createdAt === 'string' && s.createdAt ? s.createdAt : nowIso,
    typeof s.updatedAt === 'string' && s.updatedAt ? s.updatedAt : nowIso,
    ...chunks,
  ];
}

// ==========================================
// Low-level Sheet Row Operations
// ==========================================

export async function appendSheetRows(
  conn: SheetConnection,
  tab: SheetTabName,
  rows: string[][]
): Promise<void> {
  if (rows.length === 0) return;
  if (conn.mode === 'webapp') {
    if (!conn.webAppUrl) throw new Error('URL Web App Apps Script belum terhubung.');
    await webAppPost(conn.webAppUrl, { action: 'append', tab, rows });
    return;
  }
  if (!conn.accessToken) throw new SheetsAuthExpiredError();
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      conn.spreadsheetId
    )}/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    conn.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    }
  );
}

async function getKeyRowIndexMap(
  accessToken: string,
  spreadsheetId: string,
  tab: SheetTabName
): Promise<Map<string, number>> {
  const res = await googleFetch<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${tab}!A1:A`)}`,
    accessToken
  );
  const map = new Map<string, number>();
  const rows = res.values || [];
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i]?.[0]?.trim();
    if (key) {
      map.set(key, i + 1);
    }
  }
  return map;
}

export async function upsertSheetRowsByKey(
  conn: SheetConnection,
  tab: SheetTabName,
  rows: string[][]
): Promise<void> {
  if (rows.length === 0) return;
  if (conn.mode === 'webapp') {
    if (!conn.webAppUrl) throw new Error('URL Web App Apps Script belum terhubung.');
    await webAppPost(conn.webAppUrl, {
      action: 'upsert',
      tab,
      rows,
      legacySettingsKey: tab === SHEET_TABS.SETTINGS ? 'rt_config' : undefined,
    });
    return;
  }
  if (!conn.accessToken) throw new SheetsAuthExpiredError();

  const keyMap = await getKeyRowIndexMap(conn.accessToken, conn.spreadsheetId, tab);
  const endCol = columnIndexToLetter(SHEET_HEADERS[tab].length - 1);

  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][] = [];

  for (const row of rows) {
    const key = row[0]?.trim();
    let existingRowNum = key ? keyMap.get(key) : undefined;
    // Also support legacy settings key 'rt_config' when updating to 'konfigurasi_rt'
    if (!existingRowNum && tab === SHEET_TABS.SETTINGS && key === 'konfigurasi_rt') {
      existingRowNum = keyMap.get('rt_config');
    }
    if (existingRowNum) {
      updates.push({
        range: `${tab}!A${existingRowNum}:${endCol}${existingRowNum}`,
        values: [row],
      });
    } else {
      appends.push(row);
    }
  }

  if (updates.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        conn.spreadsheetId
      )}/values:batchUpdate`,
      conn.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates,
        }),
      }
    );
  }

  if (appends.length > 0) {
    await appendSheetRows(conn, tab, appends);
  }
}

export async function deleteSheetRowsByKey(
  conn: SheetConnection,
  tab: SheetTabName,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  const keySet = new Set(keys.map((k) => k.trim()).filter(Boolean));
  if (keySet.size === 0) return;

  if (conn.mode === 'webapp') {
    if (!conn.webAppUrl) throw new Error('URL Web App Apps Script belum terhubung.');
    await webAppPost(conn.webAppUrl, {
      action: 'delete',
      tab,
      keys: Array.from(keySet),
    });
    return;
  }
  if (!conn.accessToken) throw new SheetsAuthExpiredError();

  const [keyMap, meta] = await Promise.all([
    getKeyRowIndexMap(conn.accessToken, conn.spreadsheetId, tab),
    googleFetch<SpreadsheetMetadata>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        conn.spreadsheetId
      )}?fields=sheets.properties(sheetId,title)`,
      conn.accessToken
    ),
  ]);

  const sheetMeta = meta.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheetMeta?.properties?.sheetId;
  if (typeof sheetId !== 'number') return;

  const rowNums: number[] = [];
  for (const k of keySet) {
    const r = keyMap.get(k);
    if (r && r >= 2) rowNums.push(r);
  }
  if (rowNums.length === 0) return;

  rowNums.sort((a, b) => b - a);
  const requests = rowNums.map((rowNum) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowNum - 1,
        endIndex: rowNum,
      },
    },
  }));

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      conn.spreadsheetId
    )}:batchUpdate`,
    conn.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }
  );
}
