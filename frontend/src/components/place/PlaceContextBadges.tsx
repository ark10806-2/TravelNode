import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { PlaceScheduleBadges } from './PlaceScheduleBadges';

type PlaceContextBadgesProps = {
  reservations: Reservation[];
  scheduleLabels?: string[];
  isDuplicateCandidate?: boolean;
  compact?: boolean;
  className?: string;
  leading?: ReactNode;
  onOpenReservations?: () => void;
};

export function PlaceContextBadges({
  reservations,
  scheduleLabels = [],
  isDuplicateCandidate = false,
  compact = false,
  className,
  leading,
  onOpenReservations
}: PlaceContextBadgesProps) {
  const canShowReservations = Boolean(onOpenReservations) && reservations.length > 0;
  const hasBadges = Boolean(leading) || canShowReservations || scheduleLabels.length > 0 || isDuplicateCandidate;

  if (!hasBadges) return null;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      <PlaceScheduleBadges labels={scheduleLabels} compact={compact} />
      {canShowReservations && onOpenReservations ? (
        <PlaceReservationBadge reservations={reservations} compact={compact} onOpen={onOpenReservations} />
      ) : null}
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
      {leading}
    </div>
  );
}
