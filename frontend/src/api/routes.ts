import { apiBaseUrl } from '@/config/env';
import { readData } from './client';
import type { RouteLeg, RouteMode } from '@/types/schedule';

export async function fetchCachedRouteLeg(fromPlaceId: string, toPlaceId: string) {
  const fromKey = encodeURIComponent(fromPlaceId);
  const toKey = encodeURIComponent(toPlaceId);
  const response = await fetch(`${apiBaseUrl}/api/route-cache/${fromKey}/${toKey}`);

  if (response.status === 404) return null;

  return normalizeRouteLeg(await readData<RouteLeg>(response, '이동 경로 캐시를 불러오지 못했습니다.'));
}

export async function saveRouteLegCache(fromPlaceId: string, toPlaceId: string, leg: RouteLeg) {
  const response = await fetch(`${apiBaseUrl}/api/route-cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromPlaceId, toPlaceId, ...leg })
  });

  return normalizeRouteLeg(await readData<RouteLeg>(response, '이동 경로 캐시를 저장하지 못했습니다.'));
}

const routeModes: RouteMode[] = ['driving', 'transit', 'walking'];

function normalizeRouteLeg(leg: RouteLeg) {
  return Object.fromEntries(routeModes.flatMap((mode) => (leg[mode] ? [[mode, leg[mode]]] : []))) as RouteLeg;
}
