import { createPlace } from '@/api/travel';
import { createEmptyDraft } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, Place } from '@/types/travel';
import { PlaceEditorDialog } from './PlaceEditorDialog';

type AddPlaceDialogProps = {
  category: CategoryId;
  categories: CategoryOption[];
  onClose: () => void;
  onCreated: (place: Place) => void;
};

export function AddPlaceDialog({ category, categories, onClose, onCreated }: AddPlaceDialogProps) {
  return (
    <PlaceEditorDialog
      mode="add"
      title="Google Maps 링크로 추가"
      categories={categories}
      initialDraft={createEmptyDraft(category)}
      initialGoogleMapsUrl=""
      saveErrorMessage="장소를 저장하지 못했습니다."
      onClose={onClose}
      onSave={createPlace}
      onSaved={onCreated}
    />
  );
}
