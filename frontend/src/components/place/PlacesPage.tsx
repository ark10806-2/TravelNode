import { useCallback, useEffect, useState } from 'react';
import { AddCategoryDialog } from '@/components/dialogs/AddCategoryDialog';
import { AddPlaceDialog } from '@/components/dialogs/AddPlaceDialog';
import { EditPlaceDialog } from '@/components/dialogs/EditPlaceDialog';
import { GoogleMapsSyncDialog } from '@/components/dialogs/GoogleMapsSyncDialog';
import { PlacePhotoDialog } from '@/components/dialogs/PlacePhotoDialog';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/place/AppHeader';
import { CategoryFilterBar } from '@/components/place/CategoryFilterBar';
import { PlaceTable, type PlaceListViewMode } from '@/components/place/PlaceTable';
import { SelectedPlacePanel } from '@/components/place/SelectedPlacePanel';
import { TravelMap } from '@/components/place/TravelMap';
import type { TravelPlacesState } from '@/hooks/useTravelPlaces';
import type { CategoryId, PhotoState, Place } from '@/types/travel';

const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};

type PlacesPageProps = {
  travelPlaces: TravelPlacesState;
  canEdit: boolean;
  isEditing: boolean;
  isDarkMode: boolean;
  onRequireAuth: () => void;
};

export function PlacesPage({ travelPlaces, canEdit, isEditing, isDarkMode, onRequireAuth }: PlacesPageProps) {
  const {
    categories,
    selectedCategory,
    selectedCategoryId,
    setSelectedCategoryId,
    visiblePlaces,
    selectedPlace,
    setSelectedId,
    nearbyPlaces,
    travelMode,
    setTravelMode,
    status,
    error,
    deletingId,
    movingCategoryPlaceId,
    photoCache,
    addCategory,
    deleteCategory,
    addPlace,
    updatePlace,
    movePlaceToCategory,
    deletePlace,
    loadPhotos,
    refreshPlaces
  } = travelPlaces;
  const [addPlaceCategory, setAddPlaceCategory] = useState<CategoryId | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Place | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Place | null>(null);
  const [isGoogleSyncDialogOpen, setIsGoogleSyncDialogOpen] = useState(false);
  const [placeListViewMode, setPlaceListViewMode] = useState<PlaceListViewMode>('table');
  const canModify = isEditing && canEdit;

  const selectPlace = useCallback(
    (place: Place) => {
      setSelectedId(place.id);
    },
    [setSelectedId]
  );

  const openPhotoDialog = useCallback(
    (place: Place) => {
      setPhotoTarget(place);
      void loadPhotos(place);
    },
    [loadPhotos]
  );

  useEffect(() => {
    if (!selectedPlace) return;
    void loadPhotos(selectedPlace);
  }, [loadPhotos, selectedPlace]);

  useEffect(() => {
    if (canModify) return;
    setAddPlaceCategory(null);
    setIsCategoryDialogOpen(false);
    setEditTarget(null);
    setIsGoogleSyncDialogOpen(false);
  }, [canModify]);

  return (
    <>
      <PageContainer>
        <AppHeader
          travelMode={travelMode}
          onTravelModeChange={setTravelMode}
          isEditing={canModify}
          onOpenGoogleMapsSync={() => (canEdit ? setIsGoogleSyncDialogOpen(true) : onRequireAuth())}
        />

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <TravelMap
            places={visiblePlaces}
            selectedPlace={selectedPlace}
            status={status}
            isDarkMode={isDarkMode}
            onSelectPlace={selectPlace}
          />
          <SelectedPlacePanel
            place={selectedPlace}
            categories={categories}
            photoState={selectedPlace ? photoCache[selectedPlace.id] ?? emptyPhotoState : emptyPhotoState}
            isEditing={canModify}
            movingCategoryPlaceId={movingCategoryPlaceId}
            onEditPlace={(place) => (canEdit ? setEditTarget(place) : onRequireAuth())}
            onMoveCategory={(place, categoryId) => (canEdit ? void movePlaceToCategory(place, categoryId) : onRequireAuth())}
            onOpenPhotos={openPhotoDialog}
          />
        </section>

        <section className="grid gap-3 border-t pt-4 sm:gap-4 sm:pt-6">
          <CategoryFilterBar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            isEditing={canModify}
            onSelectCategory={setSelectedCategoryId}
            onAddCategory={() => (canEdit ? setIsCategoryDialogOpen(true) : onRequireAuth())}
            onDeleteCategory={(category) => (canEdit ? void deleteCategory(category) : onRequireAuth())}
          />

          <PlaceTable
            title={`선택한 장소 근처 ${selectedCategory.emoji} ${selectedCategory.label}`}
            places={nearbyPlaces}
            viewMode={placeListViewMode}
            onViewModeChange={setPlaceListViewMode}
            isEditing={canModify}
            categories={categories}
            photoCache={photoCache}
            onLoadPhotos={loadPhotos}
            onSelect={selectPlace}
            onAdd={() => (canEdit ? setAddPlaceCategory(selectedCategoryId) : onRequireAuth())}
            onDelete={(place) => (canEdit ? void deletePlace(place) : onRequireAuth())}
            onMoveCategory={(place, categoryId) => (canEdit ? void movePlaceToCategory(place, categoryId) : onRequireAuth())}
            deletingId={deletingId}
            movingCategoryPlaceId={movingCategoryPlaceId}
            onOpenPhotos={openPhotoDialog}
          />
        </section>
      </PageContainer>

      {addPlaceCategory ? (
        <AddPlaceDialog
          category={addPlaceCategory}
          categories={categories}
          onClose={() => setAddPlaceCategory(null)}
          onCreated={addPlace}
        />
      ) : null}
      {isCategoryDialogOpen ? (
        <AddCategoryDialog onClose={() => setIsCategoryDialogOpen(false)} onCreated={addCategory} />
      ) : null}
      {editTarget ? (
        <EditPlaceDialog
          place={editTarget}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={(place) => {
            updatePlace(place);
            setEditTarget(null);
          }}
        />
      ) : null}
      {isGoogleSyncDialogOpen ? (
        <GoogleMapsSyncDialog onClose={() => setIsGoogleSyncDialogOpen(false)} onSynced={() => void refreshPlaces()} />
      ) : null}
      {photoTarget ? (
        <PlacePhotoDialog
          place={photoTarget}
          categories={categories}
          photoState={photoCache[photoTarget.id] ?? emptyPhotoState}
          onClose={() => setPhotoTarget(null)}
          onRetry={() => void loadPhotos(photoTarget, true)}
        />
      ) : null}
    </>
  );
}
