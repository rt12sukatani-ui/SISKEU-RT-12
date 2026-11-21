import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Flame,
  HeartPulse,
  Lock,
  MapPin,
  Pencil,
  PhoneCall,
  ShieldAlert,
  Siren,
  Trash2,
  Waves,
} from 'lucide-react';
import type {
  EmergencyAlert,
  EmergencyType,
  PrivateHealthData,
  PrivateProfileData,
  ResidentPublic,
  RtSettings,
} from '../types';
import { formatTimestamp } from '../utils/format';

interface EmergencyAndHealthViewProps {
  profile: ResidentPublic;
  canManageEmergencies: boolean;
  isOnline: boolean;
  rtSettings: RtSettings;
  emergencies: EmergencyAlert[];
  privateProfile: PrivateProfileData;
  healthProfile: PrivateHealthData;
  onTriggerSOS: (payload: {
    emergencyType: EmergencyType;
    description: string;
    locationText: string;
  }) => Promise<void>;
  onUpdateEmergencyStatus: (
    alert: EmergencyAlert,
    status: 'responding' | 'resolved'
  ) => Promise<void>;
  onUpdateEmergencyDetails: (
    alert: EmergencyAlert,
    data: {
      emergencyType: EmergencyType;
      description: string;
      locationText: string;
    }
  ) => Promise<void>;
  onDeleteEmergency: (alert: EmergencyAlert) => Promise<void>;
  onSaveEncryptedHealthAndProfile: (
    nextProfile: PrivateProfileData,
    nextHealth: PrivateHealthData
  ) => Promise<void>;
}

const EMERGENCY_TYPES: {
  id: EmergencyType;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'medis', label: 'Medis / Ambulans', icon: HeartPulse },
  { id: 'keamanan', label: 'Keamanan / Darurat', icon: ShieldAlert },
  { id: 'kebakaran', label: 'Kebakaran', icon: Flame },
  { id: 'bencana', label: 'Bencana / Banjir', icon: Waves },
];

