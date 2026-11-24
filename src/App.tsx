import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  BookOpen,
  FileSpreadsheet,
  FolderPlus,
  Link2,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnnouncementsView } from './components/AnnouncementsView';
import { CashflowAndDuesView } from './components/CashflowAndDuesView';
import { DashboardView } from './components/DashboardView';
import { HeaderNav } from './components/HeaderNav';
import { LoginScreen } from './components/LoginScreen';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MonthlyReportView } from './components/MonthlyReportView';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { ResidentRegistryModal } from './components/ResidentRegistryModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  decryptSensitiveJson,
  encryptSensitiveJson,
  hashPassword,
  verifyPassword,
} from './lib/crypto';
import {
  clearGoogleAccessToken,
  formatGoogleAuthError,
  getGoogleAccessToken,
  googleWorkspaceSignIn,
  googleWorkspaceSignOut,
} from './lib/googleAuth';
import {
  enqueueOfflineAction,
  getCachedBannerSlides,
  getOfflineQueue,
  removeOfflineAction,
  saveCachedBannerSlides,
  saveOfflineSnapshot,
} from './lib/offlineSync';
import {
  adminRecordToRow,
  announcementToRow,
  appendSheetRows,
  BUILTIN_SHEETS_WEBAPP_URL,
  clearSavedSpreadsheetId,
  clearSavedWebAppUrl,
  clearVerifiedSession,
  connectAndEnsureSchema,
  connectWebAppAndEnsureSchema,
  createAppDatabaseSpreadsheet,
  deleteSheetRowsByKey,
  emergencyToRow,
  extractAndSaveWebAppUrlFromLocation,
  extractSpreadsheetId,
  extractWebAppUrl,
  fetchAllSheetTables,
  findAppDatabaseSpreadsheet,
  generateRecordId,
  getDefaultWebAppUrl,
  getSavedSpreadsheetId,
  getSavedVerifiedSession,
  notificationToRow,
  privateDataToRow,
  registryEntryToRow,
  saveVerifiedSession,
  settingsToRow,
  SheetsAuthExpiredError,
  SHEET_TABS,
  slideToRow,
  transactionToRow,
  upsertSheetRowsByKey,
  userAccountToRow,
  userProfileToRow,
} from './lib/sheetsDb';
import type {
  AdminRoleRecord,
  Announcement,
  AnnouncementCategory,
  AppTab,
  AppUserSession,
  BannerSlide,
  EmergencyAlert,
  EmergencyType,
  FamilyStatus,
  KasTransaction,
  LoginRole,
  PaymentMethod,
  PengurusPosition,
  PrivateDataRecord,
  PrivateHealthData,
  PrivateProfileData,
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
} from './types';
import {
  computeResidentRegistryId,
  findMatchingRegistryEntry,
  isValidUsername,
  normalizeUsername,
  usernameToAuthEmail,
} from './utils/authRegistry';
import {
  buildUpdatedFamilyStatusLog,
  calculateResidentLedger,
  formatMonthLabel,
  formatRupiah,
  getCurrentYearMonth,
  getEffectiveFamilyStatusChangeMonth,
  getRequiredTariff,
  getResidentFamilyStatusForMonth,
  getResidentPaidMonthsCoverage,
  sendBrowserPush,
} from './utils/format';
import {
  ALL_RBAC_PERMISSIONS,
  normalizePengurusPermissions,
  resolveUserRbac,
} from './utils/rbac';

const DEFAULT_RT_SETTINGS: RtSettings = {
  rtName: 'RT 12',
  rwName: 'RW 20',
  kelurahan: 'Sukatani',
  monthlyDuesAmount: 120000,
  dueDayOfMonth: 10,
  bankName: 'Bank BJB',
  bankAccountNumber: '0139-2820-9410-0',
  bankAccountHolder: 'YEPIN ISKANDAR',
  emergencyPhoneRT: '112',
  emergencyPhoneMedical: '118',
  updatedBy: 'system',
};

const DEFAULT_PRIVATE_PROFILE: PrivateProfileData = {
  phone: '',
  nikMasked: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const DEFAULT_HEALTH_PROFILE: PrivateHealthData = {
  bloodType: 'Belum diketahui',
  allergies: '',
  chronicConditions: '',
  medications: '',
  insuranceProvider: '',
  shareInEmergency: true,
};

const BOOTSTRAPPED_ADMIN_EMAILS = ['pinasta@gmail.com', 'retakanbumi@gmail.com'];

function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const getMs = (val: unknown): number => {
      if (!val) return 0;
      if (
        typeof val === 'object' &&
        val !== null &&
        'toMillis' in val &&
        typeof (val as { toMillis: () => number }).toMillis === 'function'
      ) {
        return (val as { toMillis: () => number }).toMillis();
      }
      if (typeof val === 'string' || typeof val === 'number') {
        const t = new Date(val).getTime();
        return Number.isNaN(t) ? 0 : t;
      }
      return 0;
    };
    return getMs(b.createdAt) - getMs(a.createdAt);
  });
}

function findRegistryForUser(
  entries: ResidentRegistryEntry[],
  opts: {
    uid?: string;
    registryId?: string;
    username?: string;
    fullName?: string;
    houseBlock?: string;
  }
): ResidentRegistryEntry | undefined {
  if (opts.registryId) {
    const byId = entries.find((e) => e.registryId === opts.registryId);
    if (byId) return byId;
  }
  if (opts.uid) {
    const byUid = entries.find((e) => e.claimedUid === opts.uid);
    if (byUid) return byUid;
  }
  if (opts.username) {
    const normU = normalizeUsername(opts.username);
    const byUser = entries.find(
      (e) => e.claimedUsername && normalizeUsername(e.claimedUsername) === normU
    );
    if (byUser) return byUser;
  }
  if (opts.fullName && opts.houseBlock) {
    return findMatchingRegistryEntry(entries, opts.fullName, opts.houseBlock);
  }
  return undefined;
}

function checkRegistryVerification(
  entries: ResidentRegistryEntry[],
  opts: {
    uid: string;
    registryId?: string;
    username?: string;
    fullName?: string;
    houseBlock?: string;
    expectedRole?: LoginRole;
  }
): { ok: true; entry: ResidentRegistryEntry } | { ok: false; reason: string } {
  if (entries.length === 0) {
    return {
      ok: false,
      reason:
        'Database Warga (tab "database_warga") masih kosong. Minta Ketua RT mengisi data warga',
    };
  }

  const matched = findRegistryForUser(entries, opts);
  if (!matched) {
    return {
      ok: false,
      reason:
        'Data akun Anda tidak ditemukan atau sudah dihapus dari Database Warga (tab "database_warga").',
    };
  }

  const status = matched.verificationStatus || 'verified';
  if (status === 'rejected') {
    return {
      ok: false,
      reason: `Akun "${matched.fullName}" (${matched.houseBlock}) dinonaktifkan di Database Warga. Hubungi Ketua RT.`,
    };
  }

  if (matched.claimedUid && matched.claimedUid !== opts.uid) {
    return {
      ok: false,
      reason:
        'Klaim akun Anda di Database Warga telah direset atau dialihkan. Silakan daftar ulang atau hubungi Pengurus RT.',
    };
  }

  if (opts.expectedRole && matched.role !== opts.expectedRole) {
    return {
      ok: false,
      reason: `Role tidak sesuai Database Warga. Data "${matched.fullName}" terdaftar sebagai ${
        matched.role === 'pengurus' ? 'Pengurus' : 'Warga'
      }.`,
    };
  }

  return { ok: true, entry: matched };
}

