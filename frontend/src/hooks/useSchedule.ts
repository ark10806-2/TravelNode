import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchCachedRouteLeg } from '@/api/routes';
import { fetchSchedule, saveSchedule } from '@/api/schedule';
import { haversineKm } from '@/lib/place-utils';
import { optimizePlaceOrder } from '@/lib/route-optimizer';
import { defaultEnabledRouteModes } from '@/lib/route-preferences';
import {
  alignDayDepartureTimes,
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
  estimateRouteModeLeg,
  getScheduleHotelPlace,
  maxStopsPerDay,
  normalizeDepartureTimeMinutes,
  routeCacheOriginKey,
  routeLegKey
} from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode, ScheduleDay, ScheduleStop } from '@/types/schedule';
import type { Place } from '@/types/travel';

type ScheduleStatus = 'loading' | 'ready' | 'error';
type RouteRequestOptions = {
  forceRefresh?: boolean;
  departureTimeMinutes?: number | null;
  departureDate?: string | null;
  modes?: RouteMode[];
  precise?: boolean;
};

type RoutePair = {
  from: Place;
  to: Place;
  key: string;
  departureTimeMinutes: number | null;
  departureDate: string | null;
};

function isResolvedRouteLeg(leg: RouteLeg | undefined, modes: RouteMode[]) {
  return modes.every((mode) => {
    const modeLeg = leg?.[mode];
    return Boolean(modeLeg) && modeLeg?.status !== 'loading';
  });
}

