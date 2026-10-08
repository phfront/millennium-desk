import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  SaveSoundInput,
  SoundAudioData,
  SoundAudioUpload,
  SoundItem,
} from "../../shared/contracts";
import {
  DEFAULT_SOUND_COLOR,
  DEFAULT_SOUND_COLOR2,
  SOUND_AUDIO_EXTENSIONS,
  SOUND_MAX_BYTES,
} from "../../shared/soundboard";
import { getConfiguredUserDataPath } from "../appPaths";
import { getDatabase } from "../database";

interface SoundRow {
  id: number;
  name: string;
  color: string;
  color_2: string;
  volume: number;
  file_name: string;
  grid_slot: number;
  active: number;
}

const SELECT_COLUMNS =
  "id, name, color, color_2, volume, file_name, grid_slot, active";

const getSoundsDir = () => path.join(getConfiguredUserDataPath(), "sounds");

/** So nomes gerados aqui: nada de caminho vindo de fora apontando para fora da pasta. */
const resolveSoundFile = (fileName: string) => {
  const base = path.basename(fileName);
  if (base !== fileName) throw new Error("Arquivo de som invalido.");
  return path.join(getSoundsDir(), base);
};

const toSound = (row: SoundRow): SoundItem => ({
  id: row.id,
  name: row.name,
  color: row.color,
  color2: row.color_2,
  volume: row.volume,
  fileName: row.file_name,
  gridSlot: row.grid_slot,
  active: row.active === 1,
});

const selectSound = (id: number): SoundItem => {
  const row = getDatabase()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM sounds WHERE id = ?`)
    .get(id) as unknown as SoundRow | undefined;
  if (!row) throw new Error("Som nao encontrado.");
  return toSound(row);
};

const writeAudioFile = (audio: SoundAudioUpload) => {
  const extension = String(audio.extension ?? "").toLowerCase().replace(/^\./, "");
  if (!SOUND_AUDIO_EXTENSIONS[extension]) {
    throw new Error("Formato de audio nao suportado.");
  }
  const bytes = audio.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error("Arquivo de audio vazio.");
  }
  if (bytes.byteLength > SOUND_MAX_BYTES) {
    throw new Error("O audio deve ter no maximo 20 MB.");
  }
  fs.mkdirSync(getSoundsDir(), { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  fs.writeFileSync(resolveSoundFile(fileName), bytes);
  return fileName;
};

const removeAudioFile = (fileName: string) => {
  try {
    fs.rmSync(resolveSoundFile(fileName), { force: true });
  } catch {
    // Arquivo orfao nao atrapalha: o registro ja saiu do banco.
  }
};

const normalizeInput = (input: SaveSoundInput) => {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome do som.");
  const color = input.color?.trim() || DEFAULT_SOUND_COLOR;
  const color2 = input.color2?.trim() || DEFAULT_SOUND_COLOR2;
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(color2)) {
    throw new Error("Cor do som invalida.");
  }
  const volume =
    typeof input.volume === "number" && Number.isFinite(input.volume)
      ? Math.min(1, Math.max(0, input.volume))
      : 1;
  return { name, color, color2, volume };
};

export const listSounds = (): SoundItem[] => {
  const rows = getDatabase()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM sounds ORDER BY active DESC, grid_slot ASC, id ASC`,
    )
    .all() as unknown as SoundRow[];
  return rows.map(toSound);
};

