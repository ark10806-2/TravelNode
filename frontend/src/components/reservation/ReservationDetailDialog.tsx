import { CalendarClock, DownloadCloud, ExternalLink, FileText, Hotel, Image, ReceiptText, TicketCheck, TrainFront, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MarkdownText } from '@/components/common/MarkdownText';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTravelDate } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { Reservation, ReservationAttachment, ReservationType } from '@/types/reservation';
import type { ScheduleDay } from '@/types/schedule';
import type { Place } from '@/types/travel';

type ReservationDetailDialogProps = {
  reservations: Reservation[];
  place?: Place | null;
  scheduleDays?: ScheduleDay[];
  onClose: () => void;
};

const reservationTypeMeta: Record<ReservationType, { label: string; icon: LucideIcon; className: string }> = {
  restaurant: { label: '식당 예약', icon: Utensils, className: 'bg-amber-500/10 text-amber-800 dark:text-amber-200' },
  ticket: { label: '티켓/입장권', icon: TicketCheck, className: 'bg-rose-500/10 text-rose-800 dark:text-rose-200' },
  transport: { label: '교통', icon: TrainFront, className: 'bg-sky-500/10 text-sky-800 dark:text-sky-200' },
  hotel: { label: '숙소', icon: Hotel, className: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' },
  other: { label: '기타', icon: ReceiptText, className: 'bg-violet-500/10 text-violet-800 dark:text-violet-200' }
};

export function ReservationDetailDialog({ reservations, place, scheduleDays = [], onClose }: ReservationDetailDialogProps) {
  const title = place ? `${place.name} 예약` : '예약/티켓 상세';

  return (
    <ModalFrame
      title={title}
      maxWidth="max-w-3xl"
      scroll
      onClose={onClose}
      eyebrow={
        <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
          연결 예약 {reservations.length}개
        </Badge>
      }
    >
      <div className="grid gap-3 p-4 sm:p-5">
        {reservations.length ? (
          reservations.map((reservation) => (
            <ReservationDetailCard key={reservation.id} reservation={reservation} scheduleDays={scheduleDays} />
          ))
        ) : (
          <div className="grid min-h-28 place-items-center rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            연결된 예약이 없습니다.
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

function ReservationDetailCard({
  reservation,
  scheduleDays
}: {
  reservation: Reservation;
  scheduleDays: ScheduleDay[];
}) {
  const meta = reservationTypeMeta[reservation.reservationType];
  const Icon = meta.icon;
  const normalizedLink = normalizeLink(reservation.linkUrl);

  return (
    <article className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="border-b bg-secondary/70 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Badge variant="outline" className={cn('rounded-full', meta.className)}>
              <Icon className="mr-1 h-3.5 w-3.5" />
              {meta.label}
            </Badge>
            <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{reservation.title}</h3>
          </div>
          {normalizedLink ? (
            <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
              <a href={normalizedLink} target="_blank" rel="noreferrer">
                링크 열기
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>{formatReservationDayLabel(reservation.dayIndex, scheduleDays)}</span>
          {reservation.timeLabel ? <span>· {reservation.timeLabel}</span> : null}
        </div>

        {reservation.referenceNumber ? (
          <section className="rounded-lg bg-muted/25 p-3">
            <div className="text-xs font-semibold text-muted-foreground">예약번호</div>
            <div className="mt-1 break-all font-semibold">{reservation.referenceNumber}</div>
          </section>
        ) : null}

        {reservation.bookingPlatform ? (
          <section className="rounded-lg bg-muted/25 p-3">
            <div className="text-xs font-semibold text-muted-foreground">예약 플랫폼</div>
            <div className="mt-1 font-semibold">{reservation.bookingPlatform}</div>
          </section>
        ) : null}

        {reservation.notes ? (
          <section className="rounded-lg bg-muted/25 p-3">
            <div className="text-xs font-semibold text-muted-foreground">메모</div>
            <MarkdownText className="mt-1" text={reservation.notes} />
          </section>
        ) : null}

        {reservation.attachments.length ? (
          <section className="grid gap-2">
            <div className="text-xs font-semibold text-muted-foreground">첨부파일</div>
            <ReservationAttachmentGrid attachments={reservation.attachments} />
          </section>
        ) : null}
      </div>
    </article>
  );
}

function ReservationAttachmentGrid({ attachments }: { attachments: ReservationAttachment[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const isImage = attachment.contentType.startsWith('image/');

        return (
          <button
            key={attachment.id}
            type="button"
            className="grid gap-2 overflow-hidden rounded-lg border bg-muted/20 p-2 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => downloadReservationAttachment(attachment)}
          >
            <div className="grid h-28 place-items-center overflow-hidden rounded-md bg-background">
              {isImage ? (
                <img src={attachment.dataUrl} alt={attachment.fileName} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <FileText className="h-9 w-9 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {isImage ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {isImage ? '이미지' : 'PDF'} · {formatBytes(attachment.sizeBytes)}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <DownloadCloud className="h-3.5 w-3.5" />
                다운로드
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatReservationDayLabel(dayIndex: number | null, scheduleDays: ScheduleDay[]) {
  if (dayIndex == null) return 'DAY 미지정';

  const dayLabel = `DAY ${dayIndex + 1}`;
  const travelDate = scheduleDays[dayIndex]?.travelDate;
  return travelDate ? `${dayLabel} · ${formatTravelDate(travelDate)}` : dayLabel;
}

function normalizeLink(linkUrl: string) {
  const trimmedUrl = linkUrl.trim();
  if (!trimmedUrl) return '';
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;
  return `https://${trimmedUrl}`;
}

function downloadReservationAttachment(attachment: ReservationAttachment) {
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

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`;
}
