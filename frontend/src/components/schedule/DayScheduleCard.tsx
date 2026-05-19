import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Gauge, MapPinPlus, MapPinned, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { AccommodationSelectorDialog } from '@/components/dialogs/AccommodationSelectorDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategoryBadgeClass, getCategoryOption, getGoogleMapsNoteLabel } from '@/lib/place-utils';
import { formatDepartureTime, getScheduleHotelPlace, maxStopsPerDay, routeLegKey } from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode, ScheduleDay } from '@/types/schedule';
import type { CategoryOption, Place } from '@/types/travel';
import { DayRouteMapDialog } from './DayRouteMapDialog';
import { DepartureTimePicker } from './DepartureTimePicker';
import { PlacePickerDialog } from './PlacePickerDialog';
import { RouteLegRow } from './RouteLegRow';

type DayScheduleCardProps = {
  day: ScheduleDay;
  dayIndex: number;
  categories: CategoryOption[];
  places: Place[];
  placesById: Map<string, Place>;
  routeLegs: Record<string, RouteLeg>;
  visibleRouteModes: RouteMode[];
  isEditing: boolean;
  isDarkMode: boolean;
  onRemoveDay: (dayId: string) => void;
  onAddStops: (dayId: string, placeIds: string[]) => void;
  onRemoveStop: (dayId: string, stopId: string) => void;
  onMoveStop: (dayId: string, stopId: string, direction: -1 | 1) => void;
  onSetDayHotel: (dayId: string, placeId: string | null) => void;
  onSetDayDepartureTime: (dayId: string, departureTimeMinutes: number | null) => void;
  onSetStopDepartureTime: (dayId: string, stopId: string, departureTimeMinutes: number | null) => void;
  onToggleStopEdgeLock: (dayId: string, stopId: string) => void;
  onToggleReturnEdgeLock: (dayId: string) => void;
  isOptimizingRoutes: boolean;
  onOptimizeRoutes: () => void;
  isRefreshingRoutes: boolean;
  isCalculatingPreciseRoutes: boolean;
  routeRefreshRemainingSeconds: number;
  onRefreshRoutes: () => void;
  onPreciseRoutes: () => void;
  onOpenPlaceDetails: (place: Place) => void;
};

