function normalizeApiBaseUrl(value: string | undefined) {
  const rawValue = value?.trim();
  if (!rawValue || rawValue === '/') return '';

  try {
    const configuredUrl = new URL(rawValue);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

    if (typeof window !== 'undefined' && localHosts.has(configuredUrl.hostname) && !localHosts.has(window.location.hostname)) {
      return '';
    }

    return configuredUrl.origin;
  } catch {
    return rawValue.replace(/\/+$/, '');
  }
}

export const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const rawGoogleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const googleMapsApiKey =
  rawGoogleMapsApiKey && rawGoogleMapsApiKey !== 'your_google_maps_api_key' ? rawGoogleMapsApiKey : undefined;

export const mapsKeyLabel = googleMapsApiKey
  ? `${googleMapsApiKey.slice(0, 6)}...${googleMapsApiKey.slice(-4)}`
  : '미설정';
