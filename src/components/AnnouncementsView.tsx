import React, { useState } from 'react';
import { Megaphone, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import type { Announcement, AnnouncementCategory } from '../types';
import { formatTimestamp } from '../utils/format';
import { CancelButton } from './CancelButton';
import { DownwardSelect } from './DownwardSelect';

interface AnnouncementsViewProps {
  canManageAnnouncements: boolean;
  announcements: Announcement[];
  onPublishAnnouncement: (data: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    priority: 'normal' | 'urgent';
  }) => Promise<void>;
  onUpdateAnnouncement: (
    ann: Announcement,
    data: {
      title: string;
      body: string;
      category: AnnouncementCategory;
      priority: 'normal' | 'urgent';
    }
  ) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
}

const CATEGORY_OPTIONS: { id: AnnouncementCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'penting', label: 'Penting' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'kegiatan', label: 'Kegiatan' },
  { id: 'keamanan', label: 'Keamanan' },
  { id: 'kesehatan', label: 'Kesehatan' },
];

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  canManageAnnouncements,
  announcements,
  onPublishAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
}) => {
  const [filterCat, setFilterCat] = useState<AnnouncementCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('penting');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [publishing, setPublishing] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleList = announcements.filter((a) => {
    if (filterCat !== 'all' && a.category !== filterCat) return false;
    if (normalizedSearch) {
      return `${a.title} ${a.body} ${a.authorName}`.toLowerCase().includes(normalizedSearch);
    }
    return true;
  });

  const openCreateComposer = () => {
    setEditingAnnouncement(null);
    setTitle('');
    setBody('');
    setCategory('penting');
    setPriority('normal');
    setShowComposer((v) => !v || Boolean(editingAnnouncement));
  };

  const openEditComposer = (item: Announcement) => {
    setEditingAnnouncement(item);
    setTitle(item.title);
    setBody(item.body);
    setCategory(item.category);
    setPriority(item.priority);
    setShowComposer(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPublishing(true);
    try {
      if (editingAnnouncement) {
        await onUpdateAnnouncement(editingAnnouncement, {
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
        });
      } else {
        await onPublishAnnouncement({
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
        });
      }
      setEditingAnnouncement(null);
      setTitle('');
      setBody('');
      setShowComposer(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-base sm:text-2xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-slate-100">
            Pengumuman & Kabar Lingkungan RT
          </h1>
          <p className="text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Pembaruan informasi warga secara real-time dengan notifikasi langsung
          </p>
        </div>

        {canManageAnnouncements && (
          <button
            type="button"
            onClick={openCreateComposer}
            className="w-full sm:w-auto min-h-[40px] sm:min-h-[48px] px-4 sm:px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Buat Pengumuman</span>
          </button>
        )}
      </div>

      {canManageAnnouncements && showComposer && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {editingAnnouncement
                ? 'Edit Pengumuman Lingkungan'
                : 'Terbitkan Pengumuman Real-Time'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowComposer(false);
                setEditingAnnouncement(null);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Kategori</label>
              <DownwardSelect
                value={category}
                onChange={(val) => setCategory(val as AnnouncementCategory)}
                ariaLabel="Kategori pengumuman"
                options={[
                  { value: 'penting', label: 'Info Penting' },
                  { value: 'keuangan', label: 'Keuangan & Iuran' },
                  { value: 'kegiatan', label: 'Kegiatan Warga' },
                  { value: 'keamanan', label: 'Keamanan Lingkungan' },
                  { value: 'kesehatan', label: 'Kesehatan & Posyandu' },
                ]}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Tingkat Prioritas</label>
              <DownwardSelect
                value={priority}
                onChange={(val) => setPriority(val as 'normal' | 'urgent')}
                ariaLabel="Tingkat prioritas pengumuman"
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'urgent', label: 'Mendesak (Kirim Notifikasi Prioritas)' },
                ]}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Judul Pengumuman</label>
            <input
              type="text"
              required
              maxLength={110}
              placeholder="Jadwal Posyandu Lansia & Kerja Bakti Minggu Ini"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Isi Pengumuman</label>
            <textarea
              required
              rows={4}
              maxLength={950}
              placeholder="Tulis informasi lengkap dengan waktu, lokasi, dan catatan penting untuk warga..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3">
            {editingAnnouncement && (
              <CancelButton
                onClick={() => {
                  setShowComposer(false);
                  setEditingAnnouncement(null);
                }}
                className="min-h-[48px] px-4 rounded-xl text-sm"
              >
                Batal
              </CancelButton>
            )}
            <button
              type="submit"
              disabled={publishing}
              className="min-h-[48px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {publishing
                  ? 'Menyimpan...'
                  : editingAnnouncement
                  ? 'Simpan Perubahan'
                  : 'Terbitkan Sekarang'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs & search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full lg:w-fit overflow-x-auto no-scrollbar">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCat(cat.id)}
              className={`shrink-0 min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-3.5 rounded-lg text-[11px] sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterCat === cat.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pengumuman..."
            aria-label="Cari pengumuman"
            className="w-full min-h-[38px] sm:min-h-[44px] pl-9 sm:pl-10 pr-3 sm:pr-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-2.5 sm:space-y-4">
        {visibleList.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {searchQuery
              ? `Tidak ada pengumuman yang cocok dengan "${searchQuery}".`
              : 'Belum ada pengumuman pada kategori ini.'}
          </div>
        ) : (
          visibleList.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border p-3 sm:p-6 transition-colors ${
                item.priority === 'urgent'
                  ? 'border-red-200 dark:border-red-900/80'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
                  <Megaphone
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                      item.priority === 'urgent'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  />
                  <span
                    className={
                      item.priority === 'urgent'
                        ? 'font-bold text-red-600 dark:text-red-400'
                        : 'font-semibold text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {item.priority === 'urgent' ? 'Prioritas Mendesak' : 'Kabar Warga'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatTimestamp(item.createdAt)}</span>
                </div>

                {canManageAnnouncements && (
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditComposer(item)}
                      aria-label="Edit pengumuman"
                      title="Edit pengumuman"
                      className="min-h-[32px] min-w-[32px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteAnnouncement(item.id)}
                      aria-label="Hapus pengumuman"
                      title="Hapus pengumuman"
                      className="min-h-[32px] min-w-[32px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                )}
              </div>

              <h2 className="mt-1 sm:mt-2.5 text-sm sm:text-lg font-extrabold leading-snug text-slate-900 dark:text-slate-100 [text-wrap:balance]">
                {item.title}
              </h2>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-snug sm:leading-relaxed whitespace-pre-line max-w-3xl">
                {item.body}
              </p>
              <p className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800 text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
                Diterbitkan oleh <span className="font-semibold text-slate-700 dark:text-slate-300">{item.authorName}</span>
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
