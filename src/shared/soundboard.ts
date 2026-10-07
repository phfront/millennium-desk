import type { SoundboardSettings } from "./contracts";

// Sons: o Desk toca na saida do cabo virtual (VB-Cable), que chega aos apps de reuniao
// como microfone. A voz entra no cabo pelo Windows ("Escutar este dispositivo").
// Ver docs/soundboard-plano.md.

export const SOUND_AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  webm: "audio/webm",
};

export const SOUND_MAX_BYTES = 20 * 1024 * 1024;

export const DEFAULT_SOUND_COLOR = "#f08a4b";
export const DEFAULT_SOUND_COLOR2 = "#e15f9a";

export const DEFAULT_SOUNDBOARD_SETTINGS: SoundboardSettings = {
  outputDeviceId: "",
  outputDeviceLabel: "",
  monitorEnabled: true,
  monitorDeviceId: "",
  monitorDeviceLabel: "",
  volume: 1,
  monitorVolume: 0.6,
  grid: { columns: 4, rows: 2 },
};

const clampUnit = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

const clampInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const normalizeSoundboardSettings = (value: unknown): SoundboardSettings => {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<SoundboardSettings>;
  const grid = (raw.grid && typeof raw.grid === "object" ? raw.grid : {}) as Partial<
    SoundboardSettings["grid"]
  >;
  const defaults = DEFAULT_SOUNDBOARD_SETTINGS;
  return {
    outputDeviceId: text(raw.outputDeviceId),
    outputDeviceLabel: text(raw.outputDeviceLabel),
    monitorEnabled:
      typeof raw.monitorEnabled === "boolean" ? raw.monitorEnabled : defaults.monitorEnabled,
    monitorDeviceId: text(raw.monitorDeviceId),
    monitorDeviceLabel: text(raw.monitorDeviceLabel),
    volume: clampUnit(raw.volume, defaults.volume),
    monitorVolume: clampUnit(raw.monitorVolume, defaults.monitorVolume),
    grid: {
      columns: clampInt(grid.columns, 1, 8, defaults.grid.columns),
      rows: clampInt(grid.rows, 1, 6, defaults.grid.rows),
    },
  };
};
