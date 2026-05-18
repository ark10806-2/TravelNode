import { useMemo, useState, type ReactNode } from 'react';
import { Building2, Check, Search } from 'lucide-react';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { Badge } from '@/components/ui/badge';
import { getCategoryBadgeClass, getCategoryOption } from '@/lib/place-utils';
import { hotelSchedulePlace } from '@/lib/schedule-utils';
import type { CategoryOption, Place } from '@/types/travel';

type AccommodationSelectorDialogProps = {
  title: string;
  description: string;
  places: Place[];
  categories: CategoryOption[];
  selectedPlaceId: string | null;
  onSelect: (placeId: string | null) => void;
  onClose: () => void;
};

export function AccommodationSelectorDialog({
  title,
  description,
  places,
  categories,
  selectedPlaceId,
  onSelect,
  onClose
}: AccommodationSelectorDialogProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlaces = useMemo(() => {
    return places
      .filter((place) => {
        if (!normalizedQuery) return true;
        return [place.name, place.menu, place.description, place.googleMapsNote, place.address, place.cuisine]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedQuery, places]);

  function choose(placeId: string | null) {
    onSelect(placeId);
    onClose();
  }

  return (
    <ModalFrame title={title} maxWidth="max-w-3xl" scroll onClose={onClose}>
      <div className="grid gap-4 p-4 sm:p-5">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="숙소로 사용할 장소 검색"
          />
        </div>

        <div className="grid gap-2">
          <AccommodationButton
            name={hotelSchedulePlace.name}
            description="기본 숙소"
            address={hotelSchedulePlace.address}
            isSelected={selectedPlaceId == null}
            icon={<Building2 className="h-4 w-4" />}
            onClick={() => choose(null)}
          />

          {filteredPlaces.map((place) => {
            const category = getCategoryOption(categories, place.category);

            return (
              <AccommodationButton
                key={place.id}
                name={place.name}
                description={place.menu}
                address={place.address}
                isSelected={selectedPlaceId === place.id}
                badge={
                  <Badge variant="outline" className={getCategoryBadgeClass(place.category)}>
                    {category.emoji} {category.label}
                  </Badge>
                }
                onClick={() => choose(place.id)}
              />
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
}

type AccommodationButtonProps = {
  name: string;
  description: string;
  address: string;
  isSelected: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  onClick: () => void;
};

function AccommodationButton({
  name,
  description,
  address,
  isSelected,
  icon,
  badge,
  onClick
}: AccommodationButtonProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/25' : 'bg-background hover:border-primary/50 hover:bg-muted/25'
      }`}
      onClick={onClick}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-secondary">
        {isSelected ? <Check className="h-4 w-4 text-primary" /> : (icon ?? <Building2 className="h-4 w-4" />)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="line-clamp-1 font-semibold">{name}</span>
          {badge}
        </span>
        <span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">{description}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground/80">{address}</span>
      </span>
    </button>
  );
}
