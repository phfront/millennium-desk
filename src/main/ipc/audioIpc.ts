import { BrowserWindow, globalShortcut, ipcMain } from "electron";
import type {
  AudioHotkeyAction,
  AudioHotkeyEvent,
} from "../../shared/contracts";
import {
  EMPTY_AUDIO_STATE,
  resolveDevices,
  voiceStatus,
  type AudioState,
  type VoiceRoute,
  type VoiceStatus,
} from "../../shared/audioControl";
import {
  callDeskAudio,
  onDeskAudioChanged,
  stopDeskAudio,
} from "../audio/deskAudioHelper";
import { logError } from "../logs/logger";
import { getSettings } from "../settings/store";

type RawState = Omit<AudioState, "available" | "error">;

const readState = async (): Promise<AudioState> => {
  try {
    const raw = await callDeskAudio<RawState>("state");
    return {
      ...EMPTY_AUDIO_STATE,
      ...raw,
      dnd: { available: Boolean(raw.dnd?.available), on: Boolean(raw.dnd?.on) },
      available: true,
    };
  } catch (error) {
    return {
      ...EMPTY_AUDIO_STATE,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const devicesNow = async () => {
  const state = await readState();
  if (!state.available) throw new Error(state.error || "Controle de áudio indisponível.");
  return resolveDevices(state, getSettings().audioControl);
};

/**
 * cable: o cabo vira o microfone padrao e o "Escutar" do microfone toca nele (a reuniao ouve
 * voz + Sons). direct: o microfone fisico vira o padrao e o "Escutar" desliga.
 */
const setVoice = async (route: VoiceRoute) => {
  const devices = await devicesNow();
  if (!devices.mic) throw new Error("Nenhum microfone encontrado.");
  if (route === "cable") {
    if (!devices.cableInput || !devices.cableOutput) {
      throw new Error("Cabo virtual (VB-Cable) não encontrado.");
    }
    await callDeskAudio("setDefault", { id: devices.cableInput.id });
    await callDeskAudio("setListen", {
      id: devices.mic.id,
      enabled: true,
      target: devices.cableOutput.id,
    });
  } else {
    await callDeskAudio("setDefault", { id: devices.mic.id });
    if (devices.mic.listen) {
      await callDeskAudio("setListen", { id: devices.mic.id, enabled: false });
    }
  }
  if (devices.mic.muted) {
    await callDeskAudio("setMute", { id: devices.mic.id, muted: false });
  }
};

// Pelo cabo, mutar desliga o "Escutar" (os Sons continuam chegando); direto, muta o microfone
const toggleMute = async (): Promise<VoiceStatus> => {
  const devices = await devicesNow();
  if (!devices.mic) throw new Error("Nenhum microfone encontrado.");
  const current = voiceStatus(devices);
  const mute = !current.muted;
  if (current.route === "cable") {
    if (mute) {
      await callDeskAudio("setListen", { id: devices.mic.id, enabled: false });
    } else {
      await callDeskAudio("setListen", {
        id: devices.mic.id,
        enabled: true,
        target: devices.cableOutput?.id ?? "",
      });
      if (devices.mic.muted) {
        await callDeskAudio("setMute", { id: devices.mic.id, muted: false });
      }
    }
  } else {
    await callDeskAudio("setMute", { id: devices.mic.id, muted: mute });
  }
  return { route: current.route, muted: mute };
};

let getWindow: () => BrowserWindow | null = () => null;

const send = (channel: string, payload?: unknown) => {
  const window = getWindow();
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
};

const registered = new Map<AudioHotkeyAction, string>();

const runHotkey = async (action: AudioHotkeyAction) => {
  const event: AudioHotkeyEvent = { action };
  if (action === "mute") {
    try {
      event.voice = await toggleMute();
    } catch (error) {
      event.error = error instanceof Error ? error.message : String(error);
    }
  }
  send("audio:hotkey", event);
};

const syncHotkeys = (): Record<AudioHotkeyAction, boolean> => {
  for (const accelerator of registered.values()) {
    globalShortcut.unregister(accelerator);
  }
  registered.clear();
  const { hotkeys } = getSettings().audioControl;
  const result: Record<AudioHotkeyAction, boolean> = { open: false, mute: false };
  for (const action of ["open", "mute"] as AudioHotkeyAction[]) {
    const accelerator = hotkeys[action].trim();
    if (!accelerator) continue;
    try {
      // Outro programa ja usa a combinacao: o Windows recusa e o registro devolve false
      if (globalShortcut.register(accelerator, () => void runHotkey(action))) {
        registered.set(action, accelerator);
        result[action] = true;
      }
    } catch (error) {
      logError("system", `Atalho de áudio inválido: ${accelerator}`, String(error));
    }
  }
  return result;
};

export const registerAudioIpc = (getMainWindow: () => BrowserWindow | null) => {
  getWindow = getMainWindow;
  onDeskAudioChanged(() => send("audio:changed"));

  ipcMain.handle("audio:get-state", () => readState());
  ipcMain.handle("audio:set-default", (_event, id: string) =>
    callDeskAudio("setDefault", { id }),
  );
  ipcMain.handle("audio:set-volume", (_event, id: string, volume: number) =>
    callDeskAudio("setVolume", { id, volume }),
  );
  ipcMain.handle("audio:set-mute", (_event, id: string, muted: boolean) =>
    callDeskAudio("setMute", { id, muted }),
  );
  ipcMain.handle("audio:set-app-volume", (_event, key: string, volume: number) =>
    callDeskAudio("setAppVolume", { app: key, volume }),
  );
  ipcMain.handle("audio:set-app-mute", (_event, key: string, muted: boolean) =>
    callDeskAudio("setAppMute", { app: key, muted }),
  );
  ipcMain.handle("audio:set-dnd", (_event, on: boolean) =>
    callDeskAudio("setDnd", { on }),
  );
  ipcMain.handle("audio:set-ducking", (_event, on: boolean) =>
    callDeskAudio("setDucking", { on }),
  );
  ipcMain.handle("audio:set-voice", (_event, route: VoiceRoute) =>
    setVoice(route === "direct" ? "direct" : "cable"),
  );
  ipcMain.handle("audio:toggle-mute", () => toggleMute());
  ipcMain.handle("audio:sync-hotkeys", () => syncHotkeys());

  syncHotkeys();
};

export const stopAudio = () => {
  globalShortcut.unregisterAll();
  stopDeskAudio();
};
