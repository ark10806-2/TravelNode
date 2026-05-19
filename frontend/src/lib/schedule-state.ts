import {
  createId,
  getScheduleHotelPlace,
  normalizeDepartureTimeMinutes,
  normalizeTravelDate,
  routeLegKey,
  scheduleStorageKey
} from '@/lib/schedule-utils';
import type { RouteMode, ScheduleDay, ScheduleStop } from '@/types/schedule';
import type { Place } from '@/types/travel';

export function loadStoredDays() {
  try {
    const stored = window.localStorage.getItem(scheduleStorageKey);
    if (!stored) return createEmptyScheduleDays();

    const parsed = JSON.parse(stored) as Partial<ScheduleDay>[];
    if (!Array.isArray(parsed) || !parsed.length) return createEmptyScheduleDays();

    return parsed.map((day) =>
      alignDayDepartureTimes({
        id: typeof day.id === 'string' ? day.id : createId('day'),
        selectedReturnRouteMode: isRouteMode(day.selectedReturnRouteMode) ? day.selectedReturnRouteMode : null,
        hotelPlaceId: typeof day.hotelPlaceId === 'string' && day.hotelPlaceId.trim() ? day.hotelPlaceId : null,
        departureTimeMinutes: normalizeDepartureTimeMinutes(day.departureTimeMinutes),
        travelDate: normalizeTravelDate(day.travelDate),
        lockedReturnRoute: day.lockedReturnRoute === true,
        stops: Array.isArray(day.stops)
          ? day.stops
              .filter((stop) => typeof stop?.placeId === 'string')
              .map((stop) => ({
                id: typeof stop.id === 'string' ? stop.id : createId('stop'),
                placeId: stop.placeId,
                selectedRouteMode: isRouteMode(stop.selectedRouteMode) ? stop.selectedRouteMode : null,
                departureTimeMinutes: normalizeDepartureTimeMinutes(stop.departureTimeMinutes),
                lockedFromPrevious: stop.lockedFromPrevious === true
              }))
          : []
      })
    );
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

export function alignDayDepartureTimes(day: ScheduleDay): ScheduleDay {
  let previousDepartureTime = normalizeDepartureTimeMinutes(day.departureTimeMinutes);

  return {
    ...day,
    departureTimeMinutes: previousDepartureTime,
    travelDate: normalizeTravelDate(day.travelDate),
    lockedReturnRoute: day.lockedReturnRoute === true && day.stops.length > 0,
    stops: day.stops.map((stop) => {
      let departureTimeMinutes = normalizeDepartureTimeMinutes(stop.departureTimeMinutes);

      if (
        previousDepartureTime != null &&
        departureTimeMinutes != null &&
        departureTimeMinutes < previousDepartureTime
      ) {
        departureTimeMinutes = previousDepartureTime;
      }

      if (departureTimeMinutes != null) {
        previousDepartureTime = departureTimeMinutes;
      }

      return {
        ...stop,
        departureTimeMinutes,
        lockedFromPrevious: stop.lockedFromPrevious === true
      };
    })
  };
}

export function scheduleRoutePairs(day: ScheduleDay, placesById: Map<string, Place>) {
  const scheduledStops = day.stops
    .map((stop) => {
      const place = placesById.get(stop.placeId);
      return place ? { stop, place } : null;
    })
    .filter((entry): entry is { stop: ScheduleStop; place: Place } => Boolean(entry));
  const dayPlaces = scheduledStops.map(({ place }) => place);

  if (!dayPlaces.length) return [];
  const hotelPlace = getScheduleHotelPlace(day, placesById);
  const travelDate = normalizeTravelDate(day.travelDate);
  const first = scheduledStops[0];
  const last = scheduledStops[scheduledStops.length - 1];

  return [
    ...(hotelPlace.id === first.place.id
      ? []
      : [{
          from: hotelPlace,
          to: first.place,
          departureTimeMinutes: day.departureTimeMinutes ?? null,
          departureDate: travelDate,
          key: routeLegKey(hotelPlace, first.place, day.departureTimeMinutes, travelDate)
        }]),
    ...scheduledStops.slice(1).map(({ place }, index) => {
      const previous = scheduledStops[index];
      return {
        from: previous.place,
        to: place,
        departureTimeMinutes: previous.stop.departureTimeMinutes ?? null,
        departureDate: travelDate,
        key: routeLegKey(previous.place, place, previous.stop.departureTimeMinutes, travelDate)
      };
    }),
    ...(last.place.id === hotelPlace.id
      ? []
      : [{
          from: last.place,
          to: hotelPlace,
          departureTimeMinutes: last.stop.departureTimeMinutes ?? null,
          departureDate: travelDate,
          key: routeLegKey(last.place, hotelPlace, last.stop.departureTimeMinutes, travelDate)
        }])
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
      selectedReturnRouteMode: null,
      hotelPlaceId: null,
      departureTimeMinutes: null,
      travelDate: null,
      lockedReturnRoute: false
    }
  ];
}

function isRouteMode(value: unknown): value is RouteMode {
  return value === 'driving' || value === 'transit' || value === 'walking';
}
