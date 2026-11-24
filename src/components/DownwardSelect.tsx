import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOptionItem[];
}

interface DownwardSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOptionItem[];
  groups?: SelectOptionGroup[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

interface MenuCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export const DownwardSelect: React.FC<DownwardSelectProps> = ({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = 'Pilih opsi',
  disabled = false,
  ariaLabel,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    const flatMatch = options.find((opt) => opt.value === value);
    if (flatMatch) return flatMatch.label;
    for (const grp of groups) {
      const grpMatch = grp.options.find((opt) => opt.value === value);
      if (grpMatch) return grpMatch.label;
    }
    return placeholder;
  }, [groups, options, placeholder, value]);

  const computeCoords = useCallback((): MenuCoords | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 6;
    const desiredWidth = Math.min(Math.max(rect.width, 190), viewportW - 16);
    const maxLeft = Math.max(8, viewportW - desiredWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const top = Math.min(rect.bottom + gap, viewportH - 140);
    const availableBelow = Math.max(120, Math.min(300, viewportH - top - 12));

    return {
      top,
      left,
      width: desiredWidth,
      maxHeight: availableBelow,
    };
  }, []);

  const updateCoords = useCallback(() => {
    const next = computeCoords();
    if (next) setCoords(next);
  }, [computeCoords]);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      updateCoords();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, updateCoords]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 170) {
        triggerRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
      const next = computeCoords();
      setCoords(next);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleToggle}
        className={`flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate flex-1 min-w-0">{selectedLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
          }`}
        />
      </button>

      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
            }}
            className="z-[120] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-slate-900 dark:text-slate-100"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full min-h-[40px] px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="break-words min-w-0 flex-1">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  )}
                </button>
              );
            })}

            {groups.map((grp) => (
              <div key={grp.label} className="mt-1 first:mt-0">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/80 border-y border-slate-100 dark:border-slate-800/80 sticky top-0">
                  {grp.label}
                </div>
                {grp.options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full min-h-[40px] px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="break-words min-w-0 flex-1">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
