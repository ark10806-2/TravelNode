import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchSchedule, saveSchedule } from '@/api/schedule';
import { optimizePlaceOrder } from '@/lib/route-optimizer';
import {
  clearDayRouteSelection,
  clearSelectedRouteModes,
  hasMeaningfulSchedule,
  loadStoredDays,
  mapWithConcurrency,
  scheduleRoutePairs,
  storeDays,
  withFallbackDay
} from '@/lib/schedule-state';
import { fetchRouteLeg } from '@/lib/transit';
import {
  createId,
  createLoadingRouteLeg,
  getScheduleHotelPlace,
  maxStopsPerDay,
  normalizeDepartureTimeMinutes,
  routeLegKey
} from '@/lib/schedule-utils';
import type { RouteLeg, ScheduleDay, ScheduleStop } from '@/types/schedule';
import type { Place } from '@/types/travel';

type ScheduleStatus = 'loading' | 'ready' | 'error';
type RouteRequestOptions = {
  forceRefresh?: boolean;
  departureTimeMinutes?: number | null;
};

function isResolvedRouteLeg(leg?: RouteLeg) {
  return Boolean(leg) && Object.values(leg!).every((mode) => mode.status !== 'loading');
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

    pairs.forEach(({ from, to, key, departureTimeMinutes }) => {
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

      void requestRouteLeg(from, to, key, { departureTimeMinutes }).then((leg) => setRouteLegValue(key, leg));
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

  function requestRouteLeg(from: Place, to: Place, key: string, options: RouteRequestOptions = {}) {
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
    updateDays((current) => [
      ...current,
      {
        id: createId('day'),
        stops: [],
        selectedReturnRouteMode: null,
        hotelPlaceId: null,
        departureTimeMinutes: null
      }
    ]);
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
            ...nextPlaceIds.map((placeId) => ({
              id: createId('stop'),
              placeId,
              selectedRouteMode: null,
              departureTimeMinutes: null
            }))
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

  function setDayHotel(dayId: string, hotelPlaceId: string | null) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId ? clearDayRouteSelection({ ...day, hotelPlaceId }) : day
      )
    );
  }

  function setDayDepartureTime(dayId: string, departureTimeMinutes: number | null) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? clearDayRouteSelection({
              ...day,
              departureTimeMinutes: normalizeDepartureTimeMinutes(departureTimeMinutes)
            })
          : day
      )
    );
  }

  function setStopDepartureTime(dayId: string, stopId: string, departureTimeMinutes: number | null) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? clearDayRouteSelection({
              ...day,
              stops: day.stops.map((stop) =>
                stop.id === stopId
                  ? {
                      ...stop,
                      departureTimeMinutes: normalizeDepartureTimeMinutes(departureTimeMinutes)
                    }
                  : stop
              )
            })
          : day
      )
    );
  }

  async function optimizeDayRoutes(dayId: string) {
    const day = days.find((candidate) => candidate.id === dayId);
    if (!day || day.stops.length < 1) return;

    const scheduledStops = day.stops
      .map((stop) => {
        const place = placesById.get(stop.placeId);
        return place ? { stop, place } : null;
      })
      .filter((entry): entry is { stop: ScheduleStop; place: Place } => Boolean(entry));
    const dayPlaces = scheduledStops.map(({ place }) => place);
    if (dayPlaces.length < 1) return;

    const hotelPlace = getScheduleHotelPlace(day, placesById);
    const departureByPlaceId = new Map(
      scheduledStops.map(({ stop, place }) => [place.id, normalizeDepartureTimeMinutes(stop.departureTimeMinutes)])
    );
    const departureForOrigin = (place: Place) =>
      place.id === hotelPlace.id
        ? normalizeDepartureTimeMinutes(day.departureTimeMinutes)
        : departureByPlaceId.get(place.id) ?? null;
    const keyForEdge = (from: Place, to: Place) => routeLegKey(from, to, departureForOrigin(from));
    const pairs = [
      ...dayPlaces.map((place) => ({
        from: hotelPlace,
        to: place,
        departureTimeMinutes: departureForOrigin(hotelPlace),
        key: keyForEdge(hotelPlace, place)
      })),
      ...dayPlaces.map((place) => ({
        from: place,
        to: hotelPlace,
        departureTimeMinutes: departureForOrigin(place),
        key: keyForEdge(place, hotelPlace)
      })),
      ...dayPlaces.flatMap((from) =>
        dayPlaces.flatMap((to) =>
          from.id === to.id
            ? []
            : [{
                from,
                to,
                departureTimeMinutes: departureForOrigin(from),
                key: keyForEdge(from, to)
              }]
        )
      )
    ].filter(({ from, to }) => from.id !== to.id);
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

    await mapWithConcurrency(missingPairs, 4, async ({ from, to, key, departureTimeMinutes }) => {
      const leg = await requestRouteLeg(from, to, key, { departureTimeMinutes });
      setRouteLegValue(key, leg);
    });

    const optimized = optimizePlaceOrder(dayPlaces, routeLegsRef.current, hotelPlace, hotelPlace, { keyForEdge });
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
      pairs.map(async ({ from, to, key, departureTimeMinutes }) => {
        const leg = await requestRouteLeg(from, to, key, { forceRefresh: true, departureTimeMinutes });
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
    setDayHotel,
    setDayDepartureTime,
    setStopDepartureTime,
    optimizeDayRoutes,
    refreshDayRoutes
  };
}
