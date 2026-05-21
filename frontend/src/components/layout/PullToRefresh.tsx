import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
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
  const Icon = status === 'refreshing' ? Loader2 : status === 'ready' ? Check : RefreshCw;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center transition-opacity duration-150',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ transform: `translateY(${Math.max(0, pullDistance - 54)}px)` }}
      aria-hidden={!isVisible}
    >
      <div className="mt-3 flex h-10 items-center gap-2 rounded-full border bg-background/95 px-3 text-xs font-semibold text-muted-foreground shadow-lg shadow-black/10 backdrop-blur dark:shadow-black/30">
        <Icon className={cn('h-4 w-4 text-primary', status === 'refreshing' && 'animate-spin')} />
        {status === 'ready' ? '놓으면 새로고침' : status === 'refreshing' ? '새로고침 중' : '아래로 당겨 새로고침'}
      </div>
    </div>
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
