import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck2,
  Check,
  ChevronDown,
  ClipboardList,
  Home,
  Pencil,
  PlaneTakeoff,
  Plus,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react';
import { fetchSchedule } from '@/api/schedule';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTodos } from '@/hooks/useTodos';
import { cn } from '@/lib/utils';
import type { TodoCustomChecklist, TodoDay, TodoItem, TodoSectionId } from '@/types/todo';

type TodoPageProps = {
  isEditing: boolean;
};

type DefaultTodoBoxId = TodoSectionId | 'days';

const defaultTodoBoxIds: DefaultTodoBoxId[] = ['before', 'days', 'after'];
const todoBoxOrderStorageKey = 'travel-node.todo.default-box-order.v1';
const todoBoxCollapseStorageKey = 'travel-node.todo.collapsed-boxes.v1';

export function TodoPage({ isEditing }: TodoPageProps) {
  const [scheduleDayCount, setScheduleDayCount] = useState(1);
  const [defaultBoxOrder, setDefaultBoxOrder] = useState<DefaultTodoBoxId[]>(loadDefaultTodoBoxOrder);
  const [collapsedBoxIds, setCollapsedBoxIds] = useState<Set<string>>(loadCollapsedTodoBoxIds);
  const {
    todos,
    status,
    error,
    isSaving,
    addSectionItem,
    addDayItem,
    addDay,
    addCustomChecklist,
    removeCustomChecklist,
    renameCustomChecklist,
    moveCustomChecklist,
    moveSectionItem,
    moveDayItem,
    moveCustomItem,
    renameSectionItem,
    renameDayItem,
    renameCustomItem,
    addCustomItem,
    toggleItem,
    toggleDayItem,
    toggleCustomItem,
    removeSectionItem,
    removeDayItem,
    removeCustomItem
  } = useTodos(scheduleDayCount, isEditing);

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

  useEffect(() => {
    writeLocalStorage(todoBoxOrderStorageKey, JSON.stringify(defaultBoxOrder));
  }, [defaultBoxOrder]);

  useEffect(() => {
    writeLocalStorage(todoBoxCollapseStorageKey, JSON.stringify(Array.from(collapsedBoxIds)));
  }, [collapsedBoxIds]);

  function moveDefaultBox(boxId: DefaultTodoBoxId, direction: -1 | 1) {
    setDefaultBoxOrder((current) => moveOrderedValue(current, boxId, direction));
  }

  function toggleCollapsedBox(boxId: string) {
    setCollapsedBoxIds((current) => {
      const next = new Set(current);
      if (next.has(boxId)) next.delete(boxId);
      else next.add(boxId);
      return next;
    });
  }

  function defaultBoxMoveActions(boxId: DefaultTodoBoxId, label: string) {
    const boxIndex = defaultBoxOrder.indexOf(boxId);
    return isEditing ? (
      <TodoBoxMoveActions
        label={label}
        canMoveUp={boxIndex > 0}
        canMoveDown={boxIndex >= 0 && boxIndex < defaultBoxOrder.length - 1}
        isSaving={isSaving}
        onMoveUp={() => moveDefaultBox(boxId, -1)}
        onMoveDown={() => moveDefaultBox(boxId, 1)}
      />
    ) : null;
  }

  function renderDefaultBox(boxId: DefaultTodoBoxId) {
    switch (boxId) {
      case 'before':
        return (
          <TodoSectionCard
            key="before"
            title="여행전 체크리스트"
            description="출발 전에 빠뜨리면 곤란한 준비물을 정리합니다."
            icon={PlaneTakeoff}
            items={todos.before}
            isCollapsed={collapsedBoxIds.has('before')}
            isEditing={isEditing}
            isSaving={isSaving}
            accentClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
            headerActions={defaultBoxMoveActions('before', '여행전 체크리스트')}
            onToggleCollapsed={() => toggleCollapsedBox('before')}
            onAdd={(text) => addSectionItem('before', text)}
            onToggle={(itemId) => toggleItem('before', itemId)}
            onRemove={(itemId) => removeSectionItem('before', itemId)}
            onMove={(itemId, direction) => moveSectionItem('before', itemId, direction)}
            onRename={(itemId, text) => renameSectionItem('before', itemId, text)}
          />
        );
      case 'days':
        return (
          <TodoDaySectionCard
            key="days"
            days={todos.days}
            isCollapsed={collapsedBoxIds.has('days')}
            isEditing={isEditing}
            isSaving={isSaving}
            headerActions={defaultBoxMoveActions('days', 'DAY 별 할 일 목록')}
            onToggleCollapsed={() => toggleCollapsedBox('days')}
            onAddDay={addDay}
            onAddItem={addDayItem}
            onToggleItem={toggleDayItem}
            onRemoveItem={removeDayItem}
            onMoveItem={moveDayItem}
            onRenameItem={renameDayItem}
          />
        );
      case 'after':
        return (
          <TodoSectionCard
            key="after"
            title="여행후 체크리스트"
            description="귀국 후 정산, 백업, 후기 정리를 잊지 않게 남깁니다."
            icon={Home}
            items={todos.after}
            isCollapsed={collapsedBoxIds.has('after')}
            isEditing={isEditing}
            isSaving={isSaving}
            accentClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            headerActions={defaultBoxMoveActions('after', '여행후 체크리스트')}
            onToggleCollapsed={() => toggleCollapsedBox('after')}
            onAdd={(text) => addSectionItem('after', text)}
            onToggle={(itemId) => toggleItem('after', itemId)}
            onRemove={(itemId) => removeSectionItem('after', itemId)}
            onMove={(itemId, direction) => moveSectionItem('after', itemId, direction)}
            onRename={(itemId, text) => renameSectionItem('after', itemId, text)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <PageContainer className="grid gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline">Checklist</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">할일</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            여행 전 준비, DAY별 현장 할 일, 여행 후 정리 항목을 한 화면에서 관리합니다.
          </p>
          {status === 'loading' || isSaving ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {status === 'loading' ? '할 일을 불러오는 중입니다.' : '할 일을 저장하는 중입니다.'}
            </p>
          ) : null}
        </div>
        {isEditing ? <CreateChecklistForm disabled={isSaving} onCreate={addCustomChecklist} /> : null}
      </header>

      {status === 'error' && error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{defaultBoxOrder.map(renderDefaultBox)}</div>

      {todos.custom.length ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">커스텀 체크리스트</h2>
            <Badge variant="outline" className="rounded-full">
              {todos.custom.length}개
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {todos.custom.map((checklist, index) => (
              <CustomChecklistCard
                key={checklist.id}
                checklist={checklist}
                canMoveUp={index > 0}
                canMoveDown={index < todos.custom.length - 1}
                isEditing={isEditing}
                isSaving={isSaving}
                isCollapsed={collapsedBoxIds.has(`custom:${checklist.id}`)}
                onMoveUp={() => moveCustomChecklist(checklist.id, -1)}
                onMoveDown={() => moveCustomChecklist(checklist.id, 1)}
                onToggleCollapsed={() => toggleCollapsedBox(`custom:${checklist.id}`)}
                onAdd={(text) => addCustomItem(checklist.id, text)}
                onToggle={(itemId) => toggleCustomItem(checklist.id, itemId)}
                onRemoveItem={(itemId) => removeCustomItem(checklist.id, itemId)}
                onMoveItem={(itemId, direction) => moveCustomItem(checklist.id, itemId, direction)}
                onRenameItem={(itemId, text) => renameCustomItem(checklist.id, itemId, text)}
                onRenameChecklist={(title) => renameCustomChecklist(checklist.id, title)}
                onRemoveChecklist={() => removeCustomChecklist(checklist.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

function TodoSectionCard({
  title,
  description,
  icon: Icon,
  items,
  isCollapsed,
  isEditing,
  isSaving,
  accentClassName,
  headerActions,
  titleContent,
  onRemoveList,
  onToggleCollapsed,
  onAdd,
  onToggle,
  onRemove,
  onMove,
  onRename
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: TodoItem[];
  isCollapsed: boolean;
  isEditing: boolean;
  isSaving: boolean;
  accentClassName: string;
  headerActions?: ReactNode;
  titleContent?: ReactNode;
  onRemoveList?: () => void;
  onToggleCollapsed: () => void;
  onAdd: (text: string) => void;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onMove?: (itemId: string, direction: -1 | 1) => void;
  onRename: (itemId: string, text: string) => void;
}) {
  const doneCount = items.filter((item) => item.done).length;

  return (
    <section className="soft-panel overflow-hidden rounded-xl">
      <div className="border-b bg-secondary/80 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', accentClassName)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {titleContent ? (
                <div className="text-lg font-bold">{titleContent}</div>
              ) : (
                <h2 className="text-lg font-bold">{title}</h2>
              )}
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Badge variant="outline" className="rounded-full bg-background">
              {doneCount}/{items.length}
            </Badge>
            {headerActions}
            <CollapseButton isCollapsed={isCollapsed} label={title} onToggle={onToggleCollapsed} />
            {onRemoveList ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onRemoveList}
                disabled={isSaving}
                aria-label={`${title} 삭제`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!isCollapsed ? (
        <div className="grid gap-3 p-3 sm:p-4">
          <TodoItems
            items={items}
            isEditing={isEditing}
            isSaving={isSaving}
            emptyText="아직 등록된 항목이 없습니다."
            onToggle={onToggle}
            onRemove={onRemove}
            onMove={onMove}
            onRename={onRename}
          />
          {isEditing ? <AddTodoForm disabled={isSaving} onAdd={onAdd} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function CustomChecklistCard({
  checklist,
  canMoveUp,
  canMoveDown,
  isCollapsed,
  isEditing,
  isSaving,
  onMoveUp,
  onMoveDown,
  onToggleCollapsed,
  onAdd,
  onToggle,
  onRemoveItem,
  onMoveItem,
  onRenameItem,
  onRenameChecklist,
  onRemoveChecklist
}: {
  checklist: TodoCustomChecklist;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isCollapsed: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleCollapsed: () => void;
  onAdd: (text: string) => void;
  onToggle: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onRenameItem: (itemId: string, text: string) => void;
  onRenameChecklist: (title: string) => void;
  onRemoveChecklist: () => void;
}) {
  return (
    <TodoSectionCard
      title={checklist.title}
      description="사용자가 추가한 체크리스트입니다."
      icon={ClipboardList}
      items={checklist.items}
      isCollapsed={isCollapsed}
      isEditing={isEditing}
      isSaving={isSaving}
      accentClassName="bg-violet-500/10 text-violet-700 dark:text-violet-300"
      titleContent={
        <EditableChecklistTitle
          title={checklist.title}
          disabled={!isEditing || isSaving}
          onRename={onRenameChecklist}
        />
      }
      headerActions={
        isEditing ? (
          <TodoBoxMoveActions
            label={checklist.title}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            isSaving={isSaving}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) : null
      }
      onRemoveList={isEditing ? onRemoveChecklist : undefined}
      onToggleCollapsed={onToggleCollapsed}
      onAdd={onAdd}
      onToggle={onToggle}
      onRemove={onRemoveItem}
      onMove={onMoveItem}
      onRename={onRenameItem}
    />
  );
}

function EditableChecklistTitle({
  title,
  disabled,
  onRename
}: {
  title: string;
  disabled: boolean;
  onRename: (title: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    if (!isRenaming) setDraftTitle(title);
  }, [isRenaming, title]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) return;
    if (trimmedTitle !== title) onRename(trimmedTitle);
    setIsRenaming(false);
  }

  if (!isRenaming) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
        <span className="min-w-0 truncate">{title}</span>
        {!disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setIsRenaming(true)}
            aria-label={`${title} 제목 수정`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </span>
    );
  }

  return (
    <form className="flex min-w-0 max-w-full items-center gap-1" onSubmit={submit}>
      <input
        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm font-semibold outline-none ring-offset-background focus:ring-2 focus:ring-ring"
        value={draftTitle}
        autoFocus
        maxLength={80}
        disabled={disabled}
        onChange={(event) => setDraftTitle(event.target.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        disabled={disabled || !draftTitle.trim()}
        aria-label="체크리스트 제목 저장"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={() => {
          setDraftTitle(title);
          setIsRenaming(false);
        }}
        aria-label="체크리스트 제목 수정 취소"
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

function TodoBoxMoveActions({
  label,
  canMoveUp,
  canMoveDown,
  isSaving,
  onMoveUp,
  onMoveDown
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSaving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onMoveUp}
        disabled={isSaving || !canMoveUp}
        aria-label={`${label} 앞으로 이동`}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onMoveDown}
        disabled={isSaving || !canMoveDown}
        aria-label={`${label} 뒤로 이동`}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CollapseButton({
  isCollapsed,
  label,
  onToggle
}: {
  isCollapsed: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full"
      onClick={onToggle}
      aria-label={isCollapsed ? `${label} 펼치기` : `${label} 접기`}
      aria-expanded={!isCollapsed}
    >
      <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')} />
    </Button>
  );
}

function CreateChecklistForm({
  disabled,
  onCreate
}: {
  disabled: boolean;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onCreate(trimmedTitle);
    setTitle('');
  }

  return (
    <form className="soft-panel grid gap-2 rounded-xl p-3 sm:min-w-[24rem]" onSubmit={submit}>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-muted-foreground">커스텀 체크리스트</span>
        <input
          className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          value={title}
          maxLength={80}
          disabled={disabled}
          placeholder="체크리스트 이름"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <Button type="submit" className="rounded-full" disabled={disabled || !title.trim()}>
        <Plus className="h-4 w-4" />
        생성
      </Button>
    </form>
  );
}

function TodoDaySectionCard({
  days,
  isCollapsed,
  isEditing,
  isSaving,
  headerActions,
  onToggleCollapsed,
  onAddDay,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onMoveItem,
  onRenameItem
}: {
  days: TodoDay[];
  isCollapsed: boolean;
  isEditing: boolean;
  isSaving: boolean;
  headerActions?: ReactNode;
  onToggleCollapsed: () => void;
  onAddDay: () => void;
  onAddItem: (dayIndex: number, text: string) => void;
  onToggleItem: (dayIndex: number, itemId: string) => void;
  onRemoveItem: (dayIndex: number, itemId: string) => void;
  onMoveItem: (dayIndex: number, itemId: string, direction: -1 | 1) => void;
  onRenameItem: (dayIndex: number, itemId: string, text: string) => void;
}) {
  const totalCount = days.reduce((sum, day) => sum + day.items.length, 0);
  const doneCount = days.reduce((sum, day) => sum + day.items.filter((item) => item.done).length, 0);

  return (
    <section className="soft-panel overflow-hidden rounded-xl">
      <div className="border-b bg-secondary/80 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <CalendarCheck2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">DAY 별 할 일 목록</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  각 날짜에 챙길 예약, 티켓, 쇼핑, 이동 전 확인을 기록합니다.
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Badge variant="outline" className="rounded-full bg-background">
              {days.length}일
            </Badge>
            <Badge variant="outline" className="rounded-full bg-background">
              {doneCount}/{totalCount}
            </Badge>
            {headerActions}
            {isEditing ? (
              <Button className="h-8 rounded-full" size="sm" variant="outline" onClick={onAddDay} disabled={isSaving}>
                <Plus className="h-4 w-4" />
                DAY 추가
              </Button>
            ) : null}
            <CollapseButton isCollapsed={isCollapsed} label="DAY 별 할 일 목록" onToggle={onToggleCollapsed} />
          </div>
        </div>
      </div>

      {!isCollapsed ? (
        <div className="grid gap-3 p-3 sm:p-4">
          {days.map((day) => (
            <TodoDayCard
              key={day.dayIndex}
              dayIndex={day.dayIndex}
              items={day.items}
              isEditing={isEditing}
              isSaving={isSaving}
              onAdd={(text) => onAddItem(day.dayIndex, text)}
              onToggle={(itemId) => onToggleItem(day.dayIndex, itemId)}
              onRemove={(itemId) => onRemoveItem(day.dayIndex, itemId)}
              onMove={(itemId, direction) => onMoveItem(day.dayIndex, itemId, direction)}
              onRename={(itemId, text) => onRenameItem(day.dayIndex, itemId, text)}
            />
          ))}
        </div>
      ) : null}
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
  onRemove,
  onMove,
  onRename
}: {
  dayIndex: number;
  items: TodoItem[];
  isEditing: boolean;
  isSaving: boolean;
  onAdd: (text: string) => void;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onRename: (itemId: string, text: string) => void;
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
        onMove={onMove}
        onRename={onRename}
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
  onRemove,
  onMove,
  onRename
}: {
  items: TodoItem[];
  isEditing: boolean;
  isSaving: boolean;
  emptyText: string;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onMove?: (itemId: string, direction: -1 | 1) => void;
  onRename: (itemId: string, text: string) => void;
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
      {items.map((item, index) => (
        <li key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/15 p-3">
          <input
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            type="checkbox"
            checked={item.done}
            disabled={!isEditing || isSaving}
            onChange={() => onToggle(item.id)}
            aria-label={`${item.text} 완료`}
          />
          <EditableTodoItemText
            item={item}
            disabled={!isEditing || isSaving}
            onRename={(text) => onRename(item.id, text)}
          />
          {isEditing ? (
            <div className="flex shrink-0 items-center gap-1">
              {onMove ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => onMove(item.id, -1)}
                    disabled={isSaving || index === 0}
                    aria-label={`${item.text} 위로 이동`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => onMove(item.id, 1)}
                    disabled={isSaving || index === items.length - 1}
                    aria-label={`${item.text} 아래로 이동`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemove(item.id)}
                disabled={isSaving}
                aria-label={`${item.text} 삭제`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EditableTodoItemText({
  item,
  disabled,
  onRename
}: {
  item: TodoItem;
  disabled: boolean;
  onRename: (text: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftText, setDraftText] = useState(item.text);

  useEffect(() => {
    if (!isRenaming) setDraftText(item.text);
  }, [isRenaming, item.text]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedText = draftText.trim();
    if (!trimmedText) return;
    if (trimmedText !== item.text) onRename(trimmedText);
    setIsRenaming(false);
  }

  if (!isRenaming) {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <span className={cn('min-w-0 flex-1 text-sm leading-6', item.done && 'text-muted-foreground line-through')}>
          {item.text}
        </span>
        {!disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setIsRenaming(true)}
            aria-label={`${item.text} 수정`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={submit}>
      <input
        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
        value={draftText}
        autoFocus
        maxLength={200}
        disabled={disabled}
        onChange={(event) => setDraftText(event.target.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        disabled={disabled || !draftText.trim()}
        aria-label="할 일 저장"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={() => {
          setDraftText(item.text);
          setIsRenaming(false);
        }}
        aria-label="할 일 수정 취소"
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
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

function loadDefaultTodoBoxOrder(): DefaultTodoBoxId[] {
  const rawOrder = readLocalStorage(todoBoxOrderStorageKey);
  if (!rawOrder) return defaultTodoBoxIds;

  try {
    return normalizeDefaultTodoBoxOrder(JSON.parse(rawOrder));
  } catch {
    return defaultTodoBoxIds;
  }
}

function normalizeDefaultTodoBoxOrder(value: unknown): DefaultTodoBoxId[] {
  if (!Array.isArray(value)) return defaultTodoBoxIds;

  const orderedIds: DefaultTodoBoxId[] = [];
  value.forEach((item) => {
    if (isDefaultTodoBoxId(item) && !orderedIds.includes(item)) orderedIds.push(item);
  });

  defaultTodoBoxIds.forEach((boxId) => {
    if (!orderedIds.includes(boxId)) orderedIds.push(boxId);
  });

  return orderedIds;
}

function isDefaultTodoBoxId(value: unknown): value is DefaultTodoBoxId {
  return value === 'before' || value === 'days' || value === 'after';
}

function loadCollapsedTodoBoxIds() {
  const rawIds = readLocalStorage(todoBoxCollapseStorageKey);
  if (!rawIds) return new Set<string>();

  try {
    const parsedIds = JSON.parse(rawIds);
    if (!Array.isArray(parsedIds)) return new Set<string>();
    return new Set(parsedIds.filter((value): value is string => typeof value === 'string' && value.length > 0));
  } catch {
    return new Set<string>();
  }
}

function moveOrderedValue<T>(items: T[], value: T, direction: -1 | 1) {
  const fromIndex = items.indexOf(value);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local UI preferences are optional; ignore storage failures.
  }
}
