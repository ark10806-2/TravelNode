import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCategoryBadgeClass, getCategoryOption, getEmbedMapUrl } from '@/lib/place-utils';
import type { CategoryId, CategoryOption, Place } from '@/types/travel';

type PlacePickerDialogProps = {
  dayLabel: string;
  categories: CategoryOption[];
  places: Place[];
  excludedPlaceIds: Set<string>;
  maxSelectable: number;
  onClose: () => void;
  onSelect: (places: Place[]) => void;
};

export function PlacePickerDialog({
  dayLabel,
  categories,
  places,
  excludedPlaceIds,
  maxSelectable,
  onClose,
  onSelect
}: PlacePickerDialogProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('all');
  const [focusedPlaceId, setFocusedPlaceId] = useState<string | null>(null);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const availablePlaces = useMemo(() => places.filter((place) => !excludedPlaceIds.has(place.id)), [excludedPlaceIds, places]);
  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availablePlaces
      .filter((place) => categoryId === 'all' || place.category === categoryId)
      .filter((place) => {
        if (!normalizedQuery) return true;
        return [place.name, place.menu, place.description, place.address, place.cuisine]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePlaces, categoryId, query]);
  const focusedPlace =
    filteredPlaces.find((place) => place.id === focusedPlaceId) ?? filteredPlaces[0] ?? availablePlaces[0] ?? null;
  const selectedPlaces = useMemo(
    () => selectedPlaceIds.flatMap((placeId) => availablePlaces.find((place) => place.id === placeId) ?? []),
    [availablePlaces, selectedPlaceIds]
  );
  const isSelectionFull = selectedPlaceIds.length >= maxSelectable;

  function togglePlace(place: Place) {
    setFocusedPlaceId(place.id);
    setSelectedPlaceIds((current) => {
      if (current.includes(place.id)) return current.filter((placeId) => placeId !== place.id);

      if (current.length >= maxSelectable) return current;
      return [...current, place.id];
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-foreground/40 p-2 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-md border bg-background shadow-xl sm:max-h-[90vh]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-primary">{dayLabel}</p>
            <h2 className="mt-1 text-2xl font-bold">장소 추가</h2>
            <p className="mt-1 text-sm text-muted-foreground">최대 {maxSelectable}개까지 한 번에 선택할 수 있습니다.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 border-b bg-muted/30 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="장소명, 대표 항목, 설명으로 검색"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={categoryId === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryId('all')}>
              전체
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={categoryId === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryId(category.id)}
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {filteredPlaces.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {filteredPlaces.map((place) => {
                  const category = getCategoryOption(categories, place.category);
                  const isFocused = focusedPlace?.id === place.id;
                  const isSelected = selectedPlaceIds.includes(place.id);
                  const isDisabled = !isSelected && isSelectionFull;

                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={`rounded-md border bg-background p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : isFocused
                            ? 'border-primary/70'
                            : 'hover:border-primary hover:bg-muted/30'
                      } ${isDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                      disabled={isDisabled}
                      onMouseEnter={() => setFocusedPlaceId(place.id)}
                      onFocus={() => setFocusedPlaceId(place.id)}
                      onClick={() => togglePlace(place)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={`mb-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(
                              place.category
                            )}`}
                          >
                            {category.emoji} {category.label}
                          </div>
                          <div className="truncate text-base font-bold">{place.name}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{place.menu}</div>
                          <div className="mt-2 line-clamp-3 text-sm leading-5 text-foreground/80">{place.description}</div>
                        </div>
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'border bg-background text-muted-foreground'
                          }`}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                        <div className="truncate">{place.address}</div>
                        <div>{place.distanceLabel}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                추가할 수 있는 장소가 없습니다.
              </div>
            )}
          </div>

          <aside className="order-first shrink-0 border-b bg-muted/25 p-3 sm:p-4 lg:order-none lg:border-b-0 lg:border-l">
            <div className="sticky top-4 grid gap-3">
              <div className="overflow-hidden rounded-md border bg-background">
                {focusedPlace ? (
                  <iframe
                    className="h-52 w-full border-0 lg:h-[420px]"
                    src={getEmbedMapUrl(focusedPlace)}
                    title={`${focusedPlace.name} 지도`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="grid h-52 place-items-center text-sm text-muted-foreground lg:h-[420px]">
                    지도에 표시할 장소가 없습니다.
                  </div>
                )}
              </div>
              {focusedPlace ? (
                <div className="rounded-md border bg-background p-3">
                  <div className="text-sm font-bold">{focusedPlace.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{focusedPlace.address}</div>
                  <div className="mt-2 line-clamp-4 text-sm leading-5 text-foreground/80">{focusedPlace.description}</div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            선택 {selectedPlaces.length}개 / 남은 자리 {maxSelectable}개
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={() => onSelect(selectedPlaces)} disabled={!selectedPlaces.length}>
              <Plus className="h-4 w-4" />
              선택한 장소 추가
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
