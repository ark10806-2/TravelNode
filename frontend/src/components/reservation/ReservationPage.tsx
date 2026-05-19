import { FormEvent, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  CalendarClock,
  DownloadCloud,
  ExternalLink,
  FileText,
  Hotel,
  Image,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  TicketCheck,
  TrainFront,
  Trash2,
  UploadCloud,
  Utensils,
  X
} from 'lucide-react';
import { fetchSchedule } from '@/api/schedule';
import { MarkdownInline, MarkdownText } from '@/components/common/MarkdownText';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { PlaceDetailDialog } from '@/components/dialogs/PlaceDetailDialog';
import { PlacePhotoDialog } from '@/components/dialogs/PlacePhotoDialog';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReservations } from '@/hooks/useReservations';
import { formatTravelDate } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { Reservation, ReservationAttachment, ReservationDraft, ReservationType } from '@/types/reservation';
import type { ScheduleDay } from '@/types/schedule';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';

type ReservationPageProps = {
  categories: CategoryOption[];
  places: Place[];
  isEditing: boolean;
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place, force?: boolean) => Promise<void>;
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
  notes: '',
  attachments: []
};

const maxReservationAttachmentBytes = 5 * 1024 * 1024;
const emptyPhotoState: PhotoState = {
  status: 'idle',
  photos: []
};
const googleReservationImportSample = `예시)
Toriton Tokyo Skytree Town Solamachi
2026. 5. 22. 18:30
예약번호: ABC12345
https://example.com/booking
요청사항: 창가 좌석

또는 Google Maps 예약 상세 복사:
5월 26일
예약 내역
화 · 오후 2:30 (JST) · 2명
쓰키시마 몬자야키 고보레야
4.8 (3,112)
몬자야키 전문점
3-chōme-16-9 Tsukishima, Chuo City, Tokyo 104-0052 일본`;

function formatReservationDayLabel(dayIndex: number | null, scheduleDays: ScheduleDay[]) {
  if (dayIndex == null) return 'DAY 미지정';

  const dayLabel = `DAY ${dayIndex + 1}`;
  const travelDate = scheduleDays[dayIndex]?.travelDate;
  return travelDate ? `${dayLabel} · ${formatTravelDate(travelDate)}` : dayLabel;
}

export function ReservationPage({ categories, places, isEditing, photoCache, onLoadPhotos }: ReservationPageProps) {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [isGoogleImportOpen, setIsGoogleImportOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Place | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Place | null>(null);
  const { reservations, status, error, isSaving, addReservation, addReservations, updateReservation, removeReservation } =
    useReservations(isEditing);
  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const currentDetailTarget = detailTarget ? placesById.get(detailTarget.id) ?? detailTarget : null;
  const currentPhotoTarget = photoTarget ? placesById.get(photoTarget.id) ?? photoTarget : null;
  const dayCount = Math.max(
    scheduleDays.length,
    ...reservations.map((reservation) => (reservation.dayIndex == null ? 0 : reservation.dayIndex + 1)),
    1
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDayCount() {
      try {
        const nextScheduleDays = await fetchSchedule();
        if (!cancelled) setScheduleDays(nextScheduleDays);
      } catch {
        if (!cancelled) setScheduleDays([]);
      }
    }

    void loadDayCount();
    return () => {
      cancelled = true;
    };
  }, []);

  function openDetails(place: Place) {
    setDetailTarget(place);
    void onLoadPhotos(place);
  }

  function openPhotos(place: Place) {
    setPhotoTarget(place);
    void onLoadPhotos(place);
  }

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {isEditing ? (
            <Button variant="outline" className="rounded-full" onClick={() => setIsGoogleImportOpen(true)}>
              <DownloadCloud className="h-4 w-4" />
              Google 예약 가져오기
            </Button>
          ) : null}
          <div className="soft-panel flex items-center gap-3 rounded-xl px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <TicketCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">등록된 항목</div>
              <div className="text-xl font-bold">{reservations.length}개</div>
            </div>
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
              scheduleDays={scheduleDays}
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
                  scheduleDays={scheduleDays}
                  places={places}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  isEditingThis={isEditingThis}
                  onEdit={() => setEditingReservationId(reservation.id)}
                  onOpenPlaceDetails={openDetails}
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

      {isGoogleImportOpen ? (
        <GoogleReservationImportDialog
          places={places}
          dayCount={dayCount}
          scheduleDays={scheduleDays}
          disabled={isSaving}
          onClose={() => setIsGoogleImportOpen(false)}
          onImport={(drafts) => {
            addReservations(drafts);
            setIsGoogleImportOpen(false);
          }}
        />
      ) : null}

      {currentDetailTarget ? (
        <PlaceDetailDialog
          place={currentDetailTarget}
          categories={categories}
          photoState={photoCache[currentDetailTarget.id] ?? emptyPhotoState}
          onClose={() => setDetailTarget(null)}
          onOpenPhotos={openPhotos}
        />
      ) : null}

      {currentPhotoTarget ? (
        <PlacePhotoDialog
          place={currentPhotoTarget}
          categories={categories}
          photoState={photoCache[currentPhotoTarget.id] ?? emptyPhotoState}
          onClose={() => setPhotoTarget(null)}
          onRetry={() => void onLoadPhotos(currentPhotoTarget, true)}
        />
      ) : null}
    </PageContainer>
  );
}

