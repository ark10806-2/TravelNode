import { Images } from 'lucide-react';
import type { PhotoState, Place } from '@/types/travel';

type PhotoBundlePreviewProps = {
  place: Place;
  photoState: PhotoState;
  onOpen: (place: Place) => void;
};

export function PhotoBundlePreview({ place, photoState, onOpen }: PhotoBundlePreviewProps) {
  const previewPhotos = photoState.photos.slice(0, 4);

  return (
    <button
      type="button"
      className="group overflow-hidden rounded-md border bg-muted text-left transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(place)}
    >
      <div className="grid h-36 grid-cols-4 gap-1 p-1">
        {photoState.status === 'loading' ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-full animate-pulse rounded bg-background/80" />
          ))
        ) : previewPhotos.length ? (
          previewPhotos.map((photo, index) => (
            <img
              key={photo.url}
              src={photo.url}
              alt={`${place.name} 대표 사진 ${index + 1}`}
              className="h-full w-full rounded object-cover"
              loading="lazy"
            />
          ))
        ) : (
          <div className="col-span-4 flex h-full items-center justify-center bg-background/70">
            <Images className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-background px-3 py-2 text-sm">
        <span className="font-semibold">대표 사진</span>
        <span className="text-xs text-muted-foreground">
          {photoState.status === 'ready' ? `${photoState.photos.length}장` : '보기'}
        </span>
      </div>
    </button>
  );
}
