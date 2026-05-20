import type { ReactNode } from 'react';
import { CalendarDays, CheckCircle2, Circle, ExternalLink, FileText, MapPin, Printer, TicketCheck } from 'lucide-react';
import { MarkdownText } from '@/components/common/MarkdownText';
import { ModalFrame } from '@/components/dialogs/ModalFrame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { defaultCategoryOptions } from '@/constants/travel';
import { getPlaceInfoUrl } from '@/lib/place-utils';
import { formatDepartureTime, formatTravelDate, getScheduleHotelPlace } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';
import type { RouteMode, ScheduleDay } from '@/types/schedule';
import type { TodoList } from '@/types/todo';
import type { CategoryOption, PhotoState, Place } from '@/types/travel';

export type TripBookletSnapshot = {
  generatedAt: string;
  categories: CategoryOption[];
  places: Place[];
  scheduleDays: ScheduleDay[];
  reservations: Reservation[];
  todos: TodoList;
};

type TripBookletDialogProps = {
  snapshot: TripBookletSnapshot;
  photoCache: Record<string, PhotoState>;
  onClose: () => void;
};

const routeModeLabel: Record<RouteMode, string> = {
  driving: '자동차',
  transit: '대중교통',
  walking: '도보'
};

const reservationTypeLabel: Record<Reservation['reservationType'], string> = {
  restaurant: '식당 예약',
  ticket: '티켓/입장권',
  transport: '교통',
  hotel: '숙소',
  other: '기타'
};

const emptyTodos: TodoList = {
  before: [],
  days: [],
  after: [],
  custom: []
};

export function TripBookletDialog({ snapshot, photoCache, onClose }: TripBookletDialogProps) {
  async function printBooklet() {
    await waitForBookletImages(document.querySelector('.trip-booklet-print-root'));
    window.print();
  }

  return (
    <>
      <ModalFrame
        title="여행 책자 PDF"
        maxWidth="max-w-6xl"
        scroll
        headerClassName="trip-booklet-controls"
        onClose={onClose}
        eyebrow={<Badge variant="outline">Offline booklet</Badge>}
      >
        <div className="trip-booklet-controls flex flex-col gap-3 border-b bg-secondary/60 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="leading-6">
            PDF 저장 창이 열리면 대상에서 <strong className="text-foreground">PDF로 저장</strong>을 선택하세요.
            표지와 섹션이 A4 페이지 단위로 분리되며, 지도 대신 주소와 Google Maps 링크를 함께 담습니다.
          </div>
          <Button className="rounded-full" onClick={printBooklet}>
            <Printer className="h-4 w-4" />
            PDF로 저장
          </Button>
        </div>

        <div className="trip-booklet-preview-frame max-h-[74vh] overflow-auto bg-muted/30 p-3 sm:p-5">
          <BookletArticle
            snapshot={snapshot}
            photoCache={photoCache}
            className="mx-auto w-[920px] max-w-[920px] shadow-sm"
          />
        </div>
      </ModalFrame>

      <div className="trip-booklet-print-root" aria-hidden="true">
        <BookletArticle snapshot={snapshot} photoCache={photoCache} />
      </div>
    </>
  );
}

async function waitForBookletImages(root: Element | null) {
  if (!root) return;

  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return;

  await Promise.race([
    Promise.all(images.map(waitForImage)),
    new Promise((resolve) => window.setTimeout(resolve, 3500))
  ]);
}

async function waitForImage(image: HTMLImageElement) {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
    });
  }

  if (typeof image.decode === 'function') {
    await image.decode().catch(() => undefined);
  }
}

