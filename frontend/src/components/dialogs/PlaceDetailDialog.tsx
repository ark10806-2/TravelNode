import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import { getCategoryBadgeClass, getCategoryOption, getPlaceInfoUrl } from '@/lib/place-utils';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';
import { PhotoBundlePreview } from '@/components/place/PhotoBundlePreview';
import { ModalFrame } from './ModalFrame';

type PlaceDetailDialogProps = {
  place: Place;
  categories: CategoryOption[];
  photoState: PhotoState;
  onClose: () => void;
  onOpenPhotos: (place: Place) => void;
};

export function PlaceDetailDialog({ place, categories, photoState, onClose, onOpenPhotos }: PlaceDetailDialogProps) {
  const category = getCategoryOption(categories, place.category);

  return (
    <ModalFrame
      title={place.name}
      maxWidth="max-w-3xl"
      scroll
      onClose={onClose}
      eyebrow={
        <Badge variant="outline" className={getCategoryBadgeClass(place.category)}>
          {category.emoji} {category.label}
        </Badge>
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

          <section className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <div className="font-semibold">설명</div>
            <p className="mt-1 leading-6 text-muted-foreground">{place.description}</p>
          </section>
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
