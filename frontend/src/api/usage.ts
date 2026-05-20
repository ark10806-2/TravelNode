import { authHeaders } from '@/api/auth';
import { apiBaseUrl } from '@/config/env';
import { readData } from './client';

export type ApiUsageStatus = 'normal' | 'warning' | 'danger' | 'exceeded';

export type ApiUsageItem = {
  serviceId: string;
  name: string;
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
  status: ApiUsageStatus;
};

export type ApiUsageChartPoint = {
  date: string;
  requestCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  hitRate: number | null;
};

export type ApiUsageChart = {
  serviceId: string;
  name: string;
  totalRequests: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  hitRate: number | null;
  points: ApiUsageChartPoint[];
};

export type ApiUsageSummary = {
  periodStart: string;
  periodEnd: string;
  totalUsed: number;
  totalLimit: number;
  totalPercentage: number;
  services: ApiUsageItem[];
  charts: ApiUsageChart[];
};

export async function fetchApiUsage() {
  const response = await fetch(`${apiBaseUrl}/api/api-usage`, {
    headers: authHeaders()
  });
  return readData<ApiUsageSummary>(response, 'API 사용량을 불러오지 못했습니다.');
}

export async function recordApiUsage(
  serviceId: string,
  count = 1,
  metrics: { cacheHitCount?: number; cacheMissCount?: number } = {}
) {
  const response = await fetch(`${apiBaseUrl}/api/api-usage/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ serviceId, count, ...metrics })
  });

  return readData<ApiUsageSummary>(response, 'API 사용량을 기록하지 못했습니다.');
}

export async function updateApiUsage(serviceId: string, used: number, limit: number) {
  const response = await fetch(`${apiBaseUrl}/api/api-usage/${serviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ used, limit })
  });

  return readData<ApiUsageSummary>(response, 'API 사용량을 저장하지 못했습니다.');
}
