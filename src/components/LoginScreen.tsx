import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Accessibility,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Lock,
  LogIn,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { APPS_SCRIPT_BRIDGE_CODE } from '../lib/appsScriptTemplate';
import { hasConfiguredGoogleOAuthClientId } from '../lib/googleAuth';
import { BUILTIN_SHEETS_WEBAPP_URL, getDefaultWebAppUrl } from '../lib/sheetsDb';
import type {
  BannerSlide,
  LoginRole,
  PengurusPosition,
  SheetDbInfo,
  VerifiedDatabaseCheckResult,
} from '../types';
import { PENGURUS_POSITION_LABELS } from '../utils/rbac';
import { PWAInstallButton } from './PWAInstallButton';

interface RegisteredAccountNotice {
  role: LoginRole;
  username: string;
  fullName: string;
  pengurusPosition?: PengurusPosition;
  autoConnected?: boolean;
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
  onCheckDatabaseVerification: (data: {
    fullName: string;
    houseBlock: string;
    role: LoginRole;
  }) => Promise<VerifiedDatabaseCheckResult>;
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
  onConnectSpreadsheetById,
  onSyncSpreadsheet,
  onCheckDatabaseVerification,
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
  const [dbCheckResult, setDbCheckResult] = useState<VerifiedDatabaseCheckResult | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [loginPopupData, setLoginPopupData] = useState<RegisteredAccountNotice | null>(null);
  const [sheetInput, setSheetInput] = useState('');
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false);
  const [showSetupGuide] = useState(false);
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
      setLocalError('Nama Lengkap dan Blok Rumah wajib diisi.');
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

  const handleSwitchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setLocalError(null);
    setDbCheckResult(null);
    onClearError();
  };

  const handleSelectRole = (role: LoginRole) => {
    setSelectedRole(role);
    setLocalError(null);
    setDbCheckResult(null);
    onClearError();
  };

  const handleCheckDatabase = async () => {
    setLocalError(null);
    onClearError();
    if (!fullName.trim() || !houseBlock.trim()) {
      setAuthMode('register');
      setLocalError('Isi Nama Lengkap dan Blok Rumah terlebih dahulu untuk verifikasi database.');
      return;
    }
    setIsCheckingDb(true);
    try {
      const check = await onCheckDatabaseVerification({
        fullName: fullName.trim(),
        houseBlock: houseBlock.trim(),
        role: selectedRole,
      });
      setDbCheckResult(check);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Gagal memeriksa verifikasi database.'
      );
    } finally {
      setIsCheckingDb(false);
    }
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
      setLocalError('Nama Lengkap dan Blok Rumah wajib diisi sesuai database.');
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
      setDbCheckResult(null);
      setLocalError(null);
      if (!result.autoConnected) {
        setLoginPopupData(result);
      }
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

  const showBootstrapFirstAdmin = Boolean(sheetInfo && isDatabaseEmpty && !isConnectingSheet);

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!emblemFailed ? (
              <img
                src="src/assets/images/app_emblem_icon_1795010549252.png"
                alt="Logo RT12/RW20 SUKATANI"
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
                RT12/RW20 SUKATANI
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

        {/* Full-Height Right Panel: Modern Login Portal */}
        <section className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between px-6 sm:px-8 lg:px-10 pt-3 pb-6 gap-6">
          <div className="flex-1 flex flex-col justify-start space-y-5">
            <div>
              <h1 className="mt-0 font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.18] text-slate-900 dark:text-slate-50 [text-wrap:balance]">
                Portal Sistem Keuangan &amp; Siaga Warga RT 12 / RW 20 Sukatani
              </h1>

              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Pantau kas RT secara terbuka, iuran bulanan, cek laporan bulanan, dan akses layanan darurat.
              </p>
            </div>

            {/* Google Spreadsheet Database Connection (100% Spreadsheet, Zero Firebase) */}
            <div className="py-1 space-y-3">
              {sheetInfo && !showSheetSwitcher ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 min-h-[34px] inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>Terhubung</span>
                  </div>
                  <button
                    type="button"
                    disabled={isCheckingDb || !isOnline}
                    onClick={() => void handleCheckDatabase()}
                    className="min-h-[34px] px-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-semibold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <BadgeCheck className={`w-3.5 h-3.5 ${isCheckingDb ? 'animate-spin' : ''}`} />
                    <span>{isCheckingDb ? 'Verifikasi' : 'Verifikasi'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isConnectingSheet}
                    onClick={async () => {
                      setLocalError(null);
                      onClearError();
                      await onSyncSpreadsheet();
                    }}
                    className="min-h-[34px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConnectingSheet ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang</span>
                  </button>
                </div>
              ) : isConnectingSheet && !showSheetSwitcher ? (
                <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>Sedang menghubungkan database</span>
                </div>
              ) : (
                <div className="space-y-2.5 pt-0.5">
                  {!sheetInfo && (
                    <button
                      type="button"
                      disabled={isConnectingSheet || !isOnline}
                      onClick={async () => {
                        setLocalError(null);
                        onClearError();
                        await onConnectWebApp(getDefaultWebAppUrl() || BUILTIN_SHEETS_WEBAPP_URL);
                        setShowSheetSwitcher(false);
                      }}
                      className="w-full min-h-[40px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isConnectingSheet ? 'animate-spin' : ''}`} />
                      <span>Hubungkan Database</span>
                    </button>
                  )}

                  {!sheetInfo && activeErrorText && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                      {activeErrorText}
                    </div>
                  )}

                  {showSetupGuide && (
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-900/80 p-3 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
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
                  )}

                  {oauthAvailable && (
                    <div className="pt-1.5 border-t border-emerald-200/70 dark:border-emerald-900/60 space-y-2">
                      {!googleConnected ? (
                        <button
                          type="button"
                          disabled={isConnectingSheet || !isOnline}
                          onClick={() => void onGoogleConnect()}
                          className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
                        >
                          {isConnectingSheet
                            ? 'Menghubungkan Google...'
                            : `Hubungkan Google${googleUserEmail ? ` (${googleUserEmail})` : ''}`}
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
                </div>
              )}
            </div>

            {/* Form Login Akun / Daftar Akun / Bootstrap Ketua RT */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 sm:p-5 space-y-4">
              {showBootstrapFirstAdmin ? (
                <form onSubmit={handleSubmitBootstrapAdmin} className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <h2 className="text-sm font-extrabold">
                      Inisialisasi Akun Ketua RT Pertama
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Database masih kosong. Buat akun Ketua RT pertama untuk mengaktifkan sistem.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Nama Lengkap Ketua RT</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Blok Rumah</label>
                    <input
                      type="text"
                      value={houseBlock}
                      onChange={(e) => setHouseBlock(e.target.value)}
                      placeholder="FF2/5"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ketua_rt12"
                      autoComplete="username"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Sandi</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        autoComplete="new-password"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Konfirmasi Sandi</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi sandi"
                        autoComplete="new-password"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Tampilkan sandi</span>
                  </label>

                  {activeErrorText && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                      {activeErrorText}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isLoggingIn ? 'Memproses...' : 'Buat Akun Ketua RT'}</span>
                  </button>
                </form>
              ) : (
                <>
                  {/* Mode Switcher: Login Akun / Daftar Akun */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800/90">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        authMode === 'login'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login Akun</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('register')}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        authMode === 'register'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Daftar Akun</span>
                    </button>
                  </div>

                  {/* Role Selector: Warga / Pengurus */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRole('warga')}
                      className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedRole === 'warga'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Warga
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRole('pengurus')}
                      className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedRole === 'pengurus'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Pengurus RT
                    </button>
                  </div>

                  {authMode === 'login' ? (
                    <form onSubmit={handleSubmitLogin} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Username</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Masukkan username"
                            autoComplete="username"
                            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">Sandi</label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan sandi"
                            autoComplete="current-password"
                            className="w-full min-h-[40px] pl-9 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {activeErrorText && (
                        <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                          {activeErrorText}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>{isLoggingIn ? 'Masuk...' : 'Masuk ke Portal'}</span>
                      </button>

                      {selectedRole === 'pengurus' && oauthAvailable && (
                        <button
                          type="button"
                          disabled={isLoggingIn || !isOnline}
                          onClick={() => void onGoogleAdminLogin()}
                          className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
                        >
                          Masuk Pengurus dengan Akun Google
                        </button>
                      )}
                    </form>
                  ) : (
                    <form onSubmit={handleSubmitRegister} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Nama Lengkap sesuai KTP</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Budi Santoso"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">Blok Rumah</label>
                        <input
                          type="text"
                          value={houseBlock}
                          onChange={(e) => setHouseBlock(e.target.value)}
                          placeholder="FF3/5"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>

                      {dbCheckResult && (
                        <div
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            dbCheckResult.verified
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          <p className="font-bold">
                            {dbCheckResult.verified
                              ? 'Data terverifikasi di database'
                              : 'Data belum ditemukan / perlu verifikasi'}
                          </p>
                          {dbCheckResult.message && (
                            <p className="mt-0.5 text-[11px] opacity-90">
                              {dbCheckResult.message}
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold mb-1">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="3–8 karakter"
                          autoComplete="username"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Sandi</label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimal 6 karakter"
                            autoComplete="new-password"
                            className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Konfirmasi Sandi</label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Ulangi sandi"
                            autoComplete="new-password"
                            className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Tampilkan sandi</span>
                      </label>

                      {activeErrorText && (
                        <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                          {activeErrorText}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isLoggingIn ? 'Mendaftarkan...' : 'Daftar Akun'}</span>
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modal Konfirmasi & Login Cepat Setelah Daftar Akun */}
      {loginPopupData && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Akun Berhasil Didaftarkan
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Nama: <strong>{loginPopupData.fullName}</strong> · Username:{' '}
                  <strong>{loginPopupData.username}</strong>
                  {loginPopupData.pengurusPosition && (
                    <>
                      {' '}
                      · Jabatan:{' '}
                      <strong>
                        {PENGURUS_POSITION_LABELS[loginPopupData.pengurusPosition] ||
                          loginPopupData.pengurusPosition}
                      </strong>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoginPopupData(null)}
                aria-label="Tutup modal"
                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPopupLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Masukkan Sandi untuk Masuk</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan sandi akun Anda"
                  autoFocus
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              {activeErrorText && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {activeErrorText}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLoginPopupData(null)}
                  className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Nanti Saja
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="min-h-[38px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isLoggingIn ? 'Masuk...' : 'Masuk Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};