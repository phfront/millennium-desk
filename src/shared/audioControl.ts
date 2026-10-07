// Cenas e Controle de audio: o Desk troca saida, microfone, "Escutar este dispositivo",
// volumes e o Nao perturbe do Windows pelo ajudante nativo (src/main/audio/deskAudio.cs).
// Ver docs/controle-plano.md.

/** Aparelho de audio como o ajudante devolve. */
export interface AudioDevice {
  id: string;
  /** Nome do painel de Som ("Reunião (VB-Audio Virtual Cable)"). */
  name: string;
  /** Nome do driver; nao muda quando o aparelho e renomeado ("VB-Audio Virtual Cable"). */
  driver: string;
  /** Padrao do Windows (console/multimidia). */
  isDefault: boolean;
  /** Padrao de comunicacoes. */
  isDefaultComm: boolean;
  /** Volume do aparelho, de 0 a 1. */
  volume: number;
  muted: boolean;
  /** So microfones: "Escutar este dispositivo" ligado. */
  listen?: boolean;
  /** So microfones: id da saida em que o "Escutar" toca (vazio = padrao). */
  listenTarget?: string;
}

/** Programa com som (todas as sessoes dele, em qualquer saida). */
export interface AudioApp {
  /** Nome do processo em minusculas ("spotify", "msedge"). */
  key: string;
  /** Descricao do executavel ("Spotify", "Microsoft Edge"). */
  name: string;
  volume: number;
  muted: boolean;
  /** Tocando agora (sessao ativa). */
  active: boolean;
}

export interface AudioState {
  /** Falso fora do Windows ou se o ajudante nao subiu (error diz por que). */
  available: boolean;
  error?: string;
  outputs: AudioDevice[];
  inputs: AudioDevice[];
  apps: AudioApp[];
  dnd: { available: boolean; on: boolean };
  /** "Abaixar os outros sons durante chamadas" (aba Comunicacoes do painel de Som). */
  ducking: boolean;
}

export const EMPTY_AUDIO_STATE: AudioState = {
  available: false,
  outputs: [],
  inputs: [],
  apps: [],
  dnd: { available: false, on: false },
  ducking: true,
};

/** Referencia a um aparelho: o id muda as vezes (driver reinstalado), o nome ajuda a reachar. */
export interface AudioDeviceRef {
  id: string;
  name: string;
}

/**
 * cable: o microfone padrao e o cabo virtual e o "Escutar" do microfone toca nele; a reuniao
 * ouve a voz e os Sons do Desk. direct: o microfone padrao e o fisico, sem "Escutar".
 */
export type VoiceRoute = "cable" | "direct";

export interface AudioSceneChanges {
  output: boolean;
  voice: boolean;
  volumes: boolean;
  apps: boolean;
  dnd: boolean;
}

export interface AudioSceneVolumes {
  /** Volume da saida (a da cena, ou a padrao se a cena nao troca a saida). */
  output: number;
  /** Volume do microfone fisico. */
  mic: number;
  /** Sons do Desk no cabo (soundboard.volume). */
  sons: number;
  /** Retorno dos Sons no fone (soundboard.monitorVolume). */
  monitor: number;
}

export interface AudioSceneApp {
  key: string;
  name: string;
  volume: number;
}

export interface AudioScene {
  id: string;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  /** O que a cena muda; o resto fica como esta. */
  changes: AudioSceneChanges;
  output: AudioDeviceRef | null;
  voice: VoiceRoute;
  volumes: AudioSceneVolumes;
  apps: AudioSceneApp[];
  dnd: boolean;
}

export interface AudioControlSettings {
  scenes: AudioScene[];
  /** Ultima cena aplicada (o quadradinho compara com o estado para mostrar "ajustado"). */
  activeSceneId: string | null;
  /** Microfone fisico; null escolhe sozinho (o primeiro que nao e cabo virtual). */
  mic: AudioDeviceRef | null;
  /** Atalhos globais (accelerator do Electron); vazio desliga. */
  hotkeys: { open: string; mute: string };
  warnings: {
    /** Avisar quando a saida padrao vira o cabo virtual. */
    cableOutput: boolean;
    /** Avisar quando o microfone padrao fica no cabo e a cena ativa e "direto". */
    micStuck: boolean;
  };
  /** As duas cenas sugeridas ja foram criadas (para nao recriar depois de apagadas). */
  seeded: boolean;
}

