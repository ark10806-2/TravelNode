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
            지도 대신 주소와 Google Maps 링크를 함께 담아 오프라인에서도 읽기 좋게 구성했습니다.
          </div>
          <Button className="rounded-full" onClick={printBooklet}>
            <Printer className="h-4 w-4" />
            PDF로 저장
          </Button>
        </div>

        <div className="trip-booklet-preview-frame max-h-[74vh] overflow-y-auto bg-muted/30 p-3 sm:p-5">
          <BookletArticle
            snapshot={snapshot}
            photoCache={photoCache}
            className="mx-auto max-w-[920px] shadow-sm"
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

  return (
    <article className={cn('grid gap-4 bg-white text-neutral-950', className)}>
      <BookletCover
        generatedAt={generatedAt}
        placeCount={snapshot.places.length}
        dayCount={snapshot.scheduleDays.length}
        reservationCount={snapshot.reservations.length}
        todoCount={todoCount}
        checkedTodoCount={checkedTodoCount}
      />

      <BookletSection
        title="DAY별 일정"
        subtitle="숙소 출발과 도착을 기준으로 방문 순서를 정리했습니다."
        icon={<CalendarDays className="h-5 w-5" />}
      >
        <div className="grid gap-4">
          {snapshot.scheduleDays.length ? (
            snapshot.scheduleDays.map((day, dayIndex) => (
              <DayBookletCard
                key={day.id}
                day={day}
                dayIndex={dayIndex}
                placesById={placesById}
                reservations={snapshot.reservations}
                todos={todos}
              />
            ))
          ) : (
            <EmptyBookletState text="등록된 일정이 없습니다." />
          )}
        </div>
      </BookletSection>

      <BookletSection
        title="예약/티켓"
        subtitle="예약번호, 링크, 첨부파일 이름을 함께 확인할 수 있습니다."
        icon={<TicketCheck className="h-5 w-5" />}
      >
        <div className="grid gap-3">
          {snapshot.reservations.length ? (
            snapshot.reservations.map((reservation) => (
              <ReservationBookletCard
                key={reservation.id}
                reservation={reservation}
                place={reservation.placeId ? placesById.get(reservation.placeId) ?? null : null}
                scheduleDays={snapshot.scheduleDays}
              />
            ))
          ) : (
            <EmptyBookletState text="등록된 예약/티켓이 없습니다." />
          )}
        </div>
      </BookletSection>

      <BookletSection
        title="장소 모음"
        subtitle="카테고리별 장소, 대표 항목, 주소, 메모를 한 번에 볼 수 있습니다."
        icon={<MapPin className="h-5 w-5" />}
      >
        <PlaceDirectory
          categories={snapshot.categories}
          places={snapshot.places}
          photoCache={photoCache}
        />
      </BookletSection>

      <BookletSection
        title="체크리스트"
        subtitle="여행 전, DAY별, 여행 후, 커스텀 체크리스트를 모았습니다."
        icon={<CheckCircle2 className="h-5 w-5" />}
      >
        <TodoBooklet todos={todos} scheduleDays={snapshot.scheduleDays} />
      </BookletSection>
    </article>
  );
}

function BookletCover({
  generatedAt,
  placeCount,
  dayCount,
  reservationCount,
  todoCount,
  checkedTodoCount
}: {
  generatedAt: string;
  placeCount: number;
  dayCount: number;
  reservationCount: number;
  todoCount: number;
  checkedTodoCount: number;
}) {
  return (
    <section className="booklet-page grid gap-6 rounded-xl border bg-white p-8 print:rounded-none print:border-0 print:p-0">
      <div className="grid min-h-[620px] content-between rounded-2xl border border-neutral-200 bg-[linear-gradient(135deg,#fff7f7_0%,#ffffff_46%,#f3fbf8_100%)] p-8 print:min-h-[240mm] print:rounded-none print:border-0">
        <div className="flex items-center justify-between gap-4">
          <div className="rounded-full border border-rose-200 bg-white/80 px-4 py-2 text-sm font-bold text-rose-600">
            TravelNode Offline Booklet
          </div>
          <div className="text-right text-xs leading-5 text-neutral-500">
            저장 기준<br />{generatedAt}
          </div>
        </div>

        <div>
          <div className="text-sm font-bold uppercase tracking-[0.22em] text-neutral-500">Japan Trip Planner</div>
          <h1 className="mt-4 max-w-2xl text-5xl font-black leading-tight tracking-normal text-neutral-950 print:text-5xl">
            나의 여행 책자
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600">
            일정, 장소, 예약, 체크리스트를 오프라인에서도 확인할 수 있도록 한 권의 PDF로 정리했습니다.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
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
    <div className="rounded-xl border border-neutral-200 bg-white/80 p-4">
      <div className="text-xs font-bold text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-neutral-950">{value}</div>
    </div>
  );
}

