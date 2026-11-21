import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressBannerSlideImage } from '../lib/crypto';
import type { BannerSlide } from '../types';

interface StagedSlide {
  localId: string;
  fileName: string;
  imageData: string;
  title: string;
  subtitle: string;
}

interface BannerSlidesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: BannerSlide[];
  isOnline: boolean;
  onUploadSlides: (items: { title: string; subtitle: string; imageData: string }[]) => Promise<void>;
  onUpdateSlide: (id: string, updates: { title?: string; subtitle?: string; sortOrder?: number }) => Promise<void>;
  onReorderSlides: (orderedIds: string[]) => Promise<void>;
  onDeleteSlide: (id: string) => Promise<void>;
}

export const BannerSlidesManagerModal: React.FC<BannerSlidesManagerModalProps> = ({
  isOpen,
  onClose,
  slides,
  isOnline,
  onUploadSlides,
  onUpdateSlide,
  onReorderSlides,
  onDeleteSlide,
}) => {
  const [stagedSlides, setStagedSlides] = useState<StagedSlide[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const sortedSlides = [...slides].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const processSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessingFiles(true);

    try {
      const files = Array.from(fileList).slice(0, 8);
      const nextStaged: StagedSlide[] = [];
      for (const file of files) {
        const compressed = await compressBannerSlideImage(file);
        nextStaged.push({
          localId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          imageData: compressed,
          title: 'Sistem Terpadu Warga',
          subtitle: 'Transparansi Kas · Kegiatan & Kebersamaan Warga RT',
        });
      }
      setStagedSlides((prev) => [...prev, ...nextStaged]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses gambar dari perangkat.');
    } finally {
      setProcessingFiles(false);
    }
  };

  const handleUploadAll = async () => {
    if (stagedSlides.length === 0) return;
    if (!isOnline) {
      setErrorMsg('Mengunggah foto slide membutuhkan koneksi internet.');
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onUploadSlides(
        stagedSlides.map((s) => ({
          title: s.title.trim().slice(0, 80) || 'Sistem Terpadu Warga',
          subtitle: s.subtitle.trim().slice(0, 160) || 'Dokumentasi Kegiatan Warga RT',
          imageData: s.imageData,
        }))
      );
      setSuccessMsg(`${stagedSlides.length} foto slide berhasil diunggah dan langsung tampil di slideshow.`);
      setStagedSlides([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan slide ke server.');
    } finally {
      setUploading(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedSlides.length) return;
    const reordered = [...sortedSlides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setErrorMsg(null);
    try {
      await onReorderSlides(reordered.map((s) => s.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengubah urutan slide.');
    }
  };

  const handleSaveEdit = async (slideId: string) => {
    setErrorMsg(null);
    try {
      await onUpdateSlide(slideId, {
        title: editTitle.trim().slice(0, 80),
        subtitle: editSubtitle.trim().slice(0, 160),
      });
      setEditingId(null);
      setSuccessMsg('Keterangan slide diperbarui.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui keterangan slide.');
    }
  };

  const handleDelete = async (slideId: string) => {
    setErrorMsg(null);
    try {
      await onDeleteSlide(slideId);
      setConfirmDeleteId(null);
      setSuccessMsg('Foto slide berhasil dihapus.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus slide.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kelola Slide Foto Halaman Utama"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs sm:p-4"
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ImagePlus className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Kelola Slide Foto Warga (Admin)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unggah foto Full HD dari komputer/HP untuk ditampilkan di slideshow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengelola slide"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe space-y-5 sm:space-y-6">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-semibold text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {successMsg}
            </div>
          )}

          {/* Local File Upload Dropzone */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Unggah Foto Baru dari Perangkat (Lokal)
            </h3>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void processSelectedFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-950/40'
              }`}
            >
              <Upload className="w-7 h-7 text-emerald-700 dark:text-emerald-400 mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {processingFiles
                  ? 'Mengompres foto...'
                  : 'Pilih Foto dari Perangkat atau Seret ke Sini'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bisa pilih beberapa foto sekaligus (JPG, PNG, WebP). Disimpan resolusi Full HD hingga 1920px agar tetap tajam dan jernih.
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={processingFiles || uploading}
                onChange={(e) => {
                  void processSelectedFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            {/* Staged Previews Ready to Upload */}
            {stagedSlides.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    {stagedSlides.length} Foto Siap Diunggah
                  </p>
                  <button
                    type="button"
                    onClick={() => setStagedSlides([])}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    Batalkan Semua
                  </button>
                </div>

                <div className="space-y-3">
                  {stagedSlides.map((item, idx) => (
                    <div
                      key={item.localId}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row gap-3"
                    >
                      <img
                        src={item.imageData}
                        alt={item.fileName}
                        className="w-full sm:w-28 h-24 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {idx + 1}. {item.fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setStagedSlides((prev) =>
                                prev.filter((s) => s.localId !== item.localId)
                              )
                            }
                            aria-label="Hapus dari antrean unggah"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="Label atas (contoh: Sistem Terpadu Warga)"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStagedSlides((prev) =>
                              prev.map((s) =>
                                s.localId === item.localId ? { ...s, title: val } : s
                              )
                            );
                          }}
                          className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                        />
                        <input
                          type="text"
                          maxLength={160}
                          placeholder="Keterangan slide (contoh: Kerja Bakti Mingguan RT 12)"
                          value={item.subtitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStagedSlides((prev) =>
                              prev.map((s) =>
                                s.localId === item.localId ? { ...s, subtitle: val } : s
                              )
                            );
                          }}
                          className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={uploading || !isOnline}
                    onClick={() => void handleUploadAll()}
                    className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {uploading
                        ? 'Mengunggah ke Slideshow...'
                        : `Simpan & Terbitkan ${stagedSlides.length} Slide`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Existing Published Slides */}
          <section className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daftar Slide Foto Aktif ({sortedSlides.length})
              </h3>
            </div>

            {sortedSlides.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-300">
                Belum ada foto slide khusus yang diunggah. Saat ini aplikasi menampilkan foto bawaan lingkungan RT. Unggah foto dari perangkat Anda di atas untuk menggantinya menjadi slide dinamis.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSlides.map((slide, idx) => {
                  const isEditing = editingId === slide.id;
                  const isConfirmingDelete = confirmDeleteId === slide.id;
                  return (
                    <div
                      key={slide.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                    >
                      <img
                        src={slide.imageData}
                        alt={slide.subtitle || slide.title || `Slide ${idx + 1}`}
                        className="w-full sm:w-28 h-20 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />

                      <div className="flex-1 min-w-0 w-full">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              maxLength={80}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Label atas"
                              className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <input
                              type="text"
                              maxLength={160}
                              value={editSubtitle}
                              onChange={(e) => setEditSubtitle(e.target.value)}
                              placeholder="Keterangan slide"
                              className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit(slide.id)}
                                className="min-h-[36px] px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Simpan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              Slide #{idx + 1} · {slide.title || 'Tanpa label'}
                            </p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-2">
                              {slide.subtitle || 'Tanpa keterangan'}
                            </p>
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => void handleMove(idx, -1)}
                            aria-label="Geser slide naik"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedSlides.length - 1}
                            onClick={() => void handleMove(idx, 1)}
                            aria-label="Geser slide turun"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(slide.id);
                              setEditTitle(slide.title || '');
                              setEditSubtitle(slide.subtitle || '');
                              setConfirmDeleteId(null);
                            }}
                            aria-label="Edit keterangan slide"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isConfirmingDelete ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(slide.id)}
                              className="min-h-[38px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                            >
                              Hapus?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(slide.id)}
                              aria-label="Hapus slide"
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
