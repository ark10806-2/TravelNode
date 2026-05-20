import { authHeaders } from '@/api/auth';
import { apiBaseUrl } from '@/config/env';
import { readData } from './client';
import type { ScheduleDay } from '@/types/schedule';

export async function fetchSchedule() {
  const response = await fetch(`${apiBaseUrl}/api/schedule`, {
    headers: authHeaders()
  });
  return readData<ScheduleDay[]>(response, '일정을 불러오지 못했습니다.');
}

export async function saveSchedule(days: ScheduleDay[]) {
  const response = await fetch(`${apiBaseUrl}/api/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ days })
  });

  return readData<ScheduleDay[]>(response, '일정을 저장하지 못했습니다.');
}
