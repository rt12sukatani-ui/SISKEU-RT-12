import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Accessibility,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Link2,
  Lock,
  LogIn,
  Moon,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sun,
  Unplug,
  User,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import { APPS_SCRIPT_BRIDGE_CODE } from '../lib/appsScriptTemplate';
import { hasConfiguredGoogleOAuthClientId } from '../lib/googleAuth';
import { getOfflineSnapshot } from '../lib/offlineSync';
import type { BannerSlide, LoginRole, PengurusPosition, SheetDbInfo } from '../types';
import { PENGURUS_POSITION_LABELS } from '../utils/rbac';
import { PWAInstallButton } from './PWAInstallButton';

interface RegisteredAccountNotice {
  role: LoginRole;
  username: string;
  fullName: string;
  pengurusPosition?: PengurusPosition;
}

interface LoginScreenProps {
  googleConnected: boolean;
  googleUserEmail: string | null;
  sheetInfo: SheetDbInfo | null;
  isConnectingSheet: boolean;
  isDatabaseEmpty: boolean;
  onConnectWebApp: (webAppUrl: string) => Promise<void>;
  onBootstrapFirstAdmin: (data: {
    fullName: string;
    houseBlock: string;
    username: string;
    password: string;
  }) => Promise<void>;
  onGoogleConnect: () => Promise<void>;
  onGoogleDisconnect: () => Promise<void>;
  onConnectSpreadsheetById: (idOrUrl: string) => Promise<void>;
  onSyncSpreadsheet: () => Promise<void>;
  onLoginWithCredentials: (data: {
    role: LoginRole;
    username: string;
    password: string;
  }) => Promise<void>;
  onRegisterAccount: (data: {
    role: LoginRole;
    fullName: string;
    houseBlock: string;
    username: string;
    password: string;
  }) => Promise<RegisteredAccountNotice | null>;
  onGoogleAdminLogin: () => Promise<void>;
  isLoggingIn: boolean;
  loginError: string | null;
  onClearError: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  elderlyMode: boolean;
  onToggleElderlyMode: () => void;
  isOnline: boolean;
  bannerSlides?: BannerSlide[];
}

interface SlideItem {
  id: string;
  title: string;
  subtitle: string;
  imageData: string;
}