export default function App() {
  const isOnline = useOnlineStatus();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('kaswarga_dark_mode') === 'true';
  });
  const [elderlyMode, setElderlyMode] = useState<boolean>(() => {
    return localStorage.getItem('kaswarga_elderly_mode') === 'true';
  });

  // Google Workspace OAuth & Spreadsheet connection state
  const [authReady, setAuthReady] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleDisplayName, setGoogleDisplayName] = useState<string | null>(null);
  const [googleUid, setGoogleUid] = useState<string | null>(null);
  const [sheetInfo, setSheetInfo] = useState<SheetDbInfo | null>(null);
  const [hasSyncedSheetOnce, setHasSyncedSheetOnce] = useState(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active SISKEU RT user session (Warga / Pengurus)
  const [currentUser, setCurrentUser] = useState<AppUserSession | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isBootstrappedAdminUser, setIsBootstrappedAdminUser] = useState(false);
  const [adminRecord, setAdminRecord] = useState<AdminRoleRecord | null>(null);
  const [profile, setProfile] = useState<ResidentPublic | null>(null);
  const [privateProfile, setPrivateProfile] = useState<PrivateProfileData>(DEFAULT_PRIVATE_PROFILE);
  const [healthProfile, setHealthProfile] = useState<PrivateHealthData>(DEFAULT_HEALTH_PROFILE);

  // Spreadsheet database tables cached in state
  const [rtSettings, setRtSettings] = useState<RtSettings>(DEFAULT_RT_SETTINGS);
  const [residents, setResidents] = useState<ResidentPublic[]>([]);
  const [registryEntries, setRegistryEntries] = useState<ResidentRegistryEntry[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccountLookup[]>([]);
  const [adminRecords, setAdminRecords] = useState<AdminRoleRecord[]>([]);
  const [privateDataRecords, setPrivateDataRecords] = useState<PrivateDataRecord[]>([]);
  const [transactions, setTransactions] = useState<KasTransaction[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [allNotifications, setAllNotifications] = useState<UserNotification[]>([]);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>(() => getCachedBannerSlides());

  const [activeTab, setActiveTab] = useState<AppTab>('beranda');
  const [openPaymentModalOnKas, setOpenPaymentModalOnKas] = useState(false);
  const [kasInitialFilterTab, setKasInitialFilterTab] = useState<
    'all' | 'pending' | 'kurang_bayar' | 'mine' | 'expense'
  >('all');
  const [focusKasTransactionsKey, setFocusKasTransactionsKey] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [showNewUserBanner, setShowNewUserBanner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<{
    title: string;
    body: string;
    urgent?: boolean;
  } | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(
    () => getOfflineQueue().length
  );
  const [adminSheetInput, setAdminSheetInput] = useState('');

  const initialAnnouncementIdsRef = useRef<Set<string> | null>(null);
  const initialNotificationIdsRef = useRef<Set<string> | null>(null);
  const initialEmergencyIdsRef = useRef<Set<string> | null>(null);
  const isMutatingRef = useRef(false);

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    return sortByCreatedAtDesc(
      allNotifications.filter((n) => n.targetUid === currentUser.uid)
    );
  }, [allNotifications, currentUser]);

  const rbac = useMemo(
    () =>
      resolveUserRbac({
        isBootstrappedAdmin: isBootstrappedAdminUser,
        adminRecord,
        profile,
      }),
    [isBootstrappedAdminUser, adminRecord, profile]
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('kaswarga_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('elderly-mode', elderlyMode);
    localStorage.setItem('kaswarga_elderly_mode', String(elderlyMode));
  }, [elderlyMode]);

  const scrollPageToTop = useCallback(() => {
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    document.body.scrollTop = 0;
    window.requestAnimationFrame(() => {
      html.style.scrollBehavior = prevScrollBehavior;
    });
  }, []);

  useEffect(() => {
    scrollPageToTop();
  }, [activeTab, scrollPageToTop]);

  const showToast = useCallback((title: string, body: string, urgent = false) => {
    setLiveToast({ title, body, urgent });
    sendBrowserPush(title, body);
    window.setTimeout(() => {
      setLiveToast((prev) => (prev?.title === title && prev?.body === body ? null : prev));
    }, 6500);
  }, []);

  const handleExpiredToken = useCallback(() => {
    clearGoogleAccessToken();
    setGoogleConnected(false);
    setCurrentUser(null);
    setProfile(null);
    setAdminRecord(null);
    setIsBootstrappedAdminUser(false);
    setLoginError(
      'Sesi akses Google Spreadsheet telah berakhir. Silakan hubungkan ulang atau gunakan koneksi Apps Script Web App.'
    );
  }, []);

  const getActiveSheetConnection = useCallback((): SheetConnection | null => {
    if (!sheetInfo?.spreadsheetId) return null;
    if (sheetInfo.mode === 'webapp') {
      if (!sheetInfo.webAppUrl) return null;
      return {
        mode: 'webapp',
        spreadsheetId: sheetInfo.spreadsheetId,
        webAppUrl: sheetInfo.webAppUrl,
      };
    }
    const token = getGoogleAccessToken();
    if (!token) return null;
    return {
      mode: 'oauth',
      spreadsheetId: sheetInfo.spreadsheetId,
      accessToken: token,
    };
  }, [sheetInfo?.mode, sheetInfo?.spreadsheetId, sheetInfo?.webAppUrl]);

  const ensureDefaultSpreadsheetConnected = useCallback(async (): Promise<{
    conn: SheetConnection;
    info: SheetDbInfo;
  } | null> => {
    const existingConn = getActiveSheetConnection();
    if (existingConn && sheetInfo) {
      return { conn: existingConn, info: sheetInfo };
    }
    const candidateUrl = getDefaultWebAppUrl() || BUILTIN_SHEETS_WEBAPP_URL;
    let info: SheetDbInfo;
    try {
      info = await connectWebAppAndEnsureSchema(candidateUrl, DEFAULT_RT_SETTINGS);
    } catch (err) {
      if (candidateUrl !== BUILTIN_SHEETS_WEBAPP_URL) {
        clearSavedWebAppUrl();
        info = await connectWebAppAndEnsureSchema(
          BUILTIN_SHEETS_WEBAPP_URL,
          DEFAULT_RT_SETTINGS
        );
      } else {
        throw err;
      }
    }
    const conn: SheetConnection = {
      mode: 'webapp',
      spreadsheetId: info.spreadsheetId,
      webAppUrl: info.webAppUrl,
    };
    setSheetInfo(info);
    setGoogleConnected(true);
    setGoogleUserEmail('Google Spreadsheet (Apps Script)');
    return { conn, info };
  }, [getActiveSheetConnection, sheetInfo]);

  const requireActiveSheet = useCallback((): SheetConnection | null => {
    if (!sheetInfo?.spreadsheetId) {
      showToast(
        'Database Spreadsheet Belum Terhubung',
        'Hubungkan URL Web App Apps Script Google Spreadsheet RT Anda terlebih dahulu.',
        true
      );
      return null;
    }
    if (sheetInfo.mode === 'oauth') {
      const token = getGoogleAccessToken();
      if (!token) {
        handleExpiredToken();
        return null;
      }
      return {
        mode: 'oauth',
        spreadsheetId: sheetInfo.spreadsheetId,
        accessToken: token,
      };
    }
    if (!sheetInfo.webAppUrl) {
      showToast(
        'URL Web App Belum Lengkap',
        'Tempel ulang URL Web App Google Apps Script di halaman koneksi.',
        true
      );
      return null;
    }
    return {
      mode: 'webapp',
      spreadsheetId: sheetInfo.spreadsheetId,
      webAppUrl: sheetInfo.webAppUrl,
    };
  }, [
    handleExpiredToken,
    sheetInfo?.mode,
    sheetInfo?.spreadsheetId,
    sheetInfo?.webAppUrl,
    showToast,
  ]);

  const refreshSpreadsheetData = useCallback(
    async (overrideConn?: SheetConnection, silent = false) => {
      const conn = overrideConn || getActiveSheetConnection();
      if (!conn) return null;

      if (!silent) setIsSyncing(true);
      try {
        const snap = await fetchAllSheetTables(conn);

        if (snap.rtSettings) setRtSettings(snap.rtSettings);
        setRegistryEntries(
          [...snap.registryEntries].sort((a, b) => a.houseBlock.localeCompare(b.houseBlock))
        );
        setUserAccounts(snap.userAccounts);
        setResidents([...snap.users].sort((a, b) => a.houseBlock.localeCompare(b.houseBlock)));
        setAdminRecords(snap.admins);
        setPrivateDataRecords(snap.privateData);
        setTransactions(sortByCreatedAtDesc(snap.transactions));

        const sortedAnnouncements = sortByCreatedAtDesc(snap.announcements);
        if (initialAnnouncementIdsRef.current === null) {
          initialAnnouncementIdsRef.current = new Set(sortedAnnouncements.map((a) => a.id));
        } else {
          const newest = sortedAnnouncements.find(
            (a) => !initialAnnouncementIdsRef.current?.has(a.id)
          );
          if (newest) {
            initialAnnouncementIdsRef.current.add(newest.id);
            showToast(
              `Pengumuman RT: ${newest.title}`,
              newest.body.slice(0, 120),
              newest.priority === 'urgent'
            );
          }
        }
        setAnnouncements(sortedAnnouncements);

        const sortedEmergencies = sortByCreatedAtDesc(snap.emergencies);
        if (initialEmergencyIdsRef.current === null) {
          initialEmergencyIdsRef.current = new Set(sortedEmergencies.map((e) => e.id));
        } else {
          const newest = sortedEmergencies.find(
            (e) => e.status === 'active' && !initialEmergencyIdsRef.current?.has(e.id)
          );
          if (newest) {
            initialEmergencyIdsRef.current.add(newest.id);
            showToast(
              `DARURAT ${newest.emergencyType.toUpperCase()}: ${newest.houseBlock}`,
              `${newest.reporterName}: ${newest.description || 'Butuh bantuan segera!'}`,
              true
            );
          }
        }
        setEmergencies(sortedEmergencies);

        const sortedNotifs = sortByCreatedAtDesc(snap.notifications);
        if (currentUser) {
          const myNotifs = sortedNotifs.filter((n) => n.targetUid === currentUser.uid);
          if (initialNotificationIdsRef.current === null) {
            initialNotificationIdsRef.current = new Set(myNotifs.map((n) => n.id));
          } else {
            const newest = myNotifs.find(
              (n) => !n.isRead && !initialNotificationIdsRef.current?.has(n.id)
            );
            if (newest) {
              initialNotificationIdsRef.current.add(newest.id);
              showToast(newest.title, newest.message, newest.type === 'emergency');
            }
          }
        }
        setAllNotifications(sortedNotifs);

        setBannerSlides(snap.slides);
        saveCachedBannerSlides(snap.slides);
        setHasSyncedSheetOnce(true);
        setSheetInfo((prev) =>
          prev
            ? {
                ...prev,
                lastSyncedAtIso: new Date().toISOString(),
              }
            : prev
        );

        return snap;
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) {
          handleExpiredToken();
        } else if (!silent) {
          setLoginError(
            err instanceof Error
              ? `Gagal membaca Google Spreadsheet: ${err.message}`
              : 'Gagal membaca Google Spreadsheet.'
          );
        }
        return null;
      } finally {
        if (!silent) setIsSyncing(false);
      }
    },
    [getActiveSheetConnection, currentUser, showToast, handleExpiredToken]
  );

  // Sync active user profile/admin changes from fresh sheet snapshots
  useEffect(() => {
    if (!currentUser) return;
    const latestProfile = residents.find((r) => r.uid === currentUser.uid);
    if (latestProfile) {
      setProfile(latestProfile);
      if (typeof latestProfile.elderlyMode === 'boolean') {
        setElderlyMode(latestProfile.elderlyMode);
      }
    }
    const latestAdmin = adminRecords.find((a) => a.uid === currentUser.uid) || null;
    if (latestAdmin) {
      setAdminRecord(latestAdmin);
    }
  }, [currentUser, residents, adminRecords]);

  // Decrypt private profile & health whenever privateDataRecords or currentUser updates
  useEffect(() => {
    if (!currentUser) {
      setPrivateProfile(DEFAULT_PRIVATE_PROFILE);
      setHealthProfile(DEFAULT_HEALTH_PROFILE);
      return;
    }

    let cancelled = false;
    const loadPrivate = async () => {
      const profRec = privateDataRecords.find(
        (p) => p.uid === currentUser.uid && p.docType === 'profile'
      );
      if (profRec?.encryptedPayload) {
        const decrypted = await decryptSensitiveJson<PrivateProfileData>(
          currentUser.uid,
          profRec.encryptedPayload
        );
        if (!cancelled && decrypted) setPrivateProfile(decrypted);
      } else if (!cancelled) {
        setPrivateProfile(DEFAULT_PRIVATE_PROFILE);
      }

      const healthRec = privateDataRecords.find(
        (p) => p.uid === currentUser.uid && p.docType === 'health'
      );
      if (healthRec?.encryptedPayload) {
        const decrypted = await decryptSensitiveJson<PrivateHealthData>(
          currentUser.uid,
          healthRec.encryptedPayload
        );
        if (!cancelled && decrypted) setHealthProfile(decrypted);
      } else if (!cancelled) {
        setHealthProfile(DEFAULT_HEALTH_PROFILE);
      }
    };

    void loadPrivate();
    return () => {
      cancelled = true;
    };
  }, [currentUser, privateDataRecords]);

  // Auto-connect Google Spreadsheet on startup & automatically restore/verify saved user against database
  useEffect(() => {
    const urlFromLink = extractAndSaveWebAppUrlFromLocation();
    const savedSession = getSavedVerifiedSession();
    const startupWebAppUrl =
      urlFromLink ||
      extractWebAppUrl(savedSession?.webAppUrl || '') ||
      getDefaultWebAppUrl() ||
      BUILTIN_SHEETS_WEBAPP_URL;

    // Jika belum ada sesi tersimpan, langsung tampilkan portal login sambil menghubungkan database di latar
    if (!savedSession) {
      setAuthReady(true);
    }

    if (!startupWebAppUrl || !isOnline) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsConnectingSheet(true);
      try {
        let info: SheetDbInfo;
        try {
          info = await connectWebAppAndEnsureSchema(startupWebAppUrl, DEFAULT_RT_SETTINGS);
        } catch (err) {
          if (startupWebAppUrl !== BUILTIN_SHEETS_WEBAPP_URL) {
            clearSavedWebAppUrl();
            info = await connectWebAppAndEnsureSchema(
              BUILTIN_SHEETS_WEBAPP_URL,
              DEFAULT_RT_SETTINGS
            );
          } else {
            throw err;
          }
        }
        if (cancelled) return;
        setSheetInfo(info);
        setGoogleConnected(true);
        setGoogleUserEmail('Google Spreadsheet (Apps Script)');

        const snap = await refreshSpreadsheetData(
          {
            mode: 'webapp',
            spreadsheetId: info.spreadsheetId,
            webAppUrl: info.webAppUrl,
          },
          true
        );

        if (cancelled) return;
        if (!snap) {
          setSheetInfo(null);
          setHasSyncedSheetOnce(false);
          setLoginError(
            'Koneksi database tercapai, tetapi gagal memuat isi tabel Google Spreadsheet. Silakan klik "Hubungkan Database".'
          );
          return;
        }
        if (!savedSession) return;

        const normUser = normalizeUsername(savedSession.username);
        const accData = snap.userAccounts.find(
          (a) =>
            normalizeUsername(a.username) === normUser &&
            (!savedSession.uid || a.uid === savedSession.uid)
        );
        if (!accData) {
          clearVerifiedSession();
          return;
        }

        const existingProf = snap.users.find((u) => u.uid === accData.uid) || null;
        const dbCheck = checkRegistryVerification(snap.registryEntries, {
          uid: accData.uid,
          registryId: accData.registryId || savedSession.registryId || existingProf?.registryId,
          username: normUser,
          fullName: existingProf?.displayName || savedSession.displayName,
          houseBlock: existingProf?.houseBlock,
          expectedRole: savedSession.role,
        });

        if (!dbCheck.ok) {
          clearVerifiedSession();
          setLoginError(dbCheck.reason);
          return;
        }

        const reg = dbCheck.entry;
        const matchedAdmin = snap.admins.find((a) => a.uid === accData.uid) || null;
        const isPengurus = reg.role === 'pengurus';
        const effectivePos: PengurusPosition = isPengurus
          ? reg.pengurusPosition || matchedAdmin?.role === 'admin'
            ? reg.pengurusPosition || 'ketua_rt'
            : reg.pengurusPosition || 'pengurus_lain'
          : 'pengurus_lain';
        const effectivePerms = isPengurus
          ? normalizePengurusPermissions(effectivePos, reg.permissions)
          : undefined;
        const nowIso = new Date().toISOString();

        const verifiedProfile: ResidentPublic = {
          ...(existingProf || {
            uid: accData.uid,
            elderlyMode: false,
            communityId: 'rt_warga',
            createdAt: accData.createdAt || nowIso,
          }),
          uid: accData.uid,
          username: normUser,
          accountRole: reg.role,
          ...(isPengurus ? { pengurusPosition: effectivePos, permissions: effectivePerms } : {}),
          registryId: reg.registryId,
          displayName: reg.fullName || existingProf?.displayName || savedSession.displayName,
          houseBlock: reg.houseBlock || existingProf?.houseBlock || '-',
          residentStatus: isPengurus ? 'pengurus' : reg.residentStatus || 'tetap',
          familyStatus: reg.familyStatus || existingProf?.familyStatus || 'umum',
          familyStatusLog: existingProf?.familyStatusLog?.length
            ? existingProf.familyStatusLog
            : [`${getCurrentYearMonth()}:${reg.familyStatus || 'umum'}`],
          verificationStatus: 'verified',
          elderlyMode: existingProf?.elderlyMode ?? false,
          communityId: existingProf?.communityId || 'rt_warga',
          updatedAt: existingProf?.updatedAt || nowIso,
        };

        const effectiveAdmin: AdminRoleRecord | null = isPengurus
          ? matchedAdmin || {
              uid: accData.uid,
              email: usernameToAuthEmail(normUser),
              name: verifiedProfile.displayName,
              role: effectivePos,
              permissions: effectivePerms,
              registryId: reg.registryId,
              createdAt: nowIso,
            }
          : null;

        setIsBootstrappedAdminUser(false);
        setAdminRecord(effectiveAdmin);
        setProfile(verifiedProfile);
        setElderlyMode(verifiedProfile.elderlyMode);
        setCurrentUser({
          uid: verifiedProfile.uid,
          email: usernameToAuthEmail(normUser),
          displayName: verifiedProfile.displayName,
          username: normUser,
          role: reg.role,
        });
        saveVerifiedSession({
          uid: verifiedProfile.uid,
          username: normUser,
          role: reg.role,
          registryId: reg.registryId,
          displayName: verifiedProfile.displayName,
          webAppUrl: info.webAppUrl,
          spreadsheetId: info.spreadsheetId,
          verifiedAtIso: savedSession.verifiedAtIso,
        });
        initialNotificationIdsRef.current = null;
      } catch (err) {
        if (!cancelled) {
          setSheetInfo(null);
          setHasSyncedSheetOnce(false);
          setLoginError(
            err instanceof Error
              ? err.message
              : 'Gagal menghubungkan ke Database Google Spreadsheet. Klik "Hubungkan Database" untuk mencoba lagi.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsConnectingSheet(false);
          setAuthReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuous database verification guard for active verified sessions
  useEffect(() => {
    if (!currentUser || isBootstrappedAdminUser || !sheetInfo?.spreadsheetId) return;
    if (registryEntries.length === 0) return;

    const dbCheck = checkRegistryVerification(registryEntries, {
      uid: currentUser.uid,
      registryId: profile?.registryId,
      username: currentUser.username,
      fullName: profile?.displayName,
      houseBlock: profile?.houseBlock,
    });

    if (!dbCheck.ok) {
      clearVerifiedSession();
      setCurrentUser(null);
      setProfile(null);
      setAdminRecord(null);
      setIsBootstrappedAdminUser(false);
      setSettingsOpen(false);
      setRegistryOpen(false);
      setLoginError(dbCheck.reason);
      showToast('Verifikasi Akun Berubah', dbCheck.reason, true);
    }
  }, [
    currentUser,
    isBootstrappedAdminUser,
    sheetInfo?.spreadsheetId,
    registryEntries,
    profile?.registryId,
    profile?.displayName,
    profile?.houseBlock,
    showToast,
  ]);

  // Periodic background polling of Google Spreadsheet every 25s
  useEffect(() => {
    if (!sheetInfo?.spreadsheetId || !isOnline) return;
    if (sheetInfo.mode === 'oauth' && !googleConnected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !isMutatingRef.current) {
        void refreshSpreadsheetData(undefined, true);
      }
    }, 25000);
    return () => window.clearInterval(timer);
  }, [googleConnected, sheetInfo?.mode, sheetInfo?.spreadsheetId, isOnline, refreshSpreadsheetData]);

  // Connect via Google Apps Script Web App URL (no Firebase, no OAuth verification errors)
  const handleConnectWebApp = useCallback(
    async (webAppUrlInput: string) => {
      setIsConnectingSheet(true);
      setLoginError(null);
      try {
        const targetUrl =
          extractWebAppUrl(webAppUrlInput || '') ||
          getDefaultWebAppUrl() ||
          BUILTIN_SHEETS_WEBAPP_URL;

        let info: SheetDbInfo;
        try {
          info = await connectWebAppAndEnsureSchema(targetUrl, DEFAULT_RT_SETTINGS, {
            forceSchema: true,
          });
        } catch (err) {
          if (targetUrl !== BUILTIN_SHEETS_WEBAPP_URL) {
            clearSavedWebAppUrl();
            info = await connectWebAppAndEnsureSchema(
              BUILTIN_SHEETS_WEBAPP_URL,
              DEFAULT_RT_SETTINGS,
              { forceSchema: true }
            );
          } else {
            throw err;
          }
        }

        setSheetInfo(info);
        setGoogleConnected(true);
        setGoogleUserEmail('Google Spreadsheet (Apps Script)');

        const snap = await refreshSpreadsheetData(
          {
            mode: 'webapp',
            spreadsheetId: info.spreadsheetId,
            webAppUrl: info.webAppUrl,
          },
          false
        );
        if (!snap) {
          setSheetInfo(null);
          setHasSyncedSheetOnce(false);
          throw new Error(
            'Berhasil terhubung ke Apps Script, tetapi gagal memuat isi tabel Spreadsheet. Silakan klik "Hubungkan Database" ulang.'
          );
        }

        showToast(
          'Google Spreadsheet Terhubung',
          `Berhasil terhubung ke "${info.spreadsheetTitle}" via Apps Script.`
        );
      } catch (err) {
        setLoginError(
          err instanceof Error
            ? err.message
            : 'Gagal menghubungkan URL Web App Google Apps Script.'
        );
      } finally {
        setIsConnectingSheet(false);
      }
    },
    [refreshSpreadsheetData, showToast]
  );

  // Optional direct GIS Google OAuth connection (requires VITE_GOOGLE_OAUTH_CLIENT_ID)
  const handleGoogleConnect = useCallback(async () => {
    setIsConnectingSheet(true);
    setLoginError(null);
    try {
      const { user, accessToken } = await googleWorkspaceSignIn();
      setGoogleConnected(true);
      setGoogleUserEmail(user.email || null);
      setGoogleDisplayName(user.displayName || null);
      setGoogleUid(user.uid);

      const savedId = getSavedSpreadsheetId();
      if (savedId) {
        try {
          const info = await connectAndEnsureSchema(accessToken, savedId, DEFAULT_RT_SETTINGS);
          setSheetInfo(info);
          await refreshSpreadsheetData(
            { mode: 'oauth', spreadsheetId: info.spreadsheetId, accessToken },
            true
          );
          return;
        } catch {
          clearSavedSpreadsheetId();
        }
      }

      const discovered = await findAppDatabaseSpreadsheet(accessToken);
      if (discovered) {
        const info = await connectAndEnsureSchema(
          accessToken,
          discovered.spreadsheetId,
          DEFAULT_RT_SETTINGS
        );
        setSheetInfo(info);
        await refreshSpreadsheetData(
          { mode: 'oauth', spreadsheetId: info.spreadsheetId, accessToken },
          true
        );
      } else {
        setSheetInfo(null);
      }
    } catch (err) {
      setLoginError(formatGoogleAuthError(err, 'connect'));
    } finally {
      setIsConnectingSheet(false);
    }
  }, [refreshSpreadsheetData]);

  const handleGoogleDisconnect = useCallback(async () => {
    setSettingsOpen(false);
    setRegistryOpen(false);
    clearVerifiedSession();
    clearSavedWebAppUrl();
    clearSavedSpreadsheetId();
    await googleWorkspaceSignOut();
    setGoogleConnected(false);
    setGoogleUserEmail(null);
    setGoogleDisplayName(null);
    setGoogleUid(null);
    setSheetInfo(null);
    setHasSyncedSheetOnce(false);
    setCurrentUser(null);
    setProfile(null);
    setAdminRecord(null);
    setIsBootstrappedAdminUser(false);
  }, []);

  const handleCreateSpreadsheet = useCallback(async () => {
    if (!currentUser || !rbac.isFullAdmin) {
      const msg =
        'Pembuatan database Google Spreadsheet hanya dapat dilakukan setelah Admin (Ketua RT) login ke aplikasi.';
      setLoginError(msg);
      showToast('Akses Ditolak', msg, true);
      return;
    }

    const token = getGoogleAccessToken();
    if (!token) {
      handleExpiredToken();
      return;
    }

    setIsConnectingSheet(true);
    setLoginError(null);
    try {
      const info = await createAppDatabaseSpreadsheet(token, DEFAULT_RT_SETTINGS);
      const conn: SheetConnection = {
        mode: 'oauth',
        spreadsheetId: info.spreadsheetId,
        accessToken: token,
      };
      const nowIso = new Date().toISOString();
      const adminToSeed: AdminRoleRecord = adminRecord || {
        uid: currentUser.uid,
        email: googleUserEmail || currentUser.email || 'admin@siskeurt12.id',
        name: profile?.displayName || googleDisplayName || 'Ketua RT',
        role: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        createdAt: nowIso,
      };
      const profileToSeed: ResidentPublic = profile || {
        uid: currentUser.uid,
        accountRole: 'pengurus',
        pengurusPosition: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        displayName: googleDisplayName || 'Ketua RT',
        houseBlock: 'FF2/2',
        residentStatus: 'pengurus',
        familyStatus: 'umum',
        familyStatusLog: [`${getCurrentYearMonth()}:umum`],
        elderlyMode: false,
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await Promise.all([
        upsertSheetRowsByKey(conn, SHEET_TABS.ADMINS, [adminRecordToRow(adminToSeed)]),
        upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [userProfileToRow(profileToSeed)]),
      ]);

      setSheetInfo(info);
      setAdminRecord(adminToSeed);
      setProfile(profileToSeed);
      await refreshSpreadsheetData(conn, true);
      showToast(
        'Google Spreadsheet Siap',
        `Database "${info.spreadsheetTitle}" berhasil dibuat dan terhubung.`
      );
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) {
        handleExpiredToken();
      } else {
        const msg =
          err instanceof Error
            ? `Gagal membuat Spreadsheet: ${err.message}`
            : 'Gagal membuat Spreadsheet.';
        setLoginError(msg);
        showToast('Gagal Membuat Spreadsheet', msg, true);
      }
    } finally {
      setIsConnectingSheet(false);
    }
  }, [
    currentUser,
    rbac.isFullAdmin,
    adminRecord,
    profile,
    googleUserEmail,
    googleDisplayName,
    refreshSpreadsheetData,
    showToast,
    handleExpiredToken,
  ]);

  const handleConnectSpreadsheetById = useCallback(
    async (idOrUrl: string) => {
      const token = getGoogleAccessToken();
      if (!token) {
        const msg = 'Mode OAuth memerlukan login Google terlebih dahulu.';
        setLoginError(msg);
        showToast('Google Belum Terhubung', msg, true);
        return;
      }
      const spreadsheetId = extractSpreadsheetId(idOrUrl);
      if (!spreadsheetId) {
        const msg = 'Masukkan URL atau ID Google Spreadsheet yang valid.';
        setLoginError(msg);
        showToast('URL/ID Tidak Valid', msg, true);
        return;
      }

      setIsConnectingSheet(true);
      setLoginError(null);
      try {
        const info = await connectAndEnsureSchema(token, spreadsheetId, DEFAULT_RT_SETTINGS);
        setSheetInfo(info);
        await refreshSpreadsheetData(
          { mode: 'oauth', spreadsheetId: info.spreadsheetId, accessToken: token },
          true
        );
        showToast(
          'Spreadsheet Terhubung',
          `Berhasil terhubung ke "${info.spreadsheetTitle}".`
        );
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) {
          handleExpiredToken();
        } else {
          const msg =
            err instanceof Error
              ? `Gagal membuka Spreadsheet: ${err.message}`
              : 'Gagal membuka Spreadsheet.';
          setLoginError(msg);
          showToast('Gagal Membuka Spreadsheet', msg, true);
        }
      } finally {
        setIsConnectingSheet(false);
      }
    },
    [refreshSpreadsheetData, showToast, handleExpiredToken]
  );

  // Offline emergency snapshot
  useEffect(() => {
    if (!profile) return;
    const summaryParts = [
      healthProfile.bloodType && healthProfile.bloodType !== 'Belum diketahui'
        ? `Gol. Darah ${healthProfile.bloodType}`
        : '',
      healthProfile.allergies ? `Alergi: ${healthProfile.allergies}` : '',
      healthProfile.chronicConditions ? `Riwayat: ${healthProfile.chronicConditions}` : '',
      healthProfile.medications ? `Obat: ${healthProfile.medications}` : '',
    ].filter(Boolean);

    saveOfflineSnapshot({
      updatedAtIso: new Date().toISOString(),
      residentName: profile.displayName,
      houseBlock: profile.houseBlock,
      medicalSummary: summaryParts.join(' · '),
      emergencyContact:
        privateProfile.emergencyContactName && privateProfile.emergencyContactPhone
          ? `${privateProfile.emergencyContactName} (${privateProfile.emergencyContactPhone})`
          : '',
      rtSettings,
      recentTransactions: transactions.slice(0, 10),
      activeEmergencies: emergencies.filter((e) => e.status !== 'resolved'),
    });
  }, [profile, healthProfile, privateProfile, rtSettings, transactions, emergencies]);

  // Auto-sync offline queue to Google Sheets when back online
  const flushOfflineQueue = useCallback(async () => {
    const conn = getActiveSheetConnection();
    if (!isOnline || !currentUser || !profile || !conn || !sheetInfo) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    let syncedCount = 0;
    const nowIso = new Date().toISOString();
    for (const item of queue) {
      try {
        if (item.kind === 'dues_submission') {
          const tx: KasTransaction = {
            id: generateRecordId('tx'),
            ...(item.payload as Omit<KasTransaction, 'id'>),
            createdAt: item.createdAtIso || nowIso,
            updatedAt: nowIso,
          };
          await appendSheetRows(conn, SHEET_TABS.TRANSACTIONS, [transactionToRow(tx)]);
          removeOfflineAction(item.localId);
          syncedCount++;
        } else if (item.kind === 'emergency_alert') {
          const em: EmergencyAlert = {
            id: generateRecordId('em'),
            ...(item.payload as Omit<EmergencyAlert, 'id'>),
            createdAt: item.createdAtIso || nowIso,
            updatedAt: nowIso,
          };
          await appendSheetRows(conn, SHEET_TABS.EMERGENCIES, [emergencyToRow(em)]);
          removeOfflineAction(item.localId);
          syncedCount++;
        }
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) {
          handleExpiredToken();
          break;
        }
      }
    }
    setOfflineQueueCount(getOfflineQueue().length);
    if (syncedCount > 0) {
      await refreshSpreadsheetData(conn, true);
      showToast(
        'Sinkronisasi Otomatis Berhasil',
        `${syncedCount} data dari mode offline telah tersimpan ke Google Spreadsheet.`
      );
    }
  }, [
    isOnline,
    currentUser,
    profile,
    sheetInfo,
    getActiveSheetConnection,
    refreshSpreadsheetData,
    showToast,
    handleExpiredToken,
  ]);

  const handleLoginWithCredentials = async (data: {
    username: string;
    password: string;
  }) => {
    setIsLoggingIn(true);
    setLoginError(null);
    const normalizedUsername = normalizeUsername(data.username);

    try {
      const ensured = await ensureDefaultSpreadsheetConnected();
      if (!ensured) {
        setLoginError(
          'Gagal menghubungkan ke Database Google Spreadsheet RT. Periksa koneksi internet Anda.'
        );
        return;
      }
      const { conn, info: activeSheetInfo } = ensured;

      if (!isValidUsername(normalizedUsername)) {
        setLoginError(
          'Format username tidak valid. Gunakan 3–30 karakter huruf, angka, _ atau -.'
        );
        return;
      }

      const freshSnap = await refreshSpreadsheetData(conn, true);
      const activeAccounts = freshSnap?.userAccounts || userAccounts;
      const activeUsers = freshSnap?.users || residents;
      const activeAdmins = freshSnap?.admins || adminRecords;
      const activeRegistry = freshSnap?.registryEntries || registryEntries;

      const accData = activeAccounts.find(
        (a) => normalizeUsername(a.username) === normalizedUsername
      );
      if (!accData) {
        setLoginError(
          `Username "${normalizedUsername}" belum terdaftar di Google Spreadsheet. Silakan daftar akun terlebih dahulu pada tab Daftar Akun.`
        );
        return;
      }

      if (!accData.passwordHash) {
        setLoginError(
          'Akun ini belum memiliki hash sandi di Spreadsheet. Pengurus dapat mereset klaim akun pada Database Warga agar Anda bisa mendaftar ulang.'
        );
        return;
      }

      const passwordValid = await verifyPassword(data.password, accData.passwordHash);
      if (!passwordValid) {
        setLoginError('Username atau sandi salah. Silakan periksa kembali.');
        return;
      }

      let userProf = activeUsers.find((u) => u.uid === accData.uid) || null;
      const dbCheck = checkRegistryVerification(activeRegistry, {
        uid: accData.uid,
        registryId: accData.registryId || userProf?.registryId,
        username: normalizedUsername,
        fullName: userProf?.displayName,
        houseBlock: userProf?.houseBlock,
      });

      if (!dbCheck.ok) {
        setLoginError(dbCheck.reason);
        return;
      }

      const reg = dbCheck.entry;
      const matchedAdmin = activeAdmins.find((a) => a.uid === accData.uid) || null;
      const isPengurus = reg.role === 'pengurus';
      const effectivePos: PengurusPosition = isPengurus
        ? reg.pengurusPosition ||
          (matchedAdmin?.role && matchedAdmin.role !== 'admin'
            ? matchedAdmin.role
            : 'ketua_rt')
        : 'pengurus_lain';
      const effectivePerms = isPengurus
        ? normalizePengurusPermissions(effectivePos, reg.permissions)
        : undefined;
      const nowIso = new Date().toISOString();

      if (!userProf) {
        userProf = {
          uid: accData.uid,
          username: normalizedUsername,
          accountRole: reg.role,
          ...(isPengurus ? { pengurusPosition: effectivePos, permissions: effectivePerms } : {}),
          registryId: reg.registryId,
          displayName: reg.fullName,
          houseBlock: reg.houseBlock,
          residentStatus: isPengurus ? 'pengurus' : reg.residentStatus || 'tetap',
          familyStatus: reg.familyStatus || 'umum',
          familyStatusLog: [`${getCurrentYearMonth()}:${reg.familyStatus || 'umum'}`],
          verificationStatus: 'verified',
          elderlyMode: false,
          communityId: 'rt_warga',
          createdAt: accData.createdAt || nowIso,
          updatedAt: nowIso,
        };
      } else {
        userProf = {
          ...userProf,
          username: normalizedUsername,
          accountRole: reg.role,
          ...(isPengurus
            ? { pengurusPosition: effectivePos, permissions: effectivePerms }
            : { pengurusPosition: undefined, permissions: undefined }),
          registryId: reg.registryId,
          displayName: reg.fullName || userProf.displayName,
          houseBlock: reg.houseBlock || userProf.houseBlock,
          residentStatus: isPengurus
            ? 'pengurus'
            : reg.residentStatus || userProf.residentStatus || 'tetap',
          familyStatus: reg.familyStatus || userProf.familyStatus || 'umum',
          verificationStatus: 'verified',
        };
      }

      const effectiveAdmin: AdminRoleRecord | null = isPengurus
        ? matchedAdmin || {
            uid: accData.uid,
            email: usernameToAuthEmail(normalizedUsername),
            name: userProf.displayName,
            role: effectivePos,
            permissions: effectivePerms,
            registryId: reg.registryId,
            createdAt: accData.createdAt || nowIso,
          }
        : null;

      setIsBootstrappedAdminUser(false);
      setAdminRecord(effectiveAdmin);
      setProfile(userProf);
      if (typeof userProf.elderlyMode === 'boolean') {
        setElderlyMode(userProf.elderlyMode);
      }
      setCurrentUser({
        uid: userProf.uid,
        email: usernameToAuthEmail(normalizedUsername),
        displayName: userProf.displayName,
        username: normalizedUsername,
        role: reg.role,
      });
      saveVerifiedSession({
        uid: userProf.uid,
        username: normalizedUsername,
        role: reg.role,
        registryId: reg.registryId,
        displayName: userProf.displayName,
        webAppUrl: activeSheetInfo.webAppUrl,
        spreadsheetId: activeSheetInfo.spreadsheetId,
        verifiedAtIso: nowIso,
      });
      initialNotificationIdsRef.current = null;
      showToast(
        'Selamat Datang',
        'Anda Berhasil Masuk aplikasi'
      );
    } catch (err) {
      setLoginError(
        err instanceof Error ? `Gagal masuk: ${err.message}` : 'Gagal masuk ke sistem.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBootstrapFirstAdmin = async (data: {
    fullName: string;
    houseBlock: string;
    username: string;
    password: string;
  }) => {
    setIsLoggingIn(true);
    setLoginError(null);
    const normalizedUsername = normalizeUsername(data.username);

    if (!isValidUsername(normalizedUsername)) {
      setLoginError('Username harus 3–30 karakter (huruf kecil, angka, _ atau -).');
      setIsLoggingIn(false);
      return;
    }

    try {
      const conn = getActiveSheetConnection();
      if (!conn || !sheetInfo) {
        setLoginError('Hubungkan Google Spreadsheet terlebih dahulu.');
        return;
      }

      const freshSnap = await refreshSpreadsheetData(conn, true);
      const hasExistingData =
        (freshSnap?.admins.length || 0) > 0 ||
        (freshSnap?.users.length || 0) > 0 ||
        (freshSnap?.registryEntries.length || 0) > 0;

      if (hasExistingData) {
        setLoginError(
          'Database Spreadsheet sudah memiliki data pengurus/warga. Silakan masuk menggunakan Username & Sandi yang terdaftar.'
        );
        return;
      }

      isMutatingRef.current = true;
      const newUid = generateRecordId('adm');
      const registryId = await computeResidentRegistryId(data.fullName, data.houseBlock);
      const nowIso = new Date().toISOString();
      const passwordHash = await hashPassword(data.password);

      const newRegistry: ResidentRegistryEntry = {
        registryId,
        fullName: data.fullName.trim().slice(0, 80),
        houseBlock: data.houseBlock.trim().slice(0, 30),
        role: 'pengurus',
        pengurusPosition: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        residentStatus: 'pengurus',
        familyStatus: 'umum',
        verificationStatus: 'verified',
        claimedUid: newUid,
        claimedUsername: normalizedUsername,
        communityId: 'rt_warga',
        createdBy: newUid,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const accountLookup: UserAccountLookup = {
        uid: newUid,
        username: normalizedUsername,
        role: 'pengurus',
        registryId,
        passwordHash,
        createdAt: nowIso,
      };

      const newProfile: ResidentPublic = {
        uid: newUid,
        username: normalizedUsername,
        accountRole: 'pengurus',
        pengurusPosition: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        registryId,
        displayName: newRegistry.fullName,
        houseBlock: newRegistry.houseBlock,
        residentStatus: 'pengurus',
        familyStatus: 'umum',
        familyStatusLog: [`${getCurrentYearMonth()}:umum`],
        verificationStatus: 'verified',
        elderlyMode: false,
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newAdmin: AdminRoleRecord = {
        uid: newUid,
        email: usernameToAuthEmail(normalizedUsername),
        name: newRegistry.fullName,
        role: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        registryId,
        createdAt: nowIso,
      };

      await Promise.all([
        upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
          registryEntryToRow(newRegistry),
        ]),
        upsertSheetRowsByKey(conn, SHEET_TABS.USER_ACCOUNTS, [
          userAccountToRow(accountLookup),
        ]),
        upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [userProfileToRow(newProfile)]),
        upsertSheetRowsByKey(conn, SHEET_TABS.ADMINS, [adminRecordToRow(newAdmin)]),
      ]);

      await refreshSpreadsheetData(conn, true);
      setIsBootstrappedAdminUser(false);
      setAdminRecord(newAdmin);
      setProfile(newProfile);
      setCurrentUser({
        uid: newUid,
        email: usernameToAuthEmail(normalizedUsername),
        displayName: newProfile.displayName,
        username: normalizedUsername,
        role: 'pengurus',
      });
      saveVerifiedSession({
        uid: newUid,
        username: normalizedUsername,
        role: 'pengurus',
        registryId,
        displayName: newProfile.displayName,
        webAppUrl: sheetInfo.webAppUrl,
        spreadsheetId: sheetInfo.spreadsheetId,
        verifiedAtIso: nowIso,
      });
      setActiveTab('beranda');
      initialNotificationIdsRef.current = null;
    } catch (err) {
      setLoginError(
        err instanceof Error ? `Gagal membuat Admin pertama: ${err.message}` : 'Gagal membuat akun.'
      );
    } finally {
      isMutatingRef.current = false;
      setIsLoggingIn(false);
    }
  };

  const handleRegisterAccount = async (data: {
    fullName: string;
    houseBlock: string;
    username: string;
    password: string;
  }): Promise<{
    role: LoginRole;
    username: string;
    fullName: string;
    pengurusPosition?: PengurusPosition;
    autoConnected?: boolean;
  } | null> => {
    setIsLoggingIn(true);
    setLoginError(null);

    const normalizedUsername = normalizeUsername(data.username);
    if (!isValidUsername(normalizedUsername)) {
      setLoginError('Username harus 3–30 karakter (huruf kecil, angka, _ atau -).');
      setIsLoggingIn(false);
      return null;
    }

    try {
      const ensured = await ensureDefaultSpreadsheetConnected();
      if (!ensured) {
        setLoginError(
          'Gagal menghubungkan ke Database Google Spreadsheet RT. Periksa koneksi internet Anda.'
        );
        return null;
      }
      const { conn, info: activeSheetInfo } = ensured;

      const freshSnap = await refreshSpreadsheetData(conn, true);
      const activeRegistry = freshSnap?.registryEntries || registryEntries;
      const activeAccounts = freshSnap?.userAccounts || userAccounts;

      const computedId = await computeResidentRegistryId(data.fullName, data.houseBlock);
      const reg = findMatchingRegistryEntry(
        activeRegistry,
        data.fullName,
        data.houseBlock,
        computedId
      );

      if (!reg) {
        setLoginError(
          'Pendaftaran ditolak: Nama Lengkap dan Blok Rumah tidak sesuai atau tidak ditemukan di Database Warga.'
        );
        return null;
      }

      if (reg.verificationStatus === 'rejected') {
        setLoginError(
          `Pendaftaran ditolak: Data "${reg.fullName}" (${reg.houseBlock}) dinonaktifkan pada Database Warga. Hubungi Pengurus RT.`
        );
        return null;
      }

      if (reg.claimedUid) {
        setLoginError(
          `Akun untuk ${reg.fullName} (${reg.houseBlock}) sudah terdaftar dengan username "${
            reg.claimedUsername || '-'
          }". Silakan langsung masuk menggunakan username dan sandi Anda.`
        );
        return null;
      }

      const existingAccount = activeAccounts.find(
        (a) => normalizeUsername(a.username) === normalizedUsername
      );
      if (existingAccount) {
        setLoginError(
          `Username "${normalizedUsername}" sudah digunakan. Silakan pilih username lain.`
        );
        return null;
      }

      isMutatingRef.current = true;
      const newUid = generateRecordId('usr');
      const nowIso = new Date().toISOString();
      const passwordHash = await hashPassword(data.password);
      const regPosition: PengurusPosition = reg.pengurusPosition || 'pengurus_lain';
      const hasExplicitRegPerms = Array.isArray(reg.permissions);
      const regPerms =
        reg.role === 'pengurus'
          ? normalizePengurusPermissions(regPosition, reg.permissions)
          : undefined;

      const accountLookup: UserAccountLookup = {
        uid: newUid,
        username: normalizedUsername,
        role: reg.role,
        registryId: reg.registryId,
        passwordHash,
        createdAt: nowIso,
      };

      const newProfile: ResidentPublic = {
        uid: newUid,
        username: normalizedUsername,
        accountRole: reg.role,
        ...(reg.role === 'pengurus'
          ? {
              pengurusPosition: regPosition,
              permissions: regPerms,
            }
          : {}),
        registryId: reg.registryId,
        displayName: reg.fullName,
        houseBlock: reg.houseBlock,
        residentStatus: reg.residentStatus || (reg.role === 'pengurus' ? 'pengurus' : 'tetap'),
        familyStatus: reg.familyStatus || 'umum',
        familyStatusLog: [`${getCurrentYearMonth()}:${reg.familyStatus || 'umum'}`],
        verificationStatus: 'verified',
        elderlyMode: false,
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const updatedRegistry: ResidentRegistryEntry = {
        ...reg,
        verificationStatus: 'verified',
        claimedUid: newUid,
        claimedUsername: normalizedUsername,
        updatedAt: nowIso,
      };

      const newAdminRec: AdminRoleRecord | null =
        reg.role === 'pengurus'
          ? {
              uid: newUid,
              email: usernameToAuthEmail(normalizedUsername),
              name: reg.fullName,
              role: regPosition,
              ...(hasExplicitRegPerms ? { permissions: reg.permissions } : { permissions: regPerms }),
              registryId: reg.registryId,
              createdAt: nowIso,
            }
          : null;

      await Promise.all([
        upsertSheetRowsByKey(conn, SHEET_TABS.USER_ACCOUNTS, [userAccountToRow(accountLookup)]),
        upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [userProfileToRow(newProfile)]),
        upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
          registryEntryToRow(updatedRegistry),
        ]),
        ...(newAdminRec
          ? [upsertSheetRowsByKey(conn, SHEET_TABS.ADMINS, [adminRecordToRow(newAdminRec)])]
          : []),
      ]);

      await refreshSpreadsheetData(conn, true);

      // Pengguna yang sudah terverifikasi otomatis masuk & terhubung ke Spreadsheet
      setIsBootstrappedAdminUser(false);
      setAdminRecord(newAdminRec);
      setProfile(newProfile);
      setElderlyMode(false);
      setCurrentUser({
        uid: newUid,
        email: usernameToAuthEmail(normalizedUsername),
        displayName: newProfile.displayName,
        username: normalizedUsername,
        role: reg.role,
      });
      saveVerifiedSession({
        uid: newUid,
        username: normalizedUsername,
        role: reg.role,
        registryId: reg.registryId,
        displayName: newProfile.displayName,
        webAppUrl: activeSheetInfo.webAppUrl,
        spreadsheetId: activeSheetInfo.spreadsheetId,
        verifiedAtIso: nowIso,
      });
      setActiveTab('beranda');
      initialNotificationIdsRef.current = null;
      if (!localStorage.getItem(`kaswarga_seen_intro_${newUid}`)) {
        setShowNewUserBanner(true);
      }
      showToast(
        'Pendaftaran Berhasil',
        `${reg.fullName} (${reg.houseBlock}) terdaftar sebagai ${
          reg.role === 'pengurus' ? 'Pengurus RT' : 'Warga'
        } dan terhubung ke "${activeSheetInfo.spreadsheetTitle}".`
      );

      return {
        role: reg.role,
        username: normalizedUsername,
        fullName: reg.fullName,
        pengurusPosition: reg.role === 'pengurus' ? regPosition : undefined,
        autoConnected: true,
      };
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) {
        handleExpiredToken();
      } else {
        setLoginError(
          err instanceof Error ? `Pendaftaran ditolak: ${err.message}` : 'Pendaftaran akun gagal.'
        );
      }
      return null;
    } finally {
      isMutatingRef.current = false;
      setIsLoggingIn(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      let token = getGoogleAccessToken();
      let activeUid = googleUid;
      let activeEmail = googleUserEmail;
      let activeDisplayName = googleDisplayName;

      if (!token || !activeUid) {
        const authResult = await googleWorkspaceSignIn();
        token = authResult.accessToken;
        activeUid = authResult.user.uid;
        activeEmail = authResult.user.email || null;
        activeDisplayName = authResult.user.displayName || null;
        setGoogleConnected(true);
        setGoogleUserEmail(activeEmail);
        setGoogleDisplayName(activeDisplayName);
        setGoogleUid(activeUid);
      }

      let activeSheet = sheetInfo;
      if (!activeSheet?.spreadsheetId) {
        const savedId = getSavedSpreadsheetId();
        if (savedId) {
          try {
            activeSheet = await connectAndEnsureSchema(token, savedId, DEFAULT_RT_SETTINGS);
            setSheetInfo(activeSheet);
          } catch {
            clearSavedSpreadsheetId();
          }
        }
        if (!activeSheet?.spreadsheetId) {
          const discovered = await findAppDatabaseSpreadsheet(token);
          if (discovered) {
            activeSheet = await connectAndEnsureSchema(
              token,
              discovered.spreadsheetId,
              DEFAULT_RT_SETTINGS
            );
            setSheetInfo(activeSheet);
          }
        }
      }

      const emailLower = (activeEmail || '').toLowerCase();
      const isBootstrappedEmail = BOOTSTRAPPED_ADMIN_EMAILS.includes(emailLower);

      let activeAdmins = adminRecords;
      let activeUsers = residents;
      let activeRegistry = registryEntries;

      if (activeSheet?.spreadsheetId) {
        const conn: SheetConnection =
          activeSheet.mode === 'webapp'
            ? {
                mode: 'webapp',
                spreadsheetId: activeSheet.spreadsheetId,
                webAppUrl: activeSheet.webAppUrl,
              }
            : {
                mode: 'oauth',
                spreadsheetId: activeSheet.spreadsheetId,
                accessToken: token,
              };
        const freshSnap = await refreshSpreadsheetData(conn, true);
        if (freshSnap) {
          activeAdmins = freshSnap.admins;
          activeUsers = freshSnap.users;
          activeRegistry = freshSnap.registryEntries;
        }
      }

      const existingAdmin =
        activeAdmins.find(
          (a) => a.uid === activeUid || a.email.toLowerCase() === emailLower
        ) || null;
      const isEmptyDatabase =
        Boolean(activeSheet?.spreadsheetId) &&
        activeUsers.length === 0 &&
        activeRegistry.length === 0;

      if (!activeSheet?.spreadsheetId && !isBootstrappedEmail) {
        setLoginError(
          'Database Spreadsheet belum dibuat dan akun Google ini bukan Admin Utama. Tempel URL/ID Spreadsheet RT yang sudah ada atau masuk menggunakan akun Google Admin Utama (Ketua RT).'
        );
        return;
      }

      if (activeSheet?.spreadsheetId && !isBootstrappedEmail && !existingAdmin && !isEmptyDatabase) {
        setLoginError(
          'Akun Google ini belum terdaftar sebagai Admin Pengurus di Spreadsheet. Silakan masuk menggunakan Username & Sandi Pengurus atau minta Ketua RT menambahkan data Anda.'
        );
        return;
      }

      if (activeRegistry.length > 0 && !isEmptyDatabase) {
        const regCheck = checkRegistryVerification(activeRegistry, {
          uid: existingAdmin?.uid || activeUid,
          registryId: existingAdmin?.registryId,
          fullName: existingAdmin?.name || activeDisplayName || undefined,
          expectedRole: 'pengurus',
        });
        if (!regCheck.ok && !isBootstrappedEmail) {
          setLoginError(regCheck.reason);
          return;
        }
      }

      const targetUid = existingAdmin?.uid || activeUid;
      const nowIso = new Date().toISOString();
      const finalAdmin: AdminRoleRecord = existingAdmin || {
        uid: targetUid,
        email: activeEmail || 'admin@siskeurt12.id',
        name: activeDisplayName || 'Ketua RT',
        role: 'ketua_rt',
        permissions: [...ALL_RBAC_PERMISSIONS],
        createdAt: nowIso,
      };
      const resolvedPosition: PengurusPosition =
        finalAdmin.role === 'admin' || !finalAdmin.role ? 'ketua_rt' : finalAdmin.role;
      const userProf: ResidentPublic = activeUsers.find((u) => u.uid === targetUid) || {
        uid: targetUid,
        accountRole: 'pengurus',
        pengurusPosition: resolvedPosition,
        permissions: finalAdmin.permissions || [...ALL_RBAC_PERMISSIONS],
        displayName: finalAdmin.name || activeDisplayName || 'Ketua RT',
        houseBlock: 'FF3/5',
        residentStatus: 'pengurus',
        familyStatus: 'umum',
        familyStatusLog: [`${getCurrentYearMonth()}:umum`],
        verificationStatus: 'verified',
        elderlyMode: false,
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setIsBootstrappedAdminUser(isBootstrappedEmail || isEmptyDatabase || !activeSheet?.spreadsheetId);
      setAdminRecord(finalAdmin);
      setProfile(userProf);
      if (typeof userProf.elderlyMode === 'boolean') {
        setElderlyMode(userProf.elderlyMode);
      }
      setCurrentUser({
        uid: userProf.uid,
        email: activeEmail || '',
        displayName: userProf.displayName,
        username: userProf.username,
        role: 'pengurus',
      });
      setActiveTab('beranda');
      if (!localStorage.getItem(`kaswarga_seen_intro_${userProf.uid}`)) {
        setShowNewUserBanner(true);
      }
      initialNotificationIdsRef.current = null;
      showToast(
        'Selamat Datang',
        'Anda Berhasil Masuk dan Selamat menggunakan aplikasi'
      );
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) {
        handleExpiredToken();
      } else {
        setLoginError(formatGoogleAuthError(err, 'admin'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    clearVerifiedSession();
    setSettingsOpen(false);
    setRegistryOpen(false);
    setCurrentUser(null);
    setProfile(null);
    setAdminRecord(null);
    setIsBootstrappedAdminUser(false);
    initialNotificationIdsRef.current = null;
  };

  const handleToggleElderlyMode = async () => {
    const next = !elderlyMode;
    setElderlyMode(next);
    const conn = getActiveSheetConnection();
    if (currentUser && profile && conn) {
      try {
        const updated: ResidentPublic = {
          ...profile,
          elderlyMode: next,
          updatedAt: new Date().toISOString(),
        };
        await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [userProfileToRow(updated)]);
        setProfile(updated);
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      }
    }
  };

  const handleSubmitDues = async (data: {
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    proofImageData: string;
    notes: string;
  }) => {
    if (!currentUser || !profile) return;

    const payload = {
      type: 'income' as const,
      category: 'iuran_bulanan' as const,
      title: data.title.slice(0, 120),
      amount: data.amount,
      billingMonth: data.billingMonth,
      residentUid: currentUser.uid,
      residentName: profile.displayName.slice(0, 80),
      houseBlock: profile.houseBlock.slice(0, 30),
      familyStatus: getResidentFamilyStatusForMonth(profile, data.billingMonth, transactions),
      paymentMethod: data.paymentMethod,
      proofImageData: data.proofImageData || '',
      status: 'pending' as const,
      verifiedBy: '',
      rejectionReason: '',
      notes: data.notes.slice(0, 300),
      communityId: 'rt_warga',
    };

    if (!isOnline) {
      enqueueOfflineAction({ kind: 'dues_submission', payload });
      setOfflineQueueCount(getOfflineQueue().length);
      return;
    }

    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const newTx: KasTransaction = {
        id: generateRecordId('tx'),
        ...payload,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.TRANSACTIONS, [transactionToRow(newTx)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleAdminCreateTransaction = async (data: {
    type: 'income' | 'expense';
    category: TransactionCategory;
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => {
    if (!currentUser || !profile) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const newTx: KasTransaction = {
        id: generateRecordId('tx'),
        type: data.type,
        category: data.category,
        title: data.title.slice(0, 120),
        amount: data.amount,
        billingMonth: data.billingMonth,
        residentUid: currentUser.uid,
        residentName: profile.displayName.slice(0, 80),
        houseBlock: profile.houseBlock.slice(0, 30),
        paymentMethod: data.paymentMethod,
        proofImageData: '',
        status: 'approved',
        verifiedBy: currentUser.uid,
        rejectionReason: '',
        notes: data.notes.slice(0, 300),
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.TRANSACTIONS, [transactionToRow(newTx)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleAdminVerifyTransaction = async (
    tx: KasTransaction,
    decision: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    if (!currentUser) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    const resident = residents.find((r) => r.uid === tx.residentUid);
    const familyStatus = tx.familyStatus || resident?.familyStatus || 'umum';
    const effectiveResident: ResidentPublic = resident || {
      uid: tx.residentUid,
      displayName: tx.residentName,
      houseBlock: tx.houseBlock,
      residentStatus: 'tetap',
      familyStatus,
      elderlyMode: false,
      communityId: 'rt_warga',
    };

    const simulatedTxs = transactions.map((t) =>
      t.id === tx.id ? { ...t, status: decision } : t
    );
    const ledgerAfter = calculateResidentLedger(
      effectiveResident,
      simulatedTxs,
      tx.billingMonth
    );

    const isUnderpaid =
      decision === 'approved' &&
      tx.category === 'iuran_bulanan' &&
      ledgerAfter.status === 'kurang_bayar';
    const finalStatus =
      decision === 'rejected' ? 'rejected' : isUnderpaid ? 'kurang_bayar' : 'approved';

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const txUpdates: KasTransaction[] = [
        {
          ...tx,
          status: finalStatus,
          rejectionReason:
            decision === 'rejected' ? (rejectionReason || '').slice(0, 200) : '',
          verifiedBy: currentUser.uid,
          updatedAt: nowIso,
        },
      ];

      if (decision === 'approved' && tx.category === 'iuran_bulanan' && !isUnderpaid) {
        const priorUnderpaid = transactions.filter(
          (t) =>
            t.id !== tx.id &&
            t.residentUid === tx.residentUid &&
            t.type === 'income' &&
            t.category === 'iuran_bulanan' &&
            t.billingMonth === tx.billingMonth &&
            t.status === 'kurang_bayar'
        );
        for (const prevTx of priorUnderpaid) {
          txUpdates.push({
            ...prevTx,
            status: 'approved',
            verifiedBy: currentUser.uid,
            updatedAt: nowIso,
          });
        }
      }

      await upsertSheetRowsByKey(
        conn,
        SHEET_TABS.TRANSACTIONS,
        txUpdates.map(transactionToRow)
      );

      const coverageAfter = getResidentPaidMonthsCoverage(
        effectiveResident,
        simulatedTxs,
        tx.billingMonth
      );

      if (decision === 'approved' && tx.category === 'iuran_bulanan' && !isUnderpaid && resident) {
        await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [
          userProfileToRow({
            ...resident,
            lastPaidMonth: coverageAfter.streakEndMonth || tx.billingMonth,
            updatedAt: nowIso,
          }),
        ]);
      }

      const shortfall = ledgerAfter.shortfall;
      const surplus = ledgerAfter.surplus;
      const isMultiMonthCovered =
        decision === 'approved' &&
        !isUnderpaid &&
        coverageAfter.remainingMonthsFromRef > 1 &&
        Boolean(coverageAfter.streakEndMonth);
      const notif: UserNotification = {
        id: generateRecordId('ntf'),
        targetUid: tx.residentUid,
        senderUid: currentUser.uid,
        title:
          decision === 'rejected'
            ? `Bukti Iuran ${formatMonthLabel(tx.billingMonth)} Ditolak`
            : isUnderpaid
            ? `Iuran ${formatMonthLabel(tx.billingMonth)} Kurang Bayar`
            : isMultiMonthCovered && coverageAfter.streakEndMonth
            ? `Iuran ${coverageAfter.remainingMonthsFromRef} Bulan (${formatMonthLabel(
                tx.billingMonth
              )} – ${formatMonthLabel(coverageAfter.streakEndMonth)}) Lunas`
            : `Iuran ${formatMonthLabel(tx.billingMonth)} Lunas & Disetujui`,
        message:
          decision === 'rejected'
            ? `Alasan: ${rejectionReason || 'Mohon unggah ulang foto bukti yang jelas.'}`
            : isUnderpaid
            ? `Pembayaran ${formatRupiah(tx.amount)} diterima, namun masih kurang ${formatRupiah(
                shortfall
              )} dari tarif ${formatRupiah(ledgerAfter.requiredTariff)}.`
            : isMultiMonthCovered && coverageAfter.streakEndMonth
            ? `Pembayaran ${formatRupiah(tx.amount)} disetujui. Iuran LUNAS ${
                coverageAfter.remainingMonthsFromRef
              } bulan (${formatMonthLabel(tx.billingMonth)} – ${formatMonthLabel(
                coverageAfter.streakEndMonth
              )}).${
                coverageAfter.partialCarryOverForNext > 0
                  ? ` Sisa saldo ${formatRupiah(
                      coverageAfter.partialCarryOverForNext
                    )} otomatis masuk ke ${formatMonthLabel(coverageAfter.nextUnpaidMonth)}.`
                  : ''
              }`
            : surplus > 0
            ? `Pembayaran ${formatRupiah(tx.amount)} disetujui. Iuran ${formatMonthLabel(
                tx.billingMonth
              )} LUNAS dan kelebihan ${formatRupiah(
                surplus
              )} otomatis menjadi saldo bulan berikutnya.`
            : `Pembayaran ${formatRupiah(
                tx.amount
              )} telah diverifikasi oleh bendahara RT. Status iuran kini LUNAS.`,
        type: decision === 'approved' ? 'payment_approved' : 'payment_rejected',
        isRead: false,
        relatedId: tx.id,
        createdAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.NOTIFICATIONS, [notificationToRow(notif)]);

      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSendPaymentReminders = async (
    unpaidResidents: ResidentPublic[],
    yearMonth: string
  ): Promise<number> => {
    if (!currentUser || unpaidResidents.length === 0) return 0;
    const conn = requireActiveSheet();
    if (!conn) return 0;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const rows = unpaidResidents.map((res) => {
        const resTariff = getRequiredTariff(
          getResidentFamilyStatusForMonth(res, yearMonth, transactions)
        );
        return notificationToRow({
          id: generateRecordId('ntf'),
          targetUid: res.uid,
          senderUid: currentUser.uid,
          title: `Pengingat Iuran ${formatMonthLabel(yearMonth)}`,
          message: `Yth. ${res.displayName} (${res.houseBlock}), iuran kas RT sebesar ${formatRupiah(
            resTariff
          )} jatuh tempo tanggal ${rtSettings.dueDayOfMonth}.`,
          type: 'payment_reminder',
          isRead: false,
          relatedId: yearMonth,
          createdAt: nowIso,
        });
      });

      await appendSheetRows(conn, SHEET_TABS.NOTIFICATIONS, rows);
      await refreshSpreadsheetData(conn, true);
      return unpaidResidents.length;
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
      return 0;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handlePublishAnnouncement = async (data: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    priority: 'normal' | 'urgent';
  }) => {
    if (!currentUser || !profile) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const ann: Announcement = {
        id: generateRecordId('ann'),
        title: data.title.slice(0, 120),
        body: data.body.slice(0, 1000),
        category: data.category,
        priority: data.priority,
        authorUid: currentUser.uid,
        authorName: profile.displayName.slice(0, 80),
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.ANNOUNCEMENTS, [announcementToRow(ann)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateAnnouncement = async (
    ann: Announcement,
    data: {
      title: string;
      body: string;
      category: AnnouncementCategory;
      priority: 'normal' | 'urgent';
    }
  ) => {
    if (!currentUser || !rbac.canManageAnnouncements) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const updated: Announcement = {
        ...ann,
        title: data.title.trim().slice(0, 120),
        body: data.body.trim().slice(0, 1000),
        category: data.category,
        priority: data.priority,
        updatedAt: new Date().toISOString(),
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.ANNOUNCEMENTS, [announcementToRow(updated)]);
      await refreshSpreadsheetData(conn, true);
      showToast('Pengumuman Diperbarui', `"${updated.title}" berhasil diperbarui.`);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      await deleteSheetRowsByKey(conn, SHEET_TABS.ANNOUNCEMENTS, [id]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleTriggerSOS = async (payload: {
    emergencyType: EmergencyType;
    description: string;
    locationText: string;
  }) => {
    if (!currentUser || !profile) return;

    const medicalSummaryParts = healthProfile.shareInEmergency
      ? [
          healthProfile.bloodType && healthProfile.bloodType !== 'Belum diketahui'
            ? `Gol. Darah: ${healthProfile.bloodType}`
            : '',
          healthProfile.allergies ? `Alergi: ${healthProfile.allergies}` : '',
          healthProfile.chronicConditions ? `Kondisi: ${healthProfile.chronicConditions}` : '',
          healthProfile.medications ? `Obat: ${healthProfile.medications}` : '',
          healthProfile.insuranceProvider ? `Faskes: ${healthProfile.insuranceProvider}` : '',
        ].filter(Boolean)
      : [];

    const emergencyContact =
      privateProfile.emergencyContactName && privateProfile.emergencyContactPhone
        ? `${privateProfile.emergencyContactName} (${privateProfile.emergencyContactPhone})`
        : privateProfile.phone || '';

    const docPayload = {
      reporterUid: currentUser.uid,
      reporterName: profile.displayName.slice(0, 80),
      houseBlock: profile.houseBlock.slice(0, 30),
      emergencyType: payload.emergencyType,
      description: payload.description.slice(0, 400),
      locationText: payload.locationText.slice(0, 160),
      medicalSummary: medicalSummaryParts.join(' · ').slice(0, 400),
      emergencyContact: emergencyContact.slice(0, 120),
      status: 'active' as const,
      responderName: '',
      communityId: 'rt_warga',
    };

    if (!isOnline) {
      enqueueOfflineAction({ kind: 'emergency_alert', payload: docPayload });
      setOfflineQueueCount(getOfflineQueue().length);
      return;
    }

    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const em: EmergencyAlert = {
        id: generateRecordId('em'),
        ...docPayload,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.EMERGENCIES, [emergencyToRow(em)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateEmergencyStatus = async (
    alert: EmergencyAlert,
    status: 'responding' | 'resolved'
  ) => {
    if (!currentUser || !profile) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      const updated: EmergencyAlert = {
        ...alert,
        status,
        responderName:
          rbac.canManageEmergencies && status === 'responding'
            ? profile.displayName.slice(0, 80)
            : alert.responderName || '',
        updatedAt: new Date().toISOString(),
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.EMERGENCIES, [emergencyToRow(updated)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateEmergencyDetails = async (
    alert: EmergencyAlert,
    data: {
      emergencyType: EmergencyType;
      description: string;
      locationText: string;
    }
  ) => {
    if (!currentUser) return;
    if (!rbac.canManageEmergencies && alert.reporterUid !== currentUser.uid) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      const updated: EmergencyAlert = {
        ...alert,
        emergencyType: data.emergencyType,
        description: data.description.trim().slice(0, 400),
        locationText: data.locationText.trim().slice(0, 160),
        updatedAt: new Date().toISOString(),
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.EMERGENCIES, [emergencyToRow(updated)]);
      await refreshSpreadsheetData(conn, true);
      showToast('Laporan Darurat Diperbarui', 'Detail laporan darurat berhasil diperbarui.');
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleDeleteEmergency = async (alert: EmergencyAlert) => {
    if (!currentUser) return;
    if (!rbac.canManageEmergencies && alert.reporterUid !== currentUser.uid) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      await deleteSheetRowsByKey(conn, SHEET_TABS.EMERGENCIES, [alert.id]);
      await refreshSpreadsheetData(conn, true);
      showToast('Laporan Darurat Dihapus', 'Riwayat laporan darurat telah dihapus.');
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSaveEncryptedHealthAndProfile = async (
    nextProfile: PrivateProfileData,
    nextHealth: PrivateHealthData
  ) => {
    if (!currentUser) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    setPrivateProfile(nextProfile);
    setHealthProfile(nextHealth);

    const encProfile = await encryptSensitiveJson(currentUser.uid, nextProfile);
    const encHealth = await encryptSensitiveJson(currentUser.uid, nextHealth);

    const summary = [
      nextHealth.bloodType && nextHealth.bloodType !== 'Belum diketahui'
        ? `Gol. Darah: ${nextHealth.bloodType}`
        : '',
      nextHealth.allergies ? `Alergi: ${nextHealth.allergies}` : '',
      nextHealth.chronicConditions ? `Kondisi: ${nextHealth.chronicConditions}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 400);

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      await upsertSheetRowsByKey(conn, SHEET_TABS.PRIVATE_DATA, [
        privateDataToRow({
          id: `${currentUser.uid}_profile`,
          uid: currentUser.uid,
          docType: 'profile',
          encryptedPayload: encProfile,
          encryptionAlg: 'AES-GCM-256',
          updatedAt: nowIso,
        }),
        privateDataToRow({
          id: `${currentUser.uid}_health`,
          uid: currentUser.uid,
          docType: 'health',
          encryptedPayload: encHealth,
          encryptionAlg: 'AES-GCM-256',
          shareInEmergency: nextHealth.shareInEmergency,
          emergencySummary: summary,
          updatedAt: nowIso,
        }),
      ]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSaveProfile = async (data: {
    displayName: string;
    houseBlock: string;
    residentStatus: ResidentStatus;
    familyStatus: FamilyStatus;
  }) => {
    if (!currentUser || !profile) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    const prevFamilyStatus: FamilyStatus = profile.familyStatus || 'umum';
    const hasFamilyStatusChanged = data.familyStatus !== prevFamilyStatus;
    let nextFamilyStatusLog = profile.familyStatusLog;

    if (hasFamilyStatusChanged) {
      const effectiveMonth = getEffectiveFamilyStatusChangeMonth(
        transactions,
        currentUser.uid
      );
      nextFamilyStatusLog = buildUpdatedFamilyStatusLog(
        profile,
        data.familyStatus,
        effectiveMonth
      );
    }

    const updatedProfile: ResidentPublic = {
      ...profile,
      displayName: data.displayName.slice(0, 80),
      houseBlock: data.houseBlock.slice(0, 30),
      residentStatus: data.residentStatus,
      familyStatus: data.familyStatus,
      familyStatusLog: nextFamilyStatusLog,
      updatedAt: new Date().toISOString(),
    };

    isMutatingRef.current = true;
    try {
      await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [
        userProfileToRow(updatedProfile),
      ]);
      setProfile(updatedProfile);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSaveRtSettings = async (data: Omit<RtSettings, 'updatedBy' | 'updatedAt'>) => {
    if (!currentUser) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const nextSettings: RtSettings = {
        ...data,
        updatedBy: currentUser.uid,
        updatedAt: nowIso,
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.SETTINGS, [
        settingsToRow(nextSettings, nowIso),
      ]);
      setRtSettings(nextSettings);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleAddBannerSlide = async (data: {
    title: string;
    subtitle: string;
    imageData: string;
  }) => {
    if (!currentUser) return;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return;

    const nextSortOrder =
      bannerSlides.length > 0
        ? Math.min(
            1000,
            Math.max(...bannerSlides.map((s) => Math.round(Number(s.sortOrder) || 0))) + 1
          )
        : 0;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const slide: BannerSlide = {
        id: generateRecordId('sld'),
        title: data.title.trim().slice(0, 80),
        subtitle: data.subtitle.trim().slice(0, 160),
        imageData: data.imageData,
        sortOrder: nextSortOrder,
        uploadedBy: currentUser.uid,
        communityId: 'rt_warga',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendSheetRows(conn, SHEET_TABS.SLIDES, [slideToRow(slide)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateBannerSlide = async (
    id: string,
    data: { title: string; subtitle: string }
  ) => {
    const conn = requireActiveSheet();
    if (!conn) return;
    const existing = bannerSlides.find((s) => s.id === id);
    if (!existing) return;

    isMutatingRef.current = true;
    try {
      const updated: BannerSlide = {
        ...existing,
        title: data.title.trim().slice(0, 80),
        subtitle: data.subtitle.trim().slice(0, 160),
        updatedAt: new Date().toISOString(),
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.SLIDES, [slideToRow(updated)]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleMoveBannerSlide = async (id: string, direction: 'up' | 'down') => {
    const conn = requireActiveSheet();
    if (!conn) return;
    const idx = bannerSlides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= bannerSlides.length) return;

    const reordered = [...bannerSlides];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const updatedRows = reordered.map((slide, orderIdx) =>
        slideToRow({
          ...slide,
          sortOrder: orderIdx,
          updatedAt: nowIso,
        })
      );
      await upsertSheetRowsByKey(conn, SHEET_TABS.SLIDES, updatedRows);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleDeleteBannerSlide = async (id: string) => {
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      await deleteSheetRowsByKey(conn, SHEET_TABS.SLIDES, [id]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleAddRegistryEntry = async (data: {
    fullName: string;
    houseBlock: string;
    role: LoginRole;
    pengurusPosition?: PengurusPosition;
    permissions?: RbacPermission[];
    residentStatus: ResidentStatus;
    familyStatus: FamilyStatus;
  }) => {
    if (!currentUser) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    const registryId = await computeResidentRegistryId(data.fullName, data.houseBlock);
    const existing = registryEntries.find((e) => e.registryId === registryId);
    const isPengurusEntry = data.role === 'pengurus' && rbac.isFullAdmin;
    const effectiveRole: LoginRole = isPengurusEntry ? 'pengurus' : 'warga';
    const pengurusPosition: PengurusPosition | undefined = isPengurusEntry
      ? data.pengurusPosition || 'pengurus_lain'
      : undefined;
    const permissions: RbacPermission[] | undefined =
      isPengurusEntry && pengurusPosition
        ? normalizePengurusPermissions(pengurusPosition, data.permissions)
        : undefined;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const entry: ResidentRegistryEntry = existing
        ? {
            ...existing,
            fullName: data.fullName.trim().slice(0, 80),
            houseBlock: data.houseBlock.trim().slice(0, 30),
            role: effectiveRole,
            pengurusPosition: isPengurusEntry ? pengurusPosition : undefined,
            permissions: isPengurusEntry ? permissions : undefined,
            residentStatus: effectiveRole === 'pengurus' ? 'pengurus' : data.residentStatus,
            familyStatus: data.familyStatus,
            verificationStatus: existing.verificationStatus || 'verified',
            updatedAt: nowIso,
          }
        : {
            registryId,
            fullName: data.fullName.trim().slice(0, 80),
            houseBlock: data.houseBlock.trim().slice(0, 30),
            role: effectiveRole,
            ...(isPengurusEntry && pengurusPosition && permissions
              ? { pengurusPosition, permissions }
              : {}),
            residentStatus: effectiveRole === 'pengurus' ? 'pengurus' : data.residentStatus,
            familyStatus: data.familyStatus,
            verificationStatus: 'verified',
            claimedUid: '',
            claimedUsername: '',
            communityId: 'rt_warga',
            createdBy: currentUser.uid,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
        registryEntryToRow(entry),
      ]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleBulkImportRegistry = async (
    items: Array<{
      fullName: string;
      houseBlock: string;
      role: LoginRole;
      pengurusPosition?: PengurusPosition;
      permissions?: RbacPermission[];
      residentStatus: ResidentStatus;
      familyStatus: FamilyStatus;
    }>
  ): Promise<number> => {
    if (!currentUser || items.length === 0) return 0;
    const conn = requireActiveSheet();
    if (!conn || !sheetInfo) return 0;

    const slice = items.slice(0, 200);

    isMutatingRef.current = true;
    try {
      const existingMap = new Map(registryEntries.map((e) => [e.registryId, e]));
      const nowIso = new Date().toISOString();
      const rowsToUpsert: string[][] = [];

      for (const item of slice) {
        const registryId = await computeResidentRegistryId(item.fullName, item.houseBlock);
        const existing = existingMap.get(registryId);
        const isPengurusEntry = item.role === 'pengurus' && rbac.isFullAdmin;
        const effectiveRole: LoginRole = isPengurusEntry ? 'pengurus' : 'warga';
        const pos: PengurusPosition | undefined = isPengurusEntry
          ? item.pengurusPosition || 'pengurus_lain'
          : undefined;
        const perms: RbacPermission[] | undefined =
          isPengurusEntry && pos
            ? normalizePengurusPermissions(pos, item.permissions)
            : undefined;

        const entry: ResidentRegistryEntry = existing
          ? {
              ...existing,
              fullName: item.fullName.trim().slice(0, 80),
              houseBlock: item.houseBlock.trim().slice(0, 30),
              role: effectiveRole,
              pengurusPosition: isPengurusEntry ? pos : undefined,
              permissions: isPengurusEntry ? perms : undefined,
              residentStatus: effectiveRole === 'pengurus' ? 'pengurus' : item.residentStatus,
              familyStatus: item.familyStatus,
              verificationStatus: existing.verificationStatus || 'verified',
              updatedAt: nowIso,
            }
          : {
              registryId,
              fullName: item.fullName.trim().slice(0, 80),
              houseBlock: item.houseBlock.trim().slice(0, 30),
              role: effectiveRole,
              ...(isPengurusEntry && pos && perms ? { pengurusPosition: pos, permissions: perms } : {}),
              residentStatus: effectiveRole === 'pengurus' ? 'pengurus' : item.residentStatus,
              familyStatus: item.familyStatus,
              verificationStatus: 'verified',
              claimedUid: '',
              claimedUsername: '',
              communityId: 'rt_warga',
              createdBy: currentUser.uid,
              createdAt: nowIso,
              updatedAt: nowIso,
            };

        existingMap.set(registryId, entry);
        rowsToUpsert.push(registryEntryToRow(entry));
      }

      if (rowsToUpsert.length > 0) {
        await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, rowsToUpsert);
        await refreshSpreadsheetData(conn, true);
      }
      return rowsToUpsert.length;
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
      return 0;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSyncExistingResidentsToRegistry = async (): Promise<number> => {
    if (!currentUser) return 0;
    const conn = requireActiveSheet();
    if (!conn) return 0;

    const existingIds = new Set(registryEntries.map((e) => e.registryId));
    const nowIso = new Date().toISOString();
    const newEntries: ResidentRegistryEntry[] = [];

    for (const res of residents) {
      const registryId = await computeResidentRegistryId(res.displayName, res.houseBlock);
      if (existingIds.has(registryId)) continue;
      const inferredRole: LoginRole =
        res.accountRole || (res.residentStatus === 'pengurus' ? 'pengurus' : 'warga');
      if (inferredRole === 'pengurus' && !rbac.isFullAdmin) continue;
      existingIds.add(registryId);
      const pos: PengurusPosition | undefined =
        inferredRole === 'pengurus' ? res.pengurusPosition || 'ketua_rt' : undefined;
      const perms: RbacPermission[] | undefined =
        inferredRole === 'pengurus' && pos
          ? normalizePengurusPermissions(pos, res.permissions)
          : undefined;

      newEntries.push({
        registryId,
        fullName: res.displayName.slice(0, 80),
        houseBlock: res.houseBlock.slice(0, 30),
        role: inferredRole,
        ...(inferredRole === 'pengurus' && pos && perms
          ? { pengurusPosition: pos, permissions: perms }
          : {}),
        residentStatus: res.residentStatus,
        familyStatus: res.familyStatus || 'umum',
        claimedUid: res.username ? res.uid : '',
        claimedUsername: res.username || '',
        communityId: 'rt_warga',
        createdBy: currentUser.uid,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    if (newEntries.length === 0) return 0;

    isMutatingRef.current = true;
    try {
      await appendSheetRows(
        conn,
        SHEET_TABS.RESIDENT_REGISTRY,
        newEntries.map(registryEntryToRow)
      );
      await refreshSpreadsheetData(conn, true);
      return newEntries.length;
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
      return 0;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateRegistryRbac = async (
    entry: ResidentRegistryEntry,
    next: {
      role: LoginRole;
      pengurusPosition?: PengurusPosition;
      permissions?: RbacPermission[];
    }
  ) => {
    if (!rbac.isFullAdmin) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    const isPengurusNext = next.role === 'pengurus';
    const pos: PengurusPosition = next.pengurusPosition || 'pengurus_lain';
    const perms = isPengurusNext ? normalizePengurusPermissions(pos, next.permissions) : [];

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const updatedReg: ResidentRegistryEntry = {
        ...entry,
        role: next.role,
        residentStatus: isPengurusNext ? 'pengurus' : 'tetap',
        pengurusPosition: isPengurusNext ? pos : undefined,
        permissions: isPengurusNext ? perms : undefined,
        updatedAt: nowIso,
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
        registryEntryToRow(updatedReg),
      ]);

      if (entry.claimedUid) {
        const claimedProfile = residents.find((r) => r.uid === entry.claimedUid);
        if (claimedProfile) {
          await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [
            userProfileToRow({
              ...claimedProfile,
              residentStatus: isPengurusNext ? 'pengurus' : 'tetap',
              accountRole: next.role,
              pengurusPosition: isPengurusNext ? pos : undefined,
              permissions: isPengurusNext ? perms : undefined,
              updatedAt: nowIso,
            }),
          ]);
        }

        if (entry.claimedUsername) {
          const claimedAcc = userAccounts.find(
            (a) => normalizeUsername(a.username) === normalizeUsername(entry.claimedUsername || '')
          );
          if (claimedAcc) {
            await upsertSheetRowsByKey(conn, SHEET_TABS.USER_ACCOUNTS, [
              userAccountToRow({
                ...claimedAcc,
                role: next.role,
              }),
            ]);
          }
        }

        if (isPengurusNext) {
          const existingAdmin = adminRecords.find((a) => a.uid === entry.claimedUid);
          const nextAdmin: AdminRoleRecord = {
            uid: entry.claimedUid,
            email:
              existingAdmin?.email ||
              (entry.claimedUsername
                ? usernameToAuthEmail(entry.claimedUsername)
                : `${entry.claimedUid}@akun.siskeurt12.id`),
            name: entry.fullName.slice(0, 80),
            role: pos,
            permissions: perms,
            registryId: entry.registryId,
            createdAt: existingAdmin?.createdAt || nowIso,
          };
          await upsertSheetRowsByKey(conn, SHEET_TABS.ADMINS, [adminRecordToRow(nextAdmin)]);
          if (entry.claimedUid === currentUser?.uid) {
            setAdminRecord(nextAdmin);
          }
        } else {
          await deleteSheetRowsByKey(conn, SHEET_TABS.ADMINS, [entry.claimedUid]);
          if (entry.claimedUid === currentUser?.uid && !isBootstrappedAdminUser) {
            setAdminRecord(null);
          }
        }
      }

      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleUpdateRegistryDetails = async (
    entry: ResidentRegistryEntry,
    next: {
      fullName: string;
      houseBlock: string;
      residentStatus: ResidentStatus;
      familyStatus: FamilyStatus;
    }
  ) => {
    if (!rbac.canManageResidents) return;
    if (!rbac.isFullAdmin && entry.role === 'pengurus') return;
    const conn = requireActiveSheet();
    if (!conn) return;

    const trimmedName = next.fullName.trim().slice(0, 80);
    const trimmedBlock = next.houseBlock.trim().slice(0, 30);
    if (!trimmedName || !trimmedBlock) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const updatedReg: ResidentRegistryEntry = {
        ...entry,
        fullName: trimmedName,
        houseBlock: trimmedBlock,
        residentStatus: entry.role === 'pengurus' ? 'pengurus' : next.residentStatus,
        familyStatus: next.familyStatus,
        updatedAt: nowIso,
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
        registryEntryToRow(updatedReg),
      ]);

      if (entry.claimedUid) {
        const claimedProfile = residents.find((r) => r.uid === entry.claimedUid);
        if (claimedProfile) {
          const prevFam: FamilyStatus = claimedProfile.familyStatus || 'umum';
          let nextFamLog = claimedProfile.familyStatusLog;
          if (next.familyStatus !== prevFam) {
            const effMonth = getEffectiveFamilyStatusChangeMonth(
              transactions,
              claimedProfile.uid
            );
            nextFamLog = buildUpdatedFamilyStatusLog(
              claimedProfile,
              next.familyStatus,
              effMonth
            );
          }
          const updatedProf: ResidentPublic = {
            ...claimedProfile,
            displayName: trimmedName,
            houseBlock: trimmedBlock,
            residentStatus: entry.role === 'pengurus' ? 'pengurus' : next.residentStatus,
            familyStatus: next.familyStatus,
            familyStatusLog: nextFamLog,
            updatedAt: nowIso,
          };
          await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [
            userProfileToRow(updatedProf),
          ]);
          if (claimedProfile.uid === currentUser?.uid) {
            setProfile(updatedProf);
          }
        }

        if (entry.role === 'pengurus') {
          const existingAdm = adminRecords.find((a) => a.uid === entry.claimedUid);
          if (existingAdm) {
            const nextAdm: AdminRoleRecord = {
              ...existingAdm,
              name: trimmedName,
            };
            await upsertSheetRowsByKey(conn, SHEET_TABS.ADMINS, [adminRecordToRow(nextAdm)]);
            if (existingAdm.uid === currentUser?.uid) {
              setAdminRecord(nextAdm);
            }
          }
        }
      }

      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleResetRegistryClaim = async (entry: ResidentRegistryEntry) => {
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      const updated: ResidentRegistryEntry = {
        ...entry,
        claimedUid: '',
        claimedUsername: '',
        updatedAt: new Date().toISOString(),
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
        registryEntryToRow(updated),
      ]);
      if (entry.claimedUsername) {
        await deleteSheetRowsByKey(conn, SHEET_TABS.USER_ACCOUNTS, [entry.claimedUsername]);
      }
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleSetRegistryVerification = async (
    entry: ResidentRegistryEntry,
    nextStatus: VerificationStatus
  ) => {
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const updatedReg: ResidentRegistryEntry = {
        ...entry,
        verificationStatus: nextStatus,
        updatedAt: nowIso,
      };
      await upsertSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [
        registryEntryToRow(updatedReg),
      ]);
      if (entry.claimedUid) {
        const claimedProf = residents.find((r) => r.uid === entry.claimedUid);
        if (claimedProf) {
          await upsertSheetRowsByKey(conn, SHEET_TABS.USERS, [
            userProfileToRow({
              ...claimedProf,
              verificationStatus: nextStatus,
              updatedAt: nowIso,
            }),
          ]);
        }
      }
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleDeleteRegistryEntry = async (entry: ResidentRegistryEntry) => {
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      await deleteSheetRowsByKey(conn, SHEET_TABS.RESIDENT_REGISTRY, [entry.registryId]);
      if (entry.claimedUsername) {
        await deleteSheetRowsByKey(conn, SHEET_TABS.USER_ACCOUNTS, [entry.claimedUsername]);
      }
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
      else throw err;
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const conn = requireActiveSheet();
    if (!conn) return;
    const target = allNotifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    isMutatingRef.current = true;
    try {
      await upsertSheetRowsByKey(conn, SHEET_TABS.NOTIFICATIONS, [
        notificationToRow({ ...target, isRead: true }),
      ]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const conn = requireActiveSheet();
    if (!conn) return;

    isMutatingRef.current = true;
    try {
      await upsertSheetRowsByKey(
        conn,
        SHEET_TABS.NOTIFICATIONS,
        unread.map((n) => notificationToRow({ ...n, isRead: true }))
      );
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
    } finally {
      isMutatingRef.current = false;
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const conn = requireActiveSheet();
    if (!conn) return;
    const target = allNotifications.find((n) => n.id === id);
    if (!target || (currentUser && target.targetUid !== currentUser.uid)) return;

    isMutatingRef.current = true;
    try {
      await deleteSheetRowsByKey(conn, SHEET_TABS.NOTIFICATIONS, [id]);
      await refreshSpreadsheetData(conn, true);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) handleExpiredToken();
    } finally {
      isMutatingRef.current = false;
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-6 overflow-x-clip">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-display font-extrabold text-base">
            RT
          </div>
          <p className="font-display text-lg font-extrabold text-slate-900 dark:text-slate-100">
            SISKEU RT 12/RW 20 SUKATANI
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Menyiapkan Database...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!currentUser || !profile ? (
        <LoginScreen
          googleConnected={googleConnected}
          googleUserEmail={googleUserEmail}
          sheetInfo={sheetInfo}
          isConnectingSheet={isConnectingSheet || isSyncing}
          isDatabaseEmpty={
            Boolean(sheetInfo?.spreadsheetId) &&
            hasSyncedSheetOnce &&
            adminRecords.length === 0 &&
            residents.length === 0 &&
            registryEntries.length === 0
          }
          onConnectWebApp={handleConnectWebApp}
          onBootstrapFirstAdmin={handleBootstrapFirstAdmin}
          onGoogleConnect={handleGoogleConnect}
          onGoogleDisconnect={handleGoogleDisconnect}
          onConnectSpreadsheetById={handleConnectSpreadsheetById}
          onLoginWithCredentials={handleLoginWithCredentials}
          onRegisterAccount={handleRegisterAccount}
          onGoogleAdminLogin={handleGoogleAdminLogin}
          isLoggingIn={isLoggingIn}
          loginError={loginError}
          onClearError={() => setLoginError(null)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          elderlyMode={elderlyMode}
          onToggleElderlyMode={() => setElderlyMode((e) => !e)}
          isOnline={isOnline}
          bannerSlides={bannerSlides}
        />
      ) : (
        (() => {
          const offlineItems = getOfflineQueue();
          const mergedTransactions: KasTransaction[] = [
            ...offlineItems
              .filter((q) => q.kind === 'dues_submission')
              .map((q) => ({
                id: q.localId,
                ...(q.payload as Omit<KasTransaction, 'id'>),
                createdAt: q.createdAtIso,
                isOfflinePending: true,
              })),
            ...transactions,
          ];
          const mergedEmergencies: EmergencyAlert[] = [
            ...offlineItems
              .filter((q) => q.kind === 'emergency_alert')
              .map((q) => ({
                id: q.localId,
                ...(q.payload as Omit<EmergencyAlert, 'id'>),
                createdAt: q.createdAtIso,
                isOfflinePending: true,
              })),
            ...emergencies,
          ];

          const activeEmergencyCount = mergedEmergencies.filter(
            (e) => e.status !== 'resolved'
          ).length;

          return (
            <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 lg:pb-8 overflow-x-clip">
              <HeaderNav
                activeTab={activeTab}
                onNavigate={(tab) => {
                  setActiveTab(tab);
                  setOpenPaymentModalOnKas(false);
                  setKasInitialFilterTab('all');
                  scrollPageToTop();
                }}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllRead={handleMarkAllRead}
                onDeleteNotification={handleDeleteNotification}
                onOpenSettings={() => setSettingsOpen(true)}
                activeEmergencyCount={activeEmergencyCount}
                onLogout={handleLogout}
              />

              {/* Non-intrusive Real-Time Toast Banner */}
              {liveToast && (
                <div
                  role="status"
                  className={`fixed top-16 right-4 z-50 max-w-sm w-[calc(100%-2rem)] rounded-2xl p-4 shadow-xl border flex items-start gap-3 ${
                    liveToast.urgent
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
                  }`}
                >
                  <BellRing className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{liveToast.title}</p>
                    <p className="text-xs opacity-90 mt-0.5 line-clamp-2">{liveToast.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLiveToast(null)}
                    aria-label="Tutup pemberitahuan"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Offline / Pending Sync Notice */}
              {(!isOnline || offlineQueueCount > 0) && (
                <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 print:hidden">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2.5">
                      <WifiOff className="w-4 h-4 shrink-0" />
                      <span>
                        {!isOnline
                          ? 'Mode Offline Aktif — Data kas & profil darurat tetap dapat diakses. Perubahan siap disinkronkan ke Google Spreadsheet saat online.'
                          : `${offlineQueueCount} data offline siap disinkronkan ke Google Spreadsheet.`}
                      </span>
                    </div>
                    {isOnline && offlineQueueCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void flushOfflineQueue()}
                        className="min-h-[36px] px-3 rounded-lg bg-amber-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sinkronkan</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Non-blocking New User Interactive Tutorial Banner */}
              {showNewUserBanner && (
                <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 print:hidden">
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Selamat datang di KasWarga RT! Baru pertama kali menggunakan aplikasi?
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Ikuti panduan interaktif 1 menit untuk mengenal cara bayar iuran, cek laporan, dan tombol darurat SOS.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem(`kaswarga_seen_intro_${currentUser.uid}`, '1');
                          setShowNewUserBanner(false);
                          setTutorialOpen(true);
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Mulai Panduan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem(`kaswarga_seen_intro_${currentUser.uid}`, '1');
                          setShowNewUserBanner(false);
                        }}
                        className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 cursor-pointer"
                      >
                        Nanti Saja
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Database Setup Panel (only after Admin login when no Spreadsheet exists) */}
              {!sheetInfo && (
                <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 print:hidden">
                  {rbac.isFullAdmin ? (
                    <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-4 sm:p-5 space-y-3.5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                              Database Google Spreadsheet Belum Dibuat
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                              Anda sudah masuk sebagai Admin ({rbac.positionLabel}). Buat database Google Spreadsheet baru di Google Drive Anda atau hubungkan Spreadsheet RT yang sudah ada.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isConnectingSheet || !isOnline}
                          onClick={() => void handleCreateSpreadsheet()}
                          className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                        >
                          <FolderPlus className="w-4 h-4 shrink-0" />
                          <span>
                            {isConnectingSheet
                              ? 'Menyiapkan Spreadsheet...'
                              : 'Buat Database Spreadsheet Baru'}
                          </span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/70">
                        <input
                          type="text"
                          value={adminSheetInput}
                          onChange={(e) => setAdminSheetInput(e.target.value)}
                          placeholder="Atau tempel URL / ID Google Spreadsheet RT yang sudah ada..."
                          className="flex-1 min-w-0 min-h-[40px] px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs"
                        />
                        <button
                          type="button"
                          disabled={isConnectingSheet || !adminSheetInput.trim() || !isOnline}
                          onClick={async () => {
                            await handleConnectSpreadsheetById(adminSheetInput);
                            setAdminSheetInput('');
                          }}
                          className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Hubungkan Spreadsheet</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                      Database Google Spreadsheet belum terhubung. Silakan hubungi Ketua RT untuk membuat atau membagikan Spreadsheet RT.
                    </div>
                  )}
                </div>
              )}

              <main className="max-w-6xl mx-auto px-3 sm:px-6 py-3.5 sm:py-8">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === 'beranda' && (
                    <DashboardView
                      profile={profile}
                      rbac={rbac}
                      rtSettings={rtSettings}
                      transactions={mergedTransactions}
                      residents={residents}
                      registryEntries={registryEntries}
                      announcements={announcements}
                      emergencies={mergedEmergencies}
                      onNavigate={setActiveTab}
                      onOpenTutorial={() => setTutorialOpen(true)}
                      onQuickPayDues={() => {
                        setKasInitialFilterTab('all');
                        setOpenPaymentModalOnKas(true);
                        setActiveTab('kas');
                      }}
                      onViewMyDues={() => {
                        setOpenPaymentModalOnKas(false);
                        setKasInitialFilterTab(rbac.isPengurus ? 'mine' : 'all');
                        setFocusKasTransactionsKey((k) => k + 1);
                        setActiveTab('kas');
                      }}
                    />
                  )}

                  {activeTab === 'kas' && (
                    <CashflowAndDuesView
                      profile={profile}
                      residents={residents}
                      isPengurus={rbac.isPengurus}
                      canManageKas={rbac.canManageKas}
                      isOnline={isOnline}
                      rtSettings={rtSettings}
                      transactions={mergedTransactions}
                      openPaymentModalInitially={openPaymentModalOnKas}
                      initialFilterTab={kasInitialFilterTab}
                      focusTransactionsKey={focusKasTransactionsKey}
                      onCloseInitialPaymentModal={() => setOpenPaymentModalOnKas(false)}
                      onSubmitDues={handleSubmitDues}
                      onAdminCreateTransaction={handleAdminCreateTransaction}
                      onAdminVerifyTransaction={handleAdminVerifyTransaction}
                    />
                  )}

                  {activeTab === 'laporan' && (
                    <MonthlyReportView
                      canManageReports={rbac.canManageReports}
                      canManageResidents={rbac.canManageResidents}
                      rtSettings={rtSettings}
                      transactions={mergedTransactions}
                      residents={residents}
                      onSendPaymentReminders={handleSendPaymentReminders}
                      onOpenResidentRegistry={() => setRegistryOpen(true)}
                    />
                  )}

                  {activeTab === 'pengumuman' && (
                    <AnnouncementsView
                      canManageAnnouncements={rbac.canManageAnnouncements}
                      announcements={announcements}
                      onPublishAnnouncement={handlePublishAnnouncement}
                      onUpdateAnnouncement={handleUpdateAnnouncement}
                      onDeleteAnnouncement={handleDeleteAnnouncement}
                    />
                  )}
                </motion.div>
              </main>

              <MobileBottomNav
                activeTab={activeTab}
                onNavigate={(tab) => {
                  setActiveTab(tab);
                  setOpenPaymentModalOnKas(false);
                  setKasInitialFilterTab('all');
                  scrollPageToTop();
                }}
                activeEmergencyCount={activeEmergencyCount}
              />

              <OnboardingTutorial
                isOpen={tutorialOpen}
                onClose={() => setTutorialOpen(false)}
                onNavigate={setActiveTab}
              />

              <ProfileSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                profile={profile}
                userEmail={currentUser.email || ''}
                rbac={rbac}
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode((d) => !d)}
                elderlyMode={elderlyMode}
                onToggleElderlyMode={() => void handleToggleElderlyMode()}
                rtSettings={rtSettings}
                transactions={mergedTransactions}
                bannerSlides={bannerSlides}
                registryCount={registryEntries.length}
                onOpenResidentRegistry={() => setRegistryOpen(true)}
                onSaveProfile={handleSaveProfile}
                onSaveRtSettings={handleSaveRtSettings}
                onAddBannerSlide={handleAddBannerSlide}
                onUpdateBannerSlide={handleUpdateBannerSlide}
                onMoveBannerSlide={handleMoveBannerSlide}
                onDeleteBannerSlide={handleDeleteBannerSlide}
                onOpenTutorial={() => setTutorialOpen(true)}
                onLogout={handleLogout}
                sheetInfo={sheetInfo}
                isSyncing={isSyncing}
                isConnectingSheet={isConnectingSheet}
                onSyncNow={() => void refreshSpreadsheetData(undefined, false)}
                onCreateSpreadsheet={
                  rbac.isFullAdmin && sheetInfo?.mode !== 'webapp'
                    ? handleCreateSpreadsheet
                    : undefined
                }
                onConnectSpreadsheetById={
                  rbac.isFullAdmin && sheetInfo?.mode !== 'webapp'
                    ? handleConnectSpreadsheetById
                    : undefined
                }
                onDisconnectGoogle={handleGoogleDisconnect}
              />

              {rbac.canManageResidents && (
                <ResidentRegistryModal
                  isOpen={registryOpen}
                  onClose={() => setRegistryOpen(false)}
                  canManageRbac={rbac.isFullAdmin}
                  currentUserUid={currentUser.uid}
                  sheetInfo={sheetInfo}
                  registryEntries={registryEntries}
                  existingResidents={residents}
                  onAddEntry={handleAddRegistryEntry}
                  onBulkImport={handleBulkImportRegistry}
                  onSyncExistingResidents={handleSyncExistingResidentsToRegistry}
                  onUpdateEntryDetails={handleUpdateRegistryDetails}
                  onUpdateRbac={handleUpdateRegistryRbac}
                  onSetVerificationStatus={handleSetRegistryVerification}
                  onResetClaim={handleResetRegistryClaim}
                  onDeleteEntry={handleDeleteRegistryEntry}
                />
              )}
            </div>
          );
        })()
      )}
    </>
  );
}
