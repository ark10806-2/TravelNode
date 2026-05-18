import { ExternalLink, Loader2, Map, Navigation, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { googleMapsApiKey } from '@/config/env';
import { getHotelToPlaceEmbedUrl, getPlaceInfoUrl, haversineKm } from '@/lib/place-utils';
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
  onOpenPhotos: (place: Place) => void;
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
  onOpenPhotos,
  onDelete,
  onMoveCategory
}: PlaceExpandedDetailsProps) {
  const isBusy = isDeleting || isMovingCategory;
  const distanceKm = haversineKm(referencePlace, place);

  return (
    <div className="grid gap-3 border-t bg-background px-3 py-3 sm:px-4 sm:py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-3">
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
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>

        <section className="rounded-xl border bg-muted/20 p-3">
          <div className="text-sm font-semibold">설명</div>
          <p className="mt-2 leading-6 text-muted-foreground">{place.description}</p>
        </section>
      </div>

      <aside className="grid content-start gap-3">
        <PhotoBundlePreview place={place} photoState={photoState} onOpen={onOpenPhotos} />

        <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 text-sm">
          <div className="font-semibold">기준점 이동</div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Navigation className="h-4 w-4 shrink-0" />
            직선거리 {distanceKm.toFixed(1)}km
          </div>
          <div className="pt-1 text-xs leading-5 text-muted-foreground">{place.address}</div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <CategoryMoveSelect
              place={place}
              categories={categories}
              disabled={isBusy}
              className="min-w-0 flex-1 rounded-full"
              onMove={onMoveCategory}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(place)}
              disabled={isBusy}
              aria-label={`${place.name} 삭제`}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}

        <Button asChild className="rounded-full">
          <a href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
            구글 맵에서 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </aside>
    </div>
  );
}
