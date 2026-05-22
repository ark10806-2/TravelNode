import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inputClass, textareaClass } from '@/constants/travel';
import type { CategoryOption, PlaceDraft, TravelMode } from '@/types/travel';

type PlaceFormFieldsProps = {
  categories: CategoryOption[];
  draft: PlaceDraft;
  showCategory?: boolean;
  onChange: <Field extends keyof PlaceDraft>(field: Field, value: PlaceDraft[Field]) => void;
};

export function PlaceFormFields({
  categories,
  draft,
  showCategory = false,
  onChange
}: PlaceFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showCategory ? (
        <label className="grid gap-2 text-sm font-semibold">
          카테고리
          <Select value={draft.category} onValueChange={(value) => onChange('category', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.emoji} {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
      <label className="grid gap-2 text-sm font-semibold">
        장소명
        <input className={inputClass} value={draft.name} onChange={(event) => onChange('name', event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        종류
        <input className={inputClass} value={draft.cuisine} onChange={(event) => onChange('cuisine', event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        대표 항목
        <input className={inputClass} value={draft.menu} onChange={(event) => onChange('menu', event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        설명
        <textarea
          className={textareaClass}
          value={draft.description}
          onChange={(event) => onChange('description', event.target.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        메모
        <textarea
          className={textareaClass}
          value={draft.googleMapsNote ?? ''}
          placeholder="Google Maps 즐겨찾기 메모 또는 직접 남긴 참고사항 (Markdown 지원)"
          onChange={(event) => onChange('googleMapsNote', event.target.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        주소
        <input className={inputClass} value={draft.address} onChange={(event) => onChange('address', event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        Google Place ID
        <input
          className={inputClass}
          value={draft.googlePlaceId ?? ''}
          placeholder="Google Maps에서 가져오면 자동으로 채워집니다."
          onChange={(event) => onChange('googlePlaceId', event.target.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        위도
        <input
          className={inputClass}
          value={draft.latitude}
          onChange={(event) => onChange('latitude', Number(event.target.value))}
          inputMode="decimal"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        경도
        <input
          className={inputClass}
          value={draft.longitude}
          onChange={(event) => onChange('longitude', Number(event.target.value))}
          inputMode="decimal"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        이동 방식
        <Select value={draft.travelMode} onValueChange={(value) => onChange('travelMode', value as TravelMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walk">도보</SelectItem>
            <SelectItem value="transit">대중교통</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        이동 시간
        <input
          className={inputClass}
          value={draft.travelMinutes}
          onChange={(event) => onChange('travelMinutes', Number(event.target.value))}
          inputMode="numeric"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        거리 표시
        <input
          className={inputClass}
          value={draft.distanceLabel}
          onChange={(event) => onChange('distanceLabel', event.target.value)}
        />
      </label>
    </div>
  );
}
