import { useEffect, useRef, useState } from 'react';

const pullRefreshThreshold = 72;
const pullRefreshMaxDistance = 96;

export type PullToRefreshState = {
  distance: number;
  isRefreshing: boolean;
  threshold: number;
};

export function usePullToRefresh(): PullToRefreshState {
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    function isMobileViewport() {
      return window.matchMedia('(max-width: 767px)').matches;
    }

    function shouldIgnorePull(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"], iframe'));
    }

    function resetPull() {
      pullStartYRef.current = null;
      pullDistanceRef.current = 0;
      setDistance(0);
    }

    function onTouchStart(event: TouchEvent) {
      if (isRefreshing || !isMobileViewport() || window.scrollY > 0 || event.touches.length !== 1) {
        pullStartYRef.current = null;
        return;
      }

      if (shouldIgnorePull(event.target)) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current = event.touches[0].clientY;
    }

    function onTouchMove(event: TouchEvent) {
      const startY = pullStartYRef.current;
      if (startY == null || event.touches.length !== 1) return;

      if (window.scrollY > 0) {
        resetPull();
        return;
      }

      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 0) {
        resetPull();
        return;
      }

      const nextDistance = Math.min(pullRefreshMaxDistance, deltaY * 0.5);
      pullDistanceRef.current = nextDistance;
      setDistance(nextDistance);

      if (deltaY > 8) event.preventDefault();
    }

    function onTouchEnd() {
      if (pullStartYRef.current == null) return;
      const shouldRefresh = pullDistanceRef.current >= pullRefreshThreshold;
      resetPull();

      if (!shouldRefresh) return;
      setIsRefreshing(true);
      window.setTimeout(() => window.location.reload(), 140);
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', resetPull);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, [isRefreshing]);

  return {
    distance,
    isRefreshing,
    threshold: pullRefreshThreshold
  };
}
