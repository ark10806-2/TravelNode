import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing';

type PullToRefreshProps = {
  onRefresh?: () => void;
};

const triggerDistance = 72;
const maxPullDistance = 96;

export function PullToRefresh({ onRefresh = () => window.location.reload() }: PullToRefreshProps) {
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<PullStatus>('idle');

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function updatePullDistance(distance: number) {
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    }

    function resetPull() {
      if (isRefreshingRef.current) return;
      isTrackingRef.current = false;
      updatePullDistance(0);
      setStatus('idle');
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || isRefreshingRef.current || !canStartPull(event.target)) {
        isTrackingRef.current = false;
        return;
      }

      const touch = event.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isTrackingRef.current = true;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!isTrackingRef.current || isRefreshingRef.current || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = Math.abs(touch.clientX - startXRef.current);

      if (deltaY <= 0 || deltaX > deltaY * 0.8) {
        resetPull();
        return;
      }

      if (window.scrollY > 0) {
        resetPull();
        return;
      }

      event.preventDefault();
      const nextDistance = Math.min(maxPullDistance, deltaY * 0.48);
      updatePullDistance(nextDistance);
      setStatus(nextDistance >= triggerDistance ? 'ready' : 'pulling');
    }

    function handleTouchEnd() {
      if (!isTrackingRef.current || isRefreshingRef.current) return;

      isTrackingRef.current = false;
      if (pullDistanceRef.current >= triggerDistance) {
        isRefreshingRef.current = true;
        updatePullDistance(triggerDistance);
        setStatus('refreshing');
        window.setTimeout(() => onRefreshRef.current(), 160);
        return;
      }

      updatePullDistance(0);
      setStatus('idle');
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', resetPull);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, []);

  const isVisible = status !== 'idle';
  const progress = Math.min(1, pullDistance / triggerDistance);
  const lift = Math.max(0, pullDistance - 54);
  const symbolScale = 0.7 + progress * 0.32;
  const symbolStyle = {
    '--pull-progress': progress.toFixed(3),
    '--pull-geometry-rotate': `${progress * 150}deg`,
    '--pull-blade-offset': `${-(1.5 + progress * 7)}px`,
    '--pull-core-scale': `${0.74 + progress * 0.3}`,
    transform: `translateY(${lift}px) scale(${symbolScale})`
  } as CSSProperties;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center transition-opacity duration-150',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      aria-hidden={!isVisible}
    >
      <div
        className={cn(
          'pull-refresh-stage mt-1.5',
          status === 'ready' && 'pull-refresh-stage-ready',
          status === 'refreshing' && 'pull-refresh-stage-refreshing'
        )}
        style={symbolStyle}
      >
        <PullRefreshSymbol />
      </div>
    </div>
  );
}

function PullRefreshSymbol() {
  return (
    <svg className="pull-refresh-geometry" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id="pull-refresh-blade-gradient" x1="28" y1="8" x2="44" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DDF0FF" />
          <stop offset="0.42" stopColor="#64B0FF" />
          <stop offset="1" stopColor="#3182F6" />
        </linearGradient>
        <radialGradient id="pull-refresh-core-gradient" cx="32" cy="30" r="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.34" stopColor="#BEE0FF" />
          <stop offset="1" stopColor="#3182F6" />
        </radialGradient>
        <filter id="pull-refresh-blade-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0B5BC8" floodOpacity="0.22" />
          <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#FFFFFF" floodOpacity="0.52" />
        </filter>
      </defs>
      <g className="pull-refresh-blades">
        <g className="pull-refresh-blade pull-refresh-blade-a">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
        <g className="pull-refresh-blade pull-refresh-blade-b">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
        <g className="pull-refresh-blade pull-refresh-blade-c">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
        <g className="pull-refresh-blade pull-refresh-blade-d">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
        <g className="pull-refresh-blade pull-refresh-blade-e">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
        <g className="pull-refresh-blade pull-refresh-blade-f">
          <rect x="31" y="8" width="10" height="25" rx="5" />
        </g>
      </g>
      <circle className="pull-refresh-geometry-core" cx="36" cy="36" r="5.2" />
    </svg>
  );
}

function canStartPull(target: EventTarget | null) {
  if (window.scrollY > 0) return false;
  if (!(target instanceof Element)) return false;
  if (target.closest('.modal-overlay-enter')) return false;
  if (target.closest('[data-pull-refresh-ignore]')) return false;

  const scrollable = findScrollableAncestor(target);
  return !scrollable || scrollable.scrollTop <= 0;
}

function findScrollableAncestor(element: Element) {
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY);

    if (canScrollY && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}
