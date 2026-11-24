import React, { useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Link2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  FamilyStatus,
  LoginRole,
  PengurusPosition,
  RbacPermission,
  ResidentPublic,
  ResidentRegistryEntry,
  ResidentStatus,
  SheetDbInfo,
  VerificationStatus,
} from '../types';
import { FAMILY_STATUS_LABELS } from '../utils/format';
import {
  DEFAULT_PERMISSIONS_BY_POSITION,
  normalizePengurusPermissions,
  PENGURUS_POSITION_DESCRIPTIONS,
  PENGURUS_POSITION_LABELS,
  RBAC_PERMISSION_META,
} from '../utils/rbac';

interface ResidentRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  canManageRbac: boolean;
  currentUserUid?: string;
  registryEntries: ResidentRegistryEntry[];
  existingResidents: ResidentPublic[];
  onAddEntry: (data: {
    fullName: string;
    houseBlock: string;
    role: LoginRole;
    pengurusPosition?: PengurusPosition;
    permissions?: RbacPermission[];
    residentStatus: ResidentStatus;
    familyStatus: FamilyStatus;
  }) => Promise<void>;
  onBulkImport: (
    items: Array<{
      fullName: string;
      houseBlock: string;
      role: LoginRole;
      pengurusPosition?: PengurusPosition;
      permissions?: RbacPermission[];
      residentStatus: ResidentStatus;
      familyStatus: FamilyStatus;
    }>
  ) => Promise<number>;
  onSyncExistingResidents: () => Promise<number>;
  onUpdateEntryDetails?: (
    entry: ResidentRegistryEntry,
    next: {
      fullName: string;
      houseBlock: string;
      residentStatus: ResidentStatus;
      familyStatus: FamilyStatus;
    }
  ) => Promise<void>;
  onUpdateRbac: (
    entry: ResidentRegistryEntry,
    next: {
      role: LoginRole;
      pengurusPosition?: PengurusPosition;
      permissions?: RbacPermission[];
    }
  ) => Promise<void>;
  onResetClaim: (entry: ResidentRegistryEntry) => Promise<void>;
  onDeleteEntry: (entry: ResidentRegistryEntry) => Promise<void>;
  sheetInfo?: SheetDbInfo | null;
  onSetVerificationStatus?: (
    entry: ResidentRegistryEntry,
    nextStatus: VerificationStatus
  ) => Promise<void>;
}

const POSITION_OPTIONS: PengurusPosition[] = [
  'ketua_rt',
  'sekretaris',
  'bendahara',
  'pengurus_lain',
];

const SHORT_PERM_LABEL = new Map(RBAC_PERMISSION_META.map((m) => [m.id, m.shortLabel]));

