import type { CategoryOption, TravelMode } from '@/types/travel';

export const hotel = {
  name: 'Ginza Capital Hotel Moegi',
  latitude: 35.668862,
  longitude: 139.773098
};

export const defaultCategoryOptions: CategoryOption[] = [
  { id: 'meal', label: '맛집', emoji: '🍽️', sortOrder: 10 },
  { id: 'dessert', label: '디저트', emoji: '🍰', sortOrder: 20 },
  { id: 'sightseeing', label: '관광', emoji: '🗼', sortOrder: 30 }
];

export const travelLabel: Record<TravelMode, string> = {
  walk: '도보',
  transit: '대중교통'
};

export const inputClass =
  'h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none ring-offset-background transition focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-secondary/80';

export const textareaClass =
  'min-h-20 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none ring-offset-background transition focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-secondary/80';
