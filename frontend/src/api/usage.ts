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

export type ApiUsageSummary = {
  periodStart: string;
  periodEnd: string;
  totalUsed: number;
  totalLimit: number;
  totalPercentage: number;
  services: ApiUsageItem[];
};

export async function fetchApiUsage() {
  const response = await fetch(`${apiBaseUrl}/api/api-usage`);
  return readData<ApiUsageSummary>(response, 'API 사용량을 불러오지 못했습니다.');
}

export async function recordApiUsage(serviceId: string, count = 1) {
  const response = await fetch(`${apiBaseUrl}/api/api-usage/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId, count })
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
