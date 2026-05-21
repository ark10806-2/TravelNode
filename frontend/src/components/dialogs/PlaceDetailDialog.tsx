import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { MarkdownText } from '@/components/common/MarkdownText';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import {
  getCategoryBadgeClass,
  getCategoryOption,
  getPlaceInfoUrl,
  getVisibleGoogleMapsNote,
  getVisiblePlaceDescription,
  shouldShowPlaceInfoNeedsReview
} from '@/lib/place-utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';
import { PhotoBundlePreview } from '@/components/place/PhotoBundlePreview';
import { ModalFrame } from './ModalFrame';

type PlaceDetailDialogProps = {
  place: Place;
  categories: CategoryOption[];
  photoState: PhotoState;
  reservations?: Reservation[];
  onClose: () => void;
  onOpenPhotos: (place: Place) => void;
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
};

export function PlaceDetailDialog({
  place,
  categories,
  photoState,
  reservations = [],
  onClose,
  onOpenPhotos,
  onOpenReservations
}: PlaceDetailDialogProps) {
  const category = getCategoryOption(categories, place.category);
  const visibleDescription = getVisiblePlaceDescription(place);
  const visibleNote = getVisibleGoogleMapsNote(place);
  const needsReview = shouldShowPlaceInfoNeedsReview(place);

  return (
    <ModalFrame
      title={place.name}
      maxWidth="max-w-3xl"
      scroll
      onClose={onClose}
      eyebrow={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={getCategoryBadgeClass(place.category)}>
            {category.emoji} {category.label}
          </Badge>
          {onOpenReservations ? (
            <PlaceReservationBadge
              reservations={reservations}
              compact
              onOpen={() => onOpenReservations(place, reservations)}
            />
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4 p-4 sm:p-5">
        <PhotoBundlePreview place={place} photoState={photoState} onOpen={onOpenPhotos} />

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <section className="rounded-md border bg-muted/20 p-3">
            <div className="font-semibold">대표 항목</div>
            <div className="mt-1 text-muted-foreground">{place.menu}</div>
          </section>

          <section className="rounded-md border bg-muted/20 p-3">
            <div className="font-semibold">숙소 기준 이동</div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Navigation className="h-4 w-4 shrink-0" />
              <span>
                {place.distanceLabel} · {travelLabel[place.travelMode]} {place.travelMinutes}분
              </span>
            </div>
          </section>

          <section className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <div className="font-semibold">주소</div>
            <div className="mt-1 flex gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{place.address}</span>
            </div>
          </section>

          {visibleDescription || needsReview ? (
            <section className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
              <div className="font-semibold">설명</div>
              {visibleDescription ? <MarkdownText className="mt-1" text={visibleDescription} /> : null}
              {needsReview ? (
                <Badge variant="outline" className="mt-2 rounded-full bg-background text-muted-foreground">
                  정보 보강 필요
                </Badge>
              ) : null}
            </section>
          ) : null}

          {visibleNote ? (
            <section className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
              <div className="font-semibold">Google Maps 메모</div>
              <MarkdownText className="mt-1" text={visibleNote} />
            </section>
          ) : null}
        </div>

        <Button asChild className="w-full sm:w-fit sm:justify-self-end">
          <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
            구글 맵에서 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </ModalFrame>
  );
}
