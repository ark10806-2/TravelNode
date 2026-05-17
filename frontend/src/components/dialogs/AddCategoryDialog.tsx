import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createCategory } from '@/api/travel';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import type { CategoryOption } from '@/types/travel';
import { ModalFrame } from './ModalFrame';

type AddCategoryDialogProps = {
  onClose: () => void;
  onCreated: (category: CategoryOption) => void;
};

export function AddCategoryDialog({ onClose, onCreated }: AddCategoryDialogProps) {
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function saveCategory() {
    setFormError('');
    setIsSaving(true);

    try {
      const category = await createCategory({ label, emoji });
      onCreated(category);
      onClose();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '카테고리를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame title="카테고리 추가" maxWidth="max-w-md" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-semibold">
          이모지
          <input className={inputClass} value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          이름
          <input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} />
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
          <Button onClick={saveCategory} disabled={isSaving || !label.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
