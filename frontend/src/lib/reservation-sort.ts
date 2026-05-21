import type { Reservation } from '@/types/reservation';

export function sortReservationsBySchedule(reservations: Reservation[]) {
  return [...reservations].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;

    const leftKey = reservationSortKey(left);
    const rightKey = reservationSortKey(right);
    return (
      leftKey.dayOrder - rightKey.dayOrder ||
      leftKey.timeMinutes - rightKey.timeMinutes ||
      left.title.localeCompare(right.title, 'ko') ||
      left.id.localeCompare(right.id)
    );
  });
}

function reservationSortKey(reservation: Reservation) {
  return {
    dayOrder: reservation.dayIndex == null ? Number.MAX_SAFE_INTEGER : reservation.dayIndex,
    timeMinutes: parseReservationTimeMinutes(reservation.timeLabel)
  };
}

function parseReservationTimeMinutes(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return Number.MAX_SAFE_INTEGER;

  const koreanMatch = normalized.match(/(오전|오후)\s*([0-9]{1,2})(?::([0-9]{2}))?/);
  if (koreanMatch) {
    let hour = Number(koreanMatch[2]);
    const minute = Number(koreanMatch[3] ?? 0);
    if (koreanMatch[1] === '오전' && hour === 12) hour = 0;
    if (koreanMatch[1] === '오후' && hour < 12) hour += 12;
    return hour * 60 + minute;
  }

  const amPmMatch = normalized.match(/\b([0-9]{1,2})(?::([0-9]{2}))?\s*(AM|PM)\b/i);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2] ?? 0);
    if (amPmMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    if (amPmMatch[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
    return hour * 60 + minute;
  }

  const timeMatch = normalized.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
  if (timeMatch) return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);

  return Number.MAX_SAFE_INTEGER;
}
