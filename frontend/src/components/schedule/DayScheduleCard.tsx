import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, CalendarDays, Gauge, MapPinPlus, MapPinned, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { AccommodationSelectorDialog } from '@/components/dialogs/AccommodationSelectorDialog';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { PlaceContextBadges } from '@/components/place/PlaceContextBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getCategoryBadgeClass,
  getCategoryOption,
  getVisibleGoogleMapsNote,
  getVisiblePlaceDescription
} from '@/lib/place-utils';
import { formatDepartureTime, formatTravelDate, getScheduleHotelPlace, maxStopsPerDay, routeLegKey } from '@/lib/schedule-utils';
import type { Reservation } from '@/types/reservation';
import type { RouteLeg, RouteMode, ScheduleDay } from '@/types/schedule';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';
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
  canCalculatePreciseRoutes: boolean;
  photoCache: Record<string, PhotoState>;
  reservationsByPlaceId: Record<string, Reservation[]>;
  isEditing: boolean;
  isDarkMode: boolean;
  onLoadPhotos: (place: Place, force?: boolean) => Promise<void>;
  onRemoveDay: (dayId: string) => void;
  onAddStops: (dayId: string, placeIds: string[]) => void;
  onRemoveStop: (dayId: string, stopId: string) => void;
  onMoveStop: (dayId: string, stopId: string, direction: -1 | 1) => void;
  onSetDayHotel: (dayId: string, placeId: string | null) => void;
  onSetDayDepartureTime: (dayId: string, departureTimeMinutes: number | null) => void;
  onSetDayTravelDate: (dayId: string, travelDate: string | null) => void;
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
  onOpenReservations: (place: Place, reservations: Reservation[]) => void;
};

