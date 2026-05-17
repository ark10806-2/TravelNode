import { recordApiUsage } from '@/api/usage';
import type { CategoryId } from '@/types/travel';

const googleMapsCallbackName = '__initJapanTripGoogleMaps';
let googleMapsLoadPromise: Promise<typeof google.maps> | null = null;

const minimalMapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: 'administrative',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.medical',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.school',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.place_of_worship',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.government',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.attraction',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road.local',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text',
    stylers: [{ visibility: 'simplified' }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text',
    stylers: [{ visibility: 'simplified' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.station.bus',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.station.rail',
    elementType: 'labels',
    stylers: [{ visibility: 'on' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { lightness: 10 }]
  },
  {
    featureType: 'landscape',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  }
];

const lightPlaceMapStyles: google.maps.MapTypeStyle[] = [
  ...minimalMapStyles,
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f6f1e8' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#cfe7e5' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#f4c9a6' }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#fff8ed' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#8ab6bf' }, { visibility: 'on' }]
  },
  {
    featureType: 'transit.station.rail',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#37656d' }]
  }
];

const darkPlaceMapStyles: google.maps.MapTypeStyle[] = [
  ...minimalMapStyles,
  {
    elementType: 'geometry',
    stylers: [{ color: '#16202a' }]
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9fb0bd' }]
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#101821' }]
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#18232d' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0d2531' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#33404c' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c2cbd2' }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#293542' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#4b7c86' }, { visibility: 'on' }]
  },
  {
    featureType: 'transit.station.rail',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a7d3d7' }]
  }
];

export function getPlaceMapStyles(isDarkMode: boolean) {
  return isDarkMode ? darkPlaceMapStyles : lightPlaceMapStyles;
}

export function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.Map) {
    return ensureGoogleMapsLibraries().then(() => window.google.maps);
  }
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    const rejectLoad = (error: Error) => {
      googleMapsLoadPromise = null;
      reject(error);
    };
    const callbackWindow = window as Window &
      typeof globalThis & {
        [googleMapsCallbackName]?: () => void;
      };

    callbackWindow[googleMapsCallbackName] = () => {
      if (window.google?.maps?.Map) {
        void ensureGoogleMapsLibraries()
          .then(() => {
            void recordApiUsage('maps-js').catch(() => undefined);
            resolve(window.google.maps);
          })
          .catch(rejectLoad);
        return;
      }

      rejectLoad(new Error('Google Maps callback ran before google.maps.Map was ready'));
    };

    document.querySelector<HTMLScriptElement>('script[data-google-maps]')?.remove();

    const script = document.createElement('script');
    script.dataset.googleMaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${googleMapsCallbackName}&language=ko&region=JP&v=weekly&libraries=marker,routes&loading=async`;
    script.addEventListener('error', () => rejectLoad(new Error('Google Maps script failed to load')));
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

async function ensureGoogleMapsLibraries() {
  const maps = window.google?.maps;
  if (!maps?.importLibrary) return;

  await Promise.all([maps.importLibrary('marker'), maps.importLibrary('routes')]);
}

export function createPlaceMarkerIcon(maps: typeof google.maps, category: CategoryId, isSelected: boolean) {
  const fill = isSelected
    ? '#222222'
    : category === 'dessert'
      ? '#c13584'
      : category === 'sightseeing'
        ? '#008489'
        : '#ff385c';
  const stroke = '#ffffff';
  const size = isSelected ? 42 : 32;
  const height = Math.round(size * 1.3);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52">
      <path d="M20 50C17.9 46.2 6 34.6 6 21C6 12.3 12.2 6 20 6C27.8 6 34 12.3 34 21C34 34.6 22.1 46.2 20 50Z" fill="#0f172a" opacity="0.18" transform="translate(0 1)"/>
      <path d="M20 48C17.8 44 7 33.4 7 21C7 13.2 12.8 7 20 7C27.2 7 33 13.2 33 21C33 33.4 22.2 44 20 48Z" fill="${fill}" stroke="${stroke}" stroke-width="${isSelected ? 2.8 : 2.2}" stroke-linejoin="round"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(size, height),
    anchor: new maps.Point(size / 2, height),
    labelOrigin: new maps.Point(size / 2, Math.round(size * 0.58))
  };
}

export function describeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error instanceof Event) return `${error.type} event`;
  return String(error);
}
