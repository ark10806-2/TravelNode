import { useState } from 'react';
import { previewGoogleMapsPlace } from '@/api/travel';
import type { PlaceDraft } from '@/types/travel';

type UsePlaceEditorDraftOptions = {
  initialDraft: PlaceDraft;
  initialGoogleMapsUrl: string;
};

export function usePlaceEditorDraft({ initialDraft, initialGoogleMapsUrl }: UsePlaceEditorDraftOptions) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialGoogleMapsUrl);
  const [draft, setDraft] = useState<PlaceDraft>(initialDraft);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  function updateDraft<Field extends keyof PlaceDraft>(field: Field, value: PlaceDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateGoogleMapsUrl(value: string) {
    setGoogleMapsUrl(value);
    updateDraft('googleMapsUrl', value);
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

  return {
    googleMapsUrl,
    draft,
    warnings,
    formError,
    isPreviewLoading,
    setFormError,
    updateDraft,
    updateGoogleMapsUrl,
    fetchGoogleMapsPreview
  };
}
