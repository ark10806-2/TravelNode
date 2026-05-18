import { Images } from 'lucide-react';
import type { PhotoState, Place } from '@/types/travel';

type PlaceThumbnailButtonProps = {
  place: Place;
  photoState: PhotoState;
  sizeClassName: string;
  disabled?: boolean;
  onOpenPhotos: (place: Place) => void;
};

export function PlaceThumbnailButton({
  place,
  photoState,
  sizeClassName,
  disabled = false,
  onOpenPhotos
}: PlaceThumbnailButtonProps) {
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
