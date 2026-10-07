import {
  EMPTY_AUDIO_STATE,
  resolveDevices,
  voiceStatus,
  DEFAULT_AUDIO_CONTROL_SETTINGS,
  type AudioState,
} from "../shared/audioControl";
import type { ElectronControlApi } from "../shared/contracts";

// Audio falso do modo navegador (npm run renderer:dev): os aparelhos de um PC com fone,
// caixa, microfone e o VB-Cable renomeado para "Reuniao", mudando de verdade nas chamadas.

const CABLE_OUT = "{0.0.0}.{cable-out}";
const CABLE_IN = "{0.0.1}.{cable-in}";
const MIC = "{0.0.1}.{me6s}";

export const createBrowserAudio = (): ElectronControlApi["audio"] => {
  const state: AudioState = {
    ...EMPTY_AUDIO_STATE,
    available: true,
    outputs: [
      { id: "{0.0.0}.{chat}", name: "Headset Earphone (INZONE Buds - Chat)", driver: "INZONE Buds - Chat", isDefault: true, isDefaultComm: true, volume: 0.16, muted: false },
      { id: "{0.0.0}.{game}", name: "Speakers (INZONE Buds - Game)", driver: "INZONE Buds - Game", isDefault: false, isDefaultComm: false, volume: 0.18, muted: false },
      { id: "{0.0.0}.{realtek}", name: "Speakers (Realtek(R) Audio)", driver: "Realtek(R) Audio", isDefault: false, isDefaultComm: false, volume: 0.24, muted: false },
      { id: "{0.0.0}.{nvidia}", name: "DigitalOutput (NVIDIA High Definition Audio)", driver: "NVIDIA High Definition Audio", isDefault: false, isDefaultComm: false, volume: 0.66, muted: false },
      { id: "{0.0.0}.{cable16}", name: "CABLE In 16ch (VB-Audio Virtual Cable)", driver: "VB-Audio Virtual Cable", isDefault: false, isDefaultComm: false, volume: 1, muted: false },
      { id: CABLE_OUT, name: "Reunião (VB-Audio Virtual Cable)", driver: "VB-Audio Virtual Cable", isDefault: false, isDefaultComm: false, volume: 1, muted: false },
    ],
    inputs: [
      { id: CABLE_IN, name: "Reunião (VB-Audio Virtual Cable)", driver: "VB-Audio Virtual Cable", isDefault: true, isDefaultComm: false, volume: 0.27, muted: false, listen: false, listenTarget: "" },
      { id: MIC, name: "Microphone (2- ME6S)", driver: "2- ME6S", isDefault: false, isDefaultComm: true, volume: 0.98, muted: false, listen: true, listenTarget: CABLE_OUT },
    ],
    apps: [
      { key: "spotify", name: "Spotify", volume: 0.45, muted: false, active: true },
      { key: "msedge", name: "Microsoft Edge", volume: 0.7, muted: false, active: false },
      { key: "ms-teams", name: "Microsoft Teams", volume: 1, muted: false, active: false },
      { key: "millennium-desk", name: "Millennium Desk", volume: 1, muted: false, active: true },
    ],
    dnd: { available: true, on: false },
    ducking: true,
  };
  const listeners = new Set<() => void>();
  const changed = () => setTimeout(() => listeners.forEach((listener) => listener()), 30);
  const device = (id: string) =>
    [...state.outputs, ...state.inputs].find((item) => item.id === id);

  const setDefault = (id: string) => {
    const list = state.outputs.some((item) => item.id === id) ? state.outputs : state.inputs;
    for (const item of list) {
      item.isDefault = item.id === id;
      item.isDefaultComm = item.id === id;
    }
  };

  return {
    getState: async () => structuredClone(state),
    setDefault: async (id) => {
      setDefault(id);
      changed();
    },
    setVolume: async (id, volume) => {
      const target = device(id);
      if (target) target.volume = volume;
    },
    setMute: async (id, muted) => {
      const target = device(id);
      if (target) target.muted = muted;
      changed();
    },
    setAppVolume: async (key, volume) => {
      const app = state.apps.find((item) => item.key === key);
      if (!app) throw new Error("o app não está tocando nada agora");
      app.volume = volume;
    },
    setAppMute: async (key, muted) => {
      const app = state.apps.find((item) => item.key === key);
      if (app) app.muted = muted;
    },
    setDnd: async (on) => {
      state.dnd.on = on;
    },
    setDucking: async (on) => {
      state.ducking = on;
    },
    setVoice: async (route) => {
      const mic = device(MIC)!;
      if (route === "cable") {
        setDefault(CABLE_IN);
        mic.listen = true;
        mic.listenTarget = CABLE_OUT;
      } else {
        setDefault(MIC);
        mic.listen = false;
      }
      mic.muted = false;
      changed();
    },
    toggleMute: async () => {
      const devices = resolveDevices(state, DEFAULT_AUDIO_CONTROL_SETTINGS);
      const voice = voiceStatus(devices);
      const mic = device(MIC)!;
      if (voice.route === "cable") mic.listen = voice.muted;
      else mic.muted = !voice.muted;
      changed();
      return { route: voice.route, muted: !voice.muted };
    },
    syncHotkeys: async () => ({ open: true, mute: true }),
    onChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    onHotkey: () => () => undefined,
  };
};
