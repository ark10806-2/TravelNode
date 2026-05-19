import { Car, Footprints, Loader2, Lock, LockOpen, Train } from 'lucide-react';
import { buildPlaceDirectionsUrl, formatDepartureTime, routeModes } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { RouteLeg, RouteMode } from '@/types/schedule';
import type { Place } from '@/types/travel';

type RouteLegRowProps = {
  from: Place;
  to: Place;
  leg?: RouteLeg;
  selectedMode?: RouteMode | null;
  departureTimeMinutes?: number | null;
  visibleModes?: RouteMode[];
  isEditing?: boolean;
  isLocked?: boolean;
  onToggleLock?: () => void;
};

const modeMeta: Record<RouteMode, { label: string; icon: typeof Car }> = {
  driving: { label: '자동차', icon: Car },
  transit: { label: '대중교통', icon: Train },
  walking: { label: '도보', icon: Footprints }
};

export function RouteLegRow({
  from,
  to,
  leg,
  selectedMode,
  departureTimeMinutes,
  visibleModes = routeModes,
  isEditing,
  isLocked,
  onToggleLock
}: RouteLegRowProps) {
  const LockIcon = isLocked ? Lock : LockOpen;
  const modes = visibleModes.length ? visibleModes : routeModes;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] px-2 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:px-3">
      <div className="flex min-h-16 justify-center sm:min-h-14">
        <div className="h-full w-px bg-border/60" />
      </div>
      <div className="relative flex min-h-16 min-w-0 items-center py-2 sm:min-h-14">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/45" />
        <div
          className="relative mr-10 grid w-full max-w-[34rem] items-stretch gap-1 bg-background px-2 pt-4 text-[10px] text-muted-foreground/60 sm:mr-auto sm:items-center sm:gap-2 sm:pt-0 sm:text-[11px]"
          style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
        >
          <span className="absolute left-2 top-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground/70 sm:-top-3">
            {departureTimeMinutes == null ? '현재 기준' : `기준 ${formatDepartureTime(departureTimeMinutes)}`}
          </span>
          {modes.map((mode) => {
            const modeLeg = leg?.[mode];
            const isPending = !modeLeg;
            const isLoading = modeLeg?.status === 'loading';
            const isEstimated = modeLeg?.status === 'estimated' || modeLeg?.status === 'error';
            const isSelected = selectedMode === mode;
            const Icon = modeMeta[mode].icon;

            return (
              <a
                key={mode}
                className={cn(
                  'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-1 gap-y-0.5 justify-self-stretch rounded px-1 py-1.5 text-left underline-offset-4 transition hover:bg-muted/50 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex sm:gap-1 sm:py-1',
                  isSelected && 'bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15 hover:text-primary'
                )}
                href={buildPlaceDirectionsUrl(from, to, mode)}
                target="_blank"
                rel="noreferrer"
                title={`${modeMeta[mode].label}${isPending ? ' 계산 전' : isEstimated ? ' 예상값' : ''}`}
                aria-label={`${modeMeta[mode].label} 경로 열기`}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 self-start animate-spin text-muted-foreground/50 sm:self-auto" />
                ) : (
                  <Icon
                    className={cn(
                      'h-3 w-3 self-start text-muted-foreground/55 sm:self-auto',
                      isPending && 'text-muted-foreground/35',
                      isSelected && 'text-primary'
                    )}
                  />
                )}
                <span className="min-w-0 whitespace-normal break-keep font-medium leading-tight sm:truncate sm:whitespace-nowrap">
                  {isLoading ? '...' : isPending ? '계산 전' : modeLeg.durationLabel}
                </span>
                {!isLoading && !isPending ? (
                  <span
                    className={cn(
                      'col-start-2 w-fit max-w-full whitespace-normal break-keep rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none sm:col-auto sm:shrink-0 sm:whitespace-nowrap',
                      isEstimated ? 'bg-muted/20 text-muted-foreground/45' : 'bg-muted/35 text-muted-foreground/65',
                      isSelected && 'bg-primary/15 text-primary'
                    )}
                  >
                    {modeLeg.distanceLabel}
                  </span>
                ) : null}
                {isEstimated ? <span className="sr-only">예상</span> : null}
              </a>
            );
          })}
        </div>
        {isEditing && onToggleLock ? (
          <button
            type="button"
            className={cn(
              'absolute right-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-2',
              isLocked && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
            )}
            onClick={onToggleLock}
            aria-label={`${from.name}에서 ${to.name}까지 경로 ${isLocked ? '잠금 해제' : '잠금'}`}
            title={isLocked ? '이 edge 잠금 해제' : '이 edge 잠금'}
          >
            <LockIcon className="h-3.5 w-3.5" />
          </button>
        ) : isLocked ? (
          <span
            className="absolute right-0 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary sm:right-2"
            aria-label="잠긴 경로"
            title="잠긴 edge"
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
