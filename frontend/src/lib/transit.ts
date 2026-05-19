import { fetchCachedRouteLeg, saveRouteLegCache } from '@/api/routes';
import { recordApiUsage } from '@/api/usage';
import { googleMapsApiKey } from '@/config/env';
import { loadGoogleMaps } from '@/lib/google-maps';
import { estimateRouteModeLeg, normalizeDepartureTimeMinutes, routeCacheOriginKey, routeModes } from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode, RouteModeLeg } from '@/types/schedule';
import type { Place } from '@/types/travel';

type FetchRouteLegOptions = {
  forceRefresh?: boolean;
  departureTimeMinutes?: number | null;
};

export async function fetchRouteLeg(from: Place, to: Place, options: FetchRouteLegOptions = {}): Promise<RouteLeg> {
  const departureTimeMinutes = normalizeDepartureTimeMinutes(options.departureTimeMinutes);
  const fromCacheKey = routeCacheOriginKey(from, departureTimeMinutes);

  if (!options.forceRefresh) {
    const cachedLeg = await fetchCachedRouteLeg(fromCacheKey, to.id).catch(() => null);
    if (cachedLeg) return cachedLeg;
  }

  if (!googleMapsApiKey) {
    return Object.fromEntries(routeModes.map((mode) => [mode, estimateRouteModeLeg(from, to, mode)])) as RouteLeg;
  }

  try {
    const maps = await loadGoogleMaps(googleMapsApiKey);
    const routes = (await maps.importLibrary('routes')) as google.maps.RoutesLibrary;
    const entries = await Promise.all(
      routeModes.map(async (mode) => [
        mode,
        await fetchRouteModeLeg(maps, routes.Route, from, to, mode, departureTimeMinutes)
      ] as const)
    );
    const leg = Object.fromEntries(entries) as RouteLeg;
    if (isCacheableRouteLeg(leg)) {
      void saveRouteLegCache(fromCacheKey, to.id, leg).catch(() => undefined);
    }

    return leg;
  } catch (error) {
    console.warn(`[Google Maps] 경로 계산 준비 실패: ${describeRouteError(error)}`);
    return Object.fromEntries(routeModes.map((mode) => [mode, estimateRouteModeLeg(from, to, mode)])) as RouteLeg;
  }
}

function isCacheableRouteLeg(leg: RouteLeg) {
  return routeModes.every((mode) => leg[mode].status === 'ready');
}

async function fetchRouteModeLeg(
  maps: typeof google.maps,
  Route: typeof google.maps.routes.Route,
  from: Place,
  to: Place,
  mode: RouteMode,
  departureTimeMinutes: number | null
): Promise<RouteModeLeg> {
  try {
    const result = await fetchUsableRouteResult(maps, Route, from, to, mode, departureTimeMinutes);
    const labels = getRouteLabels(result);

    if (!labels) {
      return {
        ...estimateRouteModeLeg(from, to, mode),
        error: '경로 정보를 찾지 못해 예상값으로 표시합니다.'
      };
    }

    void recordApiUsage('routes').catch(() => undefined);

    return {
      status: 'ready',
      durationLabel: labels.durationLabel,
      distanceLabel: labels.distanceLabel
    };
  } catch (error) {
    console.warn(`[Google Maps] ${mode} 경로 계산 실패 (${from.name} -> ${to.name}): ${describeRouteError(error)}`);
    return {
      ...estimateRouteModeLeg(from, to, mode),
      error: describeRouteError(error)
    };
  }
}

async function fetchUsableRouteResult(
  maps: typeof google.maps,
  Route: typeof google.maps.routes.Route,
  from: Place,
  to: Place,
  mode: RouteMode,
  departureTimeMinutes: number | null
) {
  let lastError: unknown = null;
  const enhancedResult = await routeModeLeg(maps, Route, from, to, mode, true, departureTimeMinutes).catch((error) => {
    lastError = error;
    return null;
  });

  if (getRouteLabels(enhancedResult)) return enhancedResult;

  const basicResult = await routeModeLeg(maps, Route, from, to, mode, false, departureTimeMinutes).catch((error) => {
    lastError = error;
    return null;
  });

  if (getRouteLabels(basicResult)) return basicResult;
  if (!enhancedResult && !basicResult && lastError) throw lastError;

  return basicResult ?? enhancedResult;
}

