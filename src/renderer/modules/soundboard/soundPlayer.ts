import type {
  SoundboardSettings,
  SoundItem,
} from "../../../shared/contracts";

// Toca os sons em duas saidas: o cabo virtual (vira microfone nos apps de reuniao) e,
// se ligado, o retorno no fone. Fica fora do React para o som nao parar quando a grade
// remonta o modulo.

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

export interface PlayingSound {
  startedAt: number;
  /** Duracao em segundos, conhecida depois que o audio carrega. */
  duration: number | null;
}

/** "default" e "communications" sao apelidos do Windows, nao dispositivos. */
const isAliasDevice = (deviceId: string) =>
  deviceId === "default" || deviceId === "communications";

// Renomeado no Windows, o cabo ainda leva "(VB-Audio Virtual Cable)" no nome
const VIRTUAL_CABLE_LABEL = /VB-Audio/i;

export const listAudioOutputs = async (): Promise<AudioOutputDevice[]> => {
  const enumerate = async () =>
    (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "audiooutput" && !isAliasDevice(device.deviceId),
    );
  let outputs = await enumerate();
  // Sem permissao de midia o Chromium esconde os nomes; abrir o mic um instante libera
  if (outputs.some((device) => !device.label)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      outputs = await enumerate();
    } catch {
      // Segue com o que tiver; o seletor mostra "Saida sem nome".
    }
  }
  return outputs.map((device) => ({
    deviceId: device.deviceId,
    label: device.label,
  }));
};

/** Pelo id; se o Windows trocou o id, pelo nome. */
const findDevice = (
  devices: AudioOutputDevice[],
  deviceId: string,
  label: string,
) =>
  devices.find((device) => device.deviceId === deviceId) ??
  (label ? devices.find((device) => device.label === label) : undefined);

/** Saida configurada ou, sem configuracao, o primeiro cabo do VB-Audio. */
export const resolveOutputDevice = (
  devices: AudioOutputDevice[],
  settings: SoundboardSettings,
) =>
  settings.outputDeviceId || settings.outputDeviceLabel
    ? findDevice(devices, settings.outputDeviceId, settings.outputDeviceLabel)
    : (devices.find((device) => /CABLE Input/i.test(device.label)) ??
      devices.find(
        (device) =>
          VIRTUAL_CABLE_LABEL.test(device.label) && !/16ch/i.test(device.label),
      ));

/** Id do retorno; vazio e a saida padrao do Windows. */
const resolveMonitorDeviceId = (
  devices: AudioOutputDevice[],
  settings: SoundboardSettings,
) =>
  settings.monitorDeviceId || settings.monitorDeviceLabel
    ? (findDevice(devices, settings.monitorDeviceId, settings.monitorDeviceLabel)
        ?.deviceId ?? "")
    : "";

const urlCache = new Map<number, { fileName: string; url: Promise<string> }>();

export const getSoundUrl = (sound: SoundItem) => {
  const cached = urlCache.get(sound.id);
  if (cached?.fileName === sound.fileName) return cached.url;
  if (cached) void cached.url.then((url) => URL.revokeObjectURL(url), () => {});
  const url = window.electronControl.sounds
    .readAudio(sound.id)
    .then(({ bytes, mimeType }) =>
      URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType })),
    );
  url.catch(() => {
    if (urlCache.get(sound.id)?.url === url) urlCache.delete(sound.id);
  });
  urlCache.set(sound.id, { fileName: sound.fileName, url });
  return url;
};

export const forgetSoundAudio = (id: number) => {
  const cached = urlCache.get(id);
  if (!cached) return;
  urlCache.delete(id);
  void cached.url.then((url) => URL.revokeObjectURL(url), () => {});
};

const active = new Map<number, HTMLAudioElement[]>();
const starting = new Set<number>();
let snapshot: ReadonlyMap<number, PlayingSound> = new Map();
const listeners = new Set<() => void>();

