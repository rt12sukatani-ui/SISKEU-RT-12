import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Accessibility,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Lock,
  LogIn,
  Moon,
  Plug,
  ShieldCheck,
  Sun,
  Unplug,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { APPS_SCRIPT_BRIDGE_CODE } from '../lib/appsScriptTemplate';
import porseniBannerImg from '../assets/images/porseni 2026.jpeg';
import appEmblemImg from '../assets/images/app_emblem_icon_1795010549252.png';
import { hasConfiguredGoogleOAuthClientId } from '../lib/googleAuth';
import { BUILTIN_SHEETS_WEBAPP_URL, getDefaultWebAppUrl } from '../lib/sheetsDb';
import type {
  BannerSlide,
  LoginRole,
  PengurusPosition,
  SheetDbInfo,
} from '../types';
import { PENGURUS_POSITION_LABELS } from '../utils/rbac';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
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
  onLoginWithCredentials: (data: {
    username: string;
    password: string;
  }) => Promise<void>;
  onRegisterAccount: (data: {
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
  imageData: porseniBannerImg,
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
  const touchStartXRef = React.useRef<number | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [houseBlock, setHouseBlock] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loginPopupData, setLoginPopupData] = useState<RegisteredAccountNotice | null>(null);
  const [sheetInput, setSheetInput] = useState('');
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
  useBodyScrollLock(Boolean(loginPopupData));

  const handleSwitchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
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
      fullName: fullName.trim(),
      houseBlock: houseBlock.trim(),
      username: username.trim(),
      password,
    });
    if (result) {
      setAuthMode('login');
      setUsername(result.username);
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setHouseBlock('');
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

  const handleSlideTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleSlideTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || slides.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = touchStartXRef.current - endX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextSlide();
      else handlePrevSlide();
    }
    touchStartXRef.current = null;
  };

  const showBootstrapFirstAdmin = Boolean(sheetInfo && isDatabaseEmpty && !isConnectingSheet);

  return (
    <div className="min-h-dvh w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-x-clip">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full px-3 sm:px-6 lg:px-8 h-12 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!emblemFailed ? (
              <img
                src={appEmblemImg}
                alt="Logo RT 12/RW 20 SUKATANI"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                RT
              </div>
            )}
            <div className="min-w-0">
              <span className="font-display text-xs sm:text-base font-extrabold tracking-tight block truncate">
                RT 12/RW 20 SUKATANI
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                Sistem Keuangan &amp; Siaga Warga
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onToggleElderlyMode}
              aria-pressed={elderlyMode}
              aria-label="Mode Teks Besar"
              className={`min-h-[38px] sm:min-h-[44px] px-2 sm:px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 lg:min-h-[calc(100dvh-4rem)]">
        {/* Crisp Responsive Activity Photo Slideshow */}
        <section
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={handleSlideTouchStart}
          onTouchEnd={handleSlideTouchEnd}
          aria-roledescription="carousel"
          aria-label="Slideshow Dokumentasi Kegiatan RT"
          className="group lg:col-span-7 xl:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto lg:min-h-full w-full bg-slate-900 overflow-hidden select-none"
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
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedSlideIds((prev) => ({ ...prev, [currentSlide.id]: true }))
                  }
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 flex items-center justify-center p-6 sm:p-8 text-white text-center">
                  <p className="text-base sm:text-lg font-bold">{currentSlide.title}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Previous / Next Controls (Always accessible on touch, hover-reveal on desktop) */}
          {slides.length > 1 && (
            <div
              className={`absolute inset-y-0 inset-x-2.5 sm:inset-x-4 z-10 flex items-center justify-between pointer-events-none transition-opacity duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-90 lg:opacity-0'
              }`}
            >
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Foto kegiatan sebelumnya"
                className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full bg-slate-950/60 hover:bg-slate-950/85 border border-white/25 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Foto kegiatan berikutnya"
                className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full bg-slate-950/60 hover:bg-slate-950/85 border border-white/25 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Tight Bottom Scrim & Slide Indicators (keeps center/top photo crisp) */}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent px-4 py-3.5 sm:p-7 lg:p-10 pt-10 sm:pt-16">
            <h2 className="font-display text-base sm:text-2xl lg:text-3xl font-bold text-white leading-snug max-w-2xl">
              {currentSlide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/95 mt-0.5 sm:mt-1.5 max-w-2xl line-clamp-2">
              {currentSlide.subtitle}
            </p>

            {slides.length > 1 && (
              <div
                className="mt-2.5 sm:mt-4 flex items-center gap-1.5"
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
                    className="min-h-[28px] flex-1 max-w-[48px] sm:max-w-[56px] flex items-center cursor-pointer group/dot"
                  >
                    <span
                      className={`block w-full h-1.5 rounded-full transition-all ${
                        idx === activeIndex
                          ? 'bg-emerald-400'
                          : 'bg-white/40 group-hover/dot:bg-white/70'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Full-Height Right Panel: Modern Login Portal */}
        <section className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between px-3.5 sm:px-8 lg:px-10 py-4 lg:py-6 gap-4">
          <div className="flex-1 flex flex-col justify-start space-y-3 sm:space-y-5">
            <div>
              <h1 className="mt-0 font-display text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.2] text-slate-900 dark:text-slate-50 [text-wrap:balance]">
                Portal Sistem Keuangan &amp; Siaga Warga RT 12 / RW 20 Sukatani
              </h1>

              <p className="mt-1.5 sm:mt-2.5 text-xs sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Pantau kas RT secara terbuka, iuran bulanan, cek laporan bulanan, dan akses layanan darurat.
              </p>
            </div>

            {/* Google Spreadsheet Database Connection (100% Spreadsheet, Zero Firebase) */}
            <div className="py-1 space-y-2.5">
              <button
                type="button"
                disabled={isConnectingSheet || !isOnline}
                onClick={async () => {
                  setLocalError(null);
                  onClearError();
                  await onConnectWebApp(
                    sheetInfo?.webAppUrl || getDefaultWebAppUrl() || BUILTIN_SHEETS_WEBAPP_URL
                  );
                }}
                aria-label={
                  isConnectingSheet
                    ? 'Menghubungkan database'
                    : sheetInfo
                    ? 'Database terhubung, klik untuk sinkronkan ulang'
                    : 'Hubungkan Database'
                }
                className={`w-full min-h-[40px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer ${
                  isConnectingSheet
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : sheetInfo
                    ? 'bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
              >
                {isConnectingSheet ? (
                  <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
                    {/* Ikon Colokan Horizontal (Steker Kiri menghadap kanan & Soket Kanan) */}
                    <div className="relative w-5 h-4 flex items-center justify-center shrink-0">
                      {/* Bagian Kanan: Soket / Port Tujuan menghadap kiri */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="w-4 h-4 absolute right-0 text-emerald-600/70 dark:text-emerald-400/70 animate-socket-glow"
                        aria-hidden="true"
                      >
                        {/* Garis vertikal port kanan & lubang penerima menghadap kiri */}
                        <path d="M21 7v10" />
                        <path d="M21 9h-3" />
                        <path d="M21 15h-3" />
                      </svg>

                      {/* Bagian Kiri: Steker (Plug) horizontal menghadap kanan yang bergerak mencolok */}
                      <span className="inline-flex -translate-x-1 animate-plug-connect text-emerald-600 dark:text-emerald-400">
                        <Plug className="w-3.5 h-3.5 rotate-90" />
                      </span>
                    </div>

                    <span className="font-bold tracking-wide">Menghubungkan Database...</span>
                  </div>
                ) : sheetInfo ? (
                  <>
                    <Plug className="w-4 h-4 rotate-90 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>Terhubung</span>
                  </>
                ) : (
                  <>
                    <Unplug className="w-4 h-4 rotate-45 shrink-0" />
                    <span>Hubungkan Database</span>
                  </>
                )}
              </button>

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

              {oauthAvailable && !sheetInfo && (
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

            {/* Form Login Akun / Daftar Akun / Bootstrap Ketua RT */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 sm:p-5 space-y-3 sm:space-y-4">
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
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800/90">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className={`min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
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
                      className={`min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        authMode === 'register'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Daftar Akun</span>
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
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
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
                        disabled={isLoggingIn || !isOnline}
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>{isLoggingIn ? 'Memverifikasi...' : 'Masuk'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmitRegister} className="space-y-3">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Masukkan Nama Lengkap dan Blok Rumah sesuai data warga RT. Role Warga atau Pengurus RT akan mengikuti data database secara otomatis.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Sesuai Database Warga RT"
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
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="budi_ff2"
                            autoComplete="username"
                            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                        </div>
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
                        disabled={isLoggingIn || !isOnline}
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isLoggingIn ? 'Memeriksa Database...' : 'Daftar Akun'}</span>
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {loginPopupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overscroll-contain touch-none">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain touch-pan-y rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Akun Berhasil Didaftarkan
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {loginPopupData.fullName} terdaftar sebagai{' '}
                  <strong>
                    {loginPopupData.role === 'pengurus'
                      ? loginPopupData.pengurusPosition
                        ? PENGURUS_POSITION_LABELS[loginPopupData.pengurusPosition]
                        : 'Pengurus RT'
                      : 'Warga'}
                  </strong>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoginPopupData(null)}
                aria-label="Tutup popup masuk"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Sandi</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan sandi Anda"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              {activeErrorText && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {activeErrorText}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoginPopupData(null)}
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 min-h-[40px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Masuk...' : 'Masuk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};