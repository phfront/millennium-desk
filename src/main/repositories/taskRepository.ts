import type {
  CreateTaskInput,
  TaskExportPayload,
  TaskItem,
  UpdateTaskInput,
} from "../../shared/contracts";
import {
  isPastDateKey,
  isValidDateKey,
  todayDateKey,
} from "../../shared/date";
import { getDatabase } from "../database";
import { getTagIdsForTasks, setTaskTags } from "./tagRepository";

interface TaskRow {
  id: number;
  task_date: string;
  text: string;
  done: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const toTaskItem = (row: TaskRow, tagIds: number[] = []): TaskItem => ({
  id: row.id,
  text: row.text,
  done: row.done === 1,
  tagIds,
});

const assertEditableDate = (taskDate: string) => {
  if (!isValidDateKey(taskDate)) {
    throw new Error("Data invalida.");
  }
  if (isPastDateKey(taskDate)) {
    throw new Error("Tarefas de datas passadas nao podem ser alteradas.");
  }
};

const getTaskRow = (id: number) => {
  const row = getDatabase()
    .prepare(
      "SELECT id, task_date, text, done, sort_order, created_at, updated_at FROM tasks WHERE id = ?",
    )
    .get(id) as TaskRow | undefined;

  if (!row) {
    throw new Error(`Tarefa ${id} nao encontrada.`);
  }

  return row;
};

export const listTasksByDate = (taskDate: string): TaskItem[] => {
  if (!isValidDateKey(taskDate)) {
    throw new Error("Data invalida.");
  }

  const rows = getDatabase()
    .prepare(
      `
        SELECT id, task_date, text, done, sort_order, created_at, updated_at
        FROM tasks
        WHERE task_date = ?
        ORDER BY done ASC, sort_order ASC, id ASC
      `,
    )
    .all(taskDate) as unknown as TaskRow[];

  const tagIdsByTask = getTagIdsForTasks(rows.map((row) => row.id));
  return rows.map((row) => toTaskItem(row, tagIdsByTask.get(row.id) ?? []));
};

export const createTask = (input: CreateTaskInput): TaskItem => {
  const text = input.text.trim();
  if (!text) {
    throw new Error("O texto da tarefa nao pode ficar vazio.");
  }

  assertEditableDate(input.date);

  const database = getDatabase();
  const nextSortOrder = (
    database
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks WHERE task_date = ?",
      )
      .get(input.date) as { next_order: number }
  ).next_order;

  const result = database
    .prepare(
      `
        INSERT INTO tasks (task_date, text, done, sort_order)
        VALUES (?, ?, 0, ?)
      `,
    )
    .run(input.date, text, nextSortOrder);

  const taskId = Number(result.lastInsertRowid);
  if (input.tagIds?.length) {
    setTaskTags(taskId, input.tagIds);
  }

  const tagIds = getTagIdsForTasks([taskId]).get(taskId) ?? [];
  return toTaskItem(getTaskRow(taskId), tagIds);
};

export const updateTask = (input: UpdateTaskInput): TaskItem => {
  const row = getTaskRow(input.id);
  assertEditableDate(row.task_date);

  const nextText = input.text !== undefined ? input.text.trim() : row.text;
  if (!nextText) {
    throw new Error("O texto da tarefa nao pode ficar vazio.");
  }

  const nextDone = input.done !== undefined ? (input.done ? 1 : 0) : row.done;

  getDatabase()
    .prepare(
      `
        UPDATE tasks
        SET text = ?, done = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .run(nextText, nextDone, input.id);

  if (input.tagIds !== undefined) {
    setTaskTags(input.id, input.tagIds);
  }

  const tagIds = getTagIdsForTasks([input.id]).get(input.id) ?? [];
  return toTaskItem(getTaskRow(input.id), tagIds);
};

export const deleteTask = (id: number) => {
  const row = getTaskRow(id);
  assertEditableDate(row.task_date);

  getDatabase().prepare("DELETE FROM tasks WHERE id = ?").run(id);
};

export const exportTasksJson = (): TaskExportPayload => {
  const rows = getDatabase()
    .prepare(
      `
        SELECT id, task_date, text, done, sort_order, created_at, updated_at
        FROM tasks
        ORDER BY task_date ASC, sort_order ASC, id ASC
      `,
    )
    .all() as unknown as TaskRow[];

  return {
    exportedAt: new Date().toISOString(),
    today: todayDateKey(),
    tasks: rows.map((row) => ({
      id: row.id,
      date: row.task_date,
      text: row.text,
      done: row.done === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};