function BookletArticle({
  snapshot,
  photoCache,
  className
}: {
  snapshot: TripBookletSnapshot;
  photoCache: Record<string, PhotoState>;
  className?: string;
}) {
  const placesById = new Map(snapshot.places.map((place) => [place.id, place]));
  const generatedAt = formatGeneratedAt(snapshot.generatedAt);
  const todos = snapshot.todos ?? emptyTodos;
  const todoCount = countTodos(todos);
  const checkedTodoCount = countDoneTodos(todos);
  const coverPhotos = snapshot.places
    .flatMap((place) => photoCache[place.id]?.photos[0]?.url ?? [])
    .slice(0, 5);
  const reservationGroups = groupReservationsByDay(snapshot.reservations, snapshot.scheduleDays);
  const placeGroups = mergeKnownCategories(snapshot.categories)
    .map((category) => ({
      category,
      places: snapshot.places.filter((place) => place.category === category.id)
    }))
    .filter((group) => group.places.length > 0);
  const todoGroups = createTodoBookletGroups(todos, snapshot.scheduleDays);

  return (
    <article className={cn('trip-booklet-article grid gap-6 bg-[#f4efe8] p-4 text-neutral-950', className)}>
      <BookletCover
        generatedAt={generatedAt}
        coverPhotos={coverPhotos}
        placeCount={snapshot.places.length}
        dayCount={snapshot.scheduleDays.length}
        reservationCount={snapshot.reservations.length}
        todoCount={todoCount}
        checkedTodoCount={checkedTodoCount}
      />

      {snapshot.scheduleDays.length ? (
        snapshot.scheduleDays.map((day, dayIndex) => {
          const hotelPlace = getScheduleHotelPlace(day, placesById);

          return (
            <BookletSection
              key={day.id}
              sectionNumber="01"
              title={`DAY ${dayIndex + 1} 일정`}
              subtitle={[
                day.travelDate ? formatTravelDate(day.travelDate) : '날짜 미지정',
                `출발 ${formatDepartureTime(day.departureTimeMinutes)}`,
                `기준 숙소 ${hotelPlace.name}`
              ].join(' · ')}
              icon={<CalendarDays className="h-5 w-5" />}
            >
              <DayBookletCard
                day={day}
                dayIndex={dayIndex}
                placesById={placesById}
                reservations={snapshot.reservations}
                todos={todos}
              />
            </BookletSection>
          );
        })
      ) : (
        <BookletSection
          sectionNumber="01"
          title="DAY별 일정"
          subtitle="숙소 출발과 도착을 기준으로 방문 순서를 정리했습니다."
          icon={<CalendarDays className="h-5 w-5" />}
        >
          <EmptyBookletState text="등록된 일정이 없습니다." />
        </BookletSection>
      )}

      {reservationGroups.length ? (
        reservationGroups.map((group) => (
          <BookletSection
            key={group.key}
            sectionNumber="02"
            title={`예약/티켓 · ${group.label}`}
            subtitle={`${group.reservations.length}개 항목을 같은 여행 흐름 안에서 확인합니다.`}
            icon={<TicketCheck className="h-5 w-5" />}
          >
            <ReservationGroupBooklet
              reservations={group.reservations}
              placesById={placesById}
              scheduleDays={snapshot.scheduleDays}
            />
          </BookletSection>
        ))
      ) : (
        <BookletSection
          sectionNumber="02"
          title="예약/티켓"
          subtitle="예약번호, 링크, 첨부파일 이름을 함께 확인할 수 있습니다."
          icon={<TicketCheck className="h-5 w-5" />}
        >
          <EmptyBookletState text="등록된 예약/티켓이 없습니다." />
        </BookletSection>
      )}

      {placeGroups.length ? (
        placeGroups.map((group) => (
          <BookletSection
            key={group.category.id}
            sectionNumber="03"
            title={`장소 · ${group.category.emoji} ${group.category.label}`}
            subtitle={`${group.places.length}곳의 대표 항목, 주소, 메모를 정리했습니다.`}
            icon={<MapPin className="h-5 w-5" />}
          >
            <PlaceCategoryBooklet
              category={group.category}
              places={group.places}
              photoCache={photoCache}
            />
          </BookletSection>
        ))
      ) : (
        <BookletSection
          sectionNumber="03"
          title="장소 모음"
          subtitle="카테고리별 장소, 대표 항목, 주소, 메모를 한 번에 볼 수 있습니다."
          icon={<MapPin className="h-5 w-5" />}
        >
          <EmptyBookletState text="등록된 장소가 없습니다." />
        </BookletSection>
      )}

      {todoGroups.length ? (
        todoGroups.map((group) => (
          <BookletSection
            key={group.key}
            sectionNumber="04"
            title={`체크리스트 · ${group.title}`}
            subtitle={`${group.doneCount}/${group.items.length}개 완료 상태로 저장했습니다.`}
            icon={<CheckCircle2 className="h-5 w-5" />}
          >
            <TodoMiniList title={group.title} items={group.items} />
          </BookletSection>
        ))
      ) : (
        <BookletSection
          sectionNumber="04"
          title="체크리스트"
          subtitle="여행 전, DAY별, 여행 후, 커스텀 체크리스트를 모았습니다."
          icon={<CheckCircle2 className="h-5 w-5" />}
        >
          <EmptyBookletState text="등록된 체크리스트가 없습니다." />
        </BookletSection>
      )}
    </article>
  );
}

