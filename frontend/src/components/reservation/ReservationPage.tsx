import { FormEvent, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import {
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  FileText,
  Hotel,
  Image,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Sparkles,
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
import { mergeReservationAttachments, readReservationAttachment } from '@/lib/reservation-attachments';
import { defaultReservationPlatforms, parseGoogleBookingsCsv, parseGoogleBookingsCsvRows, parseGoogleReservationText } from '@/lib/reservation-import';
import { sortReservationsBySchedule } from '@/lib/reservation-sort';
import { downloadReservationAttachment, formatBytes, formatReservationDayLabel, normalizeLink } from '@/lib/reservation-utils';
import { getVisibleGoogleMapsNote, getVisiblePlaceDescription } from '@/lib/place-utils';
import { cn } from '@/lib/utils';
import type { Reservation, ReservationAttachment, ReservationDraft, ReservationType } from '@/types/reservation';
import type { ScheduleDay } from '@/types/schedule';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';

type ReservationPageProps = {
  categories: CategoryOption[];
  places: Place[];
  canComplete: boolean;
  isEditing: boolean;
  photoCache: Record<string, PhotoState>;
  onLoadPhotos: (place: Place, force?: boolean) => Promise<void>;
  onRequireAuth: () => void;
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
  bookingPlatform: '',
  referenceNumber: '',
  linkUrl: '',
  notes: '',
  attachments: [],
  completed: false
};

const reservationPlatformDatalistId = 'reservation-platform-options';
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

export function ReservationPage({
  categories,
  places,
  canComplete,
  isEditing,
  photoCache,
  onLoadPhotos,
  onRequireAuth
}: ReservationPageProps) {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGoogleImportOpen, setIsGoogleImportOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Place | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Place | null>(null);
  const [celebrationTitle, setCelebrationTitle] = useState('');
  const { reservations, status, error, isSaving, addReservation, addReservations, updateReservation, setReservationCompleted, removeReservation } =
    useReservations(isEditing || canComplete);
  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const currentDetailTarget = detailTarget ? placesById.get(detailTarget.id) ?? detailTarget : null;
  const currentPhotoTarget = photoTarget ? placesById.get(photoTarget.id) ?? photoTarget : null;
  const sortedReservations = useMemo(
    () => sortReservationsBySchedule(reservations),
    [reservations]
  );
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

  function completeReservation(reservation: Reservation, completed: boolean) {
    if (!canComplete) {
      onRequireAuth();
      return;
    }

    setReservationCompleted(reservation.id, completed);
    if (completed) {
      setCelebrationTitle(reservation.title);
    }
  }

  function openPhotos(place: Place) {
    setPhotoTarget(place);
    void onLoadPhotos(place);
  }

  return (
    <PageContainer className="grid gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-5">
      <datalist id={reservationPlatformDatalistId}>
        {defaultReservationPlatforms.map((platform) => (
          <option key={platform} value={platform} />
        ))}
      </datalist>
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline">Reservations</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">예약/티켓</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            식당 예약, 입장권, 교통권, 숙소 바우처를 DAY와 장소에 연결해 보관합니다.
          </p>
          {status === 'loading' || isSaving ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {status === 'loading' ? '예약/티켓을 불러오는 중입니다.' : '예약/티켓을 저장하는 중입니다.'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {isEditing ? (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => setIsGoogleImportOpen(true)}>
                <DownloadCloud className="h-4 w-4" />
                Google 예약 가져오기
              </Button>
              <Button className="rounded-full" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                예약 추가
              </Button>
            </>
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

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">예약/티켓 목록</h2>
          <Badge variant="outline" className="rounded-full">
            {reservations.length}개
          </Badge>
        </div>

        {sortedReservations.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedReservations.map((reservation) => {
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
                  onSetCompleted={(completed) => completeReservation(reservation, completed)}
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

      {isAddDialogOpen ? (
        <ModalFrame title="예약/티켓 추가" maxWidth="max-w-3xl" scroll onClose={() => setIsAddDialogOpen(false)}>
          <div className="p-3 sm:p-5">
            <ReservationForm
              places={places}
              dayCount={dayCount}
              scheduleDays={scheduleDays}
              disabled={isSaving}
              onSubmit={(draft) => {
                addReservation(draft);
                setIsAddDialogOpen(false);
              }}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </div>
        </ModalFrame>
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
      {celebrationTitle ? (
        <ReservationCelebration title={celebrationTitle} onDone={() => setCelebrationTitle('')} />
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
  onSetCompleted,
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
  onSetCompleted: (completed: boolean) => void;
  onRemove: () => void;
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const visiblePlaceDescription = place ? getVisiblePlaceDescription(place) : '';
  const visiblePlaceNote = place ? getVisibleGoogleMapsNote(place) : '';

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
  const hasDetails = Boolean(reservation.notes || reservation.attachments.length);

  return (
    <article
      className={cn(
        'soft-panel overflow-hidden rounded-xl transition',
        reservation.completed && 'border-border/80 bg-muted/25 opacity-80'
      )}
    >
      <div className="border-b bg-secondary/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn('rounded-full', meta.className)}>
                <Icon className="mr-1 h-3.5 w-3.5" />
                {meta.label}
              </Badge>
              {reservation.completed ? (
                <Badge variant="outline" className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  완료
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{reservation.title}</h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 rounded-full border-border/80 bg-background/70 px-2 text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
                reservation.completed && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
              )}
              onClick={() => onSetCompleted(!reservation.completed)}
              disabled={isSaving}
              aria-label={`${reservation.title} ${reservation.completed ? '계획 완료 취소' : '계획 완료 처리'}`}
            >
              {reservation.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {reservation.completed ? '취소' : '계획 완료'}
            </Button>
            {isEditing ? (
              <>
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
              </>
            ) : null}
          </div>
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
            {visiblePlaceDescription ? (
              <div className="mt-1 line-clamp-2 text-sm leading-5 text-foreground/75">
                설명: <MarkdownInline text={visiblePlaceDescription} />
              </div>
            ) : null}
            {visiblePlaceNote ? (
              <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                메모: <MarkdownInline text={visiblePlaceNote} />
              </div>
            ) : null}
          </button>
        ) : null}
        {reservation.referenceNumber ? (
          <div>
            <div className="text-xs font-semibold text-muted-foreground">예약번호</div>
            <div className="mt-1 break-all font-semibold">{reservation.referenceNumber}</div>
          </div>
        ) : null}
        {reservation.bookingPlatform ? (
          <div>
            <div className="text-xs font-semibold text-muted-foreground">예약 플랫폼</div>
            <div className="mt-1 font-semibold">{reservation.bookingPlatform}</div>
          </div>
        ) : null}
        {normalizedLink ? (
          <Button asChild variant="outline" className="rounded-full">
            <a href={normalizedLink} target="_blank" rel="noreferrer">
              링크 열기
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
        {hasDetails ? (
          <div className="grid gap-2 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 justify-between rounded-lg px-3 text-sm font-semibold"
              aria-expanded={isDetailsOpen}
              onClick={() => setIsDetailsOpen((current) => !current)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0">상세정보</span>
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {[
                    reservation.notes ? '메모' : '',
                    reservation.attachments.length ? `파일 ${reservation.attachments.length}개` : ''
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isDetailsOpen && 'rotate-180')} />
            </Button>

            {isDetailsOpen ? (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                {reservation.notes ? (
                  <section className="grid gap-1">
                    <div className="text-xs font-semibold text-muted-foreground">메모</div>
                    <MarkdownText text={reservation.notes} />
                  </section>
                ) : null}
                {reservation.attachments.length ? (
                  <section className="grid gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">첨부파일</div>
                    <ReservationAttachmentGrid attachments={reservation.attachments} />
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ReservationCelebration({ title, onDone }: { title: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1800);
    const dismissOnInteraction = () => onDone();
    const interactionTimer = window.setTimeout(() => {
      window.addEventListener('pointerdown', dismissOnInteraction, { capture: true, passive: true });
      window.addEventListener('keydown', dismissOnInteraction, true);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(interactionTimer);
      window.removeEventListener('pointerdown', dismissOnInteraction, true);
      window.removeEventListener('keydown', dismissOnInteraction, true);
    };
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-foreground/10">
      <div className="reservation-celebration-burst absolute h-52 w-52 rounded-full bg-emerald-400/15 blur-2xl" />
      {Array.from({ length: 28 }, (_, index) => (
        <span
          key={index}
          className="reservation-confetti absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-full bg-emerald-500"
          style={{
            '--confetti-rotate': `${index * 13}deg`,
            '--confetti-distance': `${110 + (index % 7) * 18}px`,
            '--confetti-delay': `${(index % 6) * 28}ms`,
            backgroundColor: ['#94a3b8', '#34d399', '#fbbf24', '#93c5fd', '#c4b5fd'][index % 5]
          } as CSSProperties}
        />
      ))}
      <div className="reservation-celebration-card relative mx-4 grid max-w-sm justify-items-center rounded-2xl border bg-background/95 px-7 py-6 text-center shadow-2xl">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 shadow-lg shadow-emerald-500/10 dark:text-emerald-300">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="mt-4 text-2xl font-black tracking-tight">계획 완료!</div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold text-muted-foreground">{title}</p>
      </div>
    </div>
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
      const csvRows = parseGoogleBookingsCsvRows(nextCsvText);

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
                    {draft.bookingPlatform ? <div>플랫폼: {draft.bookingPlatform}</div> : null}
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
      const merged = mergeReservationAttachments(draft.attachments, attachments);
      setDraft((current) => ({ ...current, attachments: merged.attachments }));
      if (merged.message) setAttachmentError(merged.message);
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
        <Field label="예약 플랫폼">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            value={draft.bookingPlatform}
            maxLength={120}
            disabled={disabled}
            list={reservationPlatformDatalistId}
            placeholder="예: 구글예약, 트립닷컴"
            onChange={(event) => updateDraft('bookingPlatform', event.target.value)}
          />
        </Field>
        <Field label="연결 장소">
          <ReservationPlaceSearch
            places={places}
            value={draft.placeId}
            disabled={disabled}
            onChange={(placeId) => updateDraft('placeId', placeId)}
          />
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

function ReservationPlaceSearch({
  places,
  value,
  disabled,
  onChange
}: {
  places: Place[];
  value: string | null;
  disabled: boolean;
  onChange: (placeId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedPlace = value ? places.find((place) => place.id === value) ?? null : null;
  const candidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const source = normalizedQuery
      ? places.filter((place) =>
          [place.name, place.menu, place.address, place.description, place.googleMapsNote]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : places;

    return source
      .filter((place) => place.id !== value)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [places, query, value]);

  return (
    <div className="grid gap-2">
      {selectedPlace ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{selectedPlace.name}</div>
            <div className="truncate text-xs text-muted-foreground">{selectedPlace.menu}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            해제
          </Button>
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          value={query}
          disabled={disabled}
          placeholder={selectedPlace ? '다른 장소 검색' : '장소명으로 검색'}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {candidates.length ? (
        <div className="grid max-h-52 gap-1 overflow-y-auto rounded-md border bg-background p-1">
          {candidates.map((place) => (
            <button
              key={place.id}
              type="button"
              className="rounded px-2.5 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={disabled}
              onClick={() => {
                onChange(place.id);
                setQuery('');
              }}
            >
              <span className="block truncate text-sm font-semibold">{place.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{place.menu || place.address}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">검색 결과가 없습니다.</div>
      )}
    </div>
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
            <button
              type="button"
              className="grid w-full gap-2 p-2 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <div className="grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
