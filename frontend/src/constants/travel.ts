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
  'toss-input-surface h-11 w-full rounded-2xl border border-transparent px-3 text-sm font-medium outline-none ring-offset-background transition focus:border-primary/20 focus:ring-2 focus:ring-ring/20';

export const textareaClass =
  'toss-input-surface min-h-20 w-full rounded-2xl border border-transparent px-3 py-2 text-sm font-medium outline-none ring-offset-background transition focus:border-primary/20 focus:ring-2 focus:ring-ring/20';
