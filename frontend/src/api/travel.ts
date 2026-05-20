import { apiBaseUrl } from '@/config/env';
import { authHeaders } from '@/api/auth';
import { readData, readError } from './client';
import type {
  CategoryId,
  CategoryOption,
  GoogleMapsListPreview,
  GoogleMapsListSyncResult,
  GoogleMapsPreview,
  Place,
  PlaceDraft,
  PlacePhoto
} from '@/types/travel';

export async function fetchCategories() {
  const response = await fetch(`${apiBaseUrl}/api/categories`, {
    headers: authHeaders()
  });
  return readData<CategoryOption[]>(response, '카테고리 목록을 불러오지 못했습니다.');
}

export async function createCategory(input: Pick<CategoryOption, 'label' | 'emoji'>) {
  const response = await fetch(`${apiBaseUrl}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input)
  });

  return readData<CategoryOption>(response, '카테고리를 저장하지 못했습니다.');
}

export async function deleteCategory(categoryId: CategoryId) {
  const response = await fetch(`${apiBaseUrl}/api/categories/${categoryId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });

  if (response.ok) return;

  throw new Error(await readError(response, '카테고리를 삭제하지 못했습니다.'));
}

export async function fetchPlaces() {
  const response = await fetch(`${apiBaseUrl}/api/restaurants`, {
    headers: authHeaders()
  });
  return readData<Place[]>(response, '장소 목록을 불러오지 못했습니다.');
}

export async function previewGoogleMapsPlace(googleMapsUrl: string, category: CategoryId) {
  const response = await fetch(`${apiBaseUrl}/api/google-maps/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ googleMapsUrl, category })
  });

  return readData<GoogleMapsPreview>(response, 'Google Maps 정보를 가져오지 못했습니다.');
}

export async function previewGoogleMapsList(googleMapsUrl: string) {
  const response = await fetch(`${apiBaseUrl}/api/google-maps/list-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ googleMapsUrl })
  });

  return readData<GoogleMapsListPreview>(response, 'Google Maps 즐겨찾기 목록을 읽지 못했습니다.');
}

export async function syncGoogleMapsList(googleMapsUrl: string, selectedSyncKeys?: string[]) {
  const response = await fetch(`${apiBaseUrl}/api/google-maps/sync-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ googleMapsUrl, selectedSyncKeys })
  });

  return readData<GoogleMapsListSyncResult>(response, 'Google Maps 즐겨찾기 목록을 가져오지 못했습니다.');
}

export async function createPlace(draft: PlaceDraft) {
  const response = await fetch(`${apiBaseUrl}/api/restaurants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(draft)
  });

  return readData<Place>(response, '장소를 저장하지 못했습니다.');
}

export async function updatePlace(placeId: string, draft: PlaceDraft) {
  const response = await fetch(`${apiBaseUrl}/api/restaurants/${placeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(draft)
  });

  return readData<Place>(response, '장소를 수정하지 못했습니다.');
}

export async function updatePlaceDescription(placeId: string, description: string) {
  const response = await fetch(`${apiBaseUrl}/api/restaurants/${placeId}/description`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ description })
  });

  return readData<Place>(response, '설명을 저장하지 못했습니다.');
}

export async function deletePlace(placeId: string) {
  const response = await fetch(`${apiBaseUrl}/api/restaurants/${placeId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });

  if (response.ok) return;

  throw new Error(await readError(response, '장소를 삭제하지 못했습니다.'));
}

export async function fetchPlacePhotos(placeId: string) {
  const response = await fetch(`${apiBaseUrl}/api/restaurants/${placeId}/photos`, {
    headers: authHeaders()
  });
  return readData<PlacePhoto[]>(response, '사진을 불러오지 못했습니다.');
}
