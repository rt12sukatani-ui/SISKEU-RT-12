import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  Check,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  ImagePlus,
  Images,
  Link2,
  LogOut,
  Moon,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressBannerSlideImage } from '../lib/crypto';
import type {
  BannerSlide,
  FamilyStatus,
  KasTransaction,
  RbacContext,
  ResidentPublic,
  ResidentStatus,
  RtSettings,
  SheetDbInfo,
} from '../types';
import {
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatNominalInput,
  formatRupiah,
  getCurrentYearMonth,
  getEffectiveFamilyStatusChangeMonth,
  getRequiredTariff,
  parseFamilyStatusLog,
  parseNominalInput,
  requestBrowserPushPermission,
} from '../utils/format';
import { PENGURUS_POSITION_DESCRIPTIONS, RBAC_PERMISSION_META } from '../utils/rbac';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { DownwardSelect } from './DownwardSelect';
import { PWAInstallButton } from './PWAInstallButton';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ResidentPublic;
  userEmail: string;
  rbac: RbacContext;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  elderlyMode: boolean;
  onToggleElderlyMode: () => void;
  rtSettings: RtSettings;
  transactions?: KasTransaction[];
  bannerSlides?: BannerSlide[];
  registryCount?: number;
  onOpenResidentRegistry?: () => void;
  onSaveProfile: (data: {
    displayName: string;
    houseBlock: string;
    residentStatus: ResidentStatus;
    familyStatus: FamilyStatus;
  }) => Promise<void>;
  onSaveRtSettings: (data: Omit<RtSettings, 'updatedBy' | 'updatedAt'>) => Promise<void>;
  onAddBannerSlide?: (data: {
    title: string;
    subtitle: string;
    imageData: string;
  }) => Promise<void>;
  onUpdateBannerSlide?: (
    id: string,
    data: { title: string; subtitle: string }
  ) => Promise<void>;
  onMoveBannerSlide?: (id: string, direction: 'up' | 'down') => Promise<void>;
  onDeleteBannerSlide?: (id: string) => Promise<void>;
  onOpenTutorial: () => void;
  onLogout: () => Promise<void>;
  sheetInfo?: SheetDbInfo | null;
  isSyncing?: boolean;
  isConnectingSheet?: boolean;
  onSyncNow?: () => void;
  onCreateSpreadsheet?: () => Promise<void>;
  onConnectSpreadsheetById?: (idOrUrl: string) => Promise<void>;
  onDisconnectGoogle?: () => Promise<void>;
}

interface PendingLocalSlide {
  name: string;
  imageData: string;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  userEmail,
  rbac,
  darkMode,
  onToggleDarkMode,
  elderlyMode,
  onToggleElderlyMode,
  rtSettings,
  transactions = [],
  bannerSlides = [],
  registryCount = 0,
  onOpenResidentRegistry,
  onSaveProfile,
  onSaveRtSettings,
  onAddBannerSlide,
  onUpdateBannerSlide,
  onMoveBannerSlide,
  onDeleteBannerSlide,
  onOpenTutorial,
  onLogout,
  sheetInfo,
  isSyncing = false,
  isConnectingSheet = false,
  onSyncNow,
  onCreateSpreadsheet,
  onConnectSpreadsheetById,
  onDisconnectGoogle,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [houseBlock, setHouseBlock] = useState(profile.houseBlock);
  const [residentStatus, setResidentStatus] = useState<ResidentStatus>(profile.residentStatus);
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>(profile.familyStatus || 'umum');

