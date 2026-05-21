import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { PlaceScheduleBadges } from './PlaceScheduleBadges';

type PlaceContextBadgesProps = {
  reservations: Reservation[];
  scheduleLabels?: string[];
  isDuplicateCandidate?: boolean;
  needsReview?: boolean;
  compact?: boolean;
  className?: string;
  leading?: ReactNode;
  onOpenReservations?: () => void;
};

export function PlaceContextBadges({
  reservations,
  scheduleLabels = [],
  isDuplicateCandidate = false,
  needsReview = false,
  compact = false,
  className,
  leading,
  onOpenReservations
}: PlaceContextBadgesProps) {
  const hasBadges = Boolean(leading) || reservations.length > 0 || scheduleLabels.length > 0 || isDuplicateCandidate || needsReview;

  if (!hasBadges) return null;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {leading}
      {onOpenReservations ? (
        <PlaceReservationBadge reservations={reservations} compact={compact} onOpen={onOpenReservations} />
      ) : null}
      <PlaceScheduleBadges labels={scheduleLabels} compact={compact} />
      {isDuplicateCandidate ? (
        <Badge
          variant="outline"
          className={cn(
            'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200',
            compact && 'h-6 px-2 text-[11px]'
          )}
        >
          중복 후보
        </Badge>
      ) : null}
      {needsReview ? (
        <Badge
          variant="outline"
          className={cn(
            'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200',
            compact && 'h-6 px-2 text-[11px]'
          )}
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          보강 필요
        </Badge>
      ) : null}
    </div>
  );
}
