import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { googleMapsApiKey } from '@/config/env';
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import { createHotelMarkerIcon, createPlaceMarkerIcon, getPlaceMapStyles } from '@/lib/google-maps';
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

    const referenceMarker = new maps.Marker({
      position: { lat: referencePlace.latitude, lng: referencePlace.longitude },
      map: mapInstanceRef.current,
      title: `기준점: ${referencePlace.name}`,
      icon: createHotelMarkerIcon(maps),
      zIndex: 3000
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
  }, [mapReady, maps, onSelectPlace, places, referencePlace, selectedPlace?.id]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedPlace) return;
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
            <p className="mt-1 text-muted-foreground">{mapError || '일부 지도 기능이 제한될 수 있습니다.'}</p>
          </div>
        </div>
      ) : null}
      {!googleMapsApiKey ? (
        <div className="map-shell flex h-full min-h-[272px] flex-col items-center justify-center gap-3 rounded-lg p-4 text-center sm:min-h-[412px] sm:p-6 lg:min-h-[552px]">
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