  // Admin RT settings
  const [rtName, setRtName] = useState(rtSettings.rtName);
  const [rwName, setRwName] = useState(rtSettings.rwName);
  const [kelurahan, setKelurahan] = useState(rtSettings.kelurahan);
  const [duesAmount, setDuesAmount] = useState(formatNominalInput(rtSettings.monthlyDuesAmount));
  const [dueDay, setDueDay] = useState(String(rtSettings.dueDayOfMonth));
  const [bankName, setBankName] = useState(rtSettings.bankName || '');
  const [bankNumber, setBankNumber] = useState(rtSettings.bankAccountNumber || '');
  const [bankHolder, setBankHolder] = useState(rtSettings.bankAccountHolder || '');
  const [phoneRT, setPhoneRT] = useState(rtSettings.emergencyPhoneRT || '112');
  const [phoneMed, setPhoneMed] = useState(rtSettings.emergencyPhoneMedical || '118');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // Admin Slideshow state
  const slideFileInputRef = useRef<HTMLInputElement | null>(null);
  const [slideTitle, setSlideTitle] = useState('');
  const [slideSubtitle, setSlideSubtitle] = useState('');
  const [pendingSlides, setPendingSlides] = useState<PendingLocalSlide[]>([]);
  const [slideBusy, setSlideBusy] = useState(false);
  const [slideError, setSlideError] = useState<string | null>(null);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile.displayName);
      setHouseBlock(profile.houseBlock);
      setResidentStatus(profile.residentStatus);
      setFamilyStatus(profile.familyStatus || 'umum');
      setRtName(rtSettings.rtName);
      setRwName(rtSettings.rwName);
      setKelurahan(rtSettings.kelurahan);
      setDuesAmount(formatNominalInput(rtSettings.monthlyDuesAmount));
      setDueDay(String(rtSettings.dueDayOfMonth));
      setBankName(rtSettings.bankName || '');
      setBankNumber(rtSettings.bankAccountNumber || '');
      setBankHolder(rtSettings.bankAccountHolder || '');
      setPhoneRT(rtSettings.emergencyPhoneRT || '112');
      setPhoneMed(rtSettings.emergencyPhoneMedical || '118');
      setFeedback(null);
      setSlideError(null);
      setEditingSlideId(null);
    }
  }, [isOpen, profile, rtSettings]);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const currentYm = getCurrentYearMonth();
  const savedFamilyStatus: FamilyStatus = profile.familyStatus || 'umum';
  const isFamilyStatusChanging = familyStatus !== savedFamilyStatus;
  const effectiveChangeMonth = getEffectiveFamilyStatusChangeMonth(
    transactions,
    profile.uid,
    currentYm
  );
  const scheduledEntry = parseFamilyStatusLog(profile.familyStatusLog).find(
    (entry) => entry.effectiveMonth > currentYm
  );

  const handleEnablePush = async () => {
    const perm = await requestBrowserPushPermission();
    setPushStatus(perm);
    if (perm === 'granted') {
      setFeedback('Notifikasi push aktif. Pembaruan transaksi dan pengumuman akan muncul instan.');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveProfile({
        displayName: displayName.trim() || profile.displayName,
        houseBlock: houseBlock.trim() || profile.houseBlock,
        residentStatus,
        familyStatus,
      });
      setFeedback(
        isFamilyStatusChanging
          ? `Profil diperbarui. Tarif ${FAMILY_STATUS_LABELS[familyStatus]} berlaku mulai ${formatMonthLabel(
              effectiveChangeMonth
            )}; riwayat pembayaran sebelumnya tetap terkunci.`
          : 'Profil warga berhasil diperbarui.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveRtSettings({
        rtName: rtName.trim() || 'RT 12',
        rwName: rwName.trim() || 'RW 20',
        kelurahan: kelurahan.trim() || 'Kelurahan Sukatani',
        monthlyDuesAmount: Math.max(0, parseNominalInput(duesAmount) || 150000),
        dueDayOfMonth: Math.min(28, Math.max(1, Number(dueDay) || 10)),
        bankName: bankName.trim(),
        bankAccountNumber: bankNumber.trim(),
        bankAccountHolder: bankHolder.trim(),
        emergencyPhoneRT: phoneRT.trim(),
        emergencyPhoneMedical: phoneMed.trim(),
      });
      setFeedback('Pengaturan Kas RT berhasil disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLocalSlides = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSlideError(null);
    setSlideBusy(true);
    try {
      const processed: PendingLocalSlide[] = [];
      for (const file of files.slice(0, 8)) {
        const compressed = await compressBannerSlideImage(file);
        processed.push({
          name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60),
          imageData: compressed,
        });
      }
      setPendingSlides((prev) => [...prev, ...processed].slice(0, 8));
    } catch (err) {
      setSlideError(
        err instanceof Error ? err.message : 'Gagal memproses foto dari penyimpanan lokal.'
      );
    } finally {
      setSlideBusy(false);
      if (slideFileInputRef.current) {
        slideFileInputRef.current.value = '';
      }
    }
  };

  const handleUploadSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddBannerSlide || pendingSlides.length === 0) return;

    setSlideBusy(true);
    setSlideError(null);
    setFeedback(null);
    try {
      for (let i = 0; i < pendingSlides.length; i++) {
        const item = pendingSlides[i];
        const fallbackTitle = item.name || `Kegiatan Warga ${bannerSlides.length + i + 1}`;
        const finalTitle = slideTitle.trim()
          ? pendingSlides.length > 1
            ? `${slideTitle.trim().slice(0, 72)} (${i + 1})`
            : slideTitle.trim()
          : fallbackTitle;
        await onAddBannerSlide({
          title: finalTitle.slice(0, 80),
          subtitle:
            slideSubtitle.trim().slice(0, 160) ||
            'Dokumentasi kegiatan warga RT 12 / RW 20 Sukatani',
          imageData: item.imageData,
        });
      }
      const uploadedCount = pendingSlides.length;
      setPendingSlides([]);
      setSlideTitle('');
      setSlideSubtitle('');
      setFeedback(
        `${uploadedCount} foto kegiatan berhasil ditambahkan ke slideshow halaman login.`
      );
    } catch (err) {
      setSlideError(
        err instanceof Error ? err.message : 'Gagal menyimpan foto kegiatan ke cloud.'
      );
    } finally {
      setSlideBusy(false);
    }
  };

  const handleStartEditSlide = (slide: BannerSlide) => {
    setEditingSlideId(slide.id);
    setEditTitle(slide.title);
    setEditSubtitle(slide.subtitle);
  };

  const handleSaveEditSlide = async (id: string) => {
    if (!onUpdateBannerSlide) return;
    setSlideBusy(true);
    setSlideError(null);
    try {
      await onUpdateBannerSlide(id, {
        title: editTitle.trim() || 'Kegiatan Warga RT',
        subtitle: editSubtitle.trim(),
      });
      setEditingSlideId(null);
      setFeedback('Keterangan foto slideshow berhasil diperbarui.');
    } catch (err) {
      setSlideError(err instanceof Error ? err.message : 'Gagal memperbarui keterangan foto.');
    } finally {
      setSlideBusy(false);
    }
  };

  const handleMoveSlide = async (id: string, direction: 'up' | 'down') => {
    if (!onMoveBannerSlide) return;
    setSlideBusy(true);
    setSlideError(null);
    try {
      await onMoveBannerSlide(id, direction);
    } catch (err) {
      setSlideError(err instanceof Error ? err.message : 'Gagal mengubah urutan foto.');
    } finally {
      setSlideBusy(false);
    }
  };

  const handleRemoveSlide = async (id: string) => {
    if (!onDeleteBannerSlide) return;
    setSlideBusy(true);
    setSlideError(null);
    try {
      await onDeleteBannerSlide(id);
      if (editingSlideId === id) setEditingSlideId(null);
      setFeedback('Foto kegiatan dihapus dari slideshow.');
    } catch (err) {
      setSlideError(err instanceof Error ? err.message : 'Gagal menghapus foto.');
    } finally {
      setSlideBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Akun dan Tampilan"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              Pengaturan Akun & Aksesibilitas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {profile.username ? `@${profile.username}` : userEmail} ·{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {rbac.positionLabel}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 pb-safe space-y-5 sm:space-y-6">
          {feedback && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {feedback}
            </div>
          )}

          {rbac.isPengurus && rbac.position !== 'warga' && (
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Jabatan: {rbac.positionLabel}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {rbac.isFullAdmin ? 'Admin Penuh' : `${rbac.permissions.length} Kewenangan`}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {PENGURUS_POSITION_DESCRIPTIONS[rbac.position]}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {RBAC_PERMISSION_META.map((perm) => {
                  const granted = rbac.isFullAdmin || rbac.permissions.includes(perm.id);
                  return (
                    <span
                      key={perm.id}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        granted
                          ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 line-through'
                      }`}
                    >
                      {perm.shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appearance & Accessibility Toggles */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Kenyamanan Tampilan & Kemudahan Lansia
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="min-h-[52px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between text-sm font-semibold cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                  <span>{darkMode ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}</span>
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Ubah</span>
              </button>

              <button
                type="button"
                onClick={onToggleElderlyMode}
                aria-pressed={elderlyMode}
                className={`min-h-[52px] px-4 rounded-xl border flex items-center justify-between text-sm font-semibold transition-colors cursor-pointer ${
                  elderlyMode
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Accessibility className="w-4 h-4" />
                  <span>Mode Ramah Lansia</span>
                </span>
                <span className="text-xs">{elderlyMode ? 'Aktif' : 'Nonaktif'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void handleEnablePush()}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {pushStatus === 'granted'
                    ? 'Notifikasi Push Aktif'
                    : 'Aktifkan Notifikasi Push'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTutorial();
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Ulangi Tutorial Interaktif</span>
              </button>

              <PWAInstallButton compact />
            </div>
          </div>

          {/* Resident Identity Form */}
          <form onSubmit={(e) => void handleSaveUser(e)} className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Identitas Rumah Warga
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  maxLength={75}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Blok / Nomor Rumah</label>
                <input
                  type="text"
                  required
                  maxLength={25}
                  placeholder="FF2/2"
                  value={houseBlock}
                  onChange={(e) => setHouseBlock(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Status Hunian</label>
                <DownwardSelect
                  value={residentStatus}
                  onChange={(val) => setResidentStatus(val as ResidentStatus)}
                  ariaLabel="Status Hunian"
                  options={[
                    { value: 'tetap', label: 'Warga Tetap' },
                    { value: 'kontrak', label: 'Warga Kontrak/Sewa' },
                  ]}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Status Keluarga (Tarif Iuran)</label>
                <DownwardSelect
                  value={familyStatus}
                  onChange={(val) => setFamilyStatus(val as FamilyStatus)}
                  ariaLabel="Status Keluarga (Tarif Iuran)"
                  options={[
                    { value: 'umum', label: 'Umum (Suami Istri — Rp 120.000)' },
                    { value: 'khusus', label: 'Khusus (Ortu Tunggal — Rp 60.000)' },
                  ]}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            {isFamilyStatusChanging ? (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
                <p className="font-bold">
                  Perubahan Tarif Iuran: {FAMILY_STATUS_LABELS[savedFamilyStatus]} (
                  {formatRupiah(getRequiredTariff(savedFamilyStatus))}) →{' '}
                  {FAMILY_STATUS_LABELS[familyStatus]} (
                  {formatRupiah(getRequiredTariff(familyStatus))})
                </p>
                <p>
                  Tarif baru berlaku mulai{' '}
                  <strong>{formatMonthLabel(effectiveChangeMonth)}</strong>
                  {effectiveChangeMonth > currentYm
                    ? ` (karena bulan ${formatMonthLabel(currentYm)} sudah memiliki catatan iuran). `
                    : '. '}
                  Seluruh data pembayaran iuran sebelum bulan tersebut tetap{' '}
                  <strong>terkunci dan tidak terpengaruh</strong>.
                </p>
              </div>
            ) : (
              scheduledEntry && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  Status baru <strong>{FAMILY_STATUS_LABELS[scheduledEntry.status]}</strong> (
                  {formatRupiah(getRequiredTariff(scheduledEntry.status))}/bln) akan mulai berlaku pada{' '}
                  <strong>{formatMonthLabel(scheduledEntry.effectiveMonth)}</strong>. Pembayaran hingga{' '}
                  {formatMonthLabel(currentYm)} tetap terkunci pada tarif sebelumnya.
                </div>
              )
            )}

            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              Simpan Identitas Warga
            </button>
          </form>

          {/* Database Warga Shortcut (Ketua RT & Sekretaris) */}
          {rbac.canManageResidents && onOpenResidentRegistry && (
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Database Warga ({registryCount} data)
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {rbac.isFullAdmin
                        ? 'Kelola data warga, jabatan pengurus (Ketua RT, Sekretaris, Bendahara, Pengurus Lain) & kewenangan RBAC.'
                        : 'Kelola daftar Nama Lengkap & Blok Rumah warga yang diizinkan mendaftar akun.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenResidentRegistry();
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Kelola Database Warga
                </button>
              </div>
            </div>
          )}

          {/* Full Admin RT Settings (Ketua RT / manage_settings) */}
          {rbac.canManageSettings && (
            <form
              onSubmit={(e) => void handleSaveAdminConfig(e)}
              className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pengaturan Kas & Nomor Darurat RT (Admin)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama RT</label>
                  <input
                    type="text"
                    value={rtName}
                    onChange={(e) => setRtName(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama RW</label>
                  <input
                    type="text"
                    value={rwName}
                    onChange={(e) => setRwName(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Kelurahan</label>
                  <input
                    type="text"
                    value={kelurahan}
                    onChange={(e) => setKelurahan(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nominal Iuran Bulanan (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={duesAmount}
                    onChange={(e) => setDuesAmount(formatNominalInput(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tanggal Jatuh Tempo (1-28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Bank</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">No. Rekening</label>
                  <input
                    type="text"
                    value={bankNumber}
                    onChange={(e) => setBankNumber(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Atas Nama</label>
                  <input
                    type="text"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">No. Darurat</label>
                  <input
                    type="tel"
                    value={phoneRT}
                    onChange={(e) => setPhoneRT(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">No. Ambulans / Medis</label>
                  <input
                    type="tel"
                    value={phoneMed}
                    onChange={(e) => setPhoneMed(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold cursor-pointer"
              >
                Simpan Pengaturan RT
              </button>
            </form>
          )}

          {/* Admin Slideshow Manager (manage_announcements or manage_settings) */}
          {(rbac.canManageAnnouncements || rbac.canManageSettings) && onAddBannerSlide && (
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Images className="w-4 h-4 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Foto Kegiatan Slideshow Halaman Login (Admin)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Unggah foto Full HD (hingga 1920px) agar tampil tajam di slideshow setiap 5 detik.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono-num font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {bannerSlides.length} foto
                </span>
              </div>

              {slideError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200">
                  {slideError}
                </div>
              )}

              <form
                onSubmit={(e) => void handleUploadSlides(e)}
                className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div>
                  <input
                    ref={slideFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handleSelectLocalSlides(e)}
                    className="hidden"
                    id="slideshow-local-file-input"
                  />
                  <label
                    htmlFor="slideshow-local-file-input"
                    className="min-h-[52px] w-full px-4 py-3 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>Unggah Foto</span>
                  </label>
                </div>

                {pendingSlides.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pendingSlides.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-[4/3] bg-slate-200 dark:bg-slate-800"
                      >
                        <img
                          src={item.imageData}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPendingSlides((prev) => prev.filter((_, pIdx) => pIdx !== idx))
                          }
                          aria-label={`Hapus pratinjau ${item.name}`}
                          className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-slate-950/75 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Judul Kegiatan (opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Kerja Bakti Blok A & B"
                      value={slideTitle}
                      onChange={(e) => setSlideTitle(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Keterangan Singkat (opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      placeholder="Minggu pagi bersama warga RT 12"
                      value={slideSubtitle}
                      onChange={(e) => setSlideSubtitle(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={slideBusy || pendingSlides.length === 0}
                  className="min-h-[44px] w-full px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>
                    {slideBusy
                      ? 'Mengunggah Foto...'
                      : pendingSlides.length > 0
                      ? `Tambahkan ${pendingSlides.length} Foto ke Slideshow`
                      : 'Unggah Foto Terlebih Dahulu'}
                  </span>
                </button>
              </form>

              {bannerSlides.length > 0 ? (
                <div className="space-y-2.5">
                  {bannerSlides.map((slide, idx) => {
                    const isEditing = editingSlideId === slide.id;
                    return (
                      <div
                        key={slide.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <img
                          src={slide.imageData}
                          alt={slide.title}
                          className="w-full sm:w-24 h-28 sm:h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        />

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                maxLength={80}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Judul kegiatan"
                                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                              />
                              <input
                                type="text"
                                maxLength={160}
                                value={editSubtitle}
                                onChange={(e) => setEditSubtitle(e.target.value)}
                                placeholder="Keterangan singkat"
                                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                #{idx + 1} · {slide.title || 'Kegiatan Warga'}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {slide.subtitle || 'Dokumentasi kegiatan warga'}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={slideBusy}
                                onClick={() => void handleSaveEditSlide(slide.id)}
                                aria-label="Simpan perubahan foto"
                                className="min-h-[40px] min-w-[40px] rounded-xl bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSlideId(null)}
                                aria-label="Batal ubah"
                                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={slideBusy || idx === 0}
                                onClick={() => void handleMoveSlide(slide.id, 'up')}
                                aria-label="Geser ke atas"
                                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={slideBusy || idx === bannerSlides.length - 1}
                                onClick={() => void handleMoveSlide(slide.id, 'down')}
                                aria-label="Geser ke bawah"
                                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={slideBusy}
                                onClick={() => handleStartEditSlide(slide)}
                                aria-label="Ubah judul foto"
                                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={slideBusy}
                                onClick={() => void handleRemoveSlide(slide.id)}
                                aria-label="Hapus foto dari slideshow"
                                className="min-h-[40px] min-w-[40px] rounded-xl border border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Belum ada foto kustom. Saat ini halaman login menampilkan banner default RT.
                </p>
              )}
            </div>
          )}

          {rbac.isPengurus && (sheetInfo || rbac.isFullAdmin) && (
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Database Google Spreadsheet
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {sheetInfo
                          ? `${sheetInfo.spreadsheetTitle} (${
                              sheetInfo.mode === 'webapp'
                                ? 'Apps Script Web App'
                                : sheetInfo.spreadsheetId.slice(0, 12) + '…'
                            })`
                          : 'Belum ada database Google Spreadsheet terhubung'}
                      </p>
                    </div>
                  </div>
                  {sheetInfo && (
                    <a
                      href={sheetInfo.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>Buka Sheet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {rbac.isFullAdmin && (onCreateSpreadsheet || onConnectSpreadsheetById) && (
                  <div className="space-y-2.5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                    {onCreateSpreadsheet && (
                      <button
                        type="button"
                        disabled={isConnectingSheet}
                        onClick={() => void onCreateSpreadsheet()}
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4 shrink-0" />
                        <span>
                          {isConnectingSheet
                            ? 'Menyiapkan Spreadsheet...'
                            : 'Buat Database Spreadsheet Baru'}
                        </span>
                      </button>
                    )}

                    {onConnectSpreadsheetById && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={sheetIdInput}
                          onChange={(e) => setSheetIdInput(e.target.value)}
                          placeholder="Tempel URL / ID Google Spreadsheet..."
                          className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <button
                          type="button"
                          disabled={isConnectingSheet || !sheetIdInput.trim()}
                          onClick={async () => {
                            await onConnectSpreadsheetById(sheetIdInput);
                            setSheetIdInput('');
                          }}
                          className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Hubungkan</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {sheetInfo && onSyncNow && (
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={onSyncNow}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Spreadsheet'}</span>
                    </button>
                  )}
                  {sheetInfo?.mode === 'webapp' && sheetInfo.webAppUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const inviteUrl = `${window.location.origin}/?webapp=${encodeURIComponent(
                            sheetInfo.webAppUrl || ''
                          )}`;
                          await navigator.clipboard.writeText(inviteUrl);
                          setCopiedInvite(true);
                          window.setTimeout(() => setCopiedInvite(false), 3000);
                        } catch {
                          setFeedback('Browser menolak salin otomatis.');
                        }
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedInvite ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Link Terhubung Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Link Otomatis Terhubung</span>
                        </>
                      )}
                    </button>
                  )}
                  {onDisconnectGoogle && (
                    <button
                      type="button"
                      onClick={() => void onDisconnectGoogle()}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Putuskan Koneksi Database
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">

          </div>
        </div>
      </div>
    </div>
  );
};
