import React, { useEffect, useRef, useState } from 'react';

interface CancelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const CancelButton: React.FC<CancelButtonProps> = ({
  children,
  className = '',
  onClick,
  onPointerDown,
  type = 'button',
  disabled,
  ...rest
}) => {
  const [clickedRed, setClickedRed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flashRed = () => {
    if (disabled) return;
    setClickedRed(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setClickedRed(false);
    }, 350);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onPointerDown={(e) => {
        flashRed();
        onPointerDown?.(e);
      }}
      onClick={(e) => {
        flashRed();
        onClick?.(e);
      }}
      className={`border font-semibold inline-flex items-center justify-center transition-all cursor-pointer touch-manipulation select-none enabled:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
        clickedRed
          ? 'bg-red-600 border-red-600 text-white shadow-sm'
          : 'bg-white dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 enabled:hover:bg-red-600 dark:enabled:hover:bg-red-600 enabled:hover:border-red-600 dark:enabled:hover:border-red-600 enabled:hover:text-white dark:enabled:hover:text-white enabled:active:bg-red-600 dark:enabled:active:bg-red-600 enabled:active:border-red-600 dark:enabled:active:border-red-600 enabled:active:text-white dark:enabled:active:text-white'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
