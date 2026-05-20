import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Images, Loader2, MapPin, MapPinned, Plus, Route, Search, X } from 'lucide-react';
import { recordApiUsage } from '@/api/usage';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { Button } from '@/components/ui/button';
import { googleMapsApiKey } from '@/config/env';
import { createPlaceMarkerIcon, describeError, getPlaceMapStyles, loadGoogleMaps } from '@/lib/google-maps';
import { getCategoryBadgeClass, getCategoryOption, getPlaceInfoUrl } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { CategoryId, CategoryOption, PhotoState, Place } from '@/types/travel';

type PlacePickerDialogProps = {
  dayLabel: string;
  categories: CategoryOption[];
  places: Place[];
  scheduledPlaces: Place[];
  anchorPlace: Place;
  excludedPlaceIds: Set<string>;
  maxSelectable: number;
  photoCache: Record<string, PhotoState>;
  isDarkMode: boolean;
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
  scheduledPlaces,
  anchorPlace,
  excludedPlaceIds,
  maxSelectable,
  photoCache,
  isDarkMode,
  onLoadPhotos,
  onClose,
  onSelect
}: PlacePickerDialogProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('all');
  const [focusedPlaceId, setFocusedPlaceId] = useState<string | null>(null);
  const [sideView, setSideView] = useState<'route' | 'details'>('route');
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
                  variant={sideView === 'route' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSideView('route')}
                >
                  동선
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  variant={sideView === 'details' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSideView('details')}
                >
                  세부사항
                </Button>
              </div>

              {sideView === 'route' ? (
                <PlacePickerRoutePreview
                  dayLabel={dayLabel}
                  anchorPlace={anchorPlace}
                  scheduledPlaces={scheduledPlaces}
                  selectedPlaces={selectedPlaces}
                  focusedPlaceId={focusedPlaceId}
                  isDarkMode={isDarkMode}
                  onFocusPlace={setFocusedPlaceId}
                />
              ) : (
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

function PlacePickerRoutePreview({
  dayLabel,
  anchorPlace,
  scheduledPlaces,
  selectedPlaces,
  focusedPlaceId,
  isDarkMode,
  onFocusPlace
}: {
  dayLabel: string;
  anchorPlace: Place;
  scheduledPlaces: Place[];
  selectedPlaces: Place[];
  focusedPlaceId: string | null;
  isDarkMode: boolean;
  onFocusPlace: (placeId: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pathRef = useRef<google.maps.Polyline | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(googleMapsApiKey ? 'loading' : 'error');
  const [error, setError] = useState(googleMapsApiKey ? '' : 'Google Maps API 키가 필요합니다.');
  const routePlaces = useMemo(() => [...scheduledPlaces, ...selectedPlaces], [scheduledPlaces, selectedPlaces]);
  const markerPlaces = useMemo(() => uniquePlaces([anchorPlace, ...routePlaces]), [anchorPlace, routePlaces]);
  const pathPlaces = useMemo(() => {
    const places = routePlaces.length ? [anchorPlace, ...routePlaces, anchorPlace] : [anchorPlace];
    return places.filter((place, index) => index === 0 || place.id !== places[index - 1].id);
  }, [anchorPlace, routePlaces]);
  const focusedPlace = markerPlaces.find((place) => place.id === focusedPlaceId) ?? routePlaces[0] ?? anchorPlace;

  useEffect(() => {
    if (!mapRef.current || !googleMapsApiKey) return;

    let cancelled = false;
    setStatus('loading');
    setError('');

    loadGoogleMaps(googleMapsApiKey)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

        mapInstanceRef.current = new maps.Map(mapRef.current, {
          center: { lat: anchorPlace.latitude, lng: anchorPlace.longitude },
          zoom: 14,
          gestureHandling: 'greedy',
          scrollwheel: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: getPlaceMapStyles(isDarkMode)
        });
        void recordApiUsage('maps-js').catch(() => undefined);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setStatus('error');
        setError(`지도를 불러오지 못했습니다. 원인: ${describeError(loadError)}.`);
      });

    return () => {
      cancelled = true;
    };
  }, [anchorPlace.latitude, anchorPlace.longitude, isDarkMode]);

  useEffect(() => {
    if (status !== 'ready' || !mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({ styles: getPlaceMapStyles(isDarkMode) });
  }, [isDarkMode, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.google?.maps || !mapInstanceRef.current) return;

    const maps = window.google.maps;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    pathRef.current?.setMap(null);
    pathRef.current = null;

    markerPlaces.forEach((place, index) => {
      const isAnchor = place.id === anchorPlace.id;
      const routeIndex = routePlaces.findIndex((routePlace) => routePlace.id === place.id);
      const isSelected = place.id === focusedPlace.id;
      const marker = new maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapInstanceRef.current,
        title: isAnchor ? `숙소. ${place.name}` : `${routeIndex + 1}. ${place.name}`,
        label: {
          text: isAnchor ? 'H' : String(routeIndex + 1),
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '700'
        },
        icon: createPlaceMarkerIcon(maps, place.category, isSelected),
        zIndex: isSelected ? 2000 : 1000 + index
      });
      marker.addListener('click', () => onFocusPlace(place.id));
      markersRef.current.push(marker);
    });

    if (pathPlaces.length > 1) {
      pathRef.current = new maps.Polyline({
        path: pathPlaces.map((place) => ({ lat: place.latitude, lng: place.longitude })),
        map: mapInstanceRef.current,
        geodesic: true,
        strokeColor: isDarkMode ? '#ff7a92' : '#ff385c',
        strokeOpacity: 0.86,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 2.6,
              strokeColor: isDarkMode ? '#ff7a92' : '#ff385c',
              strokeOpacity: 0.86
            },
            offset: '50%',
            repeat: '110px'
          }
        ]
      });
    }
  }, [anchorPlace, focusedPlace.id, isDarkMode, markerPlaces, onFocusPlace, pathPlaces, routePlaces, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.google?.maps || !mapInstanceRef.current) return;

    const maps = window.google.maps;
    const bounds = new maps.LatLngBounds();
    pathPlaces.forEach((place) => bounds.extend({ lat: place.latitude, lng: place.longitude }));

    if (pathPlaces.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, routePreviewBoundsPadding());
    } else {
      mapInstanceRef.current.setCenter({ lat: anchorPlace.latitude, lng: anchorPlace.longitude });
      mapInstanceRef.current.setZoom(15);
    }
  }, [anchorPlace.latitude, anchorPlace.longitude, pathPlaces, status]);

  return (
    <div className="grid gap-3">
      <section className="overflow-hidden rounded-md border bg-background">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <Route className="h-4 w-4 text-primary" />
              동선 미리보기
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{dayLabel} 기존 동선 + 추가 예정 장소</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
            {routePlaces.length}곳
          </span>
        </div>
        <div className="relative h-60 bg-muted sm:h-72 lg:h-72">
          {status !== 'error' ? <div ref={mapRef} className="h-full w-full" /> : null}
          {status === 'ready' ? (
            <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                  {focusedPlace.id === anchorPlace.id ? 'H' : routePlaces.findIndex((place) => place.id === focusedPlace.id) + 1}
                </span>
                <span className="truncate font-semibold">{focusedPlace.name}</span>
              </div>
            </div>
          ) : null}
          {status === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="grid h-full place-items-center p-5 text-center text-sm text-muted-foreground">
              <div>
                <MapPinned className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-2 font-semibold text-foreground">동선 지도를 표시할 수 없습니다.</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <RoutePreviewList
        title="기존 동선"
        emptyText="아직 DAY에 담긴 장소가 없습니다."
        places={scheduledPlaces}
        offset={0}
        focusedPlaceId={focusedPlace.id}
        tone="existing"
        onFocusPlace={onFocusPlace}
      />
      <RoutePreviewList
        title="추가 예정"
        emptyText="왼쪽 목록에서 장소를 클릭하면 여기에 추가됩니다."
        places={selectedPlaces}
        offset={scheduledPlaces.length}
        focusedPlaceId={focusedPlace.id}
        tone="added"
        onFocusPlace={onFocusPlace}
      />
    </div>
  );
}

