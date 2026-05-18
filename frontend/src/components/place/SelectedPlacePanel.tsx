import { ExternalLink, Navigation, Pencil, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import { getCategoryBadgeClass, getCategoryOption, getPlaceInfoUrl } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PhotoBundlePreview } from './PhotoBundlePreview';

type SelectedPlacePanelProps = {
  place: Place | null;
  categories: CategoryOption[];
  photoState: PhotoState;
  isEditing: boolean;
  movingCategoryPlaceId: string | null;
  onEditPlace: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
  onOpenPhotos: (place: Place) => void;
};

export function SelectedPlacePanel({
  place,
  categories,
  photoState,
  isEditing,
  movingCategoryPlaceId,
  onEditPlace,
  onMoveCategory,
  onOpenPhotos
}: SelectedPlacePanelProps) {
  if (!place) {
    return (
      <aside className="soft-panel rounded-lg p-5">
        <p className="text-sm text-muted-foreground">표시할 장소가 없습니다.</p>
      </aside>
    );
  }

  const category = getCategoryOption(categories, place.category);
  const isMovingCategory = movingCategoryPlaceId === place.id;

  return (
    <aside className="soft-panel rounded-xl p-3.5 sm:rounded-lg sm:p-5">
      <div className="flex h-full flex-col gap-3.5 sm:gap-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <Badge variant="outline" className={`rounded-full ${getCategoryBadgeClass(place.category)}`}>
              {category.emoji} {category.label}
            </Badge>
            <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-snug tracking-tight sm:mt-3 sm:text-2xl">{place.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <CategoryMoveSelect
                place={place}
                categories={categories}
                disabled={isMovingCategory}
                className="hidden min-w-28 sm:flex"
                onMove={onMoveCategory}
              />
            ) : null}
            {isEditing ? (
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={() => onEditPlace(place)}>
                <Pencil className="h-4 w-4" />
                수정
              </Button>
            ) : null}
            <Utensils className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        {isEditing ? (
          <CategoryMoveSelect
            place={place}
            categories={categories}
            disabled={isMovingCategory}
            className="sm:hidden"
            onMove={onMoveCategory}
          />
        ) : null}
        <div className="grid gap-2.5 text-sm sm:gap-3">
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs font-semibold text-muted-foreground">대표 항목</div>
            <div className="mt-1 font-semibold leading-6">{place.menu}</div>
          </div>
          <PhotoBundlePreview place={place} photoState={photoState} onOpen={onOpenPhotos} />
          <div>
            <div className="text-xs font-semibold text-muted-foreground">숙소 기준 이동</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Navigation className="h-4 w-4" />
              {place.distanceLabel} · {travelLabel[place.travelMode]} {place.travelMinutes}분
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">설명</div>
            <div className="leading-6 text-muted-foreground">{place.description}</div>
          </div>
        </div>
        <Button asChild className="mt-auto">
          <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
            구글 맵에서 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </aside>
  );
}
