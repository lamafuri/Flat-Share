import { useRef, useCallback } from 'react';

/**
 * useSwipe — detect swipe gestures on touch devices
 * @param {Object} handlers - { onLeft, onRight, onUp, onDown }
 * @param {number} threshold - minimum px to register as swipe (default 60)
 */
export function useSwipe(handlers = {}, threshold = 60) {
  const startX = useRef(null);
  const startY = useRef(null);
  const startTime = useRef(null);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (startX.current === null) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;
    const elapsed = Date.now() - startTime.current;

    // Must be fast enough (< 400ms) and exceed threshold
    if (elapsed > 400) return;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy && absDx > threshold) {
      // Horizontal swipe
      if (dx > 0 && handlers.onRight) handlers.onRight();
      if (dx < 0 && handlers.onLeft) handlers.onLeft();
    } else if (absDy > absDx && absDy > threshold) {
      // Vertical swipe
      if (dy > 0 && handlers.onDown) handlers.onDown();
      if (dy < 0 && handlers.onUp) handlers.onUp();
    }

    startX.current = null;
    startY.current = null;
  }, [handlers, threshold]);

  return { onTouchStart, onTouchEnd };
}

/**
 * usePWAInstall — handle PWA install prompt
 */
export function usePWAInstall() {
  const deferredPrompt = useRef(null);

  const canInstall = useRef(false);

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      canInstall.current = true;
    });
  }

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return false;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    canInstall.current = false;
    return outcome === 'accepted';
  }, []);

  return { canInstall: canInstall.current, install };
}
