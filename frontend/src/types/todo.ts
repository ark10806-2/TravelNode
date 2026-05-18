export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TodoDay = {
  dayIndex: number;
  items: TodoItem[];
};

export type TodoCustomChecklist = {
  id: string;
  title: string;
  items: TodoItem[];
};

export type TodoList = {
  before: TodoItem[];
  days: TodoDay[];
  after: TodoItem[];
  custom: TodoCustomChecklist[];
};

export type TodoSectionId = 'before' | 'after';
