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
  emoji: string;
  color: string;
  color_2: string;
  volume: number;
  icon_data_url: string | null;
  file_name: string;
  grid_slot: number;
}

const SELECT_COLUMNS =
  "id, name, emoji, color, color_2, volume, icon_data_url, file_name, grid_slot";

const ICON_MAX_CHARS = 3_000_000;

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
  emoji: row.emoji,
  color: row.color,
  color2: row.color_2,
  volume: row.volume,
  iconDataUrl: row.icon_data_url || null,
  fileName: row.file_name,
  gridSlot: row.grid_slot,
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
  const icon = input.iconDataUrl;
  if (
    typeof icon === "string" &&
    (!/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(icon) ||
      icon.length > ICON_MAX_CHARS)
  ) {
    throw new Error("Imagem do som invalida (png, jpg, webp ou gif ate 2 MB).");
  }
  return {
    name,
    emoji: (input.emoji ?? "").trim().slice(0, 16),
    color,
    color2,
    volume,
    // undefined mantem a atual; null tira
    iconDataUrl: icon === undefined ? undefined : icon || null,
  };
};

export const listSounds = (): SoundItem[] => {
  const rows = getDatabase()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM sounds ORDER BY grid_slot ASC, id ASC`)
    .all() as unknown as SoundRow[];
  return rows.map(toSound);
};

export const saveSound = (input: SaveSoundInput): SoundItem => {
  const normalized = normalizeInput(input);
  const database = getDatabase();

  if (input.id !== undefined) {
    const current = selectSound(input.id);
    const fileName = input.audio ? writeAudioFile(input.audio) : current.fileName;
    const iconDataUrl =
      normalized.iconDataUrl === undefined ? current.iconDataUrl : normalized.iconDataUrl;
    database
      .prepare(
        `UPDATE sounds
         SET name = ?, emoji = ?, color = ?, color_2 = ?, volume = ?, icon_data_url = ?,
             file_name = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        normalized.name,
        normalized.emoji,
        normalized.color,
        normalized.color2,
        normalized.volume,
        iconDataUrl,
        fileName,
        input.id,
      );
    if (fileName !== current.fileName) removeAudioFile(current.fileName);
    return selectSound(input.id);
  }

  if (!input.audio) throw new Error("Escolha o arquivo de audio.");
  const occupiedSlots = new Set(listSounds().map((item) => item.gridSlot));
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
        `INSERT INTO sounds
           (name, emoji, color, color_2, volume, icon_data_url, file_name, grid_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        normalized.name,
        normalized.emoji,
        normalized.color,
        normalized.color2,
        normalized.volume,
        normalized.iconDataUrl ?? null,
        fileName,
        slot,
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

/** Move o som para o slot; se estiver ocupado, os dois trocam de lugar. */
export const placeSound = (id: number, slot: number): SoundItem[] => {
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new Error("Posicao da grid invalida.");
  }
  const sound = selectSound(id);
  const database = getDatabase();
  const occupant = database
    .prepare("SELECT id FROM sounds WHERE grid_slot = ? AND id <> ?")
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
