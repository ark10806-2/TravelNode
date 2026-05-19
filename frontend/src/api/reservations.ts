import { authHeaders } from '@/api/auth';
import { apiBaseUrl } from '@/config/env';
import { readData } from './client';
import type { Reservation } from '@/types/reservation';

export type ReservationSaveScope = {
  knownReservationIds: string[];
};

export async function fetchReservations() {
  const response = await fetch(`${apiBaseUrl}/api/reservations`);
  return readData<Reservation[]>(response, '예약/티켓을 불러오지 못했습니다.');
}

export async function saveReservations(reservations: Reservation[], scope: ReservationSaveScope) {
  const response = await fetch(`${apiBaseUrl}/api/reservations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reservations, ...scope })
  });

  return readData<Reservation[]>(response, '예약/티켓을 저장하지 못했습니다.');
}
