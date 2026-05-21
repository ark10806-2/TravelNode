import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteCategory as deleteCategoryRequest,
  deletePlace as deletePlaceRequest,
  fetchCategories,
  fetchPlacePhotos,
  fetchPlaces,
  updatePlace as updatePlaceRequest
} from '@/api/travel';
import { defaultCategoryOptions } from '@/constants/travel';
import { getCategoryOption, haversineKm, mergeCategoryOptions, normalizeCategories } from '@/lib/place-utils';
import type {
  CategoryId,
  CategoryOption,
  LoadStatus,
  PhotoState,
  Place,
  PlaceDraft,
  TravelModeFilter
} from '@/types/travel';

function toPlaceDraft(place: Place, category: CategoryId): PlaceDraft {
  return {
    name: place.name,
    category,
    cuisine: place.cuisine,
    menu: place.menu,
    description: place.description,
    googleMapsNote: place.googleMapsNote,
    address: place.address,
    googleMapsUrl: place.googleMapsUrl,
    latitude: place.latitude,
    longitude: place.longitude,
    travelMode: place.travelMode,
    travelMinutes: place.travelMinutes,
    distanceLabel: place.distanceLabel
  };
}

export function useTravelPlaces() {
  const [categories, setCategories] = useState<CategoryOption[]>(defaultCategoryOptions);
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId>('meal');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelModeFilter>('all');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingCategoryPlaceId, setMovingCategoryPlaceId] = useState<string | null>(null);
  const [photoCache, setPhotoCache] = useState<Record<string, PhotoState>>({});
  const photoCacheRef = useRef(photoCache);

  useEffect(() => {
    photoCacheRef.current = photoCache;
  }, [photoCache]);

  const visiblePlaces = useMemo(() => {
    return places.filter((place) => {
      const matchesCategory = place.category === selectedCategoryId;
      const matchesTravelMode = travelMode === 'all' || place.travelMode === travelMode;
      return matchesCategory && matchesTravelMode;
    });
  }, [places, selectedCategoryId, travelMode]);

  const selectedPlace = useMemo(() => {
    return visiblePlaces.find((place) => place.id === selectedId) ?? null;
  }, [selectedId, visiblePlaces]);

  const nearbyPlaces = useMemo(() => {
    if (!selectedPlace) return [];

    return places
      .filter((place) => place.id !== selectedPlace.id && place.category === selectedCategoryId)
      .map((place) => ({
        ...place,
        distanceFromSelectedKm: haversineKm(selectedPlace, place)
      }))
      .sort((a, b) => a.distanceFromSelectedKm - b.distanceFromSelectedKm)
      .slice(0, 8);
  }, [places, selectedCategoryId, selectedPlace]);

  const selectedCategory = getCategoryOption(categories, selectedCategoryId);

  const refreshCategories = useCallback(async () => {
    const nextCategories = normalizeCategories(await fetchCategories());
    setCategories(nextCategories);
    setSelectedCategoryId((current) =>
      nextCategories.some((category) => category.id === current) ? current : nextCategories[0]?.id ?? 'meal'
    );
    return nextCategories;
  }, []);

  const refreshPlaces = useCallback(async () => {
    const nextPlaces = await fetchPlaces();
    setPlaces(nextPlaces);
    setSelectedId((current) => (current && nextPlaces.some((place) => place.id === current) ? current : null));
    return nextPlaces;
  }, []);

  const refreshAll = useCallback(async () => {
    setStatus('loading');
    setError('');

    try {
      await Promise.all([refreshCategories(), refreshPlaces()]);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '서버에서 장소 데이터를 불러오지 못했습니다.');
      setStatus('error');
    }
  }, [refreshCategories, refreshPlaces]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const addCategory = useCallback((category: CategoryOption) => {
    setCategories((current) => mergeCategoryOptions(current, category));
    setSelectedCategoryId(category.id);
  }, []);

  const deleteCategory = useCallback(
    async (category: CategoryOption) => {
      if (['meal', 'dessert', 'sightseeing'].includes(category.id)) {
        setError('기본 카테고리는 삭제할 수 없습니다.');
        return;
      }

      const placeCount = places.filter((place) => place.category === category.id).length;
      if (placeCount > 0) {
        setError(`이 카테고리를 사용하는 장소가 ${placeCount}개 있어 삭제할 수 없습니다.`);
        return;
      }

      if (!window.confirm(`${category.emoji} ${category.label} 카테고리를 삭제할까요?`)) return;

      setError('');
      try {
        await deleteCategoryRequest(category.id);
        setCategories((current) => {
          const nextCategories = current.filter((item) => item.id !== category.id);
          setSelectedCategoryId((currentCategoryId) =>
            currentCategoryId === category.id ? nextCategories[0]?.id ?? 'meal' : currentCategoryId
          );
          return nextCategories;
        });
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : '카테고리를 삭제하지 못했습니다.');
      }
    },
    [places]
  );

  const addPlace = useCallback(
    (place: Place) => {
      setPlaces((current) => [...current, place]);
      setSelectedId(place.id);
      setSelectedCategoryId(place.category);
      void refreshPlaces();
    },
    [refreshPlaces]
  );

  const updatePlace = useCallback((place: Place) => {
    setPlaces((current) => current.map((item) => (item.id === place.id ? place : item)));
    setSelectedId(place.id);
    setSelectedCategoryId(place.category);
  }, []);

  const movePlaceToCategory = useCallback(
    async (place: Place, categoryId: CategoryId) => {
      if (place.category === categoryId) return;

      setMovingCategoryPlaceId(place.id);
      setError('');

      try {
        const updatedPlace = await updatePlaceRequest(place.id, toPlaceDraft(place, categoryId));
        updatePlace(updatedPlace);
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : '장소의 카테고리를 옮기지 못했습니다.');
        void refreshCategories();
      } finally {
        setMovingCategoryPlaceId(null);
      }
    },
    [refreshCategories, updatePlace]
  );

  const deletePlace = useCallback(async (place: Place) => {
    if (!window.confirm(`${place.name}을(를) 삭제할까요?`)) return;

    setDeletingId(place.id);
    setError('');

    try {
      await deletePlaceRequest(place.id);
      setPlaces((current) => current.filter((item) => item.id !== place.id));
      setSelectedId((current) => (current === place.id ? null : current));
      setPhotoCache((current) => {
        const { [place.id]: _removed, ...rest } = current;
        return rest;
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '장소를 삭제하지 못했습니다.');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const loadPhotos = useCallback(async (place: Place, force = false) => {
    const currentState = photoCacheRef.current[place.id];
    if (!force && (currentState?.status === 'loading' || currentState?.status === 'ready')) return;

    setPhotoCache((current) => ({
      ...current,
      [place.id]: { status: 'loading', photos: current[place.id]?.photos ?? [] }
    }));

    try {
      const photos = await fetchPlacePhotos(place.id);
      setPhotoCache((current) => ({
        ...current,
        [place.id]: { status: 'ready', photos }
      }));
    } catch (photoError) {
      setPhotoCache((current) => ({
        ...current,
        [place.id]: {
          status: 'error',
          photos: current[place.id]?.photos ?? [],
          error: photoError instanceof Error ? photoError.message : '사진을 불러오지 못했습니다.'
        }
      }));
    }
  }, []);

  return {
    categories,
    selectedCategory,
    selectedCategoryId,
    setSelectedCategoryId,
    places,
    visiblePlaces,
    selectedPlace,
    selectedId,
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
    addPlace,
    updatePlace,
    movePlaceToCategory,
    deletePlace,
    deleteCategory,
    loadPhotos,
    refreshPlaces,
    refreshAll
  };
}

export type TravelPlacesState = ReturnType<typeof useTravelPlaces>;
