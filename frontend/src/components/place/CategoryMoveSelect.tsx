import { FolderInput, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CategoryId, CategoryOption, Place } from '@/types/travel';

type CategoryMoveSelectProps = {
  place: Place;
  categories: CategoryOption[];
  disabled?: boolean;
  className?: string;
  onMove: (place: Place, categoryId: CategoryId) => void;
};

export function CategoryMoveSelect({
  place,
  categories,
  disabled = false,
  className,
  onMove
}: CategoryMoveSelectProps) {
  const targetCategories = categories.filter((category) => category.id !== place.category);
  if (targetCategories.length === 0) return null;

  return (
    <Select
      key={`${place.id}-${place.category}`}
      onValueChange={(categoryId) => onMove(place, categoryId)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('h-9 min-w-28 rounded-full px-3 text-xs font-semibold', className)}>
        <span className="flex min-w-0 items-center gap-1.5">
          {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
          <SelectValue placeholder="이동" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {targetCategories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.emoji} {category.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
