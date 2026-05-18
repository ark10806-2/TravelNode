import { ChevronDown, ExternalLink, Images, Loader2, Map, MapPin, Navigation, Trash2 } from 'lucide-react';
import { googleMapsApiKey } from '@/config/env';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import { getCategoryBadgeClass, getHotelToPlaceEmbedUrl, getPlaceInfoUrl } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PhotoBundlePreview } from './PhotoBundlePreview';

type PlaceExpandableRowProps = {
  place: NearbyPlace;
  category: CategoryOption;
  photoState: PhotoState;
  isExpanded: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isMovingCategory: boolean;
  categories: CategoryOption[];
  hasDivider: boolean;
  onToggle: (place: NearbyPlace) => void;
  onOpenPhotos: (place: Place) => void;
  onDelete: (place: Place) => void;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
};

export function PlaceExpandableRow({
  place,
  category,
  photoState,
  isExpanded,
  isEditing,
  isDeleting,
  isMovingCategory,
  categories,
  hasDivider,
  onToggle,
  onOpenPhotos,
  onDelete,
  onMoveCategory
}: PlaceExpandableRowProps) {
  const isBusy = isDeleting || isMovingCategory;

  return (
    <article className={cn(hasDivider && 'border-t')}>
      <div
        className={cn(
          'relative grid grid-cols-[4rem_minmax(0,1fr)_2.25rem] gap-3 px-3 py-3 transition sm:grid-cols-[3.25rem_minmax(11rem,1.05fr)_minmax(9rem,0.9fr)_minmax(12rem,1.35fr)_2.5rem] sm:items-center sm:px-4',
          isExpanded ? 'bg-primary/5' : 'bg-background hover:bg-muted/25'
        )}
      >
        <PlaceThumbnail
          place={place}
          photoState={photoState}
          sizeClassName="col-start-1 row-span-2 h-16 w-16 sm:col-auto sm:row-auto sm:h-12 sm:w-12"
          onOpenPhotos={onOpenPhotos}
          disabled={isBusy}
        />

        <div className="col-start-2 min-w-0 pr-7 sm:col-auto sm:pr-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('rounded-full', getCategoryBadgeClass(place.category))}>
              {category.emoji} {category.label}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {place.distanceFromSelectedKm.toFixed(1)}km
            </span>
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug sm:truncate">{place.name}</h3>
        </div>

        <SummaryCell className="col-span-3 sm:col-auto" label="대표 항목" value={place.menu} />
        <SummaryCell className="col-span-3 sm:col-auto" label="요약" value={place.description} muted />

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
      </div>

      {isExpanded ? (
        <div className="grid gap-3 border-t bg-background px-3 py-3 sm:px-4 sm:py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            <section className="overflow-hidden rounded-xl border bg-muted/20">
              <div className="flex items-center gap-2 border-b bg-background px-3 py-2 text-sm font-semibold">
                <Map className="h-4 w-4 text-muted-foreground" />
                숙소에서 장소까지
              </div>
              <iframe
                className="h-52 w-full border-0 sm:h-64"
                src={getHotelToPlaceEmbedUrl(place, googleMapsApiKey)}
                title={`${place.name} 숙소 기준 위치`}
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
              <div className="font-semibold">숙소 기준 이동</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="h-4 w-4 shrink-0" />
                {place.distanceLabel} · {travelLabel[place.travelMode]} {place.travelMinutes}분
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

function PlaceThumbnail({
  place,
  photoState,
  sizeClassName,
  onOpenPhotos,
  disabled
}: {
  place: Place;
  photoState: PhotoState;
  sizeClassName: string;
  onOpenPhotos: (place: Place) => void;
  disabled: boolean;
}) {
  const photo = photoState.photos[0] ?? null;
  const isLoading = photoState.status === 'loading';

  return (
    <button
      type="button"
      className={`${sizeClassName} group relative shrink-0 overflow-hidden rounded-lg border bg-muted transition hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50`}
      onClick={() => onOpenPhotos(place)}
      disabled={disabled}
      aria-label={`${place.name} 사진 보기`}
    >
      {photo ? (
        <img src={photo.url} alt={`${place.name} 대표 사진`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-secondary">
          <Images className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {isLoading ? <div className="absolute inset-0 animate-pulse bg-background/45" /> : null}
    </button>
  );
}