export const SCENE_PALETTE: Array<[string, string]> = [
  ["#e0568f", "#f0a35e"],
  ["#5b5cf0", "#a78bfa"],
  ["#1f9d74", "#5fd4a0"],
  ["#3b82c4", "#6cc0f0"],
  ["#d9534f", "#f08a5d"],
  ["#8a5cd6", "#d07cf0"],
];

export const DEFAULT_SCENE_VOLUMES: AudioSceneVolumes = {
  output: 0.5,
  mic: 0.9,
  sons: 1,
  monitor: 0.6,
};

export const DEFAULT_AUDIO_CONTROL_SETTINGS: AudioControlSettings = {
  scenes: [],
  activeSceneId: null,
  mic: null,
  hotkeys: { open: "Control+Alt+A", mute: "Control+Alt+M" },
  warnings: { cableOutput: true, micStuck: true },
  seeded: false,
};

/** Quantas cenas cabem no quadradinho. */
export const SCENES_IN_CARD = 4;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const unit = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const color = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const deviceRef = (value: unknown): AudioDeviceRef | null =>
  isObject(value) && typeof value.id === "string" && typeof value.name === "string"
    ? { id: value.id, name: value.name }
    : null;

const normalizeScene = (value: unknown, index: number): AudioScene | null => {
  if (!isObject(value)) return null;
  const id = text(value.id).trim();
  if (!id) return null;
  const changes = isObject(value.changes) ? value.changes : {};
  const volumes = isObject(value.volumes) ? value.volumes : {};
  const [c1, c2] = SCENE_PALETTE[index % SCENE_PALETTE.length];
  return {
    id,
    name: text(value.name).trim().slice(0, 40) || "Cena",
    emoji: text(value.emoji).trim().slice(0, 16),
    color: color(value.color, c1),
    color2: color(value.color2, c2),
    changes: {
      output: bool(changes.output, true),
      voice: bool(changes.voice, true),
      volumes: bool(changes.volumes, false),
      apps: bool(changes.apps, false),
      dnd: bool(changes.dnd, false),
    },
    output: deviceRef(value.output),
    voice: value.voice === "direct" ? "direct" : "cable",
    volumes: {
      output: unit(volumes.output, DEFAULT_SCENE_VOLUMES.output),
      mic: unit(volumes.mic, DEFAULT_SCENE_VOLUMES.mic),
      sons: unit(volumes.sons, DEFAULT_SCENE_VOLUMES.sons),
      monitor: unit(volumes.monitor, DEFAULT_SCENE_VOLUMES.monitor),
    },
    apps: Array.isArray(value.apps)
      ? value.apps
          .filter(isObject)
          .filter((app) => typeof app.key === "string" && app.key)
          .map((app) => ({
            key: String(app.key),
            name: text(app.name, String(app.key)),
            volume: unit(app.volume, 1),
          }))
      : [],
    dnd: bool(value.dnd, false),
  };
};

export const normalizeAudioControlSettings = (value: unknown): AudioControlSettings => {
  const raw = isObject(value) ? value : {};
  const defaults = DEFAULT_AUDIO_CONTROL_SETTINGS;
  const hotkeys = isObject(raw.hotkeys) ? raw.hotkeys : {};
  const warnings = isObject(raw.warnings) ? raw.warnings : {};
  const seen = new Set<string>();
  const scenes = (Array.isArray(raw.scenes) ? raw.scenes : [])
    .map(normalizeScene)
    .filter((scene): scene is AudioScene => {
      if (!scene || seen.has(scene.id)) return false;
      seen.add(scene.id);
      return true;
    });
  const activeSceneId = text(raw.activeSceneId);
  return {
    scenes,
    activeSceneId: seen.has(activeSceneId) ? activeSceneId : null,
    mic: deviceRef(raw.mic),
    hotkeys: {
      open: text(hotkeys.open, defaults.hotkeys.open),
      mute: text(hotkeys.mute, defaults.hotkeys.mute),
    },
    warnings: {
      cableOutput: bool(warnings.cableOutput, defaults.warnings.cableOutput),
      micStuck: bool(warnings.micStuck, defaults.warnings.micStuck),
    },
    seeded: bool(raw.seeded, false),
  };
};

// ---------- aparelhos ----------

/** Cabo virtual da VB-Audio (o principal, o A/B, o Hi-Fi...): pelo driver, nao pelo nome. */
export const isVirtualCable = (device: AudioDevice) => /vb-audio/i.test(device.driver);

