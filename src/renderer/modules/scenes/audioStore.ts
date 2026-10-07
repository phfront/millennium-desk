import { useSyncExternalStore } from "react";
import {
  EMPTY_AUDIO_STATE,
  type AudioState,
} from "../../../shared/audioControl";

// Estado do audio do Windows, compartilhado pelo quadradinho e pelo modal. Le de novo quando o
// ajudante avisa (aparelho/padrao/"Escutar") e, enquanto alguem olha, a cada poucos segundos
// (volume e Nao perturbe mudam sem aviso).

const POLL_MS = 4000;

let state: AudioState = EMPTY_AUDIO_STATE;
let loaded = false;
const listeners = new Set<() => void>();
let pollTimer: number | null = null;
let stopChanged: (() => void) | null = null;
let inFlight: Promise<void> | null = null;

const emit = () => {
  for (const listener of listeners) listener();
};

export const refreshAudio = (): Promise<void> => {
  if (inFlight) return inFlight;
  inFlight = window.electronControl.audio
    .getState()
    .then((next) => {
      state = next;
      loaded = true;
      emit();
    })
    .catch((error) => {
      state = {
        ...EMPTY_AUDIO_STATE,
        error: error instanceof Error ? error.message : String(error),
      };
      loaded = true;
      emit();
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshAudio();
    stopChanged = window.electronControl.audio.onChanged(() => void refreshAudio());
    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshAudio();
    }, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopChanged?.();
    stopChanged = null;
    if (pollTimer !== null) window.clearInterval(pollTimer);
    pollTimer = null;
  };
};

export const useAudioState = () => useSyncExternalStore(subscribe, () => state);

export const isAudioLoaded = () => loaded;

/** Roda uma mudanca e rele o estado no fim, deu certo ou nao. */
export const runAudio = async <T,>(task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } finally {
    await refreshAudio();
  }
};