function ReservationCard({
  reservation,
  place,
  dayCount,
  scheduleDays,
  places,
  isEditing,
  isSaving,
  isEditingThis,
  onEdit,
  onOpenPlaceDetails,
  onCancelEdit,
  onSave,
  onRemove
}: {
  reservation: Reservation;
  place: Place | null;
  dayCount: number;
  scheduleDays: ScheduleDay[];
  places: Place[];
  isEditing: boolean;
  isSaving: boolean;
  isEditingThis: boolean;
  onEdit: () => void;
  onOpenPlaceDetails: (place: Place) => void;
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
            scheduleDays={scheduleDays}
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
          <span>{formatReservationDayLabel(reservation.dayIndex, scheduleDays)}</span>
          {reservation.timeLabel ? <span>· {reservation.timeLabel}</span> : null}
        </div>
        {place ? (
          <button
            type="button"
            className="rounded-lg bg-muted/25 p-3 text-left transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => onOpenPlaceDetails(place)}
          >
            <div className="text-xs font-semibold text-muted-foreground">연결 장소</div>
            <div className="mt-1 flex items-center justify-between gap-3 font-semibold">
              <span className="min-w-0 truncate">{place.name}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ) : null}
        {reservation.referenceNumber ? (
          <div>
            <div className="text-xs font-semibold text-muted-foreground">예약번호</div>
            <div className="mt-1 break-all font-semibold">{reservation.referenceNumber}</div>
          </div>
        ) : null}
        {reservation.notes ? <MarkdownText text={reservation.notes} /> : null}
        {reservation.attachments.length ? (
          <ReservationAttachmentGrid attachments={reservation.attachments} />
        ) : null}
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

function GoogleReservationImportDialog({
  places,
  dayCount,
  scheduleDays,
  disabled,
  onClose,
  onImport
}: {
  places: Place[];
  dayCount: number;
  scheduleDays: ScheduleDay[];
  disabled: boolean;
  onClose: () => void;
  onImport: (drafts: ReservationDraft[]) => void;
}) {
  const [rawText, setRawText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const parsedTextDrafts = useMemo(() => parseGoogleReservationText(rawText, places, dayCount), [dayCount, places, rawText]);
  const parsedCsvDrafts = useMemo(() => parseGoogleBookingsCsv(csvText, places, dayCount), [csvText, dayCount, places]);
  const parsedDrafts = useMemo(() => [...parsedCsvDrafts, ...parsedTextDrafts], [parsedCsvDrafts, parsedTextDrafts]);

  async function importCsvFile(file: File | null) {
    if (!file) return;

    const normalizedFileName = file.name.toLowerCase();
    const isCsv =
      normalizedFileName.endsWith('.csv') ||
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel';

    setCsvError('');
    if (!isCsv) {
      setCsvFileName('');
      setCsvText('');
      setCsvError('CSV 파일만 업로드할 수 있습니다.');
      return;
    }

    try {
      const nextCsvText = await file.text();
      const csvRows = parseCsv(nextCsvText);

      setCsvFileName(file.name);
      setCsvText(nextCsvText);
      if (!csvRows.length) {
        setCsvError('CSV에 예약 데이터 행이 없습니다.');
      } else if (!csvRows.some((row) => row['Booking Name'] || row['Merchant Name'])) {
        setCsvError('Google 예약 내보내기 CSV 형식이 아닙니다.');
      }
    } catch {
      setCsvFileName('');
      setCsvText('');
      setCsvError('CSV 파일을 읽지 못했습니다.');
    }
  }

  function handleCsvDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsCsvDragging(true);
  }

  function handleCsvDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsCsvDragging(false);
  }

  function handleCsvDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsCsvDragging(false);
    if (disabled) return;
    void importCsvFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <ModalFrame title="Google 예약 가져오기" maxWidth="max-w-4xl" scroll onClose={onClose}>
      <div className="grid gap-5 p-5">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground">
          Google 예약 내보내기 CSV를 업로드하거나, Google Maps 또는 Reserve with Google 예약 상세 화면과 예약 확인 메일의 내용을
          복사해 붙여넣으면 예약 후보로 변환합니다.
          Google 개인 예약 목록을 직접 읽는 공개 API는 없어, 계정 화면의 내용을 사용자가 가져오는 방식으로 동작합니다.
        </div>

        <Field label="예약내역 CSV 업로드">
          <div className="grid gap-2">
            <label
              className={cn(
                'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5',
                isCsvDragging && 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20',
                disabled && 'cursor-not-allowed opacity-60'
              )}
              onDragEnter={handleCsvDrag}
              onDragOver={handleCsvDrag}
              onDragLeave={handleCsvDragLeave}
              onDrop={handleCsvDrop}
              aria-disabled={disabled}
            >
              <UploadCloud className="h-5 w-5" />
              <span className="font-semibold text-foreground">Google 예약 내보내기 CSV 선택</span>
              <span className="text-xs">Bookings.csv 파일을 클릭하거나 끌어다 놓으면 예약 후보를 자동으로 구성합니다.</span>
              <input
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                disabled={disabled}
                onChange={(event) => {
                  void importCsvFile(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
            </label>
            {csvFileName ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{csvFileName}</span>
                <Badge variant="outline" className="rounded-full">
                  CSV 후보 {parsedCsvDrafts.length}개
                </Badge>
              </div>
            ) : null}
            {csvError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {csvError}
              </div>
            ) : null}
          </div>
        </Field>

        <Field label="예약 내용 직접 붙여넣기">
          <textarea
            className="min-h-56 rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={rawText}
            disabled={disabled}
            placeholder={googleReservationImportSample}
            onChange={(event) => setRawText(event.target.value)}
          />
        </Field>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">가져올 예약 후보</h3>
            <Badge variant="outline" className="rounded-full">
              {parsedDrafts.length}개
            </Badge>
          </div>

          {parsedDrafts.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {parsedDrafts.map((draft, index) => (
                <div key={`${draft.title}-${index}`} className="rounded-lg border bg-background p-3 text-sm">
                  <Badge variant="outline" className={cn('rounded-full', reservationTypeMeta[draft.reservationType].className)}>
                    {reservationTypeMeta[draft.reservationType].label}
                  </Badge>
                  <div className="mt-2 line-clamp-2 text-base font-bold">{draft.title}</div>
                  <div className="mt-2 grid gap-1 text-muted-foreground">
                    <div>{formatReservationDayLabel(draft.dayIndex, scheduleDays)}</div>
                    {draft.timeLabel ? <div>{draft.timeLabel}</div> : null}
                    {draft.referenceNumber ? <div>예약번호: {draft.referenceNumber}</div> : null}
                    {draft.linkUrl ? <div className="truncate">{draft.linkUrl}</div> : null}
                  </div>
                  {draft.notes ? (
                    <div className="mt-2 line-clamp-3 leading-5 text-muted-foreground">
                      <MarkdownInline text={draft.notes} fallback="" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-28 place-items-center rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              CSV 또는 붙여넣은 내용에서 예약 후보를 찾으면 여기에 표시됩니다.
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={disabled}>
            취소
          </Button>
          <Button onClick={() => onImport(parsedDrafts)} disabled={disabled || !parsedDrafts.length}>
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
            {parsedDrafts.length}개 가져오기
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}

function ReservationForm({
  initialDraft = emptyDraft,
  places,
  dayCount,
  scheduleDays,
  disabled,
  submitLabel = '추가',
  onSubmit,
  onCancel
}: {
  initialDraft?: ReservationDraft;
  places: Place[];
  dayCount: number;
  scheduleDays: ScheduleDay[];
  disabled: boolean;
  submitLabel?: string;
  onSubmit: (draft: ReservationDraft) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<ReservationDraft>(() => ({ ...initialDraft }));
  const [attachmentError, setAttachmentError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSubmit(draft);
    if (!onCancel) setDraft({ ...emptyDraft });
  }

  function updateDraft<K extends keyof ReservationDraft>(field: K, value: ReservationDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setAttachmentError('');

    try {
      const attachments = await Promise.all(Array.from(files).map(readReservationAttachment));
      setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, ...attachments].slice(0, 8)
      }));
    } catch (fileError) {
      setAttachmentError(fileError instanceof Error ? fileError.message : '첨부파일을 읽지 못했습니다.');
    }
  }

  function removeAttachment(attachmentId: string) {
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
    }));
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
                {formatReservationDayLabel(dayIndex, scheduleDays)}
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
      <Field label="첨부파일">
        <div className="grid gap-2">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
            <UploadCloud className="h-5 w-5" />
            <span>이미지 또는 PDF 추가</span>
            <span className="text-xs">파일당 최대 5MB</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={disabled}
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          {attachmentError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {attachmentError}
            </div>
          ) : null}
          {draft.attachments.length ? (
            <ReservationAttachmentGrid attachments={draft.attachments} isEditing onRemove={removeAttachment} />
          ) : null}
        </div>
      </Field>
      <Field label="메모">
        <textarea
          className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          value={draft.notes}
          maxLength={1000}
          disabled={disabled}
          placeholder="주의사항, QR 위치, 준비물 등 (Markdown 지원)"
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

function ReservationAttachmentGrid({
  attachments,
  isEditing = false,
  onRemove
}: {
  attachments: ReservationAttachment[];
  isEditing?: boolean;
  onRemove?: (attachmentId: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const isImage = attachment.contentType.startsWith('image/');

        return (
          <div key={attachment.id} className="relative overflow-hidden rounded-lg border bg-muted/20">
            <a
              className="grid gap-2 p-2"
              href={attachment.dataUrl}
              target="_blank"
              rel="noreferrer"
              download={attachment.fileName}
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
              </div>
            </a>
            {isEditing && onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90 text-destructive hover:bg-background hover:text-destructive"
                onClick={() => onRemove(attachment.id)}
                aria-label={`${attachment.fileName} 첨부 삭제`}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
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

function readReservationAttachment(file: File): Promise<ReservationAttachment> {
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

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`;
}

function parseGoogleReservationText(rawText: string, places: Place[], dayCount: number): ReservationDraft[] {
  return rawText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => parseGoogleReservationBlock(block, places, dayCount))
    .filter((draft): draft is ReservationDraft => Boolean(draft));
}

function parseGoogleReservationBlock(block: string, places: Place[], dayCount: number): ReservationDraft | null {
  const lines = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const googleMapsDraft = parseGoogleMapsReservationBlock(block, lines, places, dayCount);
  if (googleMapsDraft) return googleMapsDraft;

  const matchedPlace = findMatchingPlace(block, places);
  const title = matchedPlace?.name ?? findTitleLine(lines);
  if (!title) return null;

  const dayIndex = parseDayIndex(block, dayCount);
  const timeLabel = parseTimeLabel(block);
  const referenceNumber = parseReferenceNumber(block);
  const linkUrl = parseFirstUrl(block);
  const reservationType = inferReservationType(block, matchedPlace);
  const notes = lines
    .filter((line) => !linkUrl || !line.includes(linkUrl))
    .slice(0, 8)
    .join('\n')
    .slice(0, 1000);

  return {
    ...emptyDraft,
    reservationType,
    title,
    dayIndex,
    placeId: matchedPlace?.id ?? null,
    timeLabel,
    referenceNumber,
    linkUrl,
    notes,
    attachments: []
  };
}

function parseGoogleMapsReservationBlock(
  block: string,
  lines: string[],
  places: Place[],
  dayCount: number
): ReservationDraft | null {
  const detailIndex = lines.findIndex((line) => /^(예약\s*내역|reservation details)$/i.test(line));
  if (detailIndex < 0) return null;

  const dateLine = [...lines.slice(0, detailIndex)]
    .reverse()
    .find((line) => /(?:[0-9]{1,2}\s*월\s*)?[0-9]{1,2}\s*일|[0-9]{4}[./-]\s*[0-9]{1,2}[./-]\s*[0-9]{1,2}/.test(line)) ?? '';
  const detailLines = lines.slice(detailIndex + 1);
  const summaryLine = detailLines.find(isGoogleReservationSummaryLine) ?? '';
  const titleLine = detailLines.find((line) => isLikelyGoogleReservationTitle(line, summaryLine)) ?? '';

  if (!titleLine) return null;

  const matchedPlace = findMatchingPlace([titleLine, block].join('\n'), places);
  const addressLine = findGoogleReservationAddressLine(detailLines);
  const categoryLine = findGoogleReservationCategoryLine(detailLines, titleLine, summaryLine, addressLine);
  const partyLabel = summaryLine.match(/(?:^|·)\s*([0-9]+\s*명)\s*(?:$|·)/)?.[1] ?? '';
  const notes = [
    categoryLine ? `유형: ${categoryLine}` : '',
    partyLabel ? `인원: ${partyLabel}` : '',
    addressLine ? `주소: ${addressLine}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);

  return {
    ...emptyDraft,
    reservationType: inferReservationType([titleLine, categoryLine, block].filter(Boolean).join('\n'), matchedPlace),
    title: (matchedPlace?.name ?? titleLine).slice(0, 120),
    dayIndex: parseDayIndex(block, dayCount),
    placeId: matchedPlace?.id ?? null,
    timeLabel: formatGoogleReservationTimeLabel(dateLine, summaryLine),
    referenceNumber: parseReferenceNumber(block),
    linkUrl: parseFirstUrl(block),
    notes,
    attachments: []
  };
}

function isGoogleReservationSummaryLine(line: string) {
  return /(?:오전|오후|AM|PM|[0-2]?[0-9]:[0-5][0-9])/i.test(line) && /(?:·|\s)/.test(line);
}

function isLikelyGoogleReservationTitle(line: string, summaryLine: string) {
  if (!line || line === summaryLine) return false;
  if (/^(예약\s*내역|판매자\s*위치|merchant location|seller location)$/i.test(line)) return false;
  if (/^(?:[0-9]{1,2}\s*월\s*)?[0-9]{1,2}\s*일$/.test(line)) return false;
  if (/^[0-9]{1,2}\s*월$/.test(line)) return false;
  if (/^[0-9](?:\.[0-9])?\s*\([0-9,]+\)/.test(line)) return false;
  if (isGoogleReservationAddressLine(line)) return false;
  return true;
}

function findGoogleReservationAddressLine(lines: string[]) {
  const locationIndex = lines.findIndex((line) => /^(판매자\s*위치|merchant location|seller location)$/i.test(line));
  if (locationIndex > 0 && isGoogleReservationAddressLine(lines[locationIndex - 1])) {
    return lines[locationIndex - 1];
  }

  return lines.find(isGoogleReservationAddressLine) ?? '';
}

function isGoogleReservationAddressLine(line: string) {
  return /(?:일본|Japan|Tokyo|Osaka|Kyoto|〒|[0-9]+-chōme|[0-9]+-chome|City|Ward)/i.test(line);
}

function findGoogleReservationCategoryLine(lines: string[], titleLine: string, summaryLine: string, addressLine: string) {
  return lines.find((line) => {
    if (!line || line === titleLine || line === summaryLine || line === addressLine) return false;
    if (/^(예약\s*내역|판매자\s*위치|merchant location|seller location)$/i.test(line)) return false;
    if (/^[0-9](?:\.[0-9])?\s*\([0-9,]+\)/.test(line)) return false;
    if (isGoogleReservationAddressLine(line)) return false;
    return /(?:전문점|음식점|레스토랑|카페|bar|restaurant|cafe|shop|store|museum|hotel)/i.test(line);
  }) ?? '';
}

function formatGoogleReservationTimeLabel(dateLine: string, summaryLine: string) {
  return [dateLine, summaryLine].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 80);
}

type GoogleBookingCsvRow = Record<string, string>;

function parseGoogleBookingsCsv(csvText: string, places: Place[], dayCount: number): ReservationDraft[] {
  return parseCsv(csvText)
    .map((row) => googleBookingRowToDraft(row, places, dayCount))
    .filter((draft): draft is ReservationDraft => Boolean(draft));
}

function parseCsv(csvText: string): GoogleBookingCsvRow[] {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']))
  );
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function googleBookingRowToDraft(row: GoogleBookingCsvRow, places: Place[], dayCount: number): ReservationDraft | null {
  const bookingName = row['Booking Name'] ?? '';
  const merchantName = row['Merchant Name'] ?? '';
  const startTime = row['Start Time'] ?? '';
  const endTime = row['End Time'] ?? '';
  const price = row.Price ?? '';
  const address = row.Address ?? '';
  const canceled = row.Canceled ?? '';
  const specialRequest = row['Special Request'] ?? '';
  const title = (bookingName || merchantName).trim().slice(0, 120);

  if (!title) return null;

  const searchableText = [bookingName, merchantName, address].filter(Boolean).join('\n');
  const matchedPlace = findMatchingPlace(searchableText, places);
  const notes = [
    merchantName && merchantName !== title ? `상점명: ${merchantName}` : '',
    price ? `가격: ${price}` : '',
    address ? `주소: ${address}` : '',
    canceled ? `취소 여부: ${canceled}` : '',
    specialRequest ? `요청사항: ${specialRequest}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
  const timeLabel = [startTime, endTime].filter(Boolean).join(' ~ ').slice(0, 80);

  return {
    ...emptyDraft,
    reservationType: inferReservationType(searchableText, matchedPlace),
    title,
    dayIndex: parseDayIndex(startTime, dayCount),
    placeId: matchedPlace?.id ?? null,
    timeLabel,
    referenceNumber: '',
    linkUrl: '',
    notes,
    attachments: []
  };
}

function findMatchingPlace(text: string, places: Place[]) {
  const normalizedText = normalizeSearchText(text);
  return places.find((place) => {
    const normalizedName = normalizeSearchText(place.name);
    return normalizedName.length >= 3 && normalizedText.includes(normalizedName);
  }) ?? null;
}

function findTitleLine(lines: string[]) {
  return lines
    .find((line) => !/^https?:\/\//i.test(line) && !/^(예약번호|booking|confirmation|date|time|날짜|시간|주소|address)\s*[:：]/i.test(line))
    ?.slice(0, 120)
    .trim() ?? '';
}

function parseDayIndex(text: string, dayCount: number) {
  const dayMatch = text.match(/\bday\s*([0-9]{1,2})\b/i) ?? text.match(/DAY\s*([0-9]{1,2})/i);
  if (!dayMatch) return null;
  const dayIndex = Number(dayMatch[1]) - 1;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= dayCount) return null;
  return dayIndex;
}

function parseTimeLabel(text: string) {
  const dateTimeMatch = text.match(/([0-9]{4}[./-]\s*[0-9]{1,2}[./-]\s*[0-9]{1,2}[^0-9]{1,8}[0-9]{1,2}:[0-9]{2})/);
  if (dateTimeMatch) return dateTimeMatch[1].replace(/\s+/g, ' ').slice(0, 80);

  const koreanDateTimeMatch = text.match(/([0-9]{1,2}\s*월\s*[0-9]{1,2}\s*일[^0-9]{1,8}[0-9]{1,2}:[0-9]{2})/);
  if (koreanDateTimeMatch) return koreanDateTimeMatch[1].replace(/\s+/g, ' ').slice(0, 80);

  const timeMatch = text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/);
  return timeMatch?.[0] ?? '';
}

function parseReferenceNumber(text: string) {
  const referenceMatch =
    text.match(/(?:예약번호|예약 번호|confirmation|booking|reference|order)\s*[:：#]?\s*([A-Z0-9-]{4,})/i) ??
    text.match(/\b[A-Z]{2,}[0-9][A-Z0-9-]{3,}\b/);
  return referenceMatch?.[1]?.slice(0, 120) ?? referenceMatch?.[0]?.slice(0, 120) ?? '';
}

function parseFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0]?.slice(0, 500) ?? '';
}

function inferReservationType(text: string, place: Place | null): ReservationType {
  const normalizedText = normalizeSearchText(text);
  if (place?.category === 'meal' || place?.category === 'dessert') return 'restaurant';
  if (normalizedText.includes('hotel') || normalizedText.includes('숙소') || normalizedText.includes('checkin')) return 'hotel';
  if (normalizedText.includes('train') || normalizedText.includes('flight') || normalizedText.includes('교통') || normalizedText.includes('항공')) return 'transport';
  if (normalizedText.includes('ticket') || normalizedText.includes('티켓') || normalizedText.includes('입장권')) return 'ticket';
  return 'restaurant';
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function createId(prefix: string) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
