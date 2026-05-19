import { CalendarPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PlaceDetailDialog } from '@/components/dialogs/PlaceDetailDialog';
import { PlacePhotoDialog } from '@/components/dialogs/PlacePhotoDialog';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { useSchedule } from '@/hooks/useSchedule';
import { loadEnabledRouteModes } from '@/lib/route-preferences';
import { scheduleRoutePairs } from '@/lib/schedule-state';
import type { RouteLeg, RouteMode, ScheduleDay } from '@/types/schedule';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';
import { DayScheduleCard } from './DayScheduleCard';

type SchedulePageProps = {
  categories: CategoryOption[];
  places: Place[];
  isEditing: boolean;
  isDarkMode: boolean;
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place, force?: boolean) => Promise<void>;
};

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};
const routeRefreshCooldownMs = 10_000;

export function SchedulePage({ categories, places, isEditing, isDarkMode, photoCache, onLoadPhotos }: SchedulePageProps) {
  const [detailTarget, setDetailTarget] = useState<Place | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Place | null>(null);
  const [refreshingDayId, setRefreshingDayId] = useState<string | null>(null);
  const [preciseDayId, setPreciseDayId] = useState<string | null>(null);
  const [optimizingDayId, setOptimizingDayId] = useState<string | null>(null);
  const [enabledRouteModes] = useState(loadEnabledRouteModes);
  const [routeRefreshAvailableAtByDay, setRouteRefreshAvailableAtByDay] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const {
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
  } = useSchedule(places, isEditing, enabledRouteModes);
  const currentDetailTarget = detailTarget ? placesById.get(detailTarget.id) ?? detailTarget : null;
  const currentPhotoTarget = photoTarget ? placesById.get(photoTarget.id) ?? photoTarget : null;
  const canCalculatePreciseRoutes = enabledRouteModes.includes('driving');
  const routeCalculatedAtByDay = useMemo(
    () => Object.fromEntries(
      days.map((day) => [
        day.id,
        formatRouteCalculatedAt(getLatestRouteCalculatedAt(day, placesById, routeLegs, enabledRouteModes))
      ])
    ),
    [days, enabledRouteModes, placesById, routeLegs]
  );
  const hasActiveRefreshCooldown = useMemo(
    () => Object.values(routeRefreshAvailableAtByDay).some((availableAt) => availableAt > currentTime),
    [routeRefreshAvailableAtByDay, currentTime]
  );

  useEffect(() => {
    if (!hasActiveRefreshCooldown) return undefined;

    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveRefreshCooldown]);

  function openDetails(place: Place) {
    setDetailTarget(place);
    void onLoadPhotos(place);
  }

  function openPhotos(place: Place) {
    setPhotoTarget(place);
    void onLoadPhotos(place);
  }

  async function refreshRoutes(dayId: string) {
    const now = Date.now();
    const availableAt = routeRefreshAvailableAtByDay[dayId] ?? 0;
    if (refreshingDayId || now < availableAt) return;

    setCurrentTime(now);
    setRouteRefreshAvailableAtByDay((current) => ({
      ...current,
      [dayId]: now + routeRefreshCooldownMs
    }));
    setRefreshingDayId(dayId);
    try {
      await refreshDayRoutes(dayId);
    } finally {
      setRefreshingDayId(null);
    }
  }

  async function preciseRoutes(dayId: string) {
    if (!canCalculatePreciseRoutes || preciseDayId) return;

    setPreciseDayId(dayId);
    try {
      await calculatePreciseDayRoutes(dayId);
    } finally {
      setPreciseDayId(null);
    }
  }

  async function optimizeRoutes(dayId: string) {
    if (optimizingDayId) return;

    setOptimizingDayId(dayId);
    try {
      await optimizeDayRoutes(dayId);
    } finally {
      setOptimizingDayId(null);
    }
  }

  return (
    <PageContainer className="gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase text-primary sm:mb-3 sm:px-3 sm:text-xs">
            Schedule
          </p>
          <h1 className="text-2xl font-bold tracking-normal sm:text-5xl">여행 일정</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">DAY별로 장소를 배치하고 이동 순서를 조정합니다.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {scheduleStatus === 'loading'
              ? '일정을 불러오는 중입니다.'
              : isSavingSchedule
                ? '일정을 저장하는 중입니다.'
                : '일정은 서버 DB에 저장됩니다.'}
          </p>
        </div>
        {isEditing ? (
          <div className="grid gap-2 sm:flex sm:items-center">
            <Button className="rounded-full" onClick={addDay} disabled={isSavingSchedule}>
              <CalendarPlus className="h-4 w-4" />
              DAY 추가
            </Button>
          </div>
        ) : null}
      </header>

      {scheduleStatus === 'error' && scheduleError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {scheduleError}
        </div>
      ) : null}

      <div className="grid gap-4">
        {days.map((day, index) => (
          <DayScheduleCard
            key={day.id}
            day={day}
            dayIndex={index}
            categories={categories}
            places={places}
            placesById={placesById}
            routeLegs={routeLegs}
            visibleRouteModes={enabledRouteModes}
            routeCalculatedAtLabel={routeCalculatedAtByDay[day.id]}
            canCalculatePreciseRoutes={canCalculatePreciseRoutes}
            isEditing={isEditing}
            isDarkMode={isDarkMode}
            onRemoveDay={removeDay}
            onAddStops={addStops}
            onRemoveStop={removeStop}
            onMoveStop={moveStop}
            onSetDayHotel={setDayHotel}
            onSetDayDepartureTime={setDayDepartureTime}
            onSetDayTravelDate={setDayTravelDate}
            onSetStopDepartureTime={setStopDepartureTime}
            onToggleStopEdgeLock={toggleStopEdgeLock}
            onToggleReturnEdgeLock={toggleReturnEdgeLock}
            isOptimizingRoutes={optimizingDayId === day.id}
            onOptimizeRoutes={() => void optimizeRoutes(day.id)}
            isRefreshingRoutes={refreshingDayId === day.id}
            isCalculatingPreciseRoutes={preciseDayId === day.id}
            routeRefreshRemainingSeconds={Math.max(
              0,
              Math.ceil(((routeRefreshAvailableAtByDay[day.id] ?? 0) - currentTime) / 1000)
            )}
            onRefreshRoutes={() => void refreshRoutes(day.id)}
            onPreciseRoutes={() => void preciseRoutes(day.id)}
            onOpenPlaceDetails={openDetails}
          />
        ))}
      </div>

      {currentDetailTarget ? (
        <PlaceDetailDialog
          place={currentDetailTarget}
          categories={categories}
          photoState={photoCache[currentDetailTarget.id] ?? emptyPhotoState}
          onClose={() => setDetailTarget(null)}
          onOpenPhotos={openPhotos}
        />
      ) : null}

      {currentPhotoTarget ? (
        <PlacePhotoDialog
          place={currentPhotoTarget}
          categories={categories}
          photoState={photoCache[currentPhotoTarget.id] ?? emptyPhotoState}
          onClose={() => setPhotoTarget(null)}
          onRetry={() => void onLoadPhotos(currentPhotoTarget, true)}
        />
      ) : null}
    </PageContainer>
  );
}

function getLatestRouteCalculatedAt(
  day: ScheduleDay,
  placesById: Map<string, Place>,
  routeLegs: Record<string, RouteLeg>,
  visibleRouteModes: RouteMode[]
) {
  const timestamps = scheduleRoutePairs(day, placesById)
    .flatMap(({ key }) =>
      visibleRouteModes.flatMap((mode) => {
        const modeLeg = routeLegs[key]?.[mode];
        return modeLeg?.status === 'ready' && modeLeg.updatedAt ? [Date.parse(modeLeg.updatedAt)] : [];
      })
    )
    .filter((timestamp) => Number.isFinite(timestamp));

  return timestamps.length ? Math.max(...timestamps) : null;
}

function formatRouteCalculatedAt(timestamp: number | null) {
  if (timestamp == null) return null;

  const date = new Date(timestamp);
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day} ${hour}:${minute} 기준으로 계산됨`;
}
