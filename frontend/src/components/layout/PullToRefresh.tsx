import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing';

type PullToRefreshProps = {
  onRefresh?: () => void;
};

const triggerDistance = 96;
const maxPullDistance = 158;
const maxContentOffset = 148;

export function PullToRefresh({ onRefresh = () => window.location.reload() }: PullToRefreshProps) {
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const pendingDistanceRef = useRef(0);
  const frameRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const statusRef = useRef<PullStatus>('idle');
  const [status, setStatus] = useState<PullStatus>('idle');

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function setPullStatus(nextStatus: PullStatus) {
      if (statusRef.current === nextStatus) return;

      statusRef.current = nextStatus;
      setStatus(nextStatus);
    }

    function setContentTransition(enabled: boolean) {
      document.documentElement.style.setProperty(
        '--pull-refresh-content-transition',
        enabled ? '180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : '0ms linear'
      );
    }

    function applyPullDistance(distance: number) {
      const progress = Math.min(1, distance / triggerDistance);
      const lift = Math.max(0, distance - 52) * 0.2;
      const symbolScale = 0.74 + progress * 0.18;
      const stageStyle = stageRef.current?.style;

      document.documentElement.style.setProperty(
        '--pull-refresh-offset',
        `${Math.min(maxContentOffset, distance * 1.02).toFixed(1)}px`
      );

      if (!stageStyle) return;

      stageStyle.setProperty('--pull-symbol-opacity', (0.18 + progress * 0.74).toFixed(3));
      stageStyle.setProperty('--pull-symbol-y', `${(progress * 0.34).toFixed(3)}rem`);
      stageStyle.setProperty('--pull-wave-scale-x', (0.86 + progress * 0.2).toFixed(3));
      stageStyle.setProperty('--pull-wave-scale-y', (0.78 + progress * 0.18).toFixed(3));
      stageStyle.setProperty('--pull-wave-opacity', (0.3 + progress * 0.52).toFixed(3));
      stageStyle.setProperty('--pull-wave-rim', (0.18 + progress * 0.3).toFixed(3));
      stageStyle.transform = `translate3d(0, ${lift.toFixed(1)}px, 0) scale(${symbolScale.toFixed(3)})`;
    }

    function updatePullDistance(distance: number) {
      pullDistanceRef.current = distance;
      pendingDistanceRef.current = distance;

      if (frameRef.current) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        applyPullDistance(pendingDistanceRef.current);
      });
    }

    function resetPull() {
      if (isRefreshingRef.current) return;
      isTrackingRef.current = false;
      setContentTransition(true);
      updatePullDistance(0);
      setPullStatus('idle');
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
      setContentTransition(false);
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
      const nextDistance = Math.min(maxPullDistance, deltaY * 0.62);
      updatePullDistance(nextDistance);
      setPullStatus(nextDistance >= triggerDistance ? 'ready' : 'pulling');
    }

    function handleTouchEnd() {
      if (!isTrackingRef.current || isRefreshingRef.current) return;

      isTrackingRef.current = false;
      if (pullDistanceRef.current >= triggerDistance) {
        isRefreshingRef.current = true;
        setContentTransition(true);
        updatePullDistance(triggerDistance);
        setPullStatus('refreshing');
        window.setTimeout(() => onRefreshRef.current(), 160);
        return;
      }

      setContentTransition(true);
      updatePullDistance(0);
      setPullStatus('idle');
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', resetPull);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      document.documentElement.style.removeProperty('--pull-refresh-offset');
      document.documentElement.style.removeProperty('--pull-refresh-content-transition');
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, []);

  const isVisible = status !== 'idle';

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center transition-opacity duration-150',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      aria-hidden={!isVisible}
    >
      <div
        ref={stageRef}
        className={cn(
          'pull-refresh-stage mt-1.5',
          status === 'pulling' && 'pull-refresh-stage-pulling',
          status === 'ready' && 'pull-refresh-stage-ready',
          status === 'refreshing' && 'pull-refresh-stage-refreshing'
        )}
      >
        <PullRefreshSymbol />
      </div>
    </div>
  );
}

function PullRefreshSymbol() {
  return (
    <div className="pull-refresh-symbol" aria-hidden="true">
      <span className="pull-refresh-wave-surface" />
      <span className="pull-refresh-wave pull-refresh-wave-back" />
      <span className="pull-refresh-wave pull-refresh-wave-mid" />
      <span className="pull-refresh-wave pull-refresh-wave-front" />
      <span className="pull-refresh-wave-sheen" />
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