/** Driver do cabo da reuniao: o VB-CABLE de sempre (o A/B ficam para outros usos, como o ditado). */
const MEETING_CABLE_DRIVER = /^vb-audio virtual cable$/i;

export const findDevice = (
  devices: AudioDevice[],
  ref: AudioDeviceRef | null | undefined,
) =>
  ref
    ? (devices.find((device) => device.id === ref.id) ??
      devices.find((device) => device.name === ref.name))
    : undefined;

export const toDeviceRef = (device: AudioDevice): AudioDeviceRef => ({
  id: device.id,
  name: device.name,
});

/** Tira o "(driver)" do nome: "Headset Earphone (INZONE Buds - Chat)" vira o que esta dentro. */
/** Separa o "(...)" do fim do nome, com parenteses dentro: "Speakers (Realtek(R) Audio)". */
const splitTrailingParen = (name: string): [string, string | undefined] => {
  const trimmed = name.trim();
  if (!trimmed.endsWith(")")) return [trimmed, undefined];
  let depth = 0;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    if (trimmed[index] === ")") depth += 1;
    else if (trimmed[index] === "(") depth -= 1;
    if (depth === 0) {
      return [trimmed.slice(0, index).trim(), trimmed.slice(index + 1, -1).trim()];
    }
  }
  return [trimmed, undefined];
};

export const shortDeviceName = (device: AudioDevice | undefined | null) => {
  if (!device) return "";
  const [outside, inside] = splitTrailingParen(device.name);
  if (isVirtualCable(device)) return outside || device.name;
  // "Speakers (Realtek(R) Audio)": o de dentro e o driver, o de fora diz o que e
  if (inside && /^(speakers|alto-falantes|headphones|fones de ouvido|headset earphone|microphone|microfone)$/i.test(outside)) {
    return inside;
  }
  return outside || inside || device.name;
};

export interface ResolvedDevices {
  /** Microfone fisico. */
  mic?: AudioDevice;
  /** Saida do cabo da reuniao (onde o "Escutar" e os Sons tocam). */
  cableOutput?: AudioDevice;
  /** Microfone do cabo da reuniao (o que o Teams/Meet ouve). */
  cableInput?: AudioDevice;
  defaultOutput?: AudioDevice;
  defaultInput?: AudioDevice;
}

export const resolveDevices = (
  state: AudioState,
  settings: AudioControlSettings,
): ResolvedDevices => {
  const physicalInputs = state.inputs.filter((device) => !isVirtualCable(device));
  const mic =
    findDevice(physicalInputs, settings.mic) ??
    physicalInputs.find((device) => device.isDefaultComm) ??
    physicalInputs.find((device) => device.isDefault) ??
    physicalInputs[0];
  const cableOutputs = state.outputs.filter(
    (device) => isVirtualCable(device) && !/16ch/i.test(device.name),
  );
  const cableOutput =
    cableOutputs.find((device) => device.id === mic?.listenTarget) ??
    cableOutputs.find((device) => MEETING_CABLE_DRIVER.test(device.driver)) ??
    cableOutputs[0];
  const cableInput =
    state.inputs.find(
      (device) => isVirtualCable(device) && device.driver === cableOutput?.driver,
    ) ?? state.inputs.find((device) => MEETING_CABLE_DRIVER.test(device.driver));
  return {
    mic,
    cableOutput,
    cableInput,
    defaultOutput: state.outputs.find((device) => device.isDefault),
    defaultInput: state.inputs.find((device) => device.isDefault),
  };
};

export interface VoiceStatus {
  route: VoiceRoute;
  /** A reuniao nao ouve a voz: "Escutar" desligado (cabo) ou microfone mutado (direto). */
  muted: boolean;
}

export const voiceStatus = (devices: ResolvedDevices): VoiceStatus => {
  const route: VoiceRoute =
    devices.cableInput && devices.defaultInput?.id === devices.cableInput.id
      ? "cable"
      : "direct";
  const micMuted = Boolean(devices.mic?.muted);
  return {
    route,
    muted: route === "cable" ? !devices.mic?.listen || micMuted : micMuted,
  };
};

/** Processos que nao sao "apps" para o usuario. */
const HIDDEN_APPS = new Set(["svchost", "audiodg", "explorer", "chrome-headless-shell"]);

export const visibleApps = (apps: AudioApp[]) =>
  apps.filter((app) => !HIDDEN_APPS.has(app.key));
