import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Images, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { travelLabel } from '@/constants/travel';
import { cn } from '@/lib/utils';
import type { CategoryId, CategoryOption, NearbyPlace, PhotoState, Place } from '@/types/travel';
import { CategoryMoveSelect } from './CategoryMoveSelect';

type PlaceGalleryProps = {
  places: NearbyPlace[];
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place) => Promise<void>;
  onOpenPhotos: (place: Place) => void;
  isEditing: boolean;
  categories: CategoryOption[];
  movingCategoryPlaceId: string | null;
  onMoveCategory: (place: Place, categoryId: CategoryId) => void;
};

export function PlaceGallery({
  places,
  photoCache,
  onLoadPhotos,
  onOpenPhotos,
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
  const scrollAnchorRef = useRef<{ element: HTMLElement; top: number } | null>(null);
  const scrollAnchorTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePlace = places[activeIndex] ?? places[0] ?? null;
  const activePhotoState = activePlace ? photoCache[activePlace.id] : undefined;
  const activePhotos = activePhotoState?.photos ?? [];
  const activePhoto = activePhotos[activePhotoIndex] ?? activePhotos[0] ?? null;
  const isActivePhotoVisible = Boolean(activePhoto && !failedPhotoUrls.has(activePhoto.url));

  useLayoutEffect(() => {
    restoreScrollAnchor();
  }, [activeIndex, activePhotoIndex, activePhoto?.url]);

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

  useEffect(() => {
    return () => {
      if (scrollAnchorTimerRef.current != null) {
        window.clearTimeout(scrollAnchorTimerRef.current);
      }
      scrollAnchorRef.current = null;
    };
  }, []);

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
    captureScrollAnchor(anchor);
    setPlaceSlideDirection(offset);
    setActiveIndex((current) => (current + offset + places.length) % places.length);
  }

  function movePhoto(offset: -1 | 1, anchor: HTMLElement) {
    if (!activePhotos.length) return;
    captureScrollAnchor(anchor);
    setActivePhotoIndex((current) => (current + offset + activePhotos.length) % activePhotos.length);
  }

  function selectPlace(index: number) {
    if (index === activeIndex) return;
    captureScrollAnchor(thumbnailRailRef.current);
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

  function captureScrollAnchor(anchor: HTMLElement | null) {
    if (anchor) {
      scrollAnchorRef.current = { element: anchor, top: anchor.getBoundingClientRect().top };
    }
    if (scrollAnchorTimerRef.current != null) {
      window.clearTimeout(scrollAnchorTimerRef.current);
    }
    scrollAnchorTimerRef.current = window.setTimeout(() => {
      scrollAnchorRef.current = null;
      scrollAnchorTimerRef.current = null;
    }, 1500);
  }

  function restoreScrollAnchor() {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    if (!anchor.element.isConnected) {
      scrollAnchorRef.current = null;
      return;
    }

    const nextTop = anchor.element.getBoundingClientRect().top;
    window.scrollBy({ top: nextTop - anchor.top, behavior: 'instant' });
    scrollAnchorRef.current = anchor;
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
    <section className="soft-panel overflow-hidden rounded-xl">
      <div
        ref={galleryViewportRef}
        className="overflow-hidden touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <div
          key={activePlace.id}
          className={cn(
            'grid gap-0 will-change-transform lg:grid-cols-[minmax(0,1fr)_380px]',
            placeSlideDirection === 1 && 'gallery-slide-next',
            placeSlideDirection === -1 && 'gallery-slide-prev'
          )}
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-muted sm:aspect-[16/10] lg:aspect-auto lg:min-h-[360px]">
            {isActivePhotoVisible && activePhoto ? (
              <img
                src={activePhoto.url}
                alt={`${activePlace.name} 대표 사진`}
                className="h-full w-full object-cover lg:object-contain"
                loading="eager"
                onLoad={restoreScrollAnchor}
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-3 text-white sm:p-4">
              <div className="line-clamp-2 text-lg font-bold leading-tight sm:text-xl">{activePlace.name}</div>
              <div className="mt-1 line-clamp-1 text-xs text-white/80">{activePlace.menu}</div>
            </div>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/40 bg-black/35 text-white hover:bg-black/50 hover:text-white"
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
                className="h-8 w-8 border-white/40 bg-black/35 text-white hover:bg-black/50 hover:text-white"
                onClick={(event) => movePhoto(1, event.currentTarget)}
                disabled={!hasMultiplePhotos}
                aria-label="다음 사진"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {activePhotos.length ? (
              <Badge className="absolute right-3 top-3 border-white/40 bg-black/45 text-white">
                {activePhotoIndex + 1} / {activePhotos.length}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t p-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className="rounded-full">
                {activePosition}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={(event) => movePlace(-1, event.currentTarget)}
                  disabled={!hasMultiplePlaces}
                  aria-label="이전 장소"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={(event) => movePlace(1, event.currentTarget)}
                  disabled={!hasMultiplePlaces}
                  aria-label="다음 장소"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold leading-snug sm:text-xl">{activePlace.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground sm:line-clamp-2">
                {activePlace.description}
              </p>
            </div>

            <div className="grid gap-1.5 text-sm">
              <div className="font-semibold">대표 항목</div>
              <div className="leading-5 text-muted-foreground">{activePlace.menu}</div>
            </div>

            <div className="grid gap-1.5 text-sm">
              <div className="font-semibold">이동 정보</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {activePlace.distanceFromSelectedKm.toFixed(1)}km · {travelLabel[activePlace.travelMode]}{' '}
                {activePlace.travelMinutes}분
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => onOpenPhotos(activePlace)}>
                <Images className="h-4 w-4" />
                전체 사진 보기
              </Button>
              {isEditing ? (
                <CategoryMoveSelect
                  place={activePlace}
                  categories={categories}
                  disabled={isMovingCategory}
                  className="min-w-32 rounded-full"
                  onMove={onMoveCategory}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div ref={thumbnailRailRef} className="border-t bg-muted/20 p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {places.map((place, index) => {
            const photo = photoCache[place.id]?.photos[0] ?? null;
            const isActive = index === activeIndex;

            return (
              <button
                key={place.id}
                type="button"
                className={`min-w-36 overflow-hidden rounded-md border bg-background text-left transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => selectPlace(index)}
              >
                <div className="aspect-[4/3] bg-muted">
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
                <div className="grid gap-0.5 px-2 py-1.5">
                  <div className="truncate text-xs font-semibold">{place.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{place.menu}</div>
                  <div className="text-[10px] font-medium text-muted-foreground/80">
                    {place.distanceFromSelectedKm.toFixed(1)}km
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
