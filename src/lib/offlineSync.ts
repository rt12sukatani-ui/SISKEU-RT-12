import type { BannerSlide, EmergencyAlert, KasTransaction, RtSettings } from '../types';

const OFFLINE_QUEUE_KEY = 'kaswarga_offline_queue_v1';
const OFFLINE_SNAPSHOT_KEY = 'kaswarga_offline_snapshot_v1';
const BANNER_SLIDES_CACHE_KEY = 'kaswarga_banner_slides_v1';

export interface OfflineActionItem {
  localId: string;
  kind: 'dues_submission' | 'emergency_alert';
  createdAtIso: string;
  payload: Record<string, unknown>;
}

export interface OfflineEmergencySnapshot {
  updatedAtIso: string;
  residentName: string;
  houseBlock: string;
  medicalSummary: string;
  emergencyContact: string;
  rtSettings: Partial<RtSettings>;
  recentTransactions: KasTransaction[];
  activeEmergencies: EmergencyAlert[];
}

export function getOfflineQueue(): OfflineActionItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(item: Omit<OfflineActionItem, 'localId' | 'createdAtIso'>): OfflineActionItem {
  const entry: OfflineActionItem = {
    ...item,
    localId: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAtIso: new Date().toISOString(),
  };
  const current = getOfflineQueue();
  current.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current));
  return entry;
}

export function removeOfflineAction(localId: string): void {
  const current = getOfflineQueue().filter((item) => item.localId !== localId);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current));
}

export function saveOfflineSnapshot(snapshot: OfflineEmergencySnapshot): void {
  try {
    localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors on low-storage devices
  }
}

export function getOfflineSnapshot(): OfflineEmergencySnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineEmergencySnapshot;
  } catch {
    return null;
  }
}

export function saveCachedBannerSlides(slides: BannerSlide[]): void {
  try {
    localStorage.setItem(BANNER_SLIDES_CACHE_KEY, JSON.stringify(slides));
  } catch {
    // Ignore quota errors if localStorage is full
  }
}

export function getCachedBannerSlides(): BannerSlide[] {
  try {
    const raw = localStorage.getItem(BANNER_SLIDES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BannerSlide[]) : [];
  } catch {
    return [];
  }
}
