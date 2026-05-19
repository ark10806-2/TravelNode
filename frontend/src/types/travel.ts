export type CategoryId = string;
export type TravelMode = 'walk' | 'transit';
export type TravelModeFilter = 'all' | TravelMode;
export type LoadStatus = 'loading' | 'ready' | 'error';

export type CategoryOption = {
  id: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type Place = {
  id: string;
  name: string;
  category: CategoryId;
  cuisine: string;
  menu: string;
  description: string;
  googleMapsNote: string | null;
  address: string;
  googleMapsUrl: string;
  latitude: number;
  longitude: number;
  travelMode: TravelMode;
  travelMinutes: number;
  distanceLabel: string;
};

export type PlaceDraft = Omit<Place, 'id'>;

export type NearbyPlace = Place & {
  distanceFromSelectedKm: number;
};

export type GoogleMapsPreview = {
  restaurant: PlaceDraft;
  resolvedUrl: string | null;
  warnings: string[];
};

export type GoogleMapsListSyncResult = {
  listTitle: string | null;
  resolvedUrl: string | null;
  requestedCount: number;
  createdCount: number;
  enrichedCount: number;
  preservedCustomizedCount: number;
  skippedExistingCount: number;
  skippedDeletedCount: number;
  failedCount: number;
  created: Place[];
  details: GoogleMapsSyncDetail[];
  warnings: string[];
};

export type GoogleMapsSyncDetail = {
  name: string;
  status: 'created' | 'enriched' | 'preserved' | 'unchanged' | 'deleted' | string;
  label: string;
  updatedFields: string[];
  preservedFields: string[];
};

export type GoogleMapsListPreviewPlace = PlaceDraft & {
  syncKey: string;
  thumbnailUrl: string | null;
};

export type GoogleMapsListPreview = {
  listTitle: string | null;
  resolvedUrl: string | null;
  requestedCount: number;
  failedCount: number;
  places: GoogleMapsListPreviewPlace[];
  warnings: string[];
};

export type PlacePhoto = {
  url: string;
  widthPx: number | null;
  heightPx: number | null;
  authorName: string | null;
  authorUri: string | null;
};

export type PhotoState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  photos: PlacePhoto[];
  error?: string;
};
