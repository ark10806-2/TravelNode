import { useEffect, useState } from 'react';
import { LayoutGrid, Plus, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategoryOption } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { PlaceExpandableRow } from './PlaceExpandableRow';
import { PlaceGallery } from './PlaceGallery';

export type PlaceListViewMode = 'table' | 'gallery';

type PlaceTableProps = {
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

export function PlaceTable({
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
}: PlaceTableProps) {
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
    <section className="min-w-0">
      <div className="mb-3 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-base font-bold tracking-tight sm:text-xl">{title}</h2>
          <Badge variant="outline" className="rounded-full">{places.length}곳</Badge>
        </div>
        {showViewModeToggle || isEditing ? (
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {showViewModeToggle ? (
              <div className="grid flex-1 grid-cols-2 overflow-hidden rounded-full border bg-secondary p-1 sm:flex-none">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => onViewModeChange('table')}
                >
                  <Table2 className="h-4 w-4" />
                  테이블
                </Button>
                <Button
                  variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => onViewModeChange('gallery')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  갤러리
                </Button>
              </div>
            ) : null}
            {isEditing ? (
              <Button className="flex-1 rounded-full sm:flex-none" variant="outline" size="sm" onClick={onAdd}>
                <Plus className="h-4 w-4" />
                추가
              </Button>
            ) : null}
          </div>
          ) : null}
      </div>
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
