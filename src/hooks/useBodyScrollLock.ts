import { useEffect } from 'react';

let activeLockCount = 0;
let savedScrollY = 0;
let savedBodyStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  paddingRight: string;
} | null = null;
let savedHtmlStyles: {
  overflow: string;
  overscrollBehavior: string;
} | null = null;

function lockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    const html = document.documentElement;
    const body = document.body;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    savedHtmlStyles = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    };

    savedBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };

    html.classList.add('modal-open');
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }
  }

  activeLockCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeLockCount <= 0) return;

  activeLockCount -= 1;
  if (activeLockCount > 0) return;

  const html = document.documentElement;
  const body = document.body;

  html.classList.remove('modal-open');

  if (savedHtmlStyles) {
    html.style.overflow = savedHtmlStyles.overflow;
    html.style.overscrollBehavior = savedHtmlStyles.overscrollBehavior;
    savedHtmlStyles = null;
  }

  if (savedBodyStyles) {
    body.style.position = savedBodyStyles.position;
    body.style.top = savedBodyStyles.top;
    body.style.left = savedBodyStyles.left;
    body.style.right = savedBodyStyles.right;
    body.style.width = savedBodyStyles.width;
    body.style.overflow = savedBodyStyles.overflow;
    body.style.paddingRight = savedBodyStyles.paddingRight;
    savedBodyStyles = null;
  }

  const prevScrollBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  window.scrollTo(0, savedScrollY);
  window.requestAnimationFrame(() => {
    html.style.scrollBehavior = prevScrollBehavior;
  });
}

/**
 * Locks background page scrolling reliably across PC, Android, and iOS Safari
 * whenever one or more modal/popup dialogs are open.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