export function DayScheduleCard({
  day,
  dayIndex,
  categories,
  places,
  placesById,
  routeLegs,
  visibleRouteModes,
  canCalculatePreciseRoutes,
  photoCache,
  reservationsByPlaceId,
  isEditing,
  isDarkMode,
  onLoadPhotos,
  onRemoveDay,
  onAddStops,
  onRemoveStop,
  onMoveStop,
  onSetDayHotel,
  onSetDayDepartureTime,
  onSetDayTravelDate,
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
  onOpenPlaceDetails,
  onOpenReservations
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
      ? routeLegs[routeLegKey(lastScheduledPlace, hotelPlace, lastStop?.departureTimeMinutes, day.travelDate)]
      : undefined;
  const hasRouteCalculationNeeded = useMemo(() => {
    if (!day.stops.length) return false;
    const modes = visibleRouteModes.length ? visibleRouteModes : [];
    if (!modes.length) return false;

    const missingStopLeg = day.stops.some((stop, index) => {
      const place = placesById.get(stop.placeId);
      if (!place) return false;

      const previousStop = index > 0 ? day.stops[index - 1] : null;
      const previousPlace = index > 0 ? placesById.get(day.stops[index - 1].placeId) : null;
      const edgeFrom = previousPlace ?? hotelPlace;
      if (edgeFrom.id === place.id) return false;

      const departureTimeMinutes = previousStop
        ? previousStop.departureTimeMinutes ?? null
        : day.departureTimeMinutes ?? null;
      const leg = routeLegs[routeLegKey(edgeFrom, place, departureTimeMinutes, day.travelDate)];
      return !leg || modes.some((mode) => !leg[mode]);
    });

    if (missingStopLeg) return true;
    if (!lastScheduledPlace || lastScheduledPlace.id === hotelPlace.id) return false;
    return !returnLeg || modes.some((mode) => !returnLeg[mode]);
  }, [day, hotelPlace, lastScheduledPlace, placesById, returnLeg, routeLegs, visibleRouteModes]);

  function addPlaces(selectedPlaces: Place[]) {
    onAddStops(
      day.id,
      selectedPlaces.map((place) => place.id)
    );
    setIsPickerOpen(false);
  }

  return (
    <section className="soft-panel overflow-hidden rounded-xl sm:rounded-lg">
      <div className="flex flex-col gap-3 border-b bg-muted px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="relative min-w-0 pr-16">
            <h2 className="text-lg font-bold tracking-tight sm:text-2xl">{dayLabel}</h2>
            <span className="absolute right-0 top-1 text-xs font-semibold text-muted-foreground sm:top-1.5">
              {day.stops.length}/{maxStopsPerDay}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="max-w-full rounded-full bg-white dark:bg-secondary/80">
              <Building2 className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{hotelPlace.name}</span>
            </Badge>
            {hasRouteCalculationNeeded ? (
              <Badge variant="outline" className="rounded-full bg-white text-[11px] text-muted-foreground dark:bg-secondary/80">
                경로 계산 필요
              </Badge>
            ) : null}
          </div>
          {isEditing ? (
            <div className="mt-3 grid max-w-2xl gap-2">
              <details className="group rounded-2xl border border-border/80 bg-white p-2.5 dark:bg-secondary/80">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-foreground marker:hidden">
                  <span>시간 설정</span>
                  <span className="text-[11px] font-semibold text-muted-foreground group-open:hidden">
                    {day.travelDate ? formatTravelDate(day.travelDate) : '날짜 미정'} · 숙소 출발 {formatDepartureTime(day.departureTimeMinutes)}
                  </span>
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <label className="rounded-2xl border border-border/80 bg-white p-2.5 dark:bg-secondary/80">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      DAY 날짜
                    </span>
                    <input
                      type="date"
                      className="mt-2 h-9 w-full rounded-xl border border-input bg-white px-2 text-sm font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-secondary/80"
                      value={day.travelDate ?? ''}
                      onChange={(event) => onSetDayTravelDate(day.id, event.currentTarget.value || null)}
                    />
                  </label>
                  <DepartureTimePicker
                    label="숙소 출발 기준"
                    value={day.departureTimeMinutes}
                    description="첫 장소로 이동할 때 사용할 기준 시간입니다."
                    compact
                    onChange={(value) => onSetDayDepartureTime(day.id, value)}
                  />
                </div>
              </details>
              {scheduledPlaces.length > 0 ? (
                <details className="group rounded-2xl border border-border/80 bg-white p-2.5 dark:bg-secondary/80">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-foreground marker:hidden">
                    <span>경로 고급 설정</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {hasRouteCalculationNeeded ? '경로 계산 필요' : '계산값 유지 중'}
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      className="min-w-0 rounded-full px-2 text-xs sm:px-3 sm:text-sm"
                      variant="outline"
                      onClick={onOptimizeRoutes}
                      disabled={isOptimizingRoutes || isRefreshingRoutes}
                    >
                      <Sparkles className={`h-4 w-4 ${isOptimizingRoutes ? 'animate-pulse' : ''}`} />
                      {isOptimizingRoutes ? '최적화 중' : '동선 최적화'}
                    </Button>
                    <Button
                      className="min-w-0 rounded-full px-2 text-xs sm:px-3 sm:text-sm"
                      variant="outline"
                      onClick={onRefreshRoutes}
                      disabled={isRefreshingRoutes || isCalculatingPreciseRoutes || routeRefreshRemainingSeconds > 0}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingRoutes ? 'animate-spin' : ''}`} />
                      {routeRefreshRemainingSeconds > 0 ? `${routeRefreshRemainingSeconds}초 후` : '경로 새로고침'}
                    </Button>
                    <Button
                      className="min-w-0 rounded-full px-2 text-xs sm:px-3 sm:text-sm"
                      variant="outline"
                      onClick={onPreciseRoutes}
                      disabled={!canCalculatePreciseRoutes || isOptimizingRoutes || isRefreshingRoutes || isCalculatingPreciseRoutes}
                      title={
                        canCalculatePreciseRoutes
                          ? '현재 경로를 최신 교통 정보로 다시 계산합니다. API 사용량이 늘 수 있어 필요한 날에만 사용하세요.'
                          : '자동차 이동수단이 표시 중일 때만 정밀계산을 사용할 수 있습니다.'
                      }
                    >
                      <Gauge className={`h-4 w-4 ${isCalculatingPreciseRoutes ? 'animate-pulse' : ''}`} />
                      {isCalculatingPreciseRoutes ? '정밀계산 중' : '정밀계산'}
                    </Button>
                  </div>
                </details>
              ) : null}
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
            {!isEditing && scheduledPlaces.length > 0 ? (
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
                const placeReservations = place ? reservationsByPlaceId[place.id] ?? [] : [];
                const previousStop = index > 0 ? day.stops[index - 1] : null;
                const previousPlace = index > 0 ? placesById.get(day.stops[index - 1].placeId) : null;
                const edgeFrom = previousPlace ?? hotelPlace;
                const edgeDepartureTimeMinutes = previousStop
                  ? previousStop.departureTimeMinutes ?? null
                  : day.departureTimeMinutes ?? null;
                const leg = place && edgeFrom.id !== place.id
                  ? routeLegs[routeLegKey(edgeFrom, place, edgeDepartureTimeMinutes, day.travelDate)]
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
                            <PlaceContextBadges
                              reservations={placeReservations}
                              compact
                              leading={
                                <Badge variant="outline" className={getCategoryBadgeClass(place.category)}>
                                  {getCategoryOption(categories, place.category).emoji}{' '}
                                  {getCategoryOption(categories, place.category).label}
                                </Badge>
                              }
                              onOpenReservations={() => onOpenReservations(place, placeReservations)}
                            />
                            <button
                              type="button"
                              className="mt-1 block max-w-full text-left text-base font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:truncate"
                              onClick={() => onOpenPlaceDetails(place)}
                            >
                              {place.name}
                            </button>
                            <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground sm:line-clamp-1">{place.menu}</div>
                            {getVisiblePlaceDescription(place) ? (
                              <div className="mt-1 hidden line-clamp-2 text-sm leading-5 text-foreground/75 sm:block">
                                설명: <MarkdownInline text={getVisiblePlaceDescription(place)} />
                              </div>
                            ) : null}
                            {getVisibleGoogleMapsNote(place) ? (
                              <div className="mt-1 hidden line-clamp-2 text-sm leading-5 text-muted-foreground sm:block">
                                메모: <MarkdownInline text={getVisibleGoogleMapsNote(place)} />
                              </div>
                            ) : null}
                            {isEditing ? (
                              <details className="group mt-3 rounded-2xl border border-border/80 bg-muted/50 p-2">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-foreground marker:hidden">
                                  <span>출발 기준</span>
                                </summary>
                                <div className="mt-2">
                                  <DepartureTimePicker
                                    label="이 장소 출발 기준"
                                    value={stop.departureTimeMinutes}
                                    description="이 장소에서 다음 목적지로 이동할 때 반영합니다."
                                    compact
                                    onChange={(value) => onSetStopDepartureTime(day.id, stop.id, value)}
                                  />
                                </div>
                              </details>
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
          scheduledPlaces={scheduledPlaces}
          anchorPlace={hotelPlace}
          excludedPlaceIds={scheduledPlaceIds}
          maxSelectable={maxStopsPerDay - day.stops.length}
          photoCache={photoCache}
          isDarkMode={isDarkMode}
          onLoadPhotos={onLoadPhotos}
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
