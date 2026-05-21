import { useEffect, type KeyboardEvent } from 'react';
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

type MobileScheduleDaySelectorProps = {
  days: ScheduleDay[];
  selectedDayId: string | null;
  onSelectDay: (dayId: string) => void;
};

export function MobileScheduleDaySelector({ days, selectedDayId, onSelectDay }: MobileScheduleDaySelectorProps) {
  return (
    <section className="md:hidden">
      <div className="soft-panel rounded-xl p-2">
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          일정 기준
        </div>
        {days.length ? (
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map((day, index) => {
              const isSelected = day.id === selectedDayId;
              const dateLabel = formatTravelDate(day.travelDate);

              return (
                <button
                  key={day.id}
                  type="button"
                  className={cn(
                    'grid min-w-[5.4rem] shrink-0 gap-0.5 rounded-xl border px-3 py-2 text-left transition',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  )}
                  onClick={() => onSelectDay(day.id)}
                >
                  <span className="text-sm font-extrabold">DAY-{index + 1}</span>
                  <span className={cn('truncate text-[10px] font-semibold', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
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
  onLoadPhotos: (place: Place) => Promise<void>;
  onSelectPlace: (place: Place) => void;
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
  onLoadPhotos,
  onSelectPlace,
  onEditPlace,
  onDelete,
  onOpenReservations
}: MobilePlacesExplorerProps) {
  useEffect(() => {
    places.forEach((place) => {
      void onLoadPhotos(place);
    });
  }, [onLoadPhotos, places]);

  return (
    <div className="grid gap-3 md:hidden">
      <div className="sticky top-[6.65rem] z-30 -mx-1 rounded-b-2xl bg-background/95 px-1 pb-2 pt-1 shadow-sm shadow-black/5 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="font-semibold">선택 DAY 동선</span>
          <span>{dayPlaces.length}곳 기준</span>
        </div>
        <TravelMap
          places={emptyMapPlaces}
          selectedPlace={selectedPlace}
          referencePlace={referencePlace}
          contextPlaces={dayPlaces}
          status={status}
          isDarkMode={isDarkMode}
          compact
          className="min-h-[196px] rounded-2xl"
          onSelectPlace={onSelectPlace}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-base font-extrabold">{categoryLabel}</h2>
          <p className="text-xs text-muted-foreground">일정 장소와 평균 거리가 가까운 순</p>
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
              onSelect={onSelectPlace}
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
  onSelect: (place: Place) => void;
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
  onSelect,
  onEdit,
  onDelete,
  onOpenReservations
}: MobilePlaceCardProps) {
  const primaryPhoto = photoState.photos[0] ?? null;
  const note = place.googleMapsNote?.trim() ?? '';

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(place);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={cn(
        'soft-panel grid cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'border-primary/45 bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/20' : 'hover:border-primary/25 hover:bg-muted/20'
      )}
      onClick={() => onSelect(place)}
      onKeyDown={handleKeyDown}
      aria-current={isSelected ? 'true' : undefined}
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
          <p className="mt-1.5 truncate text-xs leading-5 text-foreground/75">
            <span className="font-bold text-muted-foreground">대표</span> {place.menu}
          </p>
        ) : null}
        {note ? (
          <p className="truncate text-xs leading-5 text-muted-foreground">
            <span className="font-bold">메모</span> <MarkdownInline text={note} />
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
