'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap } from 'lucide-react';

type TransitionPhase = 'idle' | 'loading' | 'finishing';
type RouteTransitionCopy = {
  label?: string;
  message?: string;
};

const MIN_VISIBLE_MS = 320;
const FINISH_ANIMATION_MS = 240;
const SAFETY_TIMEOUT_MS = 12_000;
const RELOAD_HANDOFF_KEY = '__dcam_route_transition__';
const LOCATION_CHANGE_EVENT = 'dcam:locationchange';
const ROUTE_TRANSITION_START_EVENT = 'dcam:route-transition-start';
const ROUTE_TRANSITION_FINISH_EVENT = 'dcam:route-transition-finish';
const DEFAULT_COPY: Required<RouteTransitionCopy> = {
  label: 'DCAM Classes',
  message: 'Opening workspace',
};

export function startRouteTransition(copy?: RouteTransitionCopy) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RouteTransitionCopy>(ROUTE_TRANSITION_START_EVENT, { detail: copy }));
}

export function finishRouteTransition() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ROUTE_TRANSITION_FINISH_EVENT));
}

export function RouteTransitionFallback({ label, message }: RouteTransitionCopy) {
  useEffect(() => {
    startRouteTransition({ label, message });
    return () => finishRouteTransition();
  }, [label, message]);

  return <div className="min-h-screen bg-background" aria-hidden="true" />;
}

function comparableUrl(value: string): string {
  const url = new URL(value, window.location.href);
  return `${url.pathname}${url.search}`;
}

function isEligibleLink(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download') || anchor.getAttribute('aria-disabled') === 'true') return false;

  const href = anchor.getAttribute('href')?.trim() || '';
  if (!href || href.startsWith('#')) return false;

  try {
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return false;
    if (!['http:', 'https:'].includes(destination.protocol)) return false;
    return comparableUrl(destination.href) !== comparableUrl(window.location.href);
  } catch {
    return false;
  }
}

export default function RouteTransition() {
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [copy, setCopy] = useState<Required<RouteTransitionCopy>>(DEFAULT_COPY);
  const phaseRef = useRef<TransitionPhase>('idle');
  const startedAtRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  const clearTimer = useCallback((timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setCurrentPhase = useCallback((nextPhase: TransitionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const finish = useCallback((immediate = false) => {
    if (phaseRef.current === 'idle') return;

    clearTimer(safetyTimerRef);
    clearTimer(finishTimerRef);

    const elapsed = performance.now() - startedAtRef.current;
    const wait = immediate ? 0 : Math.max(0, MIN_VISIBLE_MS - elapsed);

    finishTimerRef.current = window.setTimeout(() => {
      setCurrentPhase('finishing');
      finishTimerRef.current = window.setTimeout(() => {
        setCurrentPhase('idle');
        setCopy(DEFAULT_COPY);
        finishTimerRef.current = null;
        try {
          sessionStorage.removeItem(RELOAD_HANDOFF_KEY);
        } catch {
          // Storage can be unavailable in privacy-restricted browsing modes.
        }
      }, FINISH_ANIMATION_MS);
    }, wait);
  }, [clearTimer, setCurrentPhase]);

  const start = useCallback((persistAcrossReload = false, nextCopy?: RouteTransitionCopy) => {
    clearTimer(finishTimerRef);
    clearTimer(safetyTimerRef);

    if (nextCopy?.label || nextCopy?.message) {
      setCopy({
        label: nextCopy.label || DEFAULT_COPY.label,
        message: nextCopy.message || DEFAULT_COPY.message,
      });
    }

    if (phaseRef.current === 'idle' || phaseRef.current === 'finishing') {
      startedAtRef.current = performance.now();
      setCurrentPhase('loading');
    }

    if (persistAcrossReload) {
      try {
        sessionStorage.setItem(RELOAD_HANDOFF_KEY, Date.now().toString());
      } catch {
        // The visual transition still works for the current document.
      }
    }

    safetyTimerRef.current = window.setTimeout(() => finish(), SAFETY_TIMEOUT_MS);
  }, [clearTimer, finish, setCurrentPhase]);

  useEffect(() => {
    try {
      const handoffStartedAt = Number(sessionStorage.getItem(RELOAD_HANDOFF_KEY) || 0);
      const isFreshHandoff = handoffStartedAt > 0 && Date.now() - handoffStartedAt < SAFETY_TIMEOUT_MS;
      sessionStorage.removeItem(RELOAD_HANDOFF_KEY);
      if (isFreshHandoff) {
        start();
        window.setTimeout(() => finish(), 180);
      }
    } catch {
      // Nothing to restore.
    }
  }, [finish, start]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || !isEligibleLink(event, anchor)) return;
      start(true);
    };

    const onLocationChange = () => {
      if (phaseRef.current === 'idle') {
        start();
      }
      window.requestAnimationFrame(() => finish());
    };

    const onPopState = () => {
      start();
      window.setTimeout(() => finish(), MIN_VISIBLE_MS);
    };

    const onPageShow = () => finish(true);
    const onExternalStart = (event: Event) => {
      start(false, (event as CustomEvent<RouteTransitionCopy>).detail);
    };
    const onExternalFinish = () => finish();

    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener(LOCATION_CHANGE_EVENT, onLocationChange);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(ROUTE_TRANSITION_START_EVENT, onExternalStart);
    window.addEventListener(ROUTE_TRANSITION_FINISH_EVENT, onExternalFinish);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const notifyAfterHistoryChange = (
      original: History['pushState'],
      thisArg: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      const before = comparableUrl(window.location.href);
      const result = original.call(thisArg, data, unused, url);
      const after = comparableUrl(window.location.href);
      if (before !== after) {
        window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      }
      return result;
    };

    const patchedPushState: History['pushState'] = function (this: History, data, unused, url) {
      return notifyAfterHistoryChange(originalPushState, this, data, unused, url);
    };
    const patchedReplaceState: History['replaceState'] = function (this: History, data, unused, url) {
      return notifyAfterHistoryChange(originalReplaceState, this, data, unused, url);
    };

    window.history.pushState = patchedPushState;
    window.history.replaceState = patchedReplaceState;

    return () => {
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener(LOCATION_CHANGE_EVENT, onLocationChange);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(ROUTE_TRANSITION_START_EVENT, onExternalStart);
      window.removeEventListener(ROUTE_TRANSITION_FINISH_EVENT, onExternalFinish);
      if (window.history.pushState === patchedPushState) {
        window.history.pushState = originalPushState;
      }
      if (window.history.replaceState === patchedReplaceState) {
        window.history.replaceState = originalReplaceState;
      }
      clearTimer(finishTimerRef);
      clearTimer(safetyTimerRef);
    };
  }, [clearTimer, finish, start]);

  return (
    <div
      className="dcam-route-transition"
      data-phase={phase}
      aria-hidden={phase === 'idle'}
      aria-live="polite"
    >
      <div className="dcam-route-transition__veil" />
      <div className="dcam-route-transition__progress" aria-hidden="true">
        <span />
      </div>
      <div className="dcam-route-transition__status" role="status">
        <div className="dcam-route-transition__mark" aria-hidden="true">
          <GraduationCap />
        </div>
        <div className="dcam-route-transition__copy">
          <strong>{copy.label}</strong>
          <span>{copy.message}</span>
        </div>
        <div className="dcam-route-transition__pulse" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
