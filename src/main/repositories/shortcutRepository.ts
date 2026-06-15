import type {
  SaveShortcutInput,
  ShortcutItem,
  ShortcutType,
} from "../../shared/contracts";
import { getDatabase } from "../database";

interface ShortcutRow {
  id: number;
  name: string;
  type: ShortcutType;
  target: string;
  args_json: string;
  working_directory: string | null;
  color: string;
  color_2: string;
  icon_data_url: string | null;
  image_only: number;
  confirm_before_run: number;
  sort_order: number;
  grid_slot: number | null;
}

const SHORTCUT_TYPES: ShortcutType[] = [
  "app",
  "file",
  "url",
  "batch",
  "powershell",
];

const normalizeArgs = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const toShortcut = (row: ShortcutRow): ShortcutItem => {
  let args: string[] = [];
  try {
    args = normalizeArgs(JSON.parse(row.args_json));
  } catch {
    args = [];
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    target: row.target,
    args,
    workingDirectory: row.working_directory,
    color: row.color,
    color2: row.color_2 || "#5a67ff",
    iconDataUrl: row.icon_data_url,
    imageOnly: row.image_only === 1,
    confirmBeforeRun: row.confirm_before_run === 1,
    sortOrder: row.sort_order,
    gridSlot: row.grid_slot ?? row.sort_order,
  };
};

const selectShortcut = (id: number): ShortcutItem => {
  const row = getDatabase()
    .prepare(
      `SELECT id, name, type, target, args_json, working_directory, color, color_2,
              icon_data_url, image_only, confirm_before_run, sort_order, grid_slot
       FROM shortcuts WHERE id = ?`,
    )
    .get(id) as unknown as ShortcutRow | undefined;

  if (!row) throw new Error("Atalho nao encontrado.");
  return toShortcut(row);
};

const normalizeInput = (input: SaveShortcutInput) => {
  const name = input.name.trim();
  const target = input.target.trim();
  if (!name) throw new Error("Informe o nome do atalho.");
  if (!target) throw new Error("Informe o destino do atalho.");
  if (!SHORTCUT_TYPES.includes(input.type)) {
    throw new Error("Tipo de atalho invalido.");
  }
  if (input.type === "url") {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("A URL deve usar http ou https.");
    }
  }

  const color = input.color?.trim() || "#8c8dff";
  const color2 = input.color2?.trim() || "#5a67ff";
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(color2)) {
    throw new Error("Cor do atalho invalida.");
  }
  const iconDataUrl = input.iconDataUrl?.trim() || null;
  if (
    iconDataUrl &&
    !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(iconDataUrl)
  ) {
    throw new Error("Formato de imagem invalido.");
  }
  if (iconDataUrl && iconDataUrl.length > 2_500_000) {
    throw new Error("A imagem deve ter no maximo 2 MB.");
  }

  return {
    name,
    type: input.type,
    target,
    args: normalizeArgs(input.args).map((arg) => arg.trim()).filter(Boolean),
    workingDirectory: input.workingDirectory?.trim() || null,
    color,
    color2,
    iconDataUrl,
    imageOnly: Boolean(input.imageOnly && iconDataUrl),
    confirmBeforeRun: Boolean(input.confirmBeforeRun),
  };
};

export const listShortcuts = (): ShortcutItem[] => {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, type, target, args_json, working_directory, color, color_2,
              icon_data_url, image_only, confirm_before_run, sort_order, grid_slot
       FROM shortcuts ORDER BY sort_order ASC, id ASC`,
    )
    .all() as unknown as ShortcutRow[];
  return rows.map(toShortcut);
};

export const getShortcut = (id: number) => selectShortcut(id);

export const saveShortcut = (input: SaveShortcutInput): ShortcutItem => {
  const normalized = normalizeInput(input);
  const argsJson = JSON.stringify(normalized.args);
  const database = getDatabase();

  if (input.id !== undefined) {
    const result = database
      .prepare(
        `UPDATE shortcuts
         SET name = ?, type = ?, target = ?, args_json = ?,
             working_directory = ?, color = ?, color_2 = ?, icon_data_url = ?, image_only = ?,
             confirm_before_run = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        normalized.name,
        normalized.type,
        normalized.target,
        argsJson,
        normalized.workingDirectory,
        normalized.color,
        normalized.color2,
        normalized.iconDataUrl,
        normalized.imageOnly ? 1 : 0,
        normalized.confirmBeforeRun ? 1 : 0,
        input.id,
      );
    if (result.changes === 0) throw new Error("Atalho nao encontrado.");
    return selectShortcut(input.id);
  }

  const nextOrder = database
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM shortcuts")
    .get() as { value: number };
  const occupiedSlots = new Set(listShortcuts().map((item) => item.gridSlot));
  let nextSlot = 0;
  while (occupiedSlots.has(nextSlot)) nextSlot += 1;
  const result = database
    .prepare(
      `INSERT INTO shortcuts
       (name, type, target, args_json, working_directory, color, color_2, icon_data_url, image_only,
        confirm_before_run, sort_order, grid_slot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      normalized.name,
      normalized.type,
      normalized.target,
      argsJson,
      normalized.workingDirectory,
      normalized.color,
      normalized.color2,
      normalized.iconDataUrl,
      normalized.imageOnly ? 1 : 0,
      normalized.confirmBeforeRun ? 1 : 0,
      nextOrder.value,
      nextSlot,
    );
  return selectShortcut(Number(result.lastInsertRowid));
};

export const deleteShortcut = (id: number) => {
  getDatabase().prepare("DELETE FROM shortcuts WHERE id = ?").run(id);
};

export const reorderShortcuts = (ids: number[]): ShortcutItem[] => {
  const uniqueIds = [...new Set(ids.filter(Number.isSafeInteger))];
  const existing = listShortcuts();
  if (
    uniqueIds.length !== existing.length ||
    existing.some((item) => !uniqueIds.includes(item.id))
  ) {
    throw new Error("A ordem dos atalhos e invalida.");
  }

  const database = getDatabase();
  database.exec("BEGIN");
  try {
    const update = database.prepare(
      "UPDATE shortcuts SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
    );
    uniqueIds.forEach((id, index) => update.run(index, id));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return listShortcuts();
};

export const placeShortcut = (id: number, slot: number): ShortcutItem[] => {
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new Error("Posicao da grid invalida.");
  }
  const shortcut = selectShortcut(id);
  const occupant = getDatabase()
    .prepare("SELECT id FROM shortcuts WHERE grid_slot = ? AND id <> ?")
    .get(slot, id) as { id: number } | undefined;

  const database = getDatabase();
  database.exec("BEGIN");
  try {
    if (occupant) {
      database
        .prepare("UPDATE shortcuts SET grid_slot = ? WHERE id = ?")
        .run(shortcut.gridSlot, occupant.id);
    }
    database
      .prepare("UPDATE shortcuts SET grid_slot = ?, updated_at = datetime('now') WHERE id = ?")
      .run(slot, id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return listShortcuts();
};
