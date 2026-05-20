import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccommodationSelectorDialog } from '@/components/dialogs/AccommodationSelectorDialog';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/place/AppHeader';
import { CategoryFilterBar } from '@/components/place/CategoryFilterBar';
import { PlaceList, type PlaceListViewMode } from '@/components/place/PlaceList';
import { PlacesPageDialogs } from '@/components/place/PlacesPageDialogs';
import { SelectedPlacePanel } from '@/components/place/SelectedPlacePanel';
import { TravelMap } from '@/components/place/TravelMap';
import { ReservationDetailDialog } from '@/components/reservation/ReservationDetailDialog';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useReservations } from '@/hooks/useReservations';
import type { TravelPlacesState } from '@/hooks/useTravelPlaces';
import { toHotelDistancePlaces } from '@/lib/place-utils';
import { hotelSchedulePlace } from '@/lib/schedule-utils';
import type { Reservation } from '@/types/reservation';
import type { CategoryId, NearbyPlace, PhotoState, Place } from '@/types/travel';

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

const placeReferenceStorageKey = 'travel-node-place-reference-id';

function isReferencePlaceId(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function PlacesPage({ travelPlaces, canEdit, isEditing, isDarkMode, onRequireAuth }: PlacesPageProps) {
  const {
    categories,
    selectedCategory,
    selectedCategoryId,
    setSelectedCategoryId,
    visiblePlaces,
    places,
    selectedPlace,
    setSelectedId,
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
  const [mobilePlaceListViewMode, setMobilePlaceListViewMode] = useState<PlaceListViewMode>('table');
  const [placeListViewMode, setPlaceListViewMode] = useState<PlaceListViewMode>('table');
  const [reservationTarget, setReservationTarget] = useState<{ place: Place; reservations: Reservation[] } | null>(null);
  const { reservations } = useReservations(false);
  const [referencePlaceId, setReferencePlaceId] = usePersistedState<string | null>(
    placeReferenceStorageKey,
    null,
    isReferencePlaceId
  );
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const canModify = isEditing && canEdit;
  const reservationsByPlaceId = useMemo(() => groupReservationsByPlaceId(reservations), [reservations]);
  const referencePlace = useMemo(
    () => (referencePlaceId ? places.find((place) => place.id === referencePlaceId) ?? hotelSchedulePlace : hotelSchedulePlace),
    [places, referencePlaceId]
  );
  const listReferencePlace = selectedPlace ?? referencePlace;
  const selectedNearbyPlaces = useMemo<NearbyPlace[]>(
    () => {
      const sortedPlaces = toHotelDistancePlaces(visiblePlaces, listReferencePlace);
      if (!selectedPlace) return sortedPlaces;

      return sortedPlaces.sort((a, b) => {
        if (a.id === selectedPlace.id) return -1;
        if (b.id === selectedPlace.id) return 1;
        return a.distanceFromSelectedKm - b.distanceFromSelectedKm;
      });
    },
    [listReferencePlace, selectedPlace, visiblePlaces]
  );

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

  const openReservations = useCallback((place: Place, linkedReservations: Reservation[]) => {
    if (!linkedReservations.length) return;
    setReservationTarget({ place, reservations: linkedReservations });
  }, []);

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
          referencePlace={referencePlace}
          onChangeReference={() => setIsReferenceDialogOpen(true)}
          isEditing={canModify}
          onOpenGoogleMapsSync={() => (canEdit ? setIsGoogleSyncDialogOpen(true) : onRequireAuth())}
        />

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="hidden gap-3 sm:gap-4 md:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <TravelMap
            places={visiblePlaces}
            selectedPlace={selectedPlace}
            referencePlace={referencePlace}
            status={status}
            isDarkMode={isDarkMode}
            onSelectPlace={selectPlace}
          />
          <SelectedPlacePanel
            place={selectedPlace}
            referencePlace={referencePlace}
            categories={categories}
            photoState={selectedPlace ? photoCache[selectedPlace.id] ?? emptyPhotoState : emptyPhotoState}
            reservations={selectedPlace ? reservationsByPlaceId[selectedPlace.id] ?? [] : []}
            isEditing={canModify}
            movingCategoryPlaceId={movingCategoryPlaceId}
            onEditPlace={(place) => (canEdit ? setEditTarget(place) : onRequireAuth())}
            onMoveCategory={(place, categoryId) => (canEdit ? void movePlaceToCategory(place, categoryId) : onRequireAuth())}
            onOpenPhotos={openPhotoDialog}
            onOpenReservations={openReservations}
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

          <div className="md:hidden">
            <PlaceList
              title={`${selectedCategory.emoji} ${selectedCategory.label} 선택 장소 주변`}
              places={selectedNearbyPlaces}
              referencePlace={listReferencePlace}
              viewMode={mobilePlaceListViewMode}
              onViewModeChange={setMobilePlaceListViewMode}
              isEditing={canModify}
              categories={categories}
              photoCache={photoCache}
              reservationsByPlaceId={reservationsByPlaceId}
              onLoadPhotos={loadPhotos}
              onAdd={() => (canEdit ? setAddPlaceCategory(selectedCategoryId) : onRequireAuth())}
              onDelete={(place) => (canEdit ? void deletePlace(place) : onRequireAuth())}
              onMoveCategory={(place, categoryId) => (canEdit ? void movePlaceToCategory(place, categoryId) : onRequireAuth())}
              deletingId={deletingId}
              movingCategoryPlaceId={movingCategoryPlaceId}
              onOpenPhotos={openPhotoDialog}
              onOpenReservations={openReservations}
              onEditPlace={(place) => (canEdit ? setEditTarget(place) : onRequireAuth())}
              onSelectPlace={selectPlace}
            />
          </div>

          <div className="hidden md:block">
            <PlaceList
              title={`선택 장소 주변 ${selectedCategory.emoji} ${selectedCategory.label}`}
              places={selectedNearbyPlaces}
              referencePlace={listReferencePlace}
              viewMode={placeListViewMode}
              onViewModeChange={setPlaceListViewMode}
              isEditing={canModify}
              categories={categories}
              photoCache={photoCache}
              reservationsByPlaceId={reservationsByPlaceId}
              onLoadPhotos={loadPhotos}
              onAdd={() => (canEdit ? setAddPlaceCategory(selectedCategoryId) : onRequireAuth())}
              onDelete={(place) => (canEdit ? void deletePlace(place) : onRequireAuth())}
              onMoveCategory={(place, categoryId) => (canEdit ? void movePlaceToCategory(place, categoryId) : onRequireAuth())}
              deletingId={deletingId}
              movingCategoryPlaceId={movingCategoryPlaceId}
              onOpenPhotos={openPhotoDialog}
              onOpenReservations={openReservations}
              onEditPlace={(place) => (canEdit ? setEditTarget(place) : onRequireAuth())}
              selectedPlaceId={selectedPlace?.id ?? null}
              enableExpandedDetails={false}
              onSelectPlace={selectPlace}
            />
          </div>
        </section>
      </PageContainer>

      <PlacesPageDialogs
        addPlaceCategory={addPlaceCategory}
        isCategoryDialogOpen={isCategoryDialogOpen}
        editTarget={editTarget}
        photoTarget={photoTarget}
        isGoogleSyncDialogOpen={isGoogleSyncDialogOpen}
        categories={categories}
        photoCache={photoCache}
        onCloseAddPlace={() => setAddPlaceCategory(null)}
        onPlaceCreated={addPlace}
        onCloseCategoryDialog={() => setIsCategoryDialogOpen(false)}
        onCategoryCreated={addCategory}
        onCloseEditPlace={() => setEditTarget(null)}
        onPlaceSaved={(place) => {
          updatePlace(place);
          setEditTarget(null);
        }}
        onCloseGoogleSync={() => setIsGoogleSyncDialogOpen(false)}
        onGoogleSynced={() => void refreshPlaces()}
        onClosePhotos={() => setPhotoTarget(null)}
        onRetryPhotos={(place) => void loadPhotos(place, true)}
      />
      {isReferenceDialogOpen ? (
        <AccommodationSelectorDialog
          title="장소 기준점 변경"
          description="장소 탭에서 거리 정렬과 지도 기준으로 사용할 위치를 선택합니다. 기본 숙소를 고르면 기존 기준점으로 돌아갑니다."
          places={places}
          categories={categories}
          selectedPlaceId={referencePlaceId}
          onSelect={setReferencePlaceId}
          onClose={() => setIsReferenceDialogOpen(false)}
        />
      ) : null}
      {reservationTarget ? (
        <ReservationDetailDialog
          place={reservationTarget.place}
          reservations={reservationTarget.reservations}
          onClose={() => setReservationTarget(null)}
        />
      ) : null}
    </>
  );
}

function groupReservationsByPlaceId(reservations: Reservation[]) {
  return reservations.reduce<Record<string, Reservation[]>>((groups, reservation) => {
    if (!reservation.placeId) return groups;
    groups[reservation.placeId] = [...(groups[reservation.placeId] ?? []), reservation];
    return groups;
  }, {});
}
