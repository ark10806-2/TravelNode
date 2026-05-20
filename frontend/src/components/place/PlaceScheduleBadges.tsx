import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PlaceScheduleBadgesProps = {
  labels: string[];
  compact?: boolean;
  className?: string;
};

export function PlaceScheduleBadges({ labels, compact = false, className }: PlaceScheduleBadgesProps) {
  if (!labels.length) return null;

  return (
    <div className={cn('flex max-w-full flex-wrap items-center gap-1', className)}>
      {labels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            'rounded-full border-emerald-200 bg-emerald-50 font-black text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200',
            compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          )}
        >
          <CalendarDays className={cn('mr-1 shrink-0', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          {label}
        </Badge>
      ))}
    </div>
  );
}
