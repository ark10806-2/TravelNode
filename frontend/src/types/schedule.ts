export type AppTab = 'places' | 'schedule' | 'todo' | 'usage';

export type ScheduleStop = {
  id: string;
  placeId: string;
  selectedRouteMode?: RouteMode | null;
};

export type ScheduleDay = {
  id: string;
  stops: ScheduleStop[];
  selectedReturnRouteMode?: RouteMode | null;
  hotelPlaceId?: string | null;
};

export type RouteMode = 'driving' | 'transit' | 'walking';

export type RouteModeLegStatus = 'loading' | 'ready' | 'estimated' | 'error';

export type RouteModeLeg = {
  status: RouteModeLegStatus;
  durationLabel: string;
  distanceLabel: string;
  error?: string;
};

export type RouteLeg = Record<RouteMode, RouteModeLeg>;
