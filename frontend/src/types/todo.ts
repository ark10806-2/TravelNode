export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TodoDay = {
  dayIndex: number;
  items: TodoItem[];
};

export type TodoList = {
  before: TodoItem[];
  days: TodoDay[];
  after: TodoItem[];
};

export type TodoSectionId = 'before' | 'after';