export const ResidentRegistryModal: React.FC<ResidentRegistryModalProps> = ({
  isOpen,
  onClose,
  canManageRbac,
  currentUserUid,
  registryEntries,
  existingResidents,
  onAddEntry,
  onBulkImport,
  onSyncExistingResidents,
  onUpdateEntryDetails,
  onUpdateRbac,
  onResetClaim,
  onDeleteEntry,
  sheetInfo,
  onSetVerificationStatus,
}) => {
  const [fullName, setFullName] = useState('');
  const [houseBlock, setHouseBlock] = useState('');
  const [role, setRole] = useState<LoginRole>('warga');
  const [pengurusPosition, setPengurusPosition] = useState<PengurusPosition>('sekretaris');
  const [selectedPermissions, setSelectedPermissions] = useState<RbacPermission[]>(
    DEFAULT_PERMISSIONS_BY_POSITION.sekretaris
  );
  const [residentStatus, setResidentStatus] = useState<ResidentStatus>('tetap');
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>('umum');

  // Inline RBAC Editor state per row
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<LoginRole>('warga');
  const [editPosition, setEditPosition] = useState<PengurusPosition>('pengurus_lain');
  const [editPermissions, setEditPermissions] = useState<RbacPermission[]>([]);

  // Inline Resident Details Editor state per row
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editHouseBlock, setEditHouseBlock] = useState('');
  const [editResidentStatus, setEditResidentStatus] = useState<ResidentStatus>('tetap');
  const [editFamilyStatus, setEditFamilyStatus] = useState<FamilyStatus>('umum');

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...registryEntries].sort((a, b) =>
      a.houseBlock.localeCompare(b.houseBlock)
    );
    if (!q) return sorted;
    return sorted.filter((entry) => {
      const posLabel = entry.pengurusPosition
        ? PENGURUS_POSITION_LABELS[entry.pengurusPosition]
        : '';
      return `${entry.fullName} ${entry.houseBlock} ${entry.role} ${posLabel} ${
        entry.claimedUsername || ''
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [registryEntries, searchQuery]);

  if (!isOpen) return null;

  const claimedCount = registryEntries.filter((e) => Boolean(e.claimedUid)).length;
  const verifiedCount = registryEntries.filter(
    (e) => (e.verificationStatus || 'verified') === 'verified'
  ).length;
  const pendingCount = registryEntries.filter(
    (e) => e.verificationStatus === 'pending'
  ).length;
  const inviteLink =
    sheetInfo?.mode === 'webapp' && sheetInfo.webAppUrl && typeof window !== 'undefined'
      ? `${window.location.origin}/?webapp=${encodeURIComponent(sheetInfo.webAppUrl)}`
      : null;

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 3000);
    } catch {
      setErrorMsg('Browser menolak salin otomatis. Salin URL langsung dari kotak tautan.');
    }
  };

  const handlePositionChange = (nextPos: PengurusPosition) => {
    setPengurusPosition(nextPos);
    setSelectedPermissions([...DEFAULT_PERMISSIONS_BY_POSITION[nextPos]]);
  };

  const toggleCreatePermission = (perm: RbacPermission) => {
    if (pengurusPosition === 'ketua_rt') return;
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !houseBlock.trim()) return;
    const effectiveRole: LoginRole = canManageRbac ? role : 'warga';
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await onAddEntry({
        fullName: fullName.trim(),
        houseBlock: houseBlock.trim(),
        role: effectiveRole,
        ...(effectiveRole === 'pengurus'
          ? {
              pengurusPosition,
              permissions: normalizePengurusPermissions(pengurusPosition, selectedPermissions),
            }
          : {}),
        residentStatus: effectiveRole === 'pengurus' ? 'pengurus' : residentStatus,
        familyStatus,
      });
      setFeedback(
        `Data "${fullName.trim()}" (${houseBlock.trim()}) berhasil disimpan ke Database Warga.`
      );
      setFullName('');
      setHouseBlock('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data warga.');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const items: Array<{
      fullName: string;
      houseBlock: string;
      role: LoginRole;
      pengurusPosition?: PengurusPosition;
      permissions?: RbacPermission[];
      residentStatus: ResidentStatus;
      familyStatus: FamilyStatus;
    }> = [];

    for (const line of lines) {
      const parts = line.split(/[|,;]/).map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      const rawRole = (parts[2] || '').toLowerCase();
      const parsedRole: LoginRole =
        canManageRbac && rawRole === 'pengurus' ? 'pengurus' : 'warga';
      const rawFamily = (parts[3] || '').toLowerCase();
      const parsedFamily: FamilyStatus = rawFamily === 'khusus' ? 'khusus' : 'umum';
      const rawPos = (parts[4] || '').toLowerCase() as PengurusPosition;
      const parsedPos: PengurusPosition = POSITION_OPTIONS.includes(rawPos)
        ? rawPos
        : 'pengurus_lain';

      items.push({
        fullName: parts[0],
        houseBlock: parts[1],
        role: parsedRole,
        ...(parsedRole === 'pengurus'
          ? {
              pengurusPosition: parsedPos,
              permissions: [...DEFAULT_PERMISSIONS_BY_POSITION[parsedPos]],
            }
          : {}),
        residentStatus: parsedRole === 'pengurus' ? 'pengurus' : 'tetap',
        familyStatus: parsedFamily,
      });
    }

    if (items.length === 0) {
      setErrorMsg(
        'Format tidak valid. Gunakan format: Nama Lengkap, Blok Rumah, warga/pengurus, umum/khusus'
      );
      return;
    }

    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const count = await onBulkImport(items);
      setFeedback(`${count} data warga berhasil diimpor ke Database Warga.`);
      setBulkText('');
      setShowBulkImport(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengimpor data warga.');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const count = await onSyncExistingResidents();
      setFeedback(
        count > 0
          ? `${count} warga aktif berhasil disinkronkan ke Database Warga.`
          : 'Semua warga aktif sudah ada di Database Warga.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan data warga.');
    } finally {
      setBusy(false);
    }
  };

  const startEditRbac = (entry: ResidentRegistryEntry) => {
    setEditingDetailsId(null);
    if (editingEntryId === entry.registryId) {
      setEditingEntryId(null);
      return;
    }
    const pos: PengurusPosition = entry.pengurusPosition || 'pengurus_lain';
    setEditingEntryId(entry.registryId);
    setEditRole(entry.role);
    setEditPosition(pos);
    setEditPermissions(
      entry.role === 'pengurus'
        ? normalizePengurusPermissions(pos, entry.permissions)
        : [...DEFAULT_PERMISSIONS_BY_POSITION.pengurus_lain]
    );
  };

  const startEditDetails = (entry: ResidentRegistryEntry) => {
    setEditingEntryId(null);
    if (editingDetailsId === entry.registryId) {
      setEditingDetailsId(null);
      return;
    }
    setEditingDetailsId(entry.registryId);
    setEditFullName(entry.fullName);
    setEditHouseBlock(entry.houseBlock);
    setEditResidentStatus(entry.residentStatus);
    setEditFamilyStatus(entry.familyStatus);
  };

  const handleSaveInlineDetails = async (entry: ResidentRegistryEntry) => {
    if (!onUpdateEntryDetails || !editFullName.trim() || !editHouseBlock.trim()) return;
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await onUpdateEntryDetails(entry, {
        fullName: editFullName.trim(),
        houseBlock: editHouseBlock.trim(),
        residentStatus: entry.role === 'pengurus' ? 'pengurus' : editResidentStatus,
        familyStatus: editFamilyStatus,
      });
      setEditingDetailsId(null);
      setFeedback(
        `Data "${editFullName.trim()}" (${editHouseBlock.trim()}) berhasil diperbarui di Database Warga.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui data warga.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveInlineRbac = async (entry: ResidentRegistryEntry) => {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await onUpdateRbac(entry, {
        role: editRole,
        ...(editRole === 'pengurus'
          ? {
              pengurusPosition: editPosition,
              permissions: normalizePengurusPermissions(editPosition, editPermissions),
            }
          : {}),
      });
      setEditingEntryId(null);
      setFeedback(
        editRole === 'pengurus'
          ? `Role & kewenangan "${entry.fullName}" diperbarui menjadi ${PENGURUS_POSITION_LABELS[editPosition]}.`
          : `Role "${entry.fullName}" diperbarui menjadi Warga.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui role & kewenangan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kelola Database"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Database Warga &amp; RBAC RT 12 / RW 20
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {canManageRbac
                  ? 'Validasi pendaftaran warga serta pengaturan jabatan & kewenangan pengurus RT'
                  : 'Pengelolaan data warga untuk validasi pendaftaran akun'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup database warga"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Database</p>
              <p className="font-mono-num text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                {registryEntries.length}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Terverifikasi</p>
              <p className="font-mono-num text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {verifiedCount}
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-3">
              <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">Sudah Daftar Akun</p>
              <p className="font-mono-num text-xl font-extrabold text-sky-700 dark:text-sky-400 mt-0.5">
                {claimedCount}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Menunggu / Belum</p>
              <p className="font-mono-num text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                {pendingCount > 0 ? pendingCount : Math.max(0, registryEntries.length - claimedCount)}
              </p>
            </div>
          </div>

          {inviteLink && (
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Tautan Koneksi Otomatis Spreadsheet Warga</span>
                </p>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                  Bagikan tautan ini ke grup RT agar seluruh pengguna terverifikasi langsung terhubung otomatis ke Google Spreadsheet tanpa tempel URL manual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyInviteLink()}
                className="min-h-[38px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedInvite ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tautan Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link Otomatis</span>
                  </>
                )}
              </button>
            </div>
          )}

          {feedback && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {feedback}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs font-semibold text-red-800 dark:text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Add Resident Form */}
          <form
            onSubmit={(e) => void handleAddSingle(e)}
            className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {canManageRbac
                    ? 'Tambah Warga / Pengurus ke Database'
                    : 'Tambah Data Warga ke Database'}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {existingResidents.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSync()}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sinkron Warga Aktif</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowBulkImport((v) => !v)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Impor Massal</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  maxLength={75}
                  placeholder="Contoh: Firman Mahameru"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Blok Rumah</label>
                <input
                  type="text"
                  required
                  maxLength={25}
                  placeholder="FF2/2"
                  value={houseBlock}
                  onChange={(e) => setHouseBlock(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Role Akun</label>
                <select
                  value={canManageRbac ? role : 'warga'}
                  disabled={!canManageRbac}
                  onChange={(e) => {
                    const next = e.target.value as LoginRole;
                    setRole(next);
                    if (next === 'pengurus') setResidentStatus('pengurus');
                    else if (residentStatus === 'pengurus') setResidentStatus('tetap');
                  }}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm disabled:opacity-60"
                >
                  <option value="warga">Warga</option>
                  {canManageRbac && <option value="pengurus">Pengurus</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Status Hunian</label>
                <select
                  value={residentStatus}
                  onChange={(e) => setResidentStatus(e.target.value as ResidentStatus)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="tetap">Warga Tetap</option>
                  <option value="kontrak">Warga Kontrak</option>
                  {canManageRbac && role === 'pengurus' && (
                    <option value="pengurus">Pengurus</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Status Keluarga</label>
                <select
                  value={familyStatus}
                  onChange={(e) => setFamilyStatus(e.target.value as FamilyStatus)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="umum">Umum (Suami Istri)</option>
                  <option value="khusus">Khusus (Ortu Tunggal)</option>
                </select>
              </div>
            </div>

            {!canManageRbac && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pengaturan jabatan pengurus &amp; hak akses RBAC hanya dapat ditetapkan oleh Ketua RT.
              </p>
            )}

            {/* RBAC Configuration when adding Pengurus */}
            {canManageRbac && role === 'pengurus' && (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-emerald-800 dark:text-emerald-300">
                      Jabatan Pengurus (RBAC)
                    </label>
                    <select
                      value={pengurusPosition}
                      onChange={(e) => handlePositionChange(e.target.value as PengurusPosition)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                    >
                      {POSITION_OPTIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {PENGURUS_POSITION_LABELS[pos]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 sm:pt-5 leading-relaxed">
                    {PENGURUS_POSITION_DESCRIPTIONS[pengurusPosition]}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Kewenangan Akses {pengurusPosition === 'pengurus_lain' ? '(Pilih sesuai tugas)' : '(Preset Jabatan — dapat disesuaikan)'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {RBAC_PERMISSION_META.map((perm) => {
                      const checked =
                        pengurusPosition === 'ketua_rt' || selectedPermissions.includes(perm.id);
                      const locked = pengurusPosition === 'ketua_rt';
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
                            checked
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                          } ${locked ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => toggleCreatePermission(perm.id)}
                            className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {perm.label}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : 'Simpan ke Database Warga'}
            </button>
          </form>

          {showBulkImport && (
            <form
              onSubmit={(e) => void handleBulkSubmit(e)}
              className="rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-4 space-y-3"
            >
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Impor Banyak Data Warga Sekaligus
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {canManageRbac ? (
                    <>
                      Format per baris: <code className="font-mono">Nama Lengkap, Blok Rumah, warga/pengurus, umum/khusus, ketua_rt/sekretaris/bendahara/pengurus_lain</code>
                    </>
                  ) : (
                    <>
                      Format per baris: <code className="font-mono">Nama Lengkap, Blok Rumah, warga, umum/khusus</code>
                    </>
                  )}
                </p>
              </div>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={
                  canManageRbac
                    ? 'Firman Mahameru, FF3/5, pengurus, khusus, bendahara\nLuky Sanjaya, FF3/5, warga, umum'
                    : 'Firman Mahameru, FF3/5, warga, umum'
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImport(false)}
                  className="min-h-[38px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[38px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Impor Sekarang
                </button>
              </div>
            </form>
          )}

          {/* Search & List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, blok rumah, jabatan, atau username..."
                className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada data warga di database. Tambahkan warga terlebih dahulu agar warga bisa mendaftarkan akun.
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isPengurus = entry.role === 'pengurus';
                  const pos: PengurusPosition = entry.pengurusPosition || 'pengurus_lain';
                  const effectivePerms = isPengurus
                    ? normalizePengurusPermissions(pos, entry.permissions)
                    : [];
                  const isEditingThis = editingEntryId === entry.registryId;
                  const isEditingDetailsThis = editingDetailsId === entry.registryId;
                  const canEditEntryRow =
                    canManageRbac || entry.role === 'warga';
                  const isSelf = Boolean(currentUserUid && entry.claimedUid === currentUserUid);
                  const verStatus: VerificationStatus = entry.verificationStatus || 'verified';

                  return (
                    <div
                      key={entry.registryId}
                      className="p-3.5 sm:px-4 bg-white dark:bg-slate-900 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {entry.fullName}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                                isPengurus
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isPengurus ? (
                                <ShieldCheck className="w-3 h-3" />
                              ) : (
                                <Users className="w-3 h-3" />
                              )}
                              <span>
                                {isPengurus ? PENGURUS_POSITION_LABELS[pos] : 'Warga'}
                              </span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                                verStatus === 'verified'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : verStatus === 'pending'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                              }`}
                            >
                              {verStatus === 'verified' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : verStatus === 'pending' ? (
                                <Clock className="w-3 h-3" />
                              ) : (
                                <Ban className="w-3 h-3" />
                              )}
                              <span>
                                {verStatus === 'verified'
                                  ? 'Terverifikasi'
                                  : verStatus === 'pending'
                                  ? 'Menunggu Verifikasi'
                                  : 'Ditolak / Nonaktif'}
                              </span>
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {entry.houseBlock} · {FAMILY_STATUS_LABELS[entry.familyStatus]} ·{' '}
                            {entry.claimedUid ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Akun aktif (@{entry.claimedUsername || 'terdaftar'})
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                Belum mendaftar akun
                              </span>
                            )}
                          </p>
                          {isPengurus && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                              Kewenangan:{' '}
                              {pos === 'ketua_rt' || effectivePerms.includes('manage_settings')
                                ? 'Administrator Penuh (Semua Akses)'
                                : effectivePerms.length > 0
                                ? effectivePerms
                                    .map((p) => SHORT_PERM_LABEL.get(p) || p)
                                    .join(', ')
                                : 'Belum diberi kewenangan khusus'}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-800 sm:border-t-0">
                          {canEditEntryRow && !isSelf && onSetVerificationStatus && (
                            <>
                              {verStatus !== 'verified' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    setErrorMsg(null);
                                    try {
                                      await onSetVerificationStatus(entry, 'verified');
                                    } catch (err) {
                                      setErrorMsg(
                                        err instanceof Error ? err.message : 'Gagal memverifikasi pengguna.'
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                  className="min-h-[40px] px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verifikasi</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    setErrorMsg(null);
                                    try {
                                      await onSetVerificationStatus(entry, 'pending');
                                    } catch (err) {
                                      setErrorMsg(
                                        err instanceof Error ? err.message : 'Gagal mengubah status verifikasi.'
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                  title="Tangguhkan verifikasi pengguna"
                                  className="min-h-[40px] px-2.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Tangguhkan</span>
                                </button>
                              )}

                              {verStatus !== 'rejected' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    setErrorMsg(null);
                                    try {
                                      await onSetVerificationStatus(entry, 'rejected');
                                    } catch (err) {
                                      setErrorMsg(
                                        err instanceof Error ? err.message : 'Gagal menonaktifkan pengguna.'
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                  title="Tolak / nonaktifkan verifikasi pengguna"
                                  aria-label={`Nonaktifkan ${entry.fullName}`}
                                  className="min-h-[40px] min-w-[40px] rounded-lg border border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center cursor-pointer disabled:opacity-50"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}

                          {canEditEntryRow && onUpdateEntryDetails && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEditDetails(entry)}
                              aria-label={`Edit data ${entry.fullName}`}
                              className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                isEditingDetailsThis
                                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          {canManageRbac && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEditRbac(entry)}
                              className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                isEditingThis
                                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Atur Role</span>
                            </button>
                          )}

                          {canEditEntryRow && entry.claimedUid && !isSelf && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onResetClaim(entry)}
                              title="Reset klaim akun agar warga dapat mendaftar ulang"
                              className="min-h-[40px] px-2.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
                          )}

                          {canEditEntryRow && !isSelf && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onDeleteEntry(entry)}
                              aria-label={`Hapus ${entry.fullName}`}
                              className="min-h-[40px] min-w-[40px] rounded-lg border border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Resident Details Editor */}
                      {canEditEntryRow && isEditingDetailsThis && onUpdateEntryDetails && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Nama Lengkap
                              </label>
                              <input
                                type="text"
                                maxLength={75}
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Blok Rumah
                              </label>
                              <input
                                type="text"
                                maxLength={25}
                                value={editHouseBlock}
                                onChange={(e) => setEditHouseBlock(e.target.value)}
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Status Hunian
                              </label>
                              <select
                                value={entry.role === 'pengurus' ? 'pengurus' : editResidentStatus}
                                disabled={entry.role === 'pengurus'}
                                onChange={(e) =>
                                  setEditResidentStatus(e.target.value as ResidentStatus)
                                }
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-60"
                              >
                                <option value="tetap">Warga Tetap</option>
                                <option value="kontrak">Warga Kontrak</option>
                                {entry.role === 'pengurus' && (
                                  <option value="pengurus">Pengurus</option>
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Status Keluarga (Tarif)
                              </label>
                              <select
                                value={editFamilyStatus}
                                onChange={(e) =>
                                  setEditFamilyStatus(e.target.value as FamilyStatus)
                                }
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              >
                                <option value="umum">Umum (Suami Istri)</option>
                                <option value="khusus">Khusus (Ortu Tunggal)</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingDetailsId(null)}
                              className="min-h-[34px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={busy || !editFullName.trim() || !editHouseBlock.trim()}
                              onClick={() => void handleSaveInlineDetails(entry)}
                              className="min-h-[34px] px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                            >
                              {busy ? 'Menyimpan...' : 'Simpan Data'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline RBAC Editor (Ketua RT / Full Admin only) */}
                      {canManageRbac && isEditingThis && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">Role Akun</label>
                              <select
                                value={editRole}
                                onChange={(e) => {
                                  const nextRole = e.target.value as LoginRole;
                                  setEditRole(nextRole);
                                  if (nextRole === 'pengurus' && editPermissions.length === 0) {
                                    setEditPermissions([
                                      ...DEFAULT_PERMISSIONS_BY_POSITION[editPosition],
                                    ]);
                                  }
                                }}
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                              >
                                <option value="warga">Warga Biasa</option>
                                <option value="pengurus">Pengurus RT</option>
                              </select>
                            </div>

                            {editRole === 'pengurus' && (
                              <div>
                                <label className="block text-[11px] font-semibold mb-1">
                                  Jabatan Pengurus
                                </label>
                                <select
                                  value={editPosition}
                                  onChange={(e) => {
                                    const nextPos = e.target.value as PengurusPosition;
                                    setEditPosition(nextPos);
                                    setEditPermissions([
                                      ...DEFAULT_PERMISSIONS_BY_POSITION[nextPos],
                                    ]);
                                  }}
                                  className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                >
                                  {POSITION_OPTIONS.map((p) => (
                                    <option key={p} value={p}>
                                      {PENGURUS_POSITION_LABELS[p]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {editRole === 'pengurus' && (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                {PENGURUS_POSITION_DESCRIPTIONS[editPosition]}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {RBAC_PERMISSION_META.map((perm) => {
                                  const checked =
                                    editPosition === 'ketua_rt' ||
                                    editPermissions.includes(perm.id);
                                  const locked = editPosition === 'ketua_rt';
                                  return (
                                    <label
                                      key={perm.id}
                                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                                        checked
                                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100'
                                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                                      } ${locked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={locked}
                                        onChange={() =>
                                          setEditPermissions((prev) =>
                                            prev.includes(perm.id)
                                              ? prev.filter((p) => p !== perm.id)
                                              : [...prev, perm.id]
                                          )
                                        }
                                        className="w-3.5 h-3.5 accent-emerald-700 shrink-0"
                                      />
                                      <span className="font-semibold truncate">{perm.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEntryId(null)}
                              className="min-h-[34px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSaveInlineRbac(entry)}
                              className="min-h-[34px] px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                            >
                              {busy ? 'Menyimpan...' : 'Simpan Kewenangan'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