function BookletCover({
  generatedAt,
  coverPhotos,
  placeCount,
  dayCount,
  reservationCount,
  todoCount,
  checkedTodoCount
}: {
  generatedAt: string;
  coverPhotos: string[];
  placeCount: number;
  dayCount: number;
  reservationCount: number;
  todoCount: number;
  checkedTodoCount: number;
}) {
  const primaryPhoto = coverPhotos[0] ?? null;
  const secondaryPhotos = coverPhotos.slice(1, 5);

  return (
    <section className="booklet-page booklet-cover-page overflow-hidden rounded-2xl border border-neutral-200 bg-[#fffaf5] p-8">
      <div className="grid min-h-[720px] content-between gap-10 rounded-[1.75rem] border border-[#eadfd2] bg-[linear-gradient(135deg,#fff7f2_0%,#ffffff_48%,#eef8f4_100%)] p-7 print:min-h-[250mm] print:rounded-none print:border-0">
        <div className="flex items-center justify-between gap-4">
          <div className="rounded-full border border-rose-200 bg-white/85 px-4 py-2 text-sm font-black text-rose-600 shadow-sm">
            TravelNode Guide
          </div>
          <div className="text-right text-xs leading-5 text-neutral-500">
            저장 기준<br />{generatedAt}
          </div>
        </div>

        <div className="booklet-cover-layout grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] print:grid-cols-[minmax(0,1fr)_82mm]">
          <div className="self-end">
            <div className="text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Japan Trip Planner</div>
            <h1 className="mt-4 max-w-2xl text-6xl font-black leading-[0.95] tracking-normal text-neutral-950 print:text-6xl">
              나의<br />여행 책자
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-neutral-600">
              일정, 장소, 예약, 체크리스트를 오프라인에서도 보기 좋게 묶은 개인 여행 가이드입니다.
              현장에서 바로 확인할 수 있도록 핵심 정보와 링크를 한 장씩 분리했습니다.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="overflow-hidden rounded-[1.5rem] border border-white bg-neutral-100 shadow-[0_18px_45px_rgba(120,70,50,0.16)]">
              {primaryPhoto ? (
                <img
                  className="h-72 w-full object-cover print:h-[96mm]"
                  src={primaryPhoto}
                  alt="여행 대표 사진"
                  loading="eager"
                />
              ) : (
                <div className="grid h-72 place-items-center bg-[#f3ebe3] text-sm font-bold text-neutral-500 print:h-[96mm]">
                  Travel Preview
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => {
                const photo = secondaryPhotos[index];
                return photo ? (
                  <img
                    key={photo}
                    className="h-20 w-full rounded-xl border border-white object-cover print:h-[22mm]"
                    src={photo}
                    alt={`여행 사진 ${index + 2}`}
                    loading="eager"
                  />
                ) : (
                  <div key={index} className="h-20 rounded-xl bg-[#f3ebe3] print:h-[22mm]" />
                );
              })}
            </div>
          </div>
        </div>

        <div className="booklet-cover-metrics grid gap-3 sm:grid-cols-4">
          <CoverMetric label="일정" value={`${dayCount} DAY`} />
          <CoverMetric label="장소" value={`${placeCount}곳`} />
          <CoverMetric label="예약" value={`${reservationCount}개`} />
          <CoverMetric label="할 일" value={`${checkedTodoCount}/${todoCount}`} />
        </div>
      </div>
    </section>
  );
}

function CoverMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfd2] bg-white/85 p-4 shadow-sm">
      <div className="text-xs font-bold text-neutral-500">{label}</div>
      <div className="mt-1.5 text-xl font-black text-neutral-950">{value}</div>
    </div>
  );
}

function BookletSection({
  sectionNumber,
  title,
  subtitle,
  icon,
  children
}: {
  sectionNumber: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="booklet-page booklet-section-page rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black tracking-[0.18em] text-white">
          SECTION {sectionNumber}
        </div>
        <div className="text-right text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
          TravelNode Booklet
        </div>
      </div>

      <div className="booklet-section-heading mb-7 grid gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-start">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-normal text-neutral-950">{title}</h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-500">{subtitle}</p>
        </div>
        <div className="booklet-section-number hidden text-6xl font-black leading-none text-neutral-100 sm:block">{sectionNumber}</div>
      </div>

      {children}

      <div className="booklet-page-footer mt-8 flex items-center justify-between border-t border-neutral-200 pt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
        <span>{title}</span>
        <span>Japan Trip Guide</span>
      </div>
    </section>
  );
}

function DayBookletCard({
  day,
  dayIndex,
  placesById,
  reservations,
  todos
}: {
  day: ScheduleDay;
  dayIndex: number;
  placesById: Map<string, Place>;
  reservations: Reservation[];
  todos: TodoList;
}) {
  const hotelPlace = getScheduleHotelPlace(day, placesById);
  const stops = day.stops
    .map((stop) => ({ stop, place: placesById.get(stop.placeId) ?? null }))
    .filter((item) => item.place != null);
  const dayReservations = reservations.filter((reservation) => reservation.dayIndex === dayIndex);
  const dayTodos = todos.days.find((todoDay) => todoDay.dayIndex === dayIndex)?.items ?? [];

  return (
    <article className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-[#fffaf6] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#2b211f] px-5 py-4 text-white">
        <div>
          <h3 className="text-xl font-black">DAY {dayIndex + 1}</h3>
          <p className="mt-1 text-sm text-white/70">{day.travelDate ? formatTravelDate(day.travelDate) : '날짜 미지정'}</p>
        </div>
        <div className="text-right text-xs leading-5 text-white/70">
          출발 {formatDepartureTime(day.departureTimeMinutes)}<br />
          기준 숙소 {hotelPlace.name}
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <RouteLine label="출발" place={hotelPlace} mode={null} />
          {stops.map(({ stop, place }, index) => (
            <RouteLine
              key={stop.id}
              label={`${index + 1}`}
              place={place!}
              mode={index === 0 ? stop.selectedRouteMode ?? null : stop.selectedRouteMode ?? null}
              departureTimeMinutes={stop.departureTimeMinutes}
              locked={stop.lockedFromPrevious}
            />
          ))}
          <RouteLine label="도착" place={hotelPlace} mode={day.selectedReturnRouteMode ?? null} locked={day.lockedReturnRoute} />
        </div>

        <div className="booklet-two-column-grid grid gap-3 md:grid-cols-2 print:grid-cols-2">
          <MiniList
            title="이 DAY 예약"
            emptyText="예약 없음"
            items={dayReservations.map((reservation) => ({
              id: reservation.id,
              primary: reservation.title,
              secondary: [reservation.timeLabel, reservation.bookingPlatform, reservation.referenceNumber].filter(Boolean).join(' · ')
            }))}
          />
          <TodoMiniList title="이 DAY 할 일" items={dayTodos} />
        </div>
      </div>
    </article>
  );
}

function RouteLine({
  label,
  place,
  mode,
  departureTimeMinutes,
  locked
}: {
  label: string;
  place: Place;
  mode: RouteMode | null;
  departureTimeMinutes?: number | null;
  locked?: boolean;
}) {
  return (
    <div className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-full bg-white text-[10px] font-black text-neutral-700 ring-1 ring-neutral-200">
        {label}
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-[0_6px_16px_rgba(80,60,45,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold leading-snug text-neutral-950">{place.name}</div>
          {mode || locked ? (
            <div className="text-[10px] font-semibold text-neutral-400">
              {mode ? routeModeLabel[mode] : '이동수단 미지정'}
              {locked ? ' · 고정' : ''}
            </div>
          ) : null}
        </div>
        <div className="mt-1 text-[10px] leading-4 text-neutral-400">
          {departureTimeMinutes != null ? `출발 기준 ${formatDepartureTime(departureTimeMinutes)} · ` : ''}
          {place.address}
        </div>
        {place.description ? <BookletMarkdownField label="설명" text={place.description} className="mt-1.5" /> : null}
      </div>
    </div>
  );
}

function ReservationBookletCard({
  reservation,
  place,
  scheduleDays
}: {
  reservation: Reservation;
  place: Place | null;
  scheduleDays: ScheduleDay[];
}) {
  const link = normalizeLink(reservation.linkUrl);
  const imageAttachments = reservation.attachments.filter((attachment) => attachment.contentType.startsWith('image/'));
  const otherAttachments = reservation.attachments.filter((attachment) => !attachment.contentType.startsWith('image/'));

  return (
    <article className="booklet-avoid-break rounded-2xl border border-[#eadfd2] bg-[#fffaf6] p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600">{reservationTypeLabel[reservation.reservationType]}</div>
          <h3 className="mt-1 text-base font-black leading-snug text-neutral-950">{reservation.title}</h3>
        </div>
        <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-neutral-500 ring-1 ring-neutral-200">
          {formatDayLabel(reservation.dayIndex, scheduleDays)}
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-xs leading-5 text-neutral-500">
        {reservation.timeLabel ? <div><span className="font-bold text-neutral-600">시간</span> {reservation.timeLabel}</div> : null}
        {reservation.bookingPlatform ? <div><span className="font-bold text-neutral-600">플랫폼</span> {reservation.bookingPlatform}</div> : null}
        {place ? <div><span className="font-bold text-neutral-600">장소</span> {place.name}</div> : null}
        {reservation.referenceNumber ? <div><span className="font-bold text-neutral-600">예약번호</span> {reservation.referenceNumber}</div> : null}
        {link ? (
          <a className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 underline underline-offset-4" href={link} target="_blank" rel="noreferrer">
            링크 열기 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      {reservation.notes ? <MarkdownText className="booklet-muted-markdown mt-2 text-[11px] leading-4 text-neutral-500" text={reservation.notes} fallback="" /> : null}
      {place?.description ? <BookletMarkdownField label="장소 설명" text={place.description} className="mt-2" /> : null}
      {imageAttachments.length ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {imageAttachments.slice(0, 3).map((attachment) => (
            <img
              key={attachment.id}
              className="h-20 w-full rounded-lg border border-white object-cover shadow-sm"
              src={attachment.dataUrl}
              alt={attachment.fileName}
              loading="eager"
            />
          ))}
        </div>
      ) : null}
      {otherAttachments.length ? (
        <div className="mt-2 grid gap-1 text-[10px] leading-4 text-neutral-400">
          {otherAttachments.map((attachment) => (
            <div key={attachment.id} className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {attachment.fileName}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ReservationGroupBooklet({
  reservations,
  placesById,
  scheduleDays
}: {
  reservations: Reservation[];
  placesById: Map<string, Place>;
  scheduleDays: ScheduleDay[];
}) {
  return (
    <div className="grid gap-3">
      {reservations.map((reservation) => (
        <ReservationBookletCard
          key={reservation.id}
          reservation={reservation}
          place={reservation.placeId ? placesById.get(reservation.placeId) ?? null : null}
          scheduleDays={scheduleDays}
        />
      ))}
    </div>
  );
}

function PlaceCategoryBooklet({
  category,
  places,
  photoCache
}: {
  category: CategoryOption;
  places: Place[];
  photoCache: Record<string, PhotoState>;
}) {
  return (
    <div className="booklet-category-section grid gap-3">
      <h3 className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-[#fffaf6] px-3.5 py-2.5 text-base font-black text-neutral-950">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm ring-1 ring-neutral-200">{category.emoji}</span>
        <span>{category.label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500 ring-1 ring-neutral-200">{places.length}</span>
      </h3>
      <div className="booklet-two-column-grid grid gap-3 md:grid-cols-2 print:grid-cols-2">
        {places.map((place) => (
          <PlaceBookletCard
            key={place.id}
            place={place}
            category={category}
            photoUrl={photoCache[place.id]?.photos[0]?.url ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function PlaceBookletCard({
  place,
  category,
  photoUrl
}: {
  place: Place;
  category: CategoryOption;
  photoUrl: string | null;
}) {
  return (
    <article className="booklet-avoid-break grid grid-cols-[68px_minmax(0,1fr)] gap-2.5 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-[0_6px_16px_rgba(80,60,45,0.04)]">
      {photoUrl ? (
        <img className="h-[68px] w-[68px] rounded-xl object-cover" src={photoUrl} alt={place.name} loading="eager" />
      ) : (
        <div className="grid h-[68px] w-[68px] place-items-center rounded-xl bg-neutral-100 text-lg">{category.emoji}</div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-neutral-400">{category.emoji} {category.label}</div>
        <h4 className="mt-0.5 text-sm font-black leading-snug text-neutral-950">{place.name}</h4>
        <div className="mt-0.5 text-[11px] font-bold leading-4 text-neutral-700">{place.menu}</div>
        {place.description ? <BookletMarkdownField label="설명" text={place.description} className="mt-1" /> : null}
        <div className="mt-1.5 text-[10px] leading-4 text-neutral-400">
          {place.distanceLabel} · {place.travelMode === 'walk' ? '도보' : '대중교통'} {place.travelMinutes}분
        </div>
        <div className="mt-0.5 text-[10px] leading-4 text-neutral-400">{place.address}</div>
        {place.googleMapsNote ? <MarkdownText className="booklet-muted-markdown mt-1 text-[10px] leading-4 text-neutral-500" text={place.googleMapsNote} fallback="" /> : null}
        <a className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 underline underline-offset-4" href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
          Google Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

function BookletMarkdownField({ label, text, className }: { label: string; text: string; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-neutral-50 px-2.5 py-2', className)}>
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">{label}</div>
      <MarkdownText className="booklet-muted-markdown mt-1 text-[10px] leading-4 text-neutral-500" text={text} fallback="" />
    </div>
  );
}

function TodoMiniList({ title, items }: { title: string; items: { id: string; text: string; done: boolean }[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_6px_16px_rgba(80,60,45,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black text-neutral-950">{title}</h4>
        <span className="rounded-full bg-[#fff3f0] px-2 py-0.5 text-[10px] font-bold text-rose-600">
          {items.filter((item) => item.done).length}/{items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-2.5 grid gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs leading-5 text-neutral-700">
              {item.done ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />}
              <span className={cn(item.done && 'text-neutral-400 line-through')}>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2.5 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-400">항목 없음</div>
      )}
    </div>
  );
}

function MiniList({
  title,
  items,
  emptyText
}: {
  title: string;
  items: { id: string; primary: string; secondary: string }[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_6px_16px_rgba(80,60,45,0.04)]">
      <h4 className="text-sm font-black text-neutral-950">{title}</h4>
      {items.length ? (
        <ul className="mt-2.5 grid gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="text-xs leading-5">
              <div className="font-bold text-neutral-800">{item.primary}</div>
              {item.secondary ? <div className="text-[10px] text-neutral-400">{item.secondary}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2.5 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-400">{emptyText}</div>
      )}
    </div>
  );
}

function EmptyBookletState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}

function groupReservationsByDay(reservations: Reservation[], scheduleDays: ScheduleDay[]) {
  const groups = new Map<string, { key: string; label: string; reservations: Reservation[] }>();
  const orderedReservations = [...reservations].sort((a, b) => {
    const dayCompare = reservationDayOrder(a) - reservationDayOrder(b);
    if (dayCompare !== 0) return dayCompare;
    return [a.timeLabel, a.title].join(' ').localeCompare([b.timeLabel, b.title].join(' '));
  });

  orderedReservations.forEach((reservation) => {
    const key = reservation.dayIndex == null ? 'unscheduled' : `day-${reservation.dayIndex}`;
    const label = formatDayLabel(reservation.dayIndex, scheduleDays);
    const group = groups.get(key) ?? { key, label, reservations: [] };
    group.reservations.push(reservation);
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function reservationDayOrder(reservation: Reservation) {
  return reservation.dayIndex == null ? Number.MAX_SAFE_INTEGER : reservation.dayIndex;
}

function createTodoBookletGroups(todos: TodoList, scheduleDays: ScheduleDay[]) {
  const groups: { key: string; title: string; items: TodoList['before']; doneCount: number }[] = [
    createTodoBookletGroup('before', '여행 전 체크리스트', todos.before),
    ...todos.days.map((day) => createTodoBookletGroup(`day-${day.dayIndex}`, formatDayLabel(day.dayIndex, scheduleDays), day.items)),
    ...todos.custom.map((checklist) => createTodoBookletGroup(`custom-${checklist.id}`, checklist.title, checklist.items)),
    createTodoBookletGroup('after', '여행 후 체크리스트', todos.after)
  ];

  return groups.filter((group) => group.items.length > 0);
}

function createTodoBookletGroup(key: string, title: string, items: TodoList['before']) {
  return {
    key,
    title,
    items,
    doneCount: items.filter((item) => item.done).length
  };
}

function formatDayLabel(dayIndex: number | null, scheduleDays: ScheduleDay[]) {
  if (dayIndex == null) return 'DAY 미지정';

  const base = `DAY ${dayIndex + 1}`;
  const travelDate = scheduleDays[dayIndex]?.travelDate;
  return travelDate ? `${base} · ${formatTravelDate(travelDate)}` : base;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function countTodos(todos: TodoList) {
  return [
    ...todos.before,
    ...todos.after,
    ...todos.days.flatMap((day) => day.items),
    ...todos.custom.flatMap((checklist) => checklist.items)
  ].length;
}

function countDoneTodos(todos: TodoList) {
  return [
    ...todos.before,
    ...todos.after,
    ...todos.days.flatMap((day) => day.items),
    ...todos.custom.flatMap((checklist) => checklist.items)
  ].filter((item) => item.done).length;
}

function mergeKnownCategories(categories: CategoryOption[]) {
  const byId = new Map([...defaultCategoryOptions, ...categories].map((category) => [category.id, category]));
  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
