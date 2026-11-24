import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  LogOut,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type { AppTab, UserNotification } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { formatTimestamp } from '../utils/format';

interface HeaderNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  notifications: UserNotification[];
  onMarkNotificationRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteNotification?: (id: string) => Promise<void>;
  onOpenSettings: () => void;
  activeEmergencyCount: number;
  onLogout: () => void | Promise<void>;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'kas', label: 'Kas & Iuran' },
  { id: 'laporan', label: 'Laporan' },
  { id: 'pengumuman', label: 'Pengumuman' },
];

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onNavigate,
  notifications,
  onMarkNotificationRead,
  onMarkAllRead,
  onDeleteNotification,
  onOpenSettings,
  activeEmergencyCount,
  onLogout,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  useBodyScrollLock(notifOpen);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 print:hidden">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-12 sm:h-14 lg:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('beranda')}
            className="font-display text-[13px] sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 min-w-0 truncate text-left cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            SISKEU RT 12/RW 20 SUKATANI
          </button>

          {/* Zone 2: Clean Typography Nav Links (Desktop) */}
          <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`min-h-[44px] px-1 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-emerald-700 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Action Cluster (Logout + Notifications + Account/Mode) */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Pengaturan"
              className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] rounded-xl bg-transparent border-0 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label={`Buka notifikasi (${unreadCount} belum dibaca)`}
              className="relative min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 rounded-full bg-emerald-700 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              aria-label="Keluar dari akun"
              title="Keluar"
              className="relative min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl border-0 outline-none focus:outline-none text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline"></span>
            </button>
          </div>
        </div>
      </header>

      {notifOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Daftar Notifikasi"
          onClick={() => setNotifOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end bg-black/50 backdrop-blur-xs sm:p-4 overscroll-contain touch-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[82dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden touch-auto"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Notifikasi Warga
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount} belum dibaca · Pembaruan real-time
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void onMarkAllRead()}
                    className="min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Tandai Dibaca</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Tutup notifikasi"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain touch-pan-y pb-safe divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada notifikasi baru saat ini.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2 ${
                      !notif.isRead ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void onMarkNotificationRead(notif.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {notif.type === 'payment_approved'
                            ? 'Pembayaran Disetujui'
                            : notif.type === 'payment_rejected'
                            ? 'Pembayaran Ditolak'
                            : notif.type === 'payment_reminder'
                            ? 'Pengingat Iuran'
                            : notif.type === 'emergency'
                            ? 'Sinyal Darurat'
                            : 'Pengumuman RT'}
                          {!notif.isRead ? ' · Baru' : ''}
                        </span>
                        <span className="tabular-nums">{formatTimestamp(notif.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {notif.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>
                    </button>
                    {onDeleteNotification && (
                      <button
                        type="button"
                        onClick={() => void onDeleteNotification(notif.id)}
                        aria-label={`Hapus notifikasi ${notif.title}`}
                        title="Hapus notifikasi"
                        className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