export function DayScheduleCard({
  day,
  dayIndex,
  categories,
  places,
  placesById,
  routeLegs,
  visibleRouteModes,
  isEditing,
  isDarkMode,
  onRemoveDay,
  onAddStops,
  onRemoveStop,
  onMoveStop,
  onSetDayHotel,
  onSetDayDepartureTime,
  onSetStopDepartureTime,
  onToggleStopEdgeLock,
  onToggleReturnEdgeLock,
  isOptimizingRoutes,
  onOptimizeRoutes,
  isRefreshingRoutes,
  isCalculatingPreciseRoutes,
  routeRefreshRemainingSeconds,
  onRefreshRoutes,
  onPreciseRoutes,
  onOpenPlaceDetails
}: DayScheduleCardProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isHotelPickerOpen, setIsHotelPickerOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const scheduledPlaceIds = useMemo(() => new Set(day.stops.map((stop) => stop.placeId)), [day.stops]);
  const scheduledPlaces = useMemo(
    () => day.stops.map((stop) => placesById.get(stop.placeId)).filter((place): place is Place => Boolean(place)),
    [day.stops, placesById]
  );
  const isFull = day.stops.length >= maxStopsPerDay;
  const dayLabel = `DAY ${dayIndex + 1}`;
  const hotelPlace = useMemo(() => getScheduleHotelPlace(day, placesById), [day, placesById]);
  const lastScheduledPlace = scheduledPlaces[scheduledPlaces.length - 1] ?? null;
  const lastStop = day.stops[day.stops.length - 1] ?? null;
  const returnLeg =
    lastScheduledPlace && lastScheduledPlace.id !== hotelPlace.id
      ? routeLegs[routeLegKey(lastScheduledPlace, hotelPlace, lastStop?.departureTimeMinutes)]
      : undefined;

  function addPlaces(selectedPlaces: Place[]) {
    onAddStops(
      day.id,
      selectedPlaces.map((place) => place.id)
    );
    setIsPickerOpen(false);
  }

  return (
    <section className="soft-panel overflow-hidden rounded-xl sm:rounded-lg">
      <div className="flex flex-col gap-3 border-b bg-secondary/90 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-primary text-primary-foreground">{dayLabel}</Badge>
            <Badge variant="outline" className="rounded-full bg-background">
              {day.stops.length}/{maxStopsPerDay}
            </Badge>
          </div>
          <h2 className="mt-2 text-lg font-bold tracking-tight sm:text-2xl">{dayLabel}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">방문 순서를 정하고 장소 간 이동 시간을 비교합니다.</p>
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">숙소</span>
            <span className="truncate font-semibold text-foreground">{hotelPlace.name}</span>
          </div>
          {isEditing ? (
            <div className="mt-3 max-w-xl">
              <DepartureTimePicker
                label="숙소 출발 기준"
                value={day.departureTimeMinutes}
                description="첫 장소로 이동할 때 사용할 기준 시간입니다."
                compact
                onChange={(value) => onSetDayDepartureTime(day.id, value)}
              />
            </div>
          ) : day.departureTimeMinutes != null ? (
            <div className="mt-2 inline-flex rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              숙소 출발 {formatDepartureTime(day.departureTimeMinutes)}
            </div>
          ) : null}
        </div>
        {scheduledPlaces.length > 0 || isEditing ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {scheduledPlaces.length ? (
              <Button
                className="min-w-0 flex-1 rounded-full px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
                variant="outline"
                onClick={() => setIsRouteMapOpen(true)}
              >
                <MapPinned className="h-4 w-4" />
                동선 지도
              </Button>
            ) : null}
            {isEditing && scheduledPlaces.length > 0 ? (
              <Button
                className="min-w-0 flex-1 rounded-full px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
                variant="outline"
                onClick={onOptimizeRoutes}
                disabled={isOptimizingRoutes || isRefreshingRoutes}
              >
                <Sparkles className={`h-4 w-4 ${isOptimizingRoutes ? 'animate-pulse' : ''}`} />
                {isOptimizingRoutes ? '최적화 중' : '동선 최적화'}
              </Button>
            ) : null}
            {scheduledPlaces.length > 0 ? (
              <Button
                className="min-w-0 flex-1 rounded-full px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
                variant="outline"
                onClick={onRefreshRoutes}
                disabled={isRefreshingRoutes || isCalculatingPreciseRoutes || routeRefreshRemainingSeconds > 0}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshingRoutes ? 'animate-spin' : ''}`} />
                {routeRefreshRemainingSeconds > 0 ? `${routeRefreshRemainingSeconds}초 후` : '경로 새로고침'}
              </Button>
            ) : null}
            {isEditing && scheduledPlaces.length > 0 ? (
              <Button
                className="min-w-0 flex-1 rounded-full px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
                variant="outline"
                onClick={onPreciseRoutes}
                disabled={isOptimizingRoutes || isRefreshingRoutes || isCalculatingPreciseRoutes}
                title="정밀계산은 이 DAY의 현재 이동 경로를 Google Routes API로 강제 새로고침합니다. 자동차가 표시 중이면 실시간 교통(TRAFFIC_AWARE_OPTIMAL)을 반영해 더 정확하지만 API 사용량이 늘어납니다. 출발 시간이나 교통 상황이 중요한 날에만 사용하세요."
              >
                <Gauge className={`h-4 w-4 ${isCalculatingPreciseRoutes ? 'animate-pulse' : ''}`} />
                {isCalculatingPreciseRoutes ? '정밀계산 중' : '정밀계산'}
              </Button>
            ) : null}
            {isEditing ? (
              <>
                <Button
                  className="min-w-0 rounded-full px-2 text-xs sm:px-3 sm:text-sm"
                  variant="outline"
                  onClick={() => setIsHotelPickerOpen(true)}
                >
                  <Building2 className="h-4 w-4" />
                  숙소 변경
                </Button>
                <Button
                  className="min-w-0 rounded-full px-2 text-xs sm:px-3 sm:text-sm"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={isFull || !places.length}
                >
                  <MapPinPlus className="h-4 w-4" />
                  장소 추가
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 justify-self-end rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:justify-self-auto"
                  onClick={() => onRemoveDay(day.id)}
                  aria-label={`${dayLabel} 삭제`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 p-2 sm:gap-4 sm:p-4">
        <div className="grid gap-0 bg-background">
          {day.stops.length ? (
            <>
              {day.stops.map((stop, index) => {
                const place = placesById.get(stop.placeId);
                const previousStop = index > 0 ? day.stops[index - 1] : null;
                const previousPlace = index > 0 ? placesById.get(day.stops[index - 1].placeId) : null;
                const edgeFrom = previousPlace ?? hotelPlace;
                const edgeDepartureTimeMinutes = previousStop
                  ? previousStop.departureTimeMinutes ?? null
                  : day.departureTimeMinutes ?? null;
                const leg = place && edgeFrom.id !== place.id
                  ? routeLegs[routeLegKey(edgeFrom, place, edgeDepartureTimeMinutes)]
                  : undefined;

                return (
                  <div key={stop.id}>
                    {place && edgeFrom.id !== place.id ? (
                      <RouteLegRow
                        from={edgeFrom}
                        to={place}
                        leg={leg}
                        selectedMode={stop.selectedRouteMode}
                        departureTimeMinutes={edgeDepartureTimeMinutes}
                        visibleModes={visibleRouteModes}
                        isEditing={isEditing}
                        isLocked={stop.lockedFromPrevious === true}
                        onToggleLock={() => onToggleStopEdgeLock(day.id, stop.id)}
                      />
                    ) : null}
                    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 rounded-lg px-1.5 py-3 transition hover:bg-muted/25 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-3">
                      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-foreground text-sm font-bold text-background sm:mt-0 sm:h-8 sm:w-8">
                        {index + 1}
                      </div>
                      {place ? (
                        <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={getCategoryBadgeClass(place.category)}>
                                {getCategoryOption(categories, place.category).emoji}{' '}
                                {getCategoryOption(categories, place.category).label}
                              </Badge>
                            </div>
                            <button
                              type="button"
                              className="mt-1 block max-w-full text-left text-base font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:truncate"
                              onClick={() => onOpenPlaceDetails(place)}
                            >
                              {place.name}
                            </button>
                            <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground sm:line-clamp-1">{place.menu}</div>
                            <div className="mt-1 line-clamp-2 text-sm leading-5 text-foreground/75">{place.description}</div>
                            <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                              메모: {getGoogleMapsNoteLabel(place)}
                            </div>
                            {isEditing ? (
                              <div className="mt-3">
                                <DepartureTimePicker
                                  label="이 장소 출발 기준"
                                  value={stop.departureTimeMinutes}
                                  description="이 장소에서 다음 목적지로 이동할 때 반영합니다."
                                  compact
                                  onChange={(value) => onSetStopDepartureTime(day.id, stop.id, value)}
                                />
                              </div>
                            ) : stop.departureTimeMinutes != null ? (
                              <div className="mt-2 inline-flex rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
                                출발 기준 {formatDepartureTime(stop.departureTimeMinutes)}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-start gap-1 md:justify-end">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
                                  onClick={() => onMoveStop(day.id, stop.id, -1)}
                                  disabled={index === 0}
                                  aria-label={`${place.name} 앞으로 이동`}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
                                  onClick={() => onMoveStop(day.id, stop.id, 1)}
                                  disabled={index === day.stops.length - 1}
                                  aria-label={`${place.name} 뒤로 이동`}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </>
                            ) : null}
                            {isEditing ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9"
                                onClick={() => onRemoveStop(day.id, stop.id)}
                                aria-label={`${place.name} 일정에서 제외`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">삭제된 장소</div>
                            <div className="text-sm text-muted-foreground">장소 목록에서 찾을 수 없습니다.</div>
                          </div>
                          {isEditing ? (
                            <Button variant="ghost" size="sm" onClick={() => onRemoveStop(day.id, stop.id)}>
                              제외
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {lastScheduledPlace && lastScheduledPlace.id !== hotelPlace.id ? (
                <RouteLegRow
                  from={lastScheduledPlace}
                  to={hotelPlace}
                  leg={returnLeg}
                  selectedMode={day.selectedReturnRouteMode}
                  departureTimeMinutes={lastStop?.departureTimeMinutes ?? null}
                  visibleModes={visibleRouteModes}
                  isEditing={isEditing}
                  isLocked={day.lockedReturnRoute === true}
                  onToggleLock={() => onToggleReturnEdgeLock(day.id)}
                />
              ) : null}
            </>
          ) : (
            <div className="grid min-h-40 place-items-center px-4 py-8 text-center text-sm text-muted-foreground">
              <div>
                <MapPinPlus className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold text-foreground">아직 장소가 없습니다.</p>
                <p className="mt-1">{isEditing ? '장소 추가 버튼으로 후보를 골라보세요.' : '최상단 편집을 누르면 장소를 추가할 수 있습니다.'}</p>
                {isEditing ? (
                  <Button className="mt-4 rounded-full" onClick={() => setIsPickerOpen(true)} disabled={isFull || !places.length}>
                    <MapPinPlus className="h-4 w-4" />
                    장소 추가
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      {isPickerOpen ? (
        <PlacePickerDialog
          dayLabel={dayLabel}
          categories={categories}
          places={places}
          excludedPlaceIds={scheduledPlaceIds}
          maxSelectable={maxStopsPerDay - day.stops.length}
          onClose={() => setIsPickerOpen(false)}
          onSelect={addPlaces}
        />
      ) : null}
      {isHotelPickerOpen ? (
        <AccommodationSelectorDialog
          title={`${dayLabel} 숙소 지정`}
          description="이 DAY의 출발지와 도착지로 사용할 숙소를 선택합니다. 기본 숙소를 고르면 기존 기준점으로 돌아갑니다."
          places={places}
          categories={categories}
          selectedPlaceId={day.hotelPlaceId ?? null}
          onSelect={(placeId) => onSetDayHotel(day.id, placeId)}
          onClose={() => setIsHotelPickerOpen(false)}
        />
      ) : null}
      {isRouteMapOpen ? (
        <DayRouteMapDialog
          dayLabel={dayLabel}
          places={scheduledPlaces}
          anchorPlace={hotelPlace}
          isDarkMode={isDarkMode}
          onClose={() => setIsRouteMapOpen(false)}
        />
      ) : null}
    </section>
  );
}
