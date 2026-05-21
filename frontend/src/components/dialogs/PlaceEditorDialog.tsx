import { useState } from 'react';
import { Loader2, Plus, Save, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import { usePlaceEditorDraft } from '@/hooks/usePlaceEditorDraft';
import { getCategoryBadgeClass, getCategoryOption } from '@/lib/place-utils';
import type { CategoryOption, Place, PlaceDraft } from '@/types/travel';
import { ModalFrame } from './ModalFrame';
import { PlaceFormFields } from './PlaceFormFields';

type PlaceEditorDialogProps = {
  mode: 'add' | 'edit';
  title: string;
  categories: CategoryOption[];
  initialDraft: PlaceDraft;
  initialGoogleMapsUrl: string;
  showCategory?: boolean;
  saveErrorMessage: string;
  onClose: () => void;
  onSave: (draft: PlaceDraft) => Promise<Place>;
  onSaved: (place: Place) => void;
};

export function PlaceEditorDialog({
  mode,
  title,
  categories,
  initialDraft,
  initialGoogleMapsUrl,
  showCategory = false,
  saveErrorMessage,
  onClose,
  onSave,
  onSaved
}: PlaceEditorDialogProps) {
  const {
    googleMapsUrl,
    draft,
    warnings,
    formError,
    isPreviewLoading,
    setFormError,
    updateDraft,
    updateGoogleMapsUrl,
    fetchGoogleMapsPreview
  } = usePlaceEditorDraft({ initialDraft, initialGoogleMapsUrl });
  const [isSaving, setIsSaving] = useState(false);
  const category = getCategoryOption(categories, draft.category);
  const SaveIcon = mode === 'edit' ? Save : Plus;

  async function savePlace() {
    setFormError('');
    setIsSaving(true);

    try {
      const savedPlace = await onSave(draft);
      onSaved(savedPlace);
      onClose();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : saveErrorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame
      title={title}
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
          <label className="text-sm font-semibold" htmlFor={`${mode}GoogleMapsUrl`}>
            Google Maps 링크
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${mode}GoogleMapsUrl`}
              className={inputClass}
              value={googleMapsUrl}
              onChange={(event) => updateGoogleMapsUrl(event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
            />
            <Button onClick={fetchGoogleMapsPreview} disabled={!googleMapsUrl || isPreviewLoading}>
              {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {mode === 'edit' ? '다시 가져오기' : '가져오기'}
            </Button>
          </div>
        </div>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            {warnings.map((warning) => (
              <p className="mb-1 last:mb-0" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <PlaceFormFields categories={categories} draft={draft} showCategory={showCategory} onChange={updateDraft} />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={savePlace} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
