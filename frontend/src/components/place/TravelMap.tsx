import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { googleMapsApiKey } from '@/config/env';
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import {
  createDirectionalDottedRouteOptions,
  createHotelMarkerIcon,
  createPlaceMarkerIcon,
  createScheduleDotMarkerIcon,
  getPlaceMapStyles
} from '@/lib/google-maps';
import { getEmbedMapUrl } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { LoadStatus, Place } from '@/types/travel';

type TravelMapProps = {
  places: Place[];
  selectedPlace: Place | null;
  referencePlace: Place;
  status: LoadStatus;
  isDarkMode: boolean;
  contextPlaces?: Place[];
  compact?: boolean;
  className?: string;
  onSelectPlace: (place: Place) => void;
};

export function TravelMap({
  places,
  selectedPlace,
  referencePlace,
  status,
  isDarkMode,
  contextPlaces,
  compact = false,
  className,
  onSelectPlace
}: TravelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pathRef = useRef<google.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const { maps, status: mapLoadStatus, error: mapLoadError } = useGoogleMapsLoader(status === 'ready', '지도를 불러오지 못해 기본 보기로 전환했습니다.');
  const mapLoadFailed = Boolean(authError) || mapLoadStatus === 'error';
  const mapError = authError || mapLoadError;

  useEffect(() => {
    window.gm_authFailure = () => {
      setAuthError('지도 인증을 확인하지 못해 기본 보기로 전환했습니다.');
    };

    return () => {
      window.gm_authFailure = undefined;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !maps || mapInstanceRef.current || status !== 'ready') return;

    mapInstanceRef.current = new maps.Map(mapRef.current, {
      center: { lat: referencePlace.latitude, lng: referencePlace.longitude },
      zoom: 14,
      gestureHandling: 'greedy',
      scrollwheel: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: getPlaceMapStyles(isDarkMode)
    });
    setMapReady(true);
  }, [isDarkMode, maps, referencePlace.latitude, referencePlace.longitude, status]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({ styles: getPlaceMapStyles(isDarkMode) });
  }, [isDarkMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !maps || !mapInstanceRef.current) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    pathRef.current?.setMap(null);
    pathRef.current = null;
    const isContextMap = Array.isArray(contextPlaces);
    const contextPlaceIds = new Set((contextPlaces ?? []).map((place) => place.id));

    const referenceMarker = new maps.Marker({
      position: { lat: referencePlace.latitude, lng: referencePlace.longitude },
      map: mapInstanceRef.current,
      title: `기준점: ${referencePlace.name}`,
      icon: createHotelMarkerIcon(maps),
      zIndex: 3000
    });
    markersRef.current.push(referenceMarker);

    const dotPlaces = isContextMap ? (contextPlaces ?? []).filter((place) => place.id !== selectedPlace?.id) : [];
    dotPlaces.forEach((place) => {
      const marker = new maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapInstanceRef.current,
        title: place.name,
        icon: createScheduleDotMarkerIcon(maps, place.category),
        zIndex: 80
      });

      marker.addListener('click', () => onSelectPlace(place));
      markersRef.current.push(marker);
    });

    const routePath = isContextMap
      ? [referencePlace, ...(contextPlaces ?? []), referencePlace]
          .filter((place, index, routePlaces) => index === 0 || place.id !== routePlaces[index - 1].id)
          .map((place) => ({ lat: place.latitude, lng: place.longitude }))
      : [];

    if (routePath.length > 1) {
      pathRef.current = new maps.Polyline({
        ...createDirectionalDottedRouteOptions(maps, routePath, isDarkMode),
        map: mapInstanceRef.current,
        zIndex: 5
      });
    }

    const pinPlaces = isContextMap
      ? selectedPlace
        ? [selectedPlace]
        : []
      : places;
    pinPlaces.forEach((place) => {
      const isSelected = isContextMap || place.id === selectedPlace?.id;
      const marker = new maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: mapInstanceRef.current,
        title: place.name,
        icon: createPlaceMarkerIcon(maps, place.category, isSelected),
        zIndex: isSelected ? 1000 : place.category === 'dessert' ? 20 : place.category === 'sightseeing' ? 30 : 10
      });

      marker.addListener('click', () => onSelectPlace(place));
      markersRef.current.push(marker);
    });

    const bounds = new maps.LatLngBounds();
    bounds.extend({ lat: referencePlace.latitude, lng: referencePlace.longitude });
    const placesToFit = isContextMap
      ? [
          ...(contextPlaces ?? []),
          ...(selectedPlace && !contextPlaceIds.has(selectedPlace.id) ? [selectedPlace] : [])
        ]
      : places;
    placesToFit.forEach((place) => bounds.extend({ lat: place.latitude, lng: place.longitude }));

    if (placesToFit.length) {
      mapInstanceRef.current.fitBounds(bounds, isContextMap ? contextMapBoundsPadding(compact) : compact ? 42 : 64);
    } else {
      mapInstanceRef.current.setCenter({ lat: referencePlace.latitude, lng: referencePlace.longitude });
      mapInstanceRef.current.setZoom(14);
    }
  }, [compact, contextPlaces, isDarkMode, mapReady, maps, onSelectPlace, places, referencePlace, selectedPlace]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedPlace) return;
    if (Array.isArray(contextPlaces)) return;
    mapInstanceRef.current.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
  }, [contextPlaces, mapReady, selectedPlace]);

  return (
    <div
      className={cn(
        'soft-panel relative overflow-hidden rounded-xl p-1',
        compact ? 'min-h-[188px] sm:min-h-[420px] lg:min-h-[560px]' : 'min-h-[280px] sm:min-h-[420px] lg:min-h-[560px]',
        className
      )}
    >
      {googleMapsApiKey && !mapLoadFailed ? (
        <div
          ref={mapRef}
          className={cn(
            'h-full w-full overflow-hidden rounded-lg',
            compact ? 'min-h-[180px] sm:min-h-[412px] lg:min-h-[552px]' : 'min-h-[272px] sm:min-h-[412px] lg:min-h-[552px]'
          )}
        />
      ) : null}
      {mapLoadFailed ? (
        <div
          className={cn(
            'h-full w-full overflow-hidden rounded-lg',
            compact ? 'min-h-[180px] sm:min-h-[412px] lg:min-h-[552px]' : 'min-h-[272px] sm:min-h-[412px] lg:min-h-[552px]'
          )}
        >
          <iframe
            className={cn(
              'h-full w-full border-0',
              compact ? 'min-h-[180px] sm:min-h-[412px] lg:min-h-[552px]' : 'min-h-[272px] sm:min-h-[412px] lg:min-h-[552px]'
            )}
            src={getEmbedMapUrl(selectedPlace ?? referencePlace)}
            title="Google Maps fallback"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute left-3 right-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-sm sm:left-4 sm:right-4 sm:top-4 sm:px-4 sm:py-3">
            <p className="font-semibold">기본 지도 보기로 표시 중입니다.</p>
            <p className="mt-1 text-muted-foreground">{mapError || '일부 지도 기능이 제한될 수 있습니다.'}</p>
          </div>
        </div>
      ) : null}
      {!googleMapsApiKey ? (
        <div
          className={cn(
            'map-shell flex h-full flex-col items-center justify-center gap-3 rounded-lg p-4 text-center sm:min-h-[412px] sm:p-6 lg:min-h-[552px]',
            compact ? 'min-h-[180px]' : 'min-h-[272px]'
          )}
        >
          <MapPin className="h-10 w-10 text-primary" />
          <div>
            <p className="font-semibold">지도 설정이 필요합니다.</p>
            <p className="mt-1 text-sm text-muted-foreground">관리자에게 지도 설정을 확인해 주세요.</p>
          </div>
        </div>
      ) : null}
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}
    </div>
  );
}

function contextMapBoundsPadding(compact: boolean) {
  if (compact) return 18;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? 22 : 42;
}
