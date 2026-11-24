import React from 'react';
import {
  FileBarChart2,
  Home,
  Megaphone,
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
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  activeEmergencyCount,
}) => {
  return (
    <nav
      data-mobile-bottom-nav="true"
      aria-label="Navigasi bawah ponsel"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe overflow-hidden touch-manipulation print:hidden"
    >
      <div className="grid grid-cols-4 items-center h-14">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative min-h-[44px] h-full flex flex-col items-center justify-center px-1 transition-colors cursor-pointer ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald-700 dark:bg-emerald-400"
                />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-semibold tracking-tight mt-0.5 whitespace-nowrap truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
