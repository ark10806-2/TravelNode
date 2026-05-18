import { useEffect, useState } from 'react';
import { LayoutGrid, Plus, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategoryOption } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { PlaceExpandableRow } from './PlaceExpandableRow';
import { PlaceGallery } from './PlaceGallery';

export type PlaceListViewMode = 'table' | 'gallery';

type PlaceListProps = {
  title: string;
  places: NearbyPlace[];
  viewMode: PlaceListViewMode;
  onViewModeChange: (viewMode: PlaceListViewMode) => void;
  showViewModeToggle?: boolean;
  isEditing: boolean;
  categories: CategoryOption[];
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place) => Promise<void>;
  onAdd: () => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
  deletingId: string | null;
  movingCategoryPlaceId: string | null;
  onOpenPhotos: (place: Place) => void;
};

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};

export function PlaceList({
  title,
  places,
  viewMode,
  onViewModeChange,
  showViewModeToggle = true,
  isEditing,
  categories,
  photoCache,
  onLoadPhotos,
  onAdd,
  onDelete,
  onMoveCategory,
  deletingId,
  movingCategoryPlaceId,
  onOpenPhotos
}: PlaceListProps) {
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    places.forEach((place) => {
      void onLoadPhotos(place);
    });
  }, [onLoadPhotos, places]);

  useEffect(() => {
    if (!expandedPlaceId) return;
    if (!places.some((place) => place.id === expandedPlaceId)) setExpandedPlaceId(null);
  }, [expandedPlaceId, places]);

  function togglePlace(place: NearbyPlace) {
    setExpandedPlaceId((current) => (current === place.id ? null : place.id));
  }

  return (
    <section className="min-w-0 w-[calc(100vw-1.5rem)] max-w-full overflow-hidden sm:w-full">
      <PlaceListHeader
        title={title}
        count={places.length}
        viewMode={viewMode}
        showViewModeToggle={showViewModeToggle}
        isEditing={isEditing}
        onViewModeChange={onViewModeChange}
        onAdd={onAdd}
      />
      {viewMode === 'gallery' ? (
        <PlaceGallery
          places={places}
          photoCache={photoCache}
          onLoadPhotos={onLoadPhotos}
          onOpenPhotos={onOpenPhotos}
          isEditing={isEditing}
          categories={categories}
          movingCategoryPlaceId={movingCategoryPlaceId}
          onMoveCategory={onMoveCategory}
        />
      ) : (
        <div className="soft-panel overflow-hidden rounded-xl">
          {places.length ? (
            <>
              <div className="hidden grid-cols-[3.25rem_minmax(11rem,1.05fr)_minmax(9rem,0.9fr)_minmax(12rem,1.35fr)_2.5rem] gap-3 border-b bg-secondary/80 px-4 py-2 text-xs font-semibold text-muted-foreground sm:grid">
                <div>사진</div>
                <div>장소</div>
                <div>대표 항목</div>
                <div>요약</div>
                <div />
              </div>
              {places.map((place, index) => (
                <PlaceExpandableRow
                  key={place.id}
                  place={place}
                  category={getCategoryOption(categories, place.category)}
                  photoState={photoCache[place.id] ?? emptyPhotoState}
                  isExpanded={expandedPlaceId === place.id}
                  isEditing={isEditing}
                  isDeleting={deletingId === place.id}
                  isMovingCategory={movingCategoryPlaceId === place.id}
                  categories={categories}
                  hasDivider={index > 0}
                  onToggle={togglePlace}
                  onOpenPhotos={onOpenPhotos}
                  onDelete={onDelete}
                  onMoveCategory={onMoveCategory}
                />
              ))}
            </>
          ) : (
            <div className="grid min-h-28 place-items-center rounded-lg p-5 text-center text-sm text-muted-foreground">
              가까운 후보가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type PlaceListHeaderProps = {
  title: string;
  count: number;
  viewMode: PlaceListViewMode;
  showViewModeToggle: boolean;
  isEditing: boolean;
  onViewModeChange: (viewMode: PlaceListViewMode) => void;
  onAdd: () => void;
};

function PlaceListHeader({
  title,
  count,
  viewMode,
  showViewModeToggle,
  isEditing,
  onViewModeChange,
  onAdd
}: PlaceListHeaderProps) {
  const showActions = showViewModeToggle || isEditing;

  return (
    <div className="mb-3 flex min-w-0 w-full flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-base font-bold tracking-tight sm:text-xl">{title}</h2>
        <Badge variant="outline" className="rounded-full">
          {count}곳
        </Badge>
      </div>

      {showActions ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-nowrap">
          {showViewModeToggle ? (
            <div className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-full border bg-secondary p-1 sm:w-56">
              <button
                type="button"
                className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                  viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-foreground hover:bg-background/60'
                }`}
                onClick={() => onViewModeChange('table')}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">테이블</span>
              </button>
              <button
                type="button"
                className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                  viewMode === 'gallery' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-foreground hover:bg-background/60'
                }`}
                onClick={() => onViewModeChange('gallery')}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">갤러리</span>
              </button>
            </div>
          ) : null}

          {isEditing ? (
            <Button className="w-full rounded-full sm:w-auto" variant="outline" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              추가
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
