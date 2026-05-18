import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CheckCircle2, Home, PlaneTakeoff, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { fetchSchedule } from '@/api/schedule';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTodos } from '@/hooks/useTodos';
import { cn } from '@/lib/utils';
import type { TodoItem } from '@/types/todo';

type TodoPageProps = {
  isEditing: boolean;
};

export function TodoPage({ isEditing }: TodoPageProps) {
  const [scheduleDayCount, setScheduleDayCount] = useState(1);
  const { todos, status, error, isSaving, addSectionItem, addDayItem, toggleItem, toggleDayItem, removeSectionItem, removeDayItem } =
    useTodos(scheduleDayCount, isEditing);

  const totalSummary = useMemo(() => {
    const allItems = [...todos.before, ...todos.after, ...todos.days.flatMap((day) => day.items)];
    const doneCount = allItems.filter((item) => item.done).length;
    return { doneCount, totalCount: allItems.length };
  }, [todos]);

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
          <Badge variant="outline">Checklist</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">할일</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            여행 전 준비, DAY별 현장 할 일, 여행 후 정리 항목을 한 화면에서 관리합니다.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {status === 'loading'
              ? '할 일을 불러오는 중입니다.'
              : isSaving
                ? '할 일을 저장하는 중입니다.'
                : '할 일은 서버 DB에 저장됩니다.'}
          </p>
        </div>

        <div className="soft-panel flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">완료</div>
            <div className="text-xl font-bold">
              {totalSummary.doneCount}/{totalSummary.totalCount}
            </div>
          </div>
        </div>
      </header>

      {status === 'error' && error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <TodoSectionCard
          title="여행전 체크리스트"
          description="출발 전에 빠뜨리면 곤란한 준비물을 정리합니다."
          icon={PlaneTakeoff}
          items={todos.before}
          isEditing={isEditing}
          isSaving={isSaving}
          accentClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
          onAdd={(text) => addSectionItem('before', text)}
          onToggle={(itemId) => toggleItem('before', itemId)}
          onRemove={(itemId) => removeSectionItem('before', itemId)}
        />

        <section className="soft-panel overflow-hidden rounded-xl">
          <div className="border-b bg-secondary/80 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                    <CalendarCheck2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">DAY 별 할 일 목록</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">각 날짜에 챙길 예약, 티켓, 쇼핑, 이동 전 확인을 기록합니다.</p>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full bg-background">
                {todos.days.length}일
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 p-3 sm:p-4">
            {todos.days.map((day) => (
              <TodoDayCard
                key={day.dayIndex}
                dayIndex={day.dayIndex}
                items={day.items}
                isEditing={isEditing}
                isSaving={isSaving}
                onAdd={(text) => addDayItem(day.dayIndex, text)}
                onToggle={(itemId) => toggleDayItem(day.dayIndex, itemId)}
                onRemove={(itemId) => removeDayItem(day.dayIndex, itemId)}
              />
            ))}
          </div>
        </section>

        <TodoSectionCard
          title="여행후 체크리스트"
          description="귀국 후 정산, 백업, 후기 정리를 잊지 않게 남깁니다."
          icon={Home}
          items={todos.after}
          isEditing={isEditing}
          isSaving={isSaving}
          accentClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          onAdd={(text) => addSectionItem('after', text)}
          onToggle={(itemId) => toggleItem('after', itemId)}
          onRemove={(itemId) => removeSectionItem('after', itemId)}
        />
      </div>
    </PageContainer>
  );
}

function TodoSectionCard({
  title,
  description,
  icon: Icon,
  items,
  isEditing,
  isSaving,
  accentClassName,
  onAdd,
  onToggle,
  onRemove
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: TodoItem[];
  isEditing: boolean;
  isSaving: boolean;
  accentClassName: string;
  onAdd: (text: string) => void;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  return (
    <section className="soft-panel overflow-hidden rounded-xl">
      <div className="border-b bg-secondary/80 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', accentClassName)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        <TodoItems
          items={items}
          isEditing={isEditing}
          isSaving={isSaving}
          emptyText="아직 등록된 항목이 없습니다."
          onToggle={onToggle}
          onRemove={onRemove}
        />
        {isEditing ? <AddTodoForm disabled={isSaving} onAdd={onAdd} /> : null}
      </div>
    </section>
  );
}

function TodoDayCard({
  dayIndex,
  items,
  isEditing,
  isSaving,
  onAdd,
  onToggle,
  onRemove
}: {
  dayIndex: number;
  items: TodoItem[];
  isEditing: boolean;
  isSaving: boolean;
  onAdd: (text: string) => void;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const doneCount = items.filter((item) => item.done).length;

  return (
    <article className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="rounded-full bg-primary text-primary-foreground">DAY {dayIndex + 1}</Badge>
          <span className="text-sm font-semibold text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>
      </div>
      <TodoItems
        items={items}
        isEditing={isEditing}
        isSaving={isSaving}
        emptyText="이 DAY에 등록된 할 일이 없습니다."
        onToggle={onToggle}
        onRemove={onRemove}
      />
      {isEditing ? <AddTodoForm className="mt-3" disabled={isSaving} onAdd={onAdd} /> : null}
    </article>
  );
}

function TodoItems({
  items,
  isEditing,
  isSaving,
  emptyText,
  onToggle,
  onRemove
}: {
  items: TodoItem[];
  isEditing: boolean;
  isSaving: boolean;
  emptyText: string;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  if (!items.length) {
    return (
      <div className="grid min-h-24 place-items-center rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/15 p-3">
          <input
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            type="checkbox"
            checked={item.done}
            disabled={!isEditing || isSaving}
            onChange={() => onToggle(item.id)}
            aria-label={`${item.text} 완료`}
          />
          <span className={cn('min-w-0 flex-1 text-sm leading-6', item.done && 'text-muted-foreground line-through')}>
            {item.text}
          </span>
          {isEditing ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemove(item.id)}
              disabled={isSaving}
              aria-label={`${item.text} 삭제`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AddTodoForm({
  className,
  disabled,
  onAdd
}: {
  className?: string;
  disabled: boolean;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;
    onAdd(trimmedText);
    setText('');
  }

  return (
    <form className={cn('flex gap-2', className)} onSubmit={submit}>
      <input
        className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
        value={text}
        maxLength={200}
        disabled={disabled}
        placeholder="할 일 추가"
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" className="shrink-0" disabled={disabled || !text.trim()} aria-label="할 일 추가">
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">추가</span>
      </Button>
    </form>
  );
}
