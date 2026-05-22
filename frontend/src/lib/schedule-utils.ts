import { hotel } from '@/constants/travel';
import { haversineKm } from '@/lib/place-utils';
import type { RouteLeg, RouteMode, RouteModeLeg, ScheduleDay } from '@/types/schedule';
import type { Place } from '@/types/travel';

export { createId } from '@/lib/id';

export const scheduleStorageKey = 'japan-trip-schedule-v1';
export const maxStopsPerDay = 20;
export const routeModes: RouteMode[] = ['driving', 'transit', 'walking'];
export const departureTimeStepMinutes = 30;
export const defaultDayDepartureTimeMinutes = 9 * 60;
export const hotelSchedulePlace: Place = {
  id: 'hotel',
  name: hotel.name,
  category: 'sightseeing',
  cuisine: '숙소',
  menu: '숙소',
  description: '여행 시작과 종료 기준이 되는 숙소입니다.',
  googleMapsNote: null,
  googlePlaceId: null,
  address: hotel.name,
  googleMapsUrl: '',
  latitude: hotel.latitude,
  longitude: hotel.longitude,
  travelMode: 'walk',
  travelMinutes: 0,
  distanceLabel: '0m'
};

export function buildPlaceDirectionsUrl(from: Place, to: Place, mode: RouteMode = 'transit') {
  const params = new URLSearchParams({
    api: '1',
    travelmode: mode,
    hl: 'ko'
  });
  appendDirectionsPlace(params, 'origin', from);
  appendDirectionsPlace(params, 'destination', to);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function routeLegKey(from: Place, to: Place, departureTimeMinutes?: number | null, travelDate?: string | null) {
  return `${routeCacheOriginKey(from, departureTimeMinutes, false, travelDate)}:${to.id}`;
}

export function routeCacheOriginKey(
  place: Place,
  departureTimeMinutes?: number | null,
  precise?: boolean,
  travelDate?: string | null
) {
  const normalizedDate = normalizeTravelDate(travelDate);
  const normalized = normalizeDepartureTimeMinutes(departureTimeMinutes);
  const dateSuffix = normalizedDate == null || normalized == null ? '' : `:d${normalizedDate.replace(/-/g, '')}`;
  const timeSuffix = normalized == null ? '' : `:m${String(normalized).padStart(4, '0')}`;
  return `${place.id}${dateSuffix}${timeSuffix}${precise ? ':precise' : ''}`;
}

export function normalizeDepartureTimeMinutes(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 0 || value >= 24 * 60 || value % departureTimeStepMinutes !== 0) return null;
  return value;
}

export function normalizeTravelDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [year, month, day] = trimmed.split('-').map(Number);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function formatTravelDate(value: string | null | undefined) {
  const normalized = normalizeTravelDate(value);
  if (normalized == null) return '날짜 미지정';

  const [year, month, day] = normalized.split('-');
  return `${year}.${month}.${day}`;
}

export function departureTimeOptions() {
  return Array.from({ length: (24 * 60) / departureTimeStepMinutes }, (_, index) => index * departureTimeStepMinutes);
}

export function formatDepartureTime(minutes: number | null | undefined) {
  const normalized = normalizeDepartureTimeMinutes(minutes);
  if (normalized == null) return '현재 기준';

  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
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

export function createLoadingRouteLeg(modes: RouteMode[] = routeModes) {
  return Object.fromEntries(
    modes.map((mode) => [
      mode,
      {
        status: 'loading',
        durationLabel: '계산 중',
        distanceLabel: '계산 중'
      }
    ])
  ) as RouteLeg;
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

function appendDirectionsPlace(params: URLSearchParams, key: 'origin' | 'destination', place: Place) {
  const placeId = getGooglePlaceId(place);
  params.set(key, buildCoordinateQuery(place));
  if (placeId) params.set(`${key}_place_id`, placeId);
}

function buildCoordinateQuery(place: Pick<Place, 'latitude' | 'longitude'>) {
  return `${place.latitude},${place.longitude}`;
}

function getGooglePlaceId(place: Pick<Place, 'googlePlaceId' | 'googleMapsUrl'>) {
  return place.googlePlaceId?.trim() || extractGooglePlaceId(place.googleMapsUrl);
}

function extractGooglePlaceId(googleMapsUrl: string) {
  try {
    const url = new URL(googleMapsUrl);
    return url.searchParams.get('query_place_id')?.trim() || url.searchParams.get('place_id')?.trim() || null;
  } catch (_error) {
    return null;
  }
}
