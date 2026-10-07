import {
  DEFAULT_SCENE_VOLUMES,
  SCENE_PALETTE,
  findDevice,
  isVirtualCable,
  resolveDevices,
  shortDeviceName,
  toDeviceRef,
  visibleApps,
  voiceStatus,
  type AudioControlSettings,
  type AudioScene,
  type AudioState,
} from "../../../shared/audioControl";
import type { SoundboardSettings } from "../../../shared/contracts";

const NEAR = 0.02;
const near = (a: number, b: number) => Math.abs(a - b) <= NEAR;

export const newSceneId = () =>
  `cena-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const voiceLabel = (route: AudioScene["voice"]) =>
  route === "cable" ? "voz + Sons" : "microfone direto";

/** "INZONE Buds - Chat · voz + Sons": o que a cena faz, para o botao e a lista. */
export const sceneSummary = (scene: AudioScene, state: AudioState) => {
  const parts: string[] = [];
  if (scene.changes.output) {
    const device = findDevice(state.outputs, scene.output);
    parts.push(device ? shortDeviceName(device) : (scene.output?.name ?? "saída?"));
  }
  if (scene.changes.voice) parts.push(voiceLabel(scene.voice));
  if (parts.length === 0 && scene.changes.dnd) parts.push(scene.dnd ? "não perturbe" : "avisos ligados");
  return parts.join(" · ") || "só volumes";
};

/**
 * A cena ainda vale? Compara so o que ela muda. Volume mexido a mao, saida trocada, voz
 * mutada: vira "ajustado" no quadradinho.
 */
export const sceneMatches = (
  scene: AudioScene | undefined,
  state: AudioState,
  settings: AudioControlSettings,
  soundboard: SoundboardSettings,
) => {
  if (!scene || !state.available) return false;
  const devices = resolveDevices(state, settings);
  const target = findDevice(state.outputs, scene.output);
  if (scene.changes.output && (!target || !target.isDefault)) return false;
  if (scene.changes.voice) {
    const voice = voiceStatus(devices);
    if (voice.route !== scene.voice || voice.muted) return false;
  }
  if (scene.changes.dnd && state.dnd.available && state.dnd.on !== scene.dnd) return false;
  if (scene.changes.volumes) {
    const output = scene.changes.output ? target : devices.defaultOutput;
    if (output && !near(output.volume, scene.volumes.output)) return false;
    if (devices.mic && !near(devices.mic.volume, scene.volumes.mic)) return false;
    if (!near(soundboard.volume, scene.volumes.sons)) return false;
    if (!near(soundboard.monitorVolume, scene.volumes.monitor)) return false;
  }
  if (scene.changes.apps) {
    for (const app of scene.apps) {
      const current = state.apps.find((item) => item.key === app.key);
      if (current && !near(current.volume, app.volume)) return false;
    }
  }
  return true;
};

export interface ApplySceneContext {
  state: AudioState;
  settings: AudioControlSettings;
  updateSoundboard: (patch: Partial<SoundboardSettings>) => Promise<void>;
}

/** Aplica a cena; devolve o que nao deu (uma frase por item) para o aviso. */
export const applyScene = async (
  scene: AudioScene,
  { state, settings, updateSoundboard }: ApplySceneContext,
): Promise<string[]> => {
  const api = window.electronControl.audio;
  const failures: string[] = [];
  const attempt = async (label: string, task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const devices = resolveDevices(state, settings);
  const target = findDevice(state.outputs, scene.output);

  if (scene.changes.output) {
    if (!target) failures.push(`Saída "${scene.output?.name ?? "?"}" não está conectada`);
    else if (!target.isDefault) await attempt("Saída", () => api.setDefault(target.id));
  }
  if (scene.changes.voice) {
    await attempt("Microfone", () => api.setVoice(scene.voice));
  }
  if (scene.changes.volumes) {
    const output = scene.changes.output ? target : devices.defaultOutput;
    if (output) {
      await attempt("Volume da saída", () => api.setVolume(output.id, scene.volumes.output));
    }
    const mic = devices.mic;
    if (mic) {
      await attempt("Volume do microfone", () => api.setVolume(mic.id, scene.volumes.mic));
    }
    await attempt("Volumes dos Sons", () =>
      updateSoundboard({ volume: scene.volumes.sons, monitorVolume: scene.volumes.monitor }),
    );
  }
  if (scene.changes.apps) {
    for (const app of scene.apps) {
      // App fechado nao e erro: a cena so ajusta quem esta aberto
      if (!state.apps.some((item) => item.key === app.key)) continue;
      await attempt(app.name, () => api.setAppVolume(app.key, app.volume));
    }
  }
  if (scene.changes.dnd && state.dnd.available) {
    await attempt("Não perturbe", () => api.setDnd(scene.dnd));
  }
  return failures;
};

/** Valores de uma cena tirados do que esta valendo agora. */
export const captureScene = (
  scene: AudioScene,
  state: AudioState,
  settings: AudioControlSettings,
  soundboard: SoundboardSettings,
): AudioScene => {
  const devices = resolveDevices(state, settings);
  const output =
    devices.defaultOutput && !isVirtualCable(devices.defaultOutput)
      ? toDeviceRef(devices.defaultOutput)
      : scene.output;
  const voice = voiceStatus(devices);
  return {
    ...scene,
    output,
    voice: voice.route,
    volumes: {
      output: devices.defaultOutput?.volume ?? scene.volumes.output,
      mic: devices.mic?.volume ?? scene.volumes.mic,
      sons: soundboard.volume,
      monitor: soundboard.monitorVolume,
    },
    apps: scene.apps.map((app) => {
      const current = state.apps.find((item) => item.key === app.key);
      return current ? { ...app, volume: current.volume } : app;
    }),
    dnd: state.dnd.available ? state.dnd.on : scene.dnd,
  };
};

export const blankScene = (
  index: number,
  state: AudioState,
  settings: AudioControlSettings,
  soundboard: SoundboardSettings,
): AudioScene => {
  const [color, color2] = SCENE_PALETTE[index % SCENE_PALETTE.length];
  return captureScene(
    {
      id: newSceneId(),
      name: "Nova cena",
      emoji: "✨",
      color,
      color2,
      changes: { output: true, voice: true, volumes: false, apps: false, dnd: false },
      output: null,
      voice: "direct",
      volumes: DEFAULT_SCENE_VOLUMES,
      apps: [],
      dnd: false,
    },
    state,
    settings,
    soundboard,
  );
};

/** As duas cenas sugeridas: Reuniao (fone, voz + Sons, Nao perturbe) e Dia a dia. */
export const suggestedScenes = (
  state: AudioState,
  settings: AudioControlSettings,
  soundboard: SoundboardSettings,
): AudioScene[] => {
  const devices = resolveDevices(state, settings);
  const physical = state.outputs.filter((device) => !isVirtualCable(device));
  const headset =
    physical.find((device) => /chat|headset|fone/i.test(device.name)) ??
    (devices.defaultOutput && !isVirtualCable(devices.defaultOutput)
      ? devices.defaultOutput
      : physical[0]);
  // Caixa de som: "Speakers (INZONE Buds - Game)" tambem e fone, entao fone fica de fora
  const notHeadset = physical.filter(
    (device) => device !== headset && !/buds|headset|headphone|fone|earphone/i.test(device.name),
  );
  const speakers =
    notHeadset.find((device) => /realtek/i.test(device.driver)) ??
    notHeadset.find((device) => /speakers|alto-falante/i.test(device.name)) ??
    headset;
  const volumes = {
    output: headset?.volume ?? DEFAULT_SCENE_VOLUMES.output,
    mic: devices.mic?.volume ?? DEFAULT_SCENE_VOLUMES.mic,
    sons: soundboard.volume,
    monitor: soundboard.monitorVolume,
  };
  const hasCable = Boolean(devices.cableInput && devices.cableOutput);
  return [
    {
      id: newSceneId(),
      name: "Reunião",
      emoji: "🎧",
      color: SCENE_PALETTE[0][0],
      color2: SCENE_PALETTE[0][1],
      changes: { output: Boolean(headset), voice: true, volumes: false, apps: false, dnd: true },
      output: headset ? toDeviceRef(headset) : null,
      voice: hasCable ? "cable" : "direct",
      volumes,
      apps: [],
      dnd: true,
    },
    {
      id: newSceneId(),
      name: "Dia a dia",
      emoji: "☕",
      color: SCENE_PALETTE[2][0],
      color2: SCENE_PALETTE[2][1],
      changes: { output: Boolean(speakers), voice: true, volumes: false, apps: false, dnd: true },
      output: speakers ? toDeviceRef(speakers) : null,
      voice: "direct",
      volumes: { ...volumes, output: speakers?.volume ?? volumes.output },
      apps: [],
      dnd: false,
    },
  ];
};

export const appsForScene = (state: AudioState) =>
  visibleApps(state.apps).filter((app) => app.key !== "millennium-desk" && app.key !== "electron");
