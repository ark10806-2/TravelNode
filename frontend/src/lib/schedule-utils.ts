import { hotel } from '@/constants/travel';
import { haversineKm } from '@/lib/place-utils';
import type { RouteMode, RouteModeLeg, ScheduleDay } from '@/types/schedule';
import type { Place } from '@/types/travel';

export const scheduleStorageKey = 'japan-trip-schedule-v1';
export const maxStopsPerDay = 20;
export const routeModes: RouteMode[] = ['driving', 'transit', 'walking'];
export const hotelSchedulePlace: Place = {
  id: 'hotel',
  name: hotel.name,
  category: 'sightseeing',
  cuisine: '숙소',
  menu: '숙소',
  description: '여행 시작과 종료 기준이 되는 숙소입니다.',
  googleMapsNote: null,
  address: hotel.name,
  googleMapsUrl: '',
  latitude: hotel.latitude,
  longitude: hotel.longitude,
  travelMode: 'walk',
  travelMinutes: 0,
  distanceLabel: '0m',
  noSeafood: true
};

export function createId(prefix: string) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildPlaceDirectionsUrl(from: Place, to: Place, mode: RouteMode = 'transit') {
  const origin = encodeURIComponent(buildDirectionsQuery(from));
  const destination = encodeURIComponent(buildDirectionsQuery(to));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${mode}&hl=ko`;
}

export function routeLegKey(from: Place, to: Place) {
  return `${from.id}:${to.id}`;
}

export function getScheduleHotelPlace(day: Pick<ScheduleDay, 'hotelPlaceId'>, placesById: Map<string, Place>) {
  if (!day.hotelPlaceId) return hotelSchedulePlace;
  return placesById.get(day.hotelPlaceId) ?? hotelSchedulePlace;
}

export function estimateRouteModeLeg(from: Place, to: Place, mode: RouteMode): RouteModeLeg {
  const distanceKm = haversineKm(from, to);
  const minutes = estimateMinutes(distanceKm, mode);
  const distanceLabel = distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;

  return {
    status: 'estimated',
    durationLabel: `${minutes}분`,
    distanceLabel
  };
}

export function createLoadingRouteLeg() {
  return Object.fromEntries(
    routeModes.map((mode) => [
      mode,
      {
        status: 'loading',
        durationLabel: '계산 중',
        distanceLabel: '계산 중'
      }
    ])
  ) as Record<RouteMode, RouteModeLeg>;
}

function estimateMinutes(distanceKm: number, mode: RouteMode) {
  if (mode === 'walking') return Math.ceil(distanceKm / 0.08).toString();
  if (mode === 'driving') return Math.ceil(distanceKm / 0.35 + 5).toString();
  return Math.ceil(distanceKm * 3 + 10).toString();
}

function buildDirectionsQuery(place: Place) {
  const name = place.name.trim();
  const address = place.address.trim();
  const hasUsefulAddress = address && address !== name && address !== '주소 확인 필요';

  if (hasUsefulAddress) return `${name} ${address}`;
  return name || `${place.latitude},${place.longitude}`;
}
