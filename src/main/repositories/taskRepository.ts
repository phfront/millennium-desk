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
  persistent: number;
  rollover: number;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

const TASK_COLUMNS =
  "id, task_date, text, done, sort_order, persistent, rollover, completed_on, created_at, updated_at";

const toTaskItem = (row: TaskRow, tagIds: number[] = []): TaskItem => ({
  id: row.id,
  text: row.text,
  done: row.done === 1,
  tagIds,
  persistent: row.persistent === 1,
  rollover: row.rollover === 1,
  completedOn: row.completed_on ?? null,
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
    .prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`)
    .get(id) as TaskRow | undefined;

  if (!row) {
    throw new Error(`Tarefa ${id} nao encontrada.`);
  }

  return row;
};

/**
 * Traz para hoje toda tarefa datada com rollover ligado que virou o dia sem
 * ser concluida. E idempotente e olha todas as datas passadas de uma vez, entao
 * cobre tambem o app fechado por varios dias; as concluidas ficam no dia em que
 * foram feitas e as recorrentes ja aparecem sozinhas todo dia.
 */
export const rollOverPendingTasks = (): number => {
  const today = todayDateKey();
  const database = getDatabase();
  const pending = database
    .prepare(
      `
        SELECT id
        FROM tasks
        WHERE rollover = 1
          AND persistent = 0
          AND done = 0
          AND task_date < ?
        ORDER BY task_date ASC, sort_order ASC, id ASC
      `,
    )
    .all(today) as unknown as { id: number }[];

  if (pending.length === 0) return 0;

  let nextSortOrder = (
    database
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks WHERE task_date = ? AND persistent = 0",
      )
      .get(today) as { next_order: number }
  ).next_order;

  const update = database.prepare(
    `
      UPDATE tasks
      SET task_date = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
  );

  database.exec("BEGIN");
  try {
    for (const row of pending) {
      update.run(today, nextSortOrder, row.id);
      nextSortOrder += 1;
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return pending.length;
};

export const listTasksByDate = (taskDate: string): TaskItem[] => {
  if (!isValidDateKey(taskDate)) {
    throw new Error("Data invalida.");
  }

  // Antes de qualquer leitura: quem devia ter migrado ja migra aqui, mesmo que
  // o dia tenha virado com o app fechado.
  rollOverPendingTasks();

  // Tarefas com data: apenas as do dia. Recorrentes: aparecem em todos os
  // dias a partir da criacao ate o dia da conclusao (inclusive), sempre
  // depois das tarefas datadas.
  const rows = getDatabase()
    .prepare(
      `
        SELECT ${TASK_COLUMNS}
        FROM tasks
        WHERE (persistent = 0 AND task_date = ?)
           OR (
             persistent = 1
             AND task_date <= ?
             AND (completed_on IS NULL OR completed_on >= ?)
           )
        ORDER BY persistent ASC, done ASC, sort_order ASC, id ASC
      `,
    )
    .all(taskDate, taskDate, taskDate) as unknown as TaskRow[];

  const tagIdsByTask = getTagIdsForTasks(rows.map((row) => row.id));
  return rows.map((row) => toTaskItem(row, tagIdsByTask.get(row.id) ?? []));
};

export const createTask = (input: CreateTaskInput): TaskItem => {
  const text = input.text.trim();
  if (!text) {
    throw new Error("O texto da tarefa nao pode ficar vazio.");
  }

  assertEditableDate(input.date);

  const persistent = input.persistent === true;
  // Recorrente ja reaparece todo dia: guardar rollover nela so criaria ruido.
  const rollover = !persistent && input.rollover === true;
  const database = getDatabase();
  const nextSortOrder = (
    database
      .prepare(
        persistent
          ? "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks WHERE persistent = 1"
          : "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks WHERE task_date = ? AND persistent = 0",
      )
      .get(...(persistent ? [] : [input.date])) as { next_order: number }
  ).next_order;

  const result = database
    .prepare(
      `
        INSERT INTO tasks (task_date, text, done, sort_order, persistent, rollover)
        VALUES (?, ?, 0, ?, ?, ?)
      `,
    )
    .run(
      input.date,
      text,
      nextSortOrder,
      persistent ? 1 : 0,
      rollover ? 1 : 0,
    );

  const taskId = Number(result.lastInsertRowid);
  if (input.tagIds?.length) {
    setTaskTags(taskId, input.tagIds);
  }

  const tagIds = getTagIdsForTasks([taskId]).get(taskId) ?? [];
  return toTaskItem(getTaskRow(taskId), tagIds);
};

export const updateTask = (input: UpdateTaskInput): TaskItem => {
  const row = getTaskRow(input.id);
  const wasPersistent = row.persistent === 1;
  const nextPersistent =
    input.persistent !== undefined ? input.persistent : wasPersistent;

  // Recorrentes nao tem "dia" proprio: podem ser editadas/concluidas a
  // qualquer momento, mesmo que a data de inicio ja tenha passado.
  if (!wasPersistent) {
    assertEditableDate(row.task_date);
  }

  // Data so muda para tarefas datadas (ou ao converter recorrente -> datada).
  const nextDate =
    !nextPersistent && input.date !== undefined ? input.date : row.task_date;
  if (!nextPersistent && (wasPersistent || nextDate !== row.task_date)) {
    assertEditableDate(nextDate);
  }

  const nextText = input.text !== undefined ? input.text.trim() : row.text;
  if (!nextText) {
    throw new Error("O texto da tarefa nao pode ficar vazio.");
  }

  const nextDone = input.done !== undefined ? (input.done ? 1 : 0) : row.done;

  // Virar recorrente desliga a migracao diaria: a tarefa ja passa a aparecer
  // em todos os dias por conta propria.
  const nextRollover = nextPersistent
    ? 0
    : input.rollover !== undefined
      ? input.rollover
        ? 1
        : 0
      : row.rollover;

  // Conclusao de recorrente registra o dia real; reabrir limpa o registro.
  let nextCompletedOn: string | null = row.completed_on ?? null;
  if (!nextPersistent || nextDone === 0) {
    nextCompletedOn = null;
  } else if (nextDone === 1 && !nextCompletedOn) {
    nextCompletedOn = todayDateKey();
  }

  const movingTask = nextDate !== row.task_date;
  const nextSortOrder = movingTask
    ? (
        getDatabase()
          .prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks WHERE task_date = ? AND persistent = 0",
          )
          .get(nextDate) as { next_order: number }
      ).next_order
    : row.sort_order;

  getDatabase()
    .prepare(
      `
        UPDATE tasks
        SET task_date = ?, text = ?, done = ?, sort_order = ?,
            persistent = ?, rollover = ?, completed_on = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .run(
      nextDate,
      nextText,
      nextDone,
      nextSortOrder,
      nextPersistent ? 1 : 0,
      nextRollover,
      nextCompletedOn,
      input.id,
    );

  if (input.tagIds !== undefined) {
    setTaskTags(input.id, input.tagIds);
  }

  const tagIds = getTagIdsForTasks([input.id]).get(input.id) ?? [];
  return toTaskItem(getTaskRow(input.id), tagIds);
};

export const deleteTask = (id: number) => {
  const row = getTaskRow(id);
  if (row.persistent !== 1) {
    assertEditableDate(row.task_date);
  }

  getDatabase().prepare("DELETE FROM tasks WHERE id = ?").run(id);
};

export const exportTasksJson = (): TaskExportPayload => {
  const rows = getDatabase()
    .prepare(
      `
        SELECT ${TASK_COLUMNS}
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
      persistent: row.persistent === 1,
      rollover: row.rollover === 1,
      completedOn: row.completed_on ?? null,
    })),
  };
};
