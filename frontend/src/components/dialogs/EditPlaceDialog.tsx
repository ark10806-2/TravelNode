import { updatePlace } from '@/api/travel';
import type { CategoryOption, Place, PlaceDraft } from '@/types/travel';
import { PlaceEditorDialog } from './PlaceEditorDialog';

type EditPlaceDialogProps = {
  place: Place;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (place: Place) => void;
};

export function EditPlaceDialog({ place, categories, onClose, onSaved }: EditPlaceDialogProps) {
  return (
    <PlaceEditorDialog
      mode="edit"
      title="장소 수정"
      categories={categories}
      initialDraft={placeToDraft(place)}
      initialGoogleMapsUrl={place.googleMapsUrl}
      showCategory
      saveErrorMessage="장소를 수정하지 못했습니다."
      onClose={onClose}
      onSave={(draft) => updatePlace(place.id, draft)}
      onSaved={onSaved}
    />
  );
}

function placeToDraft(place: Place): PlaceDraft {
  return {
    name: place.name,
    category: place.category,
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
