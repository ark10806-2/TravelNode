import { ExternalLink, Navigation, Pencil, Utensils } from 'lucide-react';
import { MarkdownText } from '@/components/common/MarkdownText';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getCategoryBadgeClass,
  getCategoryOption,
  getPlaceInfoUrl,
  getVisibleGoogleMapsNote,
  getVisiblePlaceDescription,
  haversineKm,
  shouldShowPlaceInfoNeedsReview
} from '@/lib/place-utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryId, CategoryOption, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PhotoBundlePreview } from './PhotoBundlePreview';
import { PlaceScheduleBadges } from './PlaceScheduleBadges';

type SelectedPlacePanelProps = {
  place: Place | null;
  referencePlace: Place;
  categories: CategoryOption[];
  photoState: PhotoState;
  reservations: Reservation[];
  scheduleLabels: string[];
  isEditing: boolean;
  movingCategoryPlaceId: string | null;
  onEditPlace: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
  onOpenPhotos: (place: Place) => void;
  onOpenReservations: (place: Place, reservations: Reservation[]) => void;
};

export function SelectedPlacePanel({
  place,
  referencePlace,
  categories,
  photoState,
  reservations,
  scheduleLabels,
  isEditing,
  movingCategoryPlaceId,
  onEditPlace,
  onMoveCategory,
  onOpenPhotos,
  onOpenReservations
}: SelectedPlacePanelProps) {
  if (!place) {
    return (
      <aside className="soft-panel rounded-lg p-5">
        <p className="text-sm text-muted-foreground">표시할 장소가 없습니다.</p>
      </aside>
    );
  }

  const category = getCategoryOption(categories, place.category);
  const isMovingCategory = movingCategoryPlaceId === place.id;
  const distanceKm = haversineKm(referencePlace, place);
  const visibleDescription = getVisiblePlaceDescription(place);
  const visibleNote = getVisibleGoogleMapsNote(place);
  const needsReview = shouldShowPlaceInfoNeedsReview(place);

  return (
    <aside className="soft-panel rounded-xl p-3.5 sm:rounded-lg sm:p-5">
      <div className="flex h-full flex-col gap-3.5 sm:gap-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`rounded-full ${getCategoryBadgeClass(place.category)}`}>
                {category.emoji} {category.label}
              </Badge>
              <PlaceReservationBadge
                reservations={reservations}
                compact
                onOpen={() => onOpenReservations(place, reservations)}
              />
              <PlaceScheduleBadges labels={scheduleLabels} compact />
            </div>
            <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-snug tracking-tight sm:mt-3 sm:text-2xl">{place.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <CategoryMoveSelect
                place={place}
                categories={categories}
                disabled={isMovingCategory}
                className="hidden min-w-28 sm:flex"
                onMove={onMoveCategory}
              />
            ) : null}
            {isEditing ? (
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={() => onEditPlace(place)}>
                <Pencil className="h-4 w-4" />
                수정
              </Button>
            ) : null}
            <Utensils className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        {isEditing ? (
          <CategoryMoveSelect
            place={place}
            categories={categories}
            disabled={isMovingCategory}
            className="sm:hidden"
            onMove={onMoveCategory}
          />
        ) : null}
        <div className="grid gap-2.5 text-sm sm:gap-3">
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs font-semibold text-muted-foreground">대표 항목</div>
            <div className="mt-1 font-semibold leading-6">{place.menu}</div>
          </div>
          <PhotoBundlePreview place={place} photoState={photoState} onOpen={onOpenPhotos} />
          <div>
            <div className="text-xs font-semibold text-muted-foreground">기준점 이동</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Navigation className="h-4 w-4" />
              직선거리 {distanceKm.toFixed(1)}km
            </div>
          </div>
          {visibleDescription || needsReview ? (
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs font-semibold text-muted-foreground">설명</div>
              {visibleDescription ? <MarkdownText className="mt-1 text-sm" text={visibleDescription} /> : null}
              {needsReview ? (
                <Badge variant="outline" className="mt-2 rounded-full bg-background text-muted-foreground">
                  정보 보강 필요
                </Badge>
              ) : null}
            </div>
          ) : null}
          {visibleNote ? (
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs font-semibold text-muted-foreground">Google Maps 메모</div>
              <MarkdownText className="mt-1 text-sm" text={visibleNote} />
            </div>
          ) : null}
        </div>
        <Button asChild className="mt-auto">
          <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
            구글 맵에서 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </aside>
  );
}
