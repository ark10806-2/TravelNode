export type AppTab = 'places' | 'schedule' | 'reservations' | 'todo' | 'usage';

export type ScheduleStop = {
  id: string;
  placeId: string;
  selectedRouteMode?: RouteMode | null;
  departureTimeMinutes?: number | null;
  lockedFromPrevious?: boolean;
};

export type ScheduleDay = {
  id: string;
  stops: ScheduleStop[];
  selectedReturnRouteMode?: RouteMode | null;
  hotelPlaceId?: string | null;
  departureTimeMinutes?: number | null;
  travelDate?: string | null;
  lockedReturnRoute?: boolean;
};

export type RouteMode = 'driving' | 'transit' | 'walking';

export type RouteModeLegStatus = 'loading' | 'ready' | 'estimated' | 'error';

export type RouteModeLeg = {
  status: RouteModeLegStatus;
  durationLabel: string;
  distanceLabel: string;
  error?: string;
  updatedAt?: string | null;
};

export type RouteLeg = Partial<Record<RouteMode, RouteModeLeg>>;
