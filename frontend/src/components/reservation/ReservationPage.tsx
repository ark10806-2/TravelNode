import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, ExternalLink, Hotel, Pencil, Plus, ReceiptText, TicketCheck, TrainFront, Trash2, Utensils } from 'lucide-react';
import { fetchSchedule } from '@/api/schedule';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReservations } from '@/hooks/useReservations';
import { cn } from '@/lib/utils';
import type { Reservation, ReservationDraft, ReservationType } from '@/types/reservation';
import type { Place } from '@/types/travel';

type ReservationPageProps = {
  places: Place[];
  isEditing: boolean;
};

const reservationTypeMeta = {
  restaurant: { label: '식당 예약', icon: Utensils, className: 'bg-amber-500/10 text-amber-800 dark:text-amber-200' },
  ticket: { label: '티켓/입장권', icon: TicketCheck, className: 'bg-rose-500/10 text-rose-800 dark:text-rose-200' },
  transport: { label: '교통', icon: TrainFront, className: 'bg-sky-500/10 text-sky-800 dark:text-sky-200' },
  hotel: { label: '숙소', icon: Hotel, className: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' },
  other: { label: '기타', icon: ReceiptText, className: 'bg-violet-500/10 text-violet-800 dark:text-violet-200' }
} satisfies Record<ReservationType, { label: string; icon: typeof TicketCheck; className: string }>;

const emptyDraft: ReservationDraft = {
  reservationType: 'ticket',
  title: '',
  dayIndex: null,
  placeId: null,
  timeLabel: '',
  referenceNumber: '',
  linkUrl: '',
  notes: ''
};

export function ReservationPage({ places, isEditing }: ReservationPageProps) {
  const [scheduleDayCount, setScheduleDayCount] = useState(1);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const { reservations, status, error, isSaving, addReservation, updateReservation, removeReservation } =
    useReservations(isEditing);
  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const dayCount = Math.max(
    scheduleDayCount,
    ...reservations.map((reservation) => (reservation.dayIndex == null ? 0 : reservation.dayIndex + 1)),
    1
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDayCount() {
      try {
        const scheduleDays = await fetchSchedule();
        if (!cancelled) setScheduleDayCount(Math.max(1, scheduleDays.length));
      } catch {
        if (!cancelled) setScheduleDayCount(1);
      }
    }

    void loadDayCount();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer className="grid gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline">Reservations</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">예약/티켓</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            식당 예약, 입장권, 교통권, 숙소 바우처를 DAY와 장소에 연결해 보관합니다.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {status === 'loading'
              ? '예약/티켓을 불러오는 중입니다.'
              : isSaving
                ? '예약/티켓을 저장하는 중입니다.'
                : '예약/티켓은 서버 DB에 저장됩니다.'}
          </p>
        </div>
        <div className="soft-panel flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <TicketCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">등록된 항목</div>
            <div className="text-xl font-bold">{reservations.length}개</div>
          </div>
        </div>
      </header>

      {status === 'error' && error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isEditing ? (
        <section className="soft-panel overflow-hidden rounded-xl">
          <div className="border-b bg-secondary/80 px-4 py-4">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">예약/티켓 추가</h2>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <ReservationForm
              places={places}
              dayCount={dayCount}
              disabled={isSaving}
              onSubmit={addReservation}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">예약/티켓 목록</h2>
          <Badge variant="outline" className="rounded-full">
            {reservations.length}개
          </Badge>
        </div>

        {reservations.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {reservations.map((reservation) => {
              const place = reservation.placeId ? placesById.get(reservation.placeId) ?? null : null;
              const isEditingThis = editingReservationId === reservation.id;

              return (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  place={place}
                  dayCount={dayCount}
                  places={places}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  isEditingThis={isEditingThis}
                  onEdit={() => setEditingReservationId(reservation.id)}
                  onCancelEdit={() => setEditingReservationId(null)}
                  onSave={(draft) => {
                    updateReservation(reservation.id, draft);
                    setEditingReservationId(null);
                  }}
                  onRemove={() => removeReservation(reservation.id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            아직 등록된 예약/티켓이 없습니다.
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function ReservationCard({
  reservation,
  place,
  dayCount,
  places,
  isEditing,
  isSaving,
  isEditingThis,
  onEdit,
  onCancelEdit,
  onSave,
  onRemove
}: {
  reservation: Reservation;
  place: Place | null;
  dayCount: number;
  places: Place[];
  isEditing: boolean;
  isSaving: boolean;
  isEditingThis: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (draft: ReservationDraft) => void;
  onRemove: () => void;
}) {
  if (isEditingThis) {
    return (
      <article className="soft-panel overflow-hidden rounded-xl">
        <div className="border-b bg-secondary/80 px-4 py-3">
          <h3 className="font-bold">예약/티켓 수정</h3>
        </div>
        <div className="p-3 sm:p-4">
          <ReservationForm
            initialDraft={reservation}
            places={places}
            dayCount={dayCount}
            disabled={isSaving}
            submitLabel="저장"
            onSubmit={onSave}
            onCancel={onCancelEdit}
          />
        </div>
      </article>
    );
  }

  const meta = reservationTypeMeta[reservation.reservationType];
  const Icon = meta.icon;
  const normalizedLink = normalizeLink(reservation.linkUrl);

  return (
    <article className="soft-panel overflow-hidden rounded-xl">
      <div className="border-b bg-secondary/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="outline" className={cn('rounded-full', meta.className)}>
              <Icon className="mr-1 h-3.5 w-3.5" />
              {meta.label}
            </Badge>
            <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{reservation.title}</h3>
          </div>
          {isEditing ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onEdit} disabled={isSaving} aria-label={`${reservation.title} 수정`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onRemove}
                disabled={isSaving}
                aria-label={`${reservation.title} 삭제`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>{reservation.dayIndex == null ? 'DAY 미지정' : `DAY ${reservation.dayIndex + 1}`}</span>
          {reservation.timeLabel ? <span>· {reservation.timeLabel}</span> : null}
        </div>
        {place ? (
          <div className="rounded-lg bg-muted/25 p-3">
            <div className="text-xs font-semibold text-muted-foreground">연결 장소</div>
            <div className="mt-1 font-semibold">{place.name}</div>
          </div>
        ) : null}
        {reservation.referenceNumber ? (
          <div>
            <div className="text-xs font-semibold text-muted-foreground">예약번호</div>
            <div className="mt-1 break-all font-semibold">{reservation.referenceNumber}</div>
          </div>
        ) : null}
        {reservation.notes ? <p className="leading-6 text-muted-foreground">{reservation.notes}</p> : null}
        {normalizedLink ? (
          <Button asChild variant="outline" className="rounded-full">
            <a href={normalizedLink} target="_blank" rel="noreferrer">
              링크 열기
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ReservationForm({
  initialDraft = emptyDraft,
  places,
  dayCount,
  disabled,
  submitLabel = '추가',
  onSubmit,
  onCancel
}: {
  initialDraft?: ReservationDraft;
  places: Place[];
  dayCount: number;
  disabled: boolean;
  submitLabel?: string;
  onSubmit: (draft: ReservationDraft) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<ReservationDraft>(() => ({ ...initialDraft }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSubmit(draft);
    if (!onCancel) setDraft({ ...emptyDraft });
  }

  function updateDraft<K extends keyof ReservationDraft>(field: K, value: ReservationDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="제목">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.title}
            maxLength={120}
            disabled={disabled}
            placeholder="예: 팀랩 입장권, 라멘 예약"
            onChange={(event) => updateDraft('title', event.target.value)}
          />
        </Field>
        <Field label="종류">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.reservationType}
            disabled={disabled}
            onChange={(event) => updateDraft('reservationType', event.target.value as ReservationType)}
          >
            {Object.entries(reservationTypeMeta).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="DAY">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.dayIndex == null ? '' : String(draft.dayIndex)}
            disabled={disabled}
            onChange={(event) => updateDraft('dayIndex', event.target.value === '' ? null : Number(event.target.value))}
          >
            <option value="">DAY 미지정</option>
            {Array.from({ length: dayCount }, (_, dayIndex) => (
              <option key={dayIndex} value={dayIndex}>
                DAY {dayIndex + 1}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시간">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.timeLabel}
            maxLength={80}
            disabled={disabled}
            placeholder="예: 18:30 / 10:00 입장"
            onChange={(event) => updateDraft('timeLabel', event.target.value)}
          />
        </Field>
        <Field label="연결 장소">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.placeId ?? ''}
            disabled={disabled}
            onChange={(event) => updateDraft('placeId', event.target.value || null)}
          >
            <option value="">장소 연결 안 함</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="예약번호">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.referenceNumber}
            maxLength={120}
            disabled={disabled}
            placeholder="예약번호, 티켓 번호"
            onChange={(event) => updateDraft('referenceNumber', event.target.value)}
          />
        </Field>
      </div>
      <Field label="링크">
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          value={draft.linkUrl}
          maxLength={500}
          disabled={disabled}
          placeholder="예약 확인 링크 또는 티켓 URL"
          onChange={(event) => updateDraft('linkUrl', event.target.value)}
        />
      </Field>
      <Field label="메모">
        <textarea
          className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          value={draft.notes}
          maxLength={1000}
          disabled={disabled}
          placeholder="주의사항, QR 위치, 준비물 등"
          onChange={(event) => updateDraft('notes', event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
            취소
          </Button>
        ) : null}
        <Button type="submit" disabled={disabled || !draft.title.trim()}>
          <Plus className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function normalizeLink(linkUrl: string) {
  const trimmedUrl = linkUrl.trim();
  if (!trimmedUrl) return '';
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;
  return `https://${trimmedUrl}`;
}
