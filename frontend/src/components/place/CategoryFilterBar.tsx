import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CategoryId, CategoryOption } from '@/types/travel';

type CategoryFilterBarProps = {
  categories: CategoryOption[];
  selectedCategoryId: CategoryId;
  isEditing: boolean;
  onSelectCategory: (categoryId: CategoryId) => void;
  onAddCategory: () => void;
  onDeleteCategory: (category: CategoryOption) => void;
};

export function CategoryFilterBar({
  categories,
  selectedCategoryId,
  isEditing,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory
}: CategoryFilterBarProps) {
  return (
    <div className="flex min-w-0 w-[calc(100vw-1.5rem)] max-w-full flex-col gap-2.5 sm:w-full md:flex-row md:items-center md:justify-between">
      <div className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-xl border bg-background p-1 shadow-sm shadow-slate-900/5 [-ms-overflow-style:none] [scrollbar-width:none] dark:shadow-black/20 md:flex-wrap md:gap-2 md:rounded-full [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const isSelected = category.id === selectedCategoryId;

          return (
            <div key={category.id} className="flex shrink-0 items-center rounded-full">
              <Button
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={`h-9 shrink-0 rounded-full px-3 ${isEditing ? 'pr-2' : ''}`}
                onClick={() => onSelectCategory(category.id)}
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.label}
              </Button>
              {isEditing ? (
                <button
                  type="button"
                  className="ml-[-0.35rem] grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onDeleteCategory(category)}
                  aria-label={`${category.label} 카테고리 삭제`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {isEditing ? (
        <Button className="w-full rounded-full md:w-auto" variant="outline" size="sm" onClick={onAddCategory}>
          <Plus className="h-4 w-4" />
          카테고리 추가
        </Button>
      ) : null}
    </div>
  );
}
