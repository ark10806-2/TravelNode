import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchSchedule, saveSchedule } from '@/api/schedule';
import { optimizePlaceOrder } from '@/lib/route-optimizer';
import { fetchRouteLeg } from '@/lib/transit';
import {
  createId,
  createLoadingRouteLeg,
  hotelSchedulePlace,
  maxStopsPerDay,
  routeLegKey,
  scheduleStorageKey
} from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode, ScheduleDay, ScheduleStop } from '@/types/schedule';
import type { Place } from '@/types/travel';

const defaultDays: ScheduleDay[] = [
  {
    id: createId('day'),
    stops: [],
    selectedReturnRouteMode: null
  }
];

type ScheduleStatus = 'loading' | 'ready' | 'error';

function loadStoredDays() {
  try {
    const stored = window.localStorage.getItem(scheduleStorageKey);
    if (!stored) return defaultDays;

    const parsed = JSON.parse(stored) as Partial<ScheduleDay>[];
    if (!Array.isArray(parsed) || !parsed.length) return defaultDays;

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
    return defaultDays;
  }
}

function storeDays(days: ScheduleDay[]) {
  window.localStorage.setItem(scheduleStorageKey, JSON.stringify(days));
}

function withFallbackDay(days: ScheduleDay[]) {
  return days.length ? days : [{ id: createId('day'), stops: [], selectedReturnRouteMode: null }];
}

function hasMeaningfulSchedule(days: ScheduleDay[]) {
  return days.length > 1 || days.some((day) => day.stops.length > 0);
}

function isRouteMode(value: unknown): value is RouteMode {
  return value === 'driving' || value === 'transit' || value === 'walking';
}

function clearSelectedRouteModes(stops: ScheduleStop[]) {
  return stops.map((stop) => ({ ...stop, selectedRouteMode: null }));
}

function isResolvedRouteLeg(leg?: RouteLeg) {
  return Boolean(leg) && Object.values(leg!).every((mode) => mode.status !== 'loading');
}

function clearDayRouteSelection(day: ScheduleDay): ScheduleDay {
  return {
    ...day,
    selectedReturnRouteMode: null,
    stops: clearSelectedRouteModes(day.stops)
  };
}

function scheduleRoutePairs(day: ScheduleDay, placesById: Map<string, Place>) {
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

async function mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await task(item);
    }
  });

  await Promise.all(workers);
}

