import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { updatePlaceDescription } from '@/api/travel';
import { Button } from '@/components/ui/button';
import type { Place } from '@/types/travel';
import { ModalFrame } from './ModalFrame';

type EditDescriptionDialogProps = {
  place: Place;
  onClose: () => void;
  onSaved: (place: Place) => void;
};

export function EditDescriptionDialog({ place, onClose, onSaved }: EditDescriptionDialogProps) {
  const [description, setDescription] = useState(place.description);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function saveDescription() {
    setFormError('');
    setIsSaving(true);

    try {
      const updated = await updatePlaceDescription(place.id, description);
      onSaved(updated);
      onClose();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '설명을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame
      title="설명 수정"
      eyebrow={<p className="text-sm font-semibold text-muted-foreground">{place.name}</p>}
      onClose={onClose}
    >
      <div className="grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-semibold">
          설명
          <textarea
            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={saveDescription} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
