import { authHeaders } from '@/api/auth';
import { apiBaseUrl } from '@/config/env';
import { readData } from './client';
import type { TodoList } from '@/types/todo';

export type TodoSaveScope = {
  knownItemIds: string[];
  knownCustomChecklistIds: string[];
};

export async function fetchTodos() {
  const response = await fetch(`${apiBaseUrl}/api/todos`);
  return readData<TodoList>(response, '할 일을 불러오지 못했습니다.');
}

export async function saveTodos(todos: TodoList, scope: TodoSaveScope) {
  const response = await fetch(`${apiBaseUrl}/api/todos`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...todos, ...scope })
  });

  return readData<TodoList>(response, '할 일을 저장하지 못했습니다.');
}
