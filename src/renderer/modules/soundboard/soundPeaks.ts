import { useEffect, useState } from "react";
import type { SoundItem } from "../../../shared/contracts";
import { getSoundUrl } from "./soundPlayer";

// A forma de onda do botao, tirada do proprio arquivo: decodifica uma vez por arquivo e guarda
// os picos em memoria. Ler o audio aqui tambem aquece o cache do player (o primeiro toque sai
// sem esperar o IPC).

export const SOUND_PEAK_COUNT = 32;

const cache = new Map<string, Promise<number[]>>();

const computePeaks = (buffer: AudioBuffer, count: number) => {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const length = buffer.length;
  const peaks = Array.from({ length: count }, (_, bucket) => {
    const start = Math.floor((bucket * length) / count);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * length) / count));
    // Passo para nao varrer todas as amostras de um audio longo
    const step = Math.max(1, Math.floor((end - start) / 2000));
    let sum = 0;
    let samples = 0;
    for (let index = start; index < end; index += step) {
      for (const data of channels) sum += data[index] * data[index];
      samples += channels.length;
    }
    return samples ? Math.sqrt(sum / samples) : 0;
  });
  const loudest = Math.max(...peaks);
  // Raiz para o trecho baixo nao sumir ao lado do pico
  return peaks.map((peak) => (loudest > 0 ? Math.sqrt(peak / loudest) : 0));
};

const loadPeaks = async (sound: SoundItem) => {
  const url = await getSoundUrl(sound);
  const data = await (await fetch(url)).arrayBuffer();
  // Contexto offline: decodifica sem abrir dispositivo de saida
  const context = new OfflineAudioContext(1, 1, 44100);
  return computePeaks(await context.decodeAudioData(data), SOUND_PEAK_COUNT);
};

const getPeaks = (sound: SoundItem) => {
  const key = `${sound.id}:${sound.fileName}`;
  let peaks = cache.get(key);
  if (!peaks) {
    peaks = loadPeaks(sound);
    peaks.catch(() => cache.delete(key));
    cache.set(key, peaks);
  }
  return peaks;
};

/** Picos de 0 a 1; null enquanto carrega ou se o arquivo nao decodificar. */
export const useSoundPeaks = (sound: SoundItem) => {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true;
    setPeaks(null);
    getPeaks(sound).then(
      (value) => alive && setPeaks(value),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [sound.id, sound.fileName]);
  return peaks;
};