function routeModeLeg(
  maps: typeof google.maps,
  Route: typeof google.maps.routes.Route,
  from: Place,
  to: Place,
  mode: RouteMode,
  includeLiveOptions: boolean,
  departureTimeMinutes: number | null
) {
  const request: google.maps.routes.ComputeRoutesRequest = {
    origin: { lat: from.latitude, lng: from.longitude },
    destination: { lat: to.latitude, lng: to.longitude },
    travelMode: toGoogleTravelMode(maps, mode),
    fields: [
      'durationMillis',
      'distanceMeters',
      'localizedValues',
      'legs'
    ],
    language: 'ko',
    region: 'JP',
    units: maps.UnitSystem.METRIC
  };

  if (mode === 'driving' && includeLiveOptions) {
    request.departureTime = createDepartureDate(departureTimeMinutes);
    request.routingPreference = google.maps.routes.RoutingPreference.TRAFFIC_AWARE_OPTIMAL;
    request.trafficModel = maps.TrafficModel.BEST_GUESS;
  }

  if (mode === 'transit' && includeLiveOptions) {
    request.departureTime = createDepartureDate(departureTimeMinutes);
  }

  return Route.computeRoutes(request);
}

function getRouteLabels(result: Awaited<ReturnType<typeof routeModeLeg>> | null) {
  const route = result?.routes?.[0];
  const durationLabel =
    route?.localizedValues?.duration ??
    singleLegLocalizedDuration(route?.legs) ??
    formatDurationMillis(route?.durationMillis) ??
    formatDurationMillis(sumLegDurationMillis(route?.legs));
  const distanceLabel =
    route?.localizedValues?.distance ??
    singleLegLocalizedDistance(route?.legs) ??
    formatDistanceMeters(route?.distanceMeters) ??
    formatDistanceMeters(sumLegDistanceMeters(route?.legs));

  if (!durationLabel || !distanceLabel) return null;
  return { durationLabel, distanceLabel };
}

function singleLegLocalizedDuration(legs: google.maps.routes.RouteLeg[] | undefined) {
  return legs?.length === 1 ? legs[0].localizedValues?.duration : null;
}

function singleLegLocalizedDistance(legs: google.maps.routes.RouteLeg[] | undefined) {
  return legs?.length === 1 ? legs[0].localizedValues?.distance : null;
}

function sumLegDurationMillis(legs: google.maps.routes.RouteLeg[] | undefined) {
  if (!legs?.length) return null;
  const values = legs.map((leg) => leg.durationMillis ?? leg.staticDurationMillis);
  if (values.some((value) => !value || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function sumLegDistanceMeters(legs: google.maps.routes.RouteLeg[] | undefined) {
  if (!legs?.length) return null;
  const values = legs.map((leg) => leg.distanceMeters);
  if (values.some((value) => value === undefined || !Number.isFinite(value))) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function toGoogleTravelMode(maps: typeof google.maps, mode: RouteMode) {
  if (mode === 'driving') return maps.TravelMode.DRIVING;
  if (mode === 'walking') return maps.TravelMode.WALKING;
  return maps.TravelMode.TRANSIT;
}

function formatDurationMillis(durationMillis: number | null | undefined) {
  if (!durationMillis || !Number.isFinite(durationMillis)) return null;
  const minutes = Math.max(1, Math.round(durationMillis / 60000));
  if (minutes < 60) return `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function formatDistanceMeters(distanceMeters: number | null | undefined) {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function createDepartureDate(departureTimeMinutes: number | null) {
  const now = new Date();
  if (departureTimeMinutes == null) return now;

  const candidate = new Date(now);
  candidate.setHours(Math.floor(departureTimeMinutes / 60), departureTimeMinutes % 60, 0, 0);

  if (candidate.getTime() < now.getTime() + 5 * 60 * 1000) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

function describeRouteError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
