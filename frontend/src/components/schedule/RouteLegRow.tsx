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
  const lockLabel = isLocked ? '구간 고정됨' : '구간 고정';

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] px-2 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:px-3">
      <div className="flex min-h-16 justify-center sm:min-h-14">
        <div className="h-full w-px bg-border/60" />
      </div>
      <div className="relative flex min-h-16 min-w-0 items-center py-2 sm:min-h-14">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/45" />
        <div
          className="relative w-full max-w-[34rem] bg-background px-2 py-1 text-[10px] text-muted-foreground/60 sm:mr-auto sm:text-[11px]"
        >
          <div className="mb-1 flex flex-wrap items-center gap-1 sm:absolute sm:left-2 sm:top-[-0.8rem] sm:mb-0">
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground/70">
              {departureTimeMinutes == null ? '현재 기준' : `기준 ${formatDepartureTime(departureTimeMinutes)}`}
            </span>
            {isEditing && onToggleLock ? (
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground/70 shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isLocked && 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                )}
                onClick={onToggleLock}
                aria-label={`${from.name}에서 ${to.name}까지 구간 ${isLocked ? '고정 해제' : '고정'}`}
                title={isLocked ? '이 장소 사이 구간 고정 해제' : '이 장소 사이 구간 고정'}
              >
                <LockIcon className="h-3 w-3" />
                {lockLabel}
              </button>
            ) : isLocked ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary"
                aria-label="고정된 구간"
                title="고정된 장소 사이 구간"
              >
                <Lock className="h-3 w-3" />
                구간 고정됨
              </span>
            ) : null}
          </div>
          <div
            className="grid items-stretch gap-1 sm:items-center sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
          >
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
        </div>
      </div>
    </div>
  );
}
