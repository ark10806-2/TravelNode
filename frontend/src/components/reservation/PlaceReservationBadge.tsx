import { TicketCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

type PlaceReservationBadgeProps = {
  reservations: Reservation[];
  className?: string;
  compact?: boolean;
  onOpen: () => void;
};

export function PlaceReservationBadge({ reservations, className, compact = false, onOpen }: PlaceReservationBadgeProps) {
  if (!reservations.length) return null;

  return (
    <button
      type="button"
      className={cn(
        'toss-badge-surface inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-transparent px-2.5 text-[11px] font-semibold leading-none text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact && 'px-2',
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <TicketCheck className={cn('h-3.5 w-3.5 shrink-0', compact && 'h-3 w-3')} />
      <span className="truncate">예약</span>
      <span className="tabular-nums">{reservations.length}</span>
    </button>
  );
}
