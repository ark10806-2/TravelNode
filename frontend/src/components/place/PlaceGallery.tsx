import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Images, MapPin, Pencil } from 'lucide-react';
import { MarkdownInline } from '@/components/common/MarkdownText';
import { PlaceReservationBadge } from '@/components/reservation/PlaceReservationBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import { getVisibleGoogleMapsNote, getVisiblePlaceDescription, shouldShowPlaceInfoNeedsReview } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';
import { PlaceScheduleBadges } from './PlaceScheduleBadges';

type PlaceGalleryProps = {
  places: NearbyPlace[];
  photoCache: Record<string, PhotoState>;
  reservationsByPlaceId?: Record<string, Reservation[]>;
  scheduleLabelsByPlaceId?: Record<string, string[]>;
  duplicatePlaceIds?: Set<string>;
  onLoadPhotos: (place: Place) => Promise<void>;
  onOpenPhotos: (place: Place) => void;
  onOpenReservations?: (place: Place, reservations: Reservation[]) => void;
  onEditPlace: (place: Place) => void;
  isEditing: boolean;
  categories: CategoryOption[];
  movingCategoryPlaceId: string | null;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
};

export function PlaceGallery({
  places,
  photoCache,
  reservationsByPlaceId = {},
  scheduleLabelsByPlaceId = {},
  duplicatePlaceIds = new Set<string>(),
  onLoadPhotos,
  onOpenPhotos,
  onOpenReservations,
  onEditPlace,
  isEditing,
  categories,
  movingCategoryPlaceId,
  onMoveCategory
}: PlaceGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [placeSlideDirection, setPlaceSlideDirection] = useState<-1 | 1 | null>(null);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Set<string>>(() => new Set());
  const galleryViewportRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRailRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePlace = places[activeIndex] ?? places[0] ?? null;
  const activePhotoState = activePlace ? photoCache[activePlace.id] : undefined;
  const activePhotos = activePhotoState?.photos ?? [];
  const activePhoto = activePhotos[activePhotoIndex] ?? activePhotos[0] ?? null;
  const activeReservations = activePlace ? reservationsByPlaceId[activePlace.id] ?? [] : [];
  const activeScheduleLabels = activePlace ? scheduleLabelsByPlaceId[activePlace.id] ?? [] : [];
  const isDuplicateCandidate = activePlace ? duplicatePlaceIds.has(activePlace.id) : false;
  const isActivePhotoVisible = Boolean(activePhoto && !failedPhotoUrls.has(activePhoto.url));
  const visibleDescription = activePlace ? getVisiblePlaceDescription(activePlace) : '';
  const visibleNote = activePlace ? getVisibleGoogleMapsNote(activePlace) : '';
  const needsReview = activePlace ? shouldShowPlaceInfoNeedsReview(activePlace) : false;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(places.length - 1, 0)));
  }, [places.length]);

  useEffect(() => {
    if (!activePlace) return;
    setActivePhotoIndex(0);
    void onLoadPhotos(activePlace);
  }, [activePlace, onLoadPhotos]);

  useEffect(() => {
    if (placeSlideDirection == null) return;

    const timer = window.setTimeout(() => setPlaceSlideDirection(null), 260);
    return () => window.clearTimeout(timer);
  }, [placeSlideDirection, activeIndex]);

  useEffect(() => {
    places.forEach((place) => {
      void onLoadPhotos(place);
    });
  }, [places, onLoadPhotos]);

  const hasMultiplePlaces = places.length > 1;
  const hasMultiplePhotos = activePhotos.length > 1;
  const isMovingCategory = activePlace ? movingCategoryPlaceId === activePlace.id : false;
  const activePosition = useMemo(() => (activePlace ? `${activeIndex + 1} / ${places.length}` : '0 / 0'), [
    activeIndex,
    activePlace,
    places.length
  ]);

  function movePlace(offset: -1 | 1, anchor: HTMLElement | null = galleryViewportRef.current) {
    if (!places.length) return;
    anchor?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setPlaceSlideDirection(offset);
    setActiveIndex((current) => (current + offset + places.length) % places.length);
  }

  function movePhoto(offset: -1 | 1, anchor: HTMLElement) {
    if (!activePhotos.length) return;
    anchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setActivePhotoIndex((current) => (current + offset + activePhotos.length) % activePhotos.length);
  }

  function selectPlace(index: number) {
    if (index === activeIndex) return;
    thumbnailRailRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setPlaceSlideDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }

  function handleSwipeStart(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultiplePlaces) return;

    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || !hasMultiplePlaces) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
    if (!isHorizontalSwipe) return;

    movePlace(deltaX < 0 ? 1 : -1);
  }

  function markPhotoFailed(url: string) {
    setFailedPhotoUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  if (!activePlace) {
    return (
      <div className="soft-panel grid min-h-56 place-items-center rounded-lg p-8 text-center text-sm text-muted-foreground">
        가까운 후보가 없습니다.
      </div>
    );
  }

  return (
    <section className="soft-panel min-w-0 w-full max-w-full overflow-hidden rounded-xl">
      <div
        ref={galleryViewportRef}
        className="min-w-0 max-w-full overflow-hidden touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <div
          key={activePlace.id}
          className={cn(
            'grid min-w-0 max-w-full gap-0 will-change-transform lg:grid-cols-[minmax(0,1fr)_380px]',
            placeSlideDirection === 1 && 'gallery-slide-next',
            placeSlideDirection === -1 && 'gallery-slide-prev'
          )}
        >
          <div className="relative h-[40vw] min-h-32 max-h-40 overflow-hidden bg-muted sm:aspect-[16/10] sm:h-auto sm:max-h-none lg:aspect-auto lg:min-h-[360px]">
            {isActivePhotoVisible && activePhoto ? (
              <img
                src={activePhoto.url}
                alt={`${activePlace.name} 대표 사진`}
                className="h-full w-full object-cover lg:object-contain"
                loading="eager"
                onError={() => markPhotoFailed(activePhoto.url)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-muted/70">
                <Images className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {activePhotoState?.status === 'loading' ? (
              <div className="absolute inset-0 animate-pulse bg-background/30" />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-2.5 text-white sm:p-4">
              <div className="line-clamp-1 text-base font-bold leading-tight sm:line-clamp-2 sm:text-xl">{activePlace.name}</div>
              <div className="mt-0.5 line-clamp-1 text-[11px] text-white/80 sm:mt-1 sm:text-xs">{activePlace.menu}</div>
            </div>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-white/40 bg-black/35 text-white hover:bg-black/50 hover:text-white sm:h-8 sm:w-8"
                onClick={(event) => movePhoto(-1, event.currentTarget)}
                disabled={!hasMultiplePhotos}
                aria-label="이전 사진"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute inset-y-0 right-2 flex items-center">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-white/40 bg-black/35 text-white hover:bg-black/50 hover:text-white sm:h-8 sm:w-8"
                onClick={(event) => movePhoto(1, event.currentTarget)}
                disabled={!hasMultiplePhotos}
                aria-label="다음 사진"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {activePhotos.length ? (
              <Badge className="absolute right-2.5 top-2.5 rounded-full border-white/40 bg-black/45 px-2 py-0.5 text-[10px] text-white sm:right-3 sm:top-3 sm:text-xs">
                {activePhotoIndex + 1} / {activePhotos.length}
              </Badge>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-2 border-t p-2.5 sm:gap-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs">
                  {activePosition}
                </Badge>
                {onOpenReservations ? (
                  <PlaceReservationBadge
                    reservations={activeReservations}
                    compact
                    onOpen={() => onOpenReservations(activePlace, activeReservations)}
                  />
                ) : null}
                <PlaceScheduleBadges labels={activeScheduleLabels} compact />
                {isDuplicateCandidate ? (
                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200">
                    중복 후보
                  </Badge>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
                  onClick={(event) => movePlace(-1, event.currentTarget)}
                  disabled={!hasMultiplePlaces}
                  aria-label="이전 장소"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
                  onClick={(event) => movePlace(1, event.currentTarget)}
                  disabled={!hasMultiplePlaces}
                  aria-label="다음 장소"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-w-0 sm:block">
              <h3 className="hidden text-lg font-bold leading-snug sm:block sm:text-xl">{activePlace.name}</h3>
              {visibleDescription ? (
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                  설명: <MarkdownInline text={visibleDescription} />
                </p>
              ) : null}
              {needsReview ? (
                <Badge variant="outline" className="mt-1 rounded-full bg-background text-[11px] text-muted-foreground">
                  정보 보강 필요
                </Badge>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-1 text-xs sm:gap-1.5 sm:text-sm">
              <div className="font-semibold">대표 항목</div>
              <div className="line-clamp-1 leading-5 text-muted-foreground sm:line-clamp-none">{activePlace.menu}</div>
            </div>

            {visibleNote ? (
              <div className="grid min-w-0 gap-1 text-xs sm:gap-1.5 sm:text-sm">
                <div className="font-semibold">Google Maps 메모</div>
                <div className="line-clamp-2 leading-5 text-muted-foreground">
                  <MarkdownInline text={visibleNote} />
                </div>
              </div>
            ) : null}

            <div className="grid min-w-0 gap-1 text-xs sm:gap-1.5 sm:text-sm">
              <div className="font-semibold">이동 정보</div>
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                {activePlace.distanceFromSelectedKm.toFixed(1)}km · {travelLabel[activePlace.travelMode]}{' '}
                {activePlace.travelMinutes}분
              </div>
            </div>

            <div className="mt-auto flex min-w-0 flex-wrap gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" className="h-8 min-w-0 rounded-full px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={() => onOpenPhotos(activePlace)}>
                <Images className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                전체 사진 보기
              </Button>
              {isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-0 rounded-full px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                  onClick={() => onEditPlace(activePlace)}
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  수정
                </Button>
              ) : null}
              {isEditing ? (
                <CategoryMoveSelect
                  place={activePlace}
                  categories={categories}
                  disabled={isMovingCategory}
                  className="min-w-28 rounded-full text-xs sm:min-w-32 sm:text-sm"
                  onMove={onMoveCategory}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div ref={thumbnailRailRef} className="min-w-0 max-w-full border-t bg-muted/20 p-1.5 sm:p-2">
        <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 sm:gap-2">
          {places.map((place, index) => {
            const photo = photoCache[place.id]?.photos[0] ?? null;
            const isActive = index === activeIndex;
            const scheduleLabels = scheduleLabelsByPlaceId[place.id] ?? [];

            return (
              <button
                key={place.id}
                type="button"
                className={`w-24 flex-none overflow-hidden rounded-md border bg-background text-left transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36 ${
                  isActive ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => selectPlace(index)}
              >
                <div className="h-12 bg-muted sm:aspect-[4/3] sm:h-auto">
                  {photo && !failedPhotoUrls.has(photo.url) ? (
                    <img
                      src={photo.url}
                      alt={`${place.name} 썸네일`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => markPhotoFailed(photo.url)}
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <Images className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="grid gap-0.5 px-1.5 py-1 sm:px-2 sm:py-1.5">
                  <div className="truncate text-[11px] font-semibold sm:text-xs">{place.name}</div>
                  <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{place.menu}</div>
                  <div className="text-[10px] font-medium text-muted-foreground/80">
                    {place.distanceFromSelectedKm.toFixed(1)}km
                  </div>
                  {scheduleLabels.length ? (
                    <div className="truncate text-[10px] font-black text-emerald-700 dark:text-emerald-200">
                      {scheduleLabels.join(' · ')}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
