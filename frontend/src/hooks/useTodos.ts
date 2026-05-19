import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchTodos, saveTodos, type TodoSaveScope } from '@/api/todos';
import type { TodoCustomChecklist, TodoItem, TodoList, TodoSectionId } from '@/types/todo';

type TodoStatus = 'loading' | 'ready' | 'error';

export function useTodos(dayCount: number, canPersist = false) {
  const [todos, setTodos] = useState<TodoList>(() => createEmptyTodos(dayCount));
  const [status, setStatus] = useState<TodoStatus>('loading');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveSequenceRef = useRef(0);
  const saveScopeRef = useRef<TodoSaveScope>(emptyTodoSaveScope());

  useEffect(() => {
    let cancelled = false;

    async function loadTodos() {
      setStatus('loading');
      setError('');

      try {
        const loadedTodos = normalizeTodos(await fetchTodos(), dayCount);
        if (cancelled) return;
        saveScopeRef.current = todoSaveScope(loadedTodos);
        setTodos(loadedTodos);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setTodos(createEmptyTodos(dayCount));
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : '할 일을 불러오지 못했습니다.');
      }
    }

    void loadTodos();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTodos((current) => normalizeTodos(current, dayCount));
  }, [dayCount]);

  function updateTodos(updater: (current: TodoList) => TodoList) {
    setTodos((current) => {
      const nextTodos = normalizeTodos(updater(current), dayCount);
      if (canPersist && getAuthToken()) {
        saveScopeRef.current = mergeTodoSaveScopes(saveScopeRef.current, todoSaveScope(nextTodos));
        void persistTodos(nextTodos);
      }
      return nextTodos;
    });
  }

  async function persistTodos(nextTodos: TodoList) {
    const sequence = ++saveSequenceRef.current;
    setIsSaving(true);
    setError('');

    try {
      const savedTodos = normalizeTodos(await saveTodos(nextTodos, saveScopeRef.current), dayCount);
      if (sequence === saveSequenceRef.current) {
        saveScopeRef.current = todoSaveScope(savedTodos);
        setTodos(savedTodos);
        setStatus('ready');
      }
    } catch (saveError) {
      if (sequence === saveSequenceRef.current) {
        setStatus('error');
        setError(saveError instanceof Error ? saveError.message : '할 일을 저장하지 못했습니다.');
      }
    } finally {
      if (sequence === saveSequenceRef.current) {
        setIsSaving(false);
      }
    }
  }

  function addSectionItem(section: TodoSectionId, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      [section]: [...current[section], createTodoItem(trimmedText)]
    }));
  }

  function addDayItem(dayIndex: number, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, items: [...day.items, createTodoItem(trimmedText)] }
          : day
      )
    }));
  }

  function addDay() {
    updateTodos((current) => {
      const nextDayIndex = Math.max(-1, ...current.days.map((day) => day.dayIndex)) + 1;
      return {
        ...current,
        days: [
          ...current.days,
          {
            dayIndex: nextDayIndex,
            items: []
          }
        ]
      };
    });
  }

  function addCustomChecklist(title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    updateTodos((current) => ({
      ...current,
      custom: [
        ...current.custom,
        {
          id: createId('checklist'),
          title: trimmedTitle,
          items: []
        }
      ]
    }));
  }

  function removeCustomChecklist(checklistId: string) {
    updateTodos((current) => ({
      ...current,
      custom: current.custom.filter((checklist) => checklist.id !== checklistId)
    }));
  }

  function renameCustomChecklist(checklistId: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId ? { ...checklist, title: trimmedTitle } : checklist
      )
    }));
  }

  function moveCustomChecklist(checklistId: string, direction: -1 | 1) {
    updateTodos((current) => {
      const fromIndex = current.custom.findIndex((checklist) => checklist.id === checklistId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.custom.length) return current;

      const nextCustom = [...current.custom];
      const [movedChecklist] = nextCustom.splice(fromIndex, 1);
      nextCustom.splice(toIndex, 0, movedChecklist);
      return {
        ...current,
        custom: nextCustom
      };
    });
  }

  function moveSectionItem(section: TodoSectionId, itemId: string, direction: -1 | 1) {
    updateTodos((current) => ({
      ...current,
      [section]: moveTodoItem(current[section], itemId, direction)
    }));
  }

  function renameSectionItem(section: TodoSectionId, itemId: string, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      [section]: renameTodoItem(current[section], itemId, trimmedText)
    }));
  }

  function moveDayItem(dayIndex: number, itemId: string, direction: -1 | 1) {
    updateTodos((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, items: moveTodoItem(day.items, itemId, direction) }
          : day
      )
    }));
  }

  function renameDayItem(dayIndex: number, itemId: string, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, items: renameTodoItem(day.items, itemId, trimmedText) }
          : day
      )
    }));
  }

  function moveCustomItem(checklistId: string, itemId: string, direction: -1 | 1) {
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: moveTodoItem(checklist.items, itemId, direction) }
          : checklist
      )
    }));
  }

  function renameCustomItem(checklistId: string, itemId: string, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: renameTodoItem(checklist.items, itemId, trimmedText) }
          : checklist
      )
    }));
  }

  function addCustomItem(checklistId: string, text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: [...checklist.items, createTodoItem(trimmedText)] }
          : checklist
      )
    }));
  }

  function toggleItem(section: TodoSectionId, itemId: string) {
    updateTodos((current) => ({
      ...current,
      [section]: current[section].map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
    }));
  }

  function toggleDayItem(dayIndex: number, itemId: string) {
    updateTodos((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, items: day.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)) }
          : day
      )
    }));
  }

  function toggleCustomItem(checklistId: string, itemId: string) {
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              items: checklist.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
            }
          : checklist
      )
    }));
  }

  function removeSectionItem(section: TodoSectionId, itemId: string) {
    updateTodos((current) => ({
      ...current,
      [section]: current[section].filter((item) => item.id !== itemId)
    }));
  }

  function removeDayItem(dayIndex: number, itemId: string) {
    updateTodos((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, items: day.items.filter((item) => item.id !== itemId) }
          : day
      )
    }));
  }

  function removeCustomItem(checklistId: string, itemId: string) {
    updateTodos((current) => ({
      ...current,
      custom: current.custom.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: checklist.items.filter((item) => item.id !== itemId) }
          : checklist
      )
    }));
  }

  return {
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
  };
}

