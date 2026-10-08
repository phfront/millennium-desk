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

/**
 * Cores do editor: a cor 1 e a segunda escolhida para combinar com ela (o degrade do nome e o
 * tom do fundo). Vieram do mock docs/mocks/sons-poster.html. A migracao 14 pintou os sons
 * antigos com elas, pela posicao na grade.
 */
export const SOUND_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#ff8a5c", "#e2416b"],
  ["#ffd166", "#f28c28"],
  ["#8c8dff", "#5a67ff"],
  ["#4cc9a0", "#1f8f7a"],
  ["#ff6fb5", "#a64dff"],
  ["#5ec8f2", "#3a6fd8"],
  ["#b4e05a", "#4caf50"],
  ["#c084fc", "#7c3aed"],
  ["#f87171", "#b91c1c"],
  ["#fbbf24", "#ef6c00"],
  ["#38bdf8", "#0e7490"],
  ["#f9a8d4", "#ec4899"],
  ["#86efac", "#16a34a"],
  ["#4a7fc8", "#6b4a6e"],
];

export const DEFAULT_SOUND_COLOR = SOUND_PALETTE[0][0];
export const DEFAULT_SOUND_COLOR2 = SOUND_PALETTE[0][1];

const hexToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = delta / (lightness > 0.5 ? 2 - max - min : max + min);
  const hue =
    max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [hue * 60, saturation, lightness];
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    const value = lightness - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

/**
 * A segunda cor de um som: a par da paleta ou, para cor escolhida a mao, a mesma puxada
 * para o vizinho mais quente, mais saturada e mais escura (como as pares da paleta).
 */
export const soundSecondColor = (color: string) => {
  const value = color.toLowerCase();
  const pair = SOUND_PALETTE.find(([first]) => first === value);
  if (pair) return pair[1];
  if (!/^#[0-9a-f]{6}$/.test(value)) return DEFAULT_SOUND_COLOR2;
  const [hue, saturation, lightness] = hexToHsl(value);
  return hslToHex(
    (hue - 18 + 360) % 360,
    Math.min(1, saturation + 0.08),
    Math.max(0.12, lightness - 0.14),
  );
};

/** Limites da grade dos Sons (o editor e o normalize usam os mesmos). */
export const SOUND_GRID_MAX_COLUMNS = 16;
export const SOUND_GRID_MAX_ROWS = 6;

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
      columns: clampInt(grid.columns, 1, SOUND_GRID_MAX_COLUMNS, defaults.grid.columns),
      rows: clampInt(grid.rows, 1, SOUND_GRID_MAX_ROWS, defaults.grid.rows),
    },
  };
};
