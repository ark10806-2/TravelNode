import { useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { createPlace, previewGoogleMapsPlace } from '@/api/travel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import { createEmptyDraft, getCategoryBadgeClass, getCategoryOption } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, Place, PlaceDraft } from '@/types/travel';
import { ModalFrame } from './ModalFrame';
import { PlaceFormFields } from './PlaceFormFields';

type AddPlaceDialogProps = {
  category: CategoryId;
  categories: CategoryOption[];
  onClose: () => void;
  onCreated: (place: Place) => void;
};

export function AddPlaceDialog({ category, categories, onClose, onCreated }: AddPlaceDialogProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [draft, setDraft] = useState<PlaceDraft>(() => createEmptyDraft(category));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const categoryOption = getCategoryOption(categories, category);

  function updateDraft<Field extends keyof PlaceDraft>(field: Field, value: PlaceDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function fetchGoogleMapsPreview() {
    setFormError('');
    setWarnings([]);
    setIsPreviewLoading(true);

    try {
      const preview = await previewGoogleMapsPlace(googleMapsUrl, category);
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
      const place = await createPlace(draft);
      onCreated(place);
      onClose();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '장소를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame
      title="Google Maps 링크로 추가"
      maxWidth="max-w-3xl"
      scroll
      onClose={onClose}
      eyebrow={
        <Badge variant="outline" className={getCategoryBadgeClass(category)}>
          {categoryOption.emoji} {categoryOption.label}
        </Badge>
      }
    >
      <div className="grid gap-5 p-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="googleMapsUrl">
            Google Maps 링크
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="googleMapsUrl"
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
              가져오기
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

        <PlaceFormFields categories={categories} draft={draft} onChange={updateDraft} />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={savePlace} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
