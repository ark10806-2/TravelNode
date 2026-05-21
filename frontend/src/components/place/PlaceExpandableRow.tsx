import { ChevronDown } from 'lucide-react';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getVisibleGoogleMapsNote, getVisiblePlaceDescription } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { PlaceContextBadges } from './PlaceContextBadges';
import { PlaceExpandedDetails } from './PlaceExpandedDetails';
import { PlaceThumbnailButton } from './PlaceThumbnailButton';

type PlaceExpandableRowProps = {
  place: NearbyPlace;
  referencePlace: Place;
  category: CategoryOption;
  photoState: PhotoState;
  reservations: Reservation[];
  scheduleLabels: string[];
  isDuplicateCandidate: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  enableExpandedDetails: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isMovingCategory: boolean;
  categories: CategoryOption[];
  hasDivider: boolean;
  onToggle: (place: NearbyPlace) => void;
  onSelect?: (place: Place) => void;
  onOpenDetails?: (place: Place) => void;
  onOpenPhotos: (place: Place) => void;
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
  onEditPlace: (place: Place) => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
};

export function PlaceExpandableRow({
  place,
  referencePlace,
  category,
  photoState,
  reservations,
  scheduleLabels,
  isDuplicateCandidate,
  isExpanded,
  isSelected,
  enableExpandedDetails,
  isEditing,
  isDeleting,
  isMovingCategory,
  categories,
  hasDivider,
  onToggle,
  onSelect,
  onOpenDetails,
  onOpenPhotos,
  onOpenReservations,
  onEditPlace,
  onDelete,
  onMoveCategory
}: PlaceExpandableRowProps) {
  const isBusy = isDeleting || isMovingCategory;
  const isHighlighted = isExpanded || (!enableExpandedDetails && isSelected);
  const visibleDescription = getVisiblePlaceDescription(place);
  const visibleNote = getVisibleGoogleMapsNote(place);

  return (
    <article className={cn(hasDivider && 'border-t')}>
      <div
        className={cn(
          'relative grid grid-cols-[4rem_minmax(0,1fr)_2.25rem] gap-3 px-3 py-3 transition sm:grid-cols-[3.25rem_minmax(11rem,1.05fr)_minmax(9rem,0.9fr)_minmax(12rem,1.35fr)_2.5rem] sm:items-center sm:px-4',
          isHighlighted ? 'bg-primary/5' : 'bg-background hover:bg-muted/25',
          !enableExpandedDetails && 'cursor-pointer'
        )}
        onClick={() => {
          if (!enableExpandedDetails) onSelect?.(place);
        }}
        onDoubleClick={(event) => {
          if (enableExpandedDetails) return;
          event.preventDefault();
          if (isSelected) {
            onOpenDetails?.(place);
            return;
          }
          onSelect?.(place);
        }}
      >
        <PlaceThumbnailButton
          place={place}
          photoState={photoState}
          sizeClassName="col-start-1 row-span-2 h-16 w-16 sm:col-auto sm:row-auto sm:h-12 sm:w-12"
          onOpenPhotos={onOpenPhotos}
          disabled={isBusy}
        />

        <div className="col-start-2 min-w-0 pr-7 sm:col-auto sm:pr-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex w-14 shrink-0 justify-start text-xs font-medium leading-6 text-muted-foreground tabular-nums">
              {place.distanceFromSelectedKm.toFixed(1)}km
            </span>
            <PlaceContextBadges
              reservations={reservations}
              scheduleLabels={scheduleLabels}
              isDuplicateCandidate={isDuplicateCandidate}
              compact
              onOpenReservations={onOpenReservations ? () => onOpenReservations(place, reservations) : undefined}
            />
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug sm:truncate">{place.name}</h3>
          {visibleDescription ? (
            <div className="mt-1 line-clamp-1 text-xs font-medium text-foreground/75">
              설명: <MarkdownInline text={visibleDescription} />
            </div>
          ) : null}
          {visibleNote ? (
            <div className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">
              메모: <MarkdownInline text={visibleNote} />
            </div>
          ) : null}
        </div>

        <SummaryCell className="col-span-3 sm:col-auto" label="대표 항목" value={place.menu} />
        <SummaryCell className="col-span-3 sm:col-auto" label="분류" value={`${category.emoji} ${category.label}${place.cuisine ? ` · ${place.cuisine}` : ''}`} muted />

        {enableExpandedDetails ? (
          <Button
            variant="ghost"
            size="icon"
            className="col-start-3 row-start-1 h-9 w-9 justify-self-end rounded-full sm:static"
            onClick={() => onToggle(place)}
            aria-expanded={isExpanded}
            aria-label={`${place.name} 상세 ${isExpanded ? '접기' : '펼치기'}`}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
          </Button>
        ) : (
          <div className="col-start-3 row-start-1 flex h-9 items-center justify-end sm:static">
            {isSelected ? (
              <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                선택
              </Badge>
            ) : null}
          </div>
        )}
      </div>

      {isExpanded ? (
        <PlaceExpandedDetails
          place={place}
          referencePlace={referencePlace}
          photoState={photoState}
          isEditing={isEditing}
          isDeleting={isDeleting}
          isMovingCategory={isMovingCategory}
          categories={categories}
          reservations={reservations}
          onOpenReservations={onOpenReservations}
          onOpenPhotos={onOpenPhotos}
          onEditPlace={onEditPlace}
          onDelete={onDelete}
          onMoveCategory={onMoveCategory}
        />
      ) : null}
    </article>
  );
}

function SummaryCell({
  label,
  value,
  muted = false,
  className
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-lg bg-secondary/60 p-2.5 sm:bg-transparent sm:p-0', muted && 'text-muted-foreground', className)}>
      <div className="text-[11px] font-semibold text-muted-foreground sm:hidden">{label}</div>
      <div className={cn('mt-1 line-clamp-2 text-sm leading-5 sm:mt-0', muted ? 'font-medium' : 'font-semibold')}>
        {value}
      </div>
    </div>
  );
}
