import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchTodos, saveTodos } from '@/api/todos';
import type { TodoItem, TodoList, TodoSectionId } from '@/types/todo';

type TodoStatus = 'loading' | 'ready' | 'error';

export function useTodos(dayCount: number, canPersist = false) {
  const [todos, setTodos] = useState<TodoList>(() => createEmptyTodos(dayCount));
  const [status, setStatus] = useState<TodoStatus>('loading');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveSequenceRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTodos() {
      setStatus('loading');
      setError('');

      try {
        const loadedTodos = normalizeTodos(await fetchTodos(), dayCount);
        if (cancelled) return;
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
      const savedTodos = normalizeTodos(await saveTodos(nextTodos), dayCount);
      if (sequence === saveSequenceRef.current) {
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

  return {
    todos,
    status,
    error,
    isSaving,
    addSectionItem,
    addDayItem,
    toggleItem,
    toggleDayItem,
    removeSectionItem,
    removeDayItem
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
    after: normalizeItems(todos.after)
  };
}

function createEmptyTodos(dayCount: number): TodoList {
  return normalizeTodos({ before: [], days: [], after: [] }, dayCount);
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
