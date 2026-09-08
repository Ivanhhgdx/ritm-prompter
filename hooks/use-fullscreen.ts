'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void | Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [expanded, setExpanded] = useState(false);
  const [homeScreenHelp, setHomeScreenHelp] = useState(false);
  const fallback = useRef(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const transition = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    pending.current = false;
  }, []);
  const returnFocus = useRef<HTMLElement | null>(null);
  const errorHandler = useRef<() => void>(() => {});

  const close = useCallback(async () => {
    transition.current++;
    clearPending();
    errorHandler.current = () => {};
    const doc = document as FullscreenDocument;
    const nativeElement = doc.fullscreenElement || doc.webkitFullscreenElement;
    fallback.current = false;
    if (nativeElement === target.current) {
      try {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        await exit?.call(doc);
      } catch {
        // Keep the exit control visible while native fullscreen is still active.
        if (mounted.current) setExpanded(true);
        return;
      }
    }
    if (mounted.current) setExpanded(false);
    returnFocus.current?.focus({ preventScroll: true });
  }, [target, clearPending]);

  const expandInWindow = useCallback(() => {
    transition.current++;
    clearPending();
    errorHandler.current = () => {};
    fallback.current = true;
    setHomeScreenHelp(false);
    setExpanded(true);
  }, [clearPending]);

  const toggle = useCallback(() => {
    if (expanded) {
      void close();
      return;
    }
    if (pending.current) return;
    const ticket = ++transition.current;
    const element = target.current as FullscreenElement | null;
    if (!element) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const enterFallback = () => {
      if (!mounted.current || ticket !== transition.current) return;
      clearPending();
      errorHandler.current = () => {};
      // A late rejection must not overlay a successfully expanded reader.
      const doc = document as FullscreenDocument;
      if ((doc.fullscreenElement || doc.webkitFullscreenElement) === element) {
        setExpanded(true);
        return;
      }
      const standalone =
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;
      if (/iPhone|iPod/i.test(navigator.userAgent) && !standalone) {
        // An in-tab expansion cannot remove iPhone Safari's own controls.
        setHomeScreenHelp(true);
        return;
      }
      expandInWindow();
    };
    errorHandler.current = enterFallback;
    const request =
      element.requestFullscreen || element.webkitRequestFullscreen;
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) {
      expandInWindow();
      return;
    }
    if (
      !request ||
      (document.fullscreenEnabled === false && !element.webkitRequestFullscreen)
    ) {
      enterFallback();
      return;
    }
    pending.current = true;
    // Some native transitions neither settle their promise nor dispatch an event.
    // Release the lock and offer the window fallback instead of disabling the button.
    timeout.current = setTimeout(enterFallback, 2500);
    try {
      // Invoke inside the button's user gesture, before any asynchronous work.
      const result = request.call(element);
      Promise.resolve(result).catch(enterFallback);
    } catch {
      enterFallback();
    }
  }, [expanded, close, target, expandInWindow, clearPending]);

  useEffect(() => {
    mounted.current = true;
    const doc = document as FullscreenDocument;
    const sync = () => {
      const native =
        (doc.fullscreenElement || doc.webkitFullscreenElement) ===
        target.current;
      clearPending();
      errorHandler.current = () => {};
      if (native) fallback.current = false;
      setExpanded(native || fallback.current);
      if (!native && !fallback.current)
        returnFocus.current?.focus({ preventScroll: true });
    };
    const fail = () => {
      clearPending();
      errorHandler.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fallback.current) {
        event.preventDefault();
        void close();
      }
    };
    doc.addEventListener('fullscreenchange', sync);
    doc.addEventListener('webkitfullscreenchange', sync);
    doc.addEventListener('fullscreenerror', fail);
    doc.addEventListener('webkitfullscreenerror', fail);
    doc.addEventListener('keydown', key);
    return () => {
      mounted.current = false;
      transition.current++;
      clearPending();
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener('webkitfullscreenchange', sync);
      doc.removeEventListener('fullscreenerror', fail);
      doc.removeEventListener('webkitfullscreenerror', fail);
      doc.removeEventListener('keydown', key);
    };
  }, [close, target, clearPending]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  return {
    expanded,
    toggle,
    homeScreenHelp,
    setHomeScreenHelp,
    expandInWindow,
  };
}
