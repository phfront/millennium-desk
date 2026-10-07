import {
  findDevice,
  isVirtualCable,
  resolveDevices,
  shortDeviceName,
  type AudioControlSettings,
  type AudioScene,
  type AudioState,
} from "../../../shared/audioControl";

export interface AudioAlert {
  id: "cable-output" | "mic-stuck";
  text: string;
  action: string;
  fix: () => Promise<unknown>;
}

/**
 * O que esta errado agora: a saida do Windows virou o cabo (instalador de driver faz isso; o
 * som dos apps iria para a reuniao) ou o microfone ficou no cabo quando a cena manda direto
 * (um ditado do Shello que nao devolveu, por exemplo).
 */
export const audioAlerts = (
  state: AudioState,
  settings: AudioControlSettings,
  activeScene: AudioScene | undefined,
): AudioAlert[] => {
  if (!state.available) return [];
  const api = window.electronControl.audio;
  const alerts: AudioAlert[] = [];
  const devices = resolveDevices(state, settings);

  if (
    settings.warnings.cableOutput &&
    devices.defaultOutput &&
    isVirtualCable(devices.defaultOutput)
  ) {
    const sceneOutput = activeScene?.changes.output
      ? findDevice(state.outputs, activeScene.output)
      : undefined;
    const back =
      (sceneOutput && !isVirtualCable(sceneOutput) ? sceneOutput : undefined) ??
      state.outputs.find((device) => !isVirtualCable(device));
    if (back) {
      alerts.push({
        id: "cable-output",
        text: `A saída do Windows virou o cabo virtual (${shortDeviceName(devices.defaultOutput)}): o som dos apps está indo para a reunião em vez do fone.`,
        action: `Voltar para ${shortDeviceName(back)}`,
        fix: () => api.setDefault(back.id),
      });
    }
  }

  if (
    settings.warnings.micStuck &&
    activeScene?.changes.voice &&
    activeScene.voice === "direct" &&
    devices.cableInput &&
    devices.defaultInput?.id === devices.cableInput.id &&
    devices.mic
  ) {
    alerts.push({
      id: "mic-stuck",
      text: `O microfone padrão está no cabo, mas a cena "${activeScene.name}" usa o microfone direto. Um ditado do Shello pode não ter devolvido.`,
      action: `Voltar para ${shortDeviceName(devices.mic)}`,
      fix: () => api.setVoice("direct"),
    });
  }
  return alerts;
};
