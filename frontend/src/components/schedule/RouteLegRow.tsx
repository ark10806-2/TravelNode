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
  const keepModeLine = modes.length <= 2;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] px-2 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:px-3">
      <div className="relative flex min-h-20 justify-center sm:min-h-14">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
        {isEditing && onToggleLock ? (
          <button
            type="button"
            className={cn(
              'absolute left-1/2 top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isLocked && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
            )}
            onClick={onToggleLock}
            aria-label={`${from.name}에서 ${to.name}까지 구간 ${isLocked ? '고정 해제' : '고정'}`}
            title={isLocked ? '이 장소 사이 구간 고정 해제' : '이 장소 사이 구간 고정'}
          >
            <LockIcon className="h-3.5 w-3.5" />
          </button>
        ) : isLocked ? (
          <span
            className="absolute left-1/2 top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"
            aria-label="고정된 구간"
            title="고정된 장소 사이 구간"
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div className="relative flex min-h-20 min-w-0 items-center py-2 sm:min-h-14">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/45" />
        <div
          className="relative w-full max-w-[22rem] rounded-2xl bg-background/95 px-2.5 py-2 text-xs text-muted-foreground/80 shadow-sm shadow-black/5 sm:mr-auto sm:max-w-[34rem] sm:px-2 sm:py-1.5 sm:text-[11px]"
        >
          {departureTimeMinutes != null ? (
            <div className="mb-1.5 flex flex-wrap items-center gap-1 sm:absolute sm:left-2 sm:top-[-0.8rem] sm:mb-0">
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground/75 sm:text-[10px]">
                {formatDepartureTime(departureTimeMinutes)}
              </span>
            </div>
          ) : null}
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
                    'min-w-0 content-center items-center justify-self-stretch rounded-lg px-1.5 py-1.5 text-left underline-offset-4 transition hover:bg-muted/50 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex sm:gap-1 sm:py-1',
                    keepModeLine
                      ? 'flex gap-1 overflow-hidden'
                      : 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 gap-y-0.5',
                    isSelected && 'bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15 hover:text-primary'
                  )}
                  href={buildPlaceDirectionsUrl(from, to, mode)}
                  target="_blank"
                  rel="noreferrer"
                  title={`${modeMeta[mode].label}${isEstimated ? ' 예상값' : ''}`}
                  aria-label={`${modeMeta[mode].label} 경로 열기`}
                >
                  {isLoading ? (
                    <Loader2
                      className={cn(
                        'h-4 w-4 animate-spin text-muted-foreground/55 sm:h-3.5 sm:w-3.5',
                        keepModeLine ? 'shrink-0 self-auto' : 'self-start sm:self-auto'
                      )}
                    />
                  ) : (
                    <Icon
                      className={cn(
                        'h-4 w-4 text-muted-foreground/60 sm:h-3.5 sm:w-3.5',
                        keepModeLine ? 'shrink-0 self-auto' : 'self-start sm:self-auto',
                        isPending && 'text-muted-foreground/45',
                        isSelected && 'text-primary'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'min-w-0 break-keep font-medium leading-tight',
                      keepModeLine ? 'truncate whitespace-nowrap' : 'whitespace-normal sm:truncate sm:whitespace-nowrap'
                    )}
                  >
                    {isLoading ? (
                      '...'
                    ) : isPending ? (
                      <span aria-hidden="true" className="inline-block h-px w-6 border-t border-dashed border-current opacity-40 align-middle" />
                    ) : (
                      modeLeg.durationLabel
                    )}
                  </span>
                  {!isLoading && !isPending ? (
                    <span
                      className={cn(
                        'w-fit max-w-full break-keep rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                        keepModeLine
                          ? 'shrink-0 whitespace-nowrap'
                          : 'col-start-2 whitespace-normal sm:col-auto sm:shrink-0 sm:whitespace-nowrap',
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