function RoutePreviewList({
  title,
  emptyText,
  places,
  offset,
  focusedPlaceId,
  tone,
  onFocusPlace
}: {
  title: string;
  emptyText: string;
  places: Place[];
  offset: number;
  focusedPlaceId: string;
  tone: 'existing' | 'added';
  onFocusPlace: (placeId: string) => void;
}) {
  return (
    <section className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold">{title}</div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{places.length}</span>
      </div>
      {places.length ? (
        <ol className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto pr-1">
          {places.map((place, index) => {
            const isFocused = place.id === focusedPlaceId;
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className={cn(
                    'grid w-full grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isFocused ? 'border-primary/50 bg-primary/10' : 'border-transparent bg-secondary/40 hover:bg-secondary',
                    tone === 'added' && !isFocused && 'bg-primary/5 hover:bg-primary/10'
                  )}
                  onClick={() => onFocusPlace(place.id)}
                >
                  <span className={cn(
                    'grid h-6 w-6 place-items-center rounded-full text-xs font-bold',
                    tone === 'added' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground ring-1 ring-border'
                  )}>
                    {offset + index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{place.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{place.menu}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground">{emptyText}</div>
      )}
    </section>
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

function uniquePlaces(places: Place[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

function routePreviewBoundsPadding() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? 24 : 36;
}
