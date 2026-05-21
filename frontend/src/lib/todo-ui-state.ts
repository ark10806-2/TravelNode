import type { TodoSectionId } from '@/types/todo';

export type DefaultTodoBoxId = TodoSectionId | 'days';

export const defaultTodoBoxIds: DefaultTodoBoxId[] = ['before', 'days', 'after'];
export const todoBoxOrderStorageKey = 'travel-node.todo.default-box-order.v1';
export const todoBoxCollapseStorageKey = 'travel-node.todo.collapsed-boxes.v1';

export function loadDefaultTodoBoxOrder(): DefaultTodoBoxId[] {
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

export function loadCollapsedTodoBoxIds() {
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

export function moveOrderedValue<T>(items: T[], value: T, direction: -1 | 1) {
  const fromIndex = items.indexOf(value);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local UI preferences are optional; ignore storage failures.
  }
}
