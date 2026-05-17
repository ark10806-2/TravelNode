import { Car, Footprints, Loader2, Train } from 'lucide-react';
import { buildPlaceDirectionsUrl, routeModes } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { RouteLeg, RouteMode } from '@/types/schedule';
import type { Place } from '@/types/travel';

type RouteLegRowProps = {
  from: Place;
  to: Place;
  leg?: RouteLeg;
  selectedMode?: RouteMode | null;
};

const modeMeta: Record<RouteMode, { label: string; icon: typeof Car }> = {
  driving: { label: '자동차', icon: Car },
  transit: { label: '대중교통', icon: Train },
  walking: { label: '도보', icon: Footprints }
};

export function RouteLegRow({ from, to, leg, selectedMode }: RouteLegRowProps) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] px-2 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:px-3">
      <div className="flex min-h-14 justify-center">
        <div className="h-full w-px bg-border/60" />
      </div>
      <div className="relative flex min-h-14 min-w-0 items-center py-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/45" />
        <div className="relative mr-auto grid w-full max-w-[34rem] grid-cols-3 items-center gap-1 bg-background px-2 text-[10px] text-muted-foreground/60 sm:gap-2 sm:text-[11px]">
          {routeModes.map((mode) => {
            const modeLeg = leg?.[mode];
            const isLoading = !modeLeg || modeLeg.status === 'loading';
            const isEstimated = modeLeg?.status === 'estimated' || modeLeg?.status === 'error';
            const isSelected = selectedMode === mode;
            const Icon = modeMeta[mode].icon;

            return (
              <a
                key={mode}
                className={cn(
                  'flex min-w-0 items-center gap-1 justify-self-stretch rounded px-1 py-1 text-left underline-offset-4 transition hover:bg-muted/50 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected && 'bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15 hover:text-primary'
                )}
                href={buildPlaceDirectionsUrl(from, to, mode)}
                target="_blank"
                rel="noreferrer"
                title={`${modeMeta[mode].label}${isEstimated ? ' 예상값' : ''}`}
                aria-label={`${modeMeta[mode].label} 경로 열기`}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                ) : (
                  <Icon className={cn('h-3 w-3 text-muted-foreground/55', isSelected && 'text-primary')} />
                )}
                <span className="min-w-0 truncate font-medium">{isLoading ? '...' : modeLeg.durationLabel}</span>
                {!isLoading ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
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
  );
}
