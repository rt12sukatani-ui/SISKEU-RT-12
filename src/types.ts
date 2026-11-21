export type ResidentStatus = 'tetap' | 'kontrak' | 'pengurus';
export type LoginRole = 'warga' | 'pengurus';
export type PengurusPosition = 'ketua_rt' | 'sekretaris' | 'bendahara' | 'pengurus_lain';
export type RbacPermission =
  | 'manage_residents'
  | 'manage_announcements'
  | 'manage_kas'
  | 'manage_reports'
  | 'manage_emergencies'
  | 'manage_settings';
export type FamilyStatus = 'umum' | 'khusus';
export type TransactionType = 'income' | 'expense';
export type TransactionCategory =
  | 'iuran_bulanan'
  | 'donasi'
  | 'kebersihan'
  | 'keamanan'
  | 'sosial'
  | 'perbaikan'
  | 'lainnya';
export type PaymentMethod = 'transfer' | 'qris' | 'tunai';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'kurang_bayar';
export type AnnouncementCategory = 'penting' | 'keuangan' | 'kegiatan' | 'keamanan' | 'kesehatan';
export type EmergencyType = 'medis' | 'keamanan' | 'kebakaran' | 'bencana';
export type EmergencyStatus = 'active' | 'responding' | 'resolved';
export type NotificationType =
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_reminder'
  | 'emergency'
  | 'announcement';

export type AppTab = 'beranda' | 'kas' | 'laporan' | 'pengumuman' | 'darurat';

export interface AdminRoleRecord {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | PengurusPosition;
  permissions?: RbacPermission[];
  registryId?: string;
  createdAt?: unknown;
}

export interface RbacContext {
  isPengurus: boolean;
  isFullAdmin: boolean;
  position: PengurusPosition | 'warga';
  positionLabel: string;
  permissions: RbacPermission[];
  canManageResidents: boolean;
  canManageAnnouncements: boolean;
  canManageKas: boolean;
  canManageReports: boolean;
  canManageEmergencies: boolean;
  canManageSettings: boolean;
}

export interface ResidentPublic {
  uid: string;
  username?: string;
  accountRole?: LoginRole;
  pengurusPosition?: PengurusPosition;
  permissions?: RbacPermission[];
  registryId?: string;
  displayName: string;
  houseBlock: string;
  residentStatus: ResidentStatus;
  familyStatus?: FamilyStatus;
  familyStatusLog?: string[];
  lastPaidMonth?: string;
  elderlyMode: boolean;
  communityId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ResidentRegistryEntry {
  registryId: string;
  fullName: string;
  houseBlock: string;
  role: LoginRole;
  pengurusPosition?: PengurusPosition;
  permissions?: RbacPermission[];
  residentStatus: ResidentStatus;
  familyStatus: FamilyStatus;
  claimedUid: string;
  claimedUsername?: string;
  communityId: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserAccountLookup {
  uid: string;
  username: string;
  role: LoginRole;
  registryId: string;
  passwordHash?: string;
  createdAt?: unknown;
}

export interface AppUserSession {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  role: LoginRole;
}

export interface SheetDbInfo {
  mode: 'webapp' | 'oauth';
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  webAppUrl?: string;
  lastSyncedAtIso?: string;
}

export interface SheetConnection {
  mode: 'webapp' | 'oauth';
  spreadsheetId: string;
  webAppUrl?: string;
  accessToken?: string;
}

export interface PrivateProfileData {
  phone: string;
  nikMasked: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface PrivateHealthData {
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  medications: string;
  insuranceProvider: string;
  shareInEmergency: boolean;
}

export interface PrivateDataRecord {
  id: string;
  uid: string;
  docType: 'profile' | 'health';
  encryptedPayload: string;
  encryptionAlg: string;
  shareInEmergency?: boolean;
  emergencySummary?: string;
  updatedAt?: string;
}

export interface KasTransaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  title: string;
  amount: number;
  billingMonth: string;
  residentUid: string;
  residentName: string;
  houseBlock: string;
  familyStatus?: FamilyStatus;
  paymentMethod: PaymentMethod;
  proofImageData?: string;
  status: TransactionStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  notes?: string;
  communityId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isOfflinePending?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  priority: 'normal' | 'urgent';
  authorUid: string;
  authorName: string;
  communityId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmergencyAlert {
  id: string;
  reporterUid: string;
  reporterName: string;
  houseBlock: string;
  emergencyType: EmergencyType;
  description?: string;
  locationText?: string;
  medicalSummary?: string;
  emergencyContact?: string;
  status: EmergencyStatus;
  responderName?: string;
  communityId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isOfflinePending?: boolean;
}

export interface UserNotification {
  id: string;
  targetUid: string;
  senderUid: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedId?: string;
  createdAt?: unknown;
}

export interface RtSettings {
  rtName: string;
  rwName: string;
  kelurahan: string;
  monthlyDuesAmount: number;
  dueDayOfMonth: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  emergencyPhoneRT?: string;
  emergencyPhoneMedical?: string;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  imageData: string;
  sortOrder: number;
  uploadedBy: string;
  communityId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