function normalizeTodos(todos: TodoList, minimumDayCount: number): TodoList {
  const maxDayIndex = Math.max(
    minimumDayCount - 1,
    ...todos.days.map((day) => day.dayIndex),
    0
  );
  const daysByIndex = new Map(todos.days.map((day) => [day.dayIndex, day.items]));

  return {
    before: normalizeItems(todos.before),
    days: Array.from({ length: maxDayIndex + 1 }, (_, dayIndex) => ({
      dayIndex,
      items: normalizeItems(daysByIndex.get(dayIndex) ?? [])
    })),
    after: normalizeItems(todos.after),
    custom: normalizeCustomChecklists(todos.custom ?? [])
  };
}

function createEmptyTodos(dayCount: number): TodoList {
  return normalizeTodos({ before: [], days: [], after: [], custom: [] }, dayCount);
}

function normalizeCustomChecklists(checklists: TodoCustomChecklist[]) {
  return checklists
    .filter((checklist) => checklist.id && checklist.title.trim())
    .map((checklist) => ({
      id: checklist.id,
      title: checklist.title.trim(),
      items: normalizeItems(checklist.items)
    }));
}

function normalizeItems(items: TodoItem[]) {
  return items
    .filter((item) => item.id && item.text.trim())
    .map((item) => ({
      id: item.id,
      text: item.text.trim(),
      done: Boolean(item.done)
    }));
}

function todoSaveScope(todos: TodoList): TodoSaveScope {
  return {
    knownItemIds: [
      ...todos.before.map((item) => item.id),
      ...todos.after.map((item) => item.id),
      ...todos.days.flatMap((day) => day.items.map((item) => item.id)),
      ...todos.custom.flatMap((checklist) => checklist.items.map((item) => item.id))
    ],
    knownCustomChecklistIds: todos.custom.map((checklist) => checklist.id)
  };
}

function emptyTodoSaveScope(): TodoSaveScope {
  return {
    knownItemIds: [],
    knownCustomChecklistIds: []
  };
}

function mergeTodoSaveScopes(current: TodoSaveScope, next: TodoSaveScope): TodoSaveScope {
  return {
    knownItemIds: Array.from(new Set([...current.knownItemIds, ...next.knownItemIds])),
    knownCustomChecklistIds: Array.from(new Set([...current.knownCustomChecklistIds, ...next.knownCustomChecklistIds]))
  };
}

function renameTodoItem(items: TodoItem[], itemId: string, text: string) {
  return items.map((item) => (item.id === itemId ? { ...item, text } : item));
}

function moveTodoItem(items: TodoItem[], itemId: string, direction: -1 | 1) {
  const fromIndex = items.findIndex((item) => item.id === itemId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function createTodoItem(text: string): TodoItem {
  return {
    id: createId('todo'),
    text,
    done: false
  };
}

function createId(prefix: string) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