function BookletSection({
  title,
  subtitle,
  icon,
  children
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="booklet-page rounded-xl border bg-white p-6 print:rounded-none print:border-0 print:p-0">
      <div className="mb-5 flex items-start gap-3 border-b border-neutral-200 pb-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 print:bg-neutral-100 print:text-neutral-900">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-normal text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{subtitle}</p>
        </div>
      </div>
      {children}
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
    <article className="booklet-avoid-break overflow-hidden rounded-xl border border-neutral-200">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950 px-4 py-3 text-white">
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

        <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          <MiniList
            title="이 DAY 예약"
            emptyText="예약 없음"
            items={dayReservations.map((reservation) => ({
              id: reservation.id,
              primary: reservation.title,
              secondary: [reservation.timeLabel, reservation.referenceNumber].filter(Boolean).join(' · ')
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
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-xs font-black text-neutral-700">
        {label}
      </div>
      <div className="rounded-lg border border-neutral-200 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-neutral-950">{place.name}</div>
          {mode || locked ? (
            <div className="text-xs text-neutral-500">
              {mode ? routeModeLabel[mode] : '이동수단 미지정'}
              {locked ? ' · 고정' : ''}
            </div>
          ) : null}
        </div>
        <div className="mt-1 text-xs leading-5 text-neutral-500">
          {departureTimeMinutes != null ? `출발 기준 ${formatDepartureTime(departureTimeMinutes)} · ` : ''}
          {place.address}
        </div>
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
    <article className="booklet-avoid-break rounded-xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-rose-600">{reservationTypeLabel[reservation.reservationType]}</div>
          <h3 className="mt-1 text-lg font-black text-neutral-950">{reservation.title}</h3>
        </div>
        <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
          {formatDayLabel(reservation.dayIndex, scheduleDays)}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-neutral-600">
        {reservation.timeLabel ? <div>시간: {reservation.timeLabel}</div> : null}
        {place ? <div>연결 장소: {place.name}</div> : null}
        {reservation.referenceNumber ? <div>예약번호: {reservation.referenceNumber}</div> : null}
        {link ? (
          <a className="inline-flex items-center gap-1 text-rose-600 underline underline-offset-4" href={link} target="_blank" rel="noreferrer">
            링크 열기 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      {reservation.notes ? <MarkdownText className="mt-3 text-sm" text={reservation.notes} fallback="" /> : null}
      {imageAttachments.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {imageAttachments.slice(0, 3).map((attachment) => (
            <img
              key={attachment.id}
              className="h-24 w-full rounded-md border object-cover"
              src={attachment.dataUrl}
              alt={attachment.fileName}
              loading="eager"
            />
          ))}
        </div>
      ) : null}
      {otherAttachments.length ? (
        <div className="mt-3 grid gap-1 text-xs text-neutral-500">
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

function PlaceDirectory({
  categories,
  places,
  photoCache
}: {
  categories: CategoryOption[];
  places: Place[];
  photoCache: Record<string, PhotoState>;
}) {
  const orderedCategories = mergeKnownCategories(categories);

  return (
    <div className="grid gap-5">
      {orderedCategories.map((category) => {
        const categoryPlaces = places.filter((place) => place.category === category.id);
        if (!categoryPlaces.length) return null;

        return (
          <section key={category.id} className="booklet-avoid-break grid gap-3">
            <h3 className="flex items-center gap-2 text-lg font-black text-neutral-950">
              <span>{category.emoji}</span>
              {category.label}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-500">{categoryPlaces.length}</span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
              {categoryPlaces.map((place) => (
                <PlaceBookletCard
                  key={place.id}
                  place={place}
                  category={category}
                  photoUrl={photoCache[place.id]?.photos[0]?.url ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
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
    <article className="booklet-avoid-break grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border border-neutral-200 p-3">
      {photoUrl ? (
        <img className="h-[72px] w-[72px] rounded-lg object-cover" src={photoUrl} alt={place.name} loading="eager" />
      ) : (
        <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-neutral-100 text-xl">{category.emoji}</div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-bold text-neutral-500">{category.emoji} {category.label}</div>
        <h4 className="mt-1 text-base font-black leading-snug text-neutral-950">{place.name}</h4>
        <div className="mt-1 text-xs font-bold text-neutral-700">{place.menu}</div>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-500">{place.description}</p>
        <div className="mt-2 text-xs leading-5 text-neutral-500">
          {place.distanceLabel} · {place.travelMode === 'walk' ? '도보' : '대중교통'} {place.travelMinutes}분
        </div>
        <div className="mt-1 text-xs leading-5 text-neutral-500">{place.address}</div>
        {place.googleMapsNote ? <MarkdownText className="mt-2 text-xs leading-5" text={place.googleMapsNote} fallback="" /> : null}
        <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-600 underline underline-offset-4" href={getPlaceInfoUrl(place)} target="_blank" rel="noreferrer">
          Google Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

function TodoBooklet({ todos, scheduleDays }: { todos: TodoList; scheduleDays: ScheduleDay[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
      <TodoMiniList title="여행 전 체크리스트" items={todos.before} />
      {todos.days.map((day) => (
        <TodoMiniList
          key={day.dayIndex}
          title={formatDayLabel(day.dayIndex, scheduleDays)}
          items={day.items}
        />
      ))}
      {todos.custom.map((checklist) => (
        <TodoMiniList key={checklist.id} title={checklist.title} items={checklist.items} />
      ))}
      <TodoMiniList title="여행 후 체크리스트" items={todos.after} />
    </div>
  );
}

function TodoMiniList({ title, items }: { title: string; items: { id: string; text: string; done: boolean }[] }) {
  return (
    <div className="booklet-avoid-break rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-black text-neutral-950">{title}</h4>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-500">
          {items.filter((item) => item.done).length}/{items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm leading-5 text-neutral-700">
              {item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />}
              <span className={cn(item.done && 'text-neutral-400 line-through')}>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">항목 없음</div>
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
    <div className="rounded-xl border border-neutral-200 p-3">
      <h4 className="font-black text-neutral-950">{title}</h4>
      {items.length ? (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm leading-5">
              <div className="font-bold text-neutral-800">{item.primary}</div>
              {item.secondary ? <div className="text-xs text-neutral-500">{item.secondary}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">{emptyText}</div>
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
