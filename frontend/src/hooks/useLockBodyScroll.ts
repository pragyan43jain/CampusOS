import { useEffect } from 'react';

// Global counter for active modals to handle stacked/nested modals cleanly
let activeModalCount = 0;
let touchStartY = 0;

function handleWheel(e: WheelEvent) {
  if (activeModalCount <= 0) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Check if cursor is on any modal, dialog, popup card, drawer, or backdrop
  const modalContainer = target.closest(
    '.modal-backdrop, [role="dialog"], .modal-content-glass, .modal-card, [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], .card.overscroll-contain'
  ) as HTMLElement | null;

  if (modalContainer) {
    // Find the scrollable element inside the modal (if any)
    let el: HTMLElement | null = target;
    let scrollable: HTMLElement | null = null;

    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const canScrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight;

      if (canScrollY) {
        scrollable = el;
        break;
      }
      if (el === modalContainer) break;
      el = el.parentElement;
    }

    if (!scrollable) {
      // The popup card or backdrop has no scrollable content:
      // Prevent wheel event default so the background page NEVER scrolls!
      e.preventDefault();
      return;
    }

    // If there is a scrollable container inside the modal, check boundaries
    const isScrollingUp = e.deltaY < 0;
    const isScrollingDown = e.deltaY > 0;
    const isAtTop = scrollable.scrollTop <= 0;
    const isAtBottom =
      Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;

    if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
      // Prevent scroll chaining to the background page
      e.preventDefault();
    }
  } else {
    // Cursor is outside the modal, prevent background scroll
    e.preventDefault();
  }
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length > 0) {
    touchStartY = e.touches[0].clientY;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (activeModalCount <= 0 || e.touches.length === 0) return;
  const currentY = e.touches[0].clientY;
  const deltaY = touchStartY - currentY;
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const modalContainer = target.closest(
    '.modal-backdrop, [role="dialog"], .modal-content-glass, .modal-card, [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"]'
  ) as HTMLElement | null;

  if (modalContainer) {
    let el: HTMLElement | null = target;
    let scrollable: HTMLElement | null = null;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      ) {
        scrollable = el;
        break;
      }
      if (el === modalContainer) break;
      el = el.parentElement;
    }

    if (!scrollable) {
      e.preventDefault();
      return;
    }

    const isScrollingUp = deltaY < 0;
    const isScrollingDown = deltaY > 0;
    const isAtTop = scrollable.scrollTop <= 0;
    const isAtBottom =
      Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;

    if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
      e.preventDefault();
    }
  } else {
    e.preventDefault();
  }
}

/**
 * useLockBodyScroll
 * Locks document.body, document.documentElement, and viewport containers scrolling
 * whenever a modal/popup is open. Prevents background page scrolling while allowing
 * smooth scrolling inside the modal dialog.
 */
export function useLockBodyScroll(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    activeModalCount++;

    const docEl = document.documentElement;
    const body = document.body;

    const originalBodyOverflow = body.style.overflow;
    const originalDocOverflow = docEl.style.overflow;
    const originalBodyPaddingRight = body.style.paddingRight;

    // Compensate for scrollbar jump
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;
    if (scrollbarWidth > 0 && activeModalCount === 1) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    body.style.overflow = 'hidden';
    docEl.style.overflow = 'hidden';
    body.classList.add('modal-open');
    docEl.classList.add('modal-open');

    if (activeModalCount === 1) {
      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        body.style.overflow = originalBodyOverflow;
        docEl.style.overflow = originalDocOverflow;
        body.style.paddingRight = originalBodyPaddingRight;
        body.classList.remove('modal-open');
        docEl.classList.remove('modal-open');

        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [isLocked]);
}

export default useLockBodyScroll;