export function useSchedule(places: Place[], canPersist = false) {
  const [days, setDays] = useState<ScheduleDay[]>(() => withFallbackDay(loadStoredDays()));
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('loading');
  const [scheduleError, setScheduleError] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [routeLegs, setRouteLegs] = useState<Record<string, RouteLeg>>({});
  const routeLegsRef = useRef(routeLegs);
  const routeLegRequestsRef = useRef<Partial<Record<string, Promise<RouteLeg>>>>({});
  const saveSequenceRef = useRef(0);
  const pendingLocalMigrationRef = useRef<ScheduleDay[] | null>(null);

  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);

  useEffect(() => {
    routeLegsRef.current = routeLegs;
  }, [routeLegs]);

  useEffect(() => {
    let cancelled = false;
    const localDays = loadStoredDays();

    async function loadSchedule() {
      setScheduleStatus('loading');
      setScheduleError('');

      try {
        const serverDays = await fetchSchedule();
        if (cancelled) return;

        const shouldUseLocalBackup = serverDays.length === 0 && hasMeaningfulSchedule(localDays);
        const nextDays = withFallbackDay(shouldUseLocalBackup ? localDays : serverDays);
        setDays(nextDays);
        storeDays(nextDays);
        setScheduleStatus('ready');

        if (shouldUseLocalBackup && getAuthToken()) {
          void persistSchedule(nextDays, { silent: true });
        } else if (shouldUseLocalBackup) {
          pendingLocalMigrationRef.current = nextDays;
        }
      } catch (loadError) {
        if (cancelled) return;

        const fallbackDays = withFallbackDay(localDays);
        setDays(fallbackDays);
        setScheduleStatus('error');
        setScheduleError(loadError instanceof Error ? loadError.message : '일정을 불러오지 못했습니다.');
      }
    }

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPersist || !getAuthToken() || !pendingLocalMigrationRef.current) return;

    const pendingDays = pendingLocalMigrationRef.current;
    pendingLocalMigrationRef.current = null;
    void persistSchedule(pendingDays, { silent: true });
  }, [canPersist]);

  useEffect(() => {
    const pairs = days.flatMap((day) => scheduleRoutePairs(day, placesById));

    pairs.forEach(({ from, to, key }) => {
      if (routeLegsRef.current[key]) return;

      const loadingLeg = createLoadingRouteLeg();
      routeLegsRef.current = {
        ...routeLegsRef.current,
        [key]: loadingLeg
      };
      setRouteLegs((current) => ({
        ...current,
        [key]: loadingLeg
      }));

      void requestRouteLeg(from, to, key).then((leg) => setRouteLegValue(key, leg));
    });
  }, [days, placesById]);

  function setRouteLegValue(key: string, leg: RouteLeg) {
    routeLegsRef.current = {
      ...routeLegsRef.current,
      [key]: leg
    };
    setRouteLegs((current) => ({
      ...current,
      [key]: leg
    }));
  }

  function requestRouteLeg(from: Place, to: Place, key: string, options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && routeLegRequestsRef.current[key]) {
      return routeLegRequestsRef.current[key];
    }

    const request = fetchRouteLeg(from, to, options).finally(() => {
      delete routeLegRequestsRef.current[key];
    });

    if (!options.forceRefresh) {
      routeLegRequestsRef.current[key] = request;
    }

    return request;
  }

  async function persistSchedule(nextDays: ScheduleDay[], options: { silent?: boolean } = {}) {
    const sequence = ++saveSequenceRef.current;
    if (!options.silent) {
      setIsSavingSchedule(true);
    }
    setScheduleError('');

    try {
      const savedDays = withFallbackDay(await saveSchedule(nextDays));
      if (sequence === saveSequenceRef.current) {
        setDays(savedDays);
        storeDays(savedDays);
        setScheduleStatus('ready');
      }
    } catch (saveError) {
      if (sequence === saveSequenceRef.current) {
        setScheduleStatus('error');
        setScheduleError(saveError instanceof Error ? saveError.message : '일정을 저장하지 못했습니다.');
      }
    } finally {
      if (sequence === saveSequenceRef.current && !options.silent) {
        setIsSavingSchedule(false);
      }
    }
  }

  function updateDays(updater: (current: ScheduleDay[]) => ScheduleDay[]) {
    setDays((current) => {
      const nextDays = updater(current);
      storeDays(nextDays);
      void persistSchedule(nextDays);
      return nextDays;
    });
  }

  function addDay() {
    updateDays((current) => [...current, { id: createId('day'), stops: [], selectedReturnRouteMode: null }]);
  }

  function removeDay(dayId: string) {
    updateDays((current) => current.filter((day) => day.id !== dayId));
  }

  function addStops(dayId: string, placeIds: string[]) {
    updateDays((current) =>
      current.map((day) => {
        if (day.id !== dayId || day.stops.length >= maxStopsPerDay) {
          return day;
        }

        const currentPlaceIds = new Set(day.stops.map((stop) => stop.placeId));
        const remainingSlots = maxStopsPerDay - day.stops.length;
        const nextPlaceIds = placeIds
          .filter((placeId) => !currentPlaceIds.has(placeId))
          .slice(0, remainingSlots);

        if (!nextPlaceIds.length) return day;

        return {
          ...day,
          selectedReturnRouteMode: null,
          stops: clearSelectedRouteModes([
            ...day.stops,
            ...nextPlaceIds.map((placeId) => ({ id: createId('stop'), placeId, selectedRouteMode: null }))
          ])
        };
      })
    );
  }

  function removeStop(dayId: string, stopId: string) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? clearDayRouteSelection({ ...day, stops: day.stops.filter((stop) => stop.id !== stopId) })
          : day
      )
    );
  }

  function moveStop(dayId: string, stopId: string, direction: -1 | 1) {
    updateDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day;

        const fromIndex = day.stops.findIndex((stop) => stop.id === stopId);
        const toIndex = fromIndex + direction;
        if (fromIndex < 0 || toIndex < 0 || toIndex >= day.stops.length) return day;

        const nextStops: ScheduleStop[] = [...day.stops];
        const [moved] = nextStops.splice(fromIndex, 1);
        nextStops.splice(toIndex, 0, moved);
        return clearDayRouteSelection({ ...day, stops: nextStops });
      })
    );
  }

  async function optimizeDayRoutes(dayId: string) {
    const day = days.find((candidate) => candidate.id === dayId);
    if (!day || day.stops.length < 1) return;

    const dayPlaces = day.stops
      .map((stop) => placesById.get(stop.placeId))
      .filter((place): place is Place => Boolean(place));
    if (dayPlaces.length < 1) return;

    const pairs = [
      ...dayPlaces.map((place) => ({
        from: hotelSchedulePlace,
        to: place,
        key: routeLegKey(hotelSchedulePlace, place)
      })),
      ...dayPlaces.map((place) => ({
        from: place,
        to: hotelSchedulePlace,
        key: routeLegKey(place, hotelSchedulePlace)
      })),
      ...dayPlaces.flatMap((from) =>
        dayPlaces.flatMap((to) => (from.id === to.id ? [] : [{ from, to, key: routeLegKey(from, to) }]))
      )
    ];
    const missingPairs = pairs.filter(({ key }) => !isResolvedRouteLeg(routeLegsRef.current[key]));

    if (missingPairs.length) {
      const loadingLegs = Object.fromEntries(missingPairs.map(({ key }) => [key, createLoadingRouteLeg()]));
      routeLegsRef.current = {
        ...routeLegsRef.current,
        ...loadingLegs
      };
      setRouteLegs((current) => ({
        ...current,
        ...loadingLegs
      }));
    }

    await mapWithConcurrency(missingPairs, 4, async ({ from, to, key }) => {
      const leg = await requestRouteLeg(from, to, key);
      setRouteLegValue(key, leg);
    });

    const optimized = optimizePlaceOrder(dayPlaces, routeLegsRef.current, hotelSchedulePlace, hotelSchedulePlace);
    if (!optimized) {
      setScheduleStatus('error');
      setScheduleError('동선 최적화에 필요한 이동 시간을 계산하지 못했습니다.');
      return;
    }

    const stopsByPlaceId = new Map(day.stops.map((stop) => [stop.placeId, stop]));
    updateDays((current) =>
      current.map((candidate) => {
        if (candidate.id !== dayId) return candidate;

        return {
          ...candidate,
          selectedReturnRouteMode: optimized.selectedReturnMode,
          stops: optimized.places.map((place, index) => ({
            ...(stopsByPlaceId.get(place.id) ?? { id: createId('stop'), placeId: place.id }),
            placeId: place.id,
            selectedRouteMode: optimized.selectedModes[index]
          }))
        };
      })
    );
  }

  async function refreshDayRoutes(dayId: string) {
    const day = days.find((candidate) => candidate.id === dayId);
    if (!day) return;

    const pairs = scheduleRoutePairs(day, placesById);

    if (!pairs.length) return;

    const loadingLegs = Object.fromEntries(pairs.map(({ key }) => [key, createLoadingRouteLeg()]));
    routeLegsRef.current = {
      ...routeLegsRef.current,
      ...loadingLegs
    };
    setRouteLegs((current) => ({
      ...current,
      ...loadingLegs
    }));

    await Promise.all(
      pairs.map(async ({ from, to, key }) => {
        const leg = await requestRouteLeg(from, to, key, { forceRefresh: true });
        setRouteLegValue(key, leg);
      })
    );
  }

  return {
    days,
    scheduleStatus,
    scheduleError,
    isSavingSchedule,
    placesById,
    routeLegs,
    addDay,
    removeDay,
    addStops,
    removeStop,
    moveStop,
    optimizeDayRoutes,
    refreshDayRoutes
  };
}
