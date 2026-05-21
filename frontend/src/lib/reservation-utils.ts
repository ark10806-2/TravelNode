import { formatTravelDate } from '@/lib/schedule-utils';
import type { ReservationAttachment } from '@/types/reservation';
import type { ScheduleDay } from '@/types/schedule';

export function formatReservationDayLabel(dayIndex: number | null, scheduleDays: ScheduleDay[]) {
  if (dayIndex == null) return 'DAY 미지정';

  const dayLabel = `DAY ${dayIndex + 1}`;
  const travelDate = scheduleDays[dayIndex]?.travelDate;
  return travelDate ? `${dayLabel} · ${formatTravelDate(travelDate)}` : dayLabel;
}

export function normalizeLink(linkUrl: string) {
  const trimmedUrl = linkUrl.trim();
  if (!trimmedUrl) return '';
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;
  return `https://${trimmedUrl}`;
}

export function downloadReservationAttachment(attachment: ReservationAttachment) {
  try {
    const blob = dataUrlToBlob(attachment.dataUrl, attachment.contentType);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment.fileName || 'reservation-file';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (_error) {
    window.open(attachment.dataUrl, '_blank', 'noopener,noreferrer');
  }
}

function dataUrlToBlob(dataUrl: string, fallbackContentType: string) {
  const separatorIndex = dataUrl.indexOf(',');
  if (separatorIndex < 0) throw new Error('Invalid data URL');

  const metadata = dataUrl.slice(0, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const contentType = metadata.match(/^data:([^;,]+)/)?.[1] ?? fallbackContentType;
  const raw = metadata.includes(';base64') ? window.atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType || 'application/octet-stream' });
}

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`;
}
