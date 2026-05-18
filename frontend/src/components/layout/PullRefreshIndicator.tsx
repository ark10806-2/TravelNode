import { RefreshCw } from 'lucide-react';

type PullRefreshIndicatorProps = {
  distance: number;
  isRefreshing: boolean;
  threshold: number;
};

export function PullRefreshIndicator({ distance, isRefreshing, threshold }: PullRefreshIndicatorProps) {
  const isVisible = isRefreshing || distance > 2;
  const progress = Math.min(1, distance / threshold);
  const translateY = isRefreshing ? 18 : Math.min(30, distance * 0.35);

  if (!isVisible) return null;

  return (
    <div
      className="fixed left-1/2 top-0 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-lg shadow-black/10 backdrop-blur md:hidden"
      style={{ transform: `translate(-50%, ${translateY}px)`, opacity: Math.max(0.55, progress) }}
      aria-live="polite"
    >
      <RefreshCw className={`h-4 w-4 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? '새로고침 중' : progress >= 1 ? '놓으면 새로고침' : '아래로 당겨 새로고침'}
    </div>
  );
}