export const EmergencyAndHealthView: React.FC<EmergencyAndHealthViewProps> = ({
  profile,
  canManageEmergencies,
  isOnline,
  rtSettings,
  emergencies,
  privateProfile,
  healthProfile,
  onTriggerSOS,
  onUpdateEmergencyStatus,
  onUpdateEmergencyDetails,
  onDeleteEmergency,
  onSaveEncryptedHealthAndProfile,
}) => {
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('medis');
  const [sosNote, setSosNote] = useState('');
  const [locationText, setLocationText] = useState(`${profile.houseBlock}`);
  const [sendingSos, setSendingSos] = useState(false);
  const [sosFeedback, setSosFeedback] = useState<string | null>(null);

  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editAlertType, setEditAlertType] = useState<EmergencyType>('medis');
  const [editAlertLocation, setEditAlertLocation] = useState('');
  const [editAlertDescription, setEditAlertDescription] = useState('');
  const [savingAlertEdit, setSavingAlertEdit] = useState(false);

  // Encrypted profile & health form state
  const [phone, setPhone] = useState(privateProfile.phone);
  const [nikMasked, setNikMasked] = useState(privateProfile.nikMasked);
  const [ecName, setEcName] = useState(privateProfile.emergencyContactName);
  const [ecPhone, setEcPhone] = useState(privateProfile.emergencyContactPhone);

  const [bloodType, setBloodType] = useState(healthProfile.bloodType);
  const [allergies, setAllergies] = useState(healthProfile.allergies);
  const [chronicConditions, setChronicConditions] = useState(healthProfile.chronicConditions);
  const [medications, setMedications] = useState(healthProfile.medications);
  const [insuranceProvider, setInsuranceProvider] = useState(healthProfile.insuranceProvider);
  const [shareInEmergency, setShareInEmergency] = useState(healthProfile.shareInEmergency);

  const [savingHealth, setSavingHealth] = useState(false);
  const [healthSavedMsg, setHealthSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setPhone(privateProfile.phone);
    setNikMasked(privateProfile.nikMasked);
    setEcName(privateProfile.emergencyContactName);
    setEcPhone(privateProfile.emergencyContactPhone);
  }, [privateProfile]);

  useEffect(() => {
    setBloodType(healthProfile.bloodType);
    setAllergies(healthProfile.allergies);
    setChronicConditions(healthProfile.chronicConditions);
    setMedications(healthProfile.medications);
    setInsuranceProvider(healthProfile.insuranceProvider);
    setShareInEmergency(healthProfile.shareInEmergency);
  }, [healthProfile]);

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationText(
          `${profile.houseBlock} (GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`
        );
      },
      () => {
        setLocationText(`${profile.houseBlock}`);
      },
      { timeout: 6000 }
    );
  };

  const handleOneTapSOS = async () => {
    setSendingSos(true);
    setSosFeedback(null);
    try {
      await onTriggerSOS({
        emergencyType,
        description:
          sosNote.trim() ||
          `Permintaan bantuan darurat ${emergencyType} dari ${profile.displayName} (${profile.houseBlock})`,
        locationText: locationText.trim() || profile.houseBlock,
      });
      setSosNote('');
      setSosFeedback(
        isOnline
          ? 'Sinyal darurat SOS beserta ringkasan medis berhasil dikirim ke pengurus RT dan tim siaga!'
          : 'Perangkat offline: Sinyal darurat disimpan dalam antrean sinkronisasi otomatis. Gunakan tombol telepon langsung di bawah untuk panggilan instan.'
      );
    } finally {
      setSendingSos(false);
    }
  };

  const handleSaveHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHealth(true);
    setHealthSavedMsg(null);
    try {
      await onSaveEncryptedHealthAndProfile(
        {
          phone: phone.trim(),
          nikMasked: nikMasked.trim(),
          emergencyContactName: ecName.trim(),
          emergencyContactPhone: ecPhone.trim(),
        },
        {
          bloodType,
          allergies: allergies.trim(),
          chronicConditions: chronicConditions.trim(),
          medications: medications.trim(),
          insuranceProvider: insuranceProvider.trim(),
          shareInEmergency,
        }
      );
      setHealthSavedMsg(
        'Profil kesehatan & kontak pribadi berhasil dienkripsi (AES-256-GCM) dan disimpan.'
      );
    } finally {
      setSavingHealth(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Siaga Darurat & Profil Kesehatan
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Pelaporan cepat kondisi gawat darurat · Data medis terenkripsi AES-256-GCM dan tersedia saat offline
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: One-Tap SOS + Direct Calls + Emergency History */}
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl bg-red-50/90 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 sm:p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Siren className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-red-950 dark:text-red-100">
                  Tombol Darurat SOS
                </h2>
                <p className="text-xs text-red-800 dark:text-red-300 mt-0.5 leading-relaxed">
                  Satu ketukan untuk mengirim sinyal ke Pengurus RT & menyertakan ringkasan medis darurat Anda.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-red-950 dark:text-red-200 mb-2">
                Pilih Jenis Keadaan Darurat
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {EMERGENCY_TYPES.map((item) => {
                  const Icon = item.icon;
                  const active = emergencyType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEmergencyType(item.id)}
                      className={`min-h-[48px] px-3 rounded-xl text-xs font-bold border inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-red-200 dark:border-red-800 hover:bg-red-100/60 dark:hover:bg-red-950/60'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-red-950 dark:text-red-200 mb-1">
                  Lokasi Kejadian
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={150}
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    className="min-w-0 flex-1 min-h-[44px] px-3 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    title="Ambil titik GPS saat ini"
                    className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>GPS</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-red-950 dark:text-red-200 mb-1">
                  Keterangan Singkat (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={250}
                  placeholder="Contoh: Sesak napas mendadak, butuh ambulans segera"
                  value={sosNote}
                  onChange={(e) => setSosNote(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleOneTapSOS()}
              disabled={sendingSos}
              className="w-full min-h-[58px] rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] disabled:opacity-60 text-white font-extrabold text-base shadow-md inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <span>{sendingSos ? 'Mengirim Sinyal SOS...' : 'Kirim Sinyal Darurat Sekarang'}</span>
            </button>

            {sosFeedback && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 p-3.5 text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                {sosFeedback}
              </div>
            )}

            <div className="pt-3 border-t border-red-200 dark:border-red-800 grid grid-cols-2 gap-2.5">
              <a
                href={`tel:${rtSettings.emergencyPhoneMedical || '118'}`}
                className="min-h-[46px] px-2.5 sm:px-3 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors text-center"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span className="truncate">Medis ({rtSettings.emergencyPhoneMedical || '118'})</span>
              </a>
              <a
                href={`tel:${rtSettings.emergencyPhoneRT || '112'}`}
                className="min-h-[46px] px-2.5 sm:px-3 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors text-center"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span className="truncate">Pos RT ({rtSettings.emergencyPhoneRT || '112'})</span>
              </a>
            </div>
          </div>

          {/* Active Emergency Reports */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Riwayat & Status Laporan Darurat
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
              {emergencies.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada laporan darurat aktif saat ini. Lingkungan terpantau aman.
                </p>
              ) : (
                emergencies.map((alert) => {
                  const canEditOrDelete =
                    !alert.isOfflinePending &&
                    isOnline &&
                    (canManageEmergencies || alert.reporterUid === profile.uid);
                  const isEditingThisAlert = editingAlertId === alert.id;

                  return (
                    <div key={alert.id} className="p-4 sm:p-5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-bold capitalize ${
                            alert.status === 'resolved'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {alert.emergencyType} ·{' '}
                          {alert.status === 'active'
                            ? 'Darurat Aktif'
                            : alert.status === 'responding'
                            ? 'Sedang Ditangani'
                            : 'Selesai'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatTimestamp(alert.createdAt)}
                          </span>
                          {canEditOrDelete && alert.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingThisAlert) {
                                  setEditingAlertId(null);
                                } else {
                                  setEditingAlertId(alert.id);
                                  setEditAlertType(alert.emergencyType);
                                  setEditAlertLocation(alert.locationText || alert.houseBlock);
                                  setEditAlertDescription(alert.description || '');
                                }
                              }}
                              aria-label="Edit detail laporan darurat"
                              title="Edit detail laporan"
                              className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canEditOrDelete && (
                            <button
                              type="button"
                              onClick={() => void onDeleteEmergency(alert)}
                              aria-label="Hapus laporan darurat"
                              title="Hapus laporan darurat"
                              className="min-h-[44px] min-w-[44px] rounded-xl border border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {alert.reporterName} ({alert.houseBlock})
                      </p>

                      {isEditingThisAlert ? (
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Jenis Darurat
                              </label>
                              <select
                                value={editAlertType}
                                onChange={(e) =>
                                  setEditAlertType(e.target.value as EmergencyType)
                                }
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                              >
                                {EMERGENCY_TYPES.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold mb-1">
                                Lokasi Kejadian
                              </label>
                              <input
                                type="text"
                                maxLength={150}
                                value={editAlertLocation}
                                onChange={(e) => setEditAlertLocation(e.target.value)}
                                className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold mb-1">
                              Keterangan Darurat
                            </label>
                            <input
                              type="text"
                              maxLength={350}
                              value={editAlertDescription}
                              onChange={(e) => setEditAlertDescription(e.target.value)}
                              className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingAlertId(null)}
                              className="min-h-[40px] px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={savingAlertEdit}
                              onClick={async () => {
                                setSavingAlertEdit(true);
                                try {
                                  await onUpdateEmergencyDetails(alert, {
                                    emergencyType: editAlertType,
                                    locationText: editAlertLocation.trim() || alert.houseBlock,
                                    description:
                                      editAlertDescription.trim() || alert.description || '',
                                  });
                                  setEditingAlertId(null);
                                } finally {
                                  setSavingAlertEdit(false);
                                }
                              }}
                              className="min-h-[40px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                            >
                              {savingAlertEdit ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {alert.description} · Lokasi: {alert.locationText || alert.houseBlock}
                        </p>
                      )}

                      {alert.medicalSummary && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                          <span className="font-bold">Info Medis Siaga:</span> {alert.medicalSummary}
                          {alert.emergencyContact ? ` · Kontak Keluarga: ${alert.emergencyContact}` : ''}
                        </div>
                      )}

                      {alert.isOfflinePending && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Menunggu sinyal internet untuk kirim otomatis ke RT
                        </p>
                      )}

                      {alert.status !== 'resolved' && !alert.isOfflinePending && (
                        <div className="pt-2 flex flex-wrap gap-2">
                          {canManageEmergencies && alert.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => void onUpdateEmergencyStatus(alert, 'responding')}
                              className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              Tandai Sedang Ditangani
                            </button>
                          )}
                          {(canManageEmergencies || alert.reporterUid === profile.uid) && (
                            <button
                              type="button"
                              onClick={() => void onUpdateEmergencyStatus(alert, 'resolved')}
                              className="min-h-[40px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tandai Selesai</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Live Medical Card Summary + Encrypted Health Profile Form */}
        <section className="lg:col-span-7 space-y-5">
          {/* Live Emergency Medical Card Preview */}
          <div className="rounded-3xl bg-slate-900 dark:bg-slate-900 text-white p-4 sm:p-6 border border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-300">
                  Pratinjau Kartu Medis Siaga · Tersimpan Offline
                </p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight">
                  {profile.displayName} · {profile.houseBlock}
                </h2>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold font-mono-num">
                Gol. {bloodType}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-400">Alergi</p>
                <p className="mt-0.5 font-semibold text-white">
                  {allergies.trim() || 'Belum diisi'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Riwayat Medis</p>
                <p className="mt-0.5 font-semibold text-white">
                  {chronicConditions.trim() || 'Tidak ada catatan'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Kontak Darurat</p>
                <p className="mt-0.5 font-semibold text-white">
                  {ecName.trim() ? `${ecName} (${ecPhone || '-'})` : 'Belum diisi'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Edit Profil Kesehatan & Kontak Darurat
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>Dienkripsi AES-256-GCM sebelum disimpan ke cloud & dicadangkan offline</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => void handleSaveHealth(e)} className="mt-5 space-y-5">
              {healthSavedMsg && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  {healthSavedMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nomor HP / WhatsApp Pribadi</label>
                  <input
                    type="tel"
                    maxLength={30}
                    placeholder="0812xxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">4 Digit Terakhir NIK (Opsional)</label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="Contoh: ****-****-****-1234"
                    value={nikMasked}
                    onChange={(e) => setNikMasked(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nama Kontak Keluarga Darurat</label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Nama pasangan / anak / kerabat"
                    value={ecName}
                    onChange={(e) => setEcName(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">No. Telepon Keluarga Darurat</label>
                  <input
                    type="tel"
                    maxLength={30}
                    placeholder="08xxxxxxxxxx"
                    value={ecPhone}
                    onChange={(e) => setEcPhone(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Golongan Darah</label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="Belum diketahui">Belum diketahui</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Faskes / Asuransi (BPJS)</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Contoh: BPJS Kesehatan · Puskesmas Kec."
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Alergi Obat / Makanan</label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Contoh: Alergi penisilin, atau Tidak ada"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Riwayat Penyakit Kronis</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Contoh: Hipertensi, Diabetes, Asma"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Obat yang Rutin Dikonsumsi</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Contoh: Amlodipine 5mg pagi"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareInEmergency}
                  onChange={(e) => setShareInEmergency(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-emerald-700 shrink-0"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  Sertakan ringkasan medis darurat (golongan darah, alergi, kondisi medis, dan kontak keluarga) secara otomatis saat saya menekan tombol <strong>SOS Darurat</strong> agar petugas medis dapat bertindak cepat.
                </span>
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingHealth}
                  className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  {savingHealth ? 'Mengenkripsi & Menyimpan...' : 'Simpan Profil Terenkripsi'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
