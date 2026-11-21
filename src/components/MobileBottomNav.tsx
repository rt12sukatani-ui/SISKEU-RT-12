import React from 'react';
import {
  FileBarChart2,
  Home,
  Megaphone,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { AppTab } from '../types';

interface MobileBottomNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  activeEmergencyCount: number;
}

const TABS: {
  id: AppTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'kas', label: 'Kas & Iuran', icon: Wallet },
  { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
  { id: 'pengumuman', label: 'Kabar RT', icon: Megaphone },
  { id: 'darurat', label: 'Darurat', icon: ShieldAlert },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  activeEmergencyCount,
}) => {
  return (
    <nav
      aria-label="Navigasi bawah ponsel"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe print:hidden"
    >
      <div className="grid grid-cols-5 items-center h-16">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isEmergency = tab.id === 'darurat';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative min-h-[44px] h-full flex flex-col items-center justify-center px-1 transition-colors cursor-pointer ${
                isActive
                  ? isEmergency
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${
                    isEmergency ? 'bg-red-600 dark:bg-red-400' : 'bg-emerald-700 dark:bg-emerald-400'
                  }`}
                />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-1 whitespace-nowrap truncate max-w-full">
                {tab.label}
              </span>
              {isEmergency && activeEmergencyCount > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {activeEmergencyCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