export const saveSound = (input: SaveSoundInput): SoundItem => {
  const normalized = normalizeInput(input);
  const database = getDatabase();

  if (input.id !== undefined) {
    const current = selectSound(input.id);
    const fileName = input.audio ? writeAudioFile(input.audio) : current.fileName;
    database
      .prepare(
        `UPDATE sounds
         SET name = ?, color = ?, color_2 = ?, volume = ?, file_name = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        normalized.name,
        normalized.color,
        normalized.color2,
        normalized.volume,
        fileName,
        input.id,
      );
    if (fileName !== current.fileName) removeAudioFile(current.fileName);
    return selectSound(input.id);
  }

  if (!input.audio) throw new Error("Escolha o arquivo de audio.");
  const active = input.active !== false;
  const occupiedSlots = active ? occupiedGridSlots() : new Set<number>();
  let slot = 0;
  if (
    input.gridSlot !== undefined &&
    Number.isInteger(input.gridSlot) &&
    input.gridSlot >= 0 &&
    !occupiedSlots.has(input.gridSlot)
  ) {
    slot = input.gridSlot;
  } else {
    while (occupiedSlots.has(slot)) slot += 1;
  }

  const fileName = writeAudioFile(input.audio);
  try {
    const result = database
      .prepare(
        `INSERT INTO sounds (name, color, color_2, volume, file_name, grid_slot, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        normalized.name,
        normalized.color,
        normalized.color2,
        normalized.volume,
        fileName,
        slot,
        active ? 1 : 0,
      );
    return selectSound(Number(result.lastInsertRowid));
  } catch (error) {
    removeAudioFile(fileName);
    throw error;
  }
};

export const deleteSound = (id: number) => {
  const sound = selectSound(id);
  getDatabase().prepare("DELETE FROM sounds WHERE id = ?").run(id);
  removeAudioFile(sound.fileName);
};

const occupiedGridSlots = (exceptId?: number) =>
  new Set(
    listSounds()
      .filter((item) => item.active && item.id !== exceptId)
      .map((item) => item.gridSlot),
  );

/**
 * Liga o som na grade (no slot dado, que precisa estar livre, ou no primeiro livre) ou tira
 * ele da grade. Fora da grade, grid_slot guarda o ultimo lugar.
 */
export const setSoundActive = (
  id: number,
  active: boolean,
  slot?: number,
): SoundItem[] => {
  const sound = selectSound(id);
  const database = getDatabase();
  if (!active) {
    database
      .prepare("UPDATE sounds SET active = 0, updated_at = datetime('now') WHERE id = ?")
      .run(id);
    return listSounds();
  }
  const occupied = occupiedGridSlots(id);
  let target: number;
  if (slot !== undefined) {
    if (!Number.isSafeInteger(slot) || slot < 0) {
      throw new Error("Posicao da grid invalida.");
    }
    if (occupied.has(slot)) throw new Error("Esse lugar da grade ja esta ocupado.");
    target = slot;
  } else {
    target = sound.active ? sound.gridSlot : 0;
    if (!sound.active) while (occupied.has(target)) target += 1;
  }
  database
    .prepare(
      "UPDATE sounds SET active = 1, grid_slot = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(target, id);
  return listSounds();
};

/** Move o som para o slot; se estiver ocupado, os dois trocam de lugar. */
export const placeSound = (id: number, slot: number): SoundItem[] => {
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new Error("Posicao da grid invalida.");
  }
  const sound = selectSound(id);
  // Som do catalogo nao tem lugar para dar ao ocupante: so entra em slot livre
  if (!sound.active) return setSoundActive(id, true, slot);
  const database = getDatabase();
  const occupant = database
    .prepare("SELECT id FROM sounds WHERE grid_slot = ? AND id <> ? AND active = 1")
    .get(slot, id) as { id: number } | undefined;

  database.exec("BEGIN");
  try {
    if (occupant) {
      database
        .prepare("UPDATE sounds SET grid_slot = ? WHERE id = ?")
        .run(sound.gridSlot, occupant.id);
    }
    database
      .prepare("UPDATE sounds SET grid_slot = ?, updated_at = datetime('now') WHERE id = ?")
      .run(slot, id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return listSounds();
};

export const readSoundAudio = (id: number): SoundAudioData => {
  const sound = selectSound(id);
  const extension = path.extname(sound.fileName).slice(1).toLowerCase();
  return {
    bytes: fs.readFileSync(resolveSoundFile(sound.fileName)),
    mimeType: SOUND_AUDIO_EXTENSIONS[extension] ?? "application/octet-stream",
  };
};
