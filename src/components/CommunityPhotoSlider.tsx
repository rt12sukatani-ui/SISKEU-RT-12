import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pause,
  Play,
} from 'lucide-react';
import type { BannerSlide } from '../types';

const DEFAULT_FALLBACK_SLIDE: BannerSlide = {
  id: 'default-rt-banner',
  title: 'Sistem Terpadu Warga',
  subtitle: 'Transparansi Kas · Verifikasi Bukti Foto · Siaga Medis Darurat',
  imageData: '/src/assets/images/rt_community_banner_1795010550301.jpg',
  sortOrder: 0,
  uploadedBy: 'system',
  communityId: 'rt_warga',
};

interface CommunityPhotoSliderProps {
  slides: BannerSlide[];
  className?: string;
  autoPlayIntervalMs?: number;
  isAdmin?: boolean;
  onManageSlides?: () => void;
}

export const CommunityPhotoSlider: React.FC<CommunityPhotoSliderProps> = ({
  slides,
  className = 'min-h-[260px]',
  autoPlayIntervalMs = 5000,
  isAdmin = false,
  onManageSlides,
}) => {
  const effectiveSlides = useMemo(() => {
    if (!slides || slides.length === 0) {
      return [DEFAULT_FALLBACK_SLIDE];
    }
    return [...slides].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [slides]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);

  const totalSlides = effectiveSlides.length;
  const safeIndex = activeIndex >= totalSlides ? 0 : activeIndex;

  useEffect(() => {
    if (totalSlides <= 1 || isPaused || isHovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, autoPlayIntervalMs);
    return () => window.clearInterval(timer);
  }, [totalSlides, isPaused, isHovered, autoPlayIntervalMs]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % totalSlides);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || totalSlides <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = touchStartXRef.current - endX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartXRef.current = null;
  };

  const activeSlide = effectiveSlides[safeIndex] || DEFAULT_FALLBACK_SLIDE;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 select-none group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Galeri Slide Foto Warga RT"
    >
      {/* Slides Stack with Smooth Crossfade */}
      {effectiveSlides.map((slide, index) => {
        const isCurrent = index === safeIndex;
        const isBroken = Boolean(failedIds[slide.id]);
        return (
          <div
            key={slide.id}
            aria-hidden={!isCurrent}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {!isBroken ? (
              <img
                src={slide.imageData}
                alt={slide.subtitle || slide.title || 'Foto lingkungan warga RT'}
                referrerPolicy="no-referrer"
                onError={() => setFailedIds((prev) => ({ ...prev, [slide.id]: true }))}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-slate-900 flex items-center justify-center p-8 text-white">
                <p className="text-lg font-bold">Balai Warga & Kas Transparan RT</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Dark Gradient & Caption Overlay */}
      <div className="relative z-20 h-full min-h-[inherit] bg-gradient-to-t from-black/80 via-black/30 to-black/15 flex flex-col justify-between p-4 sm:p-6">
        {/* Top Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {totalSlides > 1 ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-xs border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white">
              <span className="font-mono-num tabular-nums">
                {safeIndex + 1} / {totalSlides}
              </span>
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                aria-label={isPaused ? 'Putar otomatis slide' : 'Jeda otomatis slide'}
                className="p-1 rounded-lg hover:bg-white/15 transition-colors"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <div />
          )}

          {isAdmin && onManageSlides && (
            <button
              type="button"
              onClick={onManageSlides}
              className="min-h-[40px] px-3.5 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs border border-white/20 text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow-sm"
            >
              <ImagePlus className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{slides.length === 0 ? 'Unggah Slide Foto' : 'Kelola Slide Foto'}</span>
            </button>
          )}
        </div>

        {/* Middle Prev / Next Buttons */}
        {totalSlides > 1 && (
          <div className="flex items-center justify-between gap-2 my-auto py-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Foto sebelumnya"
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 hover:bg-black/75 text-white border border-white/20 flex items-center justify-center backdrop-blur-xs transition-all opacity-85 sm:opacity-75 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Foto berikutnya"
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 hover:bg-black/75 text-white border border-white/20 flex items-center justify-center backdrop-blur-xs transition-all opacity-85 sm:opacity-75 sm:group-hover:opacity-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Bottom Caption & Slide Dots */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0">
            {activeSlide.title && (
              <p className="text-xs font-medium text-emerald-200 truncate">
                {activeSlide.title}
              </p>
            )}
            {activeSlide.subtitle && (
              <p className="text-base sm:text-lg font-bold text-white mt-0.5 leading-snug line-clamp-2">
                {activeSlide.subtitle}
              </p>
            )}
          </div>

          {totalSlides > 1 && (
            <div className="flex items-center gap-1.5 shrink-0" role="tablist" aria-label="Pilih foto slide">
              {effectiveSlides.map((slide, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Tampilkan foto ${idx + 1}`}
                    onClick={() => setActiveIndex(idx)}
                    className={`h-2.5 rounded-full transition-all ${
                      isSelected
                        ? 'w-7 bg-emerald-400'
                        : 'w-2.5 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