const setPlaying = (update: (next: Map<number, PlayingSound>) => void) => {
  const next = new Map(snapshot);
  update(next);
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const subscribePlaying = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getPlayingSnapshot = () => snapshot;

const silence = (elements: HTMLAudioElement[]) => {
  for (const element of elements) {
    element.pause();
    element.removeAttribute("src");
    element.load();
  }
};

export const stopSound = (id: number) => {
  const elements = active.get(id);
  if (!elements) return;
  active.delete(id);
  silence(elements);
  setPlaying((next) => next.delete(id));
};

export const stopAllSounds = () => {
  for (const id of [...active.keys()]) stopSound(id);
};

const createAudio = async (url: string, deviceId: string, volume: number) => {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = Math.min(1, Math.max(0, volume));
  if (deviceId) await audio.setSinkId(deviceId);
  return audio;
};

/** Toca no cabo (e no retorno); se o som ja estiver tocando, para. */
export const toggleSound = async (
  sound: SoundItem,
  settings: SoundboardSettings,
) => {
  if (active.has(sound.id)) {
    stopSound(sound.id);
    return;
  }
  if (starting.has(sound.id)) return;
  starting.add(sound.id);
  try {
    const devices = await listAudioOutputs();
    const output = resolveOutputDevice(devices, settings);
    if (!output) {
      throw new Error(
        settings.outputDeviceLabel
          ? `Saída "${settings.outputDeviceLabel}" não encontrada. Confira o cabo virtual nas configurações de Sons.`
          : "Nenhum cabo virtual encontrado. Escolha a saída nas configurações de Sons.",
      );
    }
    const url = await getSoundUrl(sound);
    const elements = [
      await createAudio(url, output.deviceId, sound.volume * settings.volume),
    ];
    if (settings.monitorEnabled) {
      const monitorId = resolveMonitorDeviceId(devices, settings);
      if (monitorId !== output.deviceId) {
        elements.push(
          await createAudio(url, monitorId, sound.volume * settings.monitorVolume),
        );
      }
    }

    const [main] = elements;
    // O audio vem de um blob local: os metadados costumam carregar durante o setSinkId, antes
    // de qualquer listener. Por isso le a duracao tambem logo depois de registrar o som
    const publishDuration = () => {
      if (active.get(sound.id) !== elements) return;
      if (!Number.isFinite(main.duration) || main.duration <= 0) return;
      const duration = main.duration;
      setPlaying((next) => {
        const current = next.get(sound.id);
        if (current && current.duration !== duration) {
          next.set(sound.id, { ...current, duration });
        }
      });
    };
    main.addEventListener("loadedmetadata", publishDuration);
    main.addEventListener("durationchange", publishDuration);
    main.addEventListener("ended", () => {
      if (active.get(sound.id) === elements) stopSound(sound.id);
    });

    active.set(sound.id, elements);
    setPlaying((next) =>
      next.set(sound.id, { startedAt: Date.now(), duration: null }),
    );
    publishDuration();
    try {
      await Promise.all(elements.map((element) => element.play()));
    } catch (error) {
      stopSound(sound.id);
      throw error;
    }
  } finally {
    starting.delete(sound.id);
  }
};

let preview: HTMLAudioElement | null = null;

export const stopPreview = () => {
  if (!preview) return;
  silence([preview]);
  preview = null;
};

/** Ouvir antes de salvar: so no retorno (ou saida padrao), nunca no microfone. */
export const playPreview = async (
  url: string,
  volume: number,
  settings: SoundboardSettings,
) => {
  stopPreview();
  const devices = await listAudioOutputs();
  const audio = await createAudio(
    url,
    resolveMonitorDeviceId(devices, settings),
    volume * settings.monitorVolume,
  );
  preview = audio;
  audio.addEventListener("ended", () => {
    if (preview === audio) preview = null;
  });
  await audio.play();
};

export const previewSavedSound = async (
  sound: SoundItem,
  volume: number,
  settings: SoundboardSettings,
) => playPreview(await getSoundUrl(sound), volume, settings);
