import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Images, Plus, Search, X } from 'lucide-react';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { Button } from '@/components/ui/button';
import { getCategoryBadgeClass, getCategoryOption, getEmbedMapUrl, getPlaceInfoUrl } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, PhotoState, Place } from '@/types/travel';

type PlacePickerDialogProps = {
  dayLabel: string;
  categories: CategoryOption[];
  places: Place[];
  excludedPlaceIds: Set<string>;
  maxSelectable: number;
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place, force?: boolean) => Promise<void>;
  onClose: () => void;
  onSelect: (places: Place[]) => void;
};

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};

export function PlacePickerDialog({
  dayLabel,
  categories,
  places,
  excludedPlaceIds,
  maxSelectable,
  photoCache,
  onLoadPhotos,
  onClose,
  onSelect
}: PlacePickerDialogProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('all');
  const [focusedPlaceId, setFocusedPlaceId] = useState<string | null>(null);
  const [sideView, setSideView] = useState<'details' | 'map'>('details');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const availablePlaces = useMemo(() => places.filter((place) => !excludedPlaceIds.has(place.id)), [excludedPlaceIds, places]);
  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availablePlaces
      .filter((place) => categoryId === 'all' || place.category === categoryId)
      .filter((place) => {
        if (!normalizedQuery) return true;
        return [place.name, place.menu, place.description, place.googleMapsNote, place.address, place.cuisine]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePlaces, categoryId, query]);
  const focusedPlace =
    filteredPlaces.find((place) => place.id === focusedPlaceId) ?? filteredPlaces[0] ?? availablePlaces[0] ?? null;
  const focusedPhotoState = focusedPlace ? photoCache[focusedPlace.id] ?? emptyPhotoState : emptyPhotoState;
  const selectedPlaces = useMemo(
    () => selectedPlaceIds.flatMap((placeId) => availablePlaces.find((place) => place.id === placeId) ?? []),
    [availablePlaces, selectedPlaceIds]
  );
  const isSelectionFull = selectedPlaceIds.length >= maxSelectable;

  useEffect(() => {
    if (!focusedPlace) return;
    const state = photoCache[focusedPlace.id];
    if (state?.status === 'loading' || state?.status === 'ready' || state?.status === 'error') return;
    void onLoadPhotos(focusedPlace);
  }, [focusedPlace, onLoadPhotos, photoCache]);

  function togglePlace(place: Place) {
    setFocusedPlaceId(place.id);
    setSelectedPlaceIds((current) => {
      if (current.includes(place.id)) return current.filter((placeId) => placeId !== place.id);

      if (current.length >= maxSelectable) return current;
      return [...current, place.id];
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-foreground/40 p-2 lg:items-center lg:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[calc(100dvh-1rem)] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-md border bg-background shadow-xl sm:h-[90vh]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 border-b px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div>
            <p className="text-sm font-semibold text-primary">{dayLabel}</p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">장소 추가</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">최대 {maxSelectable}개까지 한 번에 선택할 수 있습니다.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="shrink-0 grid gap-3 border-b bg-muted/30 p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="장소명, 대표 항목, 설명으로 검색"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
            <Button className="shrink-0 rounded-full" variant={categoryId === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryId('all')}>
              전체
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                className="shrink-0 rounded-full"
                variant={categoryId === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryId(category.id)}
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
          <div className="min-h-0 p-3 sm:p-4 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            {filteredPlaces.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {filteredPlaces.map((place) => {
                  const category = getCategoryOption(categories, place.category);
                  const photoState = photoCache[place.id] ?? emptyPhotoState;
                  const photo = photoState.photos[0] ?? null;
                  const isFocused = focusedPlace?.id === place.id;
                  const isSelected = selectedPlaceIds.includes(place.id);
                  const isDisabled = !isSelected && isSelectionFull;

                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={`rounded-xl border bg-background p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:rounded-md sm:p-4 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : isFocused
                            ? 'border-primary/70'
                            : 'hover:border-primary hover:bg-muted/30'
                      } ${isDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                      disabled={isDisabled}
                      onMouseEnter={() => setFocusedPlaceId(place.id)}
                      onFocus={() => setFocusedPlaceId(place.id)}
                      onClick={() => togglePlace(place)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted sm:h-24 sm:w-24">
                          {photo ? (
                            <img
                              src={photo.url}
                              alt={`${place.name} 대표 사진`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-secondary">
                              <Images className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          {photoState.status === 'loading' ? <div className="absolute inset-0 animate-pulse bg-background/45" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`mb-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(
                              place.category
                            )}`}
                          >
                            {category.emoji} {category.label}
                          </div>
                          <div className="line-clamp-2 text-base font-bold leading-snug">{place.name}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{place.menu}</div>
                          <div className="mt-2 line-clamp-3 text-sm leading-5 text-foreground/80">
                            설명: <MarkdownInline text={place.description} />
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                            메모: <MarkdownInline text={place.googleMapsNote} />
                          </div>
                        </div>
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'border bg-background text-muted-foreground'
                          }`}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                        <div className="truncate">{place.address}</div>
                        <div>{place.distanceLabel}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                추가할 수 있는 장소가 없습니다.
              </div>
            )}
          </div>

          <aside className="order-first shrink-0 border-b bg-muted/25 p-3 sm:p-4 lg:order-none lg:border-b-0 lg:border-l">
            <div className="sticky top-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-full border bg-background p-1">
                <Button
                  type="button"
                  className="rounded-full"
                  variant={sideView === 'details' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSideView('details')}
                >
                  세부사항
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  variant={sideView === 'map' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSideView('map')}
                >
                  지도
                </Button>
              </div>

              {sideView === 'details' ? (
                focusedPlace ? (
                  <PlacePickerDetails
                    place={focusedPlace}
                    category={getCategoryOption(categories, focusedPlace.category)}
                    photoState={focusedPhotoState}
                  />
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-md border bg-background p-6 text-center text-sm text-muted-foreground">
                    세부사항을 볼 장소가 없습니다.
                  </div>
                )
              ) : (
                <div className="overflow-hidden rounded-md border bg-background">
                  {focusedPlace ? (
                    <iframe
                      className="pointer-events-none h-56 w-full border-0 sm:h-72 lg:pointer-events-auto lg:h-[520px]"
                      src={getEmbedMapUrl(focusedPlace)}
                      title={`${focusedPlace.name} 지도`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="grid h-56 place-items-center text-sm text-muted-foreground sm:h-72 lg:h-[520px]">
                      지도에 표시할 장소가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="shrink-0 flex flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            선택 {selectedPlaces.length}개 / 남은 자리 {maxSelectable}개
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button className="rounded-full" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button className="rounded-full" onClick={() => onSelect(selectedPlaces)} disabled={!selectedPlaces.length}>
              <Plus className="h-4 w-4" />
              선택한 장소 추가
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlacePickerDetails({
  place,
  category,
  photoState
}: {
  place: Place;
  category: CategoryOption;
  photoState: PhotoState;
}) {
  const primaryPhoto = photoState.photos[0] ?? null;
  const extraPhotos = photoState.photos.slice(1, 4);

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="relative h-48 bg-muted sm:h-60 lg:h-72">
        {primaryPhoto ? (
          <img
            src={primaryPhoto.url}
            alt={`${place.name} 대표 사진`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-secondary">
            <div className="text-center text-sm text-muted-foreground">
              <Images className="mx-auto h-8 w-8" />
              <div className="mt-2">{photoState.status === 'loading' ? '사진을 불러오는 중입니다.' : '사진이 없습니다.'}</div>
            </div>
          </div>
        )}
        {photoState.status === 'loading' ? <div className="absolute inset-0 animate-pulse bg-background/40" /> : null}
      </div>

      {extraPhotos.length ? (
        <div className="grid grid-cols-3 gap-1 border-t bg-muted/40 p-1">
          {extraPhotos.map((photo, index) => (
            <img
              key={photo.url}
              src={photo.url}
              alt={`${place.name} 추가 사진 ${index + 1}`}
              className="h-20 w-full rounded object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 p-3">
        <div>
          <div className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(place.category)}`}>
            {category.emoji} {category.label}
          </div>
          <h3 className="mt-2 text-lg font-bold leading-snug">{place.name}</h3>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{place.address}</div>
        </div>

        <div className="grid gap-2 text-sm leading-6">
          {place.menu ? (
            <div>
              <div className="text-xs font-bold text-muted-foreground">대표 항목</div>
              <div className="text-foreground">{place.menu}</div>
            </div>
          ) : null}
          {place.description ? (
            <div>
              <div className="text-xs font-bold text-muted-foreground">설명</div>
              <div className="text-foreground/85">
                <MarkdownInline text={place.description} />
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-xs font-bold text-muted-foreground">메모</div>
            <div className="text-muted-foreground">
              <MarkdownInline text={place.googleMapsNote} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="rounded-lg bg-muted/40 p-2">
              <div className="font-bold text-foreground">거리</div>
              <div className="mt-1">{place.distanceLabel}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <div className="font-bold text-foreground">분류</div>
              <div className="mt-1">{place.cuisine}</div>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="rounded-full">
          <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
            Google Maps
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
