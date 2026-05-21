import { useEffect, useState } from 'react';
import { recordApiUsage } from '@/api/usage';
import { googleMapsApiKey } from '@/config/env';
import { loadGoogleMaps } from '@/lib/google-maps';

type GoogleMapsLoaderStatus = 'loading' | 'ready' | 'error';

export function useGoogleMapsLoader(enabled = true, errorMessage = '지도를 불러오지 못했습니다.') {
  const [maps, setMaps] = useState<typeof google.maps | null>(() => window.google?.maps ?? null);
  const [status, setStatus] = useState<GoogleMapsLoaderStatus>(() => {
    if (!googleMapsApiKey) return 'error';
    return window.google?.maps ? 'ready' : 'loading';
  });
  const [error, setError] = useState(googleMapsApiKey ? '' : '지도 설정이 필요합니다.');

  useEffect(() => {
    if (!enabled) return;

    if (!googleMapsApiKey) {
      setStatus('error');
      setError('지도 설정이 필요합니다.');
      return;
    }

    if (window.google?.maps) {
      setMaps(window.google.maps);
      setStatus('ready');
      setError('');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');

    loadGoogleMaps(googleMapsApiKey)
      .then((loadedMaps) => {
        if (cancelled) return;
        setMaps(loadedMaps);
        setStatus('ready');
        void recordApiUsage('maps-js').catch(() => undefined);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('[Google Maps] 지도 로딩 실패', loadError);
        setStatus('error');
        setError(errorMessage);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, errorMessage]);

  return { maps, status, error };
}
