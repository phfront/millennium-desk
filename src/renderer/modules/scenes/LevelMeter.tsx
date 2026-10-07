import { useEffect, useRef, useState } from "react";

// Medidor ao vivo de um microfone do Windows: abre o aparelho pelo getUserMedia (achado pelo
// nome que o painel de Som mostra), sem cancelamento de eco nem ganho automatico, e pinta o
// pico. So roda enquanto esta na tela.

const FLOOR_DB = -60;

/** O Chromium as vezes poe o id USB no fim: "Microphone (2- ME6S) (0c45:6366)". */
export const findBrowserInput = async (name: string) => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.find(
    (device) =>
      device.kind === "audioinput" &&
      device.deviceId !== "default" &&
      device.deviceId !== "communications" &&
      (device.label === name || device.label.startsWith(`${name} (`)),
  );
};

export const openInput = async (name: string) => {
  const device = await findBrowserInput(name);
  if (!device) throw new Error(`"${name}" não apareceu para o Desk.`);
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: device.deviceId },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
};

export function LevelMeter({ deviceName, label }: { deviceName?: string; label: string }) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceName) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let level = 0;
    setError(null);

    void openInput(deviceName)
      .then((opened) => {
        if (stopped) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(opened).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let peak = 0;
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
          const db = peak > 0 ? 20 * Math.log10(peak) : FLOOR_DB;
          const target = Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
          // Sobe na hora, desce devagar (como os medidores de mesa de som)
          level = target > level ? target : level * 0.92 + target * 0.08;
          fillRef.current?.style.setProperty("--level", String(level));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((openError) => {
        if (!stopped) {
          setError(openError instanceof Error ? openError.message : "Não deu para abrir o microfone.");
        }
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [deviceName]);

  return (
    <div className="control-meter">
      <span className="control-meter-label">{label}</span>
      {error ? (
        <span className="control-meter-error">{error}</span>
      ) : (
        <span className="control-meter-track" aria-hidden="true">
          <span ref={fillRef} className="control-meter-fill" />
        </span>
      )}
    </div>
  );
}
