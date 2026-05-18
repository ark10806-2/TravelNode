import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { googleMapsApiKey, mapsKeyLabel } from '@/config/env';
import { createPlaceMarkerIcon, describeError, getPlaceMapStyles, loadGoogleMaps } from '@/lib/google-maps';
import { getEmbedMapUrl } from '@/lib/place-utils';
import type { LoadStatus, Place } from '@/types/travel';

type TravelMapProps = {
  places: Place[];
  selectedPlace: Place | null;
  referencePlace: Place;
  status: LoadStatus;
  isDarkMode: boolean;
  onSelectPlace: (place: Place) => void;
};

export function TravelMap({ places, selectedPlace, referencePlace, status, isDarkMode, onSelectPlace }: TravelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    window.gm_authFailure = () => {
      setMapLoadFailed(true);
      setMapError('Maps JavaScript API 인증이 실패해 기본 지도 보기로 표시 중입니다.');
    };

    return () => {
      window.gm_authFailure = undefined;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !googleMapsApiKey || status !== 'ready') return;

    let cancelled = false;
    setMapError('');

    loadGoogleMaps(googleMapsApiKey)
      .then((maps) => {
        if (cancelled || mapInstanceRef.current || !mapRef.current) return;

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
        setMapLoadFailed(false);
        setMapReady(true);
      })
      .catch((loadError) => {
        console.error('[Google Maps] 지도 초기화 실패', loadError);
        setMapLoadFailed(true);
        setMapError(
          `Maps JavaScript API를 불러오지 못해 기본 지도 보기로 표시 중입니다. 원인: ${describeError(loadError)}.`
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isDarkMode, referencePlace.latitude, referencePlace.longitude, status]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({ styles: getPlaceMapStyles(isDarkMode) });
  }, [isDarkMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !mapInstanceRef.current) return;

    const maps = window.google.maps;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const referenceMarker = new maps.Marker({
      position: { lat: referencePlace.latitude, lng: referencePlace.longitude },
      map: mapInstanceRef.current,
      title: `기준점: ${referencePlace.name}`,
      icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
    });
    markersRef.current.push(referenceMarker);

    places.forEach((place) => {
      const isSelected = place.id === selectedPlace?.id;
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
    places.forEach((place) => bounds.extend({ lat: place.latitude, lng: place.longitude }));

    if (places.length) {
      mapInstanceRef.current.fitBounds(bounds, 64);
    } else {
      mapInstanceRef.current.setCenter({ lat: referencePlace.latitude, lng: referencePlace.longitude });
      mapInstanceRef.current.setZoom(14);
    }
  }, [mapReady, onSelectPlace, places, referencePlace, selectedPlace?.id]);

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !mapInstanceRef.current || !selectedPlace) return;
    mapInstanceRef.current.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
  }, [mapReady, selectedPlace]);

  return (
    <div className="soft-panel relative min-h-[280px] overflow-hidden rounded-xl p-1 sm:min-h-[420px] lg:min-h-[560px]">
      {googleMapsApiKey && !mapLoadFailed ? (
        <div ref={mapRef} className="h-full min-h-[272px] w-full overflow-hidden rounded-lg sm:min-h-[412px] lg:min-h-[552px]" />
      ) : null}
      {mapLoadFailed ? (
        <div className="h-full min-h-[272px] w-full overflow-hidden rounded-lg sm:min-h-[412px] lg:min-h-[552px]">
          <iframe
            className="h-full min-h-[272px] w-full border-0 sm:min-h-[412px] lg:min-h-[552px]"
            src={getEmbedMapUrl(selectedPlace ?? referencePlace)}
            title="Google Maps fallback"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute left-3 right-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-sm sm:left-4 sm:right-4 sm:top-4 sm:px-4 sm:py-3">
            <p className="font-semibold">기본 지도 보기로 표시 중입니다.</p>
            <p className="mt-1 text-muted-foreground">
              {mapError || 'Google Maps JavaScript 지도 대신 iframe 지도를 사용하고 있습니다.'} 현재 로컬 키는{' '}
              {mapsKeyLabel}로 로드 중입니다.
            </p>
          </div>
        </div>
      ) : null}
      {!googleMapsApiKey ? (
        <div className="map-shell flex h-full min-h-[272px] flex-col items-center justify-center gap-3 rounded-lg p-4 text-center sm:min-h-[412px] sm:p-6 lg:min-h-[552px]">
          <MapPin className="h-10 w-10 text-primary" />
          <div>
            <p className="font-semibold">Google Maps API 키가 필요합니다.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              `frontend/.env`의 `VITE_GOOGLE_MAPS_API_KEY`를 설정하면 지도가 표시됩니다.
            </p>
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
