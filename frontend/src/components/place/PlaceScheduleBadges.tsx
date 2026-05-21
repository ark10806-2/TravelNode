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
    <div className={cn('flex max-w-full flex-wrap items-center gap-1.5', className)}>
      {labels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            'rounded-full border-emerald-200 bg-emerald-50 font-black text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200',
            compact ? 'px-2 text-[11px]' : 'px-2.5 text-[11px]'
          )}
        >
          <CalendarDays className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          {label}
        </Badge>
      ))}
    </div>
  );
}
