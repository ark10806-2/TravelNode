import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { CalendarDays, Images, Pencil, Trash2 } from 'lucide-react';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { PlaceContextBadges } from '@/components/place/PlaceContextBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTravelDate } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import type { ScheduleDay } from '@/types/schedule';
import type { NearbyPlace, PhotoState, Place } from '@/types/travel';
import { TravelMap } from './TravelMap';

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};
const emptyMapPlaces: Place[] = [];
const compactRouteMapHeight = 188;
const expandedRouteMapHeight = 256;
const fallbackShrinkDistance = 220;

type MobileScheduleDaySelectorProps = {
  days: ScheduleDay[];
  selectedDayId: string | null;
  onSelectDay: (dayId: string) => void;
};

export function MobileScheduleDaySelector({ days, selectedDayId, onSelectDay }: MobileScheduleDaySelectorProps) {
  const shouldScroll = days.length > 4;

  return (
    <section className="md:hidden">
      <div className="soft-panel rounded-xl p-2">
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          일정 기준
        </div>
        {days.length ? (
          <div
            className={cn(
              'gap-1.5 pb-1',
              shouldScroll
                ? 'flex snap-x overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                : 'grid'
            )}
            style={shouldScroll ? undefined : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day, index) => {
              const isSelected = day.id === selectedDayId;
              const dateLabel = formatTravelDate(day.travelDate);

              return (
                <button
                  key={day.id}
                  type="button"
                  className={cn(
                    'grid gap-0.5 rounded-xl border px-2 py-2 text-center transition',
                    shouldScroll ? 'min-w-[calc((100%-1.125rem)/4)] shrink-0 snap-start' : 'min-w-0',
                    isSelected
                      ? 'border-primary/20 bg-accent text-primary shadow-[0_1px_2px_rgba(0,27,55,0.04)]'
                      : 'border-border bg-white text-foreground hover:border-primary/30 dark:bg-secondary/80'
                  )}
                  onClick={() => onSelectDay(day.id)}
                >
                  <span className="truncate text-[13px] font-extrabold leading-tight">DAY-{index + 1}</span>
                  <span className={cn('truncate text-[9px] font-semibold leading-tight', isSelected ? 'text-primary/70' : 'text-muted-foreground')}>
                    {dateLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">아직 일정 DAY가 없습니다.</div>
        )}
      </div>
    </section>
  );
}

type MobilePlacesExplorerProps = {
  places: NearbyPlace[];
  selectedPlace: Place | null;
  dayPlaces: Place[];
  referencePlace: Place;
  status: 'loading' | 'ready' | 'error';
  isDarkMode: boolean;
  categoryLabel: string;
  photoCache: Record<string, PhotoState>;
  reservationsByPlaceId: Record<string, Reservation[]>;
  scheduleLabelsByPlaceId: Record<string, string[]>;
  duplicatePlaceIds: Set<string>;
  isEditing: boolean;
  deletingId: string | null;
  addingSchedulePlaceId: string | null;
  selectedDayLabel: string;
  scheduleActionMessage?: string;
  onLoadPhotos: (place: Place) => Promise<void>;
  onSelectPlace: (place: Place) => void;
  onOpenPlaceDetails: (place: Place) => void;
  onEditPlace: (place: Place) => void;
  onDelete: (place: Place) => void;
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
};

export function MobilePlacesExplorer({
  places,
  selectedPlace,
  dayPlaces,
  referencePlace,
  status,
  isDarkMode,
  categoryLabel,
  photoCache,
  reservationsByPlaceId,
  scheduleLabelsByPlaceId,
  duplicatePlaceIds,
  isEditing,
  deletingId,
  addingSchedulePlaceId,
  selectedDayLabel,
  scheduleActionMessage,
  onLoadPhotos,
  onSelectPlace,
  onOpenPlaceDetails,
  onEditPlace,
  onDelete,
  onOpenReservations
}: MobilePlacesExplorerProps) {
  const mapShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    places.forEach((place) => {
      void onLoadPhotos(place);
    });
  }, [onLoadPhotos, places]);

  useLayoutEffect(() => {
    let shrinkStartTop: number | null = null;
    let animationFrame = 0;
    let stickyTop = 0;

    function measureStickyTop() {
      const shell = mapShellRef.current;
      if (!shell) return;
      stickyTop = Number.parseFloat(window.getComputedStyle(shell).top) || 0;
    }

    function updateMapHeight() {
      const shell = mapShellRef.current;
      if (!shell) return;

      const shellTop = shell.getBoundingClientRect().top;
      const freeScrollTop = Math.max(shellTop, stickyTop);

      if (shellTop > stickyTop + 1) {
        shrinkStartTop = Math.max(shrinkStartTop ?? shellTop, shellTop);
      }

      const startTop = shrinkStartTop ?? stickyTop + fallbackShrinkDistance;
      const shrinkDistance = Math.max(startTop - stickyTop, 1);
      const progress = Math.min(Math.max((startTop - freeScrollTop) / shrinkDistance, 0), 1);
      const nextHeight = expandedRouteMapHeight - (expandedRouteMapHeight - compactRouteMapHeight) * progress;

      shell.style.setProperty('--mobile-route-map-height', `${nextHeight.toFixed(2)}px`);
    }

    function requestUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        updateMapHeight();
      });
    }

    function handleResize() {
      shrinkStartTop = null;
      measureStickyTop();
      requestUpdate();
    }

    measureStickyTop();
    updateMapHeight();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="grid gap-3 md:hidden">
      <div
        ref={mapShellRef}
        data-mobile-route-map-shell
        className="sticky top-0 z-50 -mx-1 self-start rounded-b-2xl bg-background/95 px-1 pb-2 shadow-sm shadow-black/5 backdrop-blur [--mobile-route-map-height:256px] [contain:layout_paint_style] [will-change:height]"
      >
        <div className="pointer-events-none absolute left-3 right-3 top-2 z-10 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="rounded-full border border-border/75 bg-background/90 px-2.5 py-1 font-semibold shadow-sm backdrop-blur">
            선택 DAY 동선
          </div>
          <div className="rounded-full border border-border/75 bg-background/90 px-2.5 py-1 font-semibold shadow-sm backdrop-blur">
            {dayPlaces.length}곳 기준
          </div>
        </div>
        <TravelMap
          places={emptyMapPlaces}
          selectedPlace={selectedPlace}
          referencePlace={referencePlace}
          contextPlaces={dayPlaces}
          status={status}
          isDarkMode={isDarkMode}
          compact
          height="var(--mobile-route-map-height)"
          className="rounded-b-2xl rounded-t-none"
          onSelectPlace={onSelectPlace}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-base font-extrabold">{categoryLabel}</h2>
          <p className="text-xs text-muted-foreground">일정 장소와 평균 거리가 가까운 순 · 선택 후 길게 눌러 상세</p>
          {scheduleActionMessage ? (
            <p className="mt-1 text-xs font-semibold text-primary">{scheduleActionMessage}</p>
          ) : null}
        </div>
        <Badge variant="outline" className="rounded-full bg-background">
          {places.length}곳
        </Badge>
      </div>

      <div className="grid gap-2">
        {places.length ? (
          places.map((place) => (
            <MobilePlaceCard
              key={place.id}
              place={place}
              isSelected={selectedPlace?.id === place.id}
              photoState={photoCache[place.id] ?? emptyPhotoState}
              reservations={reservationsByPlaceId[place.id] ?? []}
              scheduleLabels={scheduleLabelsByPlaceId[place.id] ?? []}
              isDuplicateCandidate={duplicatePlaceIds.has(place.id)}
              isEditing={isEditing}
              isDeleting={deletingId === place.id}
              isAddingToSchedule={addingSchedulePlaceId === place.id}
              selectedDayLabel={selectedDayLabel}
              onSelect={onSelectPlace}
              onOpenDetails={onOpenPlaceDetails}
              onEdit={onEditPlace}
              onDelete={onDelete}
              onOpenReservations={onOpenReservations}
            />
          ))
        ) : (
          <div className="soft-panel grid min-h-28 place-items-center rounded-xl p-5 text-center text-sm text-muted-foreground">
            이 카테고리의 장소가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

type MobilePlaceCardProps = {
  place: NearbyPlace;
  isSelected: boolean;
  photoState: PhotoState;
  reservations: Reservation[];
  scheduleLabels: string[];
  isDuplicateCandidate: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isAddingToSchedule: boolean;
  selectedDayLabel: string;
  onSelect: (place: Place) => void;
  onOpenDetails: (place: Place) => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
};

function MobilePlaceCard({
  place,
  isSelected,
  photoState,
  reservations,
  scheduleLabels,
  isDuplicateCandidate,
  isEditing,
  isDeleting,
  isAddingToSchedule,
  selectedDayLabel,
  onSelect,
  onOpenDetails,
  onEdit,
  onDelete,
  onOpenReservations
}: MobilePlaceCardProps) {
  const primaryPhoto = photoState.photos[0] ?? null;
  const note = place.googleMapsNote?.trim() ?? '';
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function handlePlaceTap() {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    onSelect(place);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!isSelected) return;

    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      longPressTimerRef.current = null;
      onOpenDetails(place);
    }, 560);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!longPressTimerRef.current || !pointerStartRef.current) return;

    const movedX = Math.abs(event.clientX - pointerStartRef.current.x);
    const movedY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (movedX > 10 || movedY > 10) clearLongPressTimer();
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isSelected) {
      onOpenDetails(place);
      return;
    }

    onSelect(place);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handlePlaceTap();
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={cn(
        'soft-panel grid cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isAddingToSchedule && 'opacity-75',
        isSelected ? 'border-primary/45 bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/20' : 'hover:border-primary/25 hover:bg-muted/20'
      )}
      onClick={handlePlaceTap}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      onContextMenu={(event) => {
        if (!isSelected) return;
        event.preventDefault();
      }}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`${place.name} 선택. 선택된 상태에서 길게 누르거나 더블클릭하면 상세 정보를 열고 ${selectedDayLabel}에 추가할 수 있습니다.`}
    >
      <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border bg-muted">
        {primaryPhoto ? (
          <img src={primaryPhoto.url} alt={`${place.name} 대표 사진`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-secondary">
            <Images className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {photoState.status === 'loading' ? <div className="absolute inset-0 animate-pulse bg-background/45" /> : null}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-5">{place.name}</h3>
          <span className="w-14 shrink-0 pt-0.5 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
            {place.distanceFromSelectedKm.toFixed(1)}km
          </span>
        </div>

        <PlaceContextBadges
          reservations={reservations}
          scheduleLabels={scheduleLabels}
          isDuplicateCandidate={isDuplicateCandidate}
          compact
          className="mt-1.5"
          onOpenReservations={onOpenReservations ? () => onOpenReservations(place, reservations) : undefined}
        />

        {place.menu ? (
          <p className="mt-1.5 truncate text-xs leading-5 text-foreground/75">{place.menu}</p>
        ) : null}
        {note ? (
          <p className="truncate text-xs leading-5 text-muted-foreground">
            <MarkdownInline text={note} />
          </p>
        ) : null}

        {isEditing ? (
          <div className="mt-2 flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-2 text-[11px]"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(place);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(place);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
