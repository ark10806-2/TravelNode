import { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCategoryOption } from '@/lib/place-utils';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';
import { ModalFrame } from './ModalFrame';

type PlacePhotoDialogProps = {
  place: Place;
  categories: CategoryOption[];
  photoState: PhotoState;
  onClose: () => void;
  onRetry: () => void;
};

export function PlacePhotoDialog({ place, categories, photoState, onClose, onRetry }: PlacePhotoDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photoState.photos[activeIndex] ?? photoState.photos[0] ?? null;
  const category = getCategoryOption(categories, place.category);
  const photoAuthors = Array.from(
    new Map(
      photoState.photos
        .filter((photo) => photo.authorName)
        .map((photo) => [photo.authorUri ?? photo.authorName!, photo])
    ).values()
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [place.id]);

  return (
    <ModalFrame
      title={place.name}
      maxWidth="max-w-5xl"
      onClose={onClose}
      eyebrow={<p className="text-sm font-semibold text-muted-foreground">{category.emoji} {category.label}</p>}
    >
      <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
        {photoState.status === 'loading' ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <div className="aspect-[4/3] animate-pulse rounded-md bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
        ) : null}

        {photoState.status === 'error' ? (
          <div className="grid min-h-72 place-items-center rounded-md border bg-muted/40 p-8 text-center">
            <div>
              <Images className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">사진을 불러오지 못했습니다.</p>
              <p className="mt-1 text-sm text-muted-foreground">{photoState.error}</p>
              <Button className="mt-4" onClick={onRetry}>
                다시 시도
              </Button>
            </div>
          </div>
        ) : null}

        {photoState.status === 'ready' && !photoState.photos.length ? (
          <div className="grid min-h-72 place-items-center rounded-md border bg-muted/40 p-8 text-center">
            <div>
              <Images className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">표시할 대표 사진이 없습니다.</p>
            </div>
          </div>
        ) : null}

        {activePhoto ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <figure className="overflow-hidden rounded-md border bg-muted">
              <img src={activePhoto.url} alt={`${place.name} 대표 사진`} className="max-h-[62vh] w-full object-cover" />
              {activePhoto.authorName ? (
                <figcaption className="border-t bg-background px-3 py-2 text-xs text-muted-foreground">
                  사진:{' '}
                  {activePhoto.authorUri ? (
                    <a href={activePhoto.authorUri} target="_blank" rel="noreferrer" className="underline">
                      {activePhoto.authorName}
                    </a>
                  ) : (
                    activePhoto.authorName
                  )}
                </figcaption>
              ) : null}
            </figure>

            <div className="grid grid-cols-2 content-start gap-3">
              {photoState.photos.map((photo, index) => (
                <button
                  key={photo.url}
                  type="button"
                  className={`overflow-hidden rounded-md border bg-muted transition ${
                    index === activeIndex ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/60'
                  }`}
                  onClick={() => setActiveIndex(index)}
                >
                  <img src={photo.url} alt={`${place.name} 사진 ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              ))}
              {photoAuthors.length ? (
                <div className="col-span-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                  사진 제공:{' '}
                  {photoAuthors.map((photo, index) => (
                    <span key={photo.authorUri ?? photo.authorName}>
                      {index > 0 ? ', ' : ''}
                      {photo.authorUri ? (
                        <a href={photo.authorUri} target="_blank" rel="noreferrer" className="underline">
                          {photo.authorName}
                        </a>
                      ) : (
                        photo.authorName
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}
