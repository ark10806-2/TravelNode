import { useState } from 'react';
import { ExternalLink, Images, Info, Loader2, Map, Navigation, Pencil, TicketCheck, Trash2 } from 'lucide-react';
import { recordApiUsage } from '@/api/usage';
import { MarkdownText } from '@/components/common/MarkdownText';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { googleMapsApiKey } from '@/config/env';
import {
  getHotelToPlaceEmbedUrl,
  getPlaceInfoUrl,
  getVisibleGoogleMapsNote,
  getVisiblePlaceDescription,
  haversineKm,
  shouldShowPlaceInfoNeedsReview
} from '@/lib/place-utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PhotoBundlePreview } from './PhotoBundlePreview';

type PlaceExpandedDetailsProps = {
  place: NearbyPlace;
  referencePlace: Place;
  photoState: PhotoState;
  isEditing: boolean;
  isDeleting: boolean;
  isMovingCategory: boolean;
  categories: CategoryOption[];
  reservations: Reservation[];
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
  onOpenPhotos: (place: Place) => void;
  onEditPlace: (place: Place) => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
};

export function PlaceExpandedDetails({
  place,
  referencePlace,
  photoState,
  isEditing,
  isDeleting,
  isMovingCategory,
  categories,
  reservations,
  onOpenReservations,
  onOpenPhotos,
  onEditPlace,
  onDelete,
  onMoveCategory
}: PlaceExpandedDetailsProps) {
  const isBusy = isDeleting || isMovingCategory;
  const distanceKm = haversineKm(referencePlace, place);
  const visibleDescription = getVisiblePlaceDescription(place);
  const visibleNote = getVisibleGoogleMapsNote(place);
  const needsReview = shouldShowPlaceInfoNeedsReview(place);
  const [activeSection, setActiveSection] = useState<'info' | 'photos' | 'map' | 'booking'>('info');

  return (
    <div className="border-t bg-background px-3 py-3 sm:px-4 sm:py-4">
      <div className="grid grid-cols-4 gap-1 rounded-full border bg-secondary p-1">
        {placeDetailSections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold transition ${
                activeSection === section.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60'
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{section.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {activeSection === 'info' ? (
          <section className="grid gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="grid gap-2 text-sm">
              <div className="font-semibold">기준점 이동</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="h-4 w-4 shrink-0" />
                직선거리 {distanceKm.toFixed(1)}km
              </div>
              <div className="text-xs leading-5 text-muted-foreground">{place.address}</div>
            </div>
            {visibleDescription || needsReview ? (
              <div className="border-t pt-3">
                <div className="text-sm font-semibold">설명</div>
                {visibleDescription ? <MarkdownText className="mt-2" text={visibleDescription} /> : null}
                {needsReview ? (
                  <Badge variant="outline" className="mt-2 rounded-full bg-background text-muted-foreground">
                    정보 보강 필요
                  </Badge>
                ) : null}
              </div>
            ) : null}
            {visibleNote ? (
              <div className="border-t pt-3">
                <div className="text-sm font-semibold">Google Maps 메모</div>
                <MarkdownText className="mt-2" text={visibleNote} />
              </div>
            ) : null}
          </section>
        ) : null}

        {activeSection === 'photos' ? (
          <PhotoBundlePreview place={place} photoState={photoState} onOpen={onOpenPhotos} />
        ) : null}

        {activeSection === 'map' ? (
          <section className="overflow-hidden rounded-xl border bg-muted/20">
            <div className="flex items-center gap-2 border-b bg-background px-3 py-2 text-sm font-semibold">
              <Map className="h-4 w-4 text-muted-foreground" />
              기준점에서 장소까지
            </div>
            <iframe
              className="h-52 w-full border-0 sm:h-64"
              src={getHotelToPlaceEmbedUrl(place, googleMapsApiKey, referencePlace)}
              title={`${place.name} 기준점 위치`}
              loading="lazy"
              onLoad={() => {
                if (googleMapsApiKey) void recordApiUsage('maps-embed').catch(() => undefined);
              }}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        ) : null}

        {activeSection === 'booking' ? (
          <section className="grid gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">예약 연결</div>
              {onOpenReservations ? (
                <PlaceReservationBadge
                  reservations={reservations}
                  compact
                  onOpen={() => onOpenReservations(place, reservations)}
                />
              ) : null}
            </div>
            {!reservations.length ? (
              <div className="rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">연결된 예약/티켓이 없습니다.</div>
            ) : null}
            {isEditing ? (
              <div className="grid gap-2 border-t pt-3">
                <Button variant="outline" className="rounded-full" onClick={() => onEditPlace(place)} disabled={isBusy}>
                  <Pencil className="h-4 w-4" />
                  세부항목 수정
                </Button>
                <CategoryMoveSelect
                  place={place}
                  categories={categories}
                  disabled={isBusy}
                  className="min-w-0 rounded-full"
                  onMove={onMoveCategory}
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(place)}
                    disabled={isBusy}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    삭제
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <Button asChild className="mt-3 w-full rounded-full sm:w-fit">
        <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
          구글 맵에서 열기
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

const placeDetailSections: Array<{ id: 'info' | 'photos' | 'map' | 'booking'; label: string; icon: typeof Info }> = [
  { id: 'info', label: '정보', icon: Info },
  { id: 'photos', label: '사진', icon: Images },
  { id: 'map', label: '지도', icon: Map },
  { id: 'booking', label: '예약', icon: TicketCheck }
];
