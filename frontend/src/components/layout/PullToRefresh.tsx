import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Loader2 } from 'lucide-react';
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
  const cardScale = 0.96 + progress * 0.04;
  const statusText = status === 'ready' ? '놓으면 새로고침' : status === 'refreshing' ? '새로고침 중' : '아래로 당겨 새로고침';
  const cardStyle = {
    '--pull-progress': progress.toFixed(3),
    transform: `translateY(${lift}px) scale(${cardScale})`
  } as CSSProperties;
  const ringStyle = {
    background: `conic-gradient(var(--toss-refresh-blue) ${Math.round(progress * 360)}deg, var(--toss-refresh-track) 0deg)`
  } satisfies CSSProperties;

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
          'pull-refresh-card mt-3 flex h-11 items-center gap-2.5 rounded-full px-2.5 pr-4 text-left backdrop-blur-md transition-colors duration-150',
          status === 'ready' && 'pull-refresh-card-ready',
          status === 'refreshing' && 'pull-refresh-card-refreshing'
        )}
        style={cardStyle}
      >
        <div className="pull-refresh-orb" style={ringStyle}>
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white dark:bg-secondary">
            <PullRefreshIcon status={status} progress={progress} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-[13px] font-semibold text-[var(--toss-refresh-text)]">{statusText}</div>
        </div>
      </div>
    </div>
  );
}

function PullRefreshIcon({ status, progress }: { status: PullStatus; progress: number }) {
  if (status === 'refreshing') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--toss-refresh-icon)]" />;
  }

  if (status === 'ready') {
    return <Check className="h-3.5 w-3.5 text-[var(--toss-refresh-icon)]" />;
  }

  return (
    <span
      className="pull-refresh-geometry"
      style={
        {
          '--pull-icon-rotate': `${progress * 160}deg`,
          '--pull-piece-distance': `${4 + progress * 3}px`,
          '--pull-piece-scale': `${0.72 + progress * 0.28}`
        } as CSSProperties
      }
    >
      <span className="pull-refresh-geometry-piece pull-refresh-geometry-piece-top" />
      <span className="pull-refresh-geometry-piece pull-refresh-geometry-piece-right" />
      <span className="pull-refresh-geometry-piece pull-refresh-geometry-piece-bottom" />
      <span className="pull-refresh-geometry-piece pull-refresh-geometry-piece-left" />
    </span>
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
