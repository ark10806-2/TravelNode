import { createId } from '@/lib/id';
import { formatBytes } from '@/lib/reservation-utils';
import type { ReservationAttachment } from '@/types/reservation';

export const maxReservationAttachmentBytes = 5 * 1024 * 1024;
export const maxReservationAttachmentTotalBytes = 20 * 1024 * 1024;
export const maxReservationAttachments = 8;

export function readReservationAttachment(file: File): Promise<ReservationAttachment> {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    return Promise.reject(new Error('이미지 또는 PDF 파일만 첨부할 수 있습니다.'));
  }

  if (file.size > maxReservationAttachmentBytes) {
    return Promise.reject(new Error(`${file.name} 파일이 5MB를 초과합니다.`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: createId('reservation-file'),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl: String(reader.result)
      });
    };
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(file);
  });
}

export function mergeReservationAttachments(
  currentAttachments: ReservationAttachment[],
  incomingAttachments: ReservationAttachment[]
) {
  const nextAttachments = [...currentAttachments];
  const existingKeys = new Set(currentAttachments.map(attachmentIdentityKey));
  const skippedDuplicates: string[] = [];
  const skippedOverflow: string[] = [];
  let totalSizeBytes = currentAttachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);

  for (const attachment of incomingAttachments) {
    if (existingKeys.has(attachmentIdentityKey(attachment))) {
      skippedDuplicates.push(attachment.fileName);
      continue;
    }

    if (nextAttachments.length >= maxReservationAttachments) {
      skippedOverflow.push(attachment.fileName);
      continue;
    }

    if (totalSizeBytes + attachment.sizeBytes > maxReservationAttachmentTotalBytes) {
      skippedOverflow.push(attachment.fileName);
      continue;
    }

    nextAttachments.push(attachment);
    existingKeys.add(attachmentIdentityKey(attachment));
    totalSizeBytes += attachment.sizeBytes;
  }

  const messages = [
    skippedDuplicates.length ? `이미 추가된 파일은 건너뛰었습니다: ${skippedDuplicates.join(', ')}` : '',
    skippedOverflow.length
      ? `첨부는 최대 ${maxReservationAttachments}개, 총 ${formatBytes(maxReservationAttachmentTotalBytes)}까지만 저장할 수 있어 일부 파일을 제외했습니다: ${skippedOverflow.join(', ')}`
      : ''
  ].filter(Boolean);

  return {
    attachments: nextAttachments,
    message: messages.join(' ')
  };
}

function attachmentIdentityKey(attachment: Pick<ReservationAttachment, 'fileName' | 'sizeBytes' | 'contentType'>) {
  return `${attachment.fileName.trim().toLowerCase()}|${attachment.sizeBytes}|${attachment.contentType.trim().toLowerCase()}`;
}