const DEFAULT_FALLBACK_SLIDE: SlideItem = {
  id: 'default-rt-banner',
  title: 'Portal RT 12 / RW 20 Sukatani',
  subtitle: 'Transparansi Kas Warga · Dokumentasi Kegiatan Lingkungan',
  imageData: 'src/assets/images/porseni 2026.jpeg',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({
  googleConnected,
  googleUserEmail,
  sheetInfo,
  isConnectingSheet,
  isDatabaseEmpty,
  onConnectWebApp,
  onBootstrapFirstAdmin,
  onGoogleConnect,
  onGoogleDisconnect,
  onConnectSpreadsheetById,
  onSyncSpreadsheet,
  onLoginWithCredentials,
  onRegisterAccount,
  onGoogleAdminLogin,
  isLoggingIn,
  loginError,
  onClearError,
  darkMode,
  onToggleDarkMode,
  elderlyMode,
  onToggleElderlyMode,
  isOnline,
  bannerSlides = [],
}) => {
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<LoginRole>('warga');
  const [fullName, setFullName] = useState('');
  const [houseBlock, setHouseBlock] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loginPopupData, setLoginPopupData] = useState<RegisteredAccountNotice | null>(null);
  const [webAppUrlInput, setWebAppUrlInput] = useState('');
  const [sheetInput, setSheetInput] = useState('');
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const oauthAvailable = hasConfiguredGoogleOAuthClientId();
  const activeErrorText = localError || loginError;

  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_BRIDGE_CODE);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      setLocalError('Browser menolak akses salin otomatis. Silakan salin manual dari kotak kode.');
    }
  };

  const handleSubmitBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!fullName.trim() || !houseBlock.trim()) {
      setLocalError('Nama Lengkap dan Blok Rumah Ketua RT wajib diisi.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
      setLocalError('Username harus 3–30 karakter (huruf, angka, garis bawah _, atau tanda hubung -).');
      return;
    }
    if (password.length < 6) {
      setLocalError('Sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Konfirmasi sandi tidak cocok.');
      return;
    }
    await onBootstrapFirstAdmin({
      fullName: fullName.trim(),
      houseBlock: houseBlock.trim(),
      username: username.trim(),
      password,
    });
  };

  const shouldReduceMotion = useReducedMotion();
  const offlineSnapshot = getOfflineSnapshot();

  const handleSwitchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setLocalError(null);
    onClearError();
  };

  const handleSelectRole = (role: LoginRole) => {
    setSelectedRole(role);
    setLocalError(null);
    onClearError();
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!username.trim() || !password) {
      setLocalError('Masukkan username dan sandi Anda.');
      return;
    }
    await onLoginWithCredentials({
      role: selectedRole,
      username: username.trim(),
      password,
    });
  };

  const handleSubmitPopupLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPopupData) return;
    setLocalError(null);
    onClearError();
    if (!username.trim() || !password) {
      setLocalError('Masukkan username dan sandi Anda.');
      return;
    }
    await onLoginWithCredentials({
      role: loginPopupData.role,
      username: username.trim(),
      password,
    });
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!fullName.trim() || !houseBlock.trim()) {
      setLocalError('Nama Lengkap dan Blok Rumah wajib diisi sesuai database warga.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
      setLocalError('Username harus 3–30 karakter (huruf, angka, garis bawah _, atau tanda hubung -).');
      return;
    }
    if (password.length < 6) {
      setLocalError('Sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Konfirmasi sandi tidak cocok.');
      return;
    }
    const result = await onRegisterAccount({
      role: selectedRole,
      fullName: fullName.trim(),
      houseBlock: houseBlock.trim(),
      username: username.trim(),
      password,
    });
    if (result) {
      setSelectedRole(result.role);
      setAuthMode('login');
      setUsername(result.username);
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setHouseBlock('');
      setLocalError(null);
      setLoginPopupData(result);
    }
  };

  const slides: SlideItem[] = useMemo(() => {
    if (bannerSlides.length === 0) return [DEFAULT_FALLBACK_SLIDE];
    return bannerSlides.map((slide, idx) => ({
      id: slide.id || `slide-${idx}`,
      title: slide.title?.trim() || `Kegiatan Warga #${idx + 1}`,
      subtitle:
        slide.subtitle?.trim() ||
        'Dokumentasi Kegiatan & Transparansi Warga RT 12 / RW 20 Sukatani',
      imageData: slide.imageData,
    }));
  }, [bannerSlides]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isHovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length, isHovered]);

  const currentSlide = slides[activeIndex] || DEFAULT_FALLBACK_SLIDE;
  const currentSlideFailed = Boolean(failedSlideIds[currentSlide.id]);

  const handlePrevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!emblemFailed ? (
              <img
                src="src/assets/images/app_emblem_icon_1795010549252.png"
                alt="Logo SISKEU RT12/RW20 SUKATANI"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                RT
              </div>
            )}
            <div className="min-w-0">
              <span className="font-display text-sm sm:text-base font-extrabold tracking-tight block truncate">
                SISKEU RT12/RW20 SUKATANI
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                Sistem Keuangan &amp; Siaga Warga
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onToggleElderlyMode}
              aria-pressed={elderlyMode}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                elderlyMode
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Accessibility className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Teks Besar</span>
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100dvh-4rem)]">
        {/* Full-Height Edge-to-Edge Activity Photo Slideshow */}
        <section
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="lg:col-span-7 xl:col-span-8 relative min-h-[340px] sm:min-h-[420px] lg:min-h-full bg-slate-900 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSlide.id}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.25 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.25 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' }}
              className="absolute inset-0 w-full h-full"
            >
              {!currentSlideFailed ? (
                <img
                  src={currentSlide.imageData}
                  alt={currentSlide.title}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedSlideIds((prev) => ({ ...prev, [currentSlide.id]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 flex items-center justify-center p-8 text-white text-center">
                  <p className="text-lg font-bold">{currentSlide.title}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Previous / Next Controls */}
          {slides.length > 1 && (
            <div
              className={`absolute inset-y-0 inset-x-4 z-10 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Foto kegiatan sebelumnya"
                className={`${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                } min-h-[44px] min-w-[44px] rounded-full bg-slate-950/55 hover:bg-slate-950/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Foto kegiatan berikutnya"
                className={`${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                } min-h-[44px] min-w-[44px] rounded-full bg-slate-950/55 hover:bg-slate-950/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Bottom caption & slide indicators */}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-6 sm:p-8 lg:p-10 pt-20">
            <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1.5 leading-snug max-w-2xl">
              {currentSlide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 mt-1.5 max-w-2xl line-clamp-2">
              {currentSlide.subtitle}
            </p>

            {slides.length > 1 && (
              <div
                className="mt-5 flex items-center gap-1.5"
                role="tablist"
                aria-label="Pilih foto kegiatan"
              >
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIndex}
                    aria-label={`Tampilkan foto ${idx + 1}: ${slide.title}`}
                    onClick={() => setActiveIndex(idx)}
                    className="min-h-[28px] flex-1 max-w-[56px] flex items-center cursor-pointer group"
                  >
                    <span
                      className={`block w-full h-1.5 rounded-full transition-all ${
                        idx === activeIndex
                          ? 'bg-emerald-400'
                          : 'bg-white/35 group-hover:bg-white/60'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Full-Height Right Panel: Modern Login Portal & Offline Emergency Quick-Dial */}
        <section className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between px-6 sm:px-8 lg:px-10 pt-3 pb-6 gap-6">
          <div className="flex-1 flex flex-col justify-start">
            <h1 className="mt-0 font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.18] text-slate-900 dark:text-slate-50 [text-wrap:balance]">              
              Portal Sistem Keuangan &amp; Siaga Warga RT 12 / RW 20 Sukatani
            </h1>

            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Pantau kas RT secara terbuka, iuran bulanan, cek laporan bulanan, dan akses layanan darurat.
            </p>

            {/* Google Spreadsheet Database Connection Card (100% Spreadsheet, Zero Firebase) */}
            <div className="mt-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Database Google Spreadsheet
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {sheetInfo
                        ? `${sheetInfo.spreadsheetTitle} · ${
                            sheetInfo.mode === 'webapp'
                              ? 'Apps Script Web App'
                              : googleUserEmail || 'Google OAuth'
                          }`
                        : googleConnected
                        ? `Terhubung (${googleUserEmail || 'Google OAuth'}) · Pilih Spreadsheet`
                        : 'Hubungkan URL Web App Apps Script dari Google Spreadsheet RT'}
                    </p>
                  </div>
                </div>
                {(sheetInfo || googleConnected) && (
                  <button
                    type="button"
                    onClick={() => void onGoogleDisconnect()}
                    title="Putuskan koneksi Spreadsheet"
                    aria-label="Putuskan koneksi Spreadsheet"
                    className="min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Unplug className="w-3 h-3" />
                    <span>Putuskan</span>
                  </button>
                )}
              </div>

              {sheetInfo && !showSheetSwitcher ? (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <a
                    href={sheetInfo.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    disabled={isConnectingSheet}
                    onClick={() => void onSyncSpreadsheet()}
                    className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isConnectingSheet ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSheetSwitcher(true)}
                    className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Ganti Koneksi
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pt-0.5">
                  {/* Primary: Apps Script Web App URL (zero Firebase, zero Google OAuth block) */}
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      value={webAppUrlInput}
                      onChange={(e) => setWebAppUrlInput(e.target.value)}
                      placeholder="Tempel URL Web App (https://script.google.com/macros/s/.../exec)"
                      className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs"
                    />
                    <button
                      type="button"
                      disabled={isConnectingSheet || !webAppUrlInput.trim() || !isOnline}
                      onClick={async () => {
                        await onConnectWebApp(webAppUrlInput);
                        setShowSheetSwitcher(false);
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{isConnectingSheet ? 'Menghubungkan...' : 'Hubungkan'}</span>
                    </button>
                  </div>

                  {/* Step-by-step Apps Script setup guide with 1-click copy */}
                  <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-900/80 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSetupGuide((v) => !v)}
                      className="w-full px-3 py-2 text-left text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Panduan Setup Google Spreadsheet (Gratis, Tanpa Firebase &amp; Tanpa Blokir Google)
                        </span>
                      </span>
                      {showSetupGuide ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    {showSetupGuide && (
                      <div className="px-3 pb-3 pt-1 border-t border-emerald-100 dark:border-emerald-900/60 space-y-2.5 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        <ol className="list-decimal list-inside space-y-1">
                          <li>
                            Buat atau buka file <strong>Google Spreadsheet</strong> khusus RT di Google Drive Anda.
                          </li>
                          <li>
                            Klik menu <strong>Ekstensi → Apps Script</strong>, hapus seluruh kode bawaan, lalu tempel kode bridge di bawah.
                          </li>
                          <li>
                            Klik <strong>Terapkan → Deployment baru</strong> → pilih jenis <strong>Aplikasi web</strong>:
                            <br />
                            <span className="text-slate-600 dark:text-slate-400">
                              • Jalankan sebagai: <strong>Saya (Me)</strong>
                              <br />
                              • Yang memiliki akses: <strong>Siapa saja (Anyone)</strong>
                            </span>
                          </li>
                          <li>
                            Klik <strong>Terapkan</strong>, izinkan akses sekali di akun pemilik Sheet, salin <strong>URL Aplikasi Web</strong> (<code>.../exec</code>), lalu tempel ke kolom di atas.
                          </li>
                        </ol>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyAppsScript()}
                            className="min-h-[34px] px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedScript ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                                <span>Kode Apps Script Disalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin Kode Apps Script (Code.gs)</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Tips Vercel: Simpan URL tersebut di Environment Variable{' '}
                          <code className="font-mono">VITE_SHEETS_WEBAPP_URL</code> agar seluruh warga otomatis terhubung tanpa menempel URL lagi.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional OAuth fallback only when VITE_GOOGLE_OAUTH_CLIENT_ID is explicitly configured */}
                  {oauthAvailable && (
                    <div className="pt-1.5 border-t border-emerald-200/70 dark:border-emerald-900/60 space-y-2">
                      {!googleConnected ? (
                        <button
                          type="button"
                          disabled={isConnectingSheet || !isOnline}
                          onClick={() => void onGoogleConnect()}
                          className="gsi-material-button"
                        >
                          <div className="gsi-material-button-state" />
                          <div className="gsi-material-button-content-wrapper">
                            <div className="gsi-material-button-icon">
                              <svg
                                version="1.1"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 48 48"
                                xmlnsXlink="http://www.w3.org/1999/xlink"
                                style={{ display: 'block' }}
                              >
                                <path
                                  fill="#EA4335"
                                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                />
                                <path
                                  fill="#4285F4"
                                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                />
                                <path fill="none" d="M0 0h48v48H0z" />
                              </svg>
                            </div>
                            <span className="gsi-material-button-contents">
                              {isConnectingSheet
                                ? 'Menghubungkan Google...'
                                : 'Atau Hubungkan via OAuth Google'}
                            </span>
                            <span style={{ display: 'none' }}>Sign in with Google</span>
                          </div>
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={sheetInput}
                            onChange={(e) => setSheetInput(e.target.value)}
                            placeholder="URL / ID Google Spreadsheet (Mode OAuth)..."
                            className="flex-1 min-w-0 min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                          <button
                            type="button"
                            disabled={isConnectingSheet || !sheetInput.trim() || !isOnline}
                            onClick={async () => {
                              await onConnectSpreadsheetById(sheetInput);
                              setSheetInput('');
                              setShowSheetSwitcher(false);
                            }}
                            className="min-h-[38px] px-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Pakai</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {sheetInfo && (
                    <button
                      type="button"
                      onClick={() => setShowSheetSwitcher(false)}
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                    >
                      Batal ganti koneksi
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Auth Box */}
            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              {/* Role Selector: Warga vs Pengurus */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Pilih Role Akses
                </p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSelectRole('warga')}
                    className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedRole === 'warga'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>Warga</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('pengurus')}
                    className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedRole === 'pengurus'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Pengurus</span>
                  </button>
                </div>
              </div>

              {/* Mode Tabs: Masuk vs Daftar Akun */}
              <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`min-h-[40px] text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'login'
                      ? 'border-emerald-700 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`min-h-[40px] text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'register'
                      ? 'border-emerald-700 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Daftar Akun</span>
                </button>
              </div>

              {!isOnline && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3.5 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <p className="font-bold">Perangkat sedang offline</p>
                    <p className="mt-0.5">
                      Masuk atau pendaftaran akun membutuhkan koneksi internet. Nomor darurat &amp; kartu medis tersimpan tetap aktif di bawah.
                    </p>
                  </div>
                </div>
              )}

              {activeErrorText && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-medium text-red-800 dark:text-red-200 leading-relaxed"
                >
                  <p>{activeErrorText}</p>
                </div>
              )}

              {selectedRole === 'pengurus' && sheetInfo && isDatabaseEmpty && authMode === 'login' ? (
                <form onSubmit={(e) => void handleSubmitBootstrapAdmin(e)} className="space-y-3">
                  <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <p className="font-bold">Spreadsheet Baru Masih Kosong — Buat Admin Pertama</p>
                    <p className="mt-0.5">
                      Buat akun <strong>Ketua RT</strong> pertama langsung di Google Spreadsheet tanpa perlu login Google OAuth. Setelah masuk, Anda bisa mengimpor Database Warga.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Lengkap Ketua RT
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={75}
                      placeholder="Contoh: Firman Mahameru"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Blok Rumah
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={25}
                      placeholder="Contoh: FF3/5"
                      value={houseBlock}
                      onChange={(e) => setHouseBlock(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username Admin
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      placeholder="Contoh: ketua_rt12"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sandi (Min. 6 karakter)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full min-h-[42px] pl-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ulangi Sandi
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Ketik ulang sandi"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !isOnline}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {isLoggingIn
                        ? 'Menyimpan Akun Ketua RT...'
                        : 'Buat Akun Ketua RT Pertama & Masuk'}
                    </span>
                  </button>
                </form>
              ) : authMode === 'login' ? (
                <form onSubmit={(e) => void handleSubmitLogin(e)} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username ({selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'})
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Masukkan Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sandi
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="Masukkan sandi Anda"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !isOnline}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>
                      {isLoggingIn
                        ? 'Memeriksa Akun...'
                        : `Masuk sebagai ${selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}`}
                    </span>
                  </button>

                  <p className="text-xs text-center text-slate-600 dark:text-slate-400 pt-1">
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('register')}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Daftar Akun Terlebih Dahulu
                    </button>
                  </p>

                  {selectedRole === 'pengurus' && oauthAvailable && (
                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
                      <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                        Atau masuk langsung menggunakan Google OAuth Admin Utama
                      </p>
                      <button
                        type="button"
                        onClick={() => void onGoogleAdminLogin()}
                        disabled={isLoggingIn || !isOnline}
                        className="w-full min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                          />
                        </svg>
                        <span>Masuk Admin Google</span>
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={(e) => void handleSubmitRegister(e)} className="space-y-3">
                  <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Pendaftaran akun{' '}
                    <strong>{selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}</strong>{' '}
                    diverifikasi dengan <strong>Database Warga RT 12 / RW 20</strong>. Jika Nama Lengkap atau Blok Rumah tidak sesuai database warga, pendaftaran akan ditolak.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Lengkap (Sesuai Database Warga)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={75}
                      placeholder="Contoh: Firman Mahameru"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Blok Rumah
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={25}
                      placeholder="Contoh: FF3/5"
                      value={houseBlock}
                      onChange={(e) => setHouseBlock(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      placeholder="Contoh: Budi_01)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sandi (Min. 6 karakter)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full min-h-[42px] pl-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ulangi Sandi
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Ketik ulang sandi"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !isOnline}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>
                      {isLoggingIn
                        ? 'Memverifikasi Database Warga...'
                        : `Daftarkan Akun ${selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}`}
                    </span>
                  </button>

                  <p className="text-xs text-center text-slate-600 dark:text-slate-400 pt-1">
                    Sudah mendaftarkan akun?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Masuk di Sini
                    </button>
                  </p>
                </form>
              )}

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Database 100% Google Spreadsheet · Enkripsi AES-256-GCM · Sinkronisasi Offline
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Enkripsi Data Pribadi
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Profil kesehatan &amp; kontak darurat dienkripsi di perangkat.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Ramah Lansia &amp; Offline
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Mode teks besar &amp; pencatatan tetap siap tanpa sinyal penuh.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Offline Emergency Quick-Dial Card */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Akses Cepat Panggilan Darurat Offline
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Tersedia langsung tanpa perlu sinyal internet penuh
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <a
                href={`tel:${offlineSnapshot?.rtSettings?.emergencyPhoneRT || '112'}`}
                className="min-h-[46px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>Darurat {offlineSnapshot?.rtSettings?.emergencyPhoneRT || '112'}</span>
              </a>
              <a
                href={`tel:${offlineSnapshot?.rtSettings?.emergencyPhoneMedical || '118'}`}
                className="min-h-[46px] px-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 text-red-800 dark:text-red-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>Medis {offlineSnapshot?.rtSettings?.emergencyPhoneMedical || '118'}</span>
              </a>
            </div>

            {offlineSnapshot && offlineSnapshot.medicalSummary && (
              <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Kartu Medis Tersimpan ({offlineSnapshot.residentName} · {offlineSnapshot.houseBlock}):
                </span>{' '}
                {offlineSnapshot.medicalSummary}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Role-Specific Login Popup After Registration */}
      {loginPopupData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            loginPopupData.role === 'pengurus' ? 'Form Login Pengurus' : 'Form Login Warga'
          }
          onClick={() => {
            setLoginPopupData(null);
            setLocalError(null);
            onClearError();
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    loginPopupData.role === 'pengurus'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400'
                  }`}
                >
                  {loginPopupData.role === 'pengurus' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    {loginPopupData.role === 'pengurus'
                      ? 'Form Login Pengurus'
                      : 'Form Login Warga'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loginPopupData.role === 'pengurus' && loginPopupData.pengurusPosition
                      ? `Jabatan: ${PENGURUS_POSITION_LABELS[loginPopupData.pengurusPosition]}`
                      : loginPopupData.role === 'pengurus'
                      ? 'Akses Pengurus RT'
                      : 'Akses Warga RT 12 / RW 20'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoginPopupData(null);
                  setLocalError(null);
                  onClearError();
                }}
                aria-label="Tutup form login"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitPopupLogin(e)} className="p-6 space-y-4">
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <p className="font-bold">Pendaftaran Akun Berhasil!</p>
                  <p className="mt-0.5">
                    Akun <strong>{loginPopupData.fullName}</strong> terdaftar sebagai{' '}
                    <strong>
                      {loginPopupData.role === 'pengurus' ? 'Pengurus' : 'Warga'}
                    </strong>
                    . Silakan masuk dengan username dan sandi Anda.
                  </p>
                </div>
              </div>

              {(localError || loginError) && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-medium text-red-800 dark:text-red-200 leading-relaxed"
                >
                  {localError || loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username ({loginPopupData.role === 'pengurus' ? 'Pengurus' : 'Warga'})
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Masukkan Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sandi
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Masukkan sandi Anda"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !isOnline}
                className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  {isLoggingIn
                    ? 'Memeriksa Akun...'
                    : `Masuk sebagai ${
                        loginPopupData.role === 'pengurus' ? 'Pengurus' : 'Warga'
                      }`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
