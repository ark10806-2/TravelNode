import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Loader2, MapPin, MapPinned, Route } from 'lucide-react';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { Badge } from '@/components/ui/badge';
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import { createHotelMarkerIcon, createPlaceMarkerIcon, getPlaceMapStyles } from '@/lib/google-maps';
import { cn } from '@/lib/utils';
import type { Place } from '@/types/travel';

type DayRouteMapDialogProps = {
  dayLabel: string;
  places: Place[];
  anchorPlace?: Place;
  isDarkMode: boolean;
  onClose: () => void;
};

export function DayRouteMapDialog({ dayLabel, places, anchorPlace, isDarkMode, onClose }: DayRouteMapDialogProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pathRef = useRef<google.maps.Polyline | null>(null);
  const listScrollRef = useRef<HTMLElement | null>(null);
  const listItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const { maps, status, error } = useGoogleMapsLoader(true, '동선 지도를 불러오지 못했습니다.');
  const orderedPlaces = useMemo(() => places.filter(Boolean), [places]);
  const anchorIsScheduled = useMemo(
    () => Boolean(anchorPlace && orderedPlaces.some((place) => place.id === anchorPlace.id)),
    [anchorPlace, orderedPlaces]
  );
  const markerPlaces = useMemo(
    () => (anchorPlace && !anchorIsScheduled ? [anchorPlace, ...orderedPlaces] : orderedPlaces),
    [anchorIsScheduled, anchorPlace, orderedPlaces]
  );
  const pathPlaces = useMemo(
    () => {
      const routePlaces = anchorPlace && orderedPlaces.length ? [anchorPlace, ...orderedPlaces, anchorPlace] : orderedPlaces;
      return routePlaces.filter((place, index) => index === 0 || place.id !== routePlaces[index - 1].id);
    },
    [anchorPlace, orderedPlaces]
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState(orderedPlaces[0]?.id ?? '');
  const [selectionFocusVersion, setSelectionFocusVersion] = useState(0);
  const firstPlace = orderedPlaces[0] ?? null;
  const lastPlace = orderedPlaces[orderedPlaces.length - 1] ?? null;
  const selectedPlace = useMemo(
    () => markerPlaces.find((place) => place.id === selectedPlaceId) ?? orderedPlaces[0] ?? anchorPlace ?? null,
    [anchorPlace, markerPlaces, orderedPlaces, selectedPlaceId]
  );
  const selectedOrderIndex = selectedPlace
    ? orderedPlaces.findIndex((place) => place.id === selectedPlace.id)
    : -1;

  const selectRoutePlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    setSelectionFocusVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!markerPlaces.length) {
      setSelectedPlaceId('');
      return;
    }

    if (!markerPlaces.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId(orderedPlaces[0]?.id ?? markerPlaces[0].id);
    }
  }, [markerPlaces, orderedPlaces, selectedPlaceId]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !maps || mapInstanceRef.current) return;

    mapInstanceRef.current = new maps.Map(mapRef.current, {
      center: orderedPlaces[0]
        ? { lat: orderedPlaces[0].latitude, lng: orderedPlaces[0].longitude }
        : anchorPlace
          ? { lat: anchorPlace.latitude, lng: anchorPlace.longitude }
          : { lat: 35.668862, lng: 139.773098 },
      zoom: 14,
      gestureHandling: 'greedy',
      scrollwheel: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: getPlaceMapStyles(isDarkMode)
    });
  }, [anchorPlace, isDarkMode, maps, orderedPlaces, status]);

  useEffect(() => {
    if (status !== 'ready' || !mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({ styles: getPlaceMapStyles(isDarkMode) });
  }, [isDarkMode, status]);

  useEffect(() => {
    if (status !== 'ready' || !maps || !mapInstanceRef.current) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    pathRef.current?.setMap(null);
    pathRef.current = null;

    const path = pathPlaces.map((place) => ({ lat: place.latitude, lng: place.longitude }));

    markerPlaces.forEach((place, index) => {
      const isSelected = place.id === selectedPlaceId;
      const isAnchor = Boolean(anchorPlace && anchorPlace.id === place.id);
      const orderLabel = orderedPlaces.findIndex((orderedPlace) => orderedPlace.id === place.id) + 1;
      const marker = new maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapInstanceRef.current,
        title: isAnchor ? `숙소. ${place.name}` : `${orderLabel}. ${place.name}`,
        label: isAnchor
          ? undefined
          : {
              text: String(orderLabel),
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '700'
            },
        icon: isAnchor ? createHotelMarkerIcon(maps, isSelected) : createPlaceMarkerIcon(maps, place.category, isSelected),
        zIndex: isAnchor ? 3000 : isSelected ? 2000 : 1000 + index
      });
      marker.addListener('click', () => selectRoutePlace(place.id));
      markersRef.current.push(marker);
    });

    if (path.length > 1) {
      pathRef.current = new maps.Polyline({
        path,
        map: mapInstanceRef.current,
        geodesic: true,
        strokeColor: isDarkMode ? '#ff7a92' : '#ff385c',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        icons: [
          {
            icon: {
              path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              strokeColor: isDarkMode ? '#ff7a92' : '#ff385c',
              strokeOpacity: 0.9
            },
            offset: '50%',
            repeat: '120px'
          }
        ]
      });
    }

  }, [anchorIsScheduled, anchorPlace, isDarkMode, maps, markerPlaces, orderedPlaces, pathPlaces, selectRoutePlace, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !maps || !mapInstanceRef.current) return;
    const bounds = new maps.LatLngBounds();
    const path = pathPlaces.map((place) => {
      const position = { lat: place.latitude, lng: place.longitude };
      bounds.extend(position);
      return position;
    });

    if (path.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, routeMapBoundsPadding());
    } else if (path.length === 1) {
      mapInstanceRef.current.setCenter(path[0]);
      mapInstanceRef.current.setZoom(selectedRouteZoom());
    }
  }, [maps, pathPlaces, status]);

  useEffect(() => {
    if (selectionFocusVersion === 0) return;

    const selectedIndex = orderedPlaces.findIndex((place) => place.id === selectedPlaceId);
    if (status === 'ready' && maps && mapInstanceRef.current && selectedIndex >= 0) {
      const focusPlaces = orderedPlaces.slice(Math.max(0, selectedIndex - 1), Math.min(orderedPlaces.length, selectedIndex + 2));
      if (focusPlaces.length > 1) {
        const bounds = new maps.LatLngBounds();
        focusPlaces.forEach((place) => bounds.extend({ lat: place.latitude, lng: place.longitude }));
        mapInstanceRef.current.fitBounds(bounds, focusedRouteBoundsPadding());
      } else {
        const selectedPlace = focusPlaces[0];
        mapInstanceRef.current.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
        mapInstanceRef.current.setZoom(selectedRouteZoom());
      }
    }

    const listScrollElement = listScrollRef.current;
    if (!listScrollElement || selectedIndex < 0) return;

    const scrollAnchorIndex = Math.max(0, selectedIndex - 1);
    const scrollAnchorPlace = orderedPlaces[scrollAnchorIndex];
    const scrollAnchorElement = listItemRefs.current[scrollAnchorPlace.id];
    if (!scrollAnchorElement) return;

    const scrollRect = listScrollElement.getBoundingClientRect();
    const anchorRect = scrollAnchorElement.getBoundingClientRect();
    const nextScrollTop = listScrollElement.scrollTop + anchorRect.top - scrollRect.top;
    listScrollElement.scrollTo({ top: Math.max(0, nextScrollTop), behavior: 'smooth' });
  }, [maps, markerPlaces, orderedPlaces, selectedPlaceId, selectionFocusVersion, status]);

  return (
    <ModalFrame
      title={`${dayLabel} 동선 지도`}
      maxWidth="max-w-6xl"
      onClose={onClose}
      overlayClassName="bg-foreground/45 backdrop-blur-[2px]"
      panelClassName="rounded-2xl border-border/70 shadow-[0_24px_70px_rgba(0,0,0,0.18)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.5)]"
      headerClassName="border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6"
      eyebrow={
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Badge className="gap-1.5 rounded-full border-transparent bg-primary/10 px-2.5 py-1 text-primary dark:bg-primary/15 dark:text-primary">
            <Route className="h-3.5 w-3.5" />
            {orderedPlaces.length}곳
          </Badge>
          {anchorPlace ? (
            <Badge variant="outline" className="max-w-full gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{anchorPlace.name}</span>
            </Badge>
          ) : null}
        </div>
      }
    >
      <div className="grid h-[calc(94dvh-86px)] min-h-0 gap-0 overflow-hidden bg-secondary/45 lg:h-[592px] lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-h-0 p-2 sm:p-3 lg:h-full lg:p-4 lg:pr-2">
          <div className="relative h-[36dvh] min-h-[260px] overflow-hidden rounded-xl border bg-muted shadow-inner sm:min-h-[340px] lg:h-full lg:min-h-0">
            {status !== 'error' ? (
              <div ref={mapRef} className="h-full min-h-[260px] w-full sm:min-h-[340px] lg:min-h-0" />
            ) : null}
            {status === 'ready' && selectedPlace ? (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                    {selectedOrderIndex >= 0 ? selectedOrderIndex + 1 : 'H'}
                  </span>
                  <span className="truncate font-semibold">{selectedPlace.name}</span>
                </div>
              </div>
            ) : null}
            {status === 'loading' ? (
              <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
                <div className="rounded-full border bg-background px-4 py-3 shadow-sm">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              </div>
            ) : null}
            {status === 'error' ? (
              <div className="grid h-full min-h-[260px] place-items-center p-6 text-center sm:min-h-[340px] lg:min-h-0">
                <div className="max-w-sm rounded-xl border bg-background/85 p-5 shadow-sm backdrop-blur">
                  <MapPinned className="mx-auto h-10 w-10 text-primary" />
                  <p className="mt-3 font-semibold">동선 지도를 표시할 수 없습니다.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside
          ref={listScrollRef}
          className="min-h-0 overflow-y-auto overscroll-contain scroll-smooth border-t bg-background/95 p-3 sm:p-4 lg:border-l lg:border-t-0"
        >
          <div className="-mx-3 -mt-3 border-b bg-background/95 px-3 pb-3 pt-3 backdrop-blur sm:-mx-4 sm:-mt-4 sm:px-4 sm:pt-4 lg:sticky lg:top-0 lg:z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold text-foreground">방문 순서</div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {anchorPlace
                    ? `${anchorPlace.name}에서 출발 · 귀환`
                    : firstPlace
                      ? `${firstPlace.name}부터 시작`
                      : '장소 없음'}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                {orderedPlaces.length}곳
              </Badge>
            </div>
            {firstPlace || lastPlace ? (
              <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border bg-secondary/60 px-3 py-2 text-xs">
                <Home className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  출발 <span className="font-semibold text-foreground">{anchorPlace?.name ?? firstPlace?.name}</span>
                </span>
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  마지막 방문 <span className="font-semibold text-foreground">{lastPlace?.name ?? firstPlace?.name}</span>
                </span>
                {anchorPlace ? (
                  <>
                    <Home className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-muted-foreground">
                      귀환 <span className="font-semibold text-foreground">{anchorPlace.name}</span>
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {orderedPlaces.length ? (
            <ol className="mt-3 grid gap-2.5 sm:mt-4">
              {orderedPlaces.map((place, index) => {
                const isSelected = place.id === selectedPlaceId;

                return (
                  <li
                    key={`${place.id}-${index}`}
                    ref={(element) => {
                      listItemRefs.current[place.id] = element;
                    }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'group grid w-full grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-xl border p-3.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10 ring-1 ring-primary/15'
                          : 'border-transparent bg-secondary/60 hover:border-border hover:bg-secondary'
                      )}
                      onClick={() => selectRoutePlace(place.id)}
                      aria-current={isSelected ? 'step' : undefined}
                    >
                      <span className="relative flex justify-center">
                        {index < orderedPlaces.length - 1 ? (
                          <span className="absolute left-1/2 top-9 h-[calc(100%+0.625rem)] w-px -translate-x-1/2 bg-border/70" />
                        ) : null}
                        <span
                          className={cn(
                            'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground ring-1 ring-border group-hover:text-foreground'
                          )}
                        >
                          {index + 1}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold leading-5">{place.name}</span>
                        <span className="mt-1 block line-clamp-1 text-sm leading-5 text-foreground/70">{place.menu}</span>
                        <span className="mt-2 inline-flex max-w-full rounded-full bg-background/75 px-2 py-1 text-[11px] leading-none text-foreground/70 ring-1 ring-border/70">
                          <span className="truncate">설명: <MarkdownInline text={place.description} /></span>
                        </span>
                        <span className="mt-1 inline-flex max-w-full rounded-full bg-background/75 px-2 py-1 text-[11px] leading-none text-muted-foreground ring-1 ring-border/70">
                          <span className="truncate">메모: <MarkdownInline text={place.googleMapsNote} /></span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-3 rounded-xl border bg-secondary/60 p-4 text-sm text-muted-foreground">
              표시할 장소가 없습니다.
            </div>
          )}
        </aside>
      </div>
    </ModalFrame>
  );
}

function routeMapBoundsPadding() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? 20 : 28;
}

function selectedRouteZoom() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? 17 : 18;
}

function focusedRouteBoundsPadding() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? 48 : 72;
}
