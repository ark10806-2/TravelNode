import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPinned } from 'lucide-react';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { Badge } from '@/components/ui/badge';
import { googleMapsApiKey } from '@/config/env';
import { createPlaceMarkerIcon, describeError, getPlaceMapStyles, loadGoogleMaps } from '@/lib/google-maps';
import { getGoogleMapsNoteLabel } from '@/lib/place-utils';
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(googleMapsApiKey ? 'loading' : 'error');
  const [error, setError] = useState(googleMapsApiKey ? '' : 'Google Maps API 키가 필요합니다.');
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
    if (!mapRef.current || !googleMapsApiKey) return;

    let cancelled = false;
    setStatus('loading');
    setError('');

    loadGoogleMaps(googleMapsApiKey)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

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
  }, [anchorPlace, isDarkMode, orderedPlaces]);

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

    const bounds = new maps.LatLngBounds();
    const path = pathPlaces.map((place) => {
      const position = { lat: place.latitude, lng: place.longitude };
      bounds.extend(position);
      return position;
    });

    markerPlaces.forEach((place, index) => {
      const isSelected = place.id === selectedPlaceId;
      const isAnchor = Boolean(anchorPlace && !anchorIsScheduled && anchorPlace.id === place.id);
      const orderLabel = orderedPlaces.findIndex((orderedPlace) => orderedPlace.id === place.id) + 1;
      const marker = new maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapInstanceRef.current,
        title: isAnchor ? `숙소. ${place.name}` : `${orderLabel}. ${place.name}`,
        label: {
          text: isAnchor ? 'H' : String(orderLabel),
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '700'
        },
        icon: createPlaceMarkerIcon(maps, place.category, isSelected),
        zIndex: isSelected ? 2000 : 1000 + index
      });
      marker.addListener('click', () => setSelectedPlaceId(place.id));
      markersRef.current.push(marker);
    });

    if (path.length > 1) {
      pathRef.current = new maps.Polyline({
        path,
        map: mapInstanceRef.current,
        geodesic: true,
        strokeColor: isDarkMode ? '#f28b82' : '#e07062',
        strokeOpacity: 0.88,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              strokeColor: isDarkMode ? '#f28b82' : '#e07062',
              strokeOpacity: 0.9
            },
            offset: '50%',
            repeat: '120px'
          }
        ]
      });
    }

    if (path.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, routeMapBoundsPadding());
    } else if (path.length === 1) {
      mapInstanceRef.current.setCenter(path[0]);
      mapInstanceRef.current.setZoom(16);
    }
  }, [anchorIsScheduled, anchorPlace, isDarkMode, markerPlaces, orderedPlaces, pathPlaces, selectedPlaceId, status]);

  return (
    <ModalFrame
      title={`${dayLabel} 동선 지도`}
      maxWidth="max-w-6xl"
      onClose={onClose}
      eyebrow={<Badge variant="outline">{orderedPlaces.length}곳</Badge>}
    >
      <div className="grid max-h-[calc(94vh-76px)] min-h-0 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative min-h-[320px] bg-muted sm:min-h-[360px] lg:min-h-[540px]">
          {status !== 'error' ? <div ref={mapRef} className="h-full min-h-[320px] w-full sm:min-h-[360px] lg:min-h-[540px]" /> : null}
          {status === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center bg-background/80">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="grid h-full min-h-[320px] place-items-center p-6 text-center sm:min-h-[360px] lg:min-h-[540px]">
              <div>
                <MapPinned className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-semibold">동선 지도를 표시할 수 없습니다.</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="max-h-[52vh] overflow-y-auto border-t bg-background p-4 sm:p-5 lg:max-h-[540px] lg:border-l lg:border-t-0">
          <div className="mb-4 text-base font-semibold text-foreground">방문 순서</div>
          {orderedPlaces.length ? (
            <ol className="grid gap-3.5">
              {orderedPlaces.map((place, index) => {
                const isSelected = place.id === selectedPlaceId;

                return (
                  <li key={`${place.id}-${index}`}>
                    <button
                      type="button"
                      className={`flex w-full gap-3 rounded-md border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10 shadow-sm'
                          : 'border-border bg-muted/20 hover:bg-muted/35'
                      }`}
                      onClick={() => setSelectedPlaceId(place.id)}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">{place.name}</span>
                        <span className="mt-1.5 block line-clamp-2 text-sm leading-5 text-muted-foreground">{place.menu}</span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                          메모: {getGoogleMapsNoteLabel(place)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
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
