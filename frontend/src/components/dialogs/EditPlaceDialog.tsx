import { useState } from 'react';
import { Loader2, Save, Search } from 'lucide-react';
import { previewGoogleMapsPlace, updatePlace } from '@/api/travel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import { getCategoryBadgeClass, getCategoryOption } from '@/lib/place-utils';
import type { CategoryOption, Place, PlaceDraft } from '@/types/travel';
import { ModalFrame } from './ModalFrame';
import { PlaceFormFields } from './PlaceFormFields';

type EditPlaceDialogProps = {
  place: Place;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (place: Place) => void;
};

export function EditPlaceDialog({ place, categories, onClose, onSaved }: EditPlaceDialogProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState(place.googleMapsUrl);
  const [draft, setDraft] = useState<PlaceDraft>(() => placeToDraft(place));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const category = getCategoryOption(categories, draft.category);

  function updateDraft<Field extends keyof PlaceDraft>(field: Field, value: PlaceDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function fetchGoogleMapsPreview() {
    setFormError('');
    setWarnings([]);
    setIsPreviewLoading(true);

    try {
      const preview = await previewGoogleMapsPlace(googleMapsUrl, draft.category);
      setDraft(preview.restaurant);
      setGoogleMapsUrl(preview.restaurant.googleMapsUrl);
      setWarnings(preview.warnings);
    } catch (previewError) {
      setFormError(previewError instanceof Error ? previewError.message : 'Google Maps 정보를 가져오지 못했습니다.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function savePlace() {
    setFormError('');
    setIsSaving(true);

    try {
      const updatedPlace = await updatePlace(place.id, draft);
      onSaved(updatedPlace);
      onClose();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '장소를 수정하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame
      title="장소 수정"
      maxWidth="max-w-3xl"
      scroll
      onClose={onClose}
      eyebrow={
        <Badge variant="outline" className={getCategoryBadgeClass(draft.category)}>
          {category.emoji} {category.label}
        </Badge>
      }
    >
      <div className="grid gap-5 p-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="editGoogleMapsUrl">
            Google Maps 링크
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="editGoogleMapsUrl"
              className={inputClass}
              value={googleMapsUrl}
              onChange={(event) => {
                setGoogleMapsUrl(event.target.value);
                updateDraft('googleMapsUrl', event.target.value);
              }}
              placeholder="https://maps.app.goo.gl/..."
            />
            <Button onClick={fetchGoogleMapsPreview} disabled={!googleMapsUrl || isPreviewLoading}>
              {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              다시 가져오기
            </Button>
          </div>
        </div>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {warnings.map((warning) => (
              <p className="mb-1 last:mb-0" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <PlaceFormFields
          categories={categories}
          draft={draft}
          showCategory
          onChange={updateDraft}
        />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={savePlace} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </div>
    </ModalFrame>
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