export function useSchedule(places: Place[], canPersist = false, enabledRouteModes: RouteMode[] = defaultEnabledRouteModes) {
  const [days, setDays] = useState<ScheduleDay[]>(() => withFallbackDay(loadStoredDays()).map(alignDayDepartureTimes));
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
        const nextDays = withFallbackDay(shouldUseLocalBackup ? localDays : serverDays).map(alignDayDepartureTimes);
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

        const fallbackDays = withFallbackDay(localDays).map(alignDayDepartureTimes);
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
    if (scheduleStatus === 'loading' || places.length === 0 || days.length === 0) return undefined;

    let cancelled = false;
    const pairs = uniqueRoutePairs(days.flatMap((day) => scheduleRoutePairs(day, placesById)))
      .filter(({ key }) => !isResolvedRouteLeg(routeLegsRef.current[key], enabledRouteModes));

    if (!pairs.length) return undefined;

    void mapWithConcurrency(pairs, 4, async ({ from, to, key, departureTimeMinutes, departureDate }) => {
      const standardOriginKey = routeCacheOriginKey(from, departureTimeMinutes, false, departureDate);
      const preciseOriginKey = routeCacheOriginKey(from, departureTimeMinutes, true, departureDate);
      const [standardLeg, preciseLeg] = await Promise.all([
        fetchCachedRouteLeg(standardOriginKey, to.id).catch(() => null),
        fetchCachedRouteLeg(preciseOriginKey, to.id).catch(() => null)
      ]);
      const cachedLeg = pickNewestRouteLeg(standardLeg, preciseLeg, enabledRouteModes);

      if (!cancelled && cachedLeg) {
        setRouteLegValue(key, cachedLeg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [days, enabledRouteModes, places.length, placesById, scheduleStatus]);

  function setRouteLegValue(key: string, leg: RouteLeg) {
    routeLegsRef.current = {
      ...routeLegsRef.current,
      [key]: {
        ...routeLegsRef.current[key],
        ...leg
      }
    };
    setRouteLegs((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...leg
      }
    }));
  }

  function requestRouteLeg(from: Place, to: Place, key: string, options: RouteRequestOptions = {}) {
    const requestKey = routeRequestKey(key, options);
    if (!options.forceRefresh && routeLegRequestsRef.current[requestKey]) {
      return routeLegRequestsRef.current[requestKey];
    }

    const request = fetchRouteLeg(from, to, options).finally(() => {
      delete routeLegRequestsRef.current[requestKey];
    });

    if (!options.forceRefresh) {
      routeLegRequestsRef.current[requestKey] = request;
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
      const savedDays = withFallbackDay(await saveSchedule(nextDays)).map(alignDayDepartureTimes);
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
      const nextDays = updater(current).map(alignDayDepartureTimes);
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
        departureTimeMinutes: null,
        travelDate: null,
        lockedReturnRoute: false
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
              departureTimeMinutes: null,
              lockedFromPrevious: false
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
          ? clearDayRouteSelection(removeStopAndClearEdgeLocks(day, stopId))
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
        return clearDayRouteSelection({ ...day, stops: clearLocksAroundMove(nextStops, fromIndex, toIndex) });
      })
    );
  }

  function toggleStopEdgeLock(dayId: string, stopId: string) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              stops: day.stops.map((stop) =>
                stop.id === stopId
                  ? {
                      ...stop,
                      lockedFromPrevious: stop.lockedFromPrevious !== true
                    }
                  : stop
              )
            }
          : day
      )
    );
  }

  function toggleReturnEdgeLock(dayId: string) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId && day.stops.length > 0
          ? {
              ...day,
              lockedReturnRoute: day.lockedReturnRoute !== true
            }
          : day
      )
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

  function setDayTravelDate(dayId: string, travelDate: string | null) {
    updateDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? clearDayRouteSelection({
              ...day,
              travelDate
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
    const optimizationModes = enabledRouteModes.filter((mode) => mode !== 'driving');
    if (!optimizationModes.length) return;

    const scheduledStops = day.stops
      .map((stop) => {
        const place = placesById.get(stop.placeId);
        return place ? { stop, place } : null;
      })
      .filter((entry): entry is { stop: ScheduleStop; place: Place } => Boolean(entry));
    const dayPlaces = scheduledStops.map(({ place }) => place);
    if (dayPlaces.length < 1) return;

    const hotelPlace = getScheduleHotelPlace(day, placesById);
    const optimizationLocks = createLockedOptimizationPlan(scheduledStops, day);
    const departureByPlaceId = new Map(
      scheduledStops.map(({ stop, place }) => [place.id, normalizeDepartureTimeMinutes(stop.departureTimeMinutes)])
    );
    const departureForOrigin = (place: Place) =>
      place.id === hotelPlace.id
        ? normalizeDepartureTimeMinutes(day.departureTimeMinutes)
        : departureByPlaceId.get(place.id) ?? null;
    const departureDate = day.travelDate ?? null;
    const keyForEdge = (from: Place, to: Place) => routeLegKey(from, to, departureForOrigin(from), departureDate);
    const pairs: RoutePair[] = [
      ...dayPlaces.map((place) => ({
        from: hotelPlace,
        to: place,
        departureTimeMinutes: departureForOrigin(hotelPlace),
        departureDate,
        key: keyForEdge(hotelPlace, place)
      })),
      ...dayPlaces.map((place) => ({
        from: place,
        to: hotelPlace,
        departureTimeMinutes: departureForOrigin(place),
        departureDate,
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
                departureDate,
                key: keyForEdge(from, to)
              }]
        )
      )
    ].filter(({ from, to }) => from.id !== to.id);
    const candidatePairs = selectTopRouteCandidatePairs(pairs, scheduleRoutePairs(day, placesById));
    const missingPairs = candidatePairs.filter(({ key }) => !isResolvedRouteLeg(routeLegsRef.current[key], optimizationModes));

    if (missingPairs.length) {
      const loadingLegs = Object.fromEntries(missingPairs.map(({ key }) => [key, createLoadingRouteLeg(optimizationModes)]));
      routeLegsRef.current = {
        ...routeLegsRef.current,
        ...mergeRouteLegRecords(routeLegsRef.current, loadingLegs)
      };
      setRouteLegs((current) => ({
        ...current,
        ...mergeRouteLegRecords(current, loadingLegs)
      }));
    }

    await mapWithConcurrency(missingPairs, 4, async ({ from, to, key, departureTimeMinutes, departureDate }) => {
      const leg = await requestRouteLeg(from, to, key, { departureTimeMinutes, departureDate, modes: optimizationModes });
      setRouteLegValue(key, leg);
    });

    const optimizationRouteLegs = mergeRouteLegRecords(
      createEstimatedRouteLegs(pairs, optimizationModes),
      routeLegsRef.current
    );
    const optimized = optimizePlaceOrder(dayPlaces, optimizationRouteLegs, hotelPlace, hotelPlace, {
      keyForEdge,
      ...optimizationLocks
    });
    if (!optimized) {
      setScheduleStatus('error');
      setScheduleError('동선 최적화에 필요한 이동 시간을 계산하지 못했습니다.');
      return;
    }

    const stopsByPlaceId = new Map(day.stops.map((stop) => [stop.placeId, stop]));
    const lockedFromPreviousByPlaceId = createOptimizedLockMap(day, optimized.segments);
    updateDays((current) =>
      current.map((candidate) => {
        if (candidate.id !== dayId) return candidate;

        return {
          ...candidate,
          selectedReturnRouteMode: optimized.selectedReturnMode,
          stops: optimized.places.map((place, index) => ({
            ...(stopsByPlaceId.get(place.id) ?? { id: createId('stop'), placeId: place.id }),
            placeId: place.id,
            selectedRouteMode: optimized.selectedModes[index],
            lockedFromPrevious: lockedFromPreviousByPlaceId.get(place.id) === true
          })),
          lockedReturnRoute: day.lockedReturnRoute === true
        };
      })
    );
  }

  async function refreshDayRoutes(dayId: string) {
    const day = days.find((candidate) => candidate.id === dayId);
    if (!day) return;

    const pairs = scheduleRoutePairs(day, placesById);

    if (!pairs.length) return;

    const loadingLegs = Object.fromEntries(
      pairs
        .filter(({ key }) => !isResolvedRouteLeg(routeLegsRef.current[key], enabledRouteModes))
        .map(({ key }) => [key, createLoadingRouteLeg(enabledRouteModes)])
    );
    routeLegsRef.current = {
      ...routeLegsRef.current,
      ...mergeRouteLegRecords(routeLegsRef.current, loadingLegs)
    };
    setRouteLegs((current) => ({
      ...current,
      ...mergeRouteLegRecords(current, loadingLegs)
    }));

    await Promise.all(
      pairs.map(async ({ from, to, key, departureTimeMinutes, departureDate }) => {
        const leg = await requestRouteLeg(from, to, key, { departureTimeMinutes, departureDate, modes: enabledRouteModes });
        setRouteLegValue(key, leg);
      })
    );
  }

  async function calculatePreciseDayRoutes(dayId: string) {
    if (!enabledRouteModes.includes('driving')) return;

    const day = days.find((candidate) => candidate.id === dayId);
    if (!day) return;

    const pairs = scheduleRoutePairs(day, placesById);
    if (!pairs.length) return;

    const loadingLegs = Object.fromEntries(pairs.map(({ key }) => [key, createLoadingRouteLeg(enabledRouteModes)]));
    routeLegsRef.current = {
      ...routeLegsRef.current,
      ...mergeRouteLegRecords(routeLegsRef.current, loadingLegs)
    };
    setRouteLegs((current) => ({
      ...current,
      ...mergeRouteLegRecords(current, loadingLegs)
    }));

    await Promise.all(
      pairs.map(async ({ from, to, key, departureTimeMinutes, departureDate }) => {
        const leg = await requestRouteLeg(from, to, key, {
          forceRefresh: true,
          departureTimeMinutes,
          departureDate,
          modes: enabledRouteModes,
          precise: true
        });
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
    setDayTravelDate,
    setStopDepartureTime,
    toggleStopEdgeLock,
    toggleReturnEdgeLock,
    optimizeDayRoutes,
    refreshDayRoutes,
    calculatePreciseDayRoutes
  };
}

function clearLocksAroundMove(stops: ScheduleStop[], fromIndex: number, toIndex: number) {
  const affectedIndices = new Set([fromIndex, fromIndex + 1, toIndex, toIndex + 1]);

  return stops.map((stop, index) =>
    affectedIndices.has(index)
      ? {
          ...stop,
          lockedFromPrevious: false
        }
      : stop
  );
}

function routeRequestKey(key: string, options: RouteRequestOptions) {
  const modes = [...(options.modes ?? defaultEnabledRouteModes)].sort().join(',');
  return `${key}:${modes}:${options.departureDate ?? 'floating'}:${options.precise === true ? 'precise' : 'standard'}`;
}

function mergeRouteLegRecords(...records: Record<string, RouteLeg>[]) {
  return records.reduce<Record<string, RouteLeg>>((merged, record) => {
    Object.entries(record).forEach(([key, leg]) => {
      merged[key] = {
        ...merged[key],
        ...leg
      };
    });
    return merged;
  }, {});
}

function createEstimatedRouteLegs(pairs: RoutePair[], modes: RouteMode[]) {
  return Object.fromEntries(
    pairs.map(({ from, to, key }) => [
      key,
      Object.fromEntries(modes.map((mode) => [mode, estimateRouteModeLeg(from, to, mode)])) as RouteLeg
    ])
  );
}

function selectTopRouteCandidatePairs(pairs: RoutePair[], requiredPairs: RoutePair[], perOriginLimit = 4) {
  const pairByKey = new Map(pairs.map((pair) => [pair.key, pair]));
  const selected = new Map(requiredPairs.flatMap((pair) => {
    const matchedPair = pairByKey.get(pair.key);
    return matchedPair ? [[matchedPair.key, matchedPair] as const] : [];
  }));
  const pairsByOrigin = new Map<string, RoutePair[]>();

  pairs.forEach((pair) => {
    const key = pair.from.id;
    pairsByOrigin.set(key, [...(pairsByOrigin.get(key) ?? []), pair]);
  });

  pairsByOrigin.forEach((originPairs) => {
    originPairs
      .slice()
      .sort((left, right) => haversineKm(left.from, left.to) - haversineKm(right.from, right.to))
      .slice(0, perOriginLimit)
      .forEach((pair) => selected.set(pair.key, pair));
  });

  return [...selected.values()];
}

function uniqueRoutePairs(pairs: RoutePair[]) {
  const pairByKey = new Map<string, RoutePair>();
  pairs.forEach((pair) => {
    if (!pairByKey.has(pair.key)) {
      pairByKey.set(pair.key, pair);
    }
  });
  return [...pairByKey.values()];
}

function pickNewestRouteLeg(
  standardLeg: RouteLeg | null,
  preciseLeg: RouteLeg | null,
  modes: RouteMode[]
): RouteLeg | null {
  const entries = modes.flatMap((mode) => {
    const modeLeg = pickNewestModeLeg(standardLeg?.[mode], preciseLeg?.[mode]);
    return modeLeg ? [[mode, modeLeg] as const] : [];
  });

  return entries.length ? Object.fromEntries(entries) as RouteLeg : null;
}

function pickNewestModeLeg(...legs: Array<RouteLeg[RouteMode] | undefined>) {
  return legs
    .filter((leg): leg is NonNullable<RouteLeg[RouteMode]> => leg?.status === 'ready')
    .sort((a, b) => routeModeUpdatedAtMillis(b) - routeModeUpdatedAtMillis(a))[0] ?? null;
}

function routeModeUpdatedAtMillis(leg: NonNullable<RouteLeg[RouteMode]>) {
  const value = leg.updatedAt ? Date.parse(leg.updatedAt) : 0;
  return Number.isFinite(value) ? value : 0;
}

function removeStopAndClearEdgeLocks(day: ScheduleDay, stopId: string): ScheduleDay {
  const removedIndex = day.stops.findIndex((stop) => stop.id === stopId);
  if (removedIndex < 0) return day;

  const nextStops = day.stops.filter((stop) => stop.id !== stopId);

  return {
    ...day,
    lockedReturnRoute: removedIndex === day.stops.length - 1 ? false : day.lockedReturnRoute,
    stops: nextStops.map((stop, index) =>
      index === removedIndex
        ? {
            ...stop,
            lockedFromPrevious: false
          }
        : stop
    )
  };
}

type ScheduledStopPlace = {
  stop: ScheduleStop;
  place: Place;
};

function createLockedOptimizationPlan(scheduledStops: ScheduledStopPlace[], day: ScheduleDay) {
  const segments: Place[][] = [];
  let currentSegment: Place[] = [];

  scheduledStops.forEach(({ stop, place }, index) => {
    if (index === 0 || stop.lockedFromPrevious === true) {
      currentSegment.push(place);
      return;
    }

    segments.push(currentSegment);
    currentSegment = [place];
  });

  if (currentSegment.length) {
    segments.push(currentSegment);
  }

  return {
    segments,
    fixedFirstSegmentIndex: day.stops[0]?.lockedFromPrevious === true ? 0 : null,
    fixedLastSegmentIndex: day.lockedReturnRoute === true ? segments.length - 1 : null
  };
}

function createOptimizedLockMap(day: ScheduleDay, segments: Place[][]) {
  const lockedByPlaceId = new Map<string, boolean>();
  const shouldLockFirstEdge = day.stops[0]?.lockedFromPrevious === true;

  segments.forEach((segment, segmentIndex) => {
    segment.forEach((place, placeIndex) => {
      lockedByPlaceId.set(place.id, placeIndex > 0 || (shouldLockFirstEdge && segmentIndex === 0 && placeIndex === 0));
    });
  });

  return lockedByPlaceId;
}
