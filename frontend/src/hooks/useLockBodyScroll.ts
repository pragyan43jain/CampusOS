import { useEffect } from 'react';

// Global counter for active modals to handle stacked/nested modals cleanly
let activeModalCount = 0;

/**
 * useLockBodyScroll
 * Locks document.body and document.documentElement scrolling whenever a modal/popup is open.
 * Prevents background page scrolling while allowing smooth scrolling inside the modal dialog.
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

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        body.style.overflow = originalBodyOverflow;
        docEl.style.overflow = originalDocOverflow;
        body.style.paddingRight = originalBodyPaddingRight;
        body.classList.remove('modal-open');
        docEl.classList.remove('modal-open');
      }
    };
  }, [isLocked]);
}

export default useLockBodyScroll;
