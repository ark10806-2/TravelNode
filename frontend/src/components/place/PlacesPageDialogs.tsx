import { AddCategoryDialog } from '@/components/dialogs/AddCategoryDialog';
import { AddPlaceDialog } from '@/components/dialogs/AddPlaceDialog';
import { EditPlaceDialog } from '@/components/dialogs/EditPlaceDialog';
import { GoogleMapsSyncDialog } from '@/components/dialogs/GoogleMapsSyncDialog';
import { PlacePhotoDialog } from '@/components/dialogs/PlacePhotoDialog';
import type { CategoryId, CategoryOption, PhotoState, Place } from '@/types/travel';

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};

type PlacesPageDialogsProps = {
  addPlaceCategory: CategoryId | null;
  isCategoryDialogOpen: boolean;
  editTarget: Place | null;
  photoTarget: Place | null;
  isGoogleSyncDialogOpen: boolean;
  categories: CategoryOption[];
  photoCache: Record<string, PhotoState>;
  onCloseAddPlace: () => void;
  onPlaceCreated: (place: Place) => void;
  onCloseCategoryDialog: () => void;
  onCategoryCreated: (category: CategoryOption) => void;
  onCloseEditPlace: () => void;
  onPlaceSaved: (place: Place) => void;
  onCloseGoogleSync: () => void;
  onGoogleSynced: () => void;
  onClosePhotos: () => void;
  onRetryPhotos: (place: Place) => void;
};

export function PlacesPageDialogs({
  addPlaceCategory,
  isCategoryDialogOpen,
  editTarget,
  photoTarget,
  isGoogleSyncDialogOpen,
  categories,
  photoCache,
  onCloseAddPlace,
  onPlaceCreated,
  onCloseCategoryDialog,
  onCategoryCreated,
  onCloseEditPlace,
  onPlaceSaved,
  onCloseGoogleSync,
  onGoogleSynced,
  onClosePhotos,
  onRetryPhotos
}: PlacesPageDialogsProps) {
  return (
    <>
      {addPlaceCategory ? (
        <AddPlaceDialog
          category={addPlaceCategory}
          categories={categories}
          onClose={onCloseAddPlace}
          onCreated={onPlaceCreated}
        />
      ) : null}
      {isCategoryDialogOpen ? (
        <AddCategoryDialog onClose={onCloseCategoryDialog} onCreated={onCategoryCreated} />
      ) : null}
      {editTarget ? (
        <EditPlaceDialog
          place={editTarget}
          categories={categories}
          onClose={onCloseEditPlace}
          onSaved={onPlaceSaved}
        />
      ) : null}
      {isGoogleSyncDialogOpen ? (
        <GoogleMapsSyncDialog onClose={onCloseGoogleSync} onSynced={onGoogleSynced} />
      ) : null}
      {photoTarget ? (
        <PlacePhotoDialog
          place={photoTarget}
          categories={categories}
          photoState={photoCache[photoTarget.id] ?? emptyPhotoState}
          onClose={onClosePhotos}
          onRetry={() => onRetryPhotos(photoTarget)}
        />
      ) : null}
    </>
  );
}
