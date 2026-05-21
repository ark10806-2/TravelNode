import { CalendarPlus, ExternalLink, Loader2, MapPin, Navigation, Pencil } from 'lucide-react';
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
  getVisiblePlaceDescription
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
  scheduleActionLabel?: string;
  scheduleActionDisabled?: boolean;
  isScheduleActionLoading?: boolean;
  onScheduleAction?: (place: Place) => void;
  onEditPlace?: (place: Place) => void;
};

export function PlaceDetailDialog({
  place,
  categories,
  photoState,
  reservations = [],
  onClose,
  onOpenPhotos,
  onOpenReservations,
  scheduleActionLabel,
  scheduleActionDisabled = false,
  isScheduleActionLoading = false,
  onScheduleAction,
  onEditPlace
}: PlaceDetailDialogProps) {
  const category = getCategoryOption(categories, place.category);
  const visibleDescription = getVisiblePlaceDescription(place);
  const visibleNote = getVisibleGoogleMapsNote(place);

  return (
    <ModalFrame
      title={place.name}
      maxWidth="max-w-3xl"
      scroll
      overlayClassName="p-[18px] sm:p-6"
      panelClassName="max-h-[calc(100dvh-2.25rem)] rounded-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-md"
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
          <section className="rounded-2xl border border-border/80 bg-muted/20 p-3">
            <div className="font-semibold">대표 항목</div>
            <div className="mt-1 text-muted-foreground">{place.menu}</div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-muted/20 p-3">
            <div className="font-semibold">숙소 기준 이동</div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Navigation className="h-4 w-4 shrink-0" />
              <span>
                {place.distanceLabel} · {travelLabel[place.travelMode]} {place.travelMinutes}분
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-muted/20 p-3 sm:col-span-2">
            <div className="font-semibold">주소</div>
            <div className="mt-1 flex gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{place.address}</span>
            </div>
          </section>

          {visibleDescription ? (
            <section className="rounded-2xl border border-border/80 bg-muted/20 p-3 sm:col-span-2">
              <div className="font-semibold">설명</div>
              <MarkdownText className="mt-1" text={visibleDescription} />
            </section>
          ) : null}

          {visibleNote ? (
            <section className="rounded-2xl border border-border/80 bg-muted/20 p-3 sm:col-span-2">
              <div className="font-semibold">Google Maps 메모</div>
              <MarkdownText className="mt-1" text={visibleNote} />
            </section>
          ) : null}
        </div>

        <div className="grid gap-2 sm:flex sm:justify-end">
          {onEditPlace ? (
            <Button className="w-full sm:w-fit" variant="outline" onClick={() => onEditPlace(place)}>
              <Pencil className="h-4 w-4" />
              편집
            </Button>
          ) : null}
          {onScheduleAction && scheduleActionLabel ? (
            <Button
              className="w-full sm:w-fit"
              disabled={scheduleActionDisabled || isScheduleActionLoading}
              onClick={() => onScheduleAction(place)}
            >
              {isScheduleActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {scheduleActionLabel}
            </Button>
          ) : null}
          <Button asChild className="w-full sm:w-fit" variant={onScheduleAction ? 'outline' : 'default'}>
            <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
              구글 맵에서 열기
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
