import { createId, hotelSchedulePlace, routeLegKey, scheduleStorageKey } from '@/lib/schedule-utils';
import type { RouteMode, ScheduleDay, ScheduleStop } from '@/types/schedule';
import type { Place } from '@/types/travel';

export function loadStoredDays() {
  try {
    const stored = window.localStorage.getItem(scheduleStorageKey);
    if (!stored) return createEmptyScheduleDays();

    const parsed = JSON.parse(stored) as Partial<ScheduleDay>[];
    if (!Array.isArray(parsed) || !parsed.length) return createEmptyScheduleDays();

    return parsed.map((day) => ({
      id: typeof day.id === 'string' ? day.id : createId('day'),
      selectedReturnRouteMode: isRouteMode(day.selectedReturnRouteMode) ? day.selectedReturnRouteMode : null,
      stops: Array.isArray(day.stops)
        ? day.stops
            .filter((stop) => typeof stop?.placeId === 'string')
            .map((stop) => ({
              id: typeof stop.id === 'string' ? stop.id : createId('stop'),
              placeId: stop.placeId,
              selectedRouteMode: isRouteMode(stop.selectedRouteMode) ? stop.selectedRouteMode : null
            }))
        : []
    }));
  } catch {
    return createEmptyScheduleDays();
  }
}

export function storeDays(days: ScheduleDay[]) {
  window.localStorage.setItem(scheduleStorageKey, JSON.stringify(days));
}

export function withFallbackDay(days: ScheduleDay[]) {
  return days.length ? days : createEmptyScheduleDays();
}

export function hasMeaningfulSchedule(days: ScheduleDay[]) {
  return days.length > 1 || days.some((day) => day.stops.length > 0);
}

export function clearSelectedRouteModes(stops: ScheduleStop[]) {
  return stops.map((stop) => ({ ...stop, selectedRouteMode: null }));
}

export function clearDayRouteSelection(day: ScheduleDay): ScheduleDay {
  return {
    ...day,
    selectedReturnRouteMode: null,
    stops: clearSelectedRouteModes(day.stops)
  };
}

export function scheduleRoutePairs(day: ScheduleDay, placesById: Map<string, Place>) {
  const dayPlaces = day.stops
    .map((stop) => placesById.get(stop.placeId))
    .filter((place): place is Place => Boolean(place));

  if (!dayPlaces.length) return [];

  return [
    { from: hotelSchedulePlace, to: dayPlaces[0], key: routeLegKey(hotelSchedulePlace, dayPlaces[0]) },
    ...dayPlaces.slice(1).map((place, index) => {
      const from = dayPlaces[index];
      return { from, to: place, key: routeLegKey(from, place) };
    }),
    {
      from: dayPlaces[dayPlaces.length - 1],
      to: hotelSchedulePlace,
      key: routeLegKey(dayPlaces[dayPlaces.length - 1], hotelSchedulePlace)
    }
  ];
}

export async function mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await task(item);
    }
  });

  await Promise.all(workers);
}

function createEmptyScheduleDays(): ScheduleDay[] {
  return [
    {
      id: createId('day'),
      stops: [],
      selectedReturnRouteMode: null
    }
  ];
}

function isRouteMode(value: unknown): value is RouteMode {
  return value === 'driving' || value === 'transit' || value === 'walking';
}
