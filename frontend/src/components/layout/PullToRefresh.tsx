import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
  const progress = Math.min(1, pullDistance / triggerDistance);
  const lift = Math.max(0, pullDistance - 54);
  const cardScale = 0.88 + progress * 0.12;
  const cardTilt = status === 'ready' || status === 'refreshing' ? 0 : 8 - progress * 8;
  const statusText = status === 'ready' ? '놓으면 새로고침' : status === 'refreshing' ? '새로고침 중' : '아래로 당겨 새로고침';
  const statusHint = status === 'ready' ? '준비 완료' : status === 'refreshing' ? '잠시만요' : '조금 더 당겨주세요';
  const cardStyle = {
    '--pull-progress': progress.toFixed(3),
    transform: `translateY(${lift}px) perspective(520px) rotateX(${cardTilt}deg) scale(${cardScale})`
  } as CSSProperties;
  const ringStyle = {
    background: `conic-gradient(hsl(var(--primary)) ${Math.round(progress * 360)}deg, hsl(var(--muted)) 0deg)`
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
          'pull-refresh-card mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-2xl backdrop-blur-xl transition-[filter] duration-200',
          status === 'ready' && 'pull-refresh-card-ready',
          status === 'refreshing' && 'pull-refresh-card-refreshing'
        )}
        style={cardStyle}
      >
        <div className="pull-refresh-shine" />
        <span className="pull-refresh-spark pull-refresh-spark-one" />
        <span className="pull-refresh-spark pull-refresh-spark-two" />
        <span className="pull-refresh-spark pull-refresh-spark-three" />
        <div className="pull-refresh-orb" style={ringStyle}>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-background shadow-inner">
            <Icon className={cn('h-5 w-5 text-primary', status === 'refreshing' && 'animate-spin')} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-primary/80">
            <Sparkles className="h-3.5 w-3.5" />
            {statusHint}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-sm font-bold text-foreground">{statusText}</div>
        </div>
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
