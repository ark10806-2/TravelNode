import { defaultCategoryOptions, hotel } from '@/constants/travel';
import type { CategoryId, CategoryOption, NearbyPlace, Place, PlaceDraft } from '@/types/travel';

export function haversineKm(a: Pick<Place, 'latitude' | 'longitude'>, b: Pick<Place, 'latitude' | 'longitude'>) {
  const radiusKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function getCategoryOption(categories: CategoryOption[], category: CategoryId) {
  return categories.find((item) => item.id === category) ?? {
    id: category,
    label: category,
    emoji: '📍',
    sortOrder: 100
  };
}

export function mergeCategoryOptions(current: CategoryOption[], category: CategoryOption) {
  const next = current.some((item) => item.id === category.id)
    ? current.map((item) => (item.id === category.id ? category : item))
    : [...current, category];

  return next.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function getCategoryBadgeClass(category: CategoryId) {
  if (category === 'meal') {
    return 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200';
  }
  if (category === 'dessert') {
    return 'border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900/60 dark:bg-pink-950/35 dark:text-pink-200';
  }
  if (category === 'sightseeing') {
    return 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/35 dark:text-teal-200';
  }
  return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200';
}

export function getPlaceInfoUrl(place: Pick<Place, 'name' | 'address'>) {
  const query = encodeURIComponent(`${place.name} ${place.address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getGoogleMapsNoteLabel(place: Pick<Place, 'googleMapsNote'>) {
  return place.googleMapsNote?.trim() || '';
}

export function isDefaultCategoryId(categoryId: CategoryId) {
  return defaultCategoryOptions.some((category) => category.id === categoryId);
}

export function getVisiblePlaceDescription(place: Pick<Place, 'description'>) {
  const description = place.description.trim();
  if (!description) return '';
  return isGeneratedPlaceDescription(description) ? '' : description;
}

export function shouldShowPlaceInfoNeedsReview(place: Pick<Place, 'description'>) {
  return isGeneratedPlaceDescription(place.description.trim());
}

export function getVisibleGoogleMapsNote(place: Pick<Place, 'googleMapsNote'>) {
  return place.googleMapsNote?.trim() ?? '';
}

export function getDuplicatePlaceIds(places: Place[]) {
  const groups = new Map<string, Place[]>();

  places.forEach((place) => {
    const key = normalizeDuplicatePlaceName(place.name);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), place]);
  });

  return new Set(
    Array.from(groups.values())
      .filter((group) => group.length > 1)
      .flatMap((group) => group.map((place) => place.id))
  );
}

function normalizeDuplicatePlaceName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[#[\]().,·・'"\s_-]+/g, '')
    .trim();
}

function isGeneratedPlaceDescription(description: string) {
  if (!description) return false;

  return (
    /^.+의 Google Maps 링크에서 가져온 초안입니다\. 대표 항목과 설명은 저장 전에 확인해주세요\.$/.test(description) ||
    /^.+은 Google Maps 즐겨찾기에서 가져온 장소입니다\. 방문 전 영업시간과 휴무일을 확인해주세요\.$/.test(description) ||
    /^.+은 .+ 목록에서 가져온 장소입니다\. 방문 전 영업시간과 휴무일을 확인해주세요\.$/.test(description)
  );
}

export function getEmbedMapUrl(target: Pick<Place, 'latitude' | 'longitude'> | typeof hotel) {
  return `https://www.google.com/maps?q=${target.latitude},${target.longitude}&z=15&output=embed`;
}

export function getHotelToPlaceEmbedUrl(
  target: Pick<Place, 'latitude' | 'longitude' | 'travelMode'>,
  apiKey?: string,
  originPlace: Pick<Place, 'latitude' | 'longitude'> | typeof hotel = hotel
) {
  const mode = target.travelMode === 'walk' ? 'walking' : 'transit';
  const origin = `${originPlace.latitude},${originPlace.longitude}`;
  const destination = `${target.latitude},${target.longitude}`;

  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(apiKey)}&origin=${origin}&destination=${destination}&mode=${mode}&language=ko&region=JP`;
  }

  return `https://www.google.com/maps?hl=ko&saddr=${origin}&daddr=${destination}&dirflg=${mode === 'walking' ? 'w' : 'r'}&output=embed`;
}

export function createEmptyDraft(category: CategoryId): PlaceDraft {
  return {
    name: '',
    category,
    cuisine: category === 'dessert' ? '디저트 카페' : category === 'sightseeing' ? '관광 명소' : '음식점',
    menu: '',
    description: '',
    googleMapsNote: null,
    address: '',
    googleMapsUrl: '',
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    travelMode: 'walk',
    travelMinutes: 1,
    distanceLabel: '확인 필요'
  };
}

export function normalizeCategories(categories: CategoryOption[]) {
  return categories.length ? categories : defaultCategoryOptions;
}

export function toHotelDistancePlaces(places: Place[], referencePlace: Pick<Place, 'latitude' | 'longitude'> | typeof hotel = hotel): NearbyPlace[] {
  return places
    .map((place) => ({
      ...place,
      distanceFromSelectedKm: haversineKm(referencePlace, place)
    }))
    .sort((a, b) => a.distanceFromSelectedKm - b.distanceFromSelectedKm);
}
