import type {
  AdminRoleRecord,
  PengurusPosition,
  RbacContext,
  RbacPermission,
  ResidentPublic,
} from '../types';

export const ALL_RBAC_PERMISSIONS: RbacPermission[] = [
  'manage_residents',
  'manage_announcements',
  'manage_kas',
  'manage_reports',
  'manage_emergencies',
  'manage_settings',
];

export const PENGURUS_POSITION_LABELS: Record<PengurusPosition, string> = {
  ketua_rt: 'Ketua RT',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
  pengurus_lain: 'Pengurus Lain',
};

export const PENGURUS_POSITION_DESCRIPTIONS: Record<PengurusPosition, string> = {
  ketua_rt: 'Akses administrator penuh (kas, warga, pengumuman, darurat, pengaturan & hak akses).',
  sekretaris: 'Akses administrasi lingkungan, pengumuman, slideshow kegiatan & pengelolaan data warga.',
  bendahara: 'Akses pengelolaan kas RT, verifikasi iuran bulanan, dan laporan keuangan.',
  pengurus_lain: 'Akses terbatas sesuai kewenangan spesifik yang diberikan oleh Ketua RT.',
};

export const RBAC_PERMISSION_META: Array<{
  id: RbacPermission;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'manage_residents',
    label: 'Administrasi Data Warga',
    shortLabel: 'Data Warga',
    description: 'Tambah, impor, sinkronkan, dan kelola Database Warga.',
  },
  {
    id: 'manage_announcements',
    label: 'Administrasi & Pengumuman',
    shortLabel: 'Pengumuman',
    description: 'Buat/hapus pengumuman warga & kelola slideshow kegiatan.',
  },
  {
    id: 'manage_kas',
    label: 'Pengelolaan Kas & Verifikasi Iuran',
    shortLabel: 'Kelola Kas',
    description: 'Verifikasi bukti bayar warga serta catat pemasukan & pengeluaran RT.',
  },
  {
    id: 'manage_reports',
    label: 'Laporan Keuangan & Pengingat',
    shortLabel: 'Laporan',
    description: 'Kelola rekap laporan keuangan bulanan dan kirim pengingat iuran warga.',
  },
  {
    id: 'manage_emergencies',
    label: 'Respon Sinyal Darurat SOS',
    shortLabel: 'Darurat SOS',
    description: 'Tindak lanjuti dan selesaikan laporan darurat warga.',
  },
  {
    id: 'manage_settings',
    label: 'Pengaturan RT & Kewenangan RBAC',
    shortLabel: 'Admin Penuh',
    description: 'Ubah tarif iuran, rekening RT, serta atur jabatan & kewenangan pengurus.',
  },
];

export const DEFAULT_PERMISSIONS_BY_POSITION: Record<PengurusPosition, RbacPermission[]> = {
  ketua_rt: [...ALL_RBAC_PERMISSIONS],
  sekretaris: ['manage_residents', 'manage_announcements', 'manage_emergencies'],
  bendahara: ['manage_kas', 'manage_reports'],
  pengurus_lain: [],
};

export function normalizePengurusPermissions(
  position: PengurusPosition,
  customPermissions?: RbacPermission[]
): RbacPermission[] {
  if (position === 'ketua_rt') {
    return [...ALL_RBAC_PERMISSIONS];
  }
  const source =
    Array.isArray(customPermissions) && customPermissions.length > 0
      ? customPermissions
      : position === 'pengurus_lain' && Array.isArray(customPermissions)
      ? customPermissions
      : DEFAULT_PERMISSIONS_BY_POSITION[position];

  const validSet = new Set<RbacPermission>(ALL_RBAC_PERMISSIONS);
  return Array.from(new Set(source.filter((p) => validSet.has(p))));
}

export function resolveUserRbac(params: {
  isBootstrappedAdmin: boolean;
  adminRecord: AdminRoleRecord | null;
  profile: ResidentPublic | null;
}): RbacContext {
  const { isBootstrappedAdmin, adminRecord, profile } = params;

  if (isBootstrappedAdmin) {
    return {
      isPengurus: true,
      isFullAdmin: true,
      position: 'ketua_rt',
      positionLabel: PENGURUS_POSITION_LABELS.ketua_rt,
      permissions: [...ALL_RBAC_PERMISSIONS],
      canManageResidents: true,
      canManageAnnouncements: true,
      canManageKas: true,
      canManageReports: true,
      canManageEmergencies: true,
      canManageSettings: true,
    };
  }

  const isPengurus = Boolean(
    adminRecord ||
      profile?.accountRole === 'pengurus' ||
      profile?.residentStatus === 'pengurus'
  );

  if (!isPengurus) {
    return {
      isPengurus: false,
      isFullAdmin: false,
      position: 'warga',
      positionLabel: 'Warga',
      permissions: [],
      canManageResidents: false,
      canManageAnnouncements: false,
      canManageKas: false,
      canManageReports: false,
      canManageEmergencies: false,
      canManageSettings: false,
    };
  }

  let position: PengurusPosition = 'pengurus_lain';
  if (adminRecord?.role === 'admin' || adminRecord?.role === 'ketua_rt') {
    position = 'ketua_rt';
  } else if (
    adminRecord?.role === 'sekretaris' ||
    adminRecord?.role === 'bendahara' ||
    adminRecord?.role === 'pengurus_lain'
  ) {
    position = adminRecord.role;
  } else if (profile?.pengurusPosition) {
    position = profile.pengurusPosition;
  } else if (profile?.residentStatus === 'pengurus' && !adminRecord) {
    position = 'ketua_rt';
  }

  const rawPerms =
    adminRecord?.permissions !== undefined
      ? adminRecord.permissions
      : profile?.permissions;

  const permissions = normalizePengurusPermissions(position, rawPerms);
  const permSet = new Set<RbacPermission>(permissions);
  const isFullAdmin = position === 'ketua_rt' || permSet.has('manage_settings');

  return {
    isPengurus: true,
    isFullAdmin,
    position,
    positionLabel: PENGURUS_POSITION_LABELS[position],
    permissions,
    canManageResidents: isFullAdmin || permSet.has('manage_residents'),
    canManageAnnouncements: isFullAdmin || permSet.has('manage_announcements'),
    canManageKas: isFullAdmin || permSet.has('manage_kas'),
    canManageReports: isFullAdmin || permSet.has('manage_reports'),
    canManageEmergencies: isFullAdmin || permSet.has('manage_emergencies'),
    canManageSettings: isFullAdmin || permSet.has('manage_settings'),
  };
}
