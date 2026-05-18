import { useEffect } from 'react';
import { Images, LayoutGrid, Loader2, MapPin, Plus, Table2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { travelLabel } from '@/constants/travel';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PlaceGallery } from './PlaceGallery';

export type PlaceListViewMode = 'table' | 'gallery';

type PlaceTableProps = {
  title: string;
  places: NearbyPlace[];
  viewMode: PlaceListViewMode;
  onViewModeChange: (viewMode: PlaceListViewMode) => void;
  isEditing: boolean;
  categories: CategoryOption[];
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place) => Promise<void>;
  onSelect: (place: Place) => void;
  onAdd: () => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
  deletingId: string | null;
  movingCategoryPlaceId: string | null;
  onOpenPhotos: (place: Place) => void;
};

export function PlaceTable({
  title,
  places,
  viewMode,
  onViewModeChange,
  isEditing,
  categories,
  photoCache,
  onLoadPhotos,
  onSelect,
  onAdd,
  onDelete,
  onMoveCategory,
  deletingId,
  movingCategoryPlaceId,
  onOpenPhotos
}: PlaceTableProps) {
  useEffect(() => {
    places.forEach((place) => {
      void onLoadPhotos(place);
    });
  }, [onLoadPhotos, places]);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-base font-bold tracking-tight sm:text-xl">{title}</h2>
          <Badge variant="outline" className="rounded-full">{places.length}곳</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
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
          {isEditing ? (
            <Button className="flex-1 rounded-full sm:flex-none" variant="outline" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              추가
            </Button>
          ) : null}
        </div>
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
        <>
          <div className="grid gap-2 md:hidden">
            {places.map((place) => (
              <MobilePlaceCard
                key={place.id}
                place={place}
                photoState={photoCache[place.id]}
                isEditing={isEditing}
                isDeleting={deletingId === place.id}
                isMovingCategory={movingCategoryPlaceId === place.id}
                categories={categories}
                onSelect={onSelect}
                onOpenPhotos={onOpenPhotos}
                onDelete={onDelete}
                onMoveCategory={onMoveCategory}
              />
            ))}
            {!places.length ? (
              <div className="soft-panel grid min-h-28 place-items-center rounded-lg p-5 text-center text-sm text-muted-foreground">
                가까운 후보가 없습니다.
              </div>
            ) : null}
          </div>

          <div className="soft-panel hidden overflow-hidden rounded-lg md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">거리</TableHead>
                  <TableHead>장소명</TableHead>
                  <TableHead>대표 항목</TableHead>
                  <TableHead className="hidden md:table-cell">설명</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {places.map((place) => {
                  const isDeleting = deletingId === place.id;
                  const isMovingCategory = movingCategoryPlaceId === place.id;
                  const isBusy = isDeleting || isMovingCategory;

                  return (
                    <TableRow key={place.id}>
                      <TableCell>{place.distanceFromSelectedKm.toFixed(1)}km</TableCell>
                      <TableCell>
                        <div className="font-semibold">{place.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {travelLabel[place.travelMode]} {place.travelMinutes}분
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[13rem]">{place.menu}</TableCell>
                      <TableCell className="hidden max-w-sm text-muted-foreground md:table-cell">{place.description}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onSelect(place)} disabled={isBusy}>
                            선택
                          </Button>
                          <PlaceThumbnail
                            place={place}
                            photoState={photoCache[place.id]}
                            sizeClassName="h-10 w-10"
                            onOpenPhotos={onOpenPhotos}
                            disabled={isBusy}
                          />
                          {isEditing ? (
                            <>
                              <CategoryMoveSelect
                                place={place}
                                categories={categories}
                                disabled={isBusy}
                                onMove={onMoveCategory}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onDelete(place)}
                                disabled={isBusy}
                                aria-label={`${place.name} 삭제`}
                              >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!places.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      가까운 후보가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

function MobilePlaceCard({
  place,
  photoState,
  isEditing,
  isDeleting,
  isMovingCategory,
  categories,
  onSelect,
  onOpenPhotos,
  onDelete,
  onMoveCategory
}: {
  place: NearbyPlace;
  photoState?: PhotoState;
  isEditing: boolean;
  isDeleting: boolean;
  isMovingCategory: boolean;
  categories: CategoryOption[];
  onSelect: (place: Place) => void;
  onOpenPhotos: (place: Place) => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
}) {
  const isBusy = isDeleting || isMovingCategory;

  return (
    <article className="soft-panel rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{place.distanceFromSelectedKm.toFixed(1)}km</span>
            <span aria-hidden="true">·</span>
            <span>
              {travelLabel[place.travelMode]} {place.travelMinutes}분
            </span>
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug">{place.name}</h3>
        </div>
        <PlaceThumbnail
          place={place}
          photoState={photoState}
          sizeClassName="h-14 w-14"
          onOpenPhotos={onOpenPhotos}
          disabled={isBusy}
        />
      </div>

      <div className="mt-3 rounded-lg bg-secondary/70 p-2.5">
        <div className="text-[11px] font-semibold text-muted-foreground">대표 항목</div>
        <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{place.menu}</div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{place.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <div className="grid min-w-0 flex-1 gap-2">
          <Button className="min-w-0 rounded-full" variant="outline" size="sm" onClick={() => onSelect(place)} disabled={isBusy}>
            선택
          </Button>
          {isEditing ? (
            <CategoryMoveSelect
              place={place}
              categories={categories}
              disabled={isBusy}
              className="min-w-0 rounded-full"
              onMove={onMoveCategory}
            />
          ) : null}
        </div>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(place)}
            disabled={isBusy}
            aria-label={`${place.name} 삭제`}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function PlaceThumbnail({
  place,
  photoState,
  sizeClassName,
  onOpenPhotos,
  disabled
}: {
  place: Place;
  photoState?: PhotoState;
  sizeClassName: string;
  onOpenPhotos: (place: Place) => void;
  disabled: boolean;
}) {
  const photo = photoState?.photos[0] ?? null;
  const isLoading = photoState?.status === 'loading';

  return (
    <button
      type="button"
      className={`${sizeClassName} group relative shrink-0 overflow-hidden rounded-md border bg-muted transition hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50`}
      onClick={() => onOpenPhotos(place)}
      disabled={disabled}
      aria-label={`${place.name} 사진 보기`}
    >
      {photo ? (
        <img
          src={photo.url}
          alt={`${place.name} 대표 사진`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-secondary">
          <Images className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {isLoading ? <div className="absolute inset-0 animate-pulse bg-background/45" /> : null}
    </button>
  );
}
