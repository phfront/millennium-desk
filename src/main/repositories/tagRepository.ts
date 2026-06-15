import type {
  CreateTagInput,
  TaskTag,
  UpdateTagInput,
} from "../../shared/contracts";
import { getDatabase } from "../database";

interface TagRow {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

const toTag = (row: TagRow): TaskTag => ({
  id: row.id,
  name: row.name,
  color: row.color,
});

export const listTags = (): TaskTag[] => {
  const rows = getDatabase()
    .prepare("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")
    .all() as unknown as TagRow[];

  return rows.map(toTag);
};

export const createTag = (input: CreateTagInput): TaskTag => {
  const name = input.name.trim();
  if (!name) {
    throw new Error("O nome da tag nao pode ficar vazio.");
  }

  const color = input.color.trim();
  if (!color) {
    throw new Error("A cor da tag e obrigatoria.");
  }

  const existing = getDatabase()
    .prepare("SELECT id FROM tags WHERE lower(name) = lower(?)")
    .get(name) as { id: number } | undefined;

  if (existing) {
    throw new Error(`A tag "${name}" ja existe.`);
  }

  const result = getDatabase()
    .prepare("INSERT INTO tags (name, color) VALUES (?, ?)")
    .run(name, color);

  const row = getDatabase()
    .prepare("SELECT id, name, color, created_at FROM tags WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as unknown as TagRow;

  return toTag(row);
};

export const updateTag = (input: UpdateTagInput): TaskTag => {
  const name = input.name.trim();
  if (!name) {
    throw new Error("O nome da tag nao pode ficar vazio.");
  }

  const color = input.color.trim();
  if (!color) {
    throw new Error("A cor da tag e obrigatoria.");
  }

  const existing = getDatabase()
    .prepare("SELECT id FROM tags WHERE lower(name) = lower(?) AND id <> ?")
    .get(name, input.id) as { id: number } | undefined;

  if (existing) {
    throw new Error(`A tag "${name}" ja existe.`);
  }

  const result = getDatabase()
    .prepare("UPDATE tags SET name = ?, color = ? WHERE id = ?")
    .run(name, color, input.id);

  if (result.changes === 0) {
    throw new Error("Tag nao encontrada.");
  }

  const row = getDatabase()
    .prepare("SELECT id, name, color, created_at FROM tags WHERE id = ?")
    .get(input.id) as unknown as TagRow;

  return toTag(row);
};

export const deleteTag = (id: number) => {
  getDatabase().prepare("DELETE FROM tags WHERE id = ?").run(id);
};

export const getTagIdsForTasks = (taskIds: number[]): Map<number, number[]> => {
  const map = new Map<number, number[]>();
  if (taskIds.length === 0) return map;

  for (const taskId of taskIds) {
    map.set(taskId, []);
  }

  const placeholders = taskIds.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `SELECT task_id, tag_id FROM task_tags WHERE task_id IN (${placeholders})`,
    )
    .all(...taskIds) as { task_id: number; tag_id: number }[];

  for (const row of rows) {
    map.get(row.task_id)?.push(row.tag_id);
  }

  return map;
};

export const setTaskTags = (taskId: number, tagIds: number[]) => {
  const database = getDatabase();
  const uniqueTagIds = [...new Set(tagIds)];

  if (uniqueTagIds.length > 0) {
    const placeholders = uniqueTagIds.map(() => "?").join(", ");
    const found = database
      .prepare(`SELECT id FROM tags WHERE id IN (${placeholders})`)
      .all(...uniqueTagIds) as { id: number }[];

    if (found.length !== uniqueTagIds.length) {
      throw new Error("Uma ou mais tags selecionadas nao existem.");
    }
  }

  database.prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);

  const insert = database.prepare(
    "INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)",
  );

  for (const tagId of uniqueTagIds) {
    insert.run(taskId, tagId);
  }
};
