import { routeModes } from '@/lib/schedule-utils';
import type { RouteMode } from '@/types/schedule';

export const routeModePreferenceStorageKey = 'travel-node-route-mode-preferences-v1';
export const defaultEnabledRouteModes: RouteMode[] = ['transit', 'walking'];

const routeModeSet = new Set<RouteMode>(routeModes);

export function loadEnabledRouteModes() {
  try {
    const stored = window.localStorage.getItem(routeModePreferenceStorageKey);
    if (!stored) return defaultEnabledRouteModes;

    return normalizeEnabledRouteModes(JSON.parse(stored));
  } catch {
    return defaultEnabledRouteModes;
  }
}

export function storeEnabledRouteModes(modes: RouteMode[]) {
  window.localStorage.setItem(routeModePreferenceStorageKey, JSON.stringify(normalizeEnabledRouteModes(modes)));
}

export function normalizeEnabledRouteModes(value: unknown): RouteMode[] {
  const modes = Array.isArray(value)
    ? routeModes.filter((mode) => value.includes(mode) && routeModeSet.has(mode))
    : defaultEnabledRouteModes;

  const optimizationModes = modes.filter((mode) => mode !== 'driving');
  if (!optimizationModes.length) {
    return defaultEnabledRouteModes;
  }

  return modes.length ? modes : defaultEnabledRouteModes;
}
